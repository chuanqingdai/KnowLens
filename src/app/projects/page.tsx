"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FolderOpen, Home as HomeIcon, Menu, Sparkles, UserCircle2 } from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

const navItems = [
  { label: "Home", icon: HomeIcon, href: "/app" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Profile", icon: UserCircle2, href: "/profile" },
];

type ProjectCard = {
  id: string;
  title: string;
  updatedAt: string;
  status: "In Progress" | "Completed";
  cover: string;
  format: "Poster" | "PPT" | "Video";
  duration?: string;
};

type ProjectsResponse = {
  ok?: boolean;
  projects?: Array<{
    id?: string;
    title?: string;
    updatedAt?: string;
    status?: string;
    cover?: string;
    format?: string;
    duration?: string;
  }>;
};

function normalizeProjectFormat(format?: string): ProjectCard["format"] {
  if (format === "视频" || format === "Video") {
    return "Video";
  }
  if (format === "PPT") {
    return "PPT";
  }
  return "Poster";
}

function normalizeProjectStatus(status?: string): ProjectCard["status"] {
  return status === "已完成" || status === "Completed" ? "Completed" : "In Progress";
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Recently";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function clearLegacyProjectCache() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("knowlens_user_projects_v1")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access errors.
  }
}

export default function ProjectsPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const visibleProjects = useMemo(() => projects, [projects]);

  useEffect(() => {
    clearLegacyProjectCache();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProjects() {
      if (sessionStatus === "loading") {
        return;
      }
      if (!currentEmail) {
        setProjects([]);
        setIsLoadingProjects(false);
        return;
      }
      setIsLoadingProjects(true);
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        const data = (await response.json()) as ProjectsResponse;
        if (cancelled) {
          return;
        }
        const nextProjects = (data.projects ?? [])
          .filter((project) => project.id)
          .map((project) => ({
            id: String(project.id),
            title: String(project.title || "Untitled project"),
            updatedAt: formatUpdatedAt(String(project.updatedAt || "")),
            status: normalizeProjectStatus(project.status),
            cover: String(project.cover || ""),
            format: normalizeProjectFormat(project.format),
            duration: project.duration,
          }));
        setProjects(nextProjects);
      } catch {
        if (!cancelled) {
          setProjects([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProjects(false);
        }
      }
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [currentEmail, sessionStatus]);

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
            {isLoadingProjects ? (
              <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
                Loading your projects...
              </div>
            ) : visibleProjects.length ? (
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
                      <p className="line-clamp-2 text-base font-medium leading-6 text-zinc-900 sm:text-lg sm:leading-none">
                        {item.title}
                      </p>
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
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-6 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                    <Sparkles size={18} />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900">No projects yet</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Start from the homepage to create your first infographic poster, slide deck, or explainer video.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/app")}
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800"
                  >
                    Create a project
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
