const crypto = require("crypto");
const { connectLambda, getStore } = require("@netlify/blobs");
const { authenticate } = require("./_auth");

const STORE_NAME = "datareports-bi";
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Authorization",
};

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function getSubscriptionStore(event) {
  connectLambda(event);
  return getStore(STORE_NAME);
}

function getUserKey(email) {
  const digest = crypto.createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex");
  return `subscriptions/${digest}.json`;
}

function normalizeReportIds(value) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter((item) => uuid.test(item)))].slice(0, 200);
}

function createHandler(dependencies = {}) {
  const authenticateRequest = dependencies.authenticate || authenticate;
  const getStoreForRequest = dependencies.getStore || getSubscriptionStore;

  return async (event) => {
    try {
      if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
      const auth = await authenticateRequest(event);
      if (!auth.ok) return json(auth.statusCode || 401, { ok: false, error: auth.error || "No autorizado." });

      const store = getStoreForRequest(event);
      const key = getUserKey(auth.userEmail);
      if (event.httpMethod === "GET") {
        const data = await store.get(key, { type: "json" });
        return json(200, { ok: true, reportIds: normalizeReportIds(data?.reportIds) });
      }

      if (event.httpMethod === "PUT") {
        const body = JSON.parse(event.body || "{}");
        const reportIds = normalizeReportIds(body.reportIds);
        await store.setJSON(key, { reportIds, updatedAt: new Date().toISOString() });
        return json(200, { ok: true, reportIds });
      }

      return json(405, { ok: false, error: "Method not allowed" });
    } catch (error) {
      console.error("bi-subscriptions function error:", error);
      return json(500, { ok: false, error: error.message || "Internal error" });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
exports.__test = { getUserKey, normalizeReportIds };
