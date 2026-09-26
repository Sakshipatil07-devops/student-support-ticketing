import { PrismaClient, Department, Priority, Role, Status, ActivityAction } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SLA_POLICY } from "../src/lib/sla";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

function minutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60_000);
}

async function main() {
  console.log("Seeding SLA policy...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const priority of Object.values(Priority)) {
    const policy = DEFAULT_SLA_POLICY[priority];
    await prisma.slaPolicy.upsert({
      where: { priority },
      update: policy,
      create: { priority, ...policy },
    });
  }

  console.log("Seeding users...");
  const [riya, arjun, meera, kabir, zara, manager, admin] = await Promise.all([
    prisma.user.upsert({
      where: { email: "riya.student@college.edu" },
      update: {},
      create: {
        name: "Riya Sharma",
        email: "riya.student@college.edu",
        passwordHash,
        role: Role.STUDENT,
        studentCode: "STU-2023-0142",
      },
    }),
    prisma.user.upsert({
      where: { email: "arjun.student@college.edu" },
      update: {},
      create: {
        name: "Arjun Verma",
        email: "arjun.student@college.edu",
        passwordHash,
        role: Role.STUDENT,
        studentCode: "STU-2022-0087",
      },
    }),
    prisma.user.upsert({
      where: { email: "meera.agent@college.edu" },
      update: {},
      create: {
        name: "Meera Nair",
        email: "meera.agent@college.edu",
        passwordHash,
        role: Role.AGENT,
        department: Department.FEES,
      },
    }),
    prisma.user.upsert({
      where: { email: "kabir.agent@college.edu" },
      update: {},
      create: {
        name: "Kabir Singh",
        email: "kabir.agent@college.edu",
        passwordHash,
        role: Role.AGENT,
        department: Department.ID_CARDS,
      },
    }),
    prisma.user.upsert({
      where: { email: "zara.agent@college.edu" },
      update: {},
      create: {
        name: "Zara Khan",
        email: "zara.agent@college.edu",
        passwordHash,
        role: Role.AGENT,
        department: Department.ATTENDANCE,
      },
    }),
    prisma.user.upsert({
      where: { email: "manager@college.edu" },
      update: {},
      create: {
        name: "Sunita Rao",
        email: "manager@college.edu",
        passwordHash,
        role: Role.MANAGER,
        department: Department.GENERAL,
      },
    }),
    prisma.user.upsert({
      where: { email: "admin@college.edu" },
      update: {},
      create: {
        name: "System Administrator",
        email: "admin@college.edu",
        passwordHash,
        role: Role.ADMIN,
      },
    }),
  ]);

  const existingTickets = await prisma.ticket.count();
  if (existingTickets > 0) {
    console.log(`Tickets already seeded (${existingTickets} found) — skipping sample tickets.`);
    return;
  }

  console.log("Seeding sample tickets...");

  type SeedTicket = {
    n: number;
    subject: string;
    description: string;
    category: Department;
    priority: Priority;
    requester: typeof riya;
    assignee: typeof meera | null;
    status: Status;
    createdMinsAgo: number;
    resolutionMins: number; // used to compute dueAt relative to createdAt
    respondedMinsAfterCreate?: number;
    resolvedMinsAgo?: number;
    closedMinsAgo?: number;
    pending?: boolean;
    escalationLevel?: number;
    slaBreached?: boolean;
  };

  const seedTickets: SeedTicket[] = [
    {
      n: 1,
      subject: "Semester fee receipt not generated",
      description:
        "I paid the semester fee via the portal but no receipt was generated. My bank statement shows the debit. Please issue a receipt so I can submit it for my scholarship reimbursement.",
      category: Department.FEES,
      priority: Priority.HIGH,
      requester: riya,
      assignee: meera,
      status: Status.IN_PROGRESS,
      createdMinsAgo: 60 * 20,
      resolutionMins: DEFAULT_SLA_POLICY.HIGH.resolutionMins,
      respondedMinsAfterCreate: 45,
    },
    {
      n: 2,
      subject: "Lost ID card — need duplicate before exams",
      description: "My ID card was lost during travel. Exams start in a few days and I need a duplicate card to be allowed into the exam hall.",
      category: Department.ID_CARDS,
      priority: Priority.URGENT,
      requester: arjun,
      assignee: kabir,
      status: Status.ESCALATED,
      createdMinsAgo: 60 * 10,
      resolutionMins: DEFAULT_SLA_POLICY.URGENT.resolutionMins,
      respondedMinsAfterCreate: 20,
      escalationLevel: 1,
      slaBreached: true,
    },
    {
      n: 3,
      subject: "Attendance shows absent despite attending lab session",
      description: "For the Physics lab on Monday, the system marked me absent. I have signed the manual attendance sheet with the lab instructor as proof.",
      category: Department.ATTENDANCE,
      priority: Priority.MEDIUM,
      requester: riya,
      assignee: zara,
      status: Status.PENDING_STUDENT,
      createdMinsAgo: 60 * 30,
      resolutionMins: DEFAULT_SLA_POLICY.MEDIUM.resolutionMins,
      respondedMinsAfterCreate: 90,
      pending: true,
    },
    {
      n: 4,
      subject: "Bonafide certificate required for passport application",
      description: "I need a bonafide certificate confirming my enrollment for a passport application at the regional passport office.",
      category: Department.CERTIFICATES,
      priority: Priority.MEDIUM,
      requester: arjun,
      assignee: zara,
      status: Status.RESOLVED,
      createdMinsAgo: 60 * 96,
      resolutionMins: DEFAULT_SLA_POLICY.MEDIUM.resolutionMins,
      respondedMinsAfterCreate: 60,
      resolvedMinsAgo: 60 * 10,
    },
    {
      n: 5,
      subject: "Transcript request for higher-studies application",
      description: "Please issue an official transcript of all semesters completed so far — required for a university application abroad.",
      category: Department.DOCUMENTS,
      priority: Priority.LOW,
      requester: riya,
      assignee: null,
      status: Status.OPEN,
      createdMinsAgo: 60 * 2,
      resolutionMins: DEFAULT_SLA_POLICY.LOW.resolutionMins,
    },
    {
      n: 6,
      subject: "Duplicate fee deduction for hostel charges",
      description: "The hostel fee has been deducted twice from my account this semester. Requesting refund of the duplicate charge.",
      category: Department.FEES,
      priority: Priority.HIGH,
      requester: arjun,
      assignee: meera,
      status: Status.CLOSED,
      createdMinsAgo: 60 * 200,
      resolutionMins: DEFAULT_SLA_POLICY.HIGH.resolutionMins,
      respondedMinsAfterCreate: 30,
      resolvedMinsAgo: 60 * 150,
      closedMinsAgo: 60 * 140,
    },
    {
      n: 7,
      subject: "Name spelling error on ID card",
      description: "My name is misspelled on the newly issued ID card ('Kaur' instead of 'Kabir'). Requesting a corrected reprint.",
      category: Department.ID_CARDS,
      priority: Priority.LOW,
      requester: riya,
      assignee: kabir,
      status: Status.IN_PROGRESS,
      createdMinsAgo: 60 * 5,
      resolutionMins: DEFAULT_SLA_POLICY.LOW.resolutionMins,
      respondedMinsAfterCreate: 40,
    },
  ];

  for (const t of seedTickets) {
    const createdAt = minutesAgo(t.createdMinsAgo);
    const policy = DEFAULT_SLA_POLICY[t.priority];
    const responseDueAt = new Date(createdAt.getTime() + policy.firstResponseMins * 60_000);
    let dueAt = new Date(createdAt.getTime() + policy.resolutionMins * 60_000);
    const respondedAt = t.respondedMinsAfterCreate
      ? new Date(createdAt.getTime() + t.respondedMinsAfterCreate * 60_000)
      : null;
    const resolvedAt = t.resolvedMinsAgo ? minutesAgo(t.resolvedMinsAgo) : null;
    const closedAt = t.closedMinsAgo ? minutesAgo(t.closedMinsAgo) : null;
    const pendingSince = t.pending ? minutesAgo(20) : null;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TCK-${String(t.n).padStart(5, "0")}`,
        subject: t.subject,
        description: t.description,
        category: t.category,
        priority: t.priority,
        status: t.status,
        requesterId: t.requester.id,
        assigneeId: t.assignee?.id ?? null,
        createdAt,
        responseDueAt,
        respondedAt,
        dueAt,
        resolvedAt,
        closedAt,
        pendingSince,
        escalationLevel: t.escalationLevel ?? 0,
        escalatedAt: t.escalationLevel ? minutesAgo(Math.floor(t.createdMinsAgo / 2)) : null,
        slaBreached: t.slaBreached ?? false,
      },
    });

    await prisma.activityLog.create({
      data: {
        ticketId: ticket.id,
        actorId: t.requester.id,
        action: ActivityAction.CREATED,
        note: `Ticket raised in ${t.category} queue, priority ${t.priority}.`,
        createdAt,
      },
    });

    if (t.assignee) {
      await prisma.activityLog.create({
        data: {
          ticketId: ticket.id,
          actorId: null,
          action: ActivityAction.ASSIGNED,
          toValue: t.assignee.name,
          note: "Auto-assigned to least-loaded agent in department.",
          createdAt,
        },
      });
    }

    if (respondedAt && t.assignee) {
      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: t.assignee.id,
          body: "Thanks for reaching out — looking into this now and will update you shortly.",
          isInternal: false,
          createdAt: respondedAt,
        },
      });
      await prisma.activityLog.create({
        data: {
          ticketId: ticket.id,
          actorId: t.assignee.id,
          action: ActivityAction.COMMENT_ADDED,
          note: "First response to student.",
          createdAt: respondedAt,
        },
      });
    }

    if (t.pending && t.assignee) {
      await prisma.activityLog.create({
        data: {
          ticketId: ticket.id,
          actorId: t.assignee.id,
          action: ActivityAction.PENDING_SET,
          fromValue: "IN_PROGRESS",
          toValue: "PENDING_STUDENT",
          note: "Awaiting the signed attendance sheet scan from the student.",
          createdAt: minutesAgo(20),
        },
      });
    }

    if (t.escalationLevel && t.assignee) {
      await prisma.activityLog.create({
        data: {
          ticketId: ticket.id,
          actorId: null,
          action: ActivityAction.ESCALATED,
          toValue: "ESCALATED",
          note: "Auto-escalated: resolution SLA breached (level 1 — manager visibility).",
          createdAt: minutesAgo(Math.floor(t.createdMinsAgo / 2)),
        },
      });
    }

    if (resolvedAt && t.assignee) {
      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: t.assignee.id,
          body: "This has been resolved on our end — please check and let us know if anything else is needed.",
          isInternal: false,
          createdAt: resolvedAt,
        },
      });
      await prisma.activityLog.create({
        data: {
          ticketId: ticket.id,
          actorId: t.assignee.id,
          action: ActivityAction.RESOLVED,
          fromValue: "IN_PROGRESS",
          toValue: "RESOLVED",
          createdAt: resolvedAt,
        },
      });
    }

    if (closedAt && t.assignee) {
      await prisma.activityLog.create({
        data: {
          ticketId: ticket.id,
          actorId: t.assignee.id,
          action: ActivityAction.CLOSED,
          fromValue: "RESOLVED",
          toValue: "CLOSED",
          note: "Auto-closed after no further response from student.",
          createdAt: closedAt,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
