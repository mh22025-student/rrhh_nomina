import PDFDocument from 'pdfkit';

// ============================================================
// PDF Pay Stub (Boleta de Pago) Generator
// El Salvador Payroll System — Compact single-page layout
// ============================================================

// Emerald accent colors matching the app theme
const COLORS = {
  primary: '#059669',
  primaryDark: '#047857',
  dark: '#1e293b',
  medium: '#475569',
  light: '#f1f5f9',
  border: '#cbd5e1',
  white: '#ffffff',
  red: '#dc2626',
  emerald50: '#ecfdf5',
  emerald100: '#d1fae5',
};

const fmt = (n: number): string =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date): string =>
  new Date(d).toLocaleDateString('es-SV');

// ── Types ────────────────────────────────────────────────────
interface EmpleadoBoleta {
  codigo_empleado: string;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  dui: string;
  area?: { nombre: string } | null;
  perfil_puesto?: { nombre_puesto: string } | null;
}

interface DetalleBoleta {
  salario_base: number;
  total_horas_extra: number;
  total_bonos: number;
  total_comisiones: number;
  salario_bruto: number;
  isss_laboral: number;
  afp_laboral: number;
  isr_retenido: number;
  total_descuentos: number;
  salario_neto: number;
  isss_patronal: number;
  afp_patronal: number;
  cuota_alimenticia: number;
  prestamo_patronal: number;
  seguro_complementario: number;
  otros_descuentos: number;
  observaciones?: string | null;
}

interface PlanillaBoleta {
  codigo_planilla: string;
  tipo: string;
  fecha_inicio_periodo: Date;
  fecha_fin_periodo: Date;
  total_cargas_patronales: number;
}

interface BoletaData {
  planilla: PlanillaBoleta;
  empleado: EmpleadoBoleta;
  detalle: DetalleBoleta;
}

// ============================================================
// Helpers
// ============================================================

const LEFT = 50;
const PAGE_W = 512; // 612 - 2*50
const ROW_H = 13;
const HDR_H = 16;

function sectionBar(doc: PDFDocument, text: string, y: number) {
  doc.save().rect(LEFT, y, PAGE_W, HDR_H).fill(COLORS.primary).restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(COLORS.white)
    .text(text.toUpperCase(), LEFT + 5, y + 4, { width: PAGE_W - 10, lineBreak: false });
  return y + HDR_H + 2;
}

function row(
  doc: PDFDocument,
  label: string,
  value: string,
  y: number,
  opts?: { bold?: boolean; color?: string; alt?: boolean; x?: number; w?: number }
) {
  const x = opts?.x ?? LEFT;
  const w = opts?.w ?? PAGE_W;

  if (opts?.alt) {
    doc.save().rect(x, y - 1, w, ROW_H).fill(COLORS.light).restore();
  }

  doc
    .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(7.5)
    .fillColor(opts?.bold ? COLORS.primaryDark : COLORS.medium)
    .text(label, x + 4, y + 2, { width: w * 0.6, lineBreak: false });

  doc
    .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(7.5)
    .fillColor(opts?.color ?? COLORS.dark)
    .text(value, x + 4, y + 2, { width: w - 8, align: 'right', lineBreak: false });

  return y + ROW_H;
}

function thinLine(doc: PDFDocument, y: number) {
  doc
    .save()
    .moveTo(LEFT, y)
    .lineTo(LEFT + PAGE_W, y)
    .strokeColor(COLORS.border)
    .lineWidth(0.4)
    .stroke()
    .restore();
  return y + 4;
}

