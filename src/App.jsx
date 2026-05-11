import React, { useState, useEffect, useCallback } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import * as pbi from "powerbi-client";

/*
╔══════════════════════════════════════════════════════════════╗
║  DATAREPORTS PORTAL v3 — Manufactura de Pilar S.A.          ║
║  Con Panel de Administración integrado                       ║
║  Persistencia via window.storage API                         ║
╚══════════════════════════════════════════════════════════════╝
*/

const CONFIG = {
  tenantId: import.meta.env.VITE_TENANT_ID || "0cd4c62a-f014-46ba-821f-a1361b7fcb06",
  clientId: import.meta.env.VITE_CLIENT_ID || "e2992f66-278a-4c4d-a65b-a84a3d0b4812",
  authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID || "0cd4c62a-f014-46ba-821f-a1361b7fcb06"}`,
  redirectUri: import.meta.env.VITE_REDIRECT_URI || "https://datareports-pilar.netlify.app",
  scopes: [
    "https://analysis.windows.net/powerbi/api/Report.Read.All",
    "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
  ],
};

// Emails de administradores que pueden acceder al panel admin
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "richi.gonzalez@pilarpy.onmicrosoft.com").split(",").map(e => e.trim().toLowerCase());

const isAdmin = (email) => ADMIN_EMAILS.includes((email || "").toLowerCase());

const DEFAULT_REPORTS = [
  { id: "d48d43aa-2b9a-4b72-8607-b3ed143d130a", groupId: "a4ea35c6-d88d-4537-9599-29515db688fa", name: "Comparativo de Ventas por Familia", category: "Abastecimiento", icon: "boxes", status: "live", description: "Análisis comparativo de ventas desglosado por familia de productos con tendencias y variaciones." },
  { id: "7620e442-af45-4c95-a10f-1a6d624cde18", groupId: "573730aa-3deb-4c17-aa99-a3ff4dbdd2fd", name: "Ventas Canales", category: "Comercial", icon: "chart-bar", status: "live", description: "Performance de ventas por canal de distribución con métricas de volumen y rentabilidad." },
  { id: "e7a9faec-d675-4fb6-997f-c4fd7ee33c87", groupId: "00f55da6-ed76-4108-8cb6-71f20df60e27", name: "Ventas vs Metas", category: "Retail", icon: "gauge", status: "live", description: "Seguimiento de ventas retail contra objetivos establecidos con indicadores de cumplimiento." },
];

const T = { teal: "#0D9488", tealLight: "#5EEAD4", tealDark: "#065F46", tealBg: "#F0FDFA" };
const darkTheme = { bg: "#0F1117", bgCard: "#181B23", bgSurface: "#1E222D", bgHover: "#252A36", border: "#2A2F3C", borderLight: "#353B4A", text: "#E8ECF4", textSecondary: "#8B93A7", textMuted: "#5C6478" };
const lightTheme = { bg: "#F7F8FA", bgCard: "#FFFFFF", bgSurface: "#F1F3F5", bgHover: "#E9ECEF", border: "#E2E5EA", borderLight: "#EBEDF0", text: "#111318", textSecondary: "#6B7280", textMuted: "#9CA3AF" };

const ALL_CATEGORIES = ["Abastecimiento", "Comercial", "Retail", "Finanzas", "Operaciones", "Dirección", "Recursos Humanos", "Logística", "Producción", "Marketing"];
const ICON_OPTIONS = [
  { key: "chart-bar", label: "Barras" }, { key: "gauge", label: "Medidor" }, { key: "boxes", label: "Cajas" },
  { key: "funnel", label: "Embudo" }, { key: "currency", label: "Moneda" }, { key: "people", label: "Personas" },
  { key: "crown", label: "Ejecutivo" }, { key: "truck", label: "Logística" }, { key: "factory", label: "Fábrica" },
  { key: "calendar", label: "Calendario" }, { key: "cart", label: "Compras" }, { key: "invoice", label: "Factura" },
];

const categoryColors = {
  Abastecimiento: { bg: "#FFF7ED", accent: "#EA580C", darkBg: "#EA580C15", darkText: "#FB923C" },
  Comercial: { bg: "#F0FDFA", accent: "#0D9488", darkBg: "#0D948815", darkText: "#5EEAD4" },
  Retail: { bg: "#EFF6FF", accent: "#2563EB", darkBg: "#2563EB15", darkText: "#60A5FA" },
  Finanzas: { bg: "#F5F3FF", accent: "#7C3AED", darkBg: "#7C3AED15", darkText: "#A78BFA" },
  Operaciones: { bg: "#FFFBEB", accent: "#D97706", darkBg: "#D9770615", darkText: "#FBBF24" },
  Dirección: { bg: "#FDF2F8", accent: "#DB2777", darkBg: "#DB277715", darkText: "#F472B6" },
  "Recursos Humanos": { bg: "#F0FDF4", accent: "#16A34A", darkBg: "#16A34A15", darkText: "#4ADE80" },
  Logística: { bg: "#FEF2F2", accent: "#DC2626", darkBg: "#DC262615", darkText: "#F87171" },
  Producción: { bg: "#ECFDF5", accent: "#059669", darkBg: "#05966915", darkText: "#34D399" },
  Marketing: { bg: "#FFF1F2", accent: "#E11D48", darkBg: "#E11D4815", darkText: "#FB7185" },
};

const statusConfig = {
  live: { label: "Activo", lightBg: "#D1FAE5", darkBg: "#06543515", lightText: "#065F46", darkText: "#34D399" },
  draft: { label: "Borrador", lightBg: "#FEF3C7", darkBg: "#92400E15", lightText: "#92400E", darkText: "#FBBF24" },
  maintenance: { label: "En mantenimiento", lightBg: "#FEE2E2", darkBg: "#EF444415", lightText: "#991B1B", darkText: "#F87171" },
};

const StatusBadge = ({ status, dark }) => {
  const s = statusConfig[status] || statusConfig.live;
  return (
    <div style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: dark ? s.darkBg : s.lightBg, color: dark ? s.darkText : s.lightText, whiteSpace: "nowrap" }}>{s.label}</div>
  );
};

const iconPaths = {
  "chart-bar": <g><rect x="3" y="12" width="4" height="8" rx="1" fill="currentColor" opacity=".5"/><rect x="9" y="8" width="4" height="12" rx="1" fill="currentColor" opacity=".7"/><rect x="15" y="4" width="4" height="16" rx="1" fill="currentColor"/></g>,
  gauge: <g><path d="M4 16a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="12" y1="16" x2="9" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></g>,
  boxes: <g><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="3" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/></g>,
  funnel: <g><path d="M3 4h18l-5 7v5l-4 2v-7L3 4z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></g>,
  currency: <g><circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/><text x="11" y="15" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="500">$</text></g>,
  people: <g><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/></g>,
  crown: <g><path d="M3 16l3-8 4 4 4-8 4 8 3-4v8H3z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></g>,
  truck: <g><rect x="1" y="8" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M13 11h4l3 3v2h-7v-5z" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="6" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="17" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/></g>,
  factory: <g><path d="M4 20V10l5 3V8l5 3V6l5 3v11H4z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></g>,
  calendar: <g><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="4" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1.5"/><line x1="8" y1="3" x2="8" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></g>,
  cart: <g><path d="M3 3h2l2 12h10l2-8H7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="17" cy="19" r="1.5" fill="currentColor"/></g>,
  invoice: <g><rect x="5" y="2" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="9" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="15" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></g>,
};

function parseUrl(url) {
  try {
    const groupMatch = url.match(/groups\/([a-f0-9-]+)/i);
    const reportMatch = url.match(/reports\/([a-f0-9-]+)/i);
    if (groupMatch && reportMatch) return { groupId: groupMatch[1], reportId: reportMatch[1] };
    if (reportMatch) return { groupId: "", reportId: reportMatch[1] };
  } catch (e) {}
  return null;
}


// ========================
// MSAL AUTHENTICATION
// ========================

let msalInstance = null;

async function getMsalInstance() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: { clientId: CONFIG.clientId, authority: CONFIG.authority, redirectUri: CONFIG.redirectUri },
      cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false },
    });
    await msalInstance.initialize();
  }
  return msalInstance;
}

async function msalLogin() {
  const instance = await getMsalInstance();
  const response = await instance.loginPopup({ scopes: CONFIG.scopes });
  return response.account;
}

async function getAccessToken() {
  const instance = await getMsalInstance();
  const accounts = instance.getAllAccounts();
  if (accounts.length === 0) throw new Error("Sesión expirada. Por favor, iniciá sesión nuevamente.");
  try {
    const response = await instance.acquireTokenSilent({ scopes: CONFIG.scopes, account: accounts[0] });
    return response.accessToken;
  } catch (e) {
    try {
      const response = await instance.acquireTokenPopup({ scopes: CONFIG.scopes });
      return response.accessToken;
    } catch (popupError) {
      throw new Error("No se pudo renovar la sesión. Por favor, cerrá sesión y volvé a iniciar.");
    }
  }
}

// ========================
// SPARKLINE COMPONENT
// ========================
const Sparkline = ({ data, color, width = 80, height = 28 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  const isUp = data[data.length - 1] > data[0];
  const c = color || (isUp ? "#10B981" : "#EF4444");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={width} cy={parseFloat(points.split(" ").pop().split(",")[1])} r="2" fill={c}/>
    </svg>
  );
};

// ========================
// POWER BI EMBED
// ========================
const powerbiService = new pbi.service.Service(pbi.factories.hpmFactory, pbi.factories.wpmpFactory, pbi.factories.routerFactory);

function PowerBIEmbed({ report, dark }) {
  const containerId = `pbi-container-${report.id}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const embeddedRef = { current: null };

  useEffect(() => {
    let mounted = true;
    let tokenRefreshInterval = null;

    async function embed() {
      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();
        const container = document.getElementById(containerId);
        if (!container || !mounted) return;

        const models = pbi.models;
        const embedConfig = {
          type: "report",
          id: report.id,
          embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${report.id}&groupId=${report.groupId}`,
          accessToken: token,
          tokenType: models.TokenType.Aad,
          settings: {
            panes: { filters: { visible: false }, pageNavigation: { visible: true } },
            background: models.BackgroundType.Default,
            layoutType: models.LayoutType.Custom,
            customLayout: { displayOption: models.DisplayOption.FitToWidth },
          },
        };

        powerbiService.reset(container);
        const embeddedReport = powerbiService.embed(container, embedConfig);
        embeddedRef.current = embeddedReport;

        embeddedReport.on("loaded", () => { if (mounted) setLoading(false); });
        embeddedReport.on("error", (event) => {
          if (mounted) {
            setError("Error al cargar el reporte: " + (event?.detail?.message || "Error desconocido"));
            setLoading(false);
          }
        });

        // Auto-refresh token cada 45 minutos para evitar expiración
        tokenRefreshInterval = setInterval(async () => {
          try {
            const newToken = await getAccessToken();
            if (embeddedRef.current) {
              await embeddedRef.current.setAccessToken(newToken);
            }
          } catch (e) {
            console.warn("Token refresh failed:", e);
          }
        }, 45 * 60 * 1000);

      } catch (e) {
        if (mounted) {
          setError("Error de autenticación: " + e.message);
          setLoading(false);
        }
      }
    }
    embed();
    return () => {
      mounted = false;
      if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);
    };
  }, [report.id, report.groupId, retryCount]);

  const handleRetry = () => { setRetryCount(c => c + 1); };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: dark ? "#0D0F14" : "#F9FAFB", zIndex: 5 }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${dark ? "#2A2F3C" : "#E5E7EB"}`, borderTopColor: "#0D9488", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 16 }}/>
          <p style={{ fontSize: 13, color: dark ? "#8B93A7" : "#6B7280" }}>Cargando reporte...</p>
          <p style={{ fontSize: 11, color: dark ? "#5C6478" : "#9CA3AF", marginTop: 4 }}>{report.name}</p>
        </div>
      )}
      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: dark ? "#0D0F14" : "#F9FAFB", zIndex: 5 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ color: "#EF4444", marginBottom: 12 }}><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" fill="none"/><line x1="24" y1="14" x2="24" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="34" r="2" fill="currentColor"/></svg>
          <p style={{ fontSize: 13, color: "#EF4444", fontWeight: 500 }}>Error al cargar</p>
          <p style={{ fontSize: 11, color: dark ? "#5C6478" : "#9CA3AF", marginTop: 4, maxWidth: 400, textAlign: "center" }}>{error}</p>
          <button onClick={handleRetry} style={{ marginTop: 16, padding: "8px 24px", borderRadius: 12, border: `1px solid ${dark ? "#2A2F3C" : "#E5E7EB"}`, background: dark ? "#1E222D" : "#FFFFFF", color: "#0D9488", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      )}
      <div id={containerId} style={{ width: "100%", height: "100%", minHeight: 500 }}/>
    </div>
  );
}
const Logo = ({ size = "normal", dark }) => {
  const s = size === "small" ? 0.55 : 1;
  const tc = dark ? darkTheme.text : "#1a1a1a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 * s }}>
      <svg width={52 * s} height={52 * s} viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="28" fill="none" stroke={T.teal} strokeWidth="3"/>
        <path d="M14 38 L24 28 L32 34 L46 18" fill="none" stroke={T.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="14" cy="38" r="2.5" fill={T.tealLight}/><circle cx="24" cy="28" r="2.5" fill={T.tealLight}/>
        <circle cx="32" cy="34" r="2.5" fill={T.tealLight}/><circle cx="46" cy="18" r="2.5" fill={T.tealLight}/>
        <path d="M46 18 L50 14" fill="none" stroke={T.teal} strokeWidth="2.5" strokeLinecap="round"/>
        <polygon points="52,8 56,16 48,16" fill={T.teal}/>
      </svg>
      <div>
        <div style={{ fontSize: 20 * s, fontWeight: 400, color: tc, letterSpacing: "-0.5px", lineHeight: 1 }}>data<span style={{ fontWeight: 600, color: T.teal }}>reports</span></div>
        {size !== "small" && <div style={{ fontSize: 8.5, color: dark ? darkTheme.textMuted : "#999", letterSpacing: 3, marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>INTELLIGENCE PLATFORM</div>}
      </div>
    </div>
  );
};

function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);
  const [loginError, setLoginError] = useState(null);
  const handleLogin = async () => {
    setLoading(true);
    setLoginError(null);
    try {
      const account = await msalLogin();
      onLogin({
        name: account.name || account.username,
        email: account.username,
        role: isAdmin(account.username) ? "Administrador BI" : "Usuario BI",
        avatar: (account.name || "U").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase(),
      });
    } catch (e) {
      setLoginError(e.message || "Error al iniciar sesión");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Outfit', system-ui", background: "#0F1117" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes glow { 0%,100% { opacity:.3; } 50% { opacity:.6; } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        @media (max-width: 768px) { .login-left { display: none !important; } .login-right { width: 100% !important; border-left: none !important; padding: 32px 24px !important; } }
      `}</style>
      <div className="login-left" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 60, position: "relative", overflow: "hidden", background: "linear-gradient(160deg, #0F1117 0%, #111827 50%, #0D3330 100%)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 }}>
          {Array.from({ length: 12 }).map((_, i) => (<div key={i} style={{ position: "absolute", left: `${10+(i%4)*25}%`, top: `${10+Math.floor(i/4)*30}%`, width: 120, height: 120, borderRadius: 24, border: `1px solid ${T.teal}`, transform: `rotate(${i*15}deg)`, animation: `glow ${3+i*0.5}s ease-in-out infinite` }}/>))}
        </div>
        <div style={{ position: "relative", zIndex: 1, animation: "fadeUp .8s ease-out" }}>
          <div style={{ animation: "float 6s ease-in-out infinite", marginBottom: 40, display: "flex", justifyContent: "center" }}>
            <svg width="100" height="100" viewBox="0 0 60 60"><circle cx="30" cy="30" r="28" fill="none" stroke={T.teal} strokeWidth="2" opacity=".3"/><path d="M14 38 L24 28 L32 34 L46 18" fill="none" stroke={T.tealLight} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="14" cy="38" r="3" fill={T.tealLight}/><circle cx="24" cy="28" r="3" fill={T.tealLight}/><circle cx="32" cy="34" r="3" fill={T.tealLight}/><circle cx="46" cy="18" r="3" fill={T.tealLight}/><path d="M46 18 L50 14" fill="none" stroke={T.tealLight} strokeWidth="2.5" strokeLinecap="round"/><polygon points="52,8 56,16 48,16" fill={T.tealLight}/></svg>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 300, color: "white", textAlign: "center", letterSpacing: "-1px" }}>data<span style={{ fontWeight: 600, color: T.tealLight }}>reports</span></h1>
          <p style={{ fontSize: 10, color: T.tealLight, textAlign: "center", marginTop: 8, opacity: .6, letterSpacing: 4, fontFamily: "'JetBrains Mono', monospace" }}>INTELLIGENCE PLATFORM</p>
          <p style={{ fontSize: 13, color: "#5C7C7A", textAlign: "center", marginTop: 24 }}>Manufactura de Pilar S.A.</p>
        </div>
        <div style={{ position: "absolute", bottom: 24, textAlign: "center", width: "100%" }}>
          <span style={{ fontSize: 11, color: "#3A4A48", fontFamily: "'JetBrains Mono', monospace" }}>{time.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })} — {time.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
        </div>
      </div>
      <div className="login-right" style={{ width: 480, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 32px", background: darkTheme.bg, borderLeft: `1px solid ${darkTheme.border}` }}>
        <div style={{ animation: "fadeUp .5s ease-out .2s both" }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, color: darkTheme.text, marginBottom: 6 }}>Bienvenido</h2>
          <p style={{ fontSize: 13, color: darkTheme.textMuted, marginBottom: 32 }}>Iniciá sesión con tu cuenta corporativa</p>
          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "18px 24px", borderRadius: 16, border: `1.5px solid ${darkTheme.border}`, background: darkTheme.bgCard, cursor: loading ? "wait" : "pointer", transition: "all .25s" }}>
            {loading ? <div style={{ width: 20, height: 20, border: `2px solid ${darkTheme.border}`, borderTopColor: T.teal, borderRadius: "50%", animation: "spin .6s linear infinite" }}/> : <svg width="20" height="20" viewBox="0 0 20 20"><rect x="1" y="1" width="8" height="8" fill="#F25022"/><rect x="11" y="1" width="8" height="8" fill="#7FBA00"/><rect x="1" y="11" width="8" height="8" fill="#00A4EF"/><rect x="11" y="11" width="8" height="8" fill="#FFB900"/></svg>}
            <span style={{ fontSize: 14, fontWeight: 500, color: darkTheme.text }}>{loading ? "Conectando..." : "Iniciar sesión con Microsoft"}</span>
          </button>
          {loginError && (
            <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 12, background: "#7F1D1D20", border: "1px solid #7F1D1D40" }}>
              <p style={{ fontSize: 11, color: "#F87171" }}>{loginError}</p>
            </div>
          )}
          <div style={{ marginTop: 20, padding: "14px 20px", borderRadius: 14, background: darkTheme.bgSurface, border: `1px solid ${darkTheme.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: T.teal }}><path d="M8 1a4 4 0 0 0-4 4v3H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4z" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
              <span style={{ fontSize: 11, fontWeight: 500, color: T.teal }}>Conexión segura — pilarpy.onmicrosoft.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================
// ADMIN PANEL
// ========================
function AdminPanel({ reports, onSave, onClose, dark }) {
  const theme = dark ? darkTheme : lightTheme;
  const [list, setList] = useState(reports);
  const [editing, setEditing] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [parsed, setParsed] = useState(null);
  const [form, setForm] = useState({ name: "", category: "Comercial", icon: "chart-bar", description: "", status: "live" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 2500); };

  const handleUrlPaste = (val) => {
    setUrlInput(val);
    const p = parseUrl(val);
    setParsed(p);
  };

  const handleAdd = () => {
    if (!parsed || !form.name) return;
    const newReport = { id: parsed.reportId, groupId: parsed.groupId, ...form };
    const updated = [...list, newReport];
    setList(updated);
    onSave(updated);
    setUrlInput(""); setParsed(null);
    setForm({ name: "", category: "Comercial", icon: "chart-bar", description: "", status: "live" });
    showSuccess(`"${newReport.name}" agregado exitosamente`);
  };

  const handleEdit = (report) => {
    setEditing(report.id);
    setForm({ name: report.name, category: report.category, icon: report.icon, description: report.description, status: report.status });
  };

  const handleSaveEdit = () => {
    const updated = list.map(r => r.id === editing ? { ...r, ...form } : r);
    setList(updated);
    onSave(updated);
    setEditing(null);
    setForm({ name: "", category: "Comercial", icon: "chart-bar", description: "", status: "live" });
    showSuccess("Reporte actualizado");
  };

  const handleDelete = (id) => {
    const r = list.find(x => x.id === id);
    const updated = list.filter(x => x.id !== id);
    setList(updated);
    onSave(updated);
    setDeleteConfirm(null);
    showSuccess(`"${r?.name}" eliminado`);
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgSurface, color: theme.text, fontSize: 13, fontFamily: "'Outfit', system-ui", outline: "none" };
  const selectStyle = { ...inputStyle, cursor: "pointer", appearance: "none", WebkitAppearance: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div style={{ width: 820, maxHeight: "90vh", background: theme.bgCard, borderRadius: 24, border: `1px solid ${theme.border}`, overflow: "hidden", display: "flex", flexDirection: "column", animation: "fadeUp .3s ease-out" }}>
        {/* Header */}
        <div style={{ padding: "20px 28px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: theme.text }}>Panel de Administración</h2>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Gestionar reportes del portal DataReports</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: theme.textMuted, fontSize: 18 }}>×</button>
        </div>

        {/* Success toast */}
        {successMsg && (
          <div style={{ margin: "12px 28px 0", padding: "10px 16px", borderRadius: 12, background: dark ? "#06543520" : "#D1FAE5", border: `1px solid ${dark ? "#065F4640" : "#A7F3D0"}`, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: "#10B981" }}><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: 12, fontWeight: 500, color: dark ? "#34D399" : "#065F46" }}>{successMsg}</span>
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
          {/* ADD NEW REPORT */}
          {!editing && (
            <div style={{ marginBottom: 28, padding: 24, borderRadius: 18, background: theme.bgSurface, border: `1px solid ${theme.border}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: T.teal, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: T.teal }}><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="8" y1="5" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Agregar nuevo reporte
              </h3>

              {/* Step 1: URL */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: theme.textSecondary, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Paso 1 — Pegá la URL del reporte de Power BI</label>
                <input type="text" value={urlInput} onChange={e => handleUrlPaste(e.target.value)} placeholder="https://app.powerbi.com/groups/.../reports/..." style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}/>
                {parsed && (
                  <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: dark ? "#06543515" : "#D1FAE5", border: `1px solid ${dark ? "#065F4630" : "#A7F3D0"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: "#10B981" }}><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span style={{ fontSize: 11, fontWeight: 500, color: dark ? "#34D399" : "#065F46" }}>IDs detectados automáticamente</span>
                    </div>
                    <div style={{ fontSize: 10, color: dark ? "#5EEAD4" : "#047857", fontFamily: "'JetBrains Mono', monospace" }}>
                      Report ID: {parsed.reportId}<br/>Workspace ID: {parsed.groupId || "(no detectado — verificar URL)"}
                    </div>
                  </div>
                )}
                {urlInput && !parsed && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: dark ? "#7F1D1D20" : "#FEF2F2", border: `1px solid ${dark ? "#7F1D1D40" : "#FECACA"}` }}>
                    <span style={{ fontSize: 11, color: dark ? "#F87171" : "#991B1B" }}>URL no válida. Asegurate de copiar la URL completa desde Power BI.</span>
                  </div>
                )}
              </div>

              {/* Step 2: Details */}
              {parsed && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: theme.textSecondary, marginBottom: 10, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Paso 2 — Completá los datos del reporte</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, display: "block" }}>Nombre del reporte</label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Dashboard de Ventas" style={inputStyle}/>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, display: "block" }}>Categoría</label>
                      <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyle}>
                        {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, display: "block" }}>Descripción</label>
                    <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Breve descripción del reporte..." style={inputStyle}/>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 10, color: theme.textMuted, marginBottom: 8, display: "block" }}>Ícono</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ICON_OPTIONS.map(opt => (
                        <button key={opt.key} onClick={() => setForm({ ...form, icon: opt.key })} style={{
                          width: 48, height: 48, borderRadius: 12,
                          border: `2px solid ${form.icon === opt.key ? T.teal : theme.border}`,
                          background: form.icon === opt.key ? (dark ? T.teal + "20" : T.tealBg) : theme.bgCard,
                          cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                        }}>
                          <svg width="16" height="16" viewBox="0 0 22 22" style={{ color: form.icon === opt.key ? T.teal : theme.textMuted }}>{iconPaths[opt.key]}</svg>
                          <span style={{ fontSize: 7, color: form.icon === opt.key ? T.teal : theme.textMuted }}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleAdd} disabled={!form.name} style={{
                    width: "100%", padding: "12px 20px", borderRadius: 14, border: "none",
                    background: form.name ? T.teal : theme.border,
                    color: form.name ? "white" : theme.textMuted,
                    fontSize: 14, fontWeight: 500, cursor: form.name ? "pointer" : "not-allowed", transition: "all .2s",
                  }}>
                    Agregar reporte al portal
                  </button>
                </div>
              )}
            </div>
          )}

          {/* EDIT FORM */}
          {editing && (
            <div style={{ marginBottom: 28, padding: 24, borderRadius: 18, background: theme.bgSurface, border: `2px solid ${T.teal}40` }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: T.teal, marginBottom: 16 }}>Editando reporte</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, display: "block" }}>Nombre</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle}/>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, display: "block" }}>Categoría</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyle}>
                    {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, display: "block" }}>Descripción</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle}/>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, display: "block" }}>Estado</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ key: "live", label: "Activo", color: "#10B981", darkColor: "#34D399", lightBg: "#D1FAE5", darkBg: "#10B98115", lightText: "#065F46" },
                    { key: "draft", label: "Borrador", color: "#F59E0B", darkColor: "#FBBF24", lightBg: "#FEF3C7", darkBg: "#F59E0B15", lightText: "#92400E" },
                    { key: "maintenance", label: "En mantenimiento", color: "#EF4444", darkColor: "#F87171", lightBg: "#FEE2E2", darkBg: "#EF444415", lightText: "#991B1B" }
                  ].map(s => (
                    <button key={s.key} onClick={() => setForm({ ...form, status: s.key })} style={{
                      padding: "8px 20px", borderRadius: 10, border: `1.5px solid ${form.status === s.key ? s.color : theme.border}`,
                      background: form.status === s.key ? (dark ? s.darkBg : s.lightBg) : theme.bgCard,
                      color: form.status === s.key ? (dark ? s.darkColor : s.lightText) : theme.textMuted,
                      fontSize: 12, fontWeight: 500, cursor: "pointer",
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: theme.textMuted, marginBottom: 8, display: "block" }}>Ícono</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ICON_OPTIONS.map(opt => (
                    <button key={opt.key} onClick={() => setForm({ ...form, icon: opt.key })} style={{
                      width: 48, height: 48, borderRadius: 12, border: `2px solid ${form.icon === opt.key ? T.teal : theme.border}`,
                      background: form.icon === opt.key ? (dark ? T.teal + "20" : T.tealBg) : theme.bgCard,
                      cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 22 22" style={{ color: form.icon === opt.key ? T.teal : theme.textMuted }}>{iconPaths[opt.key]}</svg>
                      <span style={{ fontSize: 7, color: form.icon === opt.key ? T.teal : theme.textMuted }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleSaveEdit} style={{ flex: 1, padding: "12px", borderRadius: 14, border: "none", background: T.teal, color: "white", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Guardar cambios</button>
                <button onClick={() => { setEditing(null); setForm({ name: "", category: "Comercial", icon: "chart-bar", description: "", status: "live" }); }} style={{ padding: "12px 24px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.textSecondary, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* REPORT LIST */}
          <h3 style={{ fontSize: 13, fontWeight: 500, color: theme.textSecondary, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Reportes configurados ({list.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map(report => {
              const colors = categoryColors[report.category] || categoryColors.Comercial;
              return (
                <div key={report.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 16, background: theme.bgCard, border: `1px solid ${editing === report.id ? T.teal : theme.border}`, transition: "all .2s" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[report.icon]}</svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>{report.name}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted, fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>ID: {report.id}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 500, color: dark ? colors.darkText : colors.accent, background: dark ? colors.darkBg : colors.bg, padding: "3px 10px", borderRadius: 8 }}>{report.category}</span>
                  <StatusBadge status={report.status} dark={dark}/>
                  <button onClick={() => handleEdit(report)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textSecondary }}><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>
                  </button>
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setDeleteConfirm(deleteConfirm === report.id ? null : report.id)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: "#EF4444" }}><path d="M3 4h10M5.5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1m1.5 0l-.5 9a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1L4 4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
                    </button>
                    {deleteConfirm === report.id && (
                      <div style={{ position: "absolute", top: 38, right: 0, width: 220, padding: 16, borderRadius: 14, background: theme.bgCard, border: `1px solid ${theme.border}`, boxShadow: `0 8px 24px ${dark ? "rgba(0,0,0,.4)" : "rgba(0,0,0,.1)"}`, zIndex: 10 }}>
                        <p style={{ fontSize: 12, color: theme.text, marginBottom: 10 }}>¿Eliminar "{report.name}"?</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleDelete(report.id)} style={{ flex: 1, padding: "8px", borderRadius: 10, border: "none", background: "#EF4444", color: "white", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Eliminar</button>
                          <button onClick={() => setDeleteConfirm(null)} style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.textSecondary, fontSize: 12, cursor: "pointer" }}>No</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================
// GLOBAL CSS ANIMATIONS
// ========================
const globalStyles = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes slideInLeft { from { opacity:0; transform:translateX(-20px); } to { opacity:1; transform:translateX(0); } }
@keyframes slideInRight { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
@keyframes spin { to { transform:rotate(360deg); } }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
@keyframes scaleIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
@keyframes breathe { 0%,100% { box-shadow: 0 0 0 0 rgba(13,148,136,0); } 50% { box-shadow: 0 0 0 6px rgba(13,148,136,0.08); } }
* { box-sizing:border-box; margin:0; padding:0; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .sidebar-responsive { display: none !important; }
  .main-content-responsive { margin-left: 0 !important; }
  .mobile-menu-btn { display: flex !important; }
  .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
  .reports-grid { grid-template-columns: 1fr !important; }
  .welcome-time { display: none !important; }
  .topbar-search { display: none !important; }
  .metrics-grid { grid-template-columns: 1fr !important; }
}
@media (min-width: 769px) {
  .mobile-menu-btn { display: none !important; }
}
`;

// ========================
// SIDEBAR COMPONENT
// ========================
function Sidebar({ dark, collapsed, setCollapsed, activeView, setActiveView, categories, activeCategory, setActiveCategory, reports, favorites, user, onLogout, isUserAdmin }) {
  const theme = dark ? darkTheme : lightTheme;
  const w = collapsed ? 68 : 260;

  const navItems = [
    { id: "dashboard", icon: <svg width="18" height="18" viewBox="0 0 16 16"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>, label: "Dashboard" },
    { id: "favorites", icon: <svg width="18" height="18" viewBox="0 0 16 16"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>, label: "Favoritos", count: favorites.length },
    { id: "recent", icon: <svg width="18" height="18" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>, label: "Recientes" },
    ...(isUserAdmin ? [{ id: "metrics", icon: <svg width="18" height="18" viewBox="0 0 16 16"><path d="M2 14l4-5 3 2 5-7" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>, label: "Métricas" }] : []),
  ];

  return (
    <div className="sidebar-responsive" style={{
      width: w, minHeight: "100vh", background: theme.bgCard, borderRight: `1px solid ${theme.border}`,
      display: "flex", flexDirection: "column", transition: "width .3s cubic-bezier(.4,0,.2,1)",
      position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 30, overflow: "hidden",
    }}>
      {/* Logo + collapse */}
      <div style={{ padding: collapsed ? "16px 12px" : "16px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", minHeight: 64 }}>
        {!collapsed && <Logo size="small" dark={dark}/>}
        <button onClick={() => setCollapsed(!collapsed)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textMuted, transition: "transform .3s", transform: collapsed ? "rotate(180deg)" : "none" }}><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Nav items */}
      <div style={{ padding: collapsed ? "12px 8px" : "12px 14px", flex: 1 }}>
        {!collapsed && <p style={{ fontSize: 10, fontWeight: 500, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, padding: "0 8px" }}>Navegación</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(item => {
            const active = activeView === item.id;
            return (
              <button key={item.id} onClick={() => setActiveView(item.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "10px" : "10px 12px",
                borderRadius: 10, border: "none", width: "100%", justifyContent: collapsed ? "center" : "flex-start",
                background: active ? (dark ? T.teal + "18" : T.tealBg) : "transparent",
                color: active ? T.teal : theme.textSecondary,
                cursor: "pointer", transition: "all .2s", fontSize: 13, fontWeight: active ? 500 : 400,
              }}>
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.count > 0 && <span style={{ marginLeft: "auto", fontSize: 10, background: dark ? T.teal + "20" : T.tealBg, color: T.teal, padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>{item.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Categories */}
        {!collapsed && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 500, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, padding: "0 8px" }}>Categorías</p>
            {categories.filter(c => c !== "Todos").map(cat => {
              const colors = categoryColors[cat] || categoryColors.Comercial;
              const active = activeCategory === cat;
              return (
                <button key={cat} onClick={() => { setActiveCategory(active ? "Todos" : cat); setActiveView("dashboard"); }} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8,
                  border: "none", width: "100%", background: active ? (dark ? colors.darkBg : colors.bg) : "transparent",
                  color: active ? (dark ? colors.darkText : colors.accent) : theme.textMuted,
                  cursor: "pointer", fontSize: 12, transition: "all .2s", textAlign: "left",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: dark ? colors.darkText : colors.accent, opacity: active ? 1 : 0.4 }}/>
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom section - user */}
      <div style={{ padding: collapsed ? "12px 8px" : "12px 14px", borderTop: `1px solid ${theme.border}` }}>
        {!collapsed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: theme.bgSurface }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${T.teal}, ${T.tealDark})`, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{user.avatar}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: theme.textMuted }}>{user.role}</div>
            </div>
            <button onClick={onLogout} title="Cerrar sesión" style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${theme.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 16 16" style={{ color: "#EF4444" }}><path d="M6 2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2m4-9l3 3-3 3m3-3H6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        ) : (
          <button onClick={onLogout} title="Cerrar sesión" style={{ width: "100%", height: 40, borderRadius: 10, border: `1px solid ${theme.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: "#EF4444" }}><path d="M6 2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2m4-9l3 3-3 3m3-3H6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ========================
// WELCOME BANNER
// ========================
function WelcomeBanner({ user, dark, reports, recentReports }) {
  const theme = dark ? darkTheme : lightTheme;
  const [time, setTime] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(i); }, []);

  const hour = time.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  const activeReports = reports.filter(r => r.status === "live").length;
  const lastReport = recentReports[0];

  return (
    <div style={{
      background: dark
        ? `linear-gradient(135deg, ${T.teal}12, ${T.tealDark}08)`
        : `linear-gradient(135deg, ${T.tealBg}, #FFFFFF)`,
      borderRadius: 20, padding: "28px 32px", marginBottom: 24,
      border: `1px solid ${dark ? T.teal + "15" : T.teal + "12"}`,
      animation: "fadeUp .5s ease-out", position: "relative", overflow: "hidden",
    }}>
      {/* Decorative circles */}
      <div style={{ position: "absolute", right: -20, top: -20, width: 140, height: 140, borderRadius: "50%", background: T.teal + "06" }}/>
      <div style={{ position: "absolute", right: 60, bottom: -30, width: 100, height: 100, borderRadius: "50%", background: T.teal + "04" }}/>

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 13, color: T.teal, fontWeight: 500, marginBottom: 4 }}>{greeting}</p>
            <h1 style={{ fontSize: 26, fontWeight: 500, color: theme.text, letterSpacing: "-0.5px" }}>{user.name.split(" ")[0]}</h1>
            <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 6 }}>
              {time.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="welcome-time" style={{ textAlign: "right" }}>
            <div style={{ fontSize: 32, fontWeight: 300, color: T.teal, fontFamily: "'JetBrains Mono', monospace" }}>
              {time.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
          <div style={{ padding: "8px 16px", borderRadius: 12, background: dark ? theme.bgSurface : "white", border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#10B981", animation: "breathe 3s ease-in-out infinite" }}/>
            <span style={{ fontSize: 12, color: theme.text }}><strong>{activeReports}</strong> reportes activos</span>
          </div>
          {lastReport && (
            <div style={{ padding: "8px 16px", borderRadius: 12, background: dark ? theme.bgSurface : "white", border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textMuted }}><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
              <span style={{ fontSize: 12, color: theme.textMuted }}>Último: <span style={{ color: theme.text, fontWeight: 500 }}>{lastReport.name}</span></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================
// KPI CARDS
// ========================
function KpiCards({ dark, reports, favorites, recentViews }) {
  const theme = dark ? darkTheme : lightTheme;
  const weeklyData = [3, 5, 2, 7, 4, 6, 8];
  const kpis = [
    { label: "Total reportes", value: reports.length, color: T.teal, sparkData: [reports.length - 2, reports.length - 1, reports.length, reports.length, reports.length + 1, reports.length, reports.length], icon: <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="8" width="3" height="6" rx="1" fill="currentColor" opacity=".5"/><rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" opacity=".7"/><rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor"/></svg> },
    { label: "Activos", value: reports.filter(r => r.status === "live").length, color: "#10B981", sparkData: weeklyData, icon: <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".3"/></svg> },
    { label: "Favoritos", value: favorites.length, color: "#F59E0B", sparkData: [1, 2, 1, 3, 2, favorites.length, favorites.length], icon: <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg> },
    { label: "Vistas esta semana", value: recentViews.length, color: "#6366F1", sparkData: weeklyData, icon: <svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5S1 8 1 8z" stroke="currentColor" strokeWidth="1.3" fill="none"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg> },
  ];

  return (
    <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
      {kpis.map((kpi, i) => (
        <div key={i} style={{
          background: theme.bgCard, borderRadius: 18, padding: "18px 20px",
          border: `1px solid ${theme.border}`, animation: `scaleIn .4s ease-out ${.08 * i}s both`,
          transition: "transform .2s, box-shadow .2s", cursor: "default",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${kpi.color}10`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.color + "12", display: "flex", alignItems: "center", justifyContent: "center", color: kpi.color }}>{kpi.icon}</div>
            <Sparkline data={kpi.sparkData} color={kpi.color} width={60} height={22}/>
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: theme.text }}>{kpi.value}</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{kpi.label}</div>
        </div>
      ))}
    </div>
  );
}

// ========================
// HEALTH STATUS BADGE
// ========================
function HealthBadge({ report, dark }) {
  const theme = dark ? darkTheme : lightTheme;
  // Simulate freshness based on report status
  const statuses = { live: { label: "Datos frescos", color: "#10B981", bg: dark ? "#10B98115" : "#D1FAE5" }, draft: { label: "Sin datos", color: "#F59E0B", bg: dark ? "#F59E0B15" : "#FEF3C7" }, maintenance: { label: "Sin conexión", color: "#EF4444", bg: dark ? "#EF444415" : "#FEE2E2" } };
  const s = statuses[report.status] || statuses.live;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: s.bg, fontSize: 9, fontWeight: 500, color: s.color }}>
      <div style={{ width: 5, height: 5, borderRadius: 3, background: s.color, animation: report.status === "live" ? "breathe 3s ease-in-out infinite" : "none" }}/>
      {s.label}
    </div>
  );
}

// ========================
// METRICS PANEL (Admin only)
// ========================
function MetricsPanel({ dark, reports, recentViews, favorites }) {
  const theme = dark ? darkTheme : lightTheme;

  // Calculate report popularity ranking
  const viewCounts = {};
  recentViews.forEach(rv => { viewCounts[rv.id] = (viewCounts[rv.id] || 0) + 1; });
  const ranked = reports.map(r => ({ ...r, views: viewCounts[r.id] || 0 })).sort((a, b) => b.views - a.views);

  // Calculate hourly distribution
  const hourDist = Array(24).fill(0);
  recentViews.forEach(rv => { if (rv.viewedAt) { hourDist[new Date(rv.viewedAt).getHours()]++; } });
  const maxHour = Math.max(...hourDist, 1);

  // Category distribution
  const catCounts = {};
  reports.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });

  return (
    <div style={{ animation: "fadeUp .4s ease-out" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: theme.text, marginBottom: 4 }}>Métricas de uso</h2>
        <p style={{ fontSize: 12, color: theme.textMuted }}>Analytics del portal DataReports — solo visible para administradores</p>
      </div>

      <div className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Most viewed reports */}
        <div style={{ background: theme.bgCard, borderRadius: 18, padding: 24, border: `1px solid ${theme.border}`, animation: "scaleIn .4s ease-out" }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: theme.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: T.teal }}><path d="M2 14l4-5 3 2 5-7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Reportes más consultados
          </h3>
          {ranked.slice(0, 5).map((r, i) => {
            const colors = categoryColors[r.category] || categoryColors.Comercial;
            const barWidth = r.views > 0 ? (r.views / (ranked[0].views || 1)) * 100 : 0;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, animation: `slideInLeft .3s ease-out ${.05 * i}s both` }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: i === 0 ? T.teal : theme.textMuted, width: 20, textAlign: "center" }}>#{i + 1}</span>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[r.icon]}</svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div style={{ height: 4, borderRadius: 2, background: theme.bgSurface, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: dark ? colors.darkText : colors.accent, width: `${barWidth}%`, transition: "width .6s ease-out" }}/>
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, minWidth: 28, textAlign: "right" }}>{r.views}</span>
              </div>
            );
          })}
          {ranked.length === 0 && <p style={{ fontSize: 12, color: theme.textMuted }}>Sin datos de uso aún</p>}
        </div>

        {/* Usage by hour */}
        <div style={{ background: theme.bgCard, borderRadius: 18, padding: 24, border: `1px solid ${theme.border}`, animation: "scaleIn .4s ease-out .1s both" }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: theme.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: "#6366F1" }}><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
            Horarios de uso
          </h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100 }}>
            {hourDist.map((count, h) => (
              <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{
                  width: "100%", borderRadius: 3,
                  height: `${(count / maxHour) * 80}px`, minHeight: 2,
                  background: count > 0 ? (h >= 8 && h <= 18 ? T.teal : "#6366F1") : theme.bgSurface,
                  transition: "height .6s ease-out", opacity: count > 0 ? 0.8 : 0.3,
                }}/>
                {h % 4 === 0 && <span style={{ fontSize: 8, color: theme.textMuted }}>{h}h</span>}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: theme.textMuted, marginTop: 8, textAlign: "center" }}>
            <span style={{ color: T.teal }}>■</span> Horario laboral &nbsp; <span style={{ color: "#6366F1" }}>■</span> Fuera de horario
          </p>
        </div>
      </div>

      <div className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Category distribution */}
        <div style={{ background: theme.bgCard, borderRadius: 18, padding: 24, border: `1px solid ${theme.border}`, animation: "scaleIn .4s ease-out .2s both" }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: theme.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: "#F59E0B" }}><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Distribución por categoría
          </h3>
          {Object.entries(catCounts).map(([cat, count], i) => {
            const colors = categoryColors[cat] || categoryColors.Comercial;
            return (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, animation: `slideInLeft .3s ease-out ${.05 * i}s both` }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: dark ? colors.darkText : colors.accent }}/>
                <span style={{ fontSize: 12, color: theme.text, flex: 1 }}>{cat}</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: dark ? colors.darkText : colors.accent }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* Health status overview */}
        <div style={{ background: theme.bgCard, borderRadius: 18, padding: 24, border: `1px solid ${theme.border}`, animation: "scaleIn .4s ease-out .3s both" }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: theme.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: "#10B981" }}><path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5.5 8l2 2 3.5-4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Estado de reportes
          </h3>
          {reports.map((r, i) => {
            const colors = categoryColors[r.category] || categoryColors.Comercial;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < reports.length - 1 ? `1px solid ${theme.border}` : "none", animation: `fadeUp .3s ease-out ${.04 * i}s both` }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[r.icon]}</svg>
                </div>
                <span style={{ fontSize: 12, color: theme.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                <HealthBadge report={r} dark={dark}/>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity feed */}
      <div style={{ marginTop: 16, background: theme.bgCard, borderRadius: 18, padding: 24, border: `1px solid ${theme.border}`, animation: "scaleIn .4s ease-out .4s both" }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, color: theme.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: "#EA580C" }}><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Actividad reciente
        </h3>
        {recentViews.length === 0 ? (
          <p style={{ fontSize: 12, color: theme.textMuted }}>Sin actividad registrada aún. Los reportes que se abran aparecerán aquí.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recentViews.slice(0, 8).map((rv, i) => {
              const fullReport = reports.find(r => r.id === rv.id);
              if (!fullReport) return null;
              const colors = categoryColors[fullReport.category] || categoryColors.Comercial;
              return (
                <div key={rv.id + i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < Math.min(recentViews.length, 8) - 1 ? `1px solid ${theme.border}` : "none", animation: `slideInLeft .3s ease-out ${.04 * i}s both` }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: dark ? colors.darkText : colors.accent, flexShrink: 0 }}/>
                  <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textMuted }}><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5S1 8 1 8z" stroke="currentColor" strokeWidth="1.3" fill="none"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>Abrió</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: theme.text }}>{fullReport.name}</span>
                  <span style={{ fontSize: 10, color: theme.textMuted, marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace" }}>
                    {rv.viewedAt ? new Date(rv.viewedAt).toLocaleString("es-PY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ========================
// MAIN DASHBOARD
// ========================
function Dashboard({ user, onLogout }) {
  const [dark, setDark] = useState(false);
  const [reports, setReports] = useState(DEFAULT_REPORTS);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [recentViews, setRecentViews] = useState([]);
  const [cmdK, setCmdK] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [exporting, setExporting] = useState(false);

  const theme = dark ? darkTheme : lightTheme;
  const toggleFav = useCallback((id, e) => { e.stopPropagation(); setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]); }, []);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("datareports-config");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.reports?.length > 0) setReports(data.reports);
        if (data.favorites) setFavorites(data.favorites);
        if (data.recentViews) setRecentViews(data.recentViews);
        if (data.notifications) setNotifications(data.notifications);
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  const saveAll = useCallback((r, f, rv, n) => {
    try { localStorage.setItem("datareports-config", JSON.stringify({ reports: r, favorites: f, recentViews: rv, notifications: n || [] })); } catch (e) {}
  }, []);

  const saveReports = (newReports) => {
    setReports(newReports);
    // Generate notification for new reports
    const existing = reports.map(r => r.id);
    const added = newReports.filter(r => !existing.includes(r.id));
    if (added.length > 0) {
      const newNotifs = [...added.map(r => ({ id: Date.now() + Math.random(), type: "new", message: `Nuevo reporte agregado: ${r.name}`, time: new Date().toISOString(), reportId: r.id, read: false })), ...notifications].slice(0, 20);
      setNotifications(newNotifs);
      saveAll(newReports, favorites, recentViews, newNotifs);
    } else {
      saveAll(newReports, favorites, recentViews, notifications);
    }
  };

  useEffect(() => { if (loaded) saveAll(reports, favorites, recentViews, notifications); }, [favorites, loaded]);

  // Track recent views
  const openReport = (report) => {
    setSelectedReport(report);
    const newRecent = [{ ...report, viewedAt: new Date().toISOString() }, ...recentViews.filter(r => r.id !== report.id)].slice(0, 10);
    setRecentViews(newRecent);
    saveAll(reports, favorites, newRecent, notifications);
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (!selectedReport || exporting) return;
    setExporting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`https://api.powerbi.com/v1.0/myorg/groups/${selectedReport.groupId}/reports/${selectedReport.id}/ExportTo`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ format: "PDF" }),
      });
      if (res.ok) {
        const data = await res.json();
        // Poll for export completion
        let exportId = data.id;
        let status = "Running";
        while (status === "Running" || status === "NotStarted") {
          await new Promise(r => setTimeout(r, 3000));
          const pollRes = await fetch(`https://api.powerbi.com/v1.0/myorg/groups/${selectedReport.groupId}/reports/${selectedReport.id}/exports/${exportId}`, {
            headers: { "Authorization": `Bearer ${token}` },
          });
          const pollData = await pollRes.json();
          status = pollData.status;
          if (status === "Succeeded") {
            const fileRes = await fetch(`https://api.powerbi.com/v1.0/myorg/groups/${selectedReport.groupId}/reports/${selectedReport.id}/exports/${exportId}/file`, {
              headers: { "Authorization": `Bearer ${token}` },
            });
            const blob = await fileRes.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${selectedReport.name}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          }
        }
      }
    } catch (e) {
      console.error("Export failed:", e);
    }
    setExporting(false);
  };

  // Mark notification as read
  const markNotifRead = (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    saveAll(reports, favorites, recentViews, updated);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Time ago helper
  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `Hace ${days}d`;
  };

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdK(true); } if (e.key === "Escape") setCmdK(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const categories = ["Todos", ...new Set(reports.map(r => r.category))];
  let filtered = reports.filter(r => {
    const matchCat = activeCategory === "Todos" || r.category === activeCategory;
    const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // View-specific filtering
  const displayReports = activeView === "favorites" ? filtered.filter(r => favorites.includes(r.id))
    : activeView === "recent" ? recentViews.filter(r => reports.some(rr => rr.id === r.id))
    : filtered;

  const sidebarWidth = sidebarCollapsed ? 68 : 260;

  // REPORT VIEW
  if (selectedReport) {
    const colors = categoryColors[selectedReport.category] || categoryColors.Comercial;
    return (
      <div style={{ fontFamily: "'Outfit', system-ui", minHeight: "100vh", background: theme.bg }}>
        <style>{globalStyles}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", background: theme.bgCard, borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => setSelectedReport(null)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.bgSurface, cursor: "pointer", fontSize: 13, color: theme.textSecondary, transition: "all .2s" }}>
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>Volver
            </button>
            <span style={{ fontSize: 11, color: theme.textMuted }}>›</span>
            <span style={{ fontSize: 11, color: theme.textMuted }}>{selectedReport.category}</span>
            <span style={{ fontSize: 11, color: theme.textMuted }}>›</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[selectedReport.icon]}</svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: theme.text }}>{selectedReport.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => { const el = document.getElementById("report-embed-container"); if (el) { if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); else el.scrollIntoView({ behavior: "smooth" }); } }}
              style={{ padding: "6px 14px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", fontSize: 11, color: theme.textSecondary, display: "flex", alignItems: "center", gap: 4, transition: "all .2s" }}>
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 5V3a1 1 0 0 1 1-1h2m6 0h2a1 1 0 0 1 1 1v2m0 6v2a1 1 0 0 1-1 1h-2m-6 0H3a1 1 0 0 1-1-1v-2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
              Pantalla completa
            </button>
            <button onClick={() => { const c = document.getElementById(`pbi-container-${selectedReport.id}`); if(c){ const e = powerbiService.get(c); if(e) e.print(); }}} style={{ padding: "6px 14px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", fontSize: 11, color: theme.textSecondary, display: "flex", alignItems: "center", gap: 4, transition: "all .2s" }}>
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 4V2h8v2m-8 4H2v5h2m8 0h2V8h-2M4 11h8v3H4v-3z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Imprimir / PDF
            </button>
            <StatusBadge status={selectedReport.status} dark={dark}/>
          </div>
        </div>
        <div style={{ padding: "20px 28px", animation: "scaleIn .3s ease-out", height: "calc(100vh - 56px)" }}>
          <div id="report-embed-container" style={{ height: "100%", background: theme.bgCard, borderRadius: 20, border: `1px solid ${theme.border}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: selectedReport.status === "live" ? "#10B981" : selectedReport.status === "maintenance" ? "#EF4444" : "#F59E0B", animation: selectedReport.status === "live" ? "breathe 3s ease-in-out infinite" : "none" }}/>
              <span style={{ fontSize: 11, color: theme.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>Report: {selectedReport.id.substring(0, 16)}...</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: theme.textMuted }}>Zoom:</span>
                {[75, 100, 125, 150].map(z => (
                  <button key={z} onClick={() => { const c = document.getElementById(`pbi-container-${selectedReport.id}`); if(c){ const e = powerbiService.get(c); if(e) e.setZoom(z/100); }}} style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", fontSize: 10, color: theme.textSecondary }}>{z}%</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              {selectedReport.status === "maintenance" ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: dark ? "#0D0F14" : "#F9FAFB" }}>
                  <svg width="48" height="48" viewBox="0 0 16 16" style={{ color: "#EF4444", marginBottom: 16 }}><path d="M6.5 1.5h3l.5 2 1.5.7 1.8-1 2.1 2.1-1 1.8.7 1.5 2 .5v3l-2 .5-.7 1.5 1 1.8-2.1 2.1-1.8-1-1.5.7-.5 2h-3l-.5-2-1.5-.7-1.8 1-2.1-2.1 1-1.8L1.5 9.5l-2-.5v-3l2-.5.7-1.5-1-1.8 2.1-2.1 1.8 1L6.5 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
                  <p style={{ fontSize: 16, fontWeight: 500, color: theme.text }}>Reporte en mantenimiento</p>
                  <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 6 }}>Este reporte no está disponible temporalmente.</p>
                </div>
              ) : selectedReport.status === "draft" ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: dark ? "#0D0F14" : "#F9FAFB" }}>
                  <svg width="48" height="48" viewBox="0 0 16 16" style={{ color: "#F59E0B", marginBottom: 16 }}><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/></svg>
                  <p style={{ fontSize: 16, fontWeight: 500, color: theme.text }}>Reporte en borrador</p>
                  <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 6 }}>Este reporte aún no ha sido publicado.</p>
                </div>
              ) : (
                <PowerBIEmbed report={selectedReport} dark={dark} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN VIEW WITH SIDEBAR
  return (
    <div style={{ fontFamily: "'Outfit', system-ui", minHeight: "100vh", background: theme.bg, transition: "background .3s" }}>
      <style>{globalStyles}</style>
      {showAdmin && <AdminPanel reports={reports} onSave={saveReports} onClose={() => setShowAdmin(false)} dark={dark}/>}
      {showNotif && <div onClick={() => setShowNotif(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }}/>}

      {/* Command Palette (Ctrl+K) */}
      {cmdK && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120 }} onClick={() => setCmdK(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 520, background: theme.bgCard, borderRadius: 20, border: `1px solid ${theme.border}`, boxShadow: `0 24px 64px ${dark ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.15)"}`, overflow: "hidden", animation: "scaleIn .2s ease-out" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: theme.textMuted }}><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <input autoFocus type="text" placeholder="Buscar reportes, categorías..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", fontSize: 15, color: theme.text, width: "100%", fontFamily: "'Outfit', system-ui" }}/>
              <span style={{ fontSize: 10, color: theme.textMuted, background: theme.bgSurface, padding: "3px 8px", borderRadius: 6, fontFamily: "'JetBrains Mono', monospace" }}>ESC</span>
            </div>
            <div style={{ maxHeight: 360, overflow: "auto", padding: 8 }}>
              {reports.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.category.toLowerCase().includes(searchQuery.toLowerCase())).map(report => {
                const colors = categoryColors[report.category] || categoryColors.Comercial;
                return (
                  <button key={report.id} onClick={() => { openReport(report); setCmdK(false); setSearchQuery(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "none", width: "100%", background: "transparent", cursor: "pointer", transition: "background .15s", textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.background = theme.bgSurface} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[report.icon]}</svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>{report.name}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted }}>{report.category}</div>
                    </div>
                    <StatusBadge status={report.status} dark={dark}/>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Sidebar dark={dark} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} activeView={activeView} setActiveView={setActiveView}
        categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory}
        reports={reports} favorites={favorites} user={user} onLogout={onLogout} isUserAdmin={isAdmin(user.email)}/>

      {/* Main content area */}
      <div className="main-content-responsive" style={{ marginLeft: sidebarWidth, transition: "margin-left .3s cubic-bezier(.4,0,.2,1)", minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, position: "sticky", top: 0, zIndex: 20, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Mobile menu button */}
            <button className="mobile-menu-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgCard, cursor: "pointer", display: "none", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: theme.textSecondary }}><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: theme.text }}>
              {activeView === "dashboard" ? "Dashboard" : activeView === "favorites" ? "Favoritos" : activeView === "recent" ? "Recientes" : "Métricas"}
            </h2>
            {activeCategory !== "Todos" && activeView === "dashboard" && (
              <span style={{ fontSize: 11, color: T.teal, background: dark ? T.teal + "15" : T.tealBg, padding: "3px 10px", borderRadius: 8, fontWeight: 500 }}>{activeCategory}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="topbar-search" onClick={() => setCmdK(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, background: theme.bgSurface, border: `1px solid ${theme.border}`, cursor: "pointer", transition: "all .2s" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textMuted }}><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span style={{ fontSize: 12, color: theme.textMuted }}>Buscar...</span>
              <span style={{ fontSize: 10, color: theme.textMuted, background: theme.bgCard, padding: "2px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${theme.border}` }}>⌘K</span>
            </button>

            {/* Notification bell */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotif(!showNotif)} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgCard, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", transition: "all .2s" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" style={{ color: theme.textSecondary }}><path d="M8 1.5a4 4 0 0 0-4 4v3l-1.5 2h11L12 8.5v-3a4 4 0 0 0-4-4z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M6 13a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
                {unreadCount > 0 && <div style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: 4, background: "#EF4444", border: `2px solid ${theme.bgCard}` }}/>}
              </button>
              {showNotif && (
                <div style={{ position: "absolute", top: 44, right: 0, width: 360, background: theme.bgCard, borderRadius: 18, border: `1px solid ${theme.border}`, boxShadow: `0 16px 48px ${dark ? "rgba(0,0,0,.4)" : "rgba(0,0,0,.12)"}`, zIndex: 50, animation: "scaleIn .2s ease-out", overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>Notificaciones</span>
                    {unreadCount > 0 && <span style={{ fontSize: 10, color: T.teal, background: dark ? T.teal + "15" : T.tealBg, padding: "2px 10px", borderRadius: 10, fontWeight: 500 }}>{unreadCount} nuevas</span>}
                  </div>
                  <div style={{ maxHeight: 320, overflow: "auto" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 32, textAlign: "center" }}>
                        <svg width="32" height="32" viewBox="0 0 16 16" style={{ color: theme.border, marginBottom: 8 }}><path d="M8 1.5a4 4 0 0 0-4 4v3l-1.5 2h11L12 8.5v-3a4 4 0 0 0-4-4z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
                        <p style={{ fontSize: 12, color: theme.textMuted }}>Sin notificaciones</p>
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id} onClick={() => { markNotifRead(n.id); if (n.reportId) { const r = reports.find(rr => rr.id === n.reportId); if (r) openReport(r); } setShowNotif(false); }}
                        style={{ padding: "14px 20px", borderBottom: `1px solid ${theme.border}`, cursor: "pointer", background: n.read ? "transparent" : (dark ? T.teal + "05" : T.tealBg + "80"), transition: "background .2s" }}
                        onMouseEnter={e => e.currentTarget.style.background = theme.bgSurface} onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : (dark ? T.teal + "05" : T.tealBg + "80")}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0, background: n.type === "new" ? T.teal : n.type === "update" ? "#3B82F6" : "#F59E0B" }}/>
                          <div>
                            <p style={{ fontSize: 12, color: theme.text, lineHeight: 1.4 }}>{n.message}</p>
                            <p style={{ fontSize: 10, color: theme.textMuted, marginTop: 3 }}>{timeAgo(n.time)}</p>
                          </div>
                          {!n.read && <div style={{ width: 6, height: 6, borderRadius: 3, background: T.teal, marginLeft: "auto", marginTop: 6 }}/>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setDark(!dark)} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgCard, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
              {dark ? <svg width="15" height="15" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.5" stroke="#FBBF24" strokeWidth="1.5" fill="none"/></svg> : <svg width="15" height="15" viewBox="0 0 16 16"><path d="M14 9.3A6 6 0 0 1 6.7 2 6 6 0 1 0 14 9.3z" stroke="#6B7280" strokeWidth="1.5" fill="none"/></svg>}
            </button>
            {isAdmin(user.email) && (
              <button onClick={() => setShowAdmin(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${T.teal}30`, background: dark ? T.teal + "10" : T.tealBg, cursor: "pointer", transition: "all .2s" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: T.teal }}><path d="M6.5 1.5h3l.5 2 1.5.7 1.8-1 2.1 2.1-1 1.8.7 1.5 2 .5v3l-2 .5-.7 1.5 1 1.8-2.1 2.1-1.8-1-1.5.7-.5 2h-3l-.5-2-1.5-.7-1.8 1-2.1-2.1 1-1.8L1.5 9.5l-2-.5v-3l2-.5.7-1.5-1-1.8 2.1-2.1 1.8 1L6.5 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: T.teal }}>Admin</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "24px 28px" }}>
          {/* Welcome Banner - only on dashboard view */}
          {activeView === "dashboard" && <WelcomeBanner user={user} dark={dark} reports={reports} recentReports={recentViews}/>}

          {/* KPI Cards */}
          {activeView === "dashboard" && <KpiCards dark={dark} reports={reports} favorites={favorites} recentViews={recentViews}/>}

          {/* Metrics Panel - admin only */}
          {activeView === "metrics" && isAdmin(user.email) && <MetricsPanel dark={dark} reports={reports} recentViews={recentViews} favorites={favorites}/>}

          {/* View title for non-dashboard */}
          {activeView !== "dashboard" && (
            <div style={{ marginBottom: 20, animation: "fadeUp .3s ease-out" }}>
              <p style={{ fontSize: 13, color: theme.textMuted }}>
                {activeView === "favorites" ? `${displayReports.length} reportes marcados como favoritos` : `Últimos ${displayReports.length} reportes consultados`}
              </p>
            </div>
          )}

          {/* Recent reports as timeline */}
          {activeView === "recent" && displayReports.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {displayReports.map((report, i) => {
                const colors = categoryColors[report.category] || categoryColors.Comercial;
                const fullReport = reports.find(r => r.id === report.id) || report;
                return (
                  <div key={report.id + i} onClick={() => openReport(fullReport)}
                    style={{
                      display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
                      background: theme.bgCard, borderRadius: 16, border: `1px solid ${theme.border}`,
                      cursor: "pointer", transition: "all .25s cubic-bezier(.4,0,.2,1)",
                      animation: `scaleIn .3s ease-out ${.04 * i}s both`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.borderColor = (dark ? colors.darkText : colors.accent) + "44"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = theme.border; }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[fullReport.icon]}</svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{fullReport.name}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{fullReport.category}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: theme.textMuted }}>{timeAgo(report.viewedAt)}</div>
                      <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(report.viewedAt).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textMuted }}><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                );
              })}
            </div>
          )}

          {/* Report cards grid — only for dashboard and favorites views */}
          {activeView !== "recent" && (
          <div className="reports-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {displayReports.map((report, i) => {
              const colors = categoryColors[report.category] || categoryColors.Comercial;
              const isHovered = hoveredCard === report.id;
              const isFav = favorites.includes(report.id);
              return (
                <div key={report.id} onClick={() => openReport(report)} onMouseEnter={() => setHoveredCard(report.id)} onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: theme.bgCard, borderRadius: 20, padding: 24,
                    border: `1.5px solid ${isHovered ? (dark ? colors.darkText + "44" : colors.accent + "44") : theme.border}`,
                    cursor: "pointer",
                    transition: "all .3s cubic-bezier(.4,0,.2,1)",
                    transform: isHovered ? "translateY(-4px) scale(1.01)" : "none",
                    boxShadow: isHovered ? `0 20px 40px ${dark ? "rgba(0,0,0,.3)" : colors.accent + "12"}` : "none",
                    animation: `scaleIn .4s ease-out ${.05 * i}s both`,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .3s", transform: isHovered ? "scale(1.1)" : "scale(1)" }}>
                      <svg width="20" height="20" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[report.icon]}</svg>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button onClick={(e) => toggleFav(report.id, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, transition: "transform .2s", transform: isFav ? "scale(1.2)" : "scale(1)" }}>
                        <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" fill={isFav ? "#FBBF24" : "none"} stroke={isFav ? "#FBBF24" : theme.textMuted} strokeWidth="1.2"/></svg>
                      </button>
                      <StatusBadge status={report.status} dark={dark}/>
                    </div>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 500, color: theme.text, marginBottom: 5 }}>{report.name}</h3>
                  <p style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{report.description}</p>
                  <div style={{ marginBottom: 14 }}>
                    <HealthBadge report={report} dark={dark}/>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: dark ? colors.darkText : colors.accent, background: dark ? colors.darkBg : colors.bg, padding: "4px 12px", borderRadius: 8 }}>{report.category}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.teal, display: "flex", alignItems: "center", gap: 4, opacity: isHovered ? 1 : 0, transition: "opacity .2s" }}>
                      Abrir <svg width="14" height="14" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Add report card — admin only */}
            {isAdmin(user.email) && activeView === "dashboard" && (
              <div onClick={() => setShowAdmin(true)} style={{
                borderRadius: 20, padding: 24, border: `2px dashed ${theme.border}`, cursor: "pointer",
                transition: "all .3s", display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", minHeight: 220, background: "transparent",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.teal; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.transform = "none"; }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: dark ? T.teal + "12" : T.tealBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <svg width="20" height="20" viewBox="0 0 16 16" style={{ color: T.teal }}><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 500, color: T.teal }}>Agregar reporte</p>
              </div>
            )}
          </div>
          )}

          {displayReports.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, animation: "fadeUp .4s ease-out" }}>
              <svg width="48" height="48" viewBox="0 0 48 48" style={{ color: theme.border, marginBottom: 12 }}><circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2" fill="none"/><line x1="30" y1="30" x2="40" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <p style={{ fontSize: 15, fontWeight: 500, color: theme.textMuted }}>
                {activeView === "favorites" ? "No tenés favoritos aún" : activeView === "recent" ? "No hay reportes recientes" : "No se encontraron reportes"}
              </p>
              <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                {activeView === "favorites" ? "Marcá reportes con la estrella para acceso rápido" : activeView === "recent" ? "Los reportes que abras aparecerán acá" : "Intentá con otro filtro"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================
// ERROR BOUNDARY
// ========================
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', system-ui", background: "#F7F8FA" }}>
          <svg width="64" height="64" viewBox="0 0 48 48" style={{ color: "#EF4444", marginBottom: 20 }}><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" fill="none"/><line x1="24" y1="14" x2="24" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="34" r="2" fill="currentColor"/></svg>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: "#111318", marginBottom: 8 }}>Algo salió mal</h2>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, maxWidth: 400, textAlign: "center" }}>Ocurrió un error inesperado. Por favor intentá recargar la página.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 28px", borderRadius: 12, border: "none", background: "#0D9488", color: "white", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Recargar página</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ========================
// SKELETON LOADER
// ========================
function SkeletonLoader() {
  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FA", fontFamily: "'Outfit', system-ui" }}>
      <style>{`@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } } .sk { background: linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%); background-size: 400px 100%; animation: shimmer 1.5s infinite ease-in-out; border-radius: 8px; } @media (max-width: 768px) { .sk-sidebar { display: none !important; } .sk-main { padding: 16px !important; } .sk-kpi { grid-template-columns: repeat(2, 1fr) !important; } .sk-cards { grid-template-columns: 1fr !important; } }`}</style>
      <div style={{ display: "flex" }}>
        <div className="sk-sidebar" style={{ width: 260, borderRight: "1px solid #E2E5EA", padding: 20 }}>
          <div className="sk" style={{ width: 140, height: 28, marginBottom: 32 }}/>
          {[1,2,3].map(i => <div key={i} className="sk" style={{ width: "100%", height: 36, marginBottom: 8, borderRadius: 10 }}/>)}
        </div>
        <div className="sk-main" style={{ flex: 1, padding: "24px 28px" }}>
          <div className="sk" style={{ width: "100%", height: 120, borderRadius: 20, marginBottom: 24 }}/>
          <div className="sk-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height: 100, borderRadius: 18 }}/>)}
          </div>
          <div className="sk-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[1,2,3].map(i => <div key={i} className="sk" style={{ height: 220, borderRadius: 20 }}/>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const instance = await getMsalInstance();
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          const account = accounts[0];
          setUser({
            name: account.name || account.username,
            email: account.username,
            role: isAdmin(account.username) ? "Administrador BI" : "Usuario BI",
            avatar: (account.name || "U").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase(),
          });
        }
      } catch (e) {}
      setInitializing(false);
    })();
  }, []);

  if (initializing) return <SkeletonLoader />;

  return (
    <ErrorBoundary>
      {!user ? <LoginScreen onLogin={setUser}/> : <Dashboard user={user} onLogout={() => setUser(null)}/>}
    </ErrorBoundary>
  );
}
