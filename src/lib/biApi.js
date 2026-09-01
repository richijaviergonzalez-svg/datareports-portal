const REPORTS_ENDPOINT = "/.netlify/functions/bi-reports";
const REQUESTS_ENDPOINT = "/.netlify/functions/bi-requests";
const AUDIT_ENDPOINT = "/.netlify/functions/bi-audit";
const INCIDENTS_ENDPOINT = "/.netlify/functions/bi-incidents";
const SUBSCRIPTIONS_ENDPOINT = "/.netlify/functions/bi-subscriptions";

async function buildAuthHeaders(getAccessToken, extra = {}) {
  const token = await getAccessToken();
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}

async function readJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errors = Array.isArray(data.errors) ? data.errors.join(" ") : "";
    throw new Error(data.error || errors || fallbackMessage);
  }

  return data;
}

export async function fetchReportsCatalog({ getAccessToken }) {
  const response = await fetch(REPORTS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    headers: await buildAuthHeaders(getAccessToken, {
      Accept: "application/json",
    }),
  });

  return readJson(response, "shared-reports-unavailable");
}

export async function saveReportsCatalog({ getAccessToken, reports, user }) {
  const response = await fetch(REPORTS_ENDPOINT, {
    method: "PUT",
    headers: await buildAuthHeaders(getAccessToken, {
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({ reports, user }),
  });

  return readJson(response, "No se pudo sincronizar el catalogo");
}

export async function fetchReportsHistory({ getAccessToken }) {
  const response = await fetch(`${REPORTS_ENDPOINT}?history=1`, {
    method: "GET",
    headers: await buildAuthHeaders(getAccessToken, { Accept: "application/json" }),
  });
  return readJson(response, "No se pudo consultar el historial del catálogo");
}

export async function rollbackReportsCatalog({ getAccessToken, snapshotId }) {
  const response = await fetch(REPORTS_ENDPOINT, {
    method: "POST",
    headers: await buildAuthHeaders(getAccessToken, {
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({ action: "rollback", snapshotId }),
  });
  return readJson(response, "No se pudo restaurar la versión seleccionada");
}

export async function fetchReportSubscriptions({ getAccessToken }) {
  const response = await fetch(SUBSCRIPTIONS_ENDPOINT, {
    method: "GET",
    headers: await buildAuthHeaders(getAccessToken, { Accept: "application/json" }),
  });
  return readJson(response, "No se pudieron consultar las suscripciones");
}

export async function saveReportSubscriptions({ getAccessToken, reportIds }) {
  const response = await fetch(SUBSCRIPTIONS_ENDPOINT, {
    method: "PUT",
    headers: await buildAuthHeaders(getAccessToken, {
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({ reportIds }),
  });
  return readJson(response, "No se pudieron guardar las suscripciones");
}

export async function fetchBiRequests({ getAccessToken }) {
  const response = await fetch(REQUESTS_ENDPOINT, {
    method: "GET",
    headers: await buildAuthHeaders(getAccessToken, {
      Accept: "application/json",
    }),
  });

  return readJson(response, "shared-requests-unavailable");
}

export async function createBiRequest({ getAccessToken, request }) {
  const response = await fetch(REQUESTS_ENDPOINT, {
    method: "POST",
    headers: await buildAuthHeaders(getAccessToken, {
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({ request }),
  });

  return readJson(response, "request-sync-failed");
}

export async function updateBiRequestStatus({ getAccessToken, requestId, status, priority, adminNote }) {
  const payload = { requestId };
  if (status !== undefined) payload.status = status;
  if (priority !== undefined) payload.priority = priority;
  if (adminNote !== undefined) payload.adminNote = adminNote;

  const response = await fetch(REQUESTS_ENDPOINT, {
    method: "PATCH",
    headers: await buildAuthHeaders(getAccessToken, {
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return readJson(response, "status-sync-failed");
}

export async function fetchBiAuditEvents({ getAccessToken }) {
  const response = await fetch(AUDIT_ENDPOINT, {
    method: "GET",
    headers: await buildAuthHeaders(getAccessToken, {
      Accept: "application/json",
    }),
  });

  return readJson(response, "shared-audit-unavailable");
}

export async function createBiAuditEvent({ getAccessToken, event }) {
  const response = await fetch(AUDIT_ENDPOINT, {
    method: "POST",
    headers: await buildAuthHeaders(getAccessToken, {
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({ event }),
  });

  return readJson(response, "audit-sync-failed");
}

export async function fetchBiIncidents({ getAccessToken }) {
  const response = await fetch(INCIDENTS_ENDPOINT, {
    method: "GET",
    headers: await buildAuthHeaders(getAccessToken, {
      Accept: "application/json",
    }),
  });

  return readJson(response, "shared-incidents-unavailable");
}

export async function saveBiIncidents({ getAccessToken, incidents }) {
  const response = await fetch(INCIDENTS_ENDPOINT, {
    method: "PUT",
    headers: await buildAuthHeaders(getAccessToken, {
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({ incidents }),
  });

  return readJson(response, "incident-sync-failed");
}
