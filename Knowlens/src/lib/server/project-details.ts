import {
  buildImageRenderUrl,
  expireAbandonedImageGenerationJob,
  getLatestImageGenerationJobByProject,
  listImageGenerationProjectActivityByUser,
  listImageGenerationTaskHistoryByProject,
  type ImageGenerationTaskRow,
} from "@/lib/server/image-generation-jobs";
import { getProjectByIdForUser, listProjectsByUser } from "@/lib/server/store";
import {
  getWorkspaceProjectCover,
  listWorkspaceProjectActivityByUser,
  listWorkspaceProjectPages,
  type WorkspaceProjectPageOutputType,
  type WorkspaceProjectPageRow,
} from "@/lib/server/workspace-project-pages";

type ProjectRow = {
  id?: string;
  title?: string;
  status?: string;
  format?: string | null;
  duration?: string | null;
  updated_at?: string;
  updatedAt?: string;
};

type ProjectTaskResponse = {
  taskId: string;
  index: number;
  status: string;
  attempts: number;
  rawImageUrl: string | null;
  imageUrl: string;
  renderUrl: string;
  storageKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectPageWithImageHistory = WorkspaceProjectPageRow & {
  imageHistory: ProjectTaskResponse[];
};

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function latestIso(values: Array<string | null | undefined>) {
  let winner = "";
  let winnerTs = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) {
      continue;
    }
    const ts = Date.parse(normalized);
    if (Number.isNaN(ts)) {
      continue;
    }
    if (ts > winnerTs) {
      winner = normalized;
      winnerTs = ts;
    }
  }
  return winner || new Date().toISOString();
}

export function normalizeProjectOutputType(value: unknown): WorkspaceProjectPageOutputType | "" {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "poster" || normalized === "海报") {
    return "poster";
  }
  if (normalized === "ppt" || normalized === "presentation" || normalized === "slides") {
    return "ppt";
  }
  if (normalized === "video" || normalized === "视频") {
    return "video";
  }
  return "";
}

function resolveTaskStorageKey(task: { assetPath?: string | null }) {
  const raw = (task.assetPath || "").trim();
  if (!raw) {
    return null;
  }
  const marker = "workspace-images/";
  const markerIndex = raw.indexOf(marker);
  return markerIndex >= 0 ? raw.slice(markerIndex) : raw;
}

