const { getStore } = require("@netlify/blobs");
const { authenticate } = require("./_auth");

const STORE_NAME = "datareports-bi";
const REQUESTS_KEY = "requests.json";
const AUDIT_KEY = "requests-audit.json";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Authorization",
};

const REQUEST_STATUS_LABELS = {
  new: "Nuevo",
  analysis: "En análisis",
  progress: "En proceso",
  resolved: "Resuelto",
  rejected: "Rechazado",
};

const REQUEST_PRIORITY_LABELS = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function getRequestsStore() {
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

function normalizeRequestType(type) {
  const allowed = ["access", "change", "issue", "new-report"];
  return allowed.includes(type) ? type : "access";
}

function normalizeRequestStatus(status) {
  const aliases = {
    "in-review": "analysis",
    approved: "progress",
    done: "resolved",
  };
  const normalized = aliases[status] || status;
  const allowed = ["new", "analysis", "progress", "resolved", "rejected"];
  return allowed.includes(normalized) ? normalized : "new";
}

function normalizePriority(priority) {
  const aliases = {
    low: "baja",
    medium: "media",
    high: "alta",
    critical: "critica",
  };
  const normalized = aliases[priority] || priority;
  const allowed = ["baja", "media", "alta", "critica"];
  return allowed.includes(normalized) ? normalized : "media";
}

function normalizeHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((entry) => ({
      id: String(entry.id || `HIS-${Date.now()}`).trim(),
      type: String(entry.type || "event").trim(),
      status: normalizeRequestStatus(entry.status),
      priority: normalizePriority(entry.priority),
      label: String(entry.label || "").trim(),
      actorName: String(entry.actorName || "Equipo BI").trim(),
      actorEmail: String(entry.actorEmail || "").trim().toLowerCase(),
      createdAt: entry.createdAt || new Date().toISOString(),
    }))
    .filter((entry) => entry.createdAt)
    .slice(0, 40);
}

function normalizeRequest(request = {}, auth = {}) {
  const now = new Date().toISOString();
  const id = String(request.id || `REQ-${Date.now()}`).trim();

  return {
    id,
    type: normalizeRequestType(request.type),
    typeLabel: String(request.typeLabel || "").trim(),
    title: String(request.title || "").trim(),
    reportId: String(request.reportId || "").trim(),
    reportName: String(request.reportName || "Reporte").trim(),
    reportCategory: String(request.reportCategory || "").trim(),
    details: String(request.details || "").trim(),
    userName: String(auth.userName || request.userName || "Usuario").trim(),
    userEmail: String(auth.userEmail || request.userEmail || "")
      .trim()
      .toLowerCase(),
    status: normalizeRequestStatus(request.status),
    priority: normalizePriority(request.priority),
    adminNote: String(request.adminNote || "").trim(),
    history: normalizeHistory(request.history),
    createdAt: request.createdAt || now,
    updatedAt: request.updatedAt || now,
  };
}

function validateRequest(request) {
  const errors = [];

  if (!request.reportId) {
    errors.push("El reporte es obligatorio.");
  }

  if (!request.details || request.details.length < 8) {
    errors.push("El detalle debe tener al menos 8 caracteres.");
  }

  if (!request.userEmail) {
    errors.push("No se pudo identificar al usuario.");
  }

  return errors;
}

function canUserSeeRequest(request, auth) {
  return auth.isAdmin || request.userEmail === auth.userEmail;
}

async function readJSON(store, key, fallback) {
  try {
    const data = await store.get(key, { type: "json" });
    return data || fallback;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return fallback;
  }
}

async function writeJSON(store, key, data) {
  await store.setJSON(key, data);
}

