const { connectLambda, getStore } = require("@netlify/blobs");
const { createHash } = require("node:crypto");
const { authenticate } = require("./_auth");

const STORE_NAME = "datareports-bi";
const REPORTS_KEY = "reports.json";
const REPORT_PERMISSION_PREFIX = "report-permissions/";
const AUDIT_KEY = "reports-audit.json";
const HISTORY_KEY = "reports-history.json";
const HISTORY_LIMIT = 20;

function normalizeEmail(value) {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\x21-\x7E]/g, "")
    .toLowerCase();
  return cleaned.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0] || cleaned;
}

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Authorization",
};

const readHeaders = headers;

function json(statusCode, body, responseHeaders = headers) {
  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify(body),
  };
}

function getReportsStore(event) {
  connectLambda(event);
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
  return [...new Set((Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item || "").split(/[;,\n]/))
    .map((item) => normalizeEmail(item).replace(/^@/, ""))
    .filter(Boolean))];
}

function normalizeEmailList(value) {
  return [...new Set((Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item || "").split(/[;,\n]/))
    .map(normalizeEmail)
    .filter(Boolean))];
}

function normalizeVersionHistory(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => ({
      id: String(entry?.id || `release-${index}`).trim(),
      version: String(entry?.version || "").trim(),
      notes: String(entry?.notes || entry?.releaseNotes || "").trim(),
      releasedAt: String(entry?.releasedAt || entry?.publishedAt || "").trim(),
      publishedBy: String(entry?.publishedBy || entry?.updatedBy || "").trim(),
    }))
    .filter((entry) => entry.version)
    .slice(0, 20);
}

function normalizeReport(report = {}) {
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

    version: String(report.version || "").trim(),
    releaseNotes: String(report.releaseNotes || "").trim(),
    releasedAt: String(report.releasedAt || "").trim(),
    versionHistory: normalizeVersionHistory(
      report.versionHistory || report.changelog
    ),

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

    createdAt: String(report.createdAt || report.updatedAt || "").trim(),
    updatedAt: String(report.updatedAt || report.createdAt || "").trim(),
    createdBy: String(report.createdBy || "").trim(),
    updatedBy: String(report.updatedBy || "").trim(),
  };
}

function normalizeCatalog(reports = []) {
  const canonical = new Map();

  (Array.isArray(reports) ? reports : []).forEach((rawReport, index) => {
    const report = normalizeReport(rawReport);
    if (!report.id) return;

    const timestamp = Date.parse(rawReport?.updatedAt || rawReport?.createdAt || "");
    const candidate = {
      report,
      index,
      timestamp: Number.isFinite(timestamp) ? timestamp : null,
    };
    const existing = canonical.get(report.id);
    const shouldReplace = !existing
      || (candidate.timestamp !== null && existing.timestamp === null)
      || (candidate.timestamp !== null && existing.timestamp !== null && candidate.timestamp >= existing.timestamp)
      || (candidate.timestamp === null && existing.timestamp === null && candidate.index > existing.index);

    if (shouldReplace) canonical.set(report.id, candidate);
  });

  return [...canonical.values()]
    .map(({ report }) => report)
    .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
}

function normalizeIdentityEmails(userEmail, userEmails = []) {
  return [...new Set([userEmail, ...(Array.isArray(userEmails) ? userEmails : [])]
    .map(normalizeEmail)
    .filter((value) => value.includes("@")))];
}

function getCatalogRevision(reports) {
  return createHash("sha256")
    .update(JSON.stringify(normalizeCatalog(reports)))
    .digest("hex")
    .slice(0, 16);
}

function getReportAccessDecision(report, userEmail, isAdmin, userEmails = []) {
  const normalizedReport = normalizeReport(report);
  if (isAdmin) return { visible: true, reason: "admin" };
  if (normalizedReport.status === "draft") return { visible: false, reason: "draft" };
  const identityEmails = normalizeIdentityEmails(userEmail, userEmails);
  const identityDomains = identityEmails.map((email) => email.split("@").pop());

  switch (normalizedReport.visibilityMode) {
    case "admins":
      return { visible: false, reason: "admins-only" };

    case "emails":
      return normalizedReport.allowedEmails.some((email) => identityEmails.includes(email))
        ? { visible: true, reason: "email-match" }
        : { visible: false, reason: "email-mismatch" };

    case "domains":
      return normalizedReport.allowedDomains.some((domain) => identityDomains.includes(domain))
        ? { visible: true, reason: "domain-match" }
        : { visible: false, reason: "domain-mismatch" };

    case "all":
    default:
      return { visible: true, reason: "all-users" };
  }
}

function canUserSeeReport(report, userEmail, isAdmin, userEmails = []) {
  return getReportAccessDecision(report, userEmail, isAdmin, userEmails).visible;
}

async function readJSON(store, key, fallback) {
  try {
    const data = await store.get(key, { type: "json", consistency: "strong" });
    return data || fallback;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    throw error;
  }
}

