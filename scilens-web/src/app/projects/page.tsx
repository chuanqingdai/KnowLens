"use client";

import { CirclePlus, FolderOpen, Home as HomeIcon, Plus, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

const navItems = [
  { label: "首页", icon: HomeIcon, href: "/" },
  { label: "我的项目", icon: FolderOpen, href: "/projects" },
  { label: "个人主页", icon: UserCircle2, href: "/profile" },
];

const projectItems = [
  {
    id: "proj-1",
    title: "火山喷发过程科普 PPT",
    updatedAt: "今天 15:24",
    status: "进行中",
    cover: "/picture/39f7e57c-2e46-4e53-8ba6-756b22ef6437.png",
    format: "PPT",
  },
  {
    id: "proj-2",
    title: "潮汐原理可视化长图",
    updatedAt: "昨天 21:08",
    status: "已完成",
    cover: "/picture/176e6527-21ef-4528-a0fc-91c879a00b4c.png",
    format: "海报",
  },
  {
    id: "proj-3",
    title: "黑洞形成机制短视频",
    updatedAt: "5 月 18 日",
    status: "已完成",
    cover: "/picture/eab2accf-e36a-45a2-89bb-0faa73e518e6.png",
    format: "视频",
    duration: "01:35",
  },
  {
    id: "proj-4",
    title: "免疫机制课堂演示",
    updatedAt: "5 月 16 日",
    status: "已完成",
    cover: "/picture/e32aee6b-1845-409c-b91a-d7667e2f4381.png",
    format: "PPT",
  },
];

export default function ProjectsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav items={navItems} />
      <main className="px-4 pb-10 pt-6 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-6xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">KnowLens.ai</p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">我的项目</h1>
            </div>
            <button
              type="button"
              onClick={() => router.push("/workspace")}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 text-sm font-medium text-white hover:bg-zinc-700"
            >
              <Plus size={14} />
              新建项目
            </button>
          </header>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">最近项目</h2>
              <button
                type="button"
                className="text-sm text-zinc-500 transition hover:text-zinc-800"
              >
                查看全部
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => router.push("/workspace")}
                className="rounded-2xl border border-dashed border-zinc-300 bg-white p-2 text-left transition hover:border-zinc-400 hover:text-zinc-600"
              >
                <div className="aspect-video w-full rounded-xl bg-zinc-100 text-zinc-400">
                  <div className="flex h-full items-center justify-center">
                    <CirclePlus size={30} />
                  </div>
                </div>
                <p className="px-1 pb-1 pt-3 text-lg font-medium leading-none text-zinc-900">
                  New Project
                </p>
              </button>

              {projectItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_10px_25px_rgba(15,23,42,0.04)]"
                >
                  <div
                    className="relative aspect-video w-full rounded-xl bg-zinc-100 bg-cover bg-center"
                    style={{ backgroundImage: `url("${item.cover}")` }}
                  >
                    <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] text-white">
                      {item.format}
                    </span>
                    {item.format === "视频" && item.duration ? (
                      <span className="absolute right-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] text-white">
                        {item.duration}
                      </span>
                    ) : null}
                  </div>
                  <div className="px-1 pb-1 pt-3">
                    <p className="text-lg font-medium leading-none text-zinc-900">{item.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-sm text-zinc-500">{item.updatedAt}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          item.status === "进行中"
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
