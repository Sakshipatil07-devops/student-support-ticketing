import { Role, Status } from "@prisma/client";

// ---------------------------------------------------------------------------
// Ticket lifecycle state machine.
//
//   OPEN --------------> IN_PROGRESS <----> PENDING_STUDENT
//     \                     |  ^                  |
//      \--> ESCALATED <-----/  \--------(resolve)--/
//                |
//                v
//            RESOLVED --> CLOSED
//                |            |
//                \--(reopen)--/---------> REOPENED --> IN_PROGRESS ...
//
// Students may only: comment, respond to a pending-on-student ticket
// (which clears the pending state back to IN_PROGRESS), and reopen a
// RESOLVED/CLOSED ticket they raised. All other transitions are staff-only.
// ---------------------------------------------------------------------------

export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  OPEN: [Status.IN_PROGRESS, Status.PENDING_STUDENT, Status.RESOLVED, Status.ESCALATED],
  IN_PROGRESS: [Status.PENDING_STUDENT, Status.RESOLVED, Status.ESCALATED],
  PENDING_STUDENT: [Status.IN_PROGRESS, Status.RESOLVED],
  ESCALATED: [Status.IN_PROGRESS, Status.PENDING_STUDENT, Status.RESOLVED],
  RESOLVED: [Status.CLOSED, Status.REOPENED],
  CLOSED: [Status.REOPENED],
  REOPENED: [Status.IN_PROGRESS, Status.PENDING_STUDENT, Status.RESOLVED],
};

export function canTransition(from: Status, to: Status) {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isStaffRole(role: Role) {
  return role === Role.AGENT || role === Role.MANAGER || role === Role.ADMIN;
}

export function canManageTicket(params: {
  role: Role;
  userId: string;
  assigneeId: string | null;
  department: string;
  userDepartment: string | null;
}) {
  if (params.role === Role.MANAGER || params.role === Role.ADMIN) return true;
  if (params.role === Role.AGENT) {
    // An agent can act on tickets already assigned to them, or unassigned
    // tickets sitting in their department's queue.
    if (params.assigneeId === params.userId) return true;
    if (!params.assigneeId && params.userDepartment === params.department) return true;
    return false;
  }
  return false;
}
