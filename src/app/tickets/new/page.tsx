import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createTicketAction } from "@/app/tickets/actions";
import { DEPARTMENT_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import { Department, Priority, Role } from "@prisma/client";

export default async function NewTicketPage() {
  const session = await requireSession();
  if (session.role !== Role.STUDENT) redirect("/tickets");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Raise a Support Ticket</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Describe your issue and pick the closest category — your ticket is routed to the right team automatically.
      </p>

      <form
        action={createTicketAction}
        className="mt-6 space-y-5 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
          <select name="category" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select a category
            </option>
            {Object.values(Department).map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABEL[d]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
          <select name="priority" defaultValue={Priority.MEDIUM} className={inputClass}>
            {Object.values(Priority).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Choose Urgent only for exam-blocking or time-critical issues — misuse delays genuinely urgent requests.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
          <input
            type="text"
            name="subject"
            required
            maxLength={140}
            placeholder="Short summary of your issue"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            name="description"
            required
            rows={6}
            placeholder="Explain the issue in detail — include dates, reference numbers, and what resolution you need."
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          Submit Ticket
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500";
