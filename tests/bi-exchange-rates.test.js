const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler } = require("../netlify/functions/bi-exchange-rates");

function createStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async get(key) { return values.get(key); },
    async setJSON(key, value) { values.set(key, value); },
  };
}

function request(handler, method, body) {
  return handler({
    httpMethod: method,
    headers: {},
    body: body === undefined ? "" : JSON.stringify(body),
  });
}

const quotation = {
  effectiveDate: "2026-10-14",
  rates: { USD: 7120, BRL: 1240, ARS: 6.2, EUR: 7650 },
};

test("usuarios autenticados pueden consultar solamente la cotizacion vigente", async () => {
  const store = createStore({
    "portal-exchange-rates.json": {
      current: {
        id: "quotation-1",
        ...quotation,
        publishedAt: "2026-10-14T11:15:00.000Z",
        publishedBy: "finanzas@pilarpy.onmicrosoft.com",
        publishedByName: "Finanzas",
      },
      history: [],
    },
  });
  const handler = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "tiendas@pilarpy.onmicrosoft.com", isAdmin: false }),
    getExchangeRatesStore: () => store,
  });

  const response = await request(handler, "GET");
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.current.rates.USD, 7120);
  assert.equal(body.canManage, false);
  assert.deepEqual(body.history, []);
});

test("Finanzas puede publicar cuatro monedas y consultar el historial", async () => {
  const store = createStore();
  const handler = createHandler({
    authenticate: async () => ({
      ok: true,
      userEmail: "finanzas@pilarpy.onmicrosoft.com",
      userName: "Finanzas",
      isAdmin: false,
      canManageExchangeRates: true,
    }),
    getExchangeRatesStore: () => store,
  });

  const savedResponse = await request(handler, "PUT", quotation);
  const saved = JSON.parse(savedResponse.body);
  assert.equal(savedResponse.statusCode, 200);
  assert.equal(saved.current.rates.ARS, 6.2);
  assert.equal(saved.current.publishedBy, "finanzas@pilarpy.onmicrosoft.com");
  assert.equal(saved.history.length, 1);

  const getResponse = await request(handler, "GET");
  const result = JSON.parse(getResponse.body);
  assert.equal(result.canManage, true);
  assert.equal(result.history.length, 1);
});

test("usuarios comunes no pueden publicar cotizaciones", async () => {
  const handler = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "tiendas@pilarpy.onmicrosoft.com", isAdmin: false }),
    getExchangeRatesStore: () => createStore(),
  });

  const response = await request(handler, "PUT", quotation);
  assert.equal(response.statusCode, 403);
});

test("rechaza publicaciones incompletas o con valores invalidos", async () => {
  const handler = createHandler({
    authenticate: async () => ({
      ok: true,
      userEmail: "finanzas@pilarpy.onmicrosoft.com",
      isAdmin: false,
      canManageExchangeRates: true,
    }),
    getExchangeRatesStore: () => createStore(),
  });

  const response = await request(handler, "PUT", {
    effectiveDate: "2026-10-14",
    rates: { USD: 7120, BRL: 0, ARS: 6.2 },
  });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 400);
  assert.match(body.error, /BRL/);
  assert.match(body.error, /EUR/);
});
