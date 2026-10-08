const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler, getClientIp } = require("../netlify/functions/bi-audit");

function createStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async get(key) { return values.get(key); },
    async setJSON(key, value) { values.set(key, value); },
    async list({ prefix } = {}) {
      return {
        blobs: [...values.keys()]
          .filter((key) => !prefix || key.startsWith(prefix))
          .map((key) => ({ key, etag: "test" })),
        directories: [],
      };
    },
  };
}

function event(action, overrides = {}) {
  return {
    id: `audit-${action}`,
    action,
    actionLabel: action === "platform_access" ? "Acceso a la plataforma" : "Reporte abierto",
    createdAt: "2026-10-08T12:00:00.000Z",
    subjectId: action === "report_opened" ? "report-1" : "datareports-portal",
    subjectName: action === "report_opened" ? "Ventas" : "DataReports",
    subjectType: action === "report_opened" ? "report" : "system",
    sessionId: "session-test-1",
    sessionStartedAt: "2026-10-08T11:59:00.000Z",
    deviceId: "device-test-1",
    metadata: { platform: "Windows", ipAddress: "203.0.113.99" },
    ...overrides,
  };
}

const userAuth = async () => ({
  ok: true,
  userEmail: "ventas@pilarpy.onmicrosoft.com",
  userName: "Ventas",
  isAdmin: false,
});

test("prioriza la IP confiable de Netlify sobre valores enviados por el cliente", () => {
  assert.equal(getClientIp({ headers: {
    "x-nf-client-connection-ip": "181.40.10.20",
    "x-forwarded-for": "203.0.113.10, 10.0.0.1",
  } }), "181.40.10.20");
  assert.equal(getClientIp({ headers: { "x-forwarded-for": "2001:db8::1, 10.0.0.1" } }), "2001:db8::1");
  assert.equal(getClientIp({ headers: { "x-forwarded-for": "direccion-invalida" } }), "No disponible");
});

test("registra acceso y apertura en una sesion independiente con contexto de red", async () => {
  const store = createStore();
  const handler = createHandler({ authenticate: userAuth, getAuditStore: () => store });
  const request = (auditEvent) => handler({
    httpMethod: "POST",
    headers: {
      "x-nf-client-connection-ip": "181.40.10.20",
      "user-agent": "Mozilla/5.0 Chrome/140.0",
    },
    body: JSON.stringify({ event: auditEvent }),
  });

  const accessResponse = await request(event("platform_access"));
  const reportResponse = await request(event("report_opened"));
  assert.equal(accessResponse.statusCode, 200);
  assert.equal(reportResponse.statusCode, 200);

  const storedSessions = [...store.values.entries()].filter(([key]) => key.startsWith("portal-audit/sessions/"));
  assert.equal(storedSessions.length, 1);
  assert.equal(storedSessions[0][1].events.length, 2);
  assert.equal(storedSessions[0][1].events[0].ipAddress, "181.40.10.20");
  assert.equal(storedSessions[0][1].events[0].metadata.ipAddress, undefined);
  assert.match(storedSessions[0][1].events[0].userAgent, /Chrome/);
});

test("solo administradores pueden consultar el historial agrupado", async () => {
  const store = createStore();
  const writer = createHandler({ authenticate: userAuth, getAuditStore: () => store });
  await writer({
    httpMethod: "POST",
    headers: { "x-nf-client-connection-ip": "181.40.10.20" },
    body: JSON.stringify({ event: event("platform_access") }),
  });

  const forbidden = await writer({ httpMethod: "GET", headers: {} });
  assert.equal(forbidden.statusCode, 403);

  const reader = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "admin@pilarpy.onmicrosoft.com", userName: "Admin", isAdmin: true }),
    getAuditStore: () => store,
  });
  const response = await reader({ httpMethod: "GET", headers: {} });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.storageMode, "session-records");
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].actorEmail, "ventas@pilarpy.onmicrosoft.com");
  assert.equal(body.events[0].ipAddress, "181.40.10.20");
});

test("mantiene visibles los eventos del formato anterior", async () => {
  const store = createStore({
    "portal-audit.json": [event("report_opened", {
      id: "legacy-event",
      actorEmail: "legacy@pilarpy.onmicrosoft.com",
      actorName: "Cuenta anterior",
      ipAddress: "No disponible",
    })],
  });
  const handler = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "admin@pilarpy.onmicrosoft.com", isAdmin: true }),
    getAuditStore: () => store,
  });
  const response = await handler({ httpMethod: "GET", headers: {} });
  const body = JSON.parse(response.body);
  assert.equal(body.events[0].id, "legacy-event");
  assert.equal(body.events[0].actorEmail, "legacy@pilarpy.onmicrosoft.com");
});
