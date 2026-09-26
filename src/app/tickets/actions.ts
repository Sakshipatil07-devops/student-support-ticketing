"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActivityAction, Department, Priority, Role, Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createTicket } from "@/lib/tickets";
import { canManageTicket, canTransition, isStaffRole } from "@/lib/workflow";
import { pauseSlaClock, resumeSlaClock } from "@/lib/sla";

async function loadTicketOrThrow(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error("Ticket not found");
  return ticket;
}

async function assertCanManage(ticketId: string) {
  const session = await requireSession();
  const ticket = await loadTicketOrThrow(ticketId);
  const allowed = canManageTicket({
    role: session.role,
    userId: session.id,
    assigneeId: ticket.assigneeId,
    department: ticket.category,
    userDepartment: session.department,
  });
  if (!allowed) throw new Error("Forbidden: you do not own this ticket");
  return { session, ticket };
}

// ---------------------------------------------------------------------------
// Create ticket (student)
// ---------------------------------------------------------------------------
export async function createTicketAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== Role.STUDENT) throw new Error("Only students can raise tickets");

  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "") as Department;
  const priority = String(formData.get("priority") ?? "MEDIUM") as Priority;

  if (!subject || !description) {
    throw new Error("Subject and description are required");
  }
  if (!Object.values(Department).includes(category)) {
    throw new Error("Invalid category");
  }
  if (!Object.values(Priority).includes(priority)) {
    throw new Error("Invalid priority");
  }

  const ticket = await createTicket({
    subject,
    description,
    category,
    priority,
    requesterId: session.id,
  });

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

