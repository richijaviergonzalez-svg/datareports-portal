import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ALL_CATEGORIES,
  DEFAULT_REPORTS,
  ICON_OPTIONS,
  canUserViewReport,
  getReportDescription,
  getReportPurpose,
  getVisibilityLabel,
  isValidUuid,
  normalizeReport,
  normalizeReports,
  parseUrl,
} from "./features/reports/reportModel.js";
import {
  REQUEST_PRIORITY_LABELS,
  REQUEST_PRIORITY_OPTIONS,
  REQUEST_ADMIN_NOTE_MAX_LENGTH,
  REQUEST_DETAIL_MAX_LENGTH,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_FLOW,
  REQUEST_STATUS_OPTIONS,
  REQUEST_TYPE_OPTIONS,
  createBiPortalRequest,
  filterRequests,
  getRequestStatusColor,
  getRequestSla,
  getRequestStats,
  getRequestTimeline,
  getVisibleRequests,
  updateRequestStatusInList,
} from "./features/requests/requestModel.js";
import {
  buildUserFromAccount,
  getAccessToken,
  getCurrentUser,
  isAdmin,
  msalLogin,
} from "./lib/auth.js";
import {
  createBiRequest,
  fetchBiRequests,
  fetchReportsCatalog,
  saveReportsCatalog,
  updateBiRequestStatus,
} from "./lib/biApi.js";
import { loadPortalState, savePortalState } from "./lib/storage.js";

/*
╔══════════════════════════════════════════════════════════════╗
║  DATAREPORTS PORTAL v3 — Manufactura de Pilar S.A.          ║
║  Con Panel de Administración integrado                       ║
║  Persistencia via window.storage API                         ║
╚══════════════════════════════════════════════════════════════╝
*/

const T = {
  teal: "#2563EB",
  tealLight: "#60A5FA",
  tealDark: "#1D4ED8",
  tealBg: "#EFF6FF",
  violet: "#7C3AED",
  violetBg: "#F5F3FF",
  amber: "#F59E0B",
  cyan: "#06B6D4",
  rose: "#E11D48",
};
const darkTheme = { bg: "#0F1117", bgCard: "#181B23", bgSurface: "#1E222D", bgHover: "#252A36", border: "#2A2F3C", borderLight: "#353B4A", text: "#E8ECF4", textSecondary: "#A7B0C0", textMuted: "#6B7288" };
const lightTheme = { bg: "#F6F8FC", bgCard: "#FFFFFF", bgSurface: "#F4F7FB", bgHover: "#EEF3F9", border: "#E3E8F0", borderLight: "#EDF2F7", text: "#111827", textSecondary: "#667085", textMuted: "#98A2B3" };

