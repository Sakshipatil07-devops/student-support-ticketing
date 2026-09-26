import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildTicketWhere } from "@/lib/ticket-queries";

/**
 * Read-only JSON API for the ticket list — the same query the /tickets page
 * renders, exposed for external consumers (e.g. a BI tool or a status-page
 * integration). Mutations go through Server Actions instead; see
 * ASSUMPTIONS.md for the reasoning.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const filters = {
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    scope: searchParams.get("scope") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  };

  const where = buildTicketWhere(session, filters);
  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      requester: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 200,
  });

  return NextResponse.json({ count: tickets.length, tickets });
}