// ---------------------------------------------------------------------------
// Comments (student + staff). Adding a comment while PENDING_STUDENT and the
// commenter is the requester clears the pending state automatically.
// ---------------------------------------------------------------------------
export async function addCommentAction(formData: FormData) {
  const session = await requireSession();
  const ticketId = String(formData.get("ticketId"));
  const body = String(formData.get("body") ?? "").trim();
  const isInternal = formData.get("isInternal") === "on";

  if (!body) throw new Error("Comment cannot be empty");

  const ticket = await loadTicketOrThrow(ticketId);
  const isRequester = ticket.requesterId === session.id;
  const isStaff = isStaffRole(session.role);

  if (!isRequester && !isStaff) throw new Error("Forbidden");
  if (isInternal && !isStaff) throw new Error("Only staff can add internal notes");
  if (isRequester && !isStaff) {
    // students may always comment on their own ticket, no ownership check needed
  } else if (isStaff && session.role === Role.AGENT) {
    await assertCanManage(ticketId);
  }

  await prisma.comment.create({
    data: { ticketId, authorId: session.id, body, isInternal: isStaff ? isInternal : false },
  });

  await logActivity({
    ticketId,
    actorId: session.id,
    action: isInternal ? ActivityAction.INTERNAL_NOTE_ADDED : ActivityAction.COMMENT_ADDED,
  });

  // First staff response stops the response-SLA clock.
  if (isStaff && !ticket.respondedAt) {
    await prisma.ticket.update({ where: { id: ticketId }, data: { respondedAt: new Date() } });
  }

  // Student replying to a pending-on-student ticket resumes the clock.
  if (isRequester && ticket.status === Status.PENDING_STUDENT) {
    await resumeSlaClock(ticketId);
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: Status.IN_PROGRESS } });
    await logActivity({
      ticketId,
      actorId: session.id,
      action: ActivityAction.PENDING_CLEARED,
      fromValue: Status.PENDING_STUDENT,
      toValue: Status.IN_PROGRESS,
      note: "Student responded — SLA clock resumed.",
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
}

// ---------------------------------------------------------------------------
// Status transitions (staff)
// ---------------------------------------------------------------------------
export async function changeStatusAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId"));
  const to = String(formData.get("status")) as Status;
  const note = String(formData.get("note") ?? "").trim() || null;

  const { session, ticket } = await assertCanManage(ticketId);

  if (!Object.values(Status).includes(to)) throw new Error("Invalid status");
  if (!canTransition(ticket.status, to)) {
    throw new Error(`Cannot move ticket from ${ticket.status} to ${to}`);
  }

  const data: Record<string, unknown> = { status: to };
  if (to === Status.RESOLVED) data.resolvedAt = new Date();
  if (to === Status.CLOSED) data.closedAt = new Date();
  if (to === Status.REOPENED) data.reopenCount = ticket.reopenCount + 1;
  if (to !== Status.ESCALATED && ticket.escalationLevel > 0 && to === Status.RESOLVED) {
    // resolving clears escalation visibility
    data.escalationLevel = 0;
  }

  if (to === Status.PENDING_STUDENT) {
    await pauseSlaClock(ticketId);
  } else if (ticket.status === Status.PENDING_STUDENT) {
    await resumeSlaClock(ticketId);
  }

  await prisma.ticket.update({ where: { id: ticketId }, data });

  const actionMap: Partial<Record<Status, ActivityAction>> = {
    RESOLVED: ActivityAction.RESOLVED,
    CLOSED: ActivityAction.CLOSED,
    REOPENED: ActivityAction.REOPENED,
    PENDING_STUDENT: ActivityAction.PENDING_SET,
  };

  await logActivity({
    ticketId,
    actorId: session.id,
    action: actionMap[to] ?? ActivityAction.STATUS_CHANGED,
    fromValue: ticket.status,
    toValue: to,
    note,
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

// ---------------------------------------------------------------------------
// Student reopen (self-service, RESOLVED/CLOSED only)
// ---------------------------------------------------------------------------
export async function reopenTicketAction(formData: FormData) {
  const session = await requireSession();
  const ticketId = String(formData.get("ticketId"));
  const note = String(formData.get("note") ?? "").trim() || "Reopened by student.";

  const ticket = await loadTicketOrThrow(ticketId);
  if (ticket.requesterId !== session.id) throw new Error("Forbidden");
  if (ticket.status !== Status.RESOLVED && ticket.status !== Status.CLOSED) {
    throw new Error("Only resolved or closed tickets can be reopened");
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: Status.REOPENED, reopenCount: ticket.reopenCount + 1, resolvedAt: null, closedAt: null },
  });

  await logActivity({
    ticketId,
    actorId: session.id,
    action: ActivityAction.REOPENED,
    fromValue: ticket.status,
    toValue: Status.REOPENED,
    note,
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

// ---------------------------------------------------------------------------
// Priority change (staff)
// ---------------------------------------------------------------------------
export async function changePriorityAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId"));
  const to = String(formData.get("priority")) as Priority;
  const { session, ticket } = await assertCanManage(ticketId);

  if (!Object.values(Priority).includes(to)) throw new Error("Invalid priority");

  await prisma.ticket.update({ where: { id: ticketId }, data: { priority: to } });
  await logActivity({
    ticketId,
    actorId: session.id,
    action: ActivityAction.PRIORITY_CHANGED,
    fromValue: ticket.priority,
    toValue: to,
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

// ---------------------------------------------------------------------------
// Assignment (staff)
// ---------------------------------------------------------------------------
export async function reassignTicketAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId"));
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const session = await requireSession();
  if (!isStaffRole(session.role)) throw new Error("Forbidden");

  const ticket = await loadTicketOrThrow(ticketId);

  if (session.role === Role.AGENT) {
    // agents may only claim an unassigned ticket in their own department, or hand off their own ticket
    const isClaim = !ticket.assigneeId && session.department === ticket.category && assigneeId === session.id;
    const isOwn = ticket.assigneeId === session.id;
    if (!isClaim && !isOwn) throw new Error("Forbidden");
  }

  let assigneeName: string | null = null;
  if (assigneeId) {
    const agent = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!agent || !isStaffRole(agent.role)) throw new Error("Invalid assignee");
    assigneeName = agent.name;
  }

  await prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId } });
  await logActivity({
    ticketId,
    actorId: session.id,
    action: ticket.assigneeId ? ActivityAction.REASSIGNED : ActivityAction.ASSIGNED,
    toValue: assigneeName ?? "Unassigned",
    note: assigneeName ? `Assigned to ${assigneeName}.` : "Unassigned from queue.",
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

// ---------------------------------------------------------------------------
// Manual escalation (staff)
// ---------------------------------------------------------------------------
export async function escalateTicketAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId"));
  const note = String(formData.get("note") ?? "").trim() || "Manually escalated by agent.";
  const { session, ticket } = await assertCanManage(ticketId);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: Status.ESCALATED,
      escalationLevel: Math.max(ticket.escalationLevel, 1),
      escalatedAt: new Date(),
    },
  });

  await logActivity({
    ticketId,
    actorId: session.id,
    action: ActivityAction.ESCALATED,
    fromValue: ticket.status,
    toValue: Status.ESCALATED,
    note,
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}
