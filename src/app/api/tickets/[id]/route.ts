import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isStaffRole } from "@/lib/workflow";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      comments: { where: isStaffRole(session.role) ? {} : { isInternal: false }, orderBy: { createdAt: "asc" } },
      activities: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isStaffRole(session.role) && ticket.requesterId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ticket });
}
