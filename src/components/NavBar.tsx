import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { ROLE_LABEL } from "@/lib/labels";
import type { SessionUser } from "@/lib/auth";

function linksForRole(role: SessionUser["role"]) {
  if (role === "STUDENT") {
    return [
      { href: "/tickets", label: "My Tickets" },
      { href: "/tickets/new", label: "Raise a Ticket" },
    ];
  }
  if (role === "AGENT") {
    return [{ href: "/tickets", label: "Ticket Queue" }];
  }
  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/tickets", label: "All Tickets" },
  ];
}

export function NavBar({ user }: { user: SessionUser }) {
  const links = linksForRole(user.role);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
              CS
            </span>
            <span>Campus Support Desk</span>
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">
              {ROLE_LABEL[user.role]}
              {user.department ? ` · ${user.department.replaceAll("_", " ")}` : ""}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
      <nav className="flex items-center gap-4 border-t border-gray-100 px-4 py-2 sm:hidden">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm font-medium text-gray-600">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
