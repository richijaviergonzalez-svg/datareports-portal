const { getStore } = require("@netlify/blobs");
const { authenticate } = require("./_auth");

const STORE_NAME = "datareports-bi";
const REPORTS_KEY = "reports.json";
const AUDIT_KEY = "reports-audit.json";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Authorization",
};

const readHeaders = {
  ...headers,
  "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
};

function json(statusCode, body, responseHeaders = headers) {
  return {
    statusCode,
    headers: responseHeaders,
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

function normalizeStatus(status) {
  const allowed = ["live", "draft", "maintenance"];
  return allowed.includes(status) ? status : "live";
}

function normalizeVisibilityMode(mode) {
  const allowed = ["all", "admins", "emails", "domains"];
  return allowed.includes(mode) ? mode : "all";
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }

  return String(value || "")
    .split(/[;,\n]/)
    .map((item) => item.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

function normalizeEmailList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }

  return String(value || "")
    .split(/[;,\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeReport(report = {}) {
  const now = new Date().toISOString();

  return {
    id: String(report.id || report.reportId || "").trim(),
    groupId: String(report.groupId || report.workspaceId || "").trim(),
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
    refreshFrequency: String(
      report.refreshFrequency || "Según actualización del dataset"
    ).trim(),
    criticality: String(report.criticality || "media").trim(),

    internalNotes: String(
      report.internalNotes || report.technicalNotes || ""
    ).trim(),
    technicalNotes: String(
      report.technicalNotes || report.internalNotes || ""
    ).trim(),

    visibilityMode: normalizeVisibilityMode(report.visibilityMode),
    allowedEmails: normalizeEmailList(report.allowedEmails),
    allowedDomains: normalizeList(report.allowedDomains),
    visibilityNote: String(report.visibilityNote || "").trim(),

    sortOrder: Number.isFinite(Number(report.sortOrder))
      ? Number(report.sortOrder)
      : 999,

    createdAt: report.createdAt || now,
    updatedAt: report.updatedAt || now,
    createdBy: String(report.createdBy || "").trim(),
    updatedBy: String(report.updatedBy || "").trim(),
  };
}

function canUserSeeReport(report, userEmail, isAdmin) {
  if (isAdmin) return true;

  const normalizedReport = normalizeReport(report);
  const email = String(userEmail || "").trim().toLowerCase();
  const domain = email.includes("@") ? email.split("@").pop() : "";

  switch (normalizedReport.visibilityMode) {
    case "admins":
      return false;

    case "emails":
      return normalizedReport.allowedEmails.includes(email);

    case "domains":
      return normalizedReport.allowedDomains.includes(domain);

    case "all":
    default:
      return true;
  }
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
    errors.push(
      "El nombre del reporte es obligatorio y debe tener al menos 3 caracteres."
    );
  }

  if (!report.id || !uuidRegex.test(report.id)) {
    errors.push("El Report ID debe tener formato UUID válido.");
  }

  if (report.groupId && !uuidRegex.test(report.groupId)) {
    errors.push(
      "El Workspace ID debe tener formato UUID válido o quedar vacío si es My Workspace."
    );
  }

  if (report.visibilityMode === "emails" && !report.allowedEmails.length) {
    errors.push(
      "Para visibilidad por usuarios específicos, debés cargar al menos un correo permitido."
    );
  }

  if (report.visibilityMode === "domains" && !report.allowedDomains.length) {
    errors.push(
      "Para visibilidad por dominios específicos, debés cargar al menos un dominio permitido."
    );
  }

  return errors;
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

    const store = getReportsStore();
    const userEmail = auth.userEmail;
    const isAdmin = auth.isAdmin;

    if (method === "GET") {
      const reports = await readJSON(store, REPORTS_KEY, []);
      const normalized = Array.isArray(reports)
        ? reports.map(normalizeReport)
        : [];

      const visibleReports = normalized
        .filter((report) => canUserSeeReport(report, userEmail, isAdmin))
        .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        userEmail,
        isAdmin,
        totalReports: normalized.length,
        visibleReports: visibleReports.length,
        reports: visibleReports,
      }, readHeaders);
    }

    if (!isAdmin) {
      return json(403, {
        ok: false,
        error:
          "No autorizado. Solo administradores pueden modificar el catálogo de reportes.",
      });
    }

    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const incomingReports = Array.isArray(body.reports) ? body.reports : [];

      const normalized = incomingReports.map((report, index) =>
        normalizeReport({
          ...report,
          sortOrder: report.sortOrder || index + 1,
          updatedBy: userEmail,
          createdBy: report.createdBy || userEmail,
        })
      );

      const validationErrors = [];
      const seenIds = new Set();

      normalized.forEach((report) => {
        validateReport(report).forEach((error) => {
          validationErrors.push(`${report.name}: ${error}`);
        });

        if (seenIds.has(report.id)) {
          validationErrors.push(
            `Reporte duplicado: ${report.name} (${report.id})`
          );
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
        userEmail,
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
      const rawReport = body.report || body;

      const incoming = normalizeReport({
        ...rawReport,
        updatedBy: userEmail,
        createdBy: rawReport.createdBy || userEmail,
      });

      const errors = validateReport(incoming);

      if (errors.length) {
        return json(400, {
          ok: false,
          errors,
        });
      }

      const reports = await readJSON(store, REPORTS_KEY, []);
      const existing = Array.isArray(reports)
        ? reports.map(normalizeReport)
        : [];
      const previousId = String(
        body.previousId || (method === "PATCH" ? incoming.id : "")
      ).trim();

      const duplicate = existing.find(
        (report) => report.id === incoming.id && report.id !== previousId
      );

      if (duplicate) {
        return json(400, {
          ok: false,
          errors: [`Ya existe un reporte con el mismo Report ID: ${incoming.id}`],
        });
      }

      const updated = [
        incoming,
        ...existing.filter(
          (report) => report.id !== incoming.id && report.id !== previousId
        ),
      ].sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));

      await writeJSON(store, REPORTS_KEY, updated);

      await appendAudit(store, {
        action: method === "POST" ? "create_report" : "upsert_report",
        reportId: incoming.id,
        reportName: incoming.name,
        userEmail,
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
      const existing = Array.isArray(reports)
        ? reports.map(normalizeReport)
        : [];

      const removed = existing.find((report) => report.id === reportId);
      const updated = existing.filter((report) => report.id !== reportId);

      await writeJSON(store, REPORTS_KEY, updated);

      await appendAudit(store, {
        action: "delete_report",
        reportId,
        reportName: removed?.name || "",
        userEmail,
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
