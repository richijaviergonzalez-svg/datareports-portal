import { isAdmin } from "../../lib/auth.js";

export const DEFAULT_REPORTS = [
  { id: "d48d43aa-2b9a-4b72-8607-b3ed143d130a", groupId: "a4ea35c6-d88d-4537-9599-29515db688fa", name: "Comparativo de Ventas por Familia", category: "Abastecimiento", icon: "boxes", status: "live", description: "Análisis comparativo de ventas desglosado por familia de productos con tendencias y variaciones." },
  { id: "7620e442-af45-4c95-a10f-1a6d624cde18", groupId: "573730aa-3deb-4c17-aa99-a3ff4dbdd2fd", name: "Ventas Canales", category: "Comercial", icon: "chart-bar", status: "live", description: "Performance de ventas por canal de distribución con métricas de volumen y rentabilidad." },
  { id: "e7a9faec-d675-4fb6-997f-c4fd7ee33c87", groupId: "00f55da6-ed76-4108-8cb6-71f20df60e27", name: "Ventas vs Metas", category: "Retail", icon: "gauge", status: "live", description: "Seguimiento de ventas retail contra objetivos establecidos con indicadores de cumplimiento." },
];

export const ALL_CATEGORIES = [
  "Abastecimiento", "Retail", "Tiendas", "IH", "Mayoristas", "Comercial", "E-Commerce", "Compras",
  "Producto", "Marketing", "Recursos Humanos", "Finanzas", "Creditos y Cobranzas", "Deco",
  "Contabilidad", "Prendas", "Operaciones", "Dirección", "Logística", "Producción"
];

export const ICON_OPTIONS = [
  { key: "chart-bar", label: "Barras" }, { key: "gauge", label: "Medidor" }, { key: "boxes", label: "Cajas" },
  { key: "funnel", label: "Embudo" }, { key: "currency", label: "Moneda" }, { key: "people", label: "Personas" },
  { key: "crown", label: "Ejecutivo" }, { key: "truck", label: "Logística" }, { key: "factory", label: "Fábrica" },
  { key: "calendar", label: "Calendario" }, { key: "cart", label: "Compras" }, { key: "invoice", label: "Factura" },
];

export function getReportDescription(report) {
  const text = (report?.description || "").trim();
  return text || "Este reporte aún no cuenta con una descripción detallada. Podés solicitar al equipo BI que agregue contexto, alcance y uso recomendado.";
}

export function getReportPurpose(report) {
  const name = (report?.name || "").toLowerCase();
  const category = report?.category || "BI";
  if (name.includes("meta")) return "Permite hacer seguimiento del cumplimiento comercial frente a objetivos, detectar brechas y priorizar acciones por canal, tienda o período.";
  if (name.includes("venta")) return "Permite analizar el desempeño de ventas, identificar tendencias, comparar resultados y encontrar oportunidades de mejora para la toma de decisiones.";
  if (name.includes("familia")) return "Permite comparar familias, rubros o productos para entender qué segmentos impulsan el resultado y cuáles necesitan atención.";
  return `Permite consultar indicadores clave del área ${category}, centralizando información relevante para análisis, seguimiento y toma de decisiones.`;
}

export function buildActionSummary(type, report, details = "") {
  const label = type === "issue" ? "Reporte de problema" : "Solicitud de cambio";
  return `${label}: ${report?.name || "Reporte"}${details ? ` — ${details}` : ""}`;
}

export function parseUrl(url) {
  try {
    const clean = String(url || "").trim();
    const groupMatch = clean.match(/groups\/([a-f0-9-]+|me)/i);
    const reportMatch = clean.match(/reports\/([a-f0-9-]+)/i);
    if (reportMatch) {
      const rawGroup = groupMatch?.[1] || "";
      return {
        groupId: rawGroup.toLowerCase() === "me" ? "" : rawGroup,
        reportId: reportMatch[1],
      };
    }
  } catch (error) {}
  return null;
}

export const isValidUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());

export const normalizeReport = (report = {}, index = 0) => {
  const now = new Date().toISOString();
  return {
    id: String(report.id || report.reportId || "").trim(),
    groupId: String(report.groupId || report.workspaceId || "").trim(),
    name: String(report.name || "Reporte sin nombre").trim(),
    category: report.category || "Comercial",
    icon: report.icon || "chart-bar",
    status: report.status || "live",
    description: report.description || "",
    owner: report.owner || "Equipo BI",
    audience: report.audience || "Corporativo",
    accessLevel: report.accessLevel || "Corporativo",
    dataSource: report.dataSource || "Power BI Service",
    refreshFrequency: report.refreshFrequency || "Según dataset",
    criticality: report.criticality || "media",
    technicalNotes: report.technicalNotes || "",
    originalUrl: report.originalUrl || "",
    visibilityMode: report.visibilityMode || "all",
    allowedEmails: Array.isArray(report.allowedEmails) ? report.allowedEmails : String(report.allowedEmails || "").split(/[;,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean),
    allowedDomains: Array.isArray(report.allowedDomains) ? report.allowedDomains : String(report.allowedDomains || "").split(/[;,\n]/).map(v => v.trim().toLowerCase().replace(/^@/, "")).filter(Boolean),
    visibilityNote: report.visibilityNote || "",
    createdAt: report.createdAt || now,
    updatedAt: report.updatedAt || now,
    sortOrder: Number.isFinite(Number(report.sortOrder)) ? Number(report.sortOrder) : index + 1,
  };
};

export const normalizeReports = (items = []) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(normalizeReport)
    .filter((report) => report.id && !seen.has(report.id) && seen.add(report.id))
    .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
};

export const getUserDomain = (email = "") => String(email || "").split("@")[1]?.toLowerCase() || "";

export const canUserViewReport = (report, user) => {
  const mode = report?.visibilityMode || "all";
  const email = String(user?.email || "").toLowerCase();
  const domain = getUserDomain(email);

  if (isAdmin(email)) return true;
  if (mode === "all") return true;
  if (mode === "admins") return false;
  if (mode === "emails") return (report.allowedEmails || []).map(e => String(e).toLowerCase()).includes(email);
  if (mode === "domains") return (report.allowedDomains || []).map(d => String(d).toLowerCase().replace(/^@/, "")).includes(domain);
  return true;
};

export const getVisibilityLabel = (report) => {
  const mode = report?.visibilityMode || "all";
  if (mode === "all") return "Todos";
  if (mode === "admins") return "Solo admin";
  if (mode === "emails") return `Usuarios específicos (${(report.allowedEmails || []).length})`;
  if (mode === "domains") return `Dominios (${(report.allowedDomains || []).length})`;
  return "Todos";
};
