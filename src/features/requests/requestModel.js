import { isAdmin } from "../../lib/auth.js";
import { buildActionSummary } from "../reports/reportModel.js";

export const REQUEST_STATUS_LABELS = {
  new: "Nuevo",
  analysis: "En análisis",
  progress: "En proceso",
  resolved: "Resuelto",
  rejected: "Rechazado",
};

export const REQUEST_PRIORITY_LABELS = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const REQUEST_STATUS_FLOW = ["new", "analysis", "progress", "resolved"];
export const REQUEST_DETAIL_MAX_LENGTH = 2000;
export const REQUEST_ADMIN_NOTE_MAX_LENGTH = 1200;

export const REQUEST_STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "new", label: REQUEST_STATUS_LABELS.new },
  { value: "analysis", label: REQUEST_STATUS_LABELS.analysis },
  { value: "progress", label: REQUEST_STATUS_LABELS.progress },
  { value: "resolved", label: REQUEST_STATUS_LABELS.resolved },
  { value: "rejected", label: REQUEST_STATUS_LABELS.rejected },
];

export const REQUEST_TYPE_OPTIONS = [
  { value: "all", label: "Todos los tipos" },
  { value: "issue", label: "Problemas" },
  { value: "change", label: "Cambios" },
];

export const REQUEST_PRIORITY_OPTIONS = [
  { value: "baja", label: REQUEST_PRIORITY_LABELS.baja },
  { value: "media", label: REQUEST_PRIORITY_LABELS.media },
  { value: "alta", label: REQUEST_PRIORITY_LABELS.alta },
  { value: "critica", label: REQUEST_PRIORITY_LABELS.critica },
];

const SLA_TARGET_HOURS = {
  baja: 72,
  media: 24,
  alta: 8,
  critica: 4,
};

const CLOSED_STATUSES = ["resolved", "rejected"];

export function createBiPortalRequest({
  actionType,
  report,
  details,
  user,
  now = new Date().toISOString(),
  requestId = `REQ-${Date.now()}`,
}) {
  const cleanDetails = String(details || "").trim();
  const type = actionType === "issue" ? "issue" : "change";
  const request = {
    id: requestId,
    type,
    typeLabel: type === "issue" ? "Problema" : "Cambio",
    title: type === "issue" ? "Problema reportado" : "Solicitud de cambio",
    reportId: report?.id,
    reportName: report?.name,
    reportCategory: report?.category,
    details: cleanDetails || "Sin observaciones adicionales.",
    userName: user?.name || "Usuario",
    userEmail: user?.email || "Sin correo",
    status: "new",
    priority: type === "issue" ? "media" : "baja",
    createdAt: now,
    updatedAt: now,
    adminNote: "",
    history: [
      {
        id: `HIS-${Date.now()}`,
        type: "created",
        status: "new",
        priority: type === "issue" ? "media" : "baja",
        label: type === "issue" ? "Problema registrado" : "Solicitud creada",
        actorName: user?.name || "Usuario",
        actorEmail: user?.email || "",
        createdAt: now,
      },
    ],
  };

  return {
    request,
    notification: {
      id: Date.now() + Math.random(),
      type: type === "issue" ? "issue" : "update",
      message: buildActionSummary(type, report, cleanDetails),
      time: now,
      reportId: report?.id,
      requestId,
      read: false,
    },
  };
}

export function getVisibleRequests(requests = [], user = {}) {
  const list = Array.isArray(requests) ? requests : [];
  if (isAdmin(user?.email)) return list;
  return list.filter((request) => request.userEmail === user?.email);
}

export function filterRequests(requests = [], { statusFilter = "all", typeFilter = "all", query = "" } = {}) {
  const list = Array.isArray(requests) ? requests : [];
  const search = String(query || "").toLowerCase();
  return list.filter((request) => {
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesType = typeFilter === "all" || request.type === typeFilter;
    const matchesSearch = !search || [
      request.id,
      request.reportName,
      request.userName,
      request.userEmail,
      request.details,
      request.typeLabel,
      request.priority,
      REQUEST_PRIORITY_LABELS[request.priority],
      REQUEST_STATUS_LABELS[request.status],
    ].some((value) => String(value || "").toLowerCase().includes(search));

    return matchesStatus && matchesType && matchesSearch;
  });
}

