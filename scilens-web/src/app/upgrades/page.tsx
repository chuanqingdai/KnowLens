"use client";

import { FolderOpen, Home as HomeIcon, Sparkles, UserCircle2 } from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

const navItems = [
  { label: "首页", icon: HomeIcon, href: "/" },
  { label: "我的项目", icon: FolderOpen, href: "/projects" },
  { label: "个人主页", icon: UserCircle2, href: "/profile" },
];

const upgradeRoadmap = [
  {
    title: "多项目批量生成",
    eta: "本月",
    desc: "支持一次输入多个主题，批量生成大纲、分镜和封面图。",
  },
  {
    title: "更细粒度的画布协作",
    eta: "下月",
    desc: "支持评论锚点、审阅状态和成员任务分配。",
  },
  {
    title: "PPT 模板市场",
    eta: "规划中",
    desc: "可直接套用课堂模板与品牌模板，加快交付效率。",
  },
];

export default function UpgradesPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav items={navItems} />
      <main className="px-4 pb-10 pt-6 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-4xl">
          <header className="mb-5">
            <p className="text-sm text-zinc-500">Scilens</p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">功能升级</h1>
            <p className="mt-1 text-sm text-zinc-600">
              查看近期能力更新和计划中的重点功能。
            </p>
          </header>

          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            {upgradeRoadmap.map((item) => (
              <article key={item.title} className="rounded-xl border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                    <Sparkles size={14} />
                    {item.title}
                  </p>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {item.eta}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">{item.desc}</p>
              </article>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
