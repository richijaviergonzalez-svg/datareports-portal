const { getStore } = require("@netlify/blobs");
const { authenticate } = require("./_auth");

const STORE_NAME = "datareports-bi";
const REQUESTS_KEY = "requests.json";
const AUDIT_KEY = "requests-audit.json";
const MAX_BODY_BYTES = 32 * 1024;
const MAX_REQUESTS = 500;
const MAX_DETAIL_LENGTH = 2000;
const MAX_ADMIN_NOTE_LENGTH = 1200;
const MAX_TITLE_LENGTH = 160;
const MAX_LABEL_LENGTH = 80;
const MAX_NAME_LENGTH = 120;
const MAX_ID_LENGTH = 80;

const REQUEST_TYPES = ["access", "change", "issue", "new-report"];
const REQUEST_STATUSES = ["new", "analysis", "progress", "resolved", "rejected"];
const REQUEST_PRIORITIES = ["baja", "media", "alta", "critica"];

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Authorization",
};

const readHeaders = {
  ...headers,
  "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
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

function json(statusCode, body, responseHeaders = headers) {
  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify(body),
  };
}

function trimString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeAlias(value, aliases = {}) {
  const key = String(value || "").trim();
  return aliases[key] || key;
}

function parseJsonBody(event) {
  const rawBody = event.body || "";
  const bodyBytes = Buffer.byteLength(rawBody, "utf8");

  if (bodyBytes > MAX_BODY_BYTES) {
    return {
      ok: false,
      statusCode: 413,
      error: "La solicitud supera el tamaño máximo permitido.",
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
      error: "El cuerpo de la solicitud no es JSON válido.",
    };
  }
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
  const normalized = trimString(type, MAX_LABEL_LENGTH);
  return REQUEST_TYPES.includes(normalized) ? normalized : "access";
}

function normalizeRequestStatus(status) {
  const normalized = normalizeAlias(status, {
    "in-review": "analysis",
    approved: "progress",
    done: "resolved",
  });
  return REQUEST_STATUSES.includes(normalized) ? normalized : "new";
}

function isValidRequestStatus(status) {
  const normalized = normalizeAlias(status, {
    "in-review": "analysis",
    approved: "progress",
    done: "resolved",
  });
  return REQUEST_STATUSES.includes(normalized);
}

function normalizePriority(priority) {
  const normalized = normalizeAlias(priority, {
    low: "baja",
    medium: "media",
    high: "alta",
    critical: "critica",
  });
  return REQUEST_PRIORITIES.includes(normalized) ? normalized : "media";
}

function isValidPriority(priority) {
  const normalized = normalizeAlias(priority, {
    low: "baja",
    medium: "media",
    high: "alta",
    critical: "critica",
  });
  return REQUEST_PRIORITIES.includes(normalized);
}

function normalizeHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((entry) => ({
      id: String(entry.id || `HIS-${Date.now()}`).trim(),
      type: trimString(entry.type || "event", MAX_LABEL_LENGTH),
      status: normalizeRequestStatus(entry.status),
      priority: normalizePriority(entry.priority),
      label: trimString(entry.label || "", MAX_TITLE_LENGTH),
      actorName: trimString(entry.actorName || "Equipo BI", MAX_NAME_LENGTH),
      actorEmail: String(entry.actorEmail || "").trim().toLowerCase(),
      createdAt: entry.createdAt || new Date().toISOString(),
    }))
    .filter((entry) => entry.createdAt)
    .slice(0, 40);
}

