import { Department, Priority, Prisma, Role, Status } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";

export type TicketFilters = {
  status?: string;
  priority?: string;
  category?: string;
  scope?: string; // mine | queue | department | all
  q?: string;
};

const OPEN_STATUSES: Status[] = [Status.OPEN, Status.IN_PROGRESS, Status.PENDING_STUDENT, Status.ESCALATED, Status.REOPENED];

export function buildTicketWhere(session: SessionUser, filters: TicketFilters): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = {};

  if (session.role === Role.STUDENT) {
    where.requesterId = session.id;
  } else if (session.role === Role.AGENT) {
    const scope = filters.scope ?? "mine";
    if (scope === "mine") {
      where.assigneeId = session.id;
    } else if (scope === "queue") {
      where.assigneeId = null;
      where.category = session.department ?? undefined;
    } else {
      // "department" or "all" for an agent still limited to their own department
      where.category = session.department ?? undefined;
    }
  }
  // MANAGER / ADMIN: no default scoping — see everything, filters below narrow it.

  if (filters.status && Object.values(Status).includes(filters.status as Status)) {
    where.status = filters.status as Status;
  } else if (filters.status === "OPEN_ANY") {
    where.status = { in: OPEN_STATUSES };
  }

  if (filters.priority && Object.values(Priority).includes(filters.priority as Priority)) {
    where.priority = filters.priority as Priority;
  }

  if (filters.category && Object.values(Department).includes(filters.category as Department)) {
    where.category = filters.category as Department;
  }

  if (filters.q) {
    where.OR = [
      { subject: { contains: filters.q } },
      { ticketNumber: { contains: filters.q } },
      { description: { contains: filters.q } },
    ];
  }

  return where;
}
