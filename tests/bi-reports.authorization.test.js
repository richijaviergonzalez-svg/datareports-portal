const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler } = require("../netlify/functions/bi-reports");
const { getClaimEmails, normalizeEmail } = require("../netlify/functions/_auth");

const UUIDS = {
  public: "11111111-1111-4111-8111-111111111111",
  matching: "22222222-2222-4222-8222-222222222222",
  private: "33333333-3333-4333-8333-333333333333",
  draft: "44444444-4444-4444-8444-444444444444",
  admin: "55555555-5555-4555-8555-555555555555",
  alias: "66666666-6666-4666-8666-666666666666",
};

function createStore(reports = []) {
  const values = new Map([["reports.json", reports]]);
  return {
    writes: 0,
    lastReadOptions: null,
    async get(key, options) { this.lastReadOptions = options; return values.get(key); },
    async setJSON(key, value) { this.writes += 1; values.set(key, value); },
  };
}

function report(id, overrides = {}) {
  return {
    id,
    name: `Reporte ${id.slice(0, 4)}`,
    status: "live",
    visibilityMode: "all",
    ...overrides,
  };
}

test("rechaza una llamada directa sin autenticación", async () => {
  const handler = createHandler({
    authenticate: async () => ({ ok: false, statusCode: 401, error: "Falta token Bearer." }),
    getReportsStore: () => createStore(),
  });
  const response = await handler({ httpMethod: "GET", headers: {} });
  assert.equal(response.statusCode, 401);
});

test("un usuario autenticado recibe solo reportes publicados y autorizados", async () => {
  const store = createStore([
    report(UUIDS.public),
    report(UUIDS.matching, { visibilityMode: "emails", allowedEmails: ["retail@pilarpy.onmicrosoft.com"] }),
    report(UUIDS.private, { visibilityMode: "emails", allowedEmails: ["otra@pilarpy.onmicrosoft.com"] }),
    report(UUIDS.draft, { status: "draft" }),
    report(UUIDS.admin, { visibilityMode: "admins" }),
  ]);
  const handler = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "retail@pilarpy.onmicrosoft.com", isAdmin: false }),
    getReportsStore: () => store,
  });
  const response = await handler({ httpMethod: "GET", headers: {}, queryStringParameters: {} });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.reports.map((item) => item.id).sort(), [UUIDS.matching, UUIDS.public].sort());
  assert.equal(store.lastReadOptions.type, "json");
  assert.equal(body.runtime, "lambda-edge");
  assert.match(body.catalogRevision, /^[a-f0-9]{16}$/);
});

test("el catálogo descarta IDs duplicados y conserva la versión más reciente", async () => {
  const store = createStore([
    report(UUIDS.public, { name: "Nombre anterior", version: "1.0", updatedAt: "2026-08-01T10:00:00.000Z" }),
    report(UUIDS.public, { name: "Nombre vigente", version: "2.0", updatedAt: "2026-09-01T10:00:00.000Z" }),
    report(UUIDS.matching, { name: "Otro reporte", updatedAt: "2026-09-01T09:00:00.000Z" }),
  ]);
  const handler = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "retail@pilarpy.onmicrosoft.com", isAdmin: false }),
    getReportsStore: () => store,
  });

  const response = await handler({ httpMethod: "GET", headers: {}, queryStringParameters: {} });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.totalReports, 2);
  assert.equal(body.visibleReports, 2);
  assert.equal(body.catalogDuplicatesRemoved, 1);
  assert.equal(body.reports.find((item) => item.id === UUIDS.public).name, "Nombre vigente");
  assert.equal(body.reports.find((item) => item.id === UUIDS.public).version, "2.0");
});

test("un usuario no administrador no puede modificar el catálogo llamando la función", async () => {
  const store = createStore([report(UUIDS.public)]);
  const handler = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "retail@pilarpy.onmicrosoft.com", isAdmin: false }),
    getReportsStore: () => store,
  });
  const response = await handler({ httpMethod: "PUT", headers: {}, body: JSON.stringify({ reports: [] }) });
  assert.equal(response.statusCode, 403);
  assert.equal(store.writes, 0);
});

test("una actualización atómica conserva el catálogo y autoriza al usuario", async () => {
  const store = createStore([
    report(UUIDS.public),
    report(UUIDS.matching, {
      visibilityMode: "emails",
      allowedEmails: ["admin@pilarpy.onmicrosoft.com"],
    }),
  ]);
  const adminHandler = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "admin@pilarpy.onmicrosoft.com", isAdmin: true }),
    getReportsStore: () => store,
  });

  const saveResponse = await adminHandler({
    httpMethod: "PATCH",
    headers: {},
    body: JSON.stringify({
      report: report(UUIDS.matching, {
          visibilityMode: "emails",
          allowedEmails: ["Lorena Caballero < Lorena.Caballero\u200B@PilarPy.onmicrosoft.com >"],
        }),
      previousId: UUIDS.matching,
    }),
  });
  const savedBody = JSON.parse(saveResponse.body);

  assert.equal(saveResponse.statusCode, 200);
  assert.equal(savedBody.reports.length, 2);
  assert.deepEqual(savedBody.report.allowedEmails, [
    "lorena.caballero@pilarpy.onmicrosoft.com",
  ]);

  // Simula que una copia anterior del catálogo completo reaparece después del guardado.
  await store.setJSON("reports.json", [
    report(UUIDS.public),
    report(UUIDS.matching, {
      visibilityMode: "emails",
      allowedEmails: ["admin@pilarpy.onmicrosoft.com"],
    }),
  ]);

  const lorenaHandler = createHandler({
    authenticate: async () => ({
      ok: true,
      userEmail: "lorena.caballero@pilarpy.onmicrosoft.com",
      isAdmin: false,
    }),
    getReportsStore: () => store,
  });
  const readResponse = await lorenaHandler({
    httpMethod: "GET",
    headers: {},
    queryStringParameters: {},
  });
  const readBody = JSON.parse(readResponse.body);

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readBody.visibleReports, 2);
  assert.deepEqual(readBody.reports.map((item) => item.id).sort(), [UUIDS.matching, UUIDS.public].sort());
});