function normalizeRequest(request = {}, auth = {}) {
  const now = new Date().toISOString();
  const id = trimString(request.id || `REQ-${Date.now()}`, MAX_ID_LENGTH);

  return {
    id,
    type: normalizeRequestType(request.type),
    typeLabel: trimString(request.typeLabel || "", MAX_LABEL_LENGTH),
    title: trimString(request.title || "", MAX_TITLE_LENGTH),
    reportId: trimString(request.reportId || "", MAX_ID_LENGTH),
    reportName: trimString(request.reportName || "Reporte", MAX_NAME_LENGTH),
    reportCategory: trimString(request.reportCategory || "", MAX_LABEL_LENGTH),
    details: trimString(request.details || "", MAX_DETAIL_LENGTH),
    userName: trimString(auth.userName || request.userName || "Usuario", MAX_NAME_LENGTH),
    userEmail: String(auth.userEmail || request.userEmail || "")
      .trim()
      .toLowerCase(),
    status: normalizeRequestStatus(request.status),
    priority: normalizePriority(request.priority),
    adminNote: trimString(request.adminNote || "", MAX_ADMIN_NOTE_LENGTH),
    history: normalizeHistory(request.history),
    createdAt: request.createdAt || now,
    updatedAt: request.updatedAt || now,
  };
}

function validateRequest(request) {
  const errors = [];

  if (!request.id || request.id.length > MAX_ID_LENGTH) {
    errors.push("El identificador de la solicitud no es válido.");
  }

  if (!request.reportId) {
    errors.push("El reporte es obligatorio.");
  }

  if (!request.details || request.details.length < 8) {
    errors.push("El detalle debe tener al menos 8 caracteres.");
  }

  if (request.details.length > MAX_DETAIL_LENGTH) {
    errors.push(`El detalle no puede superar ${MAX_DETAIL_LENGTH} caracteres.`);
  }

  if (!request.userEmail) {
    errors.push("No se pudo identificar al usuario.");
  }

  return errors;
}

function validatePatchPayload(body = {}) {
  const errors = [];
  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
  const hasPriority = Object.prototype.hasOwnProperty.call(body, "priority");
  const hasAdminNote = Object.prototype.hasOwnProperty.call(body, "adminNote");

  if (!hasStatus && !hasPriority && !hasAdminNote) {
    errors.push("No hay cambios para aplicar.");
  }

  if (hasStatus && !isValidRequestStatus(body.status)) {
    errors.push("Estado de solicitud no permitido.");
  }

  if (hasPriority && !isValidPriority(body.priority)) {
    errors.push("Prioridad de solicitud no permitida.");
  }

  if (hasAdminNote && String(body.adminNote || "").length > MAX_ADMIN_NOTE_LENGTH) {
    errors.push(`La nota administrativa no puede superar ${MAX_ADMIN_NOTE_LENGTH} caracteres.`);
  }

  return errors;
}

function sortRequests(requests = []) {
  return requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
      }, readHeaders);
    }

    if (method === "POST") {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return json(parsed.statusCode, {
          ok: false,
          error: parsed.error,
        });
      }

      const body = parsed.body;
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

      if (existing.some((request) => request.id === incoming.id)) {
        return json(409, {
          ok: false,
          error: "Ya existe una solicitud con ese identificador.",
        });
      }

      const updated = sortRequests([incoming, ...existing]).slice(0, MAX_REQUESTS);

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
      const parsed = parseJsonBody(event);
      if (!parsed.ok) {
        return json(parsed.statusCode, {
          ok: false,
          error: parsed.error,
        });
      }

      const body = parsed.body;
      const requestId = trimString(body.requestId || body.id || "", MAX_ID_LENGTH);

      if (!requestId) {
        return json(400, {
          ok: false,
          error: "El requestId es obligatorio.",
        });
      }

      const patchErrors = validatePatchPayload(body);
      if (patchErrors.length) {
        return json(400, {
          ok: false,
          errors: patchErrors,
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
        requests: sortRequests(updated),
      });
    }

    if (method === "DELETE") {
      const params = event.queryStringParameters || {};
      const requestId = trimString(params.id || params.requestId || "", MAX_ID_LENGTH);

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

      if (updated.length === existing.length) {
        return json(404, {
          ok: false,
          error: "Solicitud no encontrada.",
        });
      }

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
