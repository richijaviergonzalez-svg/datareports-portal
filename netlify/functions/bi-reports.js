const { getStore } = require("@netlify/blobs");

const STORE_NAME = "datareports-bi";
const REPORTS_KEY = "reports.json";
const AUDIT_KEY = "reports-audit.json";

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

function getReportsStore() {
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

function isAdminRequest(event) {
  const headers = event.headers || {};
  const email =
    headers["x-user-email"] ||
    headers["X-User-Email"] ||
    headers["x-user"] ||
    "";

  const adminEmails = String(
    process.env.ADMIN_EMAILS ||
      process.env.VITE_ADMIN_EMAILS ||
      "richi.gonzalez@pilarpy.onmicrosoft.com"
  )
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(String(email).trim().toLowerCase());
}

function normalizeStatus(status) {
  const allowed = ["live", "draft", "maintenance"];
  return allowed.includes(status) ? status : "live";
}

function normalizeReport(report = {}) {
  const now = new Date().toISOString();

  return {
    id: String(report.id || "").trim(),
    groupId: String(report.groupId || "").trim(),
    name: String(report.name || "Reporte sin nombre").trim(),
    category: String(report.category || "Comercial").trim(),
    icon: String(report.icon || "chart-bar").trim(),
    status: normalizeStatus(report.status),
    description: String(report.description || "").trim(),

    originalUrl: String(report.originalUrl || report.url || "").trim(),

    owner: String(report.owner || "Equipo BI").trim(),
    audience: String(report.audience || "Corporativo").trim(),
    accessLevel: String(report.accessLevel || "Corporativo").trim(),
    dataSource: String(report.dataSource || "Power BI Service").trim(),
    refreshFrequency: String(report.refreshFrequency || "Según actualización del dataset").trim(),
    criticality: String(report.criticality || "media").trim(),
    internalNotes: String(report.internalNotes || "").trim(),

    createdAt: report.createdAt || now,
    updatedAt: now,
    createdBy: String(report.createdBy || "").trim(),
    updatedBy: String(report.updatedBy || "").trim(),
  };
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

function validateReport(report) {
  const errors = [];

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!report.name || report.name.trim().length < 3) {
    errors.push("El nombre del reporte es obligatorio y debe tener al menos 3 caracteres.");
  }

  if (!report.id || !uuidRegex.test(report.id)) {
    errors.push("El Report ID debe tener formato UUID válido.");
  }

  if (report.groupId && !uuidRegex.test(report.groupId)) {
    errors.push("El Workspace ID debe tener formato UUID válido o quedar vacío si es My Workspace.");
  }

  return errors;
}

exports.handler = async (event) => {
  try {
    const store = getReportsStore();
    const method = event.httpMethod;

    if (method === "GET") {
      const reports = await readJSON(store, REPORTS_KEY, []);

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        reports: Array.isArray(reports) ? reports : [],
      });
    }

    if (!isAdminRequest(event)) {
      return json(403, {
        ok: false,
        error: "No autorizado. Solo administradores pueden modificar el catálogo de reportes.",
      });
    }

    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const incomingReports = Array.isArray(body.reports) ? body.reports : [];

      const normalized = incomingReports.map(normalizeReport);

      const validationErrors = [];
      const seenIds = new Set();

      normalized.forEach((report) => {
        validateReport(report).forEach((error) => {
          validationErrors.push(`${report.name}: ${error}`);
        });

        if (seenIds.has(report.id)) {
          validationErrors.push(`Reporte duplicado: ${report.name} (${report.id})`);
        }

        seenIds.add(report.id);
      });

      if (validationErrors.length) {
        return json(400, {
          ok: false,
          errors: validationErrors,
        });
      }

      await writeJSON(store, REPORTS_KEY, normalized);

      await appendAudit(store, {
        action: "replace_catalog",
        userEmail: event.headers["x-user-email"] || "",
        count: normalized.length,
      });

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        reports: normalized,
      });
    }

    if (method === "PATCH" || method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const incoming = normalizeReport(body.report || body);

      const errors = validateReport(incoming);
      if (errors.length) {
        return json(400, {
          ok: false,
          errors,
        });
      }

      const reports = await readJSON(store, REPORTS_KEY, []);
      const existing = Array.isArray(reports) ? reports : [];

      const duplicate = existing.find(
        (report) => report.id === incoming.id && report.id !== body.previousId
      );

      if (duplicate && duplicate.id !== incoming.id) {
        return json(400, {
          ok: false,
          errors: [`Ya existe un reporte con el mismo Report ID: ${incoming.id}`],
        });
      }

      const updated = [
        incoming,
        ...existing.filter((report) => report.id !== incoming.id),
      ];

      await writeJSON(store, REPORTS_KEY, updated);

      await appendAudit(store, {
        action: method === "POST" ? "create_report" : "upsert_report",
        reportId: incoming.id,
        reportName: incoming.name,
        userEmail: event.headers["x-user-email"] || "",
      });

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        report: incoming,
        reports: updated,
      });
    }

    if (method === "DELETE") {
      const params = event.queryStringParameters || {};
      const reportId = String(params.id || "").trim();

      if (!reportId) {
        return json(400, {
          ok: false,
          error: "El parámetro id es obligatorio.",
        });
      }

      const reports = await readJSON(store, REPORTS_KEY, []);
      const existing = Array.isArray(reports) ? reports : [];
      const removed = existing.find((report) => report.id === reportId);
      const updated = existing.filter((report) => report.id !== reportId);

      await writeJSON(store, REPORTS_KEY, updated);

      await appendAudit(store, {
        action: "delete_report",
        reportId,
        reportName: removed?.name || "",
        userEmail: event.headers["x-user-email"] || "",
      });

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        deleted: reportId,
        reports: updated,
      });
    }

    return json(405, {
      ok: false,
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("bi-reports function error:", error);

    return json(500, {
      ok: false,
      error: error.message || "Internal error",
    });
  }
};