export function updateRequestStatusInList(requests = [], requestId, updates, actor = {}, now = new Date().toISOString()) {
  const list = Array.isArray(requests) ? requests : [];
  const changes = typeof updates === "string" ? { status: updates } : (updates || {});

  return list.map((request) => {
    if (request.id !== requestId) return request;

    const next = {
      ...request,
      ...Object.fromEntries(
        Object.entries(changes).filter(([, value]) => value !== undefined)
      ),
      updatedAt: now,
    };

    const changedStatus = changes.status && changes.status !== request.status;
    const changedPriority = changes.priority && changes.priority !== request.priority;
    const changedNote = Object.prototype.hasOwnProperty.call(changes, "adminNote")
      && changes.adminNote !== request.adminNote;

    if (changedStatus || changedPriority || changedNote) {
      next.history = [
        {
          id: `HIS-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type: changedStatus ? "status" : changedPriority ? "priority" : "note",
          status: next.status,
          priority: next.priority,
          label: changedStatus
            ? `Estado cambiado a ${REQUEST_STATUS_LABELS[next.status] || next.status}`
            : changedPriority
              ? `Prioridad cambiada a ${REQUEST_PRIORITY_LABELS[next.priority] || next.priority}`
              : "Nota administrativa actualizada",
          actorName: actor?.name || "Equipo BI",
          actorEmail: actor?.email || "",
          createdAt: now,
        },
        ...(Array.isArray(request.history) ? request.history : []),
      ].slice(0, 40);
    }

    return next;
  });
}

export function getRequestStatusColor(status, fallbackColor = "#14B8A6") {
  if (status === "resolved") return "#10B981";
  if (status === "rejected") return "#EF4444";
  if (status === "progress") return "#3B82F6";
  if (status === "analysis") return "#F59E0B";
  return fallbackColor;
}

export function getRequestSla(request, now = new Date()) {
  const priority = request?.priority || "media";
  const targetHours = SLA_TARGET_HOURS[priority] || SLA_TARGET_HOURS.media;
  const createdAt = new Date(request?.createdAt || now);
  const updatedAt = new Date(request?.updatedAt || request?.createdAt || now);
  const closed = CLOSED_STATUSES.includes(request?.status);
  const endAt = closed ? updatedAt : now;
  const elapsedHours = Math.max(0, (endAt.getTime() - createdAt.getTime()) / 36e5);
  const progress = Math.min(100, Math.round((elapsedHours / targetHours) * 100));
  const remainingHours = Math.ceil(targetHours - elapsedHours);

  if (closed) {
    return {
      label: request?.status === "resolved" ? "Cerrada" : "Finalizada",
      detail: `${Math.max(1, Math.ceil(elapsedHours))}h de ciclo`,
      color: request?.status === "resolved" ? "#10B981" : "#EF4444",
      progress: 100,
      isBreached: false,
      targetHours,
    };
  }

  if (elapsedHours > targetHours) {
    return {
      label: "Fuera SLA",
      detail: `${Math.ceil(elapsedHours - targetHours)}h vencida`,
      color: "#EF4444",
      progress: 100,
      isBreached: true,
      targetHours,
    };
  }

  if (remainingHours <= Math.max(2, targetHours * 0.2)) {
    return {
      label: "En riesgo",
      detail: `${remainingHours}h restantes`,
      color: "#F59E0B",
      progress,
      isBreached: false,
      targetHours,
    };
  }

  return {
    label: "En SLA",
    detail: `${remainingHours}h restantes`,
    color: "#10B981",
    progress,
    isBreached: false,
    targetHours,
  };
}

export function getRequestTimeline(request = {}) {
  const history = Array.isArray(request.history) ? request.history : [];
  const fallback = [
    {
      id: `${request.id || "request"}-created`,
      type: "created",
      status: "new",
      label: "Solicitud creada",
      actorName: request.userName || "Usuario",
      actorEmail: request.userEmail || "",
      createdAt: request.createdAt,
    },
  ];

  if (request.updatedAt && request.updatedAt !== request.createdAt) {
    fallback.unshift({
      id: `${request.id || "request"}-updated`,
      type: "status",
      status: request.status,
      label: `Estado actual: ${REQUEST_STATUS_LABELS[request.status] || request.status}`,
      actorName: "Equipo BI",
      actorEmail: "",
      createdAt: request.updatedAt,
    });
  }

  return (history.length ? history : fallback)
    .filter((entry) => entry?.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getRequestStats(requests = []) {
  const list = Array.isArray(requests) ? requests : [];
  return {
    total: list.length,
    new: list.filter((request) => request.status === "new").length,
    inProgress: list.filter((request) => ["analysis", "progress"].includes(request.status)).length,
    breached: list.filter((request) => getRequestSla(request).isBreached).length,
    resolved: list.filter((request) => request.status === "resolved").length,
  };
}
