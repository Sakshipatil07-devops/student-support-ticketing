// Plain string-keyed label/color maps — kept free of the @prisma/client import
// so this module is safe to use from client components.

export const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  PENDING_STUDENT: "Pending on Student",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

export const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/30",
  IN_PROGRESS:
    "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/30",
  PENDING_STUDENT:
    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
  ESCALATED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/30",
  RESOLVED:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  CLOSED: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/20 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-600/30",
  REOPENED:
    "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/30",
};

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/20 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-600/30",
  MEDIUM: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30",
  HIGH: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/30",
  URGENT: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/30",
};

export const DEPARTMENT_LABEL: Record<string, string> = {
  FEES: "Fees",
  ATTENDANCE: "Attendance",
  ID_CARDS: "ID Cards",
  DOCUMENTS: "Documents",
  CERTIFICATES: "Certificates",
  GENERAL: "General Administration",
};

export const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student",
  AGENT: "Support Agent",
  MANAGER: "Manager",
  ADMIN: "Teacher (full access)",
};

export const ACTIVITY_LABEL: Record<string, string> = {
  CREATED: "Ticket created",
  ASSIGNED: "Assigned",
  REASSIGNED: "Reassigned",
  STATUS_CHANGED: "Status changed",
  PRIORITY_CHANGED: "Priority changed",
  COMMENT_ADDED: "Comment added",
  INTERNAL_NOTE_ADDED: "Internal note added",
  ESCALATED: "Escalated",
  SLA_BREACHED: "SLA breached",
  PENDING_SET: "Marked pending on student",
  PENDING_CLEARED: "Pending cleared",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};
