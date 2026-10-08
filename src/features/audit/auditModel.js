export const AUDIT_EVENT_LIMIT = 5000;

export const AUDIT_ACTION_LABELS = {
  platform_access: "Acceso a la plataforma",
  report_opened: "Reporte abierto",
  report_link_copied: "Link copiado",
  request_created: "Solicitud creada",
  request_status_changed: "Estado cambiado",
  request_priority_changed: "Prioridad cambiada",
  request_admin_note_saved: "Nota admin guardada",
};

export const AUDIT_ACTION_OPTIONS = [
  { value: "all", label: "Todo" },
  { value: "access", label: "Accesos" },
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
    ipAddress: "",
    deviceId: metadata.deviceId || "",
    sessionId: metadata.sessionId || "",
    sessionStartedAt: metadata.sessionStartedAt || now,
    userAgent: "",
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

export function filterAuditEvents(events = [], {
  actionFilter = "all",
  query = "",
  range = "30d",
  account = "all",
  reportId = "all",
  now = new Date(),
} = {}) {
  const term = query.trim().toLowerCase();
  const rangeStart = getAuditRangeStart(range, now);

  return normalizeAuditEvents(events).filter((event) => {
    const matchesAction =
      actionFilter === "all" ||
      (actionFilter === "access" && event.action === "platform_access") ||
      (actionFilter === "report" && event.subjectType === "report") ||
      (actionFilter === "request" && event.subjectType === "request") ||
      (actionFilter === "admin" && event.metadata?.adminAction === true);

    const searchable = [
      event.actionLabel,
      event.actorName,
      event.actorEmail,
      event.subjectName,
      event.subjectId,
      event.ipAddress,
      event.deviceId,
      event.sessionId,
      event.metadata?.detail,
      event.metadata?.from,
      event.metadata?.to,
    ].filter(Boolean).join(" ").toLowerCase();

    const eventTime = new Date(event.createdAt).getTime();
    const matchesRange = !rangeStart || (Number.isFinite(eventTime) && eventTime >= rangeStart.getTime());
    const matchesAccount = account === "all" || event.actorEmail === account;
    const matchesReport = reportId === "all" || event.subjectId === reportId;

    return matchesAction && matchesRange && matchesAccount && matchesReport && (!term || searchable.includes(term));
  });
}

export function getAuditStats(events = [], now = new Date()) {
  const safeEvents = normalizeAuditEvents(events);
  const todayKey = now.toISOString().slice(0, 10);
  const todayEvents = safeEvents.filter((event) => event.createdAt?.slice(0, 10) === todayKey);
  const adminEvents = safeEvents.filter((event) => event.metadata?.adminAction);
  const uniqueUsers = new Set(safeEvents.map((event) => event.actorEmail).filter(Boolean));
  const uniqueIps = new Set(safeEvents.map((event) => event.ipAddress).filter((value) => value && value !== "No disponible"));
  const uniqueDevices = new Set(safeEvents.map((event) => event.deviceId).filter(Boolean));

  return {
    total: safeEvents.length,
    today: todayEvents.length,
    admin: adminEvents.length,
    uniqueUsers: uniqueUsers.size,
    uniqueIps: uniqueIps.size,
    uniqueDevices: uniqueDevices.size,
    accesses: safeEvents.filter((event) => event.action === "platform_access").length,
    reportOpens: safeEvents.filter((event) => event.action === "report_opened").length,
  };
}

export function getAuditRangeStart(range, now = new Date()) {
  if (range === "all") return null;
  const days = range === "today" ? 0 : Number.parseInt(range, 10);
  if (range !== "today" && !Number.isFinite(days)) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range !== "today") start.setDate(start.getDate() - Math.max(0, days - 1));
  return start;
}

export function buildIpUsageRows(events = []) {
  const groups = new Map();

  normalizeAuditEvents(events).forEach((event) => {
    const ipAddress = event.ipAddress || "No disponible";
    if (!groups.has(ipAddress)) {
      groups.set(ipAddress, {
        ipAddress,
        events: [],
        accounts: new Set(),
        devices: new Set(),
        sessions: new Set(),
        activeDays: new Set(),
        reportCounts: new Map(),
        accesses: 0,
        reportOpens: 0,
      });
    }

    const group = groups.get(ipAddress);
    group.events.push(event);
    if (event.actorEmail) group.accounts.add(event.actorEmail);
    if (event.deviceId) group.devices.add(event.deviceId);
    if (event.sessionId) group.sessions.add(event.sessionId);
    if (event.createdAt) group.activeDays.add(event.createdAt.slice(0, 10));
    if (event.action === "platform_access") group.accesses += 1;
    if (event.action === "report_opened") {
      group.reportOpens += 1;
      const key = event.subjectId || event.subjectName || "Reporte";
      const current = group.reportCounts.get(key) || { id: event.subjectId, name: event.subjectName || "Reporte", count: 0 };
      current.count += 1;
      group.reportCounts.set(key, current);
    }
  });

  return [...groups.values()].map((group) => {
    const orderedEvents = [...group.events].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const reports = [...group.reportCounts.values()].sort((a, b) => b.count - a.count);
    const activeDays = group.activeDays.size;
    return {
      ipAddress: group.ipAddress,
      events: orderedEvents,
      accounts: [...group.accounts].sort(),
      deviceCount: group.devices.size,
      sessionCount: group.sessions.size,
      activeDays,
      accesses: group.accesses,
      reportOpens: group.reportOpens,
      reports,
      topReport: reports[0] || null,
      opensPerActiveDay: activeDays ? group.reportOpens / activeDays : 0,
      firstSeen: orderedEvents.at(-1)?.createdAt || "",
      lastSeen: orderedEvents[0]?.createdAt || "",
    };
  }).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

export function getAuditDeviceLabel(event) {
  const platform = event?.metadata?.platform || "Dispositivo";
  const userAgent = event?.userAgent || "";
  const browser = /Edg\//.test(userAgent) ? "Edge"
    : /Chrome\//.test(userAgent) ? "Chrome"
      : /Firefox\//.test(userAgent) ? "Firefox"
        : /Safari\//.test(userAgent) ? "Safari"
          : "Navegador";
  return `${platform} · ${browser}`;
}

export function getAuditEventDetail(event) {
  if (!event?.metadata) return "";

  if (event.metadata.from && event.metadata.to) {
    return `${event.metadata.from} -> ${event.metadata.to}`;
  }

  return event.metadata.detail || event.subjectName || "Actividad registrada";
}

export function normalizeAuditEvent(event) {
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
    ipAddress: event.ipAddress || event.metadata?.ipAddress || "",
    deviceId: event.deviceId || event.metadata?.deviceId || "",
    sessionId: event.sessionId || event.metadata?.sessionId || "",
    sessionStartedAt: event.sessionStartedAt || event.metadata?.sessionStartedAt || event.createdAt || "",
    userAgent: event.userAgent || event.metadata?.userAgent || "",
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
