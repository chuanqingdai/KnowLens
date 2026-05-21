"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  FolderOpen,
  Home as HomeIcon,
  MessageSquareText,
  Receipt,
  Shield,
  UserCircle2,
} from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";
import { getStoredAuthUser } from "@/lib/auth";

const navItems = [
  { label: "首页", icon: HomeIcon, href: "/" },
  { label: "我的项目", icon: FolderOpen, href: "/projects" },
  { label: "个人主页", icon: UserCircle2, href: "/profile" },
];

const adminTabs = [
  { label: "Dashboard", href: "/admin", icon: BarChart3 },
  { label: "反馈工单", href: "/admin/tickets", icon: MessageSquareText },
  { label: "订阅列表", href: "/admin/subscriptions", icon: CreditCard },
  { label: "积分流水", href: "/admin/credits", icon: Receipt },
];

type AdminShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AdminShell({ title, description, children }: AdminShellProps) {
  const pathname = usePathname();
  const [auth] = useState(() => getStoredAuthUser());
  const isAdmin = auth?.role === "admin";

  const activeTab = useMemo(() => {
    return adminTabs.find((tab) => pathname === tab.href) ?? adminTabs[0];
  }, [pathname]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
        <SidebarNav items={navItems} />
        <main className="px-4 pb-10 pt-6 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
          <div className="mx-auto max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900">
              <Shield size={15} />
              管理后台
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              当前账号没有管理员权限。请使用
              <span className="mx-1 font-medium text-zinc-900">chuanqingdai@gmail.com</span>
              登录。
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav items={navItems} />
      <main className="px-4 pb-10 pt-6 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-6xl">
          <header className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900">
              <Shield size={15} />
              管理后台 · {activeTab.label}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
            <p className="mt-1 text-sm text-zinc-600">{description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {adminTabs.map((tab) => {
                const Icon = tab.icon;
                const active = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </header>

          <section className="mt-4">{children}</section>
        </div>
      </main>
    </div>
  );
}
