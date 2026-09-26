import { prisma } from "@/lib/prisma";
import { ActivityAction } from "@prisma/client";

export async function logActivity(params: {
  ticketId: string;
  actorId: string | null;
  action: ActivityAction;
  fromValue?: string | null;
  toValue?: string | null;
  note?: string | null;
}) {
  return prisma.activityLog.create({
    data: {
      ticketId: params.ticketId,
      actorId: params.actorId,
      action: params.action,
      fromValue: params.fromValue ?? null,
      toValue: params.toValue ?? null,
      note: params.note ?? null,
    },
  });
}
