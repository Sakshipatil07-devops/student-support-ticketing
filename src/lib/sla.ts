import { prisma } from "@/lib/prisma";
import { Priority, Status, ActivityAction, type Ticket } from "@prisma/client";

// ---------------------------------------------------------------------------
// SLA policy defaults (minutes). Seeded into SlaPolicy table; editable there.
// Assumption: single policy per priority (not per category) — documented in
// ASSUMPTIONS.md. Ageing/SLA clocks use calendar time, not business hours.
// ---------------------------------------------------------------------------
export const DEFAULT_SLA_POLICY: Record<Priority, { firstResponseMins: number; resolutionMins: number }> = {
  URGENT: { firstResponseMins: 30, resolutionMins: 4 * 60 },
  HIGH: { firstResponseMins: 60 * 2, resolutionMins: 24 * 60 },
  MEDIUM: { firstResponseMins: 60 * 8, resolutionMins: 3 * 24 * 60 },
  LOW: { firstResponseMins: 24 * 60, resolutionMins: 7 * 24 * 60 },
};

export async function getPolicyMap() {
  const rows = await prisma.slaPolicy.findMany();
  const map = new Map(rows.map((r) => [r.priority, r]));
  return map;
}

export async function computeInitialDueDates(priority: Priority, createdAt: Date) {
  const map = await getPolicyMap();
  const policy = map.get(priority) ?? DEFAULT_SLA_POLICY[priority];
  return {
    responseDueAt: new Date(createdAt.getTime() + policy.firstResponseMins * 60_000),
    dueAt: new Date(createdAt.getTime() + policy.resolutionMins * 60_000),
  };
}

const OPEN_STATUSES: Status[] = [Status.OPEN, Status.IN_PROGRESS, Status.ESCALATED, Status.REOPENED];

export function isTerminal(status: Status) {
  return status === Status.RESOLVED || status === Status.CLOSED;
}

export function isPaused(ticket: Pick<Ticket, "pendingSince">) {
  return ticket.pendingSince !== null;
}

/** Resolution SLA is breached once past dueAt, ticket still open, and clock not paused. */
export function isResolutionBreached(ticket: Pick<Ticket, "dueAt" | "status" | "pendingSince">, now = new Date()) {
  if (isTerminal(ticket.status)) return false;
  if (isPaused(ticket)) return false;
  return now.getTime() > ticket.dueAt.getTime();
}

/** First-response SLA is breached if no staff response yet and past responseDueAt. */
export function isResponseBreached(
  ticket: Pick<Ticket, "respondedAt" | "responseDueAt" | "status">,
  now = new Date()
) {
  if (ticket.respondedAt) return false;
  if (isTerminal(ticket.status)) return false;
  return now.getTime() > ticket.responseDueAt.getTime();
}

export function ageingMs(ticket: Pick<Ticket, "createdAt">, now = new Date()) {
  return now.getTime() - ticket.createdAt.getTime();
}

export function ageingBucket(ms: number) {
  const hours = ms / 3_600_000;
  if (hours < 24) return "0-1 day";
  if (hours < 72) return "1-3 days";
  if (hours < 168) return "3-7 days";
  return "7+ days";
}

export function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / (60 * 24));
  const hours = Math.floor((mins % (60 * 24)) / 60);
  const remMins = mins % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${remMins}m`);
  return parts.join(" ");
}

/**
 * Pause the SLA clock (student action required). Called when status moves to
 * PENDING_STUDENT.
 */
export async function pauseSlaClock(ticketId: string, now = new Date()) {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { pendingSince: now },
  });
}

/**
 * Resume the SLA clock: shift dueAt/responseDueAt forward by however long the
 * ticket sat waiting on the student, then clear pendingSince.
 */
export async function resumeSlaClock(ticketId: string, now = new Date()) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  if (!ticket.pendingSince) return;
  const pausedMs = now.getTime() - ticket.pendingSince.getTime();
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      pendingSince: null,
      totalPausedMs: ticket.totalPausedMs + BigInt(Math.max(0, pausedMs)),
      dueAt: new Date(ticket.dueAt.getTime() + pausedMs),
      responseDueAt: ticket.respondedAt ? ticket.responseDueAt : new Date(ticket.responseDueAt.getTime() + pausedMs),
    },
  });
}

/**
 * Escalation sweep — in production this would run on a schedule (cron /
 * queue worker). Here it is invoked lazily whenever dashboard/list data is
 * read, plus exposed as a manual "Run SLA check" action for managers/admins.
 *
 * Escalation ladder (documented assumption, see ASSUMPTIONS.md):
 *   Level 0 -> 1: resolution SLA breached, not paused, not resolved/closed.
 *                 Status forced to ESCALATED, ownership stays with agent but
 *                 becomes visible on the manager escalation board.
 *   Level 1 -> 2: still unresolved after a second full SLA window has
 *                 elapsed since the due date. Priority is bumped to URGENT
 *                 and flagged for admin attention.
 */
export async function runEscalationSweep(now = new Date()) {
  const candidates = await prisma.ticket.findMany({
    where: { status: { in: OPEN_STATUSES }, pendingSince: null },
  });

  let escalatedCount = 0;

  for (const ticket of candidates) {
    if (!isResolutionBreached(ticket, now)) continue;

    if (ticket.escalationLevel === 0) {
      await prisma.$transaction([
        prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: Status.ESCALATED,
            escalationLevel: 1,
            escalatedAt: now,
            slaBreached: true,
          },
        }),
        prisma.activityLog.create({
          data: {
            ticketId: ticket.id,
            actorId: null,
            action: ActivityAction.ESCALATED,
            fromValue: ticket.status,
            toValue: Status.ESCALATED,
            note: "Auto-escalated: resolution SLA breached (level 1 — manager visibility).",
          },
        }),
      ]);
      escalatedCount++;
      continue;
    }

    if (ticket.escalationLevel === 1) {
      const policyMins =
        (await getPolicyMap()).get(ticket.priority)?.resolutionMins ??
        DEFAULT_SLA_POLICY[ticket.priority].resolutionMins;
      const secondWindowMs = ticket.dueAt.getTime() + policyMins * 60_000;
      if (now.getTime() > secondWindowMs) {
        await prisma.$transaction([
          prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              escalationLevel: 2,
              priority: Priority.URGENT,
              escalatedAt: now,
            },
          }),
          prisma.activityLog.create({
            data: {
              ticketId: ticket.id,
              actorId: null,
              action: ActivityAction.ESCALATED,
              fromValue: "level-1",
              toValue: "level-2",
              note: "Auto-escalated: unresolved after repeated SLA breach (level 2 — admin attention, priority raised to URGENT).",
            },
          }),
        ]);
        escalatedCount++;
      } else {
        // still flag as breached even if not yet bumped to level 2
        if (!ticket.slaBreached) {
          await prisma.ticket.update({ where: { id: ticket.id }, data: { slaBreached: true } });
        }
      }
    }
  }

  return { checked: candidates.length, escalated: escalatedCount };
}
