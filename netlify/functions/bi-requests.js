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
  const allowed = ["new", "in-review", "approved", "rejected", "done"];
  return allowed.includes(status) ? status : "new";
}

function normalizePriority(priority) {
  const allowed = ["low", "medium", "high", "critical"];
  return allowed.includes(priority) ? priority : "medium";
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

        return normalizeRequest({
          ...request,
          status: body.status || request.status,
          priority: body.priority || request.priority,
          adminNote:
            typeof body.adminNote === "string" ? body.adminNote : request.adminNote,
          updatedAt: new Date().toISOString(),
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
