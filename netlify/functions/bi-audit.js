const { connectLambda, getStore } = require("@netlify/blobs");
const { createHash } = require("node:crypto");
const { isIP } = require("node:net");
const { authenticate } = require("./_auth");

const STORE_NAME = "datareports-bi";
const LEGACY_AUDIT_KEY = "portal-audit.json";
const AUDIT_SESSION_PREFIX = "portal-audit/sessions/";
const MAX_BODY_BYTES = 24 * 1024;
const MAX_AUDIT_EVENTS = 5000;
const MAX_AUDIT_SESSIONS = 750;
const MAX_EVENTS_PER_SESSION = 250;
const MAX_LABEL_LENGTH = 160;
const MAX_DETAIL_LENGTH = 240;

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Authorization",
};

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function trimString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function parseJsonBody(event) {
  const rawBody = event.body || "";
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return { ok: false, statusCode: 413, error: "El evento supera el tamano maximo permitido." };
  }

  try {
    return { ok: true, body: rawBody ? JSON.parse(rawBody) : {} };
  } catch (error) {
    return { ok: false, statusCode: 400, error: "El cuerpo de la solicitud no es JSON valido." };
  }
}

function getAuditStore(event) {
  connectLambda(event);
  return getStore(STORE_NAME);
}

async function readJSON(store, key, fallback) {
  try {
    const value = await store.get(key, { type: "json" });
    return value ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function getHeader(event, name) {
  const wanted = name.toLowerCase();
  const entry = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return entry?.[1] || "";
}

function normalizeIp(value) {
  let candidate = trimString(value, 120).replace(/^"|"$/g, "");
  if (!candidate) return "";
  if (candidate.startsWith("[")) candidate = candidate.slice(1, candidate.indexOf("]"));
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) candidate = candidate.split(":")[0];
  if (candidate.startsWith("::ffff:") && isIP(candidate.slice(7)) === 4) candidate = candidate.slice(7);
  return isIP(candidate) ? candidate : "";
}

function getClientIp(event) {
  const netlifyIp = normalizeIp(getHeader(event, "x-nf-client-connection-ip"));
  if (netlifyIp) return netlifyIp;

  const clientIp = normalizeIp(getHeader(event, "client-ip"));
  if (clientIp) return clientIp;

  const forwarded = getHeader(event, "x-forwarded-for")
    .split(",")
    .map(normalizeIp)
    .find(Boolean);
  return forwarded || "No disponible";
}

function normalizeMetadata(metadata = {}, auth = {}) {
  if (!metadata || typeof metadata !== "object") return {};

  const normalized = Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [
        trimString(key, 64),
        typeof value === "string" ? trimString(value, MAX_DETAIL_LENGTH) : value,
      ])
  );
  if (normalized.adminAction) normalized.adminAction = auth.isAdmin === true;
  delete normalized.ipAddress;
  delete normalized.userAgent;
  return normalized;
}

function safeIsoDate(value, fallback = new Date().toISOString()) {
  const date = new Date(value || fallback);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function getSessionStartedAt(value, serverTime) {
  const candidate = safeIsoDate(value, serverTime);
  const difference = Math.abs(new Date(candidate).getTime() - new Date(serverTime).getTime());
  return difference <= 24 * 60 * 60 * 1000 ? candidate : serverTime;
}

function normalizeAuditEvent(event = {}, auth = {}, requestEvent = null, options = {}) {
  const serverTime = options.serverTime || new Date().toISOString();
  const metadata = normalizeMetadata(event.metadata, auth);
  const createdAt = options.recording ? serverTime : safeIsoDate(event.createdAt, serverTime);
  const sessionId = trimString(event.sessionId || metadata.sessionId || `legacy-${event.id || Date.now()}`, 160);
  const deviceId = trimString(event.deviceId || metadata.deviceId || "", 160);

  if (options.recording && event.createdAt) metadata.clientCreatedAt = safeIsoDate(event.createdAt, serverTime);

  return {
    id: trimString(event.id || `audit-${Date.now()}`, 120),
    action: trimString(event.action || "unknown", 80),
    actionLabel: trimString(event.actionLabel || event.label || "Evento", MAX_LABEL_LENGTH),
    createdAt,
    actorName: trimString(auth.userName || event.actorName || "Usuario", 120),
    actorEmail: trimString(auth.userEmail || event.actorEmail, 160).toLowerCase(),
    subjectId: trimString(event.subjectId || event.subject?.id || "", 120),
    subjectName: trimString(event.subjectName || event.subject?.name || "", MAX_LABEL_LENGTH),
    subjectType: trimString(event.subjectType || event.subject?.type || "system", 40),
    severity: trimString(event.severity || "normal", 40),
    ipAddress: requestEvent ? getClientIp(requestEvent) : trimString(event.ipAddress || "No disponible", 120),
    deviceId,
    sessionId,
    sessionStartedAt: options.recording
      ? getSessionStartedAt(event.sessionStartedAt || metadata.sessionStartedAt, serverTime)
      : safeIsoDate(event.sessionStartedAt || metadata.sessionStartedAt, createdAt),
    userAgent: requestEvent
      ? trimString(getHeader(requestEvent, "user-agent"), 320)
      : trimString(event.userAgent, 320),
    metadata,
  };
}

function getAuditSessionKey(event) {
  const startedAt = safeIsoDate(event.sessionStartedAt || event.createdAt);
  const timestamp = startedAt.replace(/[-:.]/g, "");
  const identity = `${event.actorEmail}|${event.sessionId}`;
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 24);
  return `${AUDIT_SESSION_PREFIX}${timestamp}-${digest}.json`;
}

