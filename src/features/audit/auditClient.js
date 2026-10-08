const DEVICE_KEY = "datareports-audit-device";
const SESSION_KEY = "datareports-audit-session";

function createIdentifier(prefix) {
  const randomPart = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${randomPart}`;
}

function readOrCreate(storage, key, factory) {
  try {
    const current = JSON.parse(storage.getItem(key) || "null");
    if (current?.id) return current;
    const created = factory();
    storage.setItem(key, JSON.stringify(created));
    return created;
  } catch (error) {
    return factory();
  }
}

export function getAuditClientContext() {
  const now = new Date().toISOString();
  const device = readOrCreate(localStorage, DEVICE_KEY, () => ({
    id: createIdentifier("device"),
    createdAt: now,
  }));
  const session = readOrCreate(sessionStorage, SESSION_KEY, () => ({
    id: createIdentifier("session"),
    startedAt: now,
  }));

  return {
    deviceId: device.id,
    deviceCreatedAt: device.createdAt || now,
    sessionId: session.id,
    sessionStartedAt: session.startedAt || now,
    browserLanguage: navigator.language || "",
    platform: navigator.userAgentData?.platform || navigator.platform || "",
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
  };
}
