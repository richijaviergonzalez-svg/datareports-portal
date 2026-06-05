const crypto = require("crypto");

const DEFAULT_TENANT_ID = "0cd4c62a-f014-46ba-821f-a1361b7fcb06";
const DEFAULT_CLIENT_ID = "e2992f66-278a-4c4d-a65b-a84a3d0b4812";
const POWER_BI_AUDIENCE = "https://analysis.windows.net/powerbi/api";

let jwksCache = {
  keys: [],
  expiresAt: 0,
};

function getTenantId() {
  return process.env.TENANT_ID || process.env.VITE_TENANT_ID || DEFAULT_TENANT_ID;
}

function getClientId() {
  return process.env.CLIENT_ID || process.env.VITE_CLIENT_ID || DEFAULT_CLIENT_ID;
}

function getAllowedAudiences() {
  return new Set(
    [process.env.API_AUDIENCE, getClientId(), POWER_BI_AUDIENCE].filter(Boolean)
  );
}

function getAdminEmails() {
  return String(
    process.env.ADMIN_EMAILS ||
      process.env.VITE_ADMIN_EMAILS ||
      "richi.gonzalez@pilarpy.onmicrosoft.com"
  )
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getHeader(event, name) {
  const requestHeaders = event.headers || {};
  const lowerName = name.toLowerCase();
  const foundKey = Object.keys(requestHeaders).find(
    (key) => key.toLowerCase() === lowerName
  );

  return foundKey ? requestHeaders[foundKey] : "";
}

function getBearerToken(event) {
  const raw = getHeader(event, "authorization");
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

function base64UrlToBuffer(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padding), "base64");
}

function decodeBase64UrlJSON(value) {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8"));
}

function parseJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("token-invalido");
  }

  return {
    header: decodeBase64UrlJSON(parts[0]),
    payload: decodeBase64UrlJSON(parts[1]),
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: parts[2],
  };
}

async function fetchJwks() {
  if (jwksCache.expiresAt > Date.now() && jwksCache.keys.length) {
    return jwksCache.keys;
  }

  const tenantId = getTenantId();
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
  );

  if (!response.ok) {
    throw new Error("jwks-no-disponible");
  }

  const data = await response.json();
  jwksCache = {
    keys: Array.isArray(data.keys) ? data.keys : [],
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return jwksCache.keys;
}

function verifySignature(jwt, jwk) {
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(jwt.signingInput);
  verifier.end();

  return verifier.verify(publicKey, base64UrlToBuffer(jwt.signature));
}

function getClaimEmail(payload) {
  return String(
    payload.preferred_username ||
      payload.upn ||
      payload.email ||
      payload.unique_name ||
      ""
  )
    .trim()
    .toLowerCase();
}

function validateClaims(payload) {
  const now = Math.floor(Date.now() / 1000);
  const tenantId = getTenantId();
  const allowedAudiences = getAllowedAudiences();
  const allowedIssuers = new Set([
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
    `https://sts.windows.net/${tenantId}/`,
  ]);

  if (payload.exp && Number(payload.exp) <= now) {
    throw new Error("token-expirado");
  }

  if (payload.nbf && Number(payload.nbf) > now + 60) {
    throw new Error("token-no-vigente");
  }

  if (payload.tid && payload.tid !== tenantId) {
    throw new Error("tenant-no-autorizado");
  }

  if (payload.iss && !allowedIssuers.has(payload.iss)) {
    throw new Error("issuer-no-autorizado");
  }

  if (!allowedAudiences.has(payload.aud)) {
    throw new Error("audience-no-autorizada");
  }

  const userEmail = getClaimEmail(payload);
  if (!userEmail) {
    throw new Error("usuario-sin-email");
  }

  return userEmail;
}

async function authenticate(event) {
  try {
    const token = getBearerToken(event);
    if (!token) {
      return { ok: false, statusCode: 401, error: "Falta token Bearer." };
    }

    const jwt = parseJwt(token);
    if (jwt.header.alg !== "RS256") {
      return { ok: false, statusCode: 401, error: "Algoritmo JWT no permitido." };
    }

    const keys = await fetchJwks();
    const jwk = keys.find((key) => key.kid === jwt.header.kid);
    if (!jwk || !verifySignature(jwt, jwk)) {
      return { ok: false, statusCode: 401, error: "Firma JWT invalida." };
    }

    const userEmail = validateClaims(jwt.payload);

    return {
      ok: true,
      claims: jwt.payload,
      userEmail,
      userName: jwt.payload.name || userEmail,
      isAdmin: getAdminEmails().includes(userEmail),
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 401,
      error: "No autorizado.",
      detail: error.message,
    };
  }
}

module.exports = {
  authenticate,
  getAdminEmails,
  getHeader,
};
