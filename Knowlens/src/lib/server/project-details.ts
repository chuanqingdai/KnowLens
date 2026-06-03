import {
  buildImageRenderUrl,
  getLatestImageGenerationJobByProject,
  type ImageGenerationTaskRow,
} from "@/lib/server/image-generation-jobs";
import { getProjectByIdForUser, listProjectsByUser } from "@/lib/server/store";
import {
  getWorkspaceProjectCover,
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
};

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
  const project = getProjectByIdForUser(input.userEmail, input.projectId) as ProjectRow | null;
  if (!project?.id) {
    return null;
  }

  const storedFormat = normalizeProjectOutputType(project.format);
  const initialPages = storedFormat
    ? listWorkspaceProjectPages({
        userEmail: input.userEmail,
        projectId: input.projectId,
        outputType: storedFormat,
      })
    : listWorkspaceProjectPages({
        userEmail: input.userEmail,
        projectId: input.projectId,
      });
  const initialJob = storedFormat
    ? await getLatestImageGenerationJobByProject({
        userEmail: input.userEmail,
        projectId: input.projectId,
        intent: storedFormat,
      })
    : null;
  const outputType = inferOutputType({
    project,
    pages: initialPages,
    jobIntent: initialJob?.job.intent,
  });
  const pages =
    storedFormat || !outputType
      ? initialPages
      : listWorkspaceProjectPages({
          userEmail: input.userEmail,
          projectId: input.projectId,
          outputType,
        });
  const latestJob =
    initialJob?.job.intent === outputType
      ? initialJob
      : await getLatestImageGenerationJobByProject({
          userEmail: input.userEmail,
          projectId: input.projectId,
          intent: outputType,
        });
  const tasks = (latestJob?.tasks || []).map(buildTaskResponse);
  const cover =
    getWorkspaceProjectCover({
      userEmail: input.userEmail,
      projectId: input.projectId,
      outputType,
    }) ||
    tasks.find((task) => task.status === "asset_ready" && task.renderUrl)?.renderUrl ||
    "";
  const status = aggregateStatus({
    projectStatus: normalizeText(project.status, "in_progress"),
    pages,
    tasks,
  });

  return {
    project: {
      id: String(project.id),
      title: normalizeText(project.title, "Untitled project"),
      status,
      storedStatus: normalizeText(project.status, ""),
      format: outputType,
      duration: project.duration ? String(project.duration) : undefined,
      createdAt: null,
      updatedAt: normalizeText(project.updated_at || project.updatedAt, new Date().toISOString()),
      cover,
      coverImageUrl: cover,
    },
    cover,
    pages,
    job: latestJob?.job ?? null,
    tasks,
  };
}

export async function listProjectSummaries(userEmail: string) {
  const rows = listProjectsByUser(userEmail) as ProjectRow[];
  return Promise.all(
    rows.map(async (row) => {
      const projectId = normalizeText(row.id);
      if (!projectId) {
        return null;
      }
      const detail = await resolveProjectDetail({ userEmail, projectId });
      if (detail) {
        return detail.project;
      }
      const outputType = normalizeProjectOutputType(row.format);
      return {
        id: projectId,
        title: normalizeText(row.title, "Untitled project"),
        status: normalizeText(row.status, "in_progress"),
        storedStatus: normalizeText(row.status, ""),
        format: outputType || "poster",
        duration: row.duration ? String(row.duration) : undefined,
        createdAt: null,
        updatedAt: normalizeText(row.updated_at || row.updatedAt, new Date().toISOString()),
        cover: "",
        coverImageUrl: "",
      };
    }),
  ).then((items) => items.filter((item): item is NonNullable<typeof item> => Boolean(item)));
}