// ============================================================
// Generate a single pay stub page (fits on one Letter page)
// ============================================================
function generateBoletaPage(doc: PDFDocument, data: BoletaData) {
  const { planilla, empleado, detalle } = data;
  let y = 40;

  // ── Company Header ────────────────────────────────────────
  doc.save().rect(LEFT, y, PAGE_W, 36).fill(COLORS.primary).restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.white)
    .text('Sistema de Nómina y Perfiles de Puestos — El Salvador', LEFT, y + 5, {
      width: PAGE_W,
      align: 'center',
      lineBreak: false,
    });
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.emerald100)
    .text('República de El Salvador — Ministerio de Trabajo y Previsión Social', LEFT, y + 20, {
      width: PAGE_W,
      align: 'center',
      lineBreak: false,
    });
  y += 44;

  // ── Title ──────────────────────────────────────────────────
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.primaryDark)
    .text('BOLETA DE PAGO', LEFT, y, { width: PAGE_W, align: 'center', lineBreak: false });
  y += 18;
  y = thinLine(doc, y);
  y += 2;

  // ── Planilla Info (compact 2-column) ──────────────────────
  y = sectionBar(doc, 'Información de Planilla', y);
  const halfW = PAGE_W / 2;

  y = row(doc, 'Código:', planilla.codigo_planilla, y, { x: LEFT, w: halfW, alt: true });
  y = row(doc, 'Tipo:', planilla.tipo, y, {
    x: LEFT + halfW,
    w: halfW,
    alt: true,
  });
  // Overwrite y for the second column: draw at same y as first
  const yPeriod = y - ROW_H; // go back up
  row(doc, 'Período:', `${fmtDate(planilla.fecha_inicio_periodo)} — ${fmtDate(planilla.fecha_fin_periodo)}`, yPeriod, {
    x: LEFT,
    w: PAGE_W,
    alt: false,
  });
  y = yPeriod + ROW_H;

  y += 2;

  // ── Employee Info (compact 2-column) ──────────────────────
  y = sectionBar(doc, 'Información del Empleado', y);

  const fullName = [
    empleado.primer_nombre,
    empleado.segundo_nombre,
    empleado.primer_apellido,
    empleado.segundo_apellido,
  ]
    .filter(Boolean)
    .join(' ');

  y = row(doc, 'Nombre:', fullName, y, { alt: true });
  y = row(doc, 'Código Empleado:', empleado.codigo_empleado, y, {
    x: LEFT,
    w: halfW,
    alt: true,
  });
  const yDui = y - ROW_H;
  row(doc, 'DUI:', empleado.dui, yDui, { x: LEFT + halfW, w: halfW, alt: true });
  y = yDui + ROW_H;
  y = row(doc, 'Puesto:', empleado.perfil_puesto?.nombre_puesto || 'N/A', y, {
    x: LEFT,
    w: halfW,
    alt: true,
  });
  const yArea = y - ROW_H;
  row(doc, 'Área:', empleado.area?.nombre || 'N/A', yArea, { x: LEFT + halfW, w: halfW, alt: true });
  y = yArea + ROW_H;

  y += 2;

  // ── Two-Column: Earnings (left) | Deductions (right) ─────
  const colW = (PAGE_W - 8) / 2;
  const leftX = LEFT;
  const rightX = LEFT + colW + 8;

  // Section headers side by side
  doc.save().rect(leftX, y, colW, HDR_H).fill(COLORS.primary).restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(COLORS.white)
    .text('DEVENGADOS', leftX + 5, y + 4, { width: colW - 10, lineBreak: false });

  doc.save().rect(rightX, y, colW, HDR_H).fill(COLORS.primary).restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(COLORS.white)
    .text('DEDUCCIONES', rightX + 5, y + 4, { width: colW - 10, lineBreak: false });
  y += HDR_H + 2;

  // Earnings rows
  const earnings: [string, string][] = [
    ['Salario Base', fmt(detalle.salario_base)],
    ['Horas Extra', fmt(detalle.total_horas_extra)],
    ['Bonos', fmt(detalle.total_bonos)],
    ['Comisiones', fmt(detalle.total_comisiones)],
  ];

  // Deductions rows
  const deductions: [string, string][] = [
    ['ISSS Laboral (3%)', fmt(detalle.isss_laboral)],
    ['AFP Laboral (7.25%)', fmt(detalle.afp_laboral)],
    ['ISR (Renta)', fmt(detalle.isr_retenido)],
    ['Cuota Alimenticia', fmt(detalle.cuota_alimenticia)],
    ['Préstamo Patronal', fmt(detalle.prestamo_patronal)],
    ['Seguro Complementario', fmt(detalle.seguro_complementario)],
    ['Otros Descuentos', fmt(detalle.otros_descuentos)],
  ];

  const maxRows = Math.max(earnings.length, deductions.length);
  for (let i = 0; i < maxRows; i++) {
    const isAlt = i % 2 === 0;
    if (i < earnings.length) {
      row(doc, earnings[i][0], earnings[i][1], y, { x: leftX, w: colW, alt: isAlt });
    } else if (isAlt) {
      doc.save().rect(leftX, y - 1, colW, ROW_H).fill(COLORS.light).restore();
    }
    if (i < deductions.length) {
      row(doc, deductions[i][0], deductions[i][1], y, { x: rightX, w: colW, alt: isAlt });
    } else if (isAlt) {
      doc.save().rect(rightX, y - 1, colW, ROW_H).fill(COLORS.light).restore();
    }
    y += ROW_H;
  }

  // Totals for each column
  y += 1;
  doc.save().rect(leftX, y - 1, colW, ROW_H + 2).fill(COLORS.emerald50).restore();
  row(doc, 'TOTAL DEVENGADO', fmt(detalle.salario_bruto), y, {
    x: leftX,
    w: colW,
    bold: true,
    color: COLORS.primaryDark,
  });

  doc.save().rect(rightX, y - 1, colW, ROW_H + 2).fill('#fef2f2').restore();
  row(doc, 'TOTAL DEDUCCIONES', fmt(detalle.total_descuentos), y, {
    x: rightX,
    w: colW,
    bold: true,
    color: COLORS.red,
  });
  y += ROW_H + 4;

  // ── Summary Box ────────────────────────────────────────────
  y = thinLine(doc, y);
  y += 2;
  y = sectionBar(doc, 'Resumen de Pago', y);

  // Summary background
  const summaryH = ROW_H * 3 + 4;
  doc.save().rect(LEFT, y - 1, PAGE_W, summaryH).fill(COLORS.emerald50).restore();
  doc
    .save()
    .rect(LEFT, y - 1, PAGE_W, summaryH)
    .strokeColor(COLORS.primary)
    .lineWidth(1)
    .stroke()
    .restore();

  row(doc, 'Total Bruto', fmt(detalle.salario_bruto), y, { bold: true, color: COLORS.dark });
  y += ROW_H;
  row(doc, 'Total Deducciones', fmt(detalle.total_descuentos), y, { bold: true, color: COLORS.red });
  y += ROW_H;
  row(doc, 'NETO A PAGAR', fmt(detalle.salario_neto), y, {
    bold: true,
    color: COLORS.primaryDark,
  });
  y += ROW_H + 6;

  // ── Cargas Patronales (compact, same row style) ───────────
  y = thinLine(doc, y);
  y += 2;
  y = sectionBar(doc, 'Cargas Patronales', y);

  const patronal: [string, string][] = [
    ['ISSS Patronal (7.5%)', fmt(detalle.isss_patronal)],
    ['AFP Patronal (8.75%)', fmt(detalle.afp_patronal)],
  ];

  // INSAFORP estimate
  const knownPatronal = detalle.isss_patronal + detalle.afp_patronal;
  if (planilla.total_cargas_patronales > 0 && knownPatronal > 0) {
    const insaforp = Math.max(0, planilla.total_cargas_patronales - knownPatronal);
    if (insaforp > 0) {
      patronal.push(['INSAFORP (1%)', fmt(insaforp)]);
    }
  }

  for (let i = 0; i < patronal.length; i++) {
    y = row(doc, patronal[i][0], patronal[i][1], y, { alt: i % 2 === 0 });
  }

  y += 4;

  // ── Observations (if any) ─────────────────────────────────
  if (detalle.observaciones) {
    y = thinLine(doc, y);
    y = sectionBar(doc, 'Observaciones', y);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLORS.medium)
      .text(detalle.observaciones, LEFT + 4, y, { width: PAGE_W - 8, lineBreak: false });
    y += 16;
  }

  // ── Legal Footer (always at bottom) ───────────────────────
  const footerY = 710;
  thinLine(doc, footerY);

  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(COLORS.medium)
    .text(
      'Documento generado conforme al Art. 138 del Código de Trabajo de El Salvador.',
      LEFT,
      footerY + 5,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );

  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor(COLORS.border)
    .text(
      `Generado: ${new Date().toLocaleDateString('es-SV')} — ${planilla.codigo_planilla} — ${empleado.codigo_empleado}`,
      LEFT,
      footerY + 16,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );
}

// ============================================================
// Public API
// ============================================================
export async function generateBoletaPdf(data: BoletaData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      bufferPages: false,
      autoFirstPage: true,
    });

    // Disable auto page break
    doc.options.bufferPages = false;

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    generateBoletaPage(doc, data);
    doc.end();
  });
}

export async function generateBoletasPdf(dataList: BoletaData[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      bufferPages: false,
      autoFirstPage: false,
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const data of dataList) {
      doc.addPage();
      generateBoletaPage(doc, data);
    }

    doc.end();
  });
}

export type { BoletaData, EmpleadoBoleta, DetalleBoleta, PlanillaBoleta };
