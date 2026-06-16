const { getStore } = require("@netlify/blobs");
const { authenticate } = require("./_auth");

const STORE_NAME = "datareports-bi";
const INCIDENTS_KEY = "portal-incidents.json";
const MAX_BODY_BYTES = 24 * 1024;
const MAX_INCIDENTS = 40;
const MAX_TITLE_LENGTH = 120;
const MAX_DETAIL_LENGTH = 320;

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
      error: "La lista de incidencias supera el tamano maximo permitido.",
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

function getIncidentsStore() {
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

function normalizeIncident(incident = {}, auth = {}) {
  const now = new Date().toISOString();
  const severity = ["info", "warning", "critical", "success"].includes(incident.severity)
    ? incident.severity
    : "info";

  return {
    id: trimString(incident.id || `incident-${Date.now()}`, 100),
    title: trimString(incident.title, MAX_TITLE_LENGTH),
    detail: trimString(incident.detail, MAX_DETAIL_LENGTH),
    severity,
    active: incident.active !== false,
    createdAt: incident.createdAt || now,
    updatedAt: now,
    updatedBy: auth.userEmail || trimString(incident.updatedBy, 120),
  };
}

function normalizeIncidents(incidents = [], auth = {}) {
  return (Array.isArray(incidents) ? incidents : [])
    .map((incident) => normalizeIncident(incident, auth))
    .filter((incident) => incident.title && incident.detail)
    .slice(0, MAX_INCIDENTS);
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

    const store = getIncidentsStore();

    if (method === "GET") {
      const incidents = await readJSON(store, INCIDENTS_KEY, []);
      const normalized = normalizeIncidents(incidents);

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        isAdmin: auth.isAdmin,
        incidents: auth.isAdmin ? normalized : normalized.filter((incident) => incident.active),
      });
    }

    if (method === "PUT") {
      if (!auth.isAdmin) {
        return json(403, {
          ok: false,
          error: "No autorizado. Solo administradores pueden modificar incidencias.",
        });
      }

      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return json(parsed.statusCode, {
          ok: false,
          error: parsed.error,
        });
      }

      const incidents = normalizeIncidents(parsed.body.incidents || [], auth);
      await writeJSON(store, INCIDENTS_KEY, incidents);

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        incidents,
      });
    }

    return json(405, {
      ok: false,
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("bi-incidents function error:", error);

    return json(500, {
      ok: false,
      error: error.message || "Internal error",
    });
  }
};
