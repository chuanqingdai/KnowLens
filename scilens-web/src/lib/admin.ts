import type { AuthUser } from "./auth";
import { appendCreditRecord } from "./billing";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  plan: "free" | "starter" | "pro" | "studio";
  credits: number;
};

export type AdminProject = {
  id: string;
  userId: string;
  title: string;
  status: "进行中" | "已完成";
  updatedAt: string;
  format?: "海报" | "PPT" | "视频";
  duration?: string;
};

export type FeaturedCaseConfig = {
  id: string;
  projectId: string;
  category: string;
  order: number;
  updatedAt: string;
};

export type HomeFeaturedCase = {
  id: string;
  projectId: string;
  title: string;
  author: string;
  views: number;
  likes: number;
  cover: string;
  coverWidth: number;
  coverHeight: number;
  format: "海报" | "PPT" | "视频";
  duration?: string;
  category: string;
  order: number;
};

const ADMIN_USERS_KEY = "scilens_admin_users_v1";
const ADMIN_PROJECTS_KEY = "scilens_admin_projects_v1";
const FEATURED_CASES_KEY = "scilens_featured_cases_v1";

const seedUsers: AdminUser[] = [
  {
    id: "u-admin",
    name: "chuanqingdai",
    email: "chuanqingdai@gmail.com",
    role: "admin",
    plan: "pro",
    credits: 320,
  },
  {
    id: "u-001",
    name: "lin",
    email: "lin@example.com",
    role: "user",
    plan: "starter",
    credits: 120,
  },
  {
    id: "u-002",
    name: "zhou",
    email: "zhou@example.com",
    role: "user",
    plan: "free",
    credits: 20,
  },
];

const seedProjects: AdminProject[] = [
  {
    id: "p-001",
    userId: "u-001",
    title: "火山喷发过程科普 PPT",
    status: "进行中",
    updatedAt: "2026-05-21 16:20",
  },
  {
    id: "p-002",
    userId: "u-001",
    title: "潮汐原理可视化长图",
    status: "已完成",
    updatedAt: "2026-05-20 22:10",
  },
  {
    id: "p-003",
    userId: "u-002",
    title: "DNA 复制流程演示",
    status: "进行中",
    updatedAt: "2026-05-20 09:43",
  },
];

const seedAdminProjects: AdminProject[] = [
  {
    id: "p-admin-001",
    userId: "u-admin",
    title: "行星运动与万有引力可视化课程",
    status: "进行中",
    updatedAt: "2026-05-21 19:12",
  },
  {
    id: "p-admin-002",
    userId: "u-admin",
    title: "细胞分裂全过程课堂 PPT",
    status: "已完成",
    updatedAt: "2026-05-21 17:48",
    format: "PPT",
  },
  {
    id: "p-admin-003",
    userId: "u-admin",
    title: "货币通胀机制图解短视频",
    status: "进行中",
    updatedAt: "2026-05-20 23:06",
    format: "视频",
    duration: "01:16",
  },
  {
    id: "p-admin-004",
    userId: "u-admin",
    title: "地震波传播与板块运动长图",
    status: "已完成",
    updatedAt: "2026-05-19 21:35",
    format: "海报",
  },
];

const seedFeaturedCaseConfigs: FeaturedCaseConfig[] = [
  {
    id: "fc-001",
    projectId: "p-admin-001",
    category: "天文",
    order: 10,
    updatedAt: "2026-05-21T19:15:00.000Z",
  },
  {
    id: "fc-002",
    projectId: "p-admin-002",
    category: "生物",
    order: 20,
    updatedAt: "2026-05-21T18:00:00.000Z",
  },
  {
    id: "fc-003",
    projectId: "p-admin-003",
    category: "经济",
    order: 30,
    updatedAt: "2026-05-21T17:30:00.000Z",
  },
  {
    id: "fc-004",
    projectId: "p-admin-004",
    category: "地理",
    order: 40,
    updatedAt: "2026-05-21T17:00:00.000Z",
  },
];

