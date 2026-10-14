import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const CURRENCIES = [
  { code: "USD", name: "Dólar estadounidense" },
  { code: "BRL", name: "Real brasileño" },
  { code: "ARS", name: "Peso argentino" },
  { code: "EUR", name: "Euro" },
];

function todayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatEffectiveDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatPublishedTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatRate(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "--";
  const hasDecimals = !Number.isInteger(amount);
  return `₲ ${amount.toLocaleString("es-PY", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M10.8 2.2l3 3L5.2 13.8 2 14l.2-3.2 8.6-8.6zM9.6 3.4l3 3" stroke="currentColor" strokeWidth="1.35" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function ExchangeRatePanel({
  dark,
  quotation,
  history = [],
  canManage = false,
  loading = false,
  saving = false,
  onPublish,
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(todayKey());
  const [rates, setRates] = useState({ USD: "", BRL: "", ARS: "", EUR: "" });
  const [formError, setFormError] = useState("");

  const theme = dark
    ? { card: "#181B23", surface: "#1E222D", border: "#2A2F3C", text: "#E8ECF4", secondary: "#A7B0C0", muted: "#6B7288" }
    : { card: "#FFFFFF", surface: "#F4F7FB", border: "#E3E8F0", text: "#111827", secondary: "#667085", muted: "#98A2B3" };

  const style = {
    "--exchange-card": theme.card,
    "--exchange-surface": theme.surface,
    "--exchange-border": theme.border,
    "--exchange-text": theme.text,
    "--exchange-secondary": theme.secondary,
    "--exchange-muted": theme.muted,
  };

  useEffect(() => {
    if (!editorOpen) return;
    setEffectiveDate(quotation?.effectiveDate || todayKey());
    setRates(Object.fromEntries(CURRENCIES.map(({ code }) => [
      code,
      quotation?.rates?.[code] ?? "",
    ])));
    setFormError("");
  }, [editorOpen, quotation]);

  useEffect(() => {
    if (!editorOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editorOpen]);

  useEffect(() => {
    if (!editorOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) setEditorOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editorOpen, saving]);

  const recentHistory = useMemo(() => history.slice(0, 5), [history]);

  const submit = async (event) => {
    event.preventDefault();
    const numericRates = Object.fromEntries(CURRENCIES.map(({ code }) => [code, Number(rates[code])]));
    const invalid = CURRENCIES.find(({ code }) => !Number.isFinite(numericRates[code]) || numericRates[code] <= 0);
    if (!effectiveDate || invalid) {
      setFormError(invalid ? `Ingresá un valor válido para ${invalid.code}.` : "Seleccioná la fecha de vigencia.");
      return;
    }

    setFormError("");
    try {
      await onPublish({ effectiveDate, rates: numericRates });
      setEditorOpen(false);
    } catch (error) {
      setFormError(error.message || "No se pudo publicar la cotización.");
    }
  };

  return (
    <>
      <section className="exchange-rate-band" style={style} aria-label="Cotización del día">
        <div className="exchange-rate-band__summary">
          <strong>Cotización del día</strong>
          <span>Valores definidos por Finanzas</span>
          <small>
            <i className={quotation ? "is-current" : ""} />
            {loading && !quotation
              ? "Consultando cotización..."
              : quotation
                ? `Vigente ${formatEffectiveDate(quotation.effectiveDate)} · Actualizado ${formatPublishedTime(quotation.publishedAt)}`
                : "Pendiente de publicación"}
          </small>
        </div>

        <div className="exchange-rate-band__values">
          {CURRENCIES.map((currency) => (
            <div key={currency.code} className="exchange-rate-value" title={currency.name}>
              <span>{currency.code}</span>
              <strong>{formatRate(quotation?.rates?.[currency.code])}</strong>
            </div>
          ))}
        </div>

        {canManage && (
          <button
            type="button"
            className="exchange-rate-edit"
            onClick={() => setEditorOpen(true)}
            title="Editar cotización"
            aria-label="Editar cotización"
          >
            <PencilIcon />
          </button>
        )}
      </section>

      {editorOpen && canManage && createPortal((
        <div className="exchange-rate-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setEditorOpen(false);
        }}>
          <section className="exchange-rate-modal" style={style} role="dialog" aria-modal="true" aria-labelledby="exchange-rate-title">
            <header>
              <div>
                <h2 id="exchange-rate-title">Publicar cotización</h2>
                <p>Ingresá los cuatro valores finales calculados por Finanzas.</p>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} disabled={saving} aria-label="Cerrar">×</button>
            </header>

            <form onSubmit={submit}>
              <label className="exchange-rate-date">
                <span>Fecha de vigencia</span>
                <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} required />
              </label>

              <div className="exchange-rate-form-grid">
                {CURRENCIES.map((currency) => (
                  <label key={currency.code}>
                    <span>{currency.code}<small>{currency.name}</small></span>
                    <div><b>₲</b><input type="number" min="0.01" step="0.01" inputMode="decimal" value={rates[currency.code]} onChange={(event) => setRates((current) => ({ ...current, [currency.code]: event.target.value }))} placeholder="0" required /></div>
                  </label>
                ))}
              </div>

              {formError && <p className="exchange-rate-form-error" role="alert">{formError}</p>}

              <footer>
                <button type="button" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</button>
                <button type="submit" disabled={saving}>{saving ? "Publicando..." : "Publicar cotización"}</button>
              </footer>
            </form>

            {recentHistory.length > 0 && (
              <div className="exchange-rate-history">
                <h3>Últimas publicaciones</h3>
                {recentHistory.map((item) => (
                  <div key={item.id}>
                    <span>{formatEffectiveDate(item.effectiveDate)}</span>
                    <strong>{item.publishedByName || item.publishedBy}</strong>
                    <small>{formatPublishedTime(item.publishedAt)}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ), document.body)}
    </>
  );
}