async function readSessionEvents(store) {
  if (typeof store.list !== "function") return [];
  const result = await store.list({ prefix: AUDIT_SESSION_PREFIX });
  const blobs = (Array.isArray(result?.blobs) ? result.blobs : [])
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, MAX_AUDIT_SESSIONS);
  const sessions = [];

  for (let index = 0; index < blobs.length; index += 25) {
    const batch = await Promise.all(
      blobs.slice(index, index + 25).map((blob) => readJSON(store, blob.key, null))
    );
    sessions.push(...batch.filter(Boolean));
  }

  return sessions.flatMap((session) => Array.isArray(session?.events) ? session.events : []);
}

function createHandler(dependencies = {}) {
  const authenticateRequest = dependencies.authenticate || authenticate;
  const getStoreForRequest = dependencies.getAuditStore || getAuditStore;

  return async (event) => {
    try {
      const method = event.httpMethod;
      if (method === "OPTIONS") return json(200, { ok: true });

      const auth = await authenticateRequest(event);
      if (!auth.ok) return json(auth.statusCode || 401, { ok: false, error: auth.error });
      const store = getStoreForRequest(event);

      if (method === "GET") {
        if (!auth.isAdmin && !auth.canViewAudit) {
          return json(403, { ok: false, error: "No autorizado para consultar auditoria." });
        }

        const [sessionEvents, legacyEvents] = await Promise.all([
          readSessionEvents(store),
          readJSON(store, LEGACY_AUDIT_KEY, []),
        ]);
        const combined = [...sessionEvents, ...(Array.isArray(legacyEvents) ? legacyEvents : [])]
          .map((item) => normalizeAuditEvent(item, { userName: item.actorName, userEmail: item.actorEmail }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const normalized = [...new Map(combined.map((item) => [item.id, item])).values()]
          .slice(0, MAX_AUDIT_EVENTS);

        return json(200, {
          ok: true,
          source: "netlify-blobs",
          storageMode: "session-records",
          totalEvents: normalized.length,
          events: normalized,
        });
      }

      if (method === "POST") {
        const parsed = parseJsonBody(event);
        if (!parsed.ok) return json(parsed.statusCode, { ok: false, error: parsed.error });

        const incoming = normalizeAuditEvent(parsed.body.event || parsed.body, auth, event, { recording: true });
        const sessionKey = getAuditSessionKey(incoming);
        const current = await readJSON(store, sessionKey, { events: [] });
        const existing = Array.isArray(current?.events) ? current.events : [];
        const events = [incoming, ...existing.filter((item) => item.id !== incoming.id)]
          .slice(0, MAX_EVENTS_PER_SESSION);

        await store.setJSON(sessionKey, {
          sessionId: incoming.sessionId,
          sessionStartedAt: incoming.sessionStartedAt,
          actorEmail: incoming.actorEmail,
          ipAddress: incoming.ipAddress,
          updatedAt: incoming.createdAt,
          events,
        });

        return json(200, {
          ok: true,
          source: "netlify-blobs",
          event: incoming,
          sessionEvents: events.length,
        });
      }

      return json(405, { ok: false, error: "Method not allowed" });
    } catch (error) {
      console.error("bi-audit function error:", error);
      return json(500, { ok: false, error: error.message || "Internal error" });
    }
  };
}

exports.createHandler = createHandler;
exports.getClientIp = getClientIp;
exports.handler = createHandler();
