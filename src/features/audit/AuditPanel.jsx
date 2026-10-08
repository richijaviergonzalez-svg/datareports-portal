import React, { useMemo, useState } from "react";
import {
  AUDIT_ACTION_OPTIONS,
  buildIpUsageRows,
  filterAuditEvents,
  getAuditDeviceLabel,
  getAuditEventDetail,
  getAuditStats,
} from "./auditModel.js";

const RANGE_OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Todo el historial" },
];

const THEMES = {
  light: { card: "#FFFFFF", surface: "#F4F7FB", hover: "#EEF3F9", border: "#E3E8F0", text: "#111827", secondary: "#667085", muted: "#98A2B3" },
  dark: { card: "#181B23", surface: "#1E222D", hover: "#252A36", border: "#2A2F3C", text: "#E8ECF4", secondary: "#A7B0C0", muted: "#6B7288" },
};

const accent = "#2563EB";

function formatDate(value, includeDate = true) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sin actividad";
  return date.toLocaleString("es-PY", includeDate
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }
    : { hour: "2-digit", minute: "2-digit", hour12: false });
}

function shortDevice(value) {
  if (!value) return "Sin identificador";
  return value.length > 18 ? `${value.slice(0, 9)}...${value.slice(-5)}` : value;
}

function AuditIcon({ type = "shield", size = 16 }) {
  if (type === "download") return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13.5h10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (type === "refresh") return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M13 5V2.5L11.5 4A5.5 5.5 0 1 0 13 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (type === "chevron") return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (type === "search") return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" fill="none"/><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
  if (type === "network") return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><rect x="1.8" y="2" width="5" height="4" rx="1" stroke="currentColor" fill="none"/><rect x="9.2" y="10" width="5" height="4" rx="1" stroke="currentColor" fill="none"/><path d="M6.8 4h2A2.2 2.2 0 0 1 11 6.2V10M4.3 6v3a2 2 0 0 0 2 2h2.9" stroke="currentColor" fill="none" strokeLinecap="round"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l5 1.8v3.6c0 3.1-2 5.8-5 7-3-1.2-5-3.9-5-7V3.6l5-1.8z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>;
}

function Select({ label, value, onChange, children, theme }) {
  return (
    <label className="audit-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={{ color: theme.text, background: theme.surface, borderColor: theme.border }}>
        {children}
      </select>
    </label>
  );
}

