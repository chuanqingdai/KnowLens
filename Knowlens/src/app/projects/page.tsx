"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FolderOpen, Home as HomeIcon, Menu, UserCircle2 } from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";
import { getProjectsByUser } from "@/lib/admin";

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
    cover: "/en-picture/plate-tectonics-earthquake-infographic-case.jpg",
    format: "PPT",
  },
  {
    id: "proj-2",
    title: "Tide Mechanism Visual Poster",
    updatedAt: "Yesterday 21:08",
    status: "Completed",
    cover: "/en-picture/photosynthesis-infographic-case.jpg",
    format: "Poster",
  },
  {
    id: "proj-3",
    title: "Black Hole Formation Short Video",
    updatedAt: "May 18",
    status: "Completed",
    cover: "/en-picture/featured-visual-case-03.jpg",
    format: "Video",
    duration: "01:35",
  },
  {
    id: "proj-4",
    title: "Immune Mechanism Classroom Deck",
    updatedAt: "May 16",
    status: "Completed",
    cover: "/en-picture/featured-visual-case-01.jpg",
    format: "PPT",
  },
];

export default function ProjectsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const visibleProjects = currentEmail
    ? getProjectsByUser(currentEmail)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((project) => ({
          id: project.id,
          title: project.title,
          updatedAt: project.updatedAt,
          status: project.status === "已完成" ? "Completed" : "In Progress",
          cover: project.cover || "",
          format: project.format === "视频" ? "Video" : project.format === "PPT" ? "PPT" : "Poster",
          duration: project.duration,
        }))
    : projectItems;

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav
        items={navItems}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <main className="px-3 pb-10 pt-4 sm:px-6 sm:pt-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100"
              aria-label="Open navigation"
              title="Open navigation"
            >
              <Menu size={15} />
            </button>
          </div>
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">KnowLens.ai</p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Projects</h1>
            </div>
          </header>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Recent Projects</h2>
              <button
                type="button"
                className="text-sm text-zinc-500 transition hover:text-zinc-800"
              >
                View all
              </button>
            </div>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {visibleProjects.map((item) => (
                <article
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/workspace?projectId=${encodeURIComponent(item.id)}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/workspace?projectId=${encodeURIComponent(item.id)}`);
                    }
                  }}
                  className="cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-zinc-100">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-50 text-xs text-zinc-400">
                        No cover yet
                      </div>
                    )}
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