function buildTaskResponse(task: ImageGenerationTaskRow): ProjectTaskResponse {
  const renderUrl = task.renderUrl || buildImageRenderUrl(task.id, task.updatedAt);
  return {
    taskId: task.id,
    index: task.taskIndex,
    status: task.status,
    attempts: task.attempts,
    rawImageUrl: task.rawImageUrl,
    imageUrl: renderUrl,
    renderUrl,
    storageKey: resolveTaskStorageKey(task),
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    width: task.width,
    height: task.height,
    mimeType: task.mimeType,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function inferOutputType(input: {
  project: ProjectRow;
  pages: WorkspaceProjectPageRow[];
  jobIntent?: string | null;
}): WorkspaceProjectPageOutputType {
  return (
    normalizeProjectOutputType(input.project.format) ||
    normalizeProjectOutputType(input.jobIntent) ||
    normalizeProjectOutputType(input.pages.find((page) => page.outputType)?.outputType) ||
    "poster"
  );
}

function aggregateStatus(input: {
  projectStatus: string;
  pages: WorkspaceProjectPageRow[];
  tasks: ProjectTaskResponse[];
}) {
  const statuses = [
    ...input.pages.map((page) => (page.status || "").trim().toLowerCase()),
    ...input.tasks.map((task) => task.status.trim().toLowerCase()),
  ].filter(Boolean);
  if (statuses.some((status) => ["queued", "running", "generating", "asset_downloading", "retrying"].includes(status))) {
    return "generating";
  }
  if (statuses.some((status) => status === "failed")) {
    return "partial_failed";
  }
  if (input.pages.length && input.pages.every((page) => (page.imageUrl || "").trim())) {
    return "ready";
  }
  if (input.tasks.length && input.tasks.every((task) => task.status === "asset_ready" && task.renderUrl)) {
    return "ready";
  }
  if (input.pages.length) {
    return "draft";
  }
  return input.projectStatus || "in_progress";
}

export async function resolveProjectDetail(input: {
  userEmail: string;
  projectId: string;
}) {
  const project = (await getProjectByIdForUser(input.userEmail, input.projectId)) as ProjectRow | null;
  const projectId = normalizeText(project?.id || input.projectId);
  if (!projectId) {
    return null;
  }

  const storedFormat = normalizeProjectOutputType(project?.format);
  const initialPages = storedFormat
    ? await listWorkspaceProjectPages({
        userEmail: input.userEmail,
        projectId,
        outputType: storedFormat,
      })
    : await listWorkspaceProjectPages({
        userEmail: input.userEmail,
        projectId,
      });
  const initialJob = storedFormat
    ? await getLatestImageGenerationJobByProject({
        userEmail: input.userEmail,
        projectId,
        intent: storedFormat,
      })
    : null;
  if (!project?.id && initialPages.length === 0 && !initialJob?.job) {
    return null;
  }
  const outputType = inferOutputType({
    project: project || {},
    pages: initialPages,
    jobIntent: initialJob?.job.intent,
  });
  const pages =
    storedFormat || !outputType
      ? initialPages
      : await listWorkspaceProjectPages({
          userEmail: input.userEmail,
          projectId,
          outputType,
        });
  const latestJob =
    initialJob?.job.intent === outputType
      ? initialJob
      : await getLatestImageGenerationJobByProject({
          userEmail: input.userEmail,
          projectId,
          intent: outputType,
        });
  const stableLatestJob =
    latestJob?.job?.id
      ? await expireAbandonedImageGenerationJob({
          jobId: latestJob.job.id,
          source: "project_detail_restore",
        })
      : latestJob;
  const tasks = (stableLatestJob?.tasks || []).map(buildTaskResponse);
  const imageHistoryTasks = await listImageGenerationTaskHistoryByProject({
    userEmail: input.userEmail,
    projectId,
    intent: outputType,
    maxPerPage: 12,
  });
  const imageHistoryByPageIndex = new Map<number, ProjectTaskResponse[]>();
  imageHistoryTasks.forEach((task) => {
    if (!task.taskIndex) {
      return;
    }
    const current = imageHistoryByPageIndex.get(task.taskIndex) || [];
    current.push(buildTaskResponse(task));
    imageHistoryByPageIndex.set(task.taskIndex, current);
  });
  const pagesWithImageHistory: ProjectPageWithImageHistory[] = pages.map((page) => ({
    ...page,
    imageHistory: imageHistoryByPageIndex.get(page.pageIndex) || [],
  }));
  const cover =
    (await getWorkspaceProjectCover({
      userEmail: input.userEmail,
      projectId,
      outputType,
    })) ||
    tasks.find((task) => task.status === "asset_ready" && task.renderUrl)?.renderUrl ||
    "";
  const status = aggregateStatus({
    projectStatus: normalizeText(project?.status, "in_progress"),
    pages: pagesWithImageHistory,
    tasks,
  });
  const updatedAt = latestIso([
    project?.updated_at,
    project?.updatedAt,
    stableLatestJob?.job.updatedAt,
    ...pagesWithImageHistory.map((page) => page.updatedAt),
    ...tasks.map((task) => task.updatedAt),
  ]);
  const title =
    normalizeText(project?.title) ||
    normalizeText(pagesWithImageHistory.find((page) => page.title)?.title) ||
    "Untitled project";

  return {
    project: {
      id: projectId,
      title,
      status,
      storedStatus: normalizeText(project?.status, ""),
      format: outputType,
      duration: project?.duration ? String(project.duration) : undefined,
      createdAt: null,
      updatedAt,
      cover,
      coverImageUrl: cover,
    },
    cover,
    pages: pagesWithImageHistory,
    job: stableLatestJob?.job ?? null,
    tasks,
  };
}

export async function listProjectSummaries(userEmail: string) {
  const rows = (await listProjectsByUser(userEmail)) as ProjectRow[];
  const rowById = new Map<string, ProjectRow>();
  const orderedProjectIds: string[] = [];
  const seenProjectIds = new Set<string>();

  const pushProjectId = (projectIdInput: unknown) => {
    const projectId = normalizeText(projectIdInput);
    if (!projectId || seenProjectIds.has(projectId)) {
      return;
    }
    seenProjectIds.add(projectId);
    orderedProjectIds.push(projectId);
  };

  rows.forEach((row) => {
    const projectId = normalizeText(row.id);
    if (!projectId) {
      return;
    }
    rowById.set(projectId, row);
    pushProjectId(projectId);
  });

  const [workspaceActivities, imageActivities] = await Promise.all([
    listWorkspaceProjectActivityByUser(userEmail),
    listImageGenerationProjectActivityByUser(userEmail),
  ]);

  [...workspaceActivities, ...imageActivities]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .forEach((activity) => pushProjectId(activity.projectId));

  return Promise.all(
    orderedProjectIds.map(async (projectId) => {
      const row = rowById.get(projectId) || null;
      const detail = await resolveProjectDetail({ userEmail, projectId });
      if (detail) {
        return detail.project;
      }
      const outputType = normalizeProjectOutputType(row?.format);
      return {
        id: projectId,
        title: normalizeText(row?.title, "Untitled project"),
        status: normalizeText(row?.status, "in_progress"),
        storedStatus: normalizeText(row?.status, ""),
        format: outputType || "poster",
        duration: row?.duration ? String(row.duration) : undefined,
        createdAt: null,
        updatedAt: normalizeText(row?.updated_at || row?.updatedAt, new Date().toISOString()),
        cover: "",
        coverImageUrl: "",
      };
    }),
  ).then((items) => items.filter((item): item is NonNullable<typeof item> => Boolean(item)));
}
