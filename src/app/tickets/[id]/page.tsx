import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  addCommentAction,
  changePriorityAction,
  changeStatusAction,
  escalateTicketAction,
  reassignTicketAction,
  reopenTicketAction,
} from "@/app/tickets/actions";
import {
  ageingMs,
  formatDuration,
  isPaused,
  isResolutionBreached,
  isResponseBreached,
  runEscalationSweep,
} from "@/lib/sla";
import {
  ACTIVITY_LABEL,
  DEPARTMENT_LABEL,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/labels";
import { Badge } from "@/components/Badge";
import { canManageTicket, canTransition, isStaffRole } from "@/lib/workflow";
import { Priority, Role, Status } from "@prisma/client";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  try {
    await runEscalationSweep();
  } catch {
    // best-effort
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      requester: true,
      assignee: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      activities: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) notFound();

  const isStaff = isStaffRole(session.role);
  const isRequester = ticket.requesterId === session.id;
  if (!isStaff && !isRequester) notFound();

  const canManage = isStaff
    ? canManageTicket({
        role: session.role,
        userId: session.id,
        assigneeId: ticket.assigneeId,
        department: ticket.category,
        userDepartment: session.department,
      })
    : false;

  const nextStatuses = canManage
    ? Object.values(Status).filter((s) => s !== ticket.status && canTransition(ticket.status, s))
    : [];

  const deptAgents =
    canManage && (session.role === Role.MANAGER || session.role === Role.ADMIN)
      ? await prisma.user.findMany({ where: { role: Role.AGENT, department: ticket.category } })
      : [];

  const visibleComments = isStaff ? ticket.comments : ticket.comments.filter((c) => !c.isInternal);
  const resBreached = isResolutionBreached(ticket);
  const respBreached = isResponseBreached(ticket);
  const paused = isPaused(ticket);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/tickets" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        ← Back to tickets
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{ticket.ticketNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{ticket.subject}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className={STATUS_BADGE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
            <Badge className={PRIORITY_BADGE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]} priority</Badge>
            <Badge className="bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/20 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-600/30">
              {DEPARTMENT_LABEL[ticket.category]}
            </Badge>
            {ticket.escalationLevel > 0 && (
              <Badge className="bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/30">
                Escalation level {ticket.escalationLevel}
              </Badge>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <dt className="text-gray-500 dark:text-gray-400">Requester</dt>
            <dd className="text-gray-900 dark:text-gray-100">{ticket.requester.name}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Owner</dt>
            <dd className="text-gray-900 dark:text-gray-100">{ticket.assignee?.name ?? "Unassigned"}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Age</dt>
            <dd className="text-gray-900 dark:text-gray-100">{formatDuration(ageingMs(ticket))}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Resolution SLA</dt>
            <dd className={resBreached ? "font-medium text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}>
              {paused ? "Paused (awaiting student)" : resBreached ? "Breached" : `Due in ${formatDuration(ticket.dueAt.getTime() - Date.now())}`}
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">First response SLA</dt>
            <dd className={respBreached ? "font-medium text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"}>
              {ticket.respondedAt ? "Met" : respBreached ? "Overdue" : `Due in ${formatDuration(ticket.responseDueAt.getTime() - Date.now())}`}
            </dd>
          </dl>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{ticket.description}</p>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conversation</h2>
            <ul className="mt-4 space-y-4">
              {visibleComments.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-md border p-3 text-sm ${
                    c.isInternal
                      ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-500/10"
                      : "border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {c.author.name}{" "}
                      {c.isInternal && <span className="text-amber-700 dark:text-amber-400">(internal note)</span>}
                    </span>
                    <span>{c.createdAt.toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-gray-800 dark:text-gray-200">{c.body}</p>
                </li>
              ))}
              {visibleComments.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No comments yet.</p>}
            </ul>

            <form action={addCommentAction} className="mt-5 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <textarea
                name="body"
                required
                rows={3}
                placeholder={isStaff ? "Reply to the student…" : "Add a reply…"}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <div className="flex items-center justify-between">
                {isStaff ? (
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <input type="checkbox" name="isInternal" className="rounded border-gray-300 dark:border-gray-600" />
                    Internal note (hidden from student)
                  </label>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                  Post
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Activity history</h2>
            <ol className="mt-4 space-y-3 border-l border-gray-200 pl-4 dark:border-gray-800">
              {ticket.activities.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-gray-800 dark:text-gray-200">
                    <span className="font-medium">{ACTIVITY_LABEL[a.action] ?? a.action}</span>
                    {a.fromValue && a.toValue ? ` — ${a.fromValue} → ${a.toValue}` : a.toValue ? ` — ${a.toValue}` : ""}
                  </p>
                  {a.note && <p className="text-gray-500 dark:text-gray-400">{a.note}</p>}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {a.actor?.name ?? "System"} · {a.createdAt.toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          {canManage && (
            <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Manage ticket</h2>

              {nextStatuses.length > 0 && (
                <form action={changeStatusAction} className="mt-4 space-y-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Change status</label>
                  <select name="status" className={selectClass} defaultValue={nextStatuses[0]}>
                    {nextStatuses.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="note"
                    placeholder="Optional note (visible in activity history)"
                    className={selectClass}
                  />
                  <button type="submit" className={primaryBtn}>
                    Update status
                  </button>
                </form>
              )}

              <form action={changePriorityAction} className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Change priority</label>
                <select name="priority" defaultValue={ticket.priority} className={selectClass}>
                  {Object.values(Priority).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
                <button type="submit" className={secondaryBtn}>
                  Update priority
                </button>
              </form>

              {(session.role === Role.MANAGER || session.role === Role.ADMIN) && (
                <form action={reassignTicketAction} className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Reassign owner</label>
                  <select name="assigneeId" defaultValue={ticket.assigneeId ?? ""} className={selectClass}>
                    <option value="">Unassigned (department queue)</option>
                    {deptAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={secondaryBtn}>
                    Reassign
                  </button>
                </form>
              )}

              {session.role === Role.AGENT && !ticket.assigneeId && (
                <form action={reassignTicketAction} className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="assigneeId" value={session.id} />
                  <button type="submit" className={secondaryBtn}>
                    Claim this ticket
                  </button>
                </form>
              )}

              {ticket.status !== Status.ESCALATED && ticket.status !== Status.RESOLVED && ticket.status !== Status.CLOSED && (
                <form action={escalateTicketAction} className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input
                    type="text"
                    name="note"
                    placeholder="Reason for escalating"
                    className={selectClass}
                  />
                  <button
                    type="submit"
                    className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400"
                  >
                    Escalate to manager
                  </button>
                </form>
              )}
            </section>
          )}

          {isRequester && (ticket.status === Status.RESOLVED || ticket.status === Status.CLOSED) && (
            <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Not satisfied?</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Reopening notifies the support team and restarts SLA tracking.
              </p>
              <form action={reopenTicketAction} className="mt-3 space-y-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <input type="text" name="note" placeholder="Why are you reopening this?" className={selectClass} />
                <button
                  type="submit"
                  className="w-full rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400"
                >
                  Reopen ticket
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const selectClass =
  "block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";
const primaryBtn =
  "w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400";
const secondaryBtn =
  "w-full rounded-md bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600";
