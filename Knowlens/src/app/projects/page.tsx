"use client";

import { FolderOpen, Home as HomeIcon, UserCircle2 } from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

const navItems = [
  { label: "Home", icon: HomeIcon, href: "/app" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Profile", icon: UserCircle2, href: "/profile" },
];

const projectItems = [
  {
    id: "proj-1",
    title: "Volcanic Eruption Explainer PPT",
    updatedAt: "Today 15:24",
    status: "In Progress",
    cover: "/picture/39f7e57c-2e46-4e53-8ba6-756b22ef6437.png",
    format: "PPT",
  },
  {
    id: "proj-2",
    title: "Tide Mechanism Visual Poster",
    updatedAt: "Yesterday 21:08",
    status: "Completed",
    cover: "/picture/176e6527-21ef-4528-a0fc-91c879a00b4c.png",
    format: "Poster",
  },
  {
    id: "proj-3",
    title: "Black Hole Formation Short Video",
    updatedAt: "May 18",
    status: "Completed",
    cover: "/picture/eab2accf-e36a-45a2-89bb-0faa73e518e6.png",
    format: "Video",
    duration: "01:35",
  },
  {
    id: "proj-4",
    title: "Immune Mechanism Classroom Deck",
    updatedAt: "May 16",
    status: "Completed",
    cover: "/picture/e32aee6b-1845-409c-b91a-d7667e2f4381.png",
    format: "PPT",
  },
];

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav items={navItems} />
      <main className="px-3 pb-10 pt-4 sm:px-6 sm:pt-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-6xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">KnowLens.ai</p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Projects</h1>
            </div>
          </header>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">最近项目</h2>
              <button
                type="button"
                className="text-sm text-zinc-500 transition hover:text-zinc-800"
              >
                View all
              </button>
            </div>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {projectItems.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)]"
                >
                  <div
                    className="relative aspect-video w-full bg-zinc-100 bg-cover bg-center"
                    style={{ backgroundImage: `url("${item.cover}")` }}
                  >
                    <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] text-white">
                      {item.format}
                    </span>
                    {item.format === "Video" && item.duration ? (
                      <span className="absolute right-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] text-white">
                        {item.duration}
                      </span>
                    ) : null}
                  </div>
                  <div className="px-3 pb-3 pt-2.5">
                    <p className="line-clamp-2 text-base font-medium leading-6 text-zinc-900 sm:text-lg sm:leading-none">{item.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-sm text-zinc-500">{item.updatedAt}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          item.status === "In Progress"
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
