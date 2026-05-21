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
};

const ADMIN_USERS_KEY = "scilens_admin_users_v1";
const ADMIN_PROJECTS_KEY = "scilens_admin_projects_v1";

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

export function getAdminUsers() {
  const users = read<AdminUser[]>(ADMIN_USERS_KEY);
  if (users?.length) {
    return users;
  }
  write(ADMIN_USERS_KEY, seedUsers);
  return seedUsers;
}

export function getAdminProjects() {
  const projects = read<AdminProject[]>(ADMIN_PROJECTS_KEY);
  if (projects?.length) {
    return projects;
  }
  write(ADMIN_PROJECTS_KEY, seedProjects);
  return seedProjects;
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
