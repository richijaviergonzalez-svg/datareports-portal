const { getStore } = require("@netlify/blobs");

const STORE_NAME = "datareports-bi";
const REQUESTS_KEY = "requests.json";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function normalizeRequest(request = {}) {
  const now = new Date().toISOString();

  return {
    id: request.id || `REQ-${Date.now()}`,
    type: request.type || "change",
    typeLabel:
      request.typeLabel ||
      (request.type === "issue" ? "Problema" : "Cambio"),
    title:
      request.title ||
      (request.type === "issue"
        ? "Problema reportado"
        : "Solicitud de cambio"),
    reportId: request.reportId || "",
    reportName: request.reportName || "Reporte sin nombre",
    reportCategory: request.reportCategory || "Sin categoría",
    details: request.details || "Sin observaciones adicionales.",
    userName: request.userName || "Usuario",
    userEmail: request.userEmail || "",
    status: request.status || "new",
    priority: request.priority || (request.type === "issue" ? "media" : "baja"),
    createdAt: request.createdAt || now,
    updatedAt: request.updatedAt || now,
    adminNote: request.adminNote || "",
  };
}

async function readRequests(store) {
  try {
    const data = await store.get(REQUESTS_KEY, { type: "json" });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error reading requests:", error);
    return [];
  }
}

async function writeRequests(store, requests) {
  await store.setJSON(REQUESTS_KEY, requests.slice(0, 500));
}

exports.handler = async (event) => {
  try {
    const store = getStore(STORE_NAME);
    const method = event.httpMethod;

    if (method === "GET") {
      const params = event.queryStringParameters || {};
      const email = String(params.email || "").toLowerCase();
      const isAdmin = String(params.admin || "false") === "true";

      const allRequests = await readRequests(store);

      const visibleRequests = isAdmin
        ? allRequests
        : allRequests.filter(
            (req) => String(req.userEmail || "").toLowerCase() === email
          );

      return json(200, {
        ok: true,
        requests: visibleRequests,
      });
    }

    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const incoming = normalizeRequest(body.request || body);

      const allRequests = await readRequests(store);

      const updated = [
        incoming,
        ...allRequests.filter((req) => req.id !== incoming.id),
      ].slice(0, 500);

      await writeRequests(store, updated);

      return json(200, {
        ok: true,
        request: incoming,
        requests: updated,
      });
    }

    if (method === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const { requestId, status, adminNote } = body;

      if (!requestId) {
        return json(400, {
          ok: false,
          error: "requestId is required",
        });
      }

      const allRequests = await readRequests(store);

      const updated = allRequests.map((req) =>
        req.id === requestId
          ? {
              ...req,
              status: status || req.status,
              adminNote:
                typeof adminNote === "string" ? adminNote : req.adminNote,
              updatedAt: new Date().toISOString(),
            }
          : req
      );

      await writeRequests(store, updated);

      return json(200, {
        ok: true,
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