const featuredCoverPool = [
  { src: "/picture/176e6527-21ef-4528-a0fc-91c879a00b4c.png", width: 1672, height: 941 },
  { src: "/picture/39f7e57c-2e46-4e53-8ba6-756b22ef6437.png", width: 1672, height: 941 },
  { src: "/picture/0207e54b-cd89-4f61-99b2-3d5041609e73.png", width: 1672, height: 941 },
  { src: "/picture/eab2accf-e36a-45a2-89bb-0faa73e518e6.png", width: 1672, height: 941 },
  { src: "/picture/fb1ec712-8275-4b22-989b-756e17684fbe.png", width: 1672, height: 941 },
  { src: "/picture/c24ee34d-8ee2-498a-b95d-c17d30640f2a.png", width: 941, height: 1672 },
  { src: "/picture/3f6e9b7d-0d47-4dae-8b43-9be1bd35c232.png", width: 1672, height: 941 },
  { src: "/picture/8755ea1a-c5cc-4644-a505-553ec5905d71.png", width: 941, height: 1672 },
  { src: "/picture/feb2b176-157f-44f9-ac52-5a271e25ed6e.png", width: 941, height: 1672 },
  { src: "/picture/f49e94e8-81c8-4982-830c-a5f87128eae5.png", width: 1122, height: 1402 },
];

const featuredProjectOverrides: Record<
  string,
  {
    title: string;
    cover: string;
    coverWidth: number;
    coverHeight: number;
    format?: "海报" | "PPT" | "视频";
  }
> = {
  "p-admin-003": {
    title: "How the Business Cycle Works",
    cover: "/case/business-cycle-works.png",
    coverWidth: 1122,
    coverHeight: 1402,
    format: "海报",
  },
};