test("autoriza reportes asignados a un alias firmado de la misma cuenta", async () => {
  const store = createStore([
    report(UUIDS.public),
    report(UUIDS.alias, {
      visibilityMode: "emails",
      allowedEmails: ["lorena.caballero@pilarpy.onmicrosoft.com"],
    }),
  ]);
  const handler = createHandler({
    authenticate: async () => ({
      ok: true,
      userEmail: "lorena@pilarpy.onmicrosoft.com",
      userEmails: [
        "lorena@pilarpy.onmicrosoft.com",
        "lorena.caballero@pilarpy.onmicrosoft.com",
      ],
      isAdmin: false,
    }),
    getReportsStore: () => store,
  });

  const response = await handler({ httpMethod: "GET", headers: {}, queryStringParameters: {} });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.reports.map((item) => item.id).sort(), [UUIDS.alias, UUIDS.public].sort());
  assert.deepEqual(body.userEmails, [
    "lorena@pilarpy.onmicrosoft.com",
    "lorena.caballero@pilarpy.onmicrosoft.com",
  ]);
});

test("normaliza los correos alternativos presentes en el token de Microsoft", () => {
  assert.deepEqual(getClaimEmails({
    preferred_username: " Lorena@PilarPy.onmicrosoft.com ",
    upn: "lorena.caballero@pilarpy.onmicrosoft.com",
    email: "lorena@pilarpy.onmicrosoft.com",
  }), [
    "lorena@pilarpy.onmicrosoft.com",
    "lorena.caballero@pilarpy.onmicrosoft.com",
  ]);
});

test("elimina caracteres invisibles de una identidad firmada", () => {
  assert.equal(
    normalizeEmail("Lorena Caballero < Lorena.Caballero\u200B@PilarPy.onmicrosoft.com >"),
    "lorena.caballero@pilarpy.onmicrosoft.com"
  );
});

test("la vista de permisos del admin se calcula en el backend", async () => {
  const store = createStore([
    report(UUIDS.public),
    report(UUIDS.matching, { visibilityMode: "emails", allowedEmails: ["lorena.caballero@pilarpy.onmicrosoft.com"] }),
    report(UUIDS.private, { visibilityMode: "emails", allowedEmails: ["otra@pilarpy.onmicrosoft.com"] }),
  ]);
  const handler = createHandler({
    runtime: "modern-strong",
    authenticate: async () => ({ ok: true, userEmail: "admin@pilarpy.onmicrosoft.com", isAdmin: true }),
    getReportsStore: () => store,
  });

  const response = await handler({
    httpMethod: "GET",
    headers: {},
    queryStringParameters: { previewEmail: "Lorena.Caballero@PilarPy.onmicrosoft.com" },
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.runtime, "modern-strong");
  assert.equal(body.previewEmail, "lorena.caballero@pilarpy.onmicrosoft.com");
  assert.deepEqual(body.evaluatedEmails, ["lorena.caballero@pilarpy.onmicrosoft.com"]);
  assert.deepEqual(body.authorizationSummary, { "all-users": 1, "email-match": 1, "email-mismatch": 1 });
  assert.deepEqual(body.reports.map((item) => item.id).sort(), [UUIDS.matching, UUIDS.public].sort());
  assert.deepEqual(body.permissionDiagnostics.map((item) => ({ id: item.id, visible: item.visible, reason: item.reason })), [
    { id: UUIDS.public, visible: true, reason: "all-users" },
    { id: UUIDS.matching, visible: true, reason: "email-match" },
    { id: UUIDS.private, visible: false, reason: "email-mismatch" },
  ]);
  assert.deepEqual(body.permissionDiagnostics[2].allowedEmails, ["otra@pilarpy.onmicrosoft.com"]);
});

test("no expone el diagnóstico de permisos a usuarios comunes", async () => {
  const handler = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "lorena.caballero@pilarpy.onmicrosoft.com", isAdmin: false }),
    getReportsStore: () => createStore([report(UUIDS.public)]),
  });
  const response = await handler({ httpMethod: "GET", headers: {}, queryStringParameters: {} });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.permissionDiagnostics, undefined);
});

test("un usuario común no puede simular los permisos de otra persona", async () => {
  const handler = createHandler({
    authenticate: async () => ({ ok: true, userEmail: "retail@pilarpy.onmicrosoft.com", isAdmin: false }),
    getReportsStore: () => createStore([report(UUIDS.public)]),
  });

  const response = await handler({
    httpMethod: "GET",
    headers: {},
    queryStringParameters: { previewEmail: "otra@pilarpy.onmicrosoft.com" },
  });

  assert.equal(response.statusCode, 403);
});
