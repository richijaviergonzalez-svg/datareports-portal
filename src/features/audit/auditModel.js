export const AUDIT_EVENT_LIMIT = 250;

export const AUDIT_ACTION_LABELS = {
  report_opened: "Reporte abierto",
  report_link_copied: "Link copiado",
  request_created: "Solicitud creada",
  request_status_changed: "Estado cambiado",
  request_priority_changed: "Prioridad cambiada",
  request_admin_note_saved: "Nota admin guardada",
};

export const AUDIT_ACTION_OPTIONS = [
  { value: "all", label: "Todo" },
  { value: "report", label: "Reportes" },
  { value: "request", label: "Solicitudes" },
  { value: "admin", label: "Acciones admin" },
];

export function createAuditEvent({ action, actor = {}, subject = {}, metadata = {}, now = new Date().toISOString() }) {
  const safeAction = action || "unknown";
  const safeSubject = subject || {};

  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: safeAction,
    actionLabel: AUDIT_ACTION_LABELS[safeAction] || "Evento",
    createdAt: now,
    actorName: actor?.name || actor?.username || "Usuario",
    actorEmail: actor?.email || "",
    subjectId: safeSubject.id || safeSubject.requestId || safeSubject.reportId || "",
    subjectName: safeSubject.name || safeSubject.title || safeSubject.reportName || "",
    subjectType: safeSubject.type || inferSubjectType(safeAction),
    severity: getAuditSeverity(safeAction, metadata),
    metadata: normalizeMetadata(metadata),
  };
}

export function appendAuditEvent(events = [], event) {
  if (!event) return normalizeAuditEvents(events);
  return [normalizeAuditEvent(event), ...normalizeAuditEvents(events)].slice(0, AUDIT_EVENT_LIMIT);
}

export function normalizeAuditEvents(events = []) {
  return Array.isArray(events)
    ? events.map(normalizeAuditEvent).filter(Boolean).slice(0, AUDIT_EVENT_LIMIT)
    : [];
}

export function filterAuditEvents(events = [], { actionFilter = "all", query = "" } = {}) {
  const term = query.trim().toLowerCase();

  return normalizeAuditEvents(events).filter((event) => {
    const matchesAction =
      actionFilter === "all" ||
      (actionFilter === "report" && event.subjectType === "report") ||
      (actionFilter === "request" && event.subjectType === "request") ||
      (actionFilter === "admin" && event.metadata?.adminAction === true);

    const searchable = [
      event.actionLabel,
      event.actorName,
      event.actorEmail,
      event.subjectName,
      event.subjectId,
      event.metadata?.detail,
      event.metadata?.from,
      event.metadata?.to,
    ].filter(Boolean).join(" ").toLowerCase();

    return matchesAction && (!term || searchable.includes(term));
  });
}

export function getAuditStats(events = [], now = new Date()) {
  const safeEvents = normalizeAuditEvents(events);
  const todayKey = now.toISOString().slice(0, 10);
  const todayEvents = safeEvents.filter((event) => event.createdAt?.slice(0, 10) === todayKey);
  const adminEvents = safeEvents.filter((event) => event.metadata?.adminAction);
  const uniqueUsers = new Set(safeEvents.map((event) => event.actorEmail).filter(Boolean));

  return {
    total: safeEvents.length,
    today: todayEvents.length,
    admin: adminEvents.length,
    uniqueUsers: uniqueUsers.size,
  };
}

export function getAuditEventDetail(event) {
  if (!event?.metadata) return "";

  if (event.metadata.from && event.metadata.to) {
    return `${event.metadata.from} -> ${event.metadata.to}`;
  }

  return event.metadata.detail || event.subjectName || "Actividad registrada";
}

function normalizeAuditEvent(event) {
  if (!event || typeof event !== "object") return null;

  return {
    id: event.id || `audit-${Date.now()}`,
    action: event.action || "unknown",
    actionLabel: event.actionLabel || AUDIT_ACTION_LABELS[event.action] || "Evento",
    createdAt: event.createdAt || new Date().toISOString(),
    actorName: event.actorName || "Usuario",
    actorEmail: event.actorEmail || "",
    subjectId: event.subjectId || "",
    subjectName: event.subjectName || "",
    subjectType: event.subjectType || inferSubjectType(event.action),
    severity: event.severity || getAuditSeverity(event.action, event.metadata),
    metadata: normalizeMetadata(event.metadata),
  };
}

function normalizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object") return {};

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 220) : value])
  );
}

function inferSubjectType(action = "") {
  if (action.startsWith("request_")) return "request";
  if (action.startsWith("report_")) return "report";
  return "system";
}

function getAuditSeverity(action = "", metadata = {}) {
  if (metadata?.severity) return metadata.severity;
  if (action === "request_status_changed" || action === "request_priority_changed") return "warning";
  if (action === "request_admin_note_saved") return "info";
  return "normal";
}
