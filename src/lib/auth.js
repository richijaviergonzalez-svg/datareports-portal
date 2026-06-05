import { PublicClientApplication } from "@azure/msal-browser";

function getRedirectUri() {
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const configuredRedirectUri = import.meta.env.VITE_REDIRECT_URI || currentOrigin;
  const isPreviewOrLocal =
    currentOrigin.includes("deploy-preview-") ||
    currentOrigin.includes("localhost") ||
    currentOrigin.includes("127.0.0.1");

  return isPreviewOrLocal ? currentOrigin : configuredRedirectUri;
}

export const AUTH_CONFIG = {
  tenantId: import.meta.env.VITE_TENANT_ID || "0cd4c62a-f014-46ba-821f-a1361b7fcb06",
  clientId: import.meta.env.VITE_CLIENT_ID || "e2992f66-278a-4c4d-a65b-a84a3d0b4812",
  authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID || "0cd4c62a-f014-46ba-821f-a1361b7fcb06"}`,
  redirectUri: getRedirectUri(),
  scopes: [
    "https://analysis.windows.net/powerbi/api/Report.Read.All",
    "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
  ],
};

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "richi.gonzalez@pilarpy.onmicrosoft.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

let msalInstance = null;

export function isAdmin(email) {
  return ADMIN_EMAILS.includes((email || "").toLowerCase());
}

export function buildUserFromAccount(account) {
  return {
    name: account.name || account.username,
    email: account.username,
    role: isAdmin(account.username) ? "Administrador BI" : "Usuario BI",
    avatar: (account.name || "U").split(" ").map((name) => name[0]).join("").substring(0, 2).toUpperCase(),
  };
}

export async function getMsalInstance() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: AUTH_CONFIG.clientId,
        authority: AUTH_CONFIG.authority,
        redirectUri: AUTH_CONFIG.redirectUri,
        navigateToLoginRequestUrl: false,
      },
      cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false },
    });
    await msalInstance.initialize();
  }

  return msalInstance;
}

export async function msalLogin() {
  const instance = await getMsalInstance();
  const redirectResponse = await instance.handleRedirectPromise().catch(() => null);
  const account = redirectResponse?.account || instance.getAllAccounts()[0];

  if (account) {
    instance.setActiveAccount(account);
    return account;
  }

  await instance.loginRedirect({ scopes: AUTH_CONFIG.scopes });
  return null;
}

export async function getAccessToken() {
  const instance = await getMsalInstance();
  const accounts = [instance.getActiveAccount(), ...instance.getAllAccounts()].filter(Boolean);

  if (accounts.length === 0) {
    throw new Error("Sesion expirada. Por favor, inicia sesion nuevamente.");
  }

  try {
    const response = await instance.acquireTokenSilent({
      scopes: AUTH_CONFIG.scopes,
      account: accounts[0],
    });
    return response.accessToken;
  } catch (error) {
    try {
      const response = await instance.acquireTokenPopup({ scopes: AUTH_CONFIG.scopes });
      return response.accessToken;
    } catch (popupError) {
      throw new Error("No se pudo renovar la sesion. Por favor, cerra sesion y volve a iniciar.");
    }
  }
}

export async function getCurrentUser() {
  const instance = await getMsalInstance();
  const redirectResponse = await instance.handleRedirectPromise().catch(() => null);
  const accounts = [
    redirectResponse?.account,
    instance.getActiveAccount(),
    ...instance.getAllAccounts(),
  ].filter(Boolean);

  if (!accounts.length) return null;

  const account = accounts[0];
  instance.setActiveAccount(account);
  return buildUserFromAccount(account);
}