export default function AuditPanel({ dark, events, reports, syncStatus, syncMessage, onRefresh, onOpenReport }) {
  const theme = dark ? THEMES.dark : THEMES.light;
  const [mode, setMode] = useState("ip");
  const [range, setRange] = useState("30d");
  const [actionFilter, setActionFilter] = useState("all");
  const [account, setAccount] = useState("all");
  const [reportId, setReportId] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedIp, setSelectedIp] = useState("");

  const filteredEvents = useMemo(() => filterAuditEvents(events, {
    actionFilter,
    query,
    range,
    account,
    reportId,
  }), [events, actionFilter, query, range, account, reportId]);
  const stats = useMemo(() => getAuditStats(filteredEvents), [filteredEvents]);
  const ipRows = useMemo(() => buildIpUsageRows(filteredEvents), [filteredEvents]);
  const selectedRow = ipRows.find((row) => row.ipAddress === selectedIp) || ipRows[0] || null;
  const accountOptions = useMemo(() => [...new Set(events.map((event) => event.actorEmail).filter(Boolean))].sort(), [events]);

  const exportAuditCsv = () => {
    const header = ["Fecha", "IP", "Dispositivo", "Sesion", "Cuenta", "Usuario", "Accion", "Reporte", "Detalle"];
    const rows = filteredEvents.map((event) => [
      formatDate(event.createdAt),
      event.ipAddress || "No disponible",
      event.deviceId,
      event.sessionId,
      event.actorEmail,
      event.actorName,
      event.actionLabel,
      event.subjectName || event.subjectId,
      getAuditEventDetail(event),
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `datareports-accesos-ip-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openReport = (id) => {
    const report = reports.find((item) => item.id === id);
    if (report) onOpenReport(report);
  };

  const statItems = [
    { label: "IPs activas", value: stats.uniqueIps, hint: "Redes identificadas" },
    { label: "Dispositivos", value: stats.uniqueDevices, hint: "Navegadores distintos" },
    { label: "Accesos", value: stats.accesses, hint: "Sesiones iniciadas" },
    { label: "Aperturas", value: stats.reportOpens, hint: "Reportes consultados" },
    { label: "Cuentas", value: stats.uniqueUsers, hint: "Cuentas departamentales" },
  ];

  return (
    <section className="audit-panel" style={{ color: theme.text }}>
      <header className="audit-header">
        <div>
          <h2>Auditoria de accesos</h2>
          <p>Uso real de la plataforma agrupado por IP, dispositivo y cuenta departamental.</p>
        </div>
        <div className="audit-header-actions">
          <button className="audit-icon-button" onClick={onRefresh} title="Actualizar auditoria" style={{ color: syncStatus === "shared" ? "#0F9F6E" : theme.secondary, borderColor: theme.border, background: theme.card }}>
            <AuditIcon type="refresh" />
          </button>
          <button className="audit-command-button" onClick={exportAuditCsv} disabled={!filteredEvents.length} title="Exportar los datos filtrados en CSV" style={{ color: filteredEvents.length ? accent : theme.muted, borderColor: theme.border, background: theme.card }}>
            <AuditIcon type="download" />
            Exportar CSV
          </button>
        </div>
      </header>

      <div className="audit-sync-strip" style={{ background: theme.surface, borderColor: theme.border, color: theme.secondary }}>
        <span className={`audit-sync-dot ${syncStatus === "shared" ? "is-online" : ""}`} />
        {syncMessage}
        <span>La IP se registra en el servidor; el dispositivo corresponde a este navegador.</span>
      </div>

      <div className="audit-kpi-grid">
        {statItems.map((item) => (
          <div key={item.label} className="audit-kpi" style={{ background: theme.card, borderColor: theme.border }}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.hint}</small>
          </div>
        ))}
      </div>

      <div className="audit-toolbar" style={{ background: theme.card, borderColor: theme.border }}>
        <div className="audit-search" style={{ background: theme.surface, borderColor: theme.border }}>
          <AuditIcon type="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar IP, cuenta, dispositivo o reporte" style={{ color: theme.text }} />
        </div>
        <Select label="Periodo" value={range} onChange={setRange} theme={theme}>
          {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Select label="Actividad" value={actionFilter} onChange={setActionFilter} theme={theme}>
          {AUDIT_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Select label="Cuenta" value={account} onChange={setAccount} theme={theme}>
          <option value="all">Todas</option>
          {accountOptions.map((email) => <option key={email} value={email}>{email}</option>)}
        </Select>
        <Select label="Reporte" value={reportId} onChange={setReportId} theme={theme}>
          <option value="all">Todos</option>
          {reports.map((report) => <option key={report.id} value={report.id}>{report.name}</option>)}
        </Select>
      </div>

      <div className="audit-view-switch" style={{ borderColor: theme.border, background: theme.surface }}>
        <button onClick={() => setMode("ip")} className={mode === "ip" ? "is-active" : ""}><AuditIcon type="network" /> Por IP</button>
        <button onClick={() => setMode("events")} className={mode === "events" ? "is-active" : ""}><AuditIcon /> Actividad</button>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="audit-empty" style={{ background: theme.card, borderColor: theme.border }}>
          <AuditIcon type="network" size={34} />
          <strong>No hay actividad para estos filtros</strong>
          <span>Proba ampliando el periodo o quitando alguno de los filtros.</span>
        </div>
      ) : mode === "ip" ? (
        <div className="audit-workspace">
          <div className="audit-table-wrap" style={{ background: theme.card, borderColor: theme.border }}>
            <div className="audit-table-title">
              <div><strong>Accesos por IP</strong><span>{ipRows.length} direcciones encontradas</span></div>
              <small>Selecciona una fila para ver su detalle</small>
            </div>
            <div className="audit-table-scroll">
              <table className="audit-table">
                <thead><tr><th>IP / dispositivos</th><th>Cuenta</th><th>Accesos</th><th>Aperturas</th><th>Reporte principal</th><th>Ultima actividad</th><th /></tr></thead>
                <tbody>
                  {ipRows.map((row) => (
                    <tr key={row.ipAddress} className={selectedRow?.ipAddress === row.ipAddress ? "is-selected" : ""} onClick={() => setSelectedIp(row.ipAddress)}>
                      <td><strong className="audit-mono">{row.ipAddress}</strong><small>{row.deviceCount} disp. · {row.sessionCount} sesiones</small></td>
                      <td><span>{row.accounts[0] || "Sin cuenta"}</span>{row.accounts.length > 1 && <small>+{row.accounts.length - 1} cuentas</small>}</td>
                      <td><strong>{row.accesses}</strong><small>{row.activeDays} dias activos</small></td>
                      <td><strong>{row.reportOpens}</strong><small>{row.opensPerActiveDay.toFixed(1)} por dia activo</small></td>
                      <td><span>{row.topReport?.name || "Sin aperturas"}</span>{row.topReport && <small>{row.topReport.count} aperturas</small>}</td>
                      <td><span>{formatDate(row.lastSeen)}</span></td>
                      <td><AuditIcon type="chevron" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedRow && (
            <aside className="audit-detail" style={{ background: theme.card, borderColor: theme.border }}>
              <div className="audit-detail-heading">
                <span className="audit-detail-icon"><AuditIcon type="network" /></span>
                <div><small>Direccion IP</small><strong className="audit-mono">{selectedRow.ipAddress}</strong></div>
              </div>
              <div className="audit-detail-metrics">
                <div><strong>{selectedRow.reportOpens}</strong><span>Aperturas</span></div>
                <div><strong>{selectedRow.sessionCount}</strong><span>Sesiones</span></div>
                <div><strong>{selectedRow.activeDays}</strong><span>Dias activos</span></div>
              </div>

              <div className="audit-detail-section">
                <h3>Cuentas observadas</h3>
                {selectedRow.accounts.map((email) => <span key={email} className="audit-account-chip" style={{ background: theme.surface }}>{email}</span>)}
              </div>

              <div className="audit-detail-section">
                <h3>Reportes consultados</h3>
                {selectedRow.reports.length ? selectedRow.reports.slice(0, 6).map((item) => (
                  <button key={item.id || item.name} className="audit-report-line" onClick={() => openReport(item.id)} disabled={!reports.some((report) => report.id === item.id)} style={{ color: theme.text }}>
                    <span>{item.name}</span><strong>{item.count}</strong>
                  </button>
                )) : <p>Esta IP todavia no abrio reportes.</p>}
              </div>

              <div className="audit-detail-section">
                <h3>Actividad reciente</h3>
                <div className="audit-timeline">
                  {selectedRow.events.slice(0, 8).map((event) => (
                    <div key={event.id} className="audit-timeline-item">
                      <span />
                      <div><strong>{event.actionLabel}</strong><small>{event.subjectName || getAuditDeviceLabel(event)}</small><small>{formatDate(event.createdAt)}</small></div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      ) : (
        <div className="audit-table-wrap" style={{ background: theme.card, borderColor: theme.border }}>
          <div className="audit-table-title"><div><strong>Registro de actividad</strong><span>{filteredEvents.length} eventos</span></div></div>
          <div className="audit-table-scroll">
            <table className="audit-table audit-event-table">
              <thead><tr><th>Fecha</th><th>IP</th><th>Cuenta / dispositivo</th><th>Actividad</th><th>Reporte u objeto</th></tr></thead>
              <tbody>{filteredEvents.map((event) => (
                <tr key={event.id}>
                  <td><span>{formatDate(event.createdAt)}</span></td>
                  <td><strong className="audit-mono">{event.ipAddress || "No disponible"}</strong></td>
                  <td><span>{event.actorEmail}</span><small title={event.deviceId}>{getAuditDeviceLabel(event)} · {shortDevice(event.deviceId)}</small></td>
                  <td><strong>{event.actionLabel}</strong><small>{getAuditEventDetail(event)}</small></td>
                  <td>{event.subjectType === "report" && reports.some((report) => report.id === event.subjectId)
                    ? <button className="audit-inline-link" onClick={() => openReport(event.subjectId)}>{event.subjectName || event.subjectId}</button>
                    : <span>{event.subjectName || event.subjectId || "Plataforma"}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      <p className="audit-privacy-note" style={{ color: theme.muted }}>
        La IP identifica una conexion o red, no necesariamente a una persona. En redes compartidas, VPN o sucursales, usa tambien dispositivo, cuenta y horario para interpretar la actividad.
      </p>
    </section>
  );
}
