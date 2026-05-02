import { useState, useEffect, useCallback } from "react";

/*
╔══════════════════════════════════════════════════════════════╗
║  DATAREPORTS PORTAL v3 — Manufactura de Pilar S.A.          ║
║  Con Panel de Administración integrado                       ║
║  Persistencia via window.storage API                         ║
╚══════════════════════════════════════════════════════════════╝
*/

const CONFIG = {
  tenantId: "0cd4c62a-f014-46ba-821f-a1361b7fcb06",
  clientId: "50761768-c070-4f5d-bdab-8f0009ab9718",
  authority: "https://login.microsoftonline.com/0cd4c62a-f014-46ba-821f-a1361b7fcb06",
  redirectUri: "http://localhost:3000",
  scopes: [
    "https://analysis.windows.net/powerbi/api/Report.Read.All",
    "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
  ],
};

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
  const handleLogin = () => { setLoading(true); setTimeout(() => onLogin({ name: "Richi Gonzalez", email: "richi.gonzalez@pilarpy.onmicrosoft.com", role: "Administrador BI", avatar: "RG" }), 1500); };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Outfit', system-ui", background: "#0F1117" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes glow { 0%,100% { opacity:.3; } 50% { opacity:.6; } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        * { box-sizing:border-box; margin:0; padding:0; }
      `}</style>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 60, position: "relative", overflow: "hidden", background: "linear-gradient(160deg, #0F1117 0%, #111827 50%, #0D3330 100%)" }}>
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
      <div style={{ width: 480, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 52px", background: darkTheme.bg, borderLeft: `1px solid ${darkTheme.border}` }}>
        <div style={{ animation: "fadeUp .5s ease-out .2s both" }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, color: darkTheme.text, marginBottom: 6 }}>Bienvenido</h2>
          <p style={{ fontSize: 13, color: darkTheme.textMuted, marginBottom: 32 }}>Iniciá sesión con tu cuenta corporativa</p>
          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "18px 24px", borderRadius: 16, border: `1.5px solid ${darkTheme.border}`, background: darkTheme.bgCard, cursor: loading ? "wait" : "pointer", transition: "all .25s" }}>
            {loading ? <div style={{ width: 20, height: 20, border: `2px solid ${darkTheme.border}`, borderTopColor: T.teal, borderRadius: "50%", animation: "spin .6s linear infinite" }}/> : <svg width="20" height="20" viewBox="0 0 20 20"><rect x="1" y="1" width="8" height="8" fill="#F25022"/><rect x="11" y="1" width="8" height="8" fill="#7FBA00"/><rect x="1" y="11" width="8" height="8" fill="#00A4EF"/><rect x="11" y="11" width="8" height="8" fill="#FFB900"/></svg>}
            <span style={{ fontSize: 14, fontWeight: 500, color: darkTheme.text }}>{loading ? "Conectando..." : "Iniciar sesión con Microsoft"}</span>
          </button>
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
  const [showProfile, setShowProfile] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const theme = dark ? darkTheme : lightTheme;
  const toggleFav = useCallback((id, e) => { e.stopPropagation(); setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]); }, []);

  // Load reports from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("datareports-config");
        if (stored) {
          const data = JSON.parse(stored);
          if (data.reports && data.reports.length > 0) setReports(data.reports);
          if (data.favorites) setFavorites(data.favorites);
        }
      } catch (e) { /* First time — use defaults */ }
      setLoaded(true);
    })();
  }, []);

  // Save reports
  const saveReports = async (newReports) => {
    setReports(newReports);
    try { localStorage.setItem("datareports-config", JSON.stringify({ reports: newReports, favorites })); } catch (e) {}
  };

  // Save favorites
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try { localStorage.setItem("datareports-config", JSON.stringify({ reports, favorites })); } catch (e) {}
    })();
  }, [favorites, loaded]);

  const categories = ["Todos", ...new Set(reports.map(r => r.category))];
  const filtered = reports.filter(r => {
    const matchCat = activeCategory === "Todos" || r.category === activeCategory;
    const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // REPORT VIEW
  if (selectedReport) {
    const colors = categoryColors[selectedReport.category] || categoryColors.Comercial;
    return (
      <div style={{ fontFamily: "'Outfit', system-ui", minHeight: "100vh", background: theme.bg }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}*{box-sizing:border-box;margin:0;padding:0}`}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", background: theme.bgCard, borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => setSelectedReport(null)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.bgSurface, cursor: "pointer", fontSize: 13, color: theme.textSecondary }}>
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>Volver
            </button>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[selectedReport.icon]}</svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: theme.text }}>{selectedReport.name}</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{selectedReport.category}</div>
            </div>
          </div>
          <StatusBadge status={selectedReport.status} dark={dark}/>
        </div>
        <div style={{ padding: "20px 28px", animation: "fadeUp .4s ease-out", height: "calc(100vh - 56px)" }}>
          <div style={{ height: "100%", background: theme.bgCard, borderRadius: 20, border: `1px solid ${theme.border}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: selectedReport.status === "live" ? "#10B981" : selectedReport.status === "maintenance" ? "#EF4444" : "#F59E0B" }}/>
                <span style={{ fontSize: 11, color: theme.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>Report: {selectedReport.id.substring(0, 16)}...</span>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: dark ? "#0D0F14" : "#F9FAFB" }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <svg width="32" height="32" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[selectedReport.icon]}</svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 500, color: theme.text }}>{selectedReport.name}</p>
              <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 8, textAlign: "center", maxWidth: 380, lineHeight: 1.6 }}>Aquí se renderiza el iframe de Power BI Embedded</p>
              <div style={{ marginTop: 20, background: theme.bgSurface, borderRadius: 14, padding: 20, maxWidth: 440, width: "100%" }}>
                {[{ l: "Report ID", v: selectedReport.id }, { l: "Group ID", v: selectedReport.groupId }, { l: "Token Type", v: "Aad (User Owns Data)" }].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 2 ? `1px solid ${theme.border}` : "none" }}>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>{item.l}</span>
                    <span style={{ fontSize: 10, color: T.teal, fontFamily: "'JetBrains Mono', monospace" }}>{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Outfit', system-ui", minHeight: "100vh", background: theme.bg, transition: "background .3s" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {showAdmin && <AdminPanel reports={reports} onSave={saveReports} onClose={() => setShowAdmin(false)} dark={dark}/>}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, position: "sticky", top: 0, zIndex: 20 }}>
        <Logo size="small" dark={dark}/>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, background: theme.bgSurface, border: `1px solid ${theme.border}` }}>
            <svg width="15" height="15" viewBox="0 0 16 16" style={{ color: theme.textMuted }}><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: theme.text, width: 140, fontFamily: "'Outfit', system-ui" }}/>
          </div>
          <button onClick={() => setDark(!dark)} style={{ width: 36, height: 36, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgCard, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dark ? <svg width="15" height="15" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.5" stroke="#FBBF24" strokeWidth="1.5" fill="none"/></svg> : <svg width="15" height="15" viewBox="0 0 16 16"><path d="M14 9.3A6 6 0 0 1 6.7 2 6 6 0 1 0 14 9.3z" stroke="#6B7280" strokeWidth="1.5" fill="none"/></svg>}
          </button>

          {/* Admin button */}
          <button onClick={() => setShowAdmin(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12,
            border: `1.5px solid ${T.teal}40`, background: dark ? T.teal + "15" : T.tealBg,
            cursor: "pointer", transition: "all .2s",
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: T.teal }}><path d="M6.5 1.5h3l.5 2 1.5.7 1.8-1 2.1 2.1-1 1.8.7 1.5 2 .5v3l-2 .5-.7 1.5 1 1.8-2.1 2.1-1.8-1-1.5.7-.5 2h-3l-.5-2-1.5-.7-1.8 1-2.1-2.1 1-1.8L1.5 9.5l-2-.5v-3l2-.5.7-1.5-1-1.8 2.1-2.1 1.8 1L6.5 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            <span style={{ fontSize: 12, fontWeight: 500, color: T.teal }}>Admin</span>
          </button>

          <div style={{ position: "relative" }}>
            <button onClick={() => setShowProfile(!showProfile)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 8px 5px 14px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.bgCard, cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>Richi</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${T.teal}, ${T.tealDark})`, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>RG</div>
            </button>
            {showProfile && (
              <div style={{ position: "absolute", top: 48, right: 0, width: 260, background: theme.bgCard, borderRadius: 18, border: `1px solid ${theme.border}`, boxShadow: `0 16px 48px ${dark ? "rgba(0,0,0,.4)" : "rgba(0,0,0,.1)"}`, overflow: "hidden", zIndex: 30, animation: "fadeUp .2s ease-out" }}>
                <div style={{ padding: 20, textAlign: "center", borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${T.teal}, ${T.tealDark})`, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, margin: "0 auto 8px" }}>RG</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>Richi Gonzalez</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>Administrador BI</div>
                </div>
                <div style={{ padding: 8 }}>
                  <button onClick={onLogout} style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "none", background: dark ? "#2A1215" : "#FEF2F2", color: "#EF4444", cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" style={{ color: "#EF4444" }}><path d="M6 2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2m4-9l3 3-3 3m3-3H6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showProfile && <div onClick={() => setShowProfile(false)} style={{ position: "fixed", inset: 0, zIndex: 15 }}/>}

      <div style={{ padding: "24px 28px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 20, marginBottom: 24, animation: "fadeUp .5s ease-out" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 26, fontWeight: 500, color: theme.text, letterSpacing: "-0.5px" }}>Bienvenido, Richi</h1>
            <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>Manufactura de Pilar S.A. — {reports.length} reportes configurados</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Reportes", value: reports.length, color: T.teal },
              { label: "Workspaces", value: new Set(reports.map(r => r.groupId)).size, color: "#6366F1" },
              { label: "Categorías", value: new Set(reports.map(r => r.category)).size, color: "#F59E0B" },
            ].map((stat, i) => (
              <div key={i} style={{ background: theme.bgCard, borderRadius: 18, padding: "16px 22px", minWidth: 120, border: `1px solid ${theme.border}`, animation: `fadeUp .5s ease-out ${.1+i*.08}s both` }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: theme.textMuted }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, animation: "fadeUp .5s ease-out .15s both" }}>
          {categories.map(cat => {
            const isActive = activeCategory === cat;
            const colors = categoryColors[cat];
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                padding: "7px 18px", borderRadius: 20,
                border: `1.5px solid ${isActive ? (colors?.accent || T.teal) : "transparent"}`,
                background: isActive ? (dark ? (colors?.darkBg || T.teal + "15") : (colors?.bg || T.tealBg)) : theme.bgCard,
                color: isActive ? (dark ? (colors?.darkText || T.tealLight) : (colors?.accent || T.teal)) : theme.textSecondary,
                fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all .2s",
              }}>{cat}</button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filtered.map((report, i) => {
            const colors = categoryColors[report.category] || categoryColors.Comercial;
            const isHovered = hoveredCard === report.id;
            const isFav = favorites.includes(report.id);
            return (
              <div key={report.id} onClick={() => setSelectedReport(report)} onMouseEnter={() => setHoveredCard(report.id)} onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: theme.bgCard, borderRadius: 22, padding: 26,
                  border: `1.5px solid ${isHovered ? (dark ? colors.darkText + "44" : colors.accent + "44") : theme.border}`,
                  cursor: "pointer", transition: "all .25s",
                  transform: isHovered ? "translateY(-3px)" : "none",
                  boxShadow: isHovered ? `0 16px 40px ${dark ? "rgba(0,0,0,.3)" : colors.accent + "14"}` : "none",
                  animation: `fadeUp .4s ease-out ${.05 * i}s both`,
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: dark ? colors.darkBg : colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" style={{ color: dark ? colors.darkText : colors.accent }}>{iconPaths[report.icon]}</svg>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={(e) => toggleFav(report.id, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2z" fill={isFav ? "#FBBF24" : "none"} stroke={isFav ? "#FBBF24" : theme.textMuted} strokeWidth="1.2"/></svg>
                    </button>
                    <StatusBadge status={report.status} dark={dark}/>
                  </div>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 500, color: theme.text, marginBottom: 6 }}>{report.name}</h3>
                <p style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6, marginBottom: 18 }}>{report.description}</p>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14, borderTop: `1px solid ${theme.border}` }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: dark ? colors.darkText : colors.accent, background: dark ? colors.darkBg : colors.bg, padding: "4px 12px", borderRadius: 8 }}>{report.category}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: T.teal, display: "flex", alignItems: "center", gap: 4 }}>
                    Abrir<svg width="14" height="14" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </div>
              </div>
            );
          })}

          {/* Add report card */}
          <div onClick={() => setShowAdmin(true)} style={{
            borderRadius: 22, padding: 26, border: `2px dashed ${theme.border}`,
            cursor: "pointer", transition: "all .25s", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", minHeight: 240,
            background: "transparent",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = T.teal}
          onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: dark ? T.teal + "15" : T.tealBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <svg width="22" height="22" viewBox="0 0 16 16" style={{ color: T.teal }}><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: T.teal }}>Agregar reporte</p>
            <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Abrir panel de administración</p>
          </div>
        </div>

        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ opacity: 0.4 }}><Logo size="small" dark={dark}/></div>
          <span style={{ fontSize: 10, color: theme.textMuted }}>Powered by Power BI Embedded + Azure AD — pilarpy.onmicrosoft.com</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  if (!user) return <LoginScreen onLogin={setUser}/>;
  return <Dashboard user={user} onLogout={() => setUser(null)}/>;
}