async function writeJSON(store, key, data) {
  await store.setJSON(key, data);
}

function getReportPermissionKey(reportId) {
  return `${REPORT_PERMISSION_PREFIX}${reportId}.json`;
}

function normalizeReportPermission(report = {}) {
  const normalized = normalizeReport(report);
  return {
    schemaVersion: 2,
    reportId: normalized.id,
    status: normalized.status,
    visibilityMode: normalized.visibilityMode,
    allowedEmails: normalized.allowedEmails,
    allowedDomains: normalized.allowedDomains,
  };
}

async function readCatalog(store, sourceReports = null) {
  const reports = normalizeCatalog(sourceReports || await readJSON(store, REPORTS_KEY, []));
  const permissions = await Promise.all(reports.map((report) =>
    readJSON(store, getReportPermissionKey(report.id), null)
  ));

  return normalizeCatalog(reports.map((report, index) => {
    const permission = permissions[index];
    if (!permission || permission.schemaVersion !== 2 || permission.reportId !== report.id) return report;
    return {
      ...report,
      ...normalizeReportPermission({ ...report, ...permission }),
      id: report.id,
    };
  }));
}

async function writeVerifiedReportPermission(store, report) {
  const expected = normalizeReportPermission(report);
  const key = getReportPermissionKey(expected.reportId);
  await writeJSON(store, key, expected);
  const persisted = await readJSON(store, key, null);

  if (JSON.stringify(persisted) !== JSON.stringify(expected)) {
    throw new Error(`Netlify Blobs no confirmó los permisos del reporte ${expected.reportId}.`);
  }
}