const categoryColors = {
  Abastecimiento: { bg: "#FFF4E8", accent: "#F97316", darkBg: "#F9731620", darkText: "#FDBA74" },
  Retail: { bg: "#EEF4FF", accent: "#3B82F6", darkBg: "#3B82F620", darkText: "#93C5FD" },
  Tiendas: { bg: "#ECFEFF", accent: "#06B6D4", darkBg: "#06B6D420", darkText: "#67E8F9" },
  IH: { bg: "#F5F3FF", accent: "#8B5CF6", darkBg: "#8B5CF620", darkText: "#C4B5FD" },
  Mayoristas: { bg: "#FFFBEB", accent: "#F59E0B", darkBg: "#F59E0B20", darkText: "#FCD34D" },
  Comercial: { bg: "#EEF2FF", accent: "#4F46E5", darkBg: "#4F46E520", darkText: "#A5B4FC" },
  "E-Commerce": { bg: "#FFF1F2", accent: "#EC4899", darkBg: "#EC489920", darkText: "#F9A8D4" },
  Compras: { bg: "#EFF6FF", accent: "#2563EB", darkBg: "#2563EB20", darkText: "#93C5FD" },
  Producto: { bg: "#FFF7ED", accent: "#EA580C", darkBg: "#EA580C20", darkText: "#FDBA74" },
  Marketing: { bg: "#FDF2F8", accent: "#DB2777", darkBg: "#DB277720", darkText: "#F9A8D4" },
  "Recursos Humanos": { bg: "#FFF1F2", accent: "#E11D48", darkBg: "#E11D4820", darkText: "#FDA4AF" },
  Finanzas: { bg: "#F5F3FF", accent: "#7C3AED", darkBg: "#7C3AED20", darkText: "#C4B5FD" },
  "Creditos y Cobranzas": { bg: "#FEF2F2", accent: "#DC2626", darkBg: "#DC262620", darkText: "#FCA5A5" },
  Deco: { bg: "#FAF5FF", accent: "#A855F7", darkBg: "#A855F720", darkText: "#D8B4FE" },
  Contabilidad: { bg: "#EEF2FF", accent: "#4338CA", darkBg: "#4338CA20", darkText: "#A5B4FC" },
  Prendas: { bg: "#FDF4FF", accent: "#C026D3", darkBg: "#C026D320", darkText: "#F0ABFC" },
  Operaciones: { bg: "#FFFBEB", accent: "#D97706", darkBg: "#D9770620", darkText: "#FCD34D" },
  Dirección: { bg: "#FDF2F8", accent: "#BE185D", darkBg: "#BE185D20", darkText: "#F9A8D4" },
  Logística: { bg: "#FEF2F2", accent: "#EF4444", darkBg: "#EF444420", darkText: "#FCA5A5" },
  Producción: { bg: "#ECFDF3", accent: "#10B981", darkBg: "#10B98120", darkText: "#6EE7B7" },
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
let powerbiClientPromise = null;
let loadedPowerbiService = null;

function loadPowerBiClient() {
  if (!powerbiClientPromise) {
    powerbiClientPromise = import("powerbi-client").then((pbi) => {
      loadedPowerbiService = new pbi.service.Service(
        pbi.factories.hpmFactory,
        pbi.factories.wpmpFactory,
        pbi.factories.routerFactory
      );

      return {
        pbi,
        service: loadedPowerbiService,
      };
    });
  }

  return powerbiClientPromise;
}

function getLoadedPowerBiService() {
  return loadedPowerbiService;
}

function PowerBIEmbed({ report, dark }) {
  const containerId = `pbi-container-${report.id}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let tokenRefreshInterval = null;
    let resizeTimeout = null;
    let embeddedReport = null;

    const resizeEmbeddedReport = async () => {
      try {
        if (embeddedReport?.resize) {
          await embeddedReport.resize();
        }
      } catch (e) {
        console.warn("Power BI resize failed:", e);
      }
    };

    async function embed() {
      try {
        setLoading(true);
        setError(null);

        const token = await getAccessToken();
        const container = document.getElementById(containerId);
        if (!container || !mounted) return;

        const { pbi, service } = await loadPowerBiClient();
        const models = pbi.models;
        const embedConfig = {
          type: "report",
          id: report.id,
          embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${report.id}&groupId=${report.groupId}`,
          accessToken: token,
          tokenType: models.TokenType.Aad,
          settings: {
            panes: {
              filters: { visible: false },
              pageNavigation: { visible: true },
            },
            background: models.BackgroundType.Default,
            layoutType: models.LayoutType.Custom,
            customLayout: {
              displayOption: models.DisplayOption.FitToPage,
            },
          },
        };

        service.reset(container);
        embeddedReport = service.embed(container, embedConfig);

        embeddedReport.on("loaded", () => {
          if (!mounted) return;
          setLoading(false);

          resizeTimeout = setTimeout(() => {
            resizeEmbeddedReport();
          }, 350);
        });

        embeddedReport.on("rendered", () => {
          resizeEmbeddedReport();
        });

        embeddedReport.on("error", (event) => {
          if (mounted) {
            setError("Error al cargar el reporte: " + (event?.detail?.message || "Error desconocido"));
            setLoading(false);
          }
        });

        // Auto-refresh token cada 45 minutos para evitar expiración.
        tokenRefreshInterval = setInterval(async () => {
          try {
            const newToken = await getAccessToken();
            if (embeddedReport) {
              await embeddedReport.setAccessToken(newToken);
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

    const handleWindowResize = () => {
      resizeEmbeddedReport();
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleWindowResize);

      if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);
      if (resizeTimeout) clearTimeout(resizeTimeout);

      const container = document.getElementById(containerId);
      if (container) {
        try {
          getLoadedPowerBiService()?.reset(container);
        } catch (e) {
          console.warn("Power BI reset failed:", e);
        }
      }
    };
  }, [report.id, report.groupId, retryCount]);

  const handleRetry = () => {
    setRetryCount(c => c + 1);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        background: dark ? "#0D0F14" : "#F9FAFB",
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: dark ? "#0D0F14" : "#F9FAFB",
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: `3px solid ${dark ? "#2A2F3C" : "#E5E7EB"}`,
              borderTopColor: "#0D9488",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              marginBottom: 16,
            }}
          />
          <p style={{ fontSize: 13, color: dark ? "#8B93A7" : "#6B7280" }}>Cargando reporte...</p>
          <p style={{ fontSize: 11, color: dark ? "#5C6478" : "#9CA3AF", marginTop: 4 }}>{report.name}</p>
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: dark ? "#0D0F14" : "#F9FAFB",
            zIndex: 5,
          }}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ color: "#EF4444", marginBottom: 12 }}>
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="24" y1="14" x2="24" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="24" cy="34" r="2" fill="currentColor" />
          </svg>
          <p style={{ fontSize: 13, color: "#EF4444", fontWeight: 500 }}>Error al cargar</p>
          <p style={{ fontSize: 11, color: dark ? "#5C6478" : "#9CA3AF", marginTop: 4, maxWidth: 400, textAlign: "center" }}>{error}</p>
          <button onClick={handleRetry} style={{ marginTop: 16, padding: "8px 24px", borderRadius: 12, border: `1px solid ${dark ? "#2A2F3C" : "#E5E7EB"}`, background: dark ? "#1E222D" : "#FFFFFF", color: "#0D9488", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      )}

      <div
        id={containerId}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      />
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
      if (account) {
        onLogin(buildUserFromAccount(account));
      }
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
function AdminPanel({ reports, onSave, onClose, dark, reportSyncStatus = "local", reportSyncMessage = "Catálogo local", currentUser }) {
  const theme = dark ? darkTheme : lightTheme;
  const [list, setList] = useState(normalizeReports(reports));
  const [editing, setEditing] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [parsed, setParsed] = useState(null);
  const [form, setForm] = useState({
    id: "", groupId: "", name: "", category: "Comercial", icon: "chart-bar", description: "", status: "live",
    owner: "Equipo BI", audience: "Corporativo", accessLevel: "Corporativo", dataSource: "Power BI Service",
    refreshFrequency: "Según dataset", criticality: "media", technicalNotes: "", originalUrl: "", sortOrder: "",
    visibilityMode: "all", allowedEmails: "", allowedDomains: "", visibilityNote: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => setList(normalizeReports(reports)), [reports]);

  const showSuccess = (msg) => { setSuccessMsg(msg); setErrorMsg(""); setTimeout(() => setSuccessMsg(""), 2800); };
  const showError = (msg) => { setErrorMsg(msg); setSuccessMsg(""); setTimeout(() => setErrorMsg(""), 4200); };

  const resetForm = () => {
    setEditing(null);
    setUrlInput("");
    setParsed(null);
    setTestResult(null);
    setForm({ id: "", groupId: "", name: "", category: "Comercial", icon: "chart-bar", description: "", status: "live", owner: "Equipo BI", audience: "Corporativo", accessLevel: "Corporativo", dataSource: "Power BI Service", refreshFrequency: "Según dataset", criticality: "media", technicalNotes: "", originalUrl: "", sortOrder: "", visibilityMode: "all", allowedEmails: "", allowedDomains: "", visibilityNote: "" });
  };

  const handleUrlPaste = (val) => {
    setUrlInput(val);
    const p = parseUrl(val);
    setParsed(p);
    setTestResult(null);
    setForm(prev => ({ ...prev, originalUrl: val, id: p?.reportId || prev.id, groupId: p?.groupId ?? prev.groupId }));
  };

  const validateForm = () => {
    if (!form.id || !isValidUuid(form.id)) return "El Report ID no tiene formato UUID válido.";
    if (form.groupId && !isValidUuid(form.groupId)) return "El Workspace ID debe ser UUID válido o quedar vacío si el reporte está en My Workspace.";
    if (!form.name.trim()) return "El nombre del reporte es obligatorio.";
    if (list.some(r => r.id === form.id && r.id !== editing)) return "Ya existe un reporte configurado con ese Report ID.";
    if (form.visibilityMode === "emails" && !form.allowedEmails.trim()) return "Para visibilidad por usuarios específicos, cargá al menos un correo.";
    if (form.visibilityMode === "domains" && !form.allowedDomains.trim()) return "Para visibilidad por dominio, cargá al menos un dominio.";
    return "";
  };

  const makeReportFromForm = () => normalizeReport({
    id: form.id,
    groupId: form.groupId,
    name: form.name,
    category: form.category,
    icon: form.icon,
    status: form.status,
    description: form.description,
    owner: form.owner,
    audience: form.audience,
    accessLevel: form.accessLevel,
    dataSource: form.dataSource,
    refreshFrequency: form.refreshFrequency,
    criticality: form.criticality,
    technicalNotes: form.technicalNotes,
    originalUrl: form.originalUrl || urlInput,
    visibilityMode: form.visibilityMode,
    allowedEmails: form.allowedEmails,
    allowedDomains: form.allowedDomains,
    visibilityNote: form.visibilityNote,
    sortOrder: form.sortOrder || list.length + 1,
    createdAt: list.find(r => r.id === editing)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser?.email || "admin",
  }, list.length);

  const persistList = async (updated, msg) => {
    const optimisticList = normalizeReports(updated);
    setSaving(true);
    setList(optimisticList);
    try {
      const result = await onSave(optimisticList);
      const syncedList = normalizeReports(result?.reports || optimisticList);
      setList(syncedList);
      showSuccess(msg || (result?.synced ? "Catálogo sincronizado correctamente" : "Cambios guardados localmente"));
      return true;
    } catch (e) {
      setList(normalizeReports(reports));
      showError(e.message || "No se pudieron guardar los cambios.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const error = validateForm();
    if (error) return showError(error);
    const newReport = makeReportFromForm();
    const updated = [...list, newReport];
    const ok = await persistList(updated, `"${newReport.name}" agregado al catálogo`);
    if (ok) resetForm();
  };

  const handleEdit = (report) => {
    setEditing(report.id);
    const r = normalizeReport(report);
    setForm({
      id: r.id, groupId: r.groupId || "", name: r.name, category: r.category, icon: r.icon, description: r.description || "", status: r.status,
      owner: r.owner || "Equipo BI", audience: r.audience || "Corporativo", accessLevel: r.accessLevel || "Corporativo", dataSource: r.dataSource || "Power BI Service",
      refreshFrequency: r.refreshFrequency || "Según dataset", criticality: r.criticality || "media", technicalNotes: r.technicalNotes || "", originalUrl: r.originalUrl || "", sortOrder: r.sortOrder || "",
      visibilityMode: r.visibilityMode || "all",
      allowedEmails: (r.allowedEmails || []).join(", "),
      allowedDomains: (r.allowedDomains || []).join(", "),
      visibilityNote: r.visibilityNote || "",
    });
    setUrlInput(r.originalUrl || "");
    setParsed(r.id ? { reportId: r.id, groupId: r.groupId || "" } : null);
    setTestResult(null);
  };

  const handleSaveEdit = async () => {
    const error = validateForm();
    if (error) return showError(error);
    const updatedReport = makeReportFromForm();
    const updated = list.map(r => r.id === editing ? updatedReport : r);
    const ok = await persistList(updated, "Reporte actualizado");
    if (ok) resetForm();
  };

  const handleDelete = async (id) => {
    const r = list.find(x => x.id === id);
    const updated = list.filter(x => x.id !== id);
    const ok = await persistList(updated, `"${r?.name || "Reporte"}" eliminado`);
    if (ok) setDeleteConfirm(null);
  };

  const testConnection = async () => {
    const error = validateForm();
    if (error) return showError(error);
    setTesting(true);
    setTestResult(null);
    try {
      const token = await getAccessToken();
      const endpoint = form.groupId
        ? `https://api.powerbi.com/v1.0/myorg/groups/${form.groupId}/reports/${form.id}`
        : `https://api.powerbi.com/v1.0/myorg/reports/${form.id}`;
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Power BI respondió ${res.status}`);
      const data = await res.json();
      setTestResult({ ok: true, message: `Conexión OK: ${data.name || form.name}` });
      if (data.name && !form.name) setForm(prev => ({ ...prev, name: data.name }));
    } catch (e) {
      setTestResult({ ok: false, message: `No se pudo validar desde la API: ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgSurface, color: theme.text, fontSize: 13, fontFamily: "'Outfit', system-ui", outline: "none" };
  const selectStyle = { ...inputStyle, cursor: "pointer", appearance: "none", WebkitAppearance: "none" };
  const mutedLabel = { fontSize: 10, color: theme.textMuted, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 16 }}>
      <div style={{ width: 980, maxHeight: "92vh", background: theme.bgCard, borderRadius: 24, border: `1px solid ${theme.border}`, overflow: "hidden", display: "flex", flexDirection: "column", animation: "fadeUp .3s ease-out" }}>
        <div style={{ padding: "20px 28px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: theme.text }}>Gestor de Catálogo BI</h2>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Reportes centralizados, gobierno y validación de Power BI</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: reportSyncStatus === "shared" ? T.teal : "#F59E0B", background: reportSyncStatus === "shared" ? (dark ? T.teal + "18" : T.tealBg) : (dark ? "#F59E0B18" : "#FFFBEB"), padding: "6px 12px", borderRadius: 999 }}>
              {reportSyncMessage}
            </span>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: theme.textMuted, fontSize: 18 }}>×</button>
          </div>
        </div>

        {(successMsg || errorMsg) && (
          <div style={{ margin: "12px 28px 0", padding: "10px 16px", borderRadius: 12, background: successMsg ? (dark ? "#06543520" : "#D1FAE5") : (dark ? "#7F1D1D20" : "#FEF2F2"), border: `1px solid ${successMsg ? (dark ? "#065F4640" : "#A7F3D0") : (dark ? "#7F1D1D40" : "#FECACA")}`, color: successMsg ? (dark ? "#34D399" : "#065F46") : (dark ? "#F87171" : "#991B1B"), fontSize: 12, fontWeight: 500 }}>
            {successMsg || errorMsg}
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
          <div style={{ marginBottom: 28, padding: 24, borderRadius: 18, background: theme.bgSurface, border: `1px solid ${theme.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: T.teal, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: T.teal }}><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="8" y1="5" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              {editing ? "Editar reporte" : "Agregar nuevo reporte"}
            </h3>

            <div style={{ marginBottom: 16 }}>
              <label style={mutedLabel}>Paso 1 — URL del reporte de Power BI</label>
              <input type="text" value={urlInput} onChange={e => handleUrlPaste(e.target.value)} placeholder="https://app.powerbi.com/groups/.../reports/..." style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}/>
              {parsed && (
                <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: dark ? "#06543515" : "#D1FAE5", border: `1px solid ${dark ? "#065F4630" : "#A7F3D0"}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: dark ? "#34D399" : "#065F46", marginBottom: 6 }}>IDs detectados automáticamente</div>
                  <div style={{ fontSize: 10, color: dark ? "#5EEAD4" : "#047857", fontFamily: "'JetBrains Mono', monospace" }}>
                    Report ID: {parsed.reportId}<br/>Workspace ID: {parsed.groupId || "My Workspace / no configurado"}
                  </div>
                </div>
              )}
              {urlInput && !parsed && (
                <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: dark ? "#7F1D1D20" : "#FEF2F2", border: `1px solid ${dark ? "#7F1D1D40" : "#FECACA"}`, fontSize: 11, color: dark ? "#F87171" : "#991B1B" }}>URL no válida. Copiá la URL completa del reporte desde Power BI.</div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={mutedLabel}>Report ID</label><input value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}/></div>
              <div><label style={mutedLabel}>Workspace ID</label><input value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })} placeholder="Vacío para My Workspace" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}/></div>
              <div><label style={mutedLabel}>Nombre</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Dashboard de Ventas" style={inputStyle}/></div>
              <div><label style={mutedLabel}>Categoría</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyle}>{ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={mutedLabel}>Descripción</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Breve descripción del reporte..." style={{ ...inputStyle, minHeight: 68, resize: "vertical" }}/>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
              <div><label style={mutedLabel}>Responsable</label><input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} style={inputStyle}/></div>
              <div><label style={mutedLabel}>Audiencia</label><input value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} placeholder="Retail, Dirección, Corporativo..." style={inputStyle}/></div>
              <div><label style={mutedLabel}>Nivel de acceso</label><select value={form.accessLevel} onChange={e => setForm({ ...form, accessLevel: e.target.value })} style={selectStyle}>{["Corporativo","Gerencial","Dirección","Restringido"].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
              <div><label style={mutedLabel}>Fuente de datos</label><input value={form.dataSource} onChange={e => setForm({ ...form, dataSource: e.target.value })} style={inputStyle}/></div>
              <div><label style={mutedLabel}>Actualización</label><input value={form.refreshFrequency} onChange={e => setForm({ ...form, refreshFrequency: e.target.value })} style={inputStyle}/></div>
              <div><label style={mutedLabel}>Criticidad</label><select value={form.criticality} onChange={e => setForm({ ...form, criticality: e.target.value })} style={selectStyle}>{[["baja","Baja"],["media","Media"],["alta","Alta"],["critica","Crítica"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </div>

            <div style={{ marginBottom: 14, padding: 16, borderRadius: 16, background: theme.bgCard, border: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={mutedLabel}>Visibilidad del reporte</label>
                  <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>Define quién verá la tarjeta en DataReports. El permiso final de apertura sigue dependiendo de Power BI.</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.teal, background: dark ? T.teal + "18" : T.tealBg, padding: "5px 10px", borderRadius: 999 }}>{form.visibilityMode === "all" ? "Visible para todos" : form.visibilityMode === "admins" ? "Solo admin" : form.visibilityMode === "emails" ? "Usuarios específicos" : "Dominio"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={mutedLabel}>Modo de visibilidad</label>
                  <select value={form.visibilityMode} onChange={e => setForm({ ...form, visibilityMode: e.target.value })} style={selectStyle}>
                    <option value="all">Todos los usuarios autenticados</option>
                    <option value="admins">Solo administradores</option>
                    <option value="emails">Usuarios específicos por correo</option>
                    <option value="domains">Dominios específicos</option>
                  </select>
                </div>
                <div>
                  <label style={mutedLabel}>Nota de visibilidad</label>
                  <input value={form.visibilityNote} onChange={e => setForm({ ...form, visibilityNote: e.target.value })} placeholder="Ej: Solo Retail / Solo Gerencia" style={inputStyle}/>
                </div>
              </div>
              {form.visibilityMode === "emails" && (
                <div style={{ marginBottom: 12 }}>
                  <label style={mutedLabel}>Correos permitidos</label>
                  <textarea value={form.allowedEmails} onChange={e => setForm({ ...form, allowedEmails: e.target.value })} placeholder="usuario1@empresa.com, usuario2@empresa.com" style={{ ...inputStyle, minHeight: 58, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}/>
                </div>
              )}
              {form.visibilityMode === "domains" && (
                <div style={{ marginBottom: 12 }}>
                  <label style={mutedLabel}>Dominios permitidos</label>
                  <textarea value={form.allowedDomains} onChange={e => setForm({ ...form, allowedDomains: e.target.value })} placeholder="pilarpy.onmicrosoft.com, pilar.com.py" style={{ ...inputStyle, minHeight: 58, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}/>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={mutedLabel}>Notas internas</label>
              <input value={form.technicalNotes} onChange={e => setForm({ ...form, technicalNotes: e.target.value })} placeholder="Observaciones técnicas para BI/admin" style={inputStyle}/>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={mutedLabel}>Ícono</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ICON_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => setForm({ ...form, icon: opt.key })} style={{ width: 48, height: 48, borderRadius: 12, border: `2px solid ${form.icon === opt.key ? T.teal : theme.border}`, background: form.icon === opt.key ? (dark ? T.teal + "20" : T.tealBg) : theme.bgCard, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                    <svg width="16" height="16" viewBox="0 0 22 22" style={{ color: form.icon === opt.key ? T.teal : theme.textMuted }}>{iconPaths[opt.key]}</svg>
                    <span style={{ fontSize: 7, color: form.icon === opt.key ? T.teal : theme.textMuted }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {[{ key: "live", label: "Activo", color: "#10B981" }, { key: "draft", label: "Borrador", color: "#F59E0B" }, { key: "maintenance", label: "En mantenimiento", color: "#EF4444" }].map(s => (
                <button key={s.key} onClick={() => setForm({ ...form, status: s.key })} style={{ padding: "8px 18px", borderRadius: 10, border: `1.5px solid ${form.status === s.key ? s.color : theme.border}`, background: form.status === s.key ? s.color + "18" : theme.bgCard, color: form.status === s.key ? s.color : theme.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s.label}</button>
              ))}
            </div>

            {testResult && (
              <div style={{ marginBottom: 14, padding: 11, borderRadius: 12, background: testResult.ok ? (dark ? "#06543520" : "#ECFDF5") : (dark ? "#7F1D1D20" : "#FEF2F2"), border: `1px solid ${testResult.ok ? (dark ? "#065F4640" : "#A7F3D0") : (dark ? "#7F1D1D40" : "#FECACA")}`, color: testResult.ok ? (dark ? "#34D399" : "#065F46") : (dark ? "#F87171" : "#991B1B"), fontSize: 12 }}>
                {testResult.message}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={testConnection} disabled={testing || saving} style={{ padding: "12px 18px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.textSecondary, fontSize: 13, fontWeight: 600, cursor: testing ? "wait" : "pointer" }}>{testing ? "Validando..." : "Probar conexión"}</button>
              <button onClick={editing ? handleSaveEdit : handleAdd} disabled={saving} style={{ flex: 1, padding: "12px 20px", borderRadius: 14, border: "none", background: saving ? theme.border : T.teal, color: saving ? theme.textMuted : "white", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Agregar reporte al catálogo"}
              </button>
              {editing && <button onClick={resetForm} disabled={saving} style={{ padding: "12px 22px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.textSecondary, fontSize: 13, cursor: "pointer" }}>Cancelar</button>}
            </div>
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.textSecondary, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Reportes configurados ({list.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map(report => {
              const colors = categoryColors[report.category] || categoryColors.Comercial;
              return (
                <div key={report.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 16, background: theme.bgCard, border: `1px solid ${editing === report.id ? T.teal : theme.border}`, transition: "all .2s" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[report.icon]}</svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{report.name}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted, fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>ID: {report.id}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 3 }}>{report.owner || "Equipo BI"} · {report.refreshFrequency || "Según dataset"} · Criticidad {report.criticality || "media"} · Visibilidad: {getVisibilityLabel(report)}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: dark ? colors.darkText : colors.accent, background: dark ? colors.darkBg : colors.bg, padding: "3px 10px", borderRadius: 8 }}>{report.category}</span>
                  <StatusBadge status={report.status} dark={dark}/>
                  <button onClick={() => handleEdit(report)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textSecondary }}><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>
                  </button>
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setDeleteConfirm(deleteConfirm === report.id ? null : report.id)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: "#EF4444" }}><path d="M3 4h10M5.5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1m1.5 0l-.5 9a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1L4 4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
                    </button>
                    {deleteConfirm === report.id && (
                      <div style={{ position: "absolute", top: 38, right: 0, width: 230, padding: 16, borderRadius: 14, background: theme.bgCard, border: `1px solid ${theme.border}`, boxShadow: `0 8px 24px ${dark ? "rgba(0,0,0,.4)" : "rgba(0,0,0,.1)"}`, zIndex: 10 }}>
                        <p style={{ fontSize: 12, color: theme.text, marginBottom: 10 }}>¿Eliminar "{report.name}" del catálogo compartido?</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleDelete(report.id)} style={{ flex: 1, padding: "8px", borderRadius: 10, border: "none", background: "#EF4444", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>
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
.powerbi-embed-shell iframe,
.powerbi-embed-shell > div,
.powerbi-embed-shell [id^="pbi-container-"] {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
}

::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
@media (max-width: 1024px) {
  .requests-layout { grid-template-columns: 1fr !important; }
}
@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .sidebar-responsive {
    display: flex !important;
    width: 260px !important;
    transform: translateX(-110%);
    transition: transform .28s cubic-bezier(.4,0,.2,1), box-shadow .28s;
    z-index: 140 !important;
    box-shadow: none;
  }
  .sidebar-responsive.mobile-open {
    transform: translateX(0) !important;
    box-shadow: 18px 0 48px rgba(0,0,0,.22);
  }
  .mobile-sidebar-backdrop {
    display: block !important;
  }
  .main-content-responsive { margin-left: 0 !important; }
  .mobile-menu-btn { display: flex !important; }
  .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
  .reports-grid { grid-template-columns: 1fr !important; }
  .welcome-time { display: none !important; }
  .topbar-search { display: none !important; }
  .metrics-grid { grid-template-columns: 1fr !important; }
  .requests-layout { grid-template-columns: 1fr !important; }
}
@media (min-width: 769px) {
  .mobile-menu-btn { display: none !important; }
  .mobile-sidebar-backdrop { display: none !important; }
}
`;

// ========================
// SIDEBAR COMPONENT
// ========================
function Sidebar({ dark, collapsed, setCollapsed, activeView, setActiveView, categories, activeCategory, setActiveCategory, reports, favorites, requests = [], user, onLogout, isUserAdmin, mobileOpen = false, onMobileClose }) {
  const theme = dark ? darkTheme : lightTheme;
  const w = collapsed ? 68 : 260;

  const navItems = [
    { id: "dashboard", icon: <svg width="18" height="18" viewBox="0 0 16 16"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>, label: "Dashboard" },
    { id: "favorites", icon: <svg width="18" height="18" viewBox="0 0 16 16"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>, label: "Favoritos", count: favorites.length },
    { id: "recent", icon: <svg width="18" height="18" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>, label: "Recientes" },
    { id: "requests", icon: <svg width="18" height="18" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5 6h6M5 8.5h4M5 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>, label: "Solicitudes BI", count: requests.filter(r => isUserAdmin || r.userEmail === user?.email).length },
    ...(isUserAdmin ? [{ id: "metrics", icon: <svg width="18" height="18" viewBox="0 0 16 16"><path d="M2 14l4-5 3 2 5-7" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>, label: "Métricas" }] : []),
  ];

  return (
    <div className={`sidebar-responsive ${mobileOpen ? "mobile-open" : ""}`} style={{
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
              <button key={item.id} onClick={() => { setActiveView(item.id); if (onMobileClose) onMobileClose(); }} style={{
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
                <button key={cat} onClick={() => { setActiveCategory(active ? "Todos" : cat); setActiveView("dashboard"); if (onMobileClose) onMobileClose(); }} style={{
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
            <div style={{ fontSize: 13, fontWeight: 400, color: theme.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
              {time.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", hour12: false })}
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
  const lastActivity = recentViews.length > 0 && recentViews[0].viewedAt ? new Date(recentViews[0].viewedAt).toLocaleString("es-PY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "Sin actividad";
  const kpis = [
    { label: "Reportes disponibles", value: reports.length, color: T.teal, sparkData: [reports.length - 2, reports.length - 1, reports.length, reports.length, reports.length + 1, reports.length, reports.length], icon: <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="8" width="3" height="6" rx="1" fill="currentColor" opacity=".5"/><rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" opacity=".7"/><rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor"/></svg> },
    { label: "Reportes activos", value: reports.filter(r => r.status === "live").length, color: "#10B981", sparkData: weeklyData, icon: <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".3"/></svg> },
    { label: "Favoritos", value: favorites.length, color: "#F59E0B", sparkData: [1, 2, 1, 3, 2, favorites.length, favorites.length], icon: <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg> },
    { label: "Última actividad", value: lastActivity, isText: true, color: "#6366F1", sparkData: weeklyData, icon: <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg> },
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
          <div style={{ fontSize: kpi.isText ? 13 : 26, fontWeight: kpi.isText ? 500 : 600, color: theme.text }}>{kpi.value}</div>
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
  const statuses = { live: { label: "Conectado al Power Fabric", color: "#10B981", bg: dark ? "#10B98115" : "#D1FAE5" }, draft: { label: "Sin datos", color: "#F59E0B", bg: dark ? "#F59E0B15" : "#FEF3C7" }, maintenance: { label: "Sin conexión", color: "#EF4444", bg: dark ? "#EF444415" : "#FEE2E2" } };
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [detailReport, setDetailReport] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [recentViews, setRecentViews] = useState([]);
  const [cmdK, setCmdK] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [requestTypeFilter, setRequestTypeFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestAdminNote, setRequestAdminNote] = useState("");
  const [requestSyncStatus, setRequestSyncStatus] = useState("local");
  const [requestSyncMessage, setRequestSyncMessage] = useState("Guardado local");
  const [reportSyncStatus, setReportSyncStatus] = useState("local");
  const [reportSyncMessage, setReportSyncMessage] = useState("Catálogo local");
  const [exporting, setExporting] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [actionDetails, setActionDetails] = useState("");
  const [toast, setToast] = useState(null);

  const theme = dark ? darkTheme : lightTheme;
  const toggleFav = useCallback((id, e) => { e.stopPropagation(); setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]); }, []);
  const historyInitializedRef = useRef(false);

  const buildUiState = useCallback((overrides = {}) => ({
    app: "datareports",
    activeView,
    selectedReportId: selectedReport?.id || null,
    detailReportId: detailReport?.id || null,
    showAdmin: !!showAdmin,
    ...overrides,
  }), [activeView, selectedReport, detailReport, showAdmin]);

  const buildUiHash = useCallback((state) => {
    if (state?.detailReportId) return `#details=${state.detailReportId}`;
    if (state?.selectedReportId) return `#report=${state.selectedReportId}`;
    if (state?.showAdmin) return "#admin";
    return `#${state?.activeView || "dashboard"}`;
  }, []);

  const applyUiState = useCallback((state = {}) => {
    const next = {
      activeView: "dashboard",
      selectedReportId: null,
      detailReportId: null,
      showAdmin: false,
      ...state,
    };

    setShowNotif(false);
    setCmdK(false);
    setActionModal(null);
    setSelectedRequest(null);
    setShowAdmin(!!next.showAdmin);
    setActiveView(next.activeView || "dashboard");
    setSelectedReport(next.selectedReportId ? (reports.find(r => r.id === next.selectedReportId) || null) : null);
    setDetailReport(next.detailReportId ? (reports.find(r => r.id === next.detailReportId) || null) : null);
  }, [reports]);

  const replaceUiState = useCallback((overrides = {}) => {
    const next = buildUiState(overrides);
    window.history.replaceState(next, "", buildUiHash(next));
  }, [buildUiHash, buildUiState]);

  const pushUiState = useCallback((overrides = {}) => {
    const next = buildUiState(overrides);
    window.history.pushState(next, "", buildUiHash(next));
  }, [buildUiHash, buildUiState]);

  const navigateToView = useCallback((view, options = {}) => {
    const { pushHistory = true } = options;
    setActiveView(view);
    setSelectedRequest(null);
    if (pushHistory) {
      pushUiState({ activeView: view, selectedReportId: null, detailReportId: null, showAdmin: false });
    }
  }, [pushUiState]);

  const openAdminPanel = useCallback((options = {}) => {
    const { pushHistory = true } = options;
    setShowAdmin(true);
    if (pushHistory) {
      pushUiState({ showAdmin: true, selectedReportId: null, detailReportId: null });
    }
  }, [pushUiState]);

  const closeAdminPanel = useCallback((options = {}) => {
    const { pushHistory = true } = options;
    setShowAdmin(false);
    if (pushHistory) {
      pushUiState({ showAdmin: false, selectedReportId: null, detailReportId: null });
    }
  }, [pushUiState]);

  const openDetailPanel = useCallback((report, options = {}) => {
    if (!report) return;
    const { pushHistory = true } = options;
    setDetailReport(report);
    if (pushHistory) {
      pushUiState({ detailReportId: report.id, selectedReportId: selectedReport?.id || null, showAdmin: false });
    }
  }, [pushUiState, selectedReport]);

  const closeDetailPanel = useCallback((options = {}) => {
    const { pushHistory = true } = options;
    setDetailReport(null);
    if (pushHistory) {
      pushUiState({ detailReportId: null, selectedReportId: selectedReport?.id || null, showAdmin: false });
    }
  }, [pushUiState, selectedReport]);

  const closeReportViewer = useCallback((options = {}) => {
    const { pushHistory = true } = options;
    setSelectedReport(null);
    setDetailReport(null);
    if (pushHistory) {
      pushUiState({ selectedReportId: null, detailReportId: null, showAdmin: false });
    }
  }, [pushUiState]);

  useEffect(() => {
    const savedState = loadPortalState();
    if (savedState.favorites) setFavorites(savedState.favorites);
    if (savedState.recentViews) setRecentViews(savedState.recentViews);
    if (savedState.notifications) setNotifications(savedState.notifications);
    if (savedState.requests) setRequests(savedState.requests);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || historyInitializedRef.current) return;
    historyInitializedRef.current = true;
    const initialState = buildUiState({ activeView: "dashboard", selectedReportId: null, detailReportId: null, showAdmin: false });
    window.history.replaceState(initialState, "", buildUiHash(initialState));
  }, [loaded, buildUiState, buildUiHash]);

  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state?.app === "datareports"
        ? event.state
        : { activeView: "dashboard", selectedReportId: null, detailReportId: null, showAdmin: false };
      applyUiState(state);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [applyUiState]);

  const saveAll = useCallback((r, f, rv, n, req) => {
    try {
      savePortalState({
        favorites: f,
        recentViews: rv,
        notifications: n || [],
        requests: req || [],
      });
    } catch (e) {}
  }, []);

  const fetchSharedReports = useCallback(async () => {
    try {
      const data = await fetchReportsCatalog({ getAccessToken });
      if (!Array.isArray(data.reports)) throw new Error("invalid-shared-reports-response");

      // Netlify Blobs es la fuente oficial. Si el admin eliminó reportes, también debe verse vacío.
      const sharedReports = normalizeReports(data.reports);
      setReports(sharedReports);
      saveAll(sharedReports, favorites, recentViews, notifications, requests);

      setReportSyncStatus("shared");
      setReportSyncMessage(sharedReports.length ? "Catálogo sincronizado" : "Catálogo sincronizado: sin reportes");
    } catch (e) {
      setReportSyncStatus("local");
      setReportSyncMessage("Catálogo local: pendiente conectar bi-reports");
    }
  }, [user?.email, favorites, recentViews, notifications, requests, saveAll]);

  // Cargar catálogo central al iniciar sesión y mantenerlo actualizado para todos los usuarios.
  useEffect(() => {
    if (!loaded || !user?.email) return;
    fetchSharedReports();
  }, [loaded, user?.email, fetchSharedReports]);

  // Refrescar catálogo al volver a la pestaña y cada minuto. Así los usuarios ven cambios del admin sin limpiar caché.
  useEffect(() => {
    if (!loaded || !user?.email) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchSharedReports();
    };

    const interval = setInterval(() => {
      fetchSharedReports();
    }, 60000);

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loaded, user?.email, fetchSharedReports]);

  const pushSharedReports = async (newReports) => {
    const cleanReports = normalizeReports(newReports);

    // Actualización optimista: el cambio se ve en pantalla de inmediato.
    setReports(cleanReports);
    saveAll(cleanReports, favorites, recentViews, notifications, requests);

    try {
      const data = await saveReportsCatalog({
        getAccessToken,
        reports: cleanReports,
        user: { name: user?.name, email: user?.email },
      });
      let syncedReports = normalizeReports(data.reports || cleanReports);

      // Refetch de confirmación: evita delays visuales si Netlify Blobs demora unos ms.
      try {
        const confirmData = await fetchReportsCatalog({ getAccessToken });
        if (Array.isArray(confirmData.reports)) {
          syncedReports = normalizeReports(confirmData.reports);
        }
      } catch (confirmError) {
        console.warn("Confirmación de catálogo no disponible:", confirmError);
      }

      setReports(syncedReports);
      saveAll(syncedReports, favorites, recentViews, notifications, requests);
      setReportSyncStatus("shared");
      setReportSyncMessage("Catálogo sincronizado");
      return { ok: true, synced: true, reports: syncedReports };
    } catch (e) {
      const localReports = normalizeReports(newReports);
      setReports(localReports);
      saveAll(localReports, favorites, recentViews, notifications, requests);
      setReportSyncStatus("local");
      setReportSyncMessage("Cambios guardados localmente");
      return { ok: true, synced: false, reports: localReports };
    }
  };

  const saveReports = async (newReports) => {
    const cleanReports = normalizeReports(newReports);
    const existing = reports.map(r => r.id);
    const added = cleanReports.filter(r => !existing.includes(r.id));
    let updatedNotifs = notifications;
    if (added.length > 0) {
      updatedNotifs = [...added.map(r => ({ id: Date.now() + Math.random(), type: "new", message: `Nuevo reporte agregado: ${r.name}`, time: new Date().toISOString(), reportId: r.id, read: false })), ...notifications].slice(0, 20);
      setNotifications(updatedNotifs);
    }
    const result = await pushSharedReports(cleanReports);
    const finalReports = normalizeReports(result.reports || cleanReports);

    // Mantener sincronizados los paneles abiertos sin obligar a recargar la página.
    if (selectedReport) {
      const updatedSelected = finalReports.find(r => r.id === selectedReport.id);
      if (updatedSelected) setSelectedReport(updatedSelected);
    }

    if (detailReport) {
      const updatedDetail = finalReports.find(r => r.id === detailReport.id);
      if (updatedDetail) setDetailReport(updatedDetail);
    }

    saveAll(finalReports, favorites, recentViews, updatedNotifs, requests);
    return { ...result, reports: finalReports };
  };

  useEffect(() => { if (loaded) saveAll(reports, favorites, recentViews, notifications, requests); }, [favorites, requests, loaded]);

  useEffect(() => {
    if (!loaded) return;

    if (selectedReport) {
      const freshSelected = reports.find(r => r.id === selectedReport.id);
      if (freshSelected && JSON.stringify(freshSelected) !== JSON.stringify(selectedReport)) {
        setSelectedReport(freshSelected);
      }
    }

    if (detailReport) {
      const freshDetail = reports.find(r => r.id === detailReport.id);
      if (freshDetail && JSON.stringify(freshDetail) !== JSON.stringify(detailReport)) {
        setDetailReport(freshDetail);
      }
    }
  }, [reports, loaded]);

  // Track recent views
  const openReport = (report, options = {}) => {
    if (!canUserViewReport(report, user)) {
      showToast("No tenés permiso para ver este reporte en DataReports", "error");
      return;
    }
    const { pushHistory = true } = options;
    setSelectedReport(report);
    setDetailReport(null);
    if (pushHistory) {
      pushUiState({ selectedReportId: report.id, detailReportId: null, showAdmin: false });
    }
    const newRecent = [{ ...report, viewedAt: new Date().toISOString() }, ...recentViews.filter(r => r.id !== report.id)].slice(0, 10);
    setRecentViews(newRecent);
    saveAll(reports, favorites, newRecent, notifications, requests);
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
    saveAll(reports, favorites, recentViews, updated, requests);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchSharedRequests = useCallback(async () => {
    try {
      const data = await fetchBiRequests({ getAccessToken });
      if (Array.isArray(data.requests)) {
        setRequests(data.requests);
        saveAll(reports, favorites, recentViews, notifications, data.requests);
        setRequestSyncStatus("shared");
        setRequestSyncMessage("Sincronizado con Netlify");
      }
    } catch (e) {
      setRequestSyncStatus("local");
      setRequestSyncMessage("Modo local: pendiente conectar función Netlify");
    }
  }, [user?.email, reports, favorites, recentViews, notifications, saveAll]);

  useEffect(() => {
    if (loaded && user?.email) fetchSharedRequests();
  }, [loaded, user?.email, fetchSharedRequests]);

  useEffect(() => {
    setRequestAdminNote(selectedRequest?.adminNote || "");
  }, [selectedRequest?.id, selectedRequest?.adminNote]);

  const pushSharedRequest = async (request) => {
    try {
      const data = await createBiRequest({ getAccessToken, request });
      if (Array.isArray(data.requests)) {
        setRequests(data.requests);
        saveAll(reports, favorites, recentViews, notifications, data.requests);
      }
      setRequestSyncStatus("shared");
      setRequestSyncMessage("Sincronizado con Netlify");
      return true;
    } catch (e) {
      setRequestSyncStatus("local");
      setRequestSyncMessage("Guardado local: no se pudo sincronizar con Netlify");
      return false;
    }
  };

  const patchSharedRequestStatus = async (requestId, updates) => {
    try {
      const data = await updateBiRequestStatus({ getAccessToken, requestId, ...updates });
      if (Array.isArray(data.requests)) {
        setRequests(data.requests);
        saveAll(reports, favorites, recentViews, notifications, data.requests);
        if (selectedRequest?.id === requestId) setSelectedRequest(data.requests.find(req => req.id === requestId));
      }
      setRequestSyncStatus("shared");
      setRequestSyncMessage("Sincronizado con Netlify");
      return true;
    } catch (e) {
      setRequestSyncStatus("local");
      setRequestSyncMessage("Cambio guardado localmente");
      return false;
    }
  };

  const openActionModal = (type, report) => {
    setActionModal({ type, report });
    setActionDetails("");
  };

  const submitActionModal = async () => {
    if (!actionModal?.report) return;
    const cleanDetails = actionDetails.trim();
    const { request: newRequest, notification: newNotif } = createBiPortalRequest({
      actionType: actionModal.type,
      report: actionModal.report,
      details: cleanDetails,
      user,
    });
    const updatedNotifs = [newNotif, ...notifications].slice(0, 30);
    const updatedRequests = [newRequest, ...requests].slice(0, 100);
    setNotifications(updatedNotifs);
    setRequests(updatedRequests);
    saveAll(reports, favorites, recentViews, updatedNotifs, updatedRequests);
    const synced = await pushSharedRequest(newRequest);
    setActionModal(null);
    setActionDetails("");
    if (synced) {
      showToast(actionModal.type === "issue" ? "Problema registrado y compartido con BI" : "Solicitud de cambio compartida con BI");
    } else {
      showToast(actionModal.type === "issue" ? "Problema guardado localmente; falta sincronización" : "Solicitud guardada localmente; falta sincronización", "error");
    }
  };

  const copyReportLink = async (report) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#report=${report.id}`);
      showToast("Link del reporte copiado");
    } catch (e) {
      showToast("No se pudo copiar el link", "error");
    }
  };

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

  const userVisibleReports = reports.filter(r => canUserViewReport(r, user));
  const categories = ["Todos", ...new Set(userVisibleReports.map(r => r.category))];
  let filtered = userVisibleReports.filter(r => {
    const matchCat = activeCategory === "Todos" || r.category === activeCategory;
    const matchSearch = (r.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (r.description || "").toLowerCase().includes(searchQuery.toLowerCase()) || (r.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchCat && matchSearch && matchStatus;
  });

  // Sorting
  if (sortBy === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === "category") filtered.sort((a, b) => a.category.localeCompare(b.category));
  else if (sortBy === "status") filtered.sort((a, b) => a.status.localeCompare(b.status));

  // View-specific filtering
  const displayReports = activeView === "favorites" ? filtered.filter(r => favorites.includes(r.id))
    : activeView === "recent" ? recentViews.filter(r => userVisibleReports.some(rr => rr.id === r.id))
    : filtered;

  const requestStatusLabels = REQUEST_STATUS_LABELS;
  const requestPriorityLabels = REQUEST_PRIORITY_LABELS;
  const visibleRequests = getVisibleRequests(requests, user);
  const filteredRequests = filterRequests(visibleRequests, {
    statusFilter: requestStatusFilter,
    typeFilter: requestTypeFilter,
    query: searchQuery,
  });
  const requestStats = getRequestStats(visibleRequests);

  const updateRequestWorkflow = async (requestId, updates, toastMessage) => {
    const updatedRequests = updateRequestStatusInList(requests, requestId, updates, user);
    setRequests(updatedRequests);
    if (selectedRequest?.id === requestId) setSelectedRequest(updatedRequests.find(req => req.id === requestId));
    saveAll(reports, favorites, recentViews, notifications, updatedRequests);
    const synced = await patchSharedRequestStatus(requestId, updates);
    showToast(synced ? toastMessage : `${toastMessage}; pendiente sincronización`, synced ? "success" : "error");
  };

  const updateRequestStatus = (requestId, status) => {
    updateRequestWorkflow(requestId, { status }, `Solicitud marcada como ${requestStatusLabels[status] || status}`);
  };

  const updateRequestPriority = (requestId, priority) => {
    updateRequestWorkflow(requestId, { priority }, `Prioridad actualizada a ${requestPriorityLabels[priority] || priority}`);
  };

  const saveRequestAdminNote = () => {
    if (!selectedRequest) return;
    updateRequestWorkflow(selectedRequest.id, { adminNote: requestAdminNote }, "Nota administrativa guardada");
  };

  const sidebarWidth = sidebarCollapsed ? 68 : 260;

  const renderToast = () => toast && (
    <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 160, padding: "12px 16px", borderRadius: 14, background: toast.type === "error" ? (dark ? "#7F1D1D" : "#FEF2F2") : (dark ? "#064E3B" : "#D1FAE5"), border: `1px solid ${toast.type === "error" ? (dark ? "#F8717144" : "#FECACA") : (dark ? "#34D39944" : "#A7F3D0")}`, color: toast.type === "error" ? (dark ? "#FCA5A5" : "#991B1B") : (dark ? "#A7F3D0" : "#065F46"), boxShadow: `0 12px 36px ${dark ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.12)"}`, fontSize: 13, fontWeight: 500, animation: "scaleIn .2s ease-out" }}>
      {toast.message}
    </div>
  );

  const renderRequestsPanel = () => {
    const statusColor = (status) => getRequestStatusColor(status, T.teal);

    const RequestBadge = ({ children, color }) => (
      <span style={{ fontSize: 10, fontWeight: 600, color, background: dark ? color + "16" : color + "14", padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{children}</span>
    );

    return (
      <div style={{ animation: "fadeUp .35s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Gestión de solicitudes</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>Problemas, cambios y seguimiento de reportes BI.</div>
          </div>
          <button onClick={fetchSharedRequests} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 12, border: `1px solid ${requestSyncStatus === "shared" ? T.teal + "55" : theme.border}`, background: requestSyncStatus === "shared" ? (dark ? T.teal + "14" : T.tealBg) : theme.bgCard, color: requestSyncStatus === "shared" ? T.teal : theme.textMuted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: requestSyncStatus === "shared" ? "#10B981" : "#F59E0B" }}/>
            {requestSyncMessage}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 18 }} className="kpi-grid">
          {[
            { label: "Solicitudes", value: requestStats.total, color: T.teal },
            { label: "Nuevas", value: requestStats.new, color: "#F59E0B" },
            { label: "En proceso", value: requestStats.inProgress, color: "#3B82F6" },
            { label: "Fuera SLA", value: requestStats.breached, color: "#EF4444" },
          ].map((item, i) => (
            <div key={item.label} style={{ background: theme.bgCard, borderRadius: 16, border: `1px solid ${theme.border}`, padding: "16px 18px", animation: `scaleIn .3s ease-out ${.04 * i}s both` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{item.value}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{item.label}</div>
              <div style={{ height: 3, borderRadius: 4, background: item.color, opacity: .85, marginTop: 12 }}/>
            </div>
          ))}
        </div>

        <div style={{ background: theme.bgCard, borderRadius: 18, border: `1px solid ${theme.border}`, padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: theme.bgSurface, border: `1px solid ${theme.border}` }}>
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textMuted }}><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" fill="none"/><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar por reporte, usuario o detalle..." style={{ width: "100%", border: "none", outline: "none", background: "transparent", color: theme.text, fontSize: 13, fontFamily: "'Outfit', system-ui" }}/>
          </div>
          <select value={requestStatusFilter} onChange={e => setRequestStatusFilter(e.target.value)} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgSurface, color: theme.text, fontSize: 12 }}>
            {REQUEST_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select value={requestTypeFilter} onChange={e => setRequestTypeFilter(e.target.value)} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgSurface, color: theme.text, fontSize: 12 }}>
            {REQUEST_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="requests-layout" style={{ display: "grid", gridTemplateColumns: selectedRequest ? "minmax(0, 1fr) 420px" : "1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredRequests.length === 0 ? (
              <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 44, textAlign: "center" }}>
                <svg width="48" height="48" viewBox="0 0 16 16" style={{ color: theme.border, marginBottom: 12 }}><rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5 6h6M5 8.5h4M5 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                <p style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>No hay solicitudes con estos filtros</p>
                <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 6 }}>Cuando un usuario reporte problemas o pida cambios, aparecerán acá.</p>
              </div>
            ) : filteredRequests.map((req, i) => {
              const color = statusColor(req.status);
              const sla = getRequestSla(req);
              return (
                <button key={req.id} onClick={() => setSelectedRequest(req)} style={{ textAlign: "left", background: selectedRequest?.id === req.id ? (dark ? T.teal + "10" : T.tealBg) : theme.bgCard, border: `1px solid ${selectedRequest?.id === req.id ? T.teal + "55" : theme.border}`, borderRadius: 16, padding: "16px 18px", cursor: "pointer", transition: "all .2s", animation: `scaleIn .25s ease-out ${.03 * i}s both` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                        <RequestBadge color={req.type === "issue" ? "#EF4444" : "#6366F1"}>{req.typeLabel}</RequestBadge>
                        <RequestBadge color={color}>{requestStatusLabels[req.status] || req.status}</RequestBadge>
                        <RequestBadge color={sla.color}>{sla.label}</RequestBadge>
                        <RequestBadge color="#F59E0B">{requestPriorityLabels[req.priority] || req.priority}</RequestBadge>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{req.reportName}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>{req.id} · {timeAgo(req.createdAt)}</div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 11, color: theme.textMuted }}>
                      <div>{req.userName}</div>
                      <div style={{ marginTop: 2 }}>{req.userEmail}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{req.details}</p>
                  <div style={{ marginTop: 12, height: 4, borderRadius: 999, background: dark ? "rgba(148,163,184,.18)" : "#E5E7EB", overflow: "hidden" }}>
                    <div style={{ width: `${sla.progress}%`, height: "100%", background: sla.color, borderRadius: 999 }}/>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: theme.textMuted }}>{sla.detail} · SLA objetivo {sla.targetHours}h</div>
                </button>
              );
            })}
          </div>

          {selectedRequest && (
            <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 18, overflow: "hidden", alignSelf: "start", position: "sticky", top: 86 }}>
              <div style={{ padding: "18px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>{selectedRequest.title}</h3>
                  <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{selectedRequest.id}</p>
                </div>
                <button onClick={() => setSelectedRequest(null)} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgSurface, color: theme.textMuted, cursor: "pointer" }}>×</button>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  <RequestBadge color={selectedRequest.type === "issue" ? "#EF4444" : "#6366F1"}>{selectedRequest.typeLabel}</RequestBadge>
                  <RequestBadge color={statusColor(selectedRequest.status)}>{requestStatusLabels[selectedRequest.status] || selectedRequest.status}</RequestBadge>
                  <RequestBadge color="#F59E0B">Prioridad {requestPriorityLabels[selectedRequest.priority] || selectedRequest.priority}</RequestBadge>
                  <RequestBadge color={getRequestSla(selectedRequest).color}>{getRequestSla(selectedRequest).label}</RequestBadge>
                </div>
                <div style={{ marginBottom: 18, padding: 14, borderRadius: 14, background: theme.bgSurface, border: `1px solid ${theme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: theme.textMuted }}>SLA operativo</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{getRequestSla(selectedRequest).detail}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: getRequestSla(selectedRequest).color }}>{getRequestSla(selectedRequest).targetHours}h objetivo</div>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: dark ? "rgba(148,163,184,.18)" : "#E5E7EB", overflow: "hidden", marginBottom: 14 }}>
                    <div style={{ width: `${getRequestSla(selectedRequest).progress}%`, height: "100%", background: getRequestSla(selectedRequest).color, borderRadius: 999 }}/>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${REQUEST_STATUS_FLOW.length}, 1fr)`, gap: 6 }}>
                    {REQUEST_STATUS_FLOW.map((status, index) => {
                      const activeIndex = REQUEST_STATUS_FLOW.indexOf(selectedRequest.status);
                      const isDone = selectedRequest.status === "rejected" ? status === "new" : index <= activeIndex;
                      return (
                        <div key={status} style={{ minWidth: 0 }}>
                          <div style={{ height: 4, borderRadius: 999, background: isDone ? statusColor(status) : theme.border, marginBottom: 6 }}/>
                          <div style={{ fontSize: 9, color: isDone ? theme.text : theme.textMuted, fontWeight: isDone ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{requestStatusLabels[status]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[{ label: "Reporte", value: selectedRequest.reportName }, { label: "Categoría", value: selectedRequest.reportCategory }, { label: "Usuario", value: selectedRequest.userName }, { label: "Correo", value: selectedRequest.userEmail }].map((item) => (
                    <div key={item.label} style={{ background: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 5 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: theme.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>Detalle / observación</div>
                  <div style={{ padding: 14, borderRadius: 12, background: theme.bgSurface, border: `1px solid ${theme.border}`, fontSize: 13, lineHeight: 1.65, color: theme.text }}>{selectedRequest.details}</div>
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 16 }}>
                  Creado: {new Date(selectedRequest.createdAt).toLocaleString("es-PY")}<br/>
                  Actualizado: {new Date(selectedRequest.updatedAt).toLocaleString("es-PY")}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 10 }}>Timeline</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {getRequestTimeline(selectedRequest).slice(0, 5).map((entry) => (
                      <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 10 }}>
                        <div style={{ width: 9, height: 9, borderRadius: 999, background: statusColor(entry.status), marginTop: 4, boxShadow: `0 0 0 4px ${statusColor(entry.status)}18` }}/>
                        <div>
                          <div style={{ fontSize: 12, color: theme.text, fontWeight: 600 }}>{entry.label || requestStatusLabels[entry.status] || "Actualización"}</div>
                          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>{entry.actorName || "Equipo BI"} · {new Date(entry.createdAt).toLocaleString("es-PY")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {isAdmin(user.email) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>Cambiar estado</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {Object.entries(requestStatusLabels).map(([key, label]) => (
                          <button key={key} onClick={() => updateRequestStatus(selectedRequest.id, key)} style={{ padding: "9px 10px", borderRadius: 10, border: `1px solid ${selectedRequest.status === key ? statusColor(key) : theme.border}`, background: selectedRequest.status === key ? (dark ? statusColor(key) + "18" : statusColor(key) + "12") : theme.bgSurface, color: selectedRequest.status === key ? statusColor(key) : theme.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>Prioridad</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {REQUEST_PRIORITY_OPTIONS.map((option) => (
                          <button key={option.value} onClick={() => updateRequestPriority(selectedRequest.id, option.value)} style={{ padding: "9px 8px", borderRadius: 10, border: `1px solid ${selectedRequest.priority === option.value ? "#F59E0B" : theme.border}`, background: selectedRequest.priority === option.value ? (dark ? "#F59E0B18" : "#FFFBEB") : theme.bgSurface, color: selectedRequest.priority === option.value ? "#F59E0B" : theme.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{option.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>Nota administrativa</div>
                      <textarea value={requestAdminNote} onChange={e => setRequestAdminNote(e.target.value)} maxLength={REQUEST_ADMIN_NOTE_MAX_LENGTH} placeholder="Agregar criterio, responsable, bloqueo o próxima acción..." style={{ width: "100%", minHeight: 82, resize: "vertical", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgSurface, color: theme.text, padding: 12, outline: "none", fontSize: 12, lineHeight: 1.55, fontFamily: "'Outfit', system-ui" }} />
                      <div style={{ marginTop: 6, fontSize: 10, color: theme.textMuted, textAlign: "right" }}>{requestAdminNote.length}/{REQUEST_ADMIN_NOTE_MAX_LENGTH}</div>
                      <button onClick={saveRequestAdminNote} style={{ marginTop: 8, width: "100%", padding: "10px 12px", borderRadius: 11, border: `1px solid ${T.teal}55`, background: dark ? T.teal + "14" : T.tealBg, color: T.teal, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Guardar nota</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActionModal = () => actionModal && (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setActionModal(null)}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: "96vw", background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 22, boxShadow: `0 24px 70px ${dark ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.18)"}`, overflow: "hidden", animation: "scaleIn .22s ease-out" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: theme.text }}>{actionModal.type === "issue" ? "Reportar problema" : "Solicitar cambio"}</h3>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>{actionModal.report?.name}</p>
          </div>
          <button onClick={() => setActionModal(null)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgSurface, color: theme.textMuted, cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ padding: "12px 14px", borderRadius: 14, background: actionModal.type === "issue" ? (dark ? "#EF444410" : "#FEF2F2") : (dark ? "#6366F115" : "#EEF2FF"), border: `1px solid ${actionModal.type === "issue" ? (dark ? "#EF444425" : "#FECACA") : (dark ? "#6366F133" : "#C7D2FE")}`, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: theme.text, lineHeight: 1.55 }}>
              {actionModal.type === "issue"
                ? "Describí brevemente el problema detectado: datos incorrectos, reporte sin carga, filtros que no responden, o cualquier comportamiento raro del tablero."
                : "Indicá qué ajuste necesitás: nueva métrica, filtro, visual, cambio de cálculo o mejora de presentación."}
            </p>
          </div>
          <textarea value={actionDetails} onChange={e => setActionDetails(e.target.value)} maxLength={REQUEST_DETAIL_MAX_LENGTH} placeholder={actionModal.type === "issue" ? "Ej: El reporte no actualiza datos desde ayer..." : "Ej: Agregar filtro por tienda y comparación vs año anterior..."} style={{ width: "100%", minHeight: 120, resize: "vertical", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.bgSurface, color: theme.text, padding: 14, outline: "none", fontSize: 13, lineHeight: 1.55, fontFamily: "'Outfit', system-ui" }} />
          <div style={{ marginTop: 6, fontSize: 10, color: theme.textMuted, textAlign: "right" }}>{actionDetails.length}/{REQUEST_DETAIL_MAX_LENGTH}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button onClick={() => setActionModal(null)} style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.textSecondary, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
            <button onClick={submitActionModal} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: actionModal.type === "issue" ? "#EF4444" : T.teal, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{actionModal.type === "issue" ? "Registrar problema" : "Enviar solicitud"}</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderViewerDetailPanel = () => detailReport && (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", justifyContent: "flex-end" }} onClick={() => closeDetailPanel()}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.38)", backdropFilter: "blur(3px)" }}/>
      <div onClick={e => e.stopPropagation()} style={{ width: 500, maxWidth: "95vw", height: "100vh", background: theme.bgCard, borderLeft: `1px solid ${theme.border}`, boxShadow: `0 0 60px ${dark ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.14)"}`, display: "flex", flexDirection: "column", animation: "slideInRight .25s ease-out", position: "relative", zIndex: 1 }}>
        {(() => {
          const colors = categoryColors[detailReport.category] || categoryColors.Comercial;
          const isFav = favorites.includes(detailReport.id);
          const isMaintenance = detailReport.status === "maintenance";
          return (<>
            <div style={{ padding: "24px 28px 20px", borderBottom: `1px solid ${theme.border}`, background: dark ? `linear-gradient(135deg, ${colors.darkBg}, transparent)` : `linear-gradient(135deg, ${colors.bg}, transparent)` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[detailReport.icon]}</svg>
                </div>
                <button onClick={() => closeDetailPanel()} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", color: theme.textMuted, fontSize: 16 }}>×</button>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 8 }}>{detailReport.name}</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: dark ? colors.darkText : colors.accent, background: dark ? colors.darkBg : colors.bg, padding: "4px 12px", borderRadius: 10 }}>{detailReport.category}</span>
                <StatusBadge status={detailReport.status} dark={dark}/>
                <HealthBadge report={detailReport} dark={dark}/>
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "20px 28px 28px" }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Descripción</p>
              <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.7, marginBottom: 16 }}>{getReportDescription(detailReport)}</p>
              <div style={{ padding: "14px 16px", borderRadius: 14, background: dark ? T.teal + "10" : T.tealBg, border: `1px solid ${dark ? T.teal + "22" : T.teal + "18"}`, marginBottom: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: T.teal, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>¿Para qué sirve?</p>
                <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.65 }}>{getReportPurpose(detailReport)}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {[{ label: "Responsable", value: detailReport.owner || "Equipo BI" }, { label: "Acceso", value: detailReport.accessLevel || detailReport.audience || "Corporativo" }, { label: "Fuente", value: detailReport.dataSource || "Power BI Service" }, { label: "Actualización", value: detailReport.refreshFrequency || "Según dataset" }].map((item, i) => (
                  <div key={i} style={{ background: theme.bgSurface, borderRadius: 12, padding: "12px 14px", border: `1px solid ${theme.border}` }}>
                    <p style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: .5, marginBottom: 5 }}>{item.label}</p>
                    <p style={{ fontSize: 13, color: theme.text, fontWeight: 500 }}>{item.value}</p>
                  </div>
                ))}
              </div>
              {isAdmin(user.email) && (
                <div style={{ background: theme.bgSurface, borderRadius: 14, padding: 16, border: `1px solid ${theme.border}`, marginBottom: 18 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Información técnica</p>
                  {[{ l: "Report ID", v: detailReport.id }, { l: "Workspace ID", v: detailReport.groupId || "My Workspace / no configurado" }, { l: "Criticidad", v: detailReport.criticality || "media" }, { l: "Última edición", v: detailReport.updatedAt ? new Date(detailReport.updatedAt).toLocaleString("es-PY") : "Sin registro" }].map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: i === 0 ? `1px solid ${theme.border}` : "none" }}>
                      <span style={{ fontSize: 12, color: theme.textMuted }}>{item.l}</span>
                      <span style={{ fontSize: 11, color: T.teal, fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.v}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={(e) => toggleFav(detailReport.id, e)} style={{ padding: "12px 16px", borderRadius: 12, border: `1px solid ${theme.border}`, background: isFav ? (dark ? "#F59E0B12" : "#FFFBEB") : theme.bgCard, color: theme.text, cursor: "pointer", textAlign: "left" }}>{isFav ? "Quitar de favoritos" : "Agregar a favoritos"}</button>
                <button onClick={() => openActionModal("issue", detailReport)} style={{ padding: "12px 16px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.text, cursor: "pointer", textAlign: "left" }}>Reportar problema</button>
                <button onClick={() => openActionModal("change", detailReport)} style={{ padding: "12px 16px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.text, cursor: "pointer", textAlign: "left" }}>Solicitar cambio</button>
                <button onClick={() => copyReportLink(detailReport)} style={{ padding: "12px 16px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.text, cursor: "pointer", textAlign: "left" }}>Copiar link del reporte</button>
              </div>
            </div>
            <div style={{ padding: "16px 28px", borderTop: `1px solid ${theme.border}`, display: "flex", gap: 10 }}>
              {!isMaintenance && <button onClick={() => { closeDetailPanel({ pushHistory: false }); openReport(detailReport); }} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${T.teal}, ${T.tealDark})`, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Abrir reporte</button>}
              <button onClick={() => closeDetailPanel()} style={{ padding: "14px 22px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.textSecondary, cursor: "pointer" }}>Cerrar</button>
            </div>
          </>);
        })()}
      </div>
    </div>
  );

  // REPORT VIEW — Premium Visor
  if (selectedReport) {
    const colors = categoryColors[selectedReport.category] || categoryColors.Comercial;
    const isFav = favorites.includes(selectedReport.id);
    const isMaintenance = selectedReport.status === "maintenance";
    const isDraft = selectedReport.status === "draft";
    const lastView = recentViews.find(r => r.id === selectedReport.id);
    const fullscreenToggle = () => { const el = document.getElementById("report-embed-container"); if (el) { if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); } };
    const zoomReport = (level) => { const c = document.getElementById(`pbi-container-${selectedReport.id}`); const service = getLoadedPowerBiService(); if (c && service) { try { const e = service.get(c); if (e) e.setZoom(level / 100); } catch(err) {} } };
    const reloadReport = () => { const c = document.getElementById(`pbi-container-${selectedReport.id}`); const service = getLoadedPowerBiService(); if (c && service) { try { const e = service.get(c); if (e) e.reload(); } catch(err) {} } };
    const printReport = () => { const c = document.getElementById(`pbi-container-${selectedReport.id}`); const service = getLoadedPowerBiService(); if (c && service) { try { const e = service.get(c); if (e) e.print(); } catch(err) {} } };

    return (
      <div style={{ fontFamily: "'Outfit', system-ui", height: "100vh", minHeight: 0, overflow: "hidden", background: theme.bg, display: "flex", flexDirection: "column" }}>
        <style>{globalStyles}</style>
        {renderViewerDetailPanel()}
        {renderActionModal()}
        {renderToast()}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => closeReportViewer()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: `1px solid ${theme.border}`, borderRadius: 10, background: theme.bgSurface, cursor: "pointer", fontSize: 12, color: theme.textSecondary, transition: "all .2s" }}>
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Volver
            </button>
            <div style={{ width: 1, height: 24, background: theme.border }}/>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[selectedReport.icon]}</svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>{selectedReport.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                  <span style={{ fontSize: 10, color: theme.textMuted }}>{selectedReport.category}</span>
                  <span style={{ fontSize: 10, color: theme.textMuted }}>·</span>
                  <span style={{ fontSize: 10, color: theme.textMuted }}>{lastView ? timeAgo(lastView.viewedAt) : "Primera visita"}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button onClick={(e) => toggleFav(selectedReport.id, e)} title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${theme.border}`, background: isFav ? (dark ? "#F59E0B12" : "#FFFBEB") : theme.bgCard, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" fill={isFav ? "#FBBF24" : "none"} stroke={isFav ? "#FBBF24" : theme.textMuted} strokeWidth="1.2"/></svg>
            </button>
            <button onClick={() => openDetailPanel(selectedReport)} title="Ver detalles" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgCard, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textSecondary }}><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 7v4m0-6.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <StatusBadge status={selectedReport.status} dark={dark}/>
          </div>
        </div>

        {/* Toolbar */}
        {!isMaintenance && !isDraft && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 20px", background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, flexShrink: 0, flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 4, background: "#10B981", animation: "breathe 3s ease-in-out infinite" }}/>
            <span style={{ fontSize: 10, color: theme.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>Conectado</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: theme.textMuted, marginRight: 4 }}>Zoom:</span>
            {[75, 100, 125, 150].map(z => (
              <button key={z} onClick={() => zoomReport(z)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", fontSize: 10, color: theme.textSecondary, transition: "all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.teal; e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = T.teal; }}
                onMouseLeave={e => { e.currentTarget.style.background = theme.bgSurface; e.currentTarget.style.color = theme.textSecondary; e.currentTarget.style.borderColor = theme.border; }}>
                {z}%
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: theme.border, margin: "0 6px" }}/>
            <button onClick={reloadReport} title="Recargar reporte" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" style={{ color: theme.textSecondary }}><path d="M2 8a6 6 0 0 1 10.5-4M14 8a6 6 0 0 1-10.5 4M2 4V8h4M14 12V8h-4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={printReport} title="Imprimir / Guardar PDF" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" style={{ color: theme.textSecondary }}><path d="M4 4V2h8v2m-8 4H2v5h2m8 0h2V8h-2M4 11h8v3H4v-3z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={fullscreenToggle} title="Pantalla completa" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" style={{ color: theme.textSecondary }}><path d="M2 5V3a1 1 0 0 1 1-1h2m6 0h2a1 1 0 0 1 1 1v2m0 6v2a1 1 0 0 1-1 1h-2m-6 0H3a1 1 0 0 1-1-1v-2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>
        )}

        {/* Report embed area */}
        <div style={{ flex: 1, minHeight: 0, height: "100%", padding: "12px 16px 16px", animation: "fadeUp .3s ease-out", overflow: "hidden" }}>
          <div id="report-embed-container" className="powerbi-embed-shell" style={{ height: "100%", minHeight: 0, background: theme.bgCard, borderRadius: 16, border: `1px solid ${theme.border}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, minHeight: 0, height: "100%", overflow: "hidden" }}>
              {isMaintenance ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: dark ? "#0D0F14" : "#F9FAFB", padding: 32 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 20, background: dark ? "#EF444412" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                    <svg width="32" height="32" viewBox="0 0 16 16" style={{ color: "#EF4444" }}><path d="M6.5 1.5h3l.5 2 1.5.7 1.8-1 2.1 2.1-1 1.8.7 1.5 2 .5v3l-2 .5-.7 1.5 1 1.8-2.1 2.1-1.8-1-1.5.7-.5 2h-3l-.5-2-1.5-.7-1.8 1-2.1-2.1 1-1.8L1.5 9.5l-2-.5v-3l2-.5.7-1.5-1-1.8 2.1-2.1 1.8 1L6.5 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 500, color: theme.text, marginBottom: 6 }}>Reporte en mantenimiento</p>
                  <p style={{ fontSize: 13, color: theme.textMuted, textAlign: "center", maxWidth: 360, lineHeight: 1.6, marginBottom: 24 }}>
                    Este reporte no está disponible temporalmente. Contactá al equipo BI si necesitás acceso urgente.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => closeReportViewer()} style={{ padding: "10px 24px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.textSecondary, fontSize: 13, cursor: "pointer" }}>Volver al catálogo</button>
                    <button onClick={() => openDetailPanel(selectedReport)} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: T.teal, color: "white", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Ver detalles</button>
                  </div>
                </div>
              ) : isDraft ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: dark ? "#0D0F14" : "#F9FAFB", padding: 32 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 20, background: dark ? "#F59E0B12" : "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                    <svg width="32" height="32" viewBox="0 0 16 16" style={{ color: "#F59E0B" }}><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/></svg>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 500, color: theme.text, marginBottom: 6 }}>Reporte en borrador</p>
                  <p style={{ fontSize: 13, color: theme.textMuted, textAlign: "center", maxWidth: 360, lineHeight: 1.6, marginBottom: 24 }}>Este reporte aún no ha sido publicado y no está disponible para visualización.</p>
                  <button onClick={() => closeReportViewer()} style={{ padding: "10px 24px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.textSecondary, fontSize: 13, cursor: "pointer" }}>Volver al catálogo</button>
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
      {showAdmin && <AdminPanel reports={reports} onSave={saveReports} onClose={() => closeAdminPanel()} dark={dark} reportSyncStatus={reportSyncStatus} reportSyncMessage={reportSyncMessage} currentUser={user}/>}
      {showNotif && <div onClick={() => setShowNotif(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }}/>}
      {renderActionModal()}
      {renderToast()}

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
              {userVisibleReports.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.category.toLowerCase().includes(searchQuery.toLowerCase())).map(report => {
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

      <Sidebar dark={dark} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} activeView={activeView} setActiveView={navigateToView}
        categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory}
        reports={userVisibleReports} favorites={favorites} requests={requests} user={user} onLogout={onLogout} isUserAdmin={isAdmin(user.email)}
        mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)}/>
      {mobileSidebarOpen && (
        <div className="mobile-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 130, backdropFilter: "blur(2px)" }}/>
      )}

      {/* Main content area */}
      <div className="main-content-responsive" style={{ marginLeft: sidebarWidth, transition: "margin-left .3s cubic-bezier(.4,0,.2,1)", minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, position: "sticky", top: 0, zIndex: 20, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Mobile menu button */}
            <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgCard, cursor: "pointer", display: "none", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: theme.textSecondary }}><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: theme.text }}>
              {activeView === "dashboard" ? "Dashboard" : activeView === "favorites" ? "Favoritos" : activeView === "recent" ? "Recientes" : activeView === "requests" ? "Solicitudes BI" : "Métricas"}
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
                      <div key={n.id} onClick={() => { markNotifRead(n.id); if (n.requestId) { const req = requests.find(rr => rr.id === n.requestId); if (req) setSelectedRequest(req); navigateToView("requests"); } else if (n.reportId) { const r = userVisibleReports.find(rr => rr.id === n.reportId); if (r) openReport(r); } setShowNotif(false); }}
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
              <button onClick={() => openAdminPanel()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${T.teal}30`, background: dark ? T.teal + "10" : T.tealBg, cursor: "pointer", transition: "all .2s" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: T.teal }}><path d="M6.5 1.5h3l.5 2 1.5.7 1.8-1 2.1 2.1-1 1.8.7 1.5 2 .5v3l-2 .5-.7 1.5 1 1.8-2.1 2.1-1.8-1-1.5.7-.5 2h-3l-.5-2-1.5-.7-1.8 1-2.1-2.1 1-1.8L1.5 9.5l-2-.5v-3l2-.5.7-1.5-1-1.8 2.1-2.1 1.8 1L6.5 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: T.teal }}>Admin</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "24px 28px" }}>
          {/* Welcome Banner - only on dashboard view */}
          {activeView === "dashboard" && <WelcomeBanner user={user} dark={dark} reports={userVisibleReports} recentReports={recentViews}/>}

          {/* KPI Cards */}
          {activeView === "dashboard" && <KpiCards dark={dark} reports={userVisibleReports} favorites={favorites} recentViews={recentViews}/>}

          {/* Executive Summary */}
          {activeView === "dashboard" && (
            <div style={{ marginBottom: 24, animation: "fadeUp .5s ease-out .2s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: theme.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: T.teal }}><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3m0 2.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Resumen Ejecutivo
              </h3>
              <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { icon: <svg width="18" height="18" viewBox="0 0 16 16"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5.5 8l2 2 3.5-4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>, title: "Reportes disponibles", desc: "Tus reportes principales están disponibles y operativos", color: "#10B981", bgColor: dark ? "#10B98112" : "#D1FAE5" },
                  { icon: <svg width="18" height="18" viewBox="0 0 16 16"><path d="M2 14l4-5 3 2 5-7" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>, title: "Datos actualizados", desc: "Los datos de los reportes se encuentran actualizados", color: T.teal, bgColor: dark ? T.teal + "12" : T.tealBg },
                  { icon: <svg width="18" height="18" viewBox="0 0 16 16"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5 8h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>, title: "Sin incidencias", desc: "No se detectan incidencias críticas en los reportes", color: "#6366F1", bgColor: dark ? "#6366F115" : "#EEF2FF" },
                  { icon: <svg width="18" height="18" viewBox="0 0 16 16"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>, title: "Acceso rápido", desc: "Revisá tus reportes favoritos para acceso rápido", color: "#F59E0B", bgColor: dark ? "#F59E0B12" : "#FFFBEB" },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: theme.bgCard, borderRadius: 16, padding: "18px 20px",
                    border: `1px solid ${theme.border}`, animation: `scaleIn .4s ease-out ${.06 * i}s both`,
                    transition: "transform .2s, box-shadow .2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 20px ${item.color}10`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bgColor, display: "flex", alignItems: "center", justifyContent: "center", color: item.color, marginBottom: 12 }}>{item.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: theme.text, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Access - Featured reports */}
          {activeView === "dashboard" && userVisibleReports.filter(r => r.status === "live").length > 0 && (
            <div style={{ marginBottom: 24, animation: "fadeUp .5s ease-out .3s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: theme.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: T.teal }}><path d="M13 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M6 6l2 2 2-2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Accesos rápidos
              </h3>
              <div className="reports-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {userVisibleReports.filter(r => r.status === "live").slice(0, 4).map((report, i) => {
                  const colors = categoryColors[report.category] || categoryColors.Comercial;
                  return (
                    <div key={report.id} onClick={() => openReport(report)}
                      style={{
                        background: theme.bgCard, borderRadius: 14, padding: "16px 18px",
                        border: `1px solid ${theme.border}`, cursor: "pointer",
                        transition: "all .25s cubic-bezier(.4,0,.2,1)",
                        display: "flex", alignItems: "center", gap: 14,
                        animation: `scaleIn .3s ease-out ${.06 * i}s both`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.borderColor = (dark ? colors.darkText : colors.accent) + "44"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = theme.border; }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[report.icon]}</svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{report.name}</div>
                        <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>{report.category}</div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textMuted, flexShrink: 0 }}><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Metrics Panel - admin only */}
          {activeView === "metrics" && isAdmin(user.email) && <MetricsPanel dark={dark} reports={reports} recentViews={recentViews} favorites={favorites}/>}

          {/* Requests module */}
          {activeView === "requests" && renderRequestsPanel()}

          {/* View title for non-dashboard */}
          {(activeView === "favorites" || activeView === "recent") && (
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

          {/* ====== REPORT DETAIL PANEL ====== */}
          {detailReport && (
            <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end" }} onClick={() => closeDetailPanel()}>
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", animation: "fadeIn .2s ease-out" }}/>
              <div onClick={e => e.stopPropagation()} style={{
                width: 520, maxWidth: "95vw", height: "100vh", background: theme.bgCard,
                borderLeft: `1px solid ${theme.border}`, position: "relative", zIndex: 1,
                boxShadow: `0 0 60px ${dark ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.12)"}`,
                display: "flex", flexDirection: "column", animation: "slideInRight .3s cubic-bezier(.4,0,.2,1)",
                overflow: "hidden",
              }}>
                {(() => {
                  const colors = categoryColors[detailReport.category] || categoryColors.Comercial;
                  const isFav = favorites.includes(detailReport.id);
                  const isMaintenance = detailReport.status === "maintenance";
                  const lastView = recentViews.find(r => r.id === detailReport.id);
                  return (<>
                    {/* Header with gradient accent */}
                    <div style={{ padding: "24px 28px 20px", borderBottom: `1px solid ${theme.border}`, flexShrink: 0, background: dark ? `linear-gradient(135deg, ${colors.darkBg}, transparent)` : `linear-gradient(135deg, ${colors.bg}, transparent)` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 16, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${dark ? colors.darkText + "30" : colors.accent + "20"}` }}>
                          <svg width="24" height="24" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[detailReport.icon]}</svg>
                        </div>
                        <button onClick={() => closeDetailPanel()} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgSurface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: theme.textMuted, fontSize: 16, transition: "all .2s" }}>×</button>
                      </div>
                      <h2 style={{ fontSize: 20, fontWeight: 500, color: theme.text, marginBottom: 6 }}>{detailReport.name}</h2>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: dark ? colors.darkText : colors.accent, background: dark ? colors.darkBg : colors.bg, padding: "4px 12px", borderRadius: 10 }}>{detailReport.category}</span>
                        <StatusBadge status={detailReport.status} dark={dark}/>
                        <HealthBadge report={detailReport} dark={dark}/>
                      </div>
                    </div>

                    {/* Scrollable content */}
                    <div style={{ flex: 1, overflow: "auto", padding: "20px 28px 28px" }}>
                      {/* Maintenance warning */}
                      {isMaintenance && (
                        <div style={{ padding: "14px 18px", borderRadius: 14, background: dark ? "#EF444410" : "#FEF2F2", border: `1px solid ${dark ? "#EF444425" : "#FECACA"}`, display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
                          <svg width="18" height="18" viewBox="0 0 16 16" style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }}><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3m0 2.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: dark ? "#F87171" : "#DC2626", marginBottom: 2 }}>Reporte en mantenimiento</p>
                            <p style={{ fontSize: 12, color: dark ? "#FCA5A5" : "#991B1B", lineHeight: 1.5 }}>Este reporte no está disponible temporalmente. Contactá al equipo BI si necesitás acceso urgente.</p>
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 11, fontWeight: 500, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Descripción</p>
                        <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.7 }}>{getReportDescription(detailReport)}</p>
                      </div>

                      {/* Business purpose */}
                      <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 14, background: dark ? T.teal + "10" : T.tealBg, border: `1px solid ${dark ? T.teal + "22" : T.teal + "18"}` }}>
                        <p style={{ fontSize: 11, fontWeight: 500, color: T.teal, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>¿Para qué sirve?</p>
                        <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.65 }}>{getReportPurpose(detailReport)}</p>
                      </div>

                      {/* Info cards grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                        {[
                          { icon: <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>, label: "Responsable", value: detailReport.owner || "Equipo BI" },
                          { icon: <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5.5 8l2 2 3.5-4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>, label: "Nivel de acceso", value: detailReport.accessLevel || detailReport.audience || "Corporativo" },
                          { icon: <svg width="14" height="14" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5 6h6M5 8.5h4M5 11h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>, label: "Fuente de datos", value: detailReport.dataSource || "Power BI Service" },
                          { icon: <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>, label: "Última consulta", value: lastView ? timeAgo(lastView.viewedAt) : "Sin actividad" },
                        ].map((item, i) => (
                          <div key={i} style={{ background: theme.bgSurface, borderRadius: 12, padding: "14px 16px", border: `1px solid ${theme.border}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                              <span style={{ color: theme.textMuted }}>{item.icon}</span>
                              <span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</span>
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Technical info */}
                      <div style={{ background: theme.bgSurface, borderRadius: 14, padding: 18, marginBottom: 20, border: `1px solid ${theme.border}` }}>
                        <p style={{ fontSize: 11, fontWeight: 500, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Información técnica</p>
                        {[
                          { l: "Report ID", v: detailReport.id },
                          { l: "Workspace ID", v: detailReport.groupId || "No configurado" },
                          { l: "Categoría", v: detailReport.category },
                          { l: "Estado actual", v: detailReport.status === "live" ? "Activo" : detailReport.status === "draft" ? "Borrador" : "En mantenimiento" },
                          { l: "Criticidad", v: detailReport.criticality ? String(detailReport.criticality).charAt(0).toUpperCase() + String(detailReport.criticality).slice(1) : "Media" },
                          { l: "Actualización", v: detailReport.refreshFrequency || "Según dataset" },
                          { l: "Última edición", v: detailReport.updatedAt ? new Date(detailReport.updatedAt).toLocaleString("es-PY") : "Sin registro" },
                        ].map((item, i, arr) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "8px 0", borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                            <span style={{ fontSize: 12, color: theme.textMuted }}>{item.l}</span>
                            <span style={{ fontSize: 11, color: T.teal, fontFamily: "'JetBrains Mono', monospace", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{item.v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Secondary actions */}
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 11, fontWeight: 500, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Acciones</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <button onClick={(e) => { toggleFav(detailReport.id, e); }} style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12,
                            border: `1px solid ${theme.border}`, background: isFav ? (dark ? "#F59E0B12" : "#FFFBEB") : theme.bgCard,
                            cursor: "pointer", transition: "all .2s", width: "100%", textAlign: "left",
                          }}>
                            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" fill={isFav ? "#FBBF24" : "none"} stroke={isFav ? "#FBBF24" : theme.textMuted} strokeWidth="1.2"/></svg>
                            <span style={{ fontSize: 13, color: theme.text }}>{isFav ? "Quitar de favoritos" : "Agregar a favoritos"}</span>
                          </button>
                          <button onClick={() => openActionModal("issue", detailReport)} style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12,
                            border: `1px solid ${theme.border}`, background: theme.bgCard,
                            cursor: "pointer", transition: "all .2s", width: "100%", textAlign: "left",
                          }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: "#EF4444" }}><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3m0 2.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            <span style={{ fontSize: 13, color: theme.text }}>Reportar problema</span>
                          </button>
                          <button onClick={() => openActionModal("change", detailReport)} style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12,
                            border: `1px solid ${theme.border}`, background: theme.bgCard,
                            cursor: "pointer", transition: "all .2s", width: "100%", textAlign: "left",
                          }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: "#6366F1" }}><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>
                            <span style={{ fontSize: 13, color: theme.text }}>Solicitar cambio</span>
                          </button>
                          <button onClick={() => copyReportLink(detailReport)} style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12,
                            border: `1px solid ${theme.border}`, background: theme.bgCard,
                            cursor: "pointer", transition: "all .2s", width: "100%", textAlign: "left",
                          }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: T.teal }}><path d="M6.5 9.5l3-3M7 4.5l.8-.8a3 3 0 0 1 4.2 4.2l-.8.8M9 11.5l-.8.8A3 3 0 0 1 4 8.1l.8-.8" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span style={{ fontSize: 13, color: theme.text }}>Copiar link del reporte</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer with main action */}
                    <div style={{ padding: "16px 28px", borderTop: `1px solid ${theme.border}`, flexShrink: 0, display: "flex", gap: 10 }}>
                      {isMaintenance ? (
                        <div style={{ flex: 1, padding: "14px", borderRadius: 14, background: dark ? theme.bgSurface : "#F9FAFB", border: `1px solid ${theme.border}`, textAlign: "center" }}>
                          <span style={{ fontSize: 13, color: theme.textMuted }}>Reporte no disponible temporalmente</span>
                        </div>
                      ) : (
                        <button onClick={() => { closeDetailPanel({ pushHistory: false }); openReport(detailReport); }} style={{
                          flex: 1, padding: "14px", borderRadius: 14, border: "none",
                          background: `linear-gradient(135deg, ${T.teal}, ${T.tealDark})`,
                          color: "white", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all .2s",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}>
                          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Abrir reporte
                        </button>
                      )}
                      <button onClick={() => closeDetailPanel()} style={{
                        padding: "14px 24px", borderRadius: 14, border: `1px solid ${theme.border}`,
                        background: theme.bgCard, color: theme.textSecondary, fontSize: 13, cursor: "pointer", transition: "all .2s",
                      }}>Cerrar</button>
                    </div>
                  </>);
                })()}
              </div>
            </div>
          )}

          {/* ====== CATALOG SECTION ====== */}
          {/* Report cards grid — only for dashboard and favorites views */}
          {activeView !== "recent" && activeView !== "metrics" && activeView !== "requests" && (
          <>
            {/* Catalog toolbar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18, alignItems: "center", animation: "fadeUp .3s ease-out" }}>
              {/* Inline search */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, background: theme.bgCard, border: `1px solid ${theme.border}`, flex: "1 1 200px", maxWidth: 320 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textMuted, flexShrink: 0 }}><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                <input type="text" placeholder="Buscar por nombre, descripción o categoría..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ border: "none", background: "transparent", outline: "none", fontSize: 12, color: theme.text, width: "100%", fontFamily: "'Outfit', system-ui" }}/>
                {searchQuery && <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "none", cursor: "pointer", color: theme.textMuted, fontSize: 14, lineHeight: 1 }}>×</button>}
              </div>

              {/* Category filter pills */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {categories.map(cat => {
                  const isActive = activeCategory === cat;
                  const colors = categoryColors[cat];
                  return (
                    <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                      padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${isActive ? (colors?.accent || T.teal) : "transparent"}`,
                      background: isActive ? (dark ? (colors?.darkBg || T.teal + "15") : (colors?.bg || T.tealBg)) : theme.bgCard,
                      color: isActive ? (dark ? (colors?.darkText || T.tealLight) : (colors?.accent || T.teal)) : theme.textMuted,
                      fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all .2s", whiteSpace: "nowrap",
                    }}>{cat}</button>
                  );
                })}
              </div>

              {/* Status filter */}
              <div style={{ display: "flex", gap: 4 }}>
                {[{ key: "all", label: "Todos" }, { key: "live", label: "Activo" }, { key: "draft", label: "Borrador" }, { key: "maintenance", label: "Mantenimiento" }].map(s => (
                  <button key={s.key} onClick={() => setStatusFilter(s.key)} style={{
                    padding: "6px 12px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all .2s",
                    background: statusFilter === s.key ? (dark ? T.teal + "18" : T.tealBg) : theme.bgCard,
                    color: statusFilter === s.key ? T.teal : theme.textMuted,
                  }}>{s.label}</button>
                ))}
              </div>

              {/* Sort */}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                padding: "7px 12px", borderRadius: 10, border: `1px solid ${theme.border}`,
                background: theme.bgCard, color: theme.textSecondary, fontSize: 11, cursor: "pointer",
                fontFamily: "'Outfit', system-ui", outline: "none", marginLeft: "auto",
              }}>
                <option value="name">Nombre A-Z</option>
                <option value="category">Categoría</option>
                <option value="status">Estado</option>
              </select>
            </div>

            {/* Results count */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: theme.textMuted }}>{displayReports.length} {displayReports.length === 1 ? "reporte encontrado" : "reportes encontrados"}</p>
            </div>

            {/* Enhanced report cards grid */}
            <div className="reports-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {displayReports.map((report, i) => {
              const colors = categoryColors[report.category] || categoryColors.Comercial;
              const isHovered = hoveredCard === report.id;
              const isFav = favorites.includes(report.id);
              const isMaintenance = report.status === "maintenance";
              return (
                <div key={report.id} onMouseEnter={() => setHoveredCard(report.id)} onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: theme.bgCard, borderRadius: 20, padding: 0, overflow: "hidden",
                    border: `1.5px solid ${isHovered ? (dark ? colors.darkText + "44" : colors.accent + "44") : theme.border}`,
                    transition: "all .3s cubic-bezier(.4,0,.2,1)",
                    transform: isHovered ? "translateY(-4px) scale(1.01)" : "none",
                    boxShadow: isHovered ? `0 20px 40px ${dark ? "rgba(0,0,0,.3)" : colors.accent + "12"}` : "none",
                    animation: `scaleIn .4s ease-out ${.05 * i}s both`,
                    opacity: isMaintenance ? 0.7 : 1,
                  }}>
                  {/* Card content */}
                  <div style={{ padding: 24 }}>
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
                    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: dark ? colors.darkText : colors.accent, background: dark ? colors.darkBg : colors.bg, padding: "4px 12px", borderRadius: 8 }}>{report.category}</span>
                      <HealthBadge report={report} dark={dark}/>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div style={{ display: "flex", borderTop: `1px solid ${theme.border}` }}>
                    <button onClick={() => isMaintenance ? openDetailPanel(report) : openReport(report)}
                      style={{
                        flex: 1, padding: "12px", border: "none", borderRight: `1px solid ${theme.border}`,
                        background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 500,
                        color: isMaintenance ? theme.textMuted : T.teal, transition: "background .2s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? theme.bgSurface : "#F9FAFB"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {isMaintenance ? (
                        <><svg width="14" height="14" viewBox="0 0 16 16" style={{ color: theme.textMuted }}><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3m0 2.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> No disponible</>
                      ) : (
                        <><svg width="14" height="14" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg> Abrir reporte</>
                      )}
                    </button>
                    <button onClick={() => openDetailPanel(report)}
                      style={{
                        padding: "12px 20px", border: "none", background: "transparent",
                        cursor: "pointer", fontSize: 12, color: theme.textSecondary, transition: "background .2s",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? theme.bgSurface : "#F9FAFB"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 5v3m0 2.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Detalles
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add report card — admin only */}
            {isAdmin(user.email) && activeView === "dashboard" && (
              <div onClick={() => openAdminPanel()} style={{
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
          </>
          )}

          {displayReports.length === 0 && activeView !== "metrics" && activeView !== "requests" && (
            <div style={{ textAlign: "center", padding: 60, animation: "fadeUp .4s ease-out" }}>
              <svg width="56" height="56" viewBox="0 0 48 48" style={{ color: theme.border, marginBottom: 16 }}><circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2" fill="none"/><line x1="30" y1="30" x2="40" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <p style={{ fontSize: 16, fontWeight: 500, color: theme.text }}>
                {activeView === "favorites" ? "No tenés favoritos aún" : activeView === "recent" ? "No hay reportes recientes" : "No encontramos reportes con estos filtros"}
              </p>
              <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 6, maxWidth: 360, margin: "6px auto 0" }}>
                {activeView === "favorites" ? "Marcá reportes con la estrella ⭐ para acceso rápido" : activeView === "recent" ? "Los reportes que abras aparecerán acá" : "Intentá cambiar los filtros de categoría, estado o término de búsqueda"}
              </p>
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setActiveCategory("Todos"); setStatusFilter("all"); }} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bgCard, color: T.teal, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  Limpiar filtros
                </button>
              )}
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
        const currentUser = await getCurrentUser();
        if (currentUser) setUser(currentUser);
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
