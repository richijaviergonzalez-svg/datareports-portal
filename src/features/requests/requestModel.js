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
};

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
    ].some((value) => String(value || "").toLowerCase().includes(search));

    return matchesStatus && matchesType && matchesSearch;
  });
}

export function updateRequestStatusInList(requests = [], requestId, status, now = new Date().toISOString()) {
  const list = Array.isArray(requests) ? requests : [];
  return list.map((request) => (
    request.id === requestId ? { ...request, status, updatedAt: now } : request
  ));
}

export function getRequestStatusColor(status, fallbackColor = "#14B8A6") {
  if (status === "resolved") return "#10B981";
  if (status === "rejected") return "#EF4444";
  if (status === "progress") return "#3B82F6";
  if (status === "analysis") return "#F59E0B";
  return fallbackColor;
}
