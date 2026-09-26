import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runEscalationSweep } from "@/lib/sla";
import { Role } from "@prisma/client";

/**
 * Escalation / SLA sweep endpoint.
 *
 * In production this would be invoked on a schedule by an external job
 * runner (cron, queue worker) authenticated with a service credential —
 * see ASSUMPTIONS.md. For this prototype it is also wired to a manual
 * "Run SLA check now" button on the manager dashboard, authenticated by
 * the normal session cookie.
 */
export async function POST() {
  const session = await getSession();
  if (!session || (session.role !== Role.MANAGER && session.role !== Role.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runEscalationSweep();
  return NextResponse.json(result);
}