function read<T>(key: string) {
  if (typeof window === "undefined") {
    return null as T | null;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null as T | null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null as T | null;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function inferFormat(project: AdminProject): "海报" | "PPT" | "视频" {
  if (project.format) {
    return project.format;
  }
  const title = project.title.toLowerCase();
  if (title.includes("视频")) {
    return "视频";
  }
  if (title.includes("ppt")) {
    return "PPT";
  }
  return "海报";
}

function inferDuration(project: AdminProject) {
  if (project.duration) {
    return project.duration;
  }
  const hash = hashText(project.id + project.title);
  const sec = 45 + (hash % 75);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function normalizeCategory(category: string) {
  const value = category.trim();
  return value || "综合";
}

function sortFeaturedConfigs(configs: FeaturedCaseConfig[]) {
  return [...configs].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function getAdminUsers() {
  const users = read<AdminUser[]>(ADMIN_USERS_KEY);
  if (users?.length) {
    return users;
  }
  write(ADMIN_USERS_KEY, seedUsers);
  return seedUsers;
}

export function getAdminUserByEmail(email: string) {
  const target = email.trim().toLowerCase();
  if (!target) {
    return null;
  }
  return (
    getAdminUsers().find((user) => user.email.trim().toLowerCase() === target) ?? null
  );
}

export function getAdminProjects() {
  const projects = read<AdminProject[]>(ADMIN_PROJECTS_KEY);
  if (projects?.length) {
    const existingIds = new Set(projects.map((project) => project.id));
    const missingAdminProjects = seedAdminProjects.filter(
      (project) => !existingIds.has(project.id),
    );
    if (!missingAdminProjects.length) {
      return projects;
    }
    const next = [...missingAdminProjects, ...projects];
    write(ADMIN_PROJECTS_KEY, next);
    return next;
  }
  const next = [...seedAdminProjects, ...seedProjects];
  write(ADMIN_PROJECTS_KEY, next);
  return next;
}

export function getFeaturedCaseConfigs() {
  const configs = read<FeaturedCaseConfig[]>(FEATURED_CASES_KEY);
  if (!configs?.length) {
    write(FEATURED_CASES_KEY, seedFeaturedCaseConfigs);
    return sortFeaturedConfigs(seedFeaturedCaseConfigs);
  }

  const existingProjectIds = new Set(configs.map((item) => item.projectId));
  const missingSeedConfigs = seedFeaturedCaseConfigs.filter(
    (seed) => !existingProjectIds.has(seed.projectId),
  );

  if (!missingSeedConfigs.length) {
    return sortFeaturedConfigs(configs);
  }

  const merged = sortFeaturedConfigs([...configs, ...missingSeedConfigs]);
  write(FEATURED_CASES_KEY, merged);
  return merged;
}

export function upsertFeaturedCaseConfig(input: {
  id?: string;
  projectId: string;
  category: string;
  order: number;
}) {
  const now = new Date().toISOString();
  const current = getFeaturedCaseConfigs();
  const targetId = input.id ?? current.find((item) => item.projectId === input.projectId)?.id;

  const nextConfig: FeaturedCaseConfig = {
    id: targetId ?? `fc-${Date.now()}`,
    projectId: input.projectId.trim(),
    category: normalizeCategory(input.category),
    order: Number.isFinite(input.order) ? input.order : 999,
    updatedAt: now,
  };

  const next = current.some((item) => item.id === nextConfig.id)
    ? current.map((item) => (item.id === nextConfig.id ? nextConfig : item))
    : [nextConfig, ...current];

  const sorted = sortFeaturedConfigs(next);
  write(FEATURED_CASES_KEY, sorted);
  return sorted;
}

export function removeFeaturedCaseConfig(id: string) {
  const current = getFeaturedCaseConfigs();
  const next = current.filter((item) => item.id !== id);
  write(FEATURED_CASES_KEY, next);
  return sortFeaturedConfigs(next);
}

export function getHomeFeaturedCases() {
  const projects = getAdminProjects();
  const users = getAdminUsers();
  const configs = getFeaturedCaseConfigs();
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const userById = new Map(users.map((user) => [user.id, user]));

  return configs
    .map((config) => {
      const project = projectById.get(config.projectId);
      if (!project) {
        return null;
      }
      const owner = userById.get(project.userId);
      const hash = hashText(`${project.id}-${project.title}`);
      const cover = featuredCoverPool[hash % featuredCoverPool.length];
      const override = featuredProjectOverrides[project.id];
      const format = override?.format ?? inferFormat(project);

      return {
        id: `featured-${config.id}`,
        projectId: project.id,
        title: override?.title ?? project.title,
        author: owner?.name || owner?.email.split("@")[0] || "creator",
        views: 1400 + (hash % 4200),
        likes: 80 + (hash % 360),
        cover: override?.cover ?? cover.src,
        coverWidth: override?.coverWidth ?? cover.width,
        coverHeight: override?.coverHeight ?? cover.height,
        format,
        duration: format === "视频" ? inferDuration(project) : undefined,
        category: normalizeCategory(config.category),
        order: config.order,
      } as HomeFeaturedCase;
    })
    .filter((item): item is HomeFeaturedCase => Boolean(item));
}

export function grantMembership(userId: string, plan: AdminUser["plan"], credits: number) {
  const users = getAdminUsers();
  const next = users.map((user) => {
    if (user.id !== userId) {
      return user;
    }
    return {
      ...user,
      plan,
      credits: user.credits + credits,
    };
  });
  write(ADMIN_USERS_KEY, next);
  const target = next.find((user) => user.id === userId);
  if (target) {
    appendCreditRecord({
      type: "topup",
      description: `管理员开通会员：${target.email}（${plan}）`,
      delta: credits,
      userId: target.id,
      userEmail: target.email,
    });
  }
  return next;
}

export function upsertAdminUserFromAuth(authUser: AuthUser) {
  const users = getAdminUsers();
  const existing = users.find((user) => user.email === authUser.email);
  if (existing) {
    const next = users.map((user) =>
      user.email === authUser.email
        ? {
            ...user,
            name: authUser.name || user.name,
            role: authUser.role,
          }
        : user,
    );
    write(ADMIN_USERS_KEY, next);
    return next;
  }

  const next: AdminUser[] = [
    {
      id: `u-${Date.now()}`,
      name: authUser.name || authUser.email.split("@")[0],
      email: authUser.email,
      role: authUser.role,
      plan: "free",
      credits: 20,
    },
    ...users,
  ];
  write(ADMIN_USERS_KEY, next);
  return next;
}
