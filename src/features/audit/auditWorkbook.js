import { workbookToBytes } from "@office-kit/xlsx/io";
import { addWorksheet, createWorkbook } from "@office-kit/xlsx/workbook";
import {
  setAutoFilter,
  setCell,
  setColumnWidths,
  setFreezePanes,
  setRowHeight,
} from "@office-kit/xlsx/worksheet";
import {
  makeAlignment,
  makeFont,
  makePatternFill,
  registerCellStyle,
  rgbColor,
} from "@office-kit/xlsx/styles";
import { getAuditEventDetail } from "./auditModel.js";

const DATE_FORMAT = "dd/mm/yyyy hh:mm";

function toDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : "";
}

function createStyles(workbook) {
  const header = registerCellStyle(workbook, {
    font: makeFont({ bold: true, color: rgbColor("FFFFFF"), size: 10 }),
    fill: makePatternFill({ patternType: "solid", fgColor: rgbColor("2563EB") }),
    alignment: makeAlignment({ vertical: "center" }),
  });
  const date = registerCellStyle(workbook, { numberFormat: DATE_FORMAT });
  const decimal = registerCellStyle(workbook, { numberFormat: "0.0" });
  return { header, date, decimal };
}

function writeTable(sheet, headers, rows, widths, styles) {
  headers.forEach((header, index) => setCell(sheet, 1, index + 1, header, styles.header));
  rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const style = value instanceof Date
        ? styles.date
        : typeof value === "number" && !Number.isInteger(value)
          ? styles.decimal
          : undefined;
      setCell(sheet, rowIndex + 2, colIndex + 1, value, style);
    });
  });
  setColumnWidths(sheet, widths);
  setRowHeight(sheet, 1, 24);
  setFreezePanes(sheet, { rows: 1, cols: 0 });
  setAutoFilter(sheet, {
    ref: `A1:${columnName(headers.length)}${Math.max(rows.length + 1, 2)}`,
    filterColumns: [],
  });
}

function columnName(index) {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export async function buildAuditWorkbook(events, ipRows) {
  const workbook = createWorkbook();
  const styles = createStyles(workbook);
  const ipSheet = addWorksheet(workbook, "Resumen por IP");
  const activitySheet = addWorksheet(workbook, "Actividad");

  const ipHeaders = [
    "IP",
    "Cuentas observadas",
    "Dispositivos",
    "Sesiones",
    "Dias activos",
    "Accesos",
    "Aperturas",
    "Aperturas por dia activo",
    "Reporte principal",
    "Aperturas del reporte principal",
    "Primera actividad",
    "Ultima actividad",
  ];
  const ipData = ipRows.map((row) => [
    row.ipAddress,
    row.accounts.join("; "),
    row.deviceCount,
    row.sessionCount,
    row.activeDays,
    row.accesses,
    row.reportOpens,
    Number(row.opensPerActiveDay.toFixed(1)),
    row.topReport?.name || "",
    row.topReport?.count || 0,
    toDate(row.firstSeen),
    toDate(row.lastSeen),
  ]);
  writeTable(ipSheet, ipHeaders, ipData, [18, 42, 13, 12, 13, 11, 12, 22, 34, 28, 20, 20], styles);

  const activityHeaders = [
    "Fecha",
    "IP",
    "Dispositivo",
    "Sesion",
    "Cuenta",
    "Usuario",
    "Accion",
    "Reporte u objeto",
    "Detalle",
  ];
  const activityData = events.map((event) => [
    toDate(event.createdAt),
    event.ipAddress || "No disponible",
    event.deviceId || "",
    event.sessionId || "",
    event.actorEmail || "",
    event.actorName || "",
    event.actionLabel || event.action || "Evento",
    event.subjectName || event.subjectId || "Plataforma",
    getAuditEventDetail(event),
  ]);
  writeTable(activitySheet, activityHeaders, activityData, [20, 18, 30, 30, 36, 24, 24, 38, 44], styles);

  return workbookToBytes(workbook, { compressionLevel: 6 });
}
