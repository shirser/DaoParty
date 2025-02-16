"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const getTabClass = (path: string) =>
    pathname === path
      ? "pb-2 border-b-2 border-blue-600 text-blue-600 font-semibold cursor-pointer"
      : "pb-2 hover:border-b-2 hover:border-gray-300 cursor-pointer";

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <nav className="mb-6 border-b">
        <ul className="flex space-x-6">
          <li>
            <Link href="/dashboard/profile">
              <span className={getTabClass("/dashboard/profile")}>Профиль</span>
            </Link>
          </li>
          <li>
            <Link href="/dashboard/proposals">
              <span className={getTabClass("/dashboard/proposals")}>Предложения</span>
            </Link>
          </li>
          <li>
            <Link href="/dashboard/votings">
              <span className={getTabClass("/dashboard/votings")}>Голосования</span>
            </Link>
          </li>
        </ul>
      </nav>
      {children}
    </div>
  );
}
