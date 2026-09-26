import { prisma } from "@/lib/prisma";
import { computeInitialDueDates } from "@/lib/sla";
import { logActivity } from "@/lib/activity";
import { ActivityAction, Department, Priority, Role, Status } from "@prisma/client";

async function generateTicketNumber() {
  const count = await prisma.ticket.count();
  const next = count + 1;
  return `TCK-${String(next).padStart(5, "0")}`;
}

/**
 * Pick the agent in the target department with the fewest currently open
 * tickets (simple load-balanced auto-assignment). Falls back to unassigned
 * (department queue) if no agent is registered for that department yet.
 */
async function pickLeastLoadedAgent(department: Department) {
  const agents = await prisma.user.findMany({
    where: { role: Role.AGENT, department },
    include: {
      ticketsAssigned: {
        where: { status: { in: [Status.OPEN, Status.IN_PROGRESS, Status.ESCALATED, Status.REOPENED] } },
      },
    },
  });
  if (agents.length === 0) return null;
  agents.sort((a, b) => a.ticketsAssigned.length - b.ticketsAssigned.length);
  return agents[0];
}

export async function createTicket(params: {
  subject: string;
  description: string;
  category: Department;
  priority: Priority;
  requesterId: string;
}) {
  const now = new Date();
  const ticketNumber = await generateTicketNumber();
  const { responseDueAt, dueAt } = await computeInitialDueDates(params.priority, now);
  const assignee = await pickLeastLoadedAgent(params.category);

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      subject: params.subject,
      description: params.description,
      category: params.category,
      priority: params.priority,
      requesterId: params.requesterId,
      status: Status.OPEN,
      responseDueAt,
      dueAt,
      assigneeId: assignee?.id ?? null,
    },
  });

  await logActivity({
    ticketId: ticket.id,
    actorId: params.requesterId,
    action: ActivityAction.CREATED,
    note: `Ticket raised in ${params.category} queue, priority ${params.priority}.`,
  });

  if (assignee) {
    await logActivity({
      ticketId: ticket.id,
      actorId: null,
      action: ActivityAction.ASSIGNED,
      toValue: assignee.name,
      note: "Auto-assigned to least-loaded agent in department.",
    });
  }

  return ticket;
}
