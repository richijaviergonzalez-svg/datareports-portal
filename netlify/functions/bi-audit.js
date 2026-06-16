const { getStore } = require("@netlify/blobs");
const { authenticate } = require("./_auth");

const STORE_NAME = "datareports-bi";
const AUDIT_KEY = "portal-audit.json";
const MAX_BODY_BYTES = 24 * 1024;
const MAX_AUDIT_EVENTS = 1000;
const MAX_LABEL_LENGTH = 160;
const MAX_DETAIL_LENGTH = 240;

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Authorization",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function trimString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function parseJsonBody(event) {
  const rawBody = event.body || "";
  const bodyBytes = Buffer.byteLength(rawBody, "utf8");

  if (bodyBytes > MAX_BODY_BYTES) {
    return {
      ok: false,
      statusCode: 413,
      error: "El evento supera el tamano maximo permitido.",
    };
  }

  try {
    return {
      ok: true,
      body: rawBody ? JSON.parse(rawBody) : {},
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 400,
      error: "El cuerpo de la solicitud no es JSON valido.",
    };
  }
}

function getAuditStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;

  if (siteID && token) {
    return getStore({
      name: STORE_NAME,
      siteID,
      token,
    });
  }

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

async function writeJSON(store, key, data) {
  await store.setJSON(key, data);
}

function normalizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object") return {};

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [
        trimString(key, 64),
        typeof value === "string" ? trimString(value, MAX_DETAIL_LENGTH) : value,
      ])
  );
}

function normalizeAuditEvent(event = {}, auth) {
  const action = trimString(event.action || "unknown", 80);
  const subjectType = trimString(event.subjectType || event.subject?.type || "system", 40);
  const subjectId = trimString(event.subjectId || event.subject?.id || "", 120);
  const subjectName = trimString(event.subjectName || event.subject?.name || "", MAX_LABEL_LENGTH);

  return {
    id: trimString(event.id || `audit-${Date.now()}`, 120),
    action,
    actionLabel: trimString(event.actionLabel || event.label || "Evento", MAX_LABEL_LENGTH),
    createdAt: new Date(event.createdAt || Date.now()).toISOString(),
    actorName: trimString(auth.userName || event.actorName || "Usuario", 120),
    actorEmail: auth.userEmail,
    subjectId,
    subjectName,
    subjectType,
    severity: trimString(event.severity || "normal", 40),
    metadata: normalizeMetadata(event.metadata),
  };
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;

    if (method === "OPTIONS") {
      return json(200, { ok: true });
    }

    const auth = await authenticate(event);
    if (!auth.ok) {
      return json(auth.statusCode || 401, {
        ok: false,
        error: auth.error,
      });
    }

    const store = getAuditStore();

    if (method === "GET") {
      if (!auth.isAdmin) {
        return json(403, {
          ok: false,
          error: "No autorizado. Solo administradores pueden consultar auditoria.",
        });
      }

      const events = await readJSON(store, AUDIT_KEY, []);
      const normalized = Array.isArray(events)
        ? events.map((item) => normalizeAuditEvent(item, { userName: item.actorName, userEmail: item.actorEmail })).filter(Boolean)
        : [];

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        totalEvents: normalized.length,
        events: normalized.slice(0, MAX_AUDIT_EVENTS),
      });
    }

    if (method === "POST") {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return json(parsed.statusCode, {
          ok: false,
          error: parsed.error,
        });
      }

      const incoming = normalizeAuditEvent(parsed.body.event || parsed.body, auth);
      const current = await readJSON(store, AUDIT_KEY, []);
      const existing = Array.isArray(current) ? current : [];
      const deduped = existing.filter((item) => item.id !== incoming.id);
      const updated = [incoming, ...deduped].slice(0, MAX_AUDIT_EVENTS);

      await writeJSON(store, AUDIT_KEY, updated);

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        event: incoming,
        totalEvents: updated.length,
      });
    }

    return json(405, {
      ok: false,
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("bi-audit function error:", error);

    return json(500, {
      ok: false,
      error: error.message || "Internal error",
    });
  }
};
