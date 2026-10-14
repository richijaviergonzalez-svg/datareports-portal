const { connectLambda, getStore } = require("@netlify/blobs");
const { authenticate } = require("./_auth");

const STORE_NAME = "datareports-bi";
const EXCHANGE_RATES_KEY = "portal-exchange-rates.json";
const RATE_CODES = ["USD", "BRL", "ARS", "EUR"];
const MAX_BODY_BYTES = 8 * 1024;
const MAX_HISTORY = 120;

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Authorization",
};

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function parseJsonBody(event) {
  const rawBody = event.body || "";
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return { ok: false, statusCode: 413, error: "La cotizacion supera el tamano permitido." };
  }

  try {
    return { ok: true, body: rawBody ? JSON.parse(rawBody) : {} };
  } catch (error) {
    return { ok: false, statusCode: 400, error: "El cuerpo de la solicitud no es JSON valido." };
  }
}

function getExchangeRatesStore(event) {
  connectLambda(event);
  return getStore(STORE_NAME);
}

async function readState(store) {
  try {
    const value = await store.get(EXCHANGE_RATES_KEY, { type: "json" });
    return value && typeof value === "object" ? value : { current: null, history: [] };
  } catch (error) {
    return { current: null, history: [] };
  }
}

function normalizeEffectiveDate(value) {
  const candidate = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
  const date = new Date(`${candidate}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === candidate
    ? candidate
    : "";
}

function normalizeRates(value = {}) {
  const rates = {};
  const errors = [];

  RATE_CODES.forEach((code) => {
    const amount = Number(value[code]);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      errors.push(`La cotizacion ${code} debe ser un numero mayor a cero.`);
      return;
    }
    rates[code] = Math.round(amount * 100) / 100;
  });

  return { rates, errors };
}

function normalizeStoredQuotation(value) {
  if (!value || typeof value !== "object") return null;
  const effectiveDate = normalizeEffectiveDate(value.effectiveDate);
  const { rates, errors } = normalizeRates(value.rates);
  if (!effectiveDate || errors.length) return null;

  return {
    id: String(value.id || "").slice(0, 120),
    effectiveDate,
    rates,
    publishedAt: String(value.publishedAt || ""),
    publishedBy: String(value.publishedBy || "").trim().toLowerCase().slice(0, 160),
    publishedByName: String(value.publishedByName || "").trim().slice(0, 120),
  };
}

function createQuotation(body, auth, now = new Date().toISOString()) {
  const effectiveDate = normalizeEffectiveDate(body.effectiveDate);
  const { rates, errors } = normalizeRates(body.rates);
  if (!effectiveDate) errors.push("La fecha de vigencia no es valida.");
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    quotation: {
      id: `quotation-${effectiveDate}-${Date.now()}`,
      effectiveDate,
      rates,
      publishedAt: now,
      publishedBy: auth.userEmail,
      publishedByName: auth.userName || auth.userEmail,
    },
  };
}

function createHandler(dependencies = {}) {
  const authenticateRequest = dependencies.authenticate || authenticate;
  const getStoreForRequest = dependencies.getExchangeRatesStore || getExchangeRatesStore;

  return async (event) => {
    try {
      if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

      const auth = await authenticateRequest(event);
      if (!auth.ok) return json(auth.statusCode || 401, { ok: false, error: auth.error });

      const store = getStoreForRequest(event);
      const state = await readState(store);
      const current = normalizeStoredQuotation(state.current);
      const history = (Array.isArray(state.history) ? state.history : [])
        .map(normalizeStoredQuotation)
        .filter(Boolean)
        .slice(0, MAX_HISTORY);

      if (event.httpMethod === "GET") {
        return json(200, {
          ok: true,
          source: "netlify-blobs",
          canManage: auth.canManageExchangeRates === true || auth.isAdmin === true,
          current,
          history: auth.canManageExchangeRates || auth.isAdmin ? history : [],
        });
      }

      if (event.httpMethod === "PUT") {
        if (!auth.isAdmin && !auth.canManageExchangeRates) {
          return json(403, { ok: false, error: "No autorizado para publicar cotizaciones." });
        }

        const parsed = parseJsonBody(event);
        if (!parsed.ok) return json(parsed.statusCode, { ok: false, error: parsed.error });
        const created = createQuotation(parsed.body, auth);
        if (!created.ok) return json(400, { ok: false, error: created.errors.join(" "), errors: created.errors });

        const nextHistory = [created.quotation, ...history]
          .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
          .slice(0, MAX_HISTORY);

        await store.setJSON(EXCHANGE_RATES_KEY, {
          current: created.quotation,
          history: nextHistory,
        });

        return json(200, {
          ok: true,
          source: "netlify-blobs",
          canManage: true,
          current: created.quotation,
          history: nextHistory,
        });
      }

      return json(405, { ok: false, error: "Method not allowed" });
    } catch (error) {
      console.error("bi-exchange-rates function error:", error);
      return json(500, { ok: false, error: error.message || "Internal error" });
    }
  };
}

exports.RATE_CODES = RATE_CODES;
exports.createHandler = createHandler;
exports.handler = createHandler();