async function appendAudit(store, entry) {
  const audit = await readJSON(store, AUDIT_KEY, []);
  const updated = [
    {
      id: `AUD-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...entry,
    },
    ...audit,
  ].slice(0, 500);

  await writeJSON(store, AUDIT_KEY, updated);
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

    const store = getRequestsStore();

    if (method === "GET") {
      const requests = await readJSON(store, REQUESTS_KEY, []);
      const normalized = Array.isArray(requests)
        ? requests.map((request) => normalizeRequest(request))
        : [];
      const visibleRequests = normalized
        .filter((request) => canUserSeeRequest(request, auth))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        userEmail: auth.userEmail,
        isAdmin: auth.isAdmin,
        totalRequests: normalized.length,
        visibleRequests: visibleRequests.length,
        requests: visibleRequests,
      });
    }

    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const incoming = normalizeRequest(
        {
          ...(body.request || body),
          status: "new",
        },
        auth
      );

      incoming.history = [
        {
          id: `HIS-${Date.now()}`,
          type: "created",
          status: "new",
          priority: incoming.priority,
          label: incoming.type === "issue" ? "Problema registrado" : "Solicitud creada",
          actorName: incoming.userName,
          actorEmail: incoming.userEmail,
          createdAt: incoming.createdAt,
        },
      ].slice(0, 40);

      const errors = validateRequest(incoming);
      if (errors.length) {
        return json(400, {
          ok: false,
          errors,
        });
      }

      const requests = await readJSON(store, REQUESTS_KEY, []);
      const existing = Array.isArray(requests)
        ? requests.map((request) => normalizeRequest(request))
        : [];
      const updated = [incoming, ...existing].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      await writeJSON(store, REQUESTS_KEY, updated);
      await appendAudit(store, {
        action: "create_request",
        requestId: incoming.id,
        reportId: incoming.reportId,
        userEmail: auth.userEmail,
      });

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        request: incoming,
        requests: updated.filter((request) => canUserSeeRequest(request, auth)),
      });
    }

    if (!auth.isAdmin) {
      return json(403, {
        ok: false,
        error: "No autorizado. Solo administradores pueden modificar solicitudes.",
      });
    }

    if (method === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const requestId = String(body.requestId || body.id || "").trim();

      if (!requestId) {
        return json(400, {
          ok: false,
          error: "El requestId es obligatorio.",
        });
      }

      const requests = await readJSON(store, REQUESTS_KEY, []);
      const existing = Array.isArray(requests)
        ? requests.map((request) => normalizeRequest(request))
        : [];
      let changed = false;

      const updated = existing.map((request) => {
        if (request.id !== requestId) return request;
        changed = true;
        const nextStatus = normalizeRequestStatus(body.status || request.status);
        const nextPriority = normalizePriority(body.priority || request.priority);
        const nextAdminNote =
          typeof body.adminNote === "string" ? body.adminNote.trim() : request.adminNote;
        const changedStatus = nextStatus !== request.status;
        const changedPriority = nextPriority !== request.priority;
        const changedNote = nextAdminNote !== request.adminNote;
        const historyEntry = {
          id: `HIS-${Date.now()}`,
          type: changedStatus ? "status" : changedPriority ? "priority" : "note",
          status: nextStatus,
          priority: nextPriority,
          label: changedStatus
            ? `Estado cambiado a ${REQUEST_STATUS_LABELS[nextStatus] || nextStatus}`
            : changedPriority
              ? `Prioridad cambiada a ${REQUEST_PRIORITY_LABELS[nextPriority] || nextPriority}`
              : "Nota administrativa actualizada",
          actorName: auth.userName || "Equipo BI",
          actorEmail: auth.userEmail,
          createdAt: new Date().toISOString(),
        };

        return normalizeRequest({
          ...request,
          status: nextStatus,
          priority: nextPriority,
          adminNote: nextAdminNote,
          history: changedStatus || changedPriority || changedNote
            ? [historyEntry, ...request.history]
            : request.history,
          updatedAt: historyEntry.createdAt,
        });
      });

      if (!changed) {
        return json(404, {
          ok: false,
          error: "Solicitud no encontrada.",
        });
      }

      await writeJSON(store, REQUESTS_KEY, updated);
      await appendAudit(store, {
        action: "update_request",
        requestId,
        status: body.status || "",
        priority: body.priority || "",
        hasAdminNote: typeof body.adminNote === "string",
        userEmail: auth.userEmail,
      });

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        requests: updated.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        ),
      });
    }

    if (method === "DELETE") {
      const params = event.queryStringParameters || {};
      const requestId = String(params.id || params.requestId || "").trim();

      if (!requestId) {
        return json(400, {
          ok: false,
          error: "El requestId es obligatorio.",
        });
      }

      const requests = await readJSON(store, REQUESTS_KEY, []);
      const existing = Array.isArray(requests)
        ? requests.map((request) => normalizeRequest(request))
        : [];
      const updated = existing.filter((request) => request.id !== requestId);

      await writeJSON(store, REQUESTS_KEY, updated);
      await appendAudit(store, {
        action: "delete_request",
        requestId,
        userEmail: auth.userEmail,
      });

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        deleted: requestId,
        requests: updated,
      });
    }

    return json(405, {
      ok: false,
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("bi-requests function error:", error);

    return json(500, {
      ok: false,
      error: error.message || "Internal error",
    });
  }
};