async function writeVerifiedCatalog(store, reports) {
  const expected = normalizeCatalog(reports);
  await writeJSON(store, REPORTS_KEY, expected);
  await Promise.all(expected.map((report) => writeVerifiedReportPermission(store, report)));
  const persisted = await readCatalog(store);

  if (getCatalogRevision(persisted) !== getCatalogRevision(expected)) {
    throw new Error("Netlify Blobs no confirmó la escritura completa del catálogo.");
  }

  return persisted;
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

async function saveCatalogSnapshot(store, reports, metadata = {}) {
  const history = await readJSON(store, HISTORY_KEY, []);
  const snapshot = {
    id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    createdBy: String(metadata.userEmail || "").trim().toLowerCase(),
    reason: String(metadata.reason || "catalog_update").trim(),
    reportCount: Array.isArray(reports) ? reports.length : 0,
    reports: (Array.isArray(reports) ? reports : []).map(normalizeReport),
  };

  await writeJSON(store, HISTORY_KEY, [snapshot, ...(Array.isArray(history) ? history : [])].slice(0, HISTORY_LIMIT));
  return snapshot;
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

  if (report.version && !/^[a-z0-9][a-z0-9._-]{0,19}$/i.test(report.version)) {
    errors.push(
      "La versión debe tener hasta 20 caracteres y usar letras, números, puntos, guiones o guion bajo."
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

function createHandler(dependencies = {}) {
  const authenticateRequest = dependencies.authenticate || authenticate;
  const getStoreForRequest = dependencies.getReportsStore || getReportsStore;
  const runtime = dependencies.runtime || "lambda-edge";

  return async (event) => {
  try {
    const method = event.httpMethod;

    if (method === "OPTIONS") {
      return json(200, { ok: true });
    }

    const auth = await authenticateRequest(event);
    if (!auth.ok) {
      return json(auth.statusCode || 401, {
        ok: false,
        error: auth.error,
      });
    }

    const store = getStoreForRequest(event);
    const userEmail = auth.userEmail;
    const isAdmin = auth.isAdmin;

    if (method === "GET") {
      const params = event.queryStringParameters || {};
      if (params.history === "1") {
        if (!isAdmin) {
          return json(403, { ok: false, error: "No autorizado. Solo administradores pueden consultar el historial del catálogo." });
        }
        const history = await readJSON(store, HISTORY_KEY, []);
        return json(200, {
          ok: true,
          history: (Array.isArray(history) ? history : []).map(({ reports: snapshotReports, ...snapshot }) => ({
            ...snapshot,
            reportCount: snapshot.reportCount ?? snapshotReports?.length ?? 0,
          })),
        });
      }

      const rawReports = await readJSON(store, REPORTS_KEY, []);
      const normalized = await readCatalog(store, rawReports);
      const catalogDuplicatesRemoved = Math.max(0, (Array.isArray(rawReports) ? rawReports.length : 0) - normalizeCatalog(rawReports).length);
      const previewEmail = normalizeEmail(params.previewEmail);

      if (previewEmail && !isAdmin) {
        return json(403, { ok: false, error: "No autorizado. Solo administradores pueden simular permisos." });
      }

      const evaluatedEmail = previewEmail || userEmail;
      const evaluatedEmails = previewEmail ? [previewEmail] : auth.userEmails;
      const normalizedEvaluatedEmails = normalizeIdentityEmails(evaluatedEmail, evaluatedEmails);
      const evaluatedAsAdmin = previewEmail ? false : isAdmin;
      const accessDecisions = normalized.map((report) => ({
        report,
        decision: getReportAccessDecision(report, evaluatedEmail, evaluatedAsAdmin, evaluatedEmails),
      }));
      const authorizationSummary = accessDecisions.reduce((summary, { decision }) => {
        summary[decision.reason] = (summary[decision.reason] || 0) + 1;
        return summary;
      }, {});

      const visibleReports = accessDecisions
        .filter(({ decision }) => decision.visible)
        .map(({ report }) => report)
        .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));

      const permissionDiagnostics = previewEmail && isAdmin
        ? accessDecisions.map(({ report, decision }) => ({
          id: report.id,
          name: report.name,
          visible: decision.visible,
          reason: decision.reason,
          status: report.status,
          visibilityMode: report.visibilityMode,
          allowedEmails: report.visibilityMode === "emails" ? report.allowedEmails : [],
          allowedDomains: report.visibilityMode === "domains" ? report.allowedDomains : [],
        }))
        : undefined;

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        runtime,
        catalogRevision: getCatalogRevision(normalized),
        userEmail,
        userEmails: normalizeIdentityEmails(userEmail, auth.userEmails),
        evaluatedEmails: normalizedEvaluatedEmails,
        authorizationSummary,
        isAdmin,
        previewEmail: previewEmail || null,
        totalReports: normalized.length,
        visibleReports: visibleReports.length,
        catalogDuplicatesRemoved,
        reports: visibleReports,
        ...(permissionDiagnostics ? { permissionDiagnostics } : {}),
      }, readHeaders);
    }

    if (!isAdmin) {
      return json(403, {
        ok: false,
        error:
          "No autorizado. Solo administradores pueden modificar el catálogo de reportes.",
      });
    }

    const requestBody = ["PUT", "PATCH", "POST"].includes(method)
      ? JSON.parse(event.body || "{}")
      : {};

    if (method === "POST" && requestBody.action === "rollback") {
      const snapshotId = String(requestBody.snapshotId || "").trim();
      const history = await readJSON(store, HISTORY_KEY, []);
      const snapshot = (Array.isArray(history) ? history : []).find((item) => item.id === snapshotId);
      if (!snapshot) return json(404, { ok: false, error: "La versión seleccionada ya no está disponible." });

      const currentReports = await readCatalog(store);
      await saveCatalogSnapshot(store, currentReports, { userEmail, reason: "before_rollback" });
      const restored = normalizeCatalog(snapshot.reports);
      const persisted = await writeVerifiedCatalog(store, restored);
      await appendAudit(store, {
        action: "rollback_catalog",
        snapshotId,
        userEmail,
        count: restored.length,
      });

      return json(200, { ok: true, source: "netlify-blobs", restoredSnapshotId: snapshotId, reports: persisted });
    }

    if (method === "PUT") {
      const body = requestBody;
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

      if (normalized.length === 0 && body.allowEmptyCatalog !== true) {
        return json(400, {
          ok: false,
          error: "Catálogo vacío rechazado. Use allowEmptyCatalog=true solo para una limpieza intencional.",
        });
      }

      const previousReports = await readCatalog(store);
      await saveCatalogSnapshot(store, previousReports, { userEmail, reason: "replace_catalog" });
      const persisted = await writeVerifiedCatalog(store, normalized);

      await appendAudit(store, {
        action: "replace_catalog",
        userEmail,
        count: normalized.length,
      });

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        catalogRevision: getCatalogRevision(persisted),
        reports: persisted,
      });
    }

    if (method === "PATCH" || method === "POST") {
      const body = requestBody;
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

      const existing = await readCatalog(store);
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

      await saveCatalogSnapshot(store, existing, { userEmail, reason: method === "POST" ? "create_report" : "update_report" });
      const persisted = await writeVerifiedCatalog(store, updated);

      await appendAudit(store, {
        action: method === "POST" ? "create_report" : "upsert_report",
        reportId: incoming.id,
        reportName: incoming.name,
        userEmail,
      });

      return json(200, {
        ok: true,
        source: "netlify-blobs",
        report: persisted.find((report) => report.id === incoming.id) || incoming,
        catalogRevision: getCatalogRevision(persisted),
        reports: persisted,
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

      const existing = await readCatalog(store);

      const removed = existing.find((report) => report.id === reportId);
      const updated = existing.filter((report) => report.id !== reportId);

      await saveCatalogSnapshot(store, existing, { userEmail, reason: "delete_report" });
      const persisted = await writeVerifiedCatalog(store, updated);

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
        catalogRevision: getCatalogRevision(persisted),
        reports: persisted,
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
}

exports.createHandler = createHandler;
exports.handler = createHandler();
exports.__test = { canUserSeeReport, getCatalogRevision, getReportAccessDecision, normalizeCatalog, normalizeReport, validateReport };
