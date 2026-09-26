import { LoginForm } from "./LoginForm";

const DEMO_ACCOUNTS = [
  { role: "Teacher — full access, resolves everything", email: "teacher@college.edu" },
  { role: "Student — raise & view only", email: "riya.student@college.edu" },
  { role: "Student — raise & view only", email: "arjun.student@college.edu" },
  { role: "Support Agent — Fees", email: "meera.agent@college.edu" },
  { role: "Support Agent — ID Cards / Documents", email: "kabir.agent@college.edu" },
  { role: "Support Agent — Attendance / Certificates", email: "zara.agent@college.edu" },
  { role: "Manager", email: "manager@college.edu" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-4 py-12 sm:flex-row sm:items-start sm:gap-16">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white dark:bg-indigo-500">
          CS
        </span>
        <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Campus Support Desk</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sign in to raise or manage support tickets.</p>
        <div className="mt-6">
          <LoginForm next={next ?? "/"} />
        </div>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-dashed border-gray-300 bg-white/60 p-6 dark:border-gray-700 dark:bg-gray-900/40">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Demo accounts</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Password for every seeded account:{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800 dark:text-gray-300">password123</code>
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {DEMO_ACCOUNTS.map((acc) => (
            <li key={acc.email} className="flex flex-col rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
              <span className="font-medium text-gray-800 dark:text-gray-200">{acc.role}</span>
              <span className="text-gray-500 dark:text-gray-400">{acc.email}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
