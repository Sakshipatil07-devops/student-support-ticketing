import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  ageingBucket,
  ageingMs,
  isResolutionBreached,
  isResponseBreached,
  runEscalationSweep,
} from "@/lib/sla";
import { DEPARTMENT_LABEL, STATUS_LABEL } from "@/lib/labels";
import { AGEING_BUCKET_COLOR, STATUS_CHART_COLOR, STATUS_COLOR, TRACK_BG } from "@/lib/chart-colors";
import { RunSlaCheckButton } from "./RunSlaCheckButton";
import { Department, Role, Status } from "@prisma/client";

const OPEN_STATUSES: Status[] = [Status.OPEN, Status.IN_PROGRESS, Status.PENDING_STUDENT, Status.ESCALATED, Status.REOPENED];
const AGE_BUCKET_ORDER = ["0-1 day", "1-3 days", "3-7 days", "7+ days"];

export default async function DashboardPage() {
  const session = await requireSession();
  if (session.role !== Role.MANAGER && session.role !== Role.ADMIN) redirect("/tickets");

  try {
    await runEscalationSweep();
  } catch {
    // best-effort
  }

  const [statusGroups, openTickets, resolvedToday, agents] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.ticket.findMany({
      where: { status: { in: OPEN_STATUSES } },
      include: { assignee: true },
    }),
    prisma.ticket.count({
      where: { resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.user.findMany({ where: { role: Role.AGENT } }),
  ]);

  const totalTickets = statusGroups.reduce((sum, g) => sum + g._count._all, 0);
  const statusCounts = new Map(statusGroups.map((g) => [g.status, g._count._all]));

  const escalatedCount = openTickets.filter((t) => t.status === Status.ESCALATED).length;
  const resolutionBreached = openTickets.filter((t) => isResolutionBreached(t));
  const responseOverdue = openTickets.filter((t) => isResponseBreached(t));

  const ageBuckets = new Map<string, number>(AGE_BUCKET_ORDER.map((b) => [b, 0]));
  for (const t of openTickets) {
    const bucket = ageingBucket(ageingMs(t));
    ageBuckets.set(bucket, (ageBuckets.get(bucket) ?? 0) + 1);
  }
  const maxAgeBucket = Math.max(1, ...Array.from(ageBuckets.values()));

  const deptWorkload = Object.values(Department).map((dept) => {
    const tickets = openTickets.filter((t) => t.category === dept);
    return {
      dept,
      open: tickets.length,
      breached: tickets.filter((t) => isResolutionBreached(t)).length,
    };
  });

  const agentWorkload = agents.map((agent) => {
    const assigned = openTickets.filter((t) => t.assigneeId === agent.id);
    return {
      agent,
      open: assigned.length,
      breached: assigned.filter((t) => isResolutionBreached(t)).length,
    };
  });

  const maxStatusCount = Math.max(1, ...Array.from(statusCounts.values()));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Management Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">{totalTickets} tickets tracked across all departments</p>
        </div>
        <RunSlaCheckButton />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Open (active)" value={openTickets.length} />
        <StatTile label="Escalated" value={escalatedCount} color={STATUS_COLOR.critical} />
        <StatTile label="Resolution SLA breached" value={resolutionBreached.length} color={STATUS_COLOR.critical} />
        <StatTile label="Response overdue" value={responseOverdue.length} color={STATUS_COLOR.warning} />
        <StatTile label="Resolved today" value={resolvedToday} color={STATUS_COLOR.good} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Tickets by status</h2>
          <ul className="mt-4 space-y-3">
            {Object.values(Status).map((s) => {
              const count = statusCounts.get(s) ?? 0;
              const pct = (count / maxStatusCount) * 100;
              return (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 text-gray-600">{STATUS_LABEL[s]}</span>
                  <span className="h-4 flex-1 overflow-hidden rounded-full" style={{ background: TRACK_BG }}>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct}%`, background: STATUS_CHART_COLOR[s] }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-medium text-gray-900">{count}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Ageing of open tickets</h2>
          <p className="mt-1 text-xs text-gray-500">How long active tickets have been open — older buckets carry more SLA risk.</p>
          <ul className="mt-4 space-y-3">
            {AGE_BUCKET_ORDER.map((bucket) => {
              const count = ageBuckets.get(bucket) ?? 0;
              const pct = (count / maxAgeBucket) * 100;
              return (
                <li key={bucket} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-gray-600">{bucket}</span>
                  <span className="h-4 flex-1 overflow-hidden rounded-full" style={{ background: TRACK_BG }}>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct}%`, background: AGEING_BUCKET_COLOR[bucket] }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-medium text-gray-900">{count}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Department workload</h2>
          <table className="mt-4 min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-1.5">Department</th>
                <th className="py-1.5 text-right">Open</th>
                <th className="py-1.5 text-right">Breached</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deptWorkload.map((d) => (
                <tr key={d.dept}>
                  <td className="py-2 text-gray-800">{DEPARTMENT_LABEL[d.dept]}</td>
                  <td className="py-2 text-right text-gray-900">{d.open}</td>
                  <td className={`py-2 text-right font-medium ${d.breached > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {d.breached}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Agent workload</h2>
          <table className="mt-4 min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-1.5">Agent</th>
                <th className="py-1.5">Department</th>
                <th className="py-1.5 text-right">Open</th>
                <th className="py-1.5 text-right">Breached</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agentWorkload.map((a) => (
                <tr key={a.agent.id}>
                  <td className="py-2 text-gray-800">{a.agent.name}</td>
                  <td className="py-2 text-gray-500">{a.agent.department ? DEPARTMENT_LABEL[a.agent.department] : "—"}</td>
                  <td className="py-2 text-right text-gray-900">{a.open}</td>
                  <td className={`py-2 text-right font-medium ${a.breached > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {a.breached}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">SLA breach list</h2>
          <Link href="/tickets?status=OPEN_ANY" className="text-xs font-medium text-indigo-600 hover:underline">
            View all active tickets →
          </Link>
        </div>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-1.5">Ticket</th>
              <th className="py-1.5">Department</th>
              <th className="py-1.5">Owner</th>
              <th className="py-1.5 text-right">Overdue by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resolutionBreached.slice(0, 15).map((t) => (
              <tr key={t.id}>
                <td className="py-2">
                  <Link href={`/tickets/${t.id}`} className="font-medium text-indigo-600 hover:underline">
                    {t.ticketNumber}
                  </Link>
                  <span className="ml-2 text-gray-500">{t.subject}</span>
                </td>
                <td className="py-2 text-gray-600">{DEPARTMENT_LABEL[t.category]}</td>
                <td className="py-2 text-gray-600">{t.assignee?.name ?? "Unassigned"}</td>
                <td className="py-2 text-right font-medium text-red-600">
                  {Math.round((Date.now() - t.dueAt.getTime()) / 3_600_000)}h
                </td>
              </tr>
            ))}
            {resolutionBreached.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-400">
                  No SLA breaches right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold" style={{ color: color ?? "#0b0b0b" }}>
        {value}
      </p>
    </div>
  );
}
