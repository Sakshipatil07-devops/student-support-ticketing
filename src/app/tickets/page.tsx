import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { buildTicketWhere } from "@/lib/ticket-queries";
import { runEscalationSweep, ageingMs, formatDuration, isResolutionBreached, isResponseBreached } from "@/lib/sla";
import { STATUS_BADGE, STATUS_LABEL, PRIORITY_BADGE, PRIORITY_LABEL, DEPARTMENT_LABEL } from "@/lib/labels";
import { Badge } from "@/components/Badge";
import { Role, Status, Priority, Department } from "@prisma/client";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  const filters = await searchParams;

  try {
    await runEscalationSweep();
  } catch {
    // best-effort; do not block rendering on sweep failure
  }

  const where = buildTicketWhere(session, filters);
  const tickets = await prisma.ticket.findMany({
    where,
    include: { requester: true, assignee: true },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 200,
  });

  const isStudent = session.role === Role.STUDENT;
  const isAgent = session.role === Role.AGENT;
  const scope = filters.scope ?? "mine";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {isStudent ? "My Tickets" : isAgent ? "Ticket Queue" : "All Tickets"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tickets.length} ticket{tickets.length === 1 ? "" : "s"} found</p>
        </div>
        {isStudent && (
          <Link
            href="/tickets/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Raise a Ticket
          </Link>
        )}
      </div>

      {isAgent && (
        <div className="mt-6 flex gap-2 border-b border-gray-200 text-sm font-medium dark:border-gray-800">
          {[
            { key: "mine", label: "My Tickets" },
            { key: "queue", label: "Department Queue (unassigned)" },
            { key: "department", label: "All Department Tickets" },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={`/tickets?scope=${tab.key}`}
              className={`border-b-2 px-3 py-2 ${
                scope === tab.key
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {isAgent && <input type="hidden" name="scope" value={scope} />}
        <Field label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={selectClass}>
            <option value="">All</option>
            <option value="OPEN_ANY">Open (any active status)</option>
            {Object.values(Status).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue={filters.priority ?? ""} className={selectClass}>
            <option value="">All</option>
            {Object.values(Priority).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        {!isStudent && !isAgent && (
          <Field label="Department">
            <select name="category" defaultValue={filters.category ?? ""} className={selectClass}>
              <option value="">All</option>
              {Object.values(Department).map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABEL[d]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Search">
          <input
            type="text"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Subject, ticket #, description…"
            className={selectClass}
          />
        </Field>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
        >
          Apply
        </button>
        <Link
          href={isAgent ? `/tickets?scope=${scope}` : "/tickets"}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Clear filters
        </Link>
      </form>

      <div className="mt-6 overflow-hidden overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <Th>Ticket</Th>
              <Th>Category</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              {!isStudent && <Th>Requester</Th>}
              <Th>Owner</Th>
              <Th>Age</Th>
              <Th>SLA</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {tickets.map((t) => {
              const resBreached = isResolutionBreached(t);
              const respBreached = isResponseBreached(t);
              return (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      {t.ticketNumber}
                    </Link>
                    <p className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">{t.subject}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-400">{DEPARTMENT_LABEL[t.category]}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge className={PRIORITY_BADGE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge className={STATUS_BADGE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                  </td>
                  {!isStudent && <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-400">{t.requester.name}</td>}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-400">{t.assignee?.name ?? "Unassigned"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">{formatDuration(ageingMs(t))}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {resBreached ? (
                      <Badge className="bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/30">
                        Resolution breached
                      </Badge>
                    ) : respBreached ? (
                      <Badge className="bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30">
                        Response overdue
                      </Badge>
                    ) : t.pendingSince ? (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Paused</span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">On track</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No tickets match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const selectClass =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
      {label}
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </th>
  );
}
