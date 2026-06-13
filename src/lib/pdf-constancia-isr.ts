import PDFDocument from 'pdfkit';

// ============================================================
// PDF ISR Constancia (Income Tax Retention Certificate) Generator
// El Salvador Payroll System — F-910 / Art. 157 Código Tributario
// ============================================================

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
  amber: '#d97706',
  amber50: '#fffbeb',
};

const fmt = (n: number): string =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date): string =>
  new Date(d).toLocaleDateString('es-SV');

// ── Types ────────────────────────────────────────────────────
interface TramoISR {
  numero_tramo: number;
  desde: number;
  hasta: number | null;
  porcentaje: number;
  cuota_fija: number;
}

interface ConstanciaIsrData {
  empleado: {
    codigo_empleado: string;
    primer_nombre: string;
    segundo_nombre?: string | null;
    primer_apellido: string;
    segundo_apellido?: string | null;
    dui: string;
    nit?: string | null;
    area?: { nombre: string } | null;
    perfil_puesto?: { nombre_puesto: string } | null;
  };
  periodo: {
    mes: number;
    anio: number;
  };
  empresa?: {
    nombre: string;
    nit: string;
    nrc: string;
    direccion?: string;
  };
  calculo: {
    salario_bruto: number;
    isss_laboral: number;
    afp_laboral: number;
    total_deducciones: number;
    renta_imponible: number;
    isr_retenido: number;
    tramo_aplicable: number;
  };
  tramos: TramoISR[];
  resumen_anual?: {
    total_ingreso_ytd: number;
    total_isr_ytd: number;
  };
}

// ── Layout constants ────────────────────────────────────────
const LEFT = 50;
const PAGE_W = 512; // 612 - 2*50
const ROW_H = 14;
const HDR_H = 18;

const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── Helpers ─────────────────────────────────────────────────
function sectionBar(doc: PDFDocument, text: string, y: number) {
  doc.save().rect(LEFT, y, PAGE_W, HDR_H).fill(COLORS.primary).restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(COLORS.white)
    .text(text.toUpperCase(), LEFT + 6, y + 5, { width: PAGE_W - 12, lineBreak: false });
  return y + HDR_H + 3;
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
    .fontSize(8)
    .fillColor(opts?.bold ? COLORS.primaryDark : COLORS.medium)
    .text(label, x + 5, y + 2, { width: w * 0.55, lineBreak: false });

  doc
    .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(8)
    .fillColor(opts?.color ?? COLORS.dark)
    .text(value, x + 5, y + 2, { width: w - 10, align: 'right', lineBreak: false });

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

// ── Ministerio de Hacienda Emblem (simple geometric) ───────
function drawEmblem(doc: PDFDocument, cx: number, cy: number, size: number) {
  // Simple emblem: circle with triangle inside
  doc.save();
  doc.circle(cx, cy, size).strokeColor(COLORS.primaryDark).lineWidth(1.5).stroke();
  // Triangle
  const h = size * 0.7;
  const base = size * 0.6;
  doc
    .moveTo(cx, cy - h * 0.6)
    .lineTo(cx - base, cy + h * 0.4)
    .lineTo(cx + base, cy + h * 0.4)
    .closePath()
    .strokeColor(COLORS.primaryDark)
    .lineWidth(1)
    .stroke();
  doc.restore();
}

// ============================================================
// Generate the ISR Constancia PDF page
// ============================================================
function generateConstanciaIsrPage(doc: PDFDocument, data: ConstanciaIsrData) {
  const { empleado, periodo, empresa, calculo, tramos, resumen_anual } = data;
  let y = 40;

  // ── Company Header ────────────────────────────────────────
  doc.save().rect(LEFT, y, PAGE_W, 42).fill(COLORS.primary).restore();

  // Emblem
  drawEmblem(doc, LEFT + 25, y + 21, 12);

  if (empresa) {
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.white)
      .text(empresa.nombre, LEFT, y + 5, { width: PAGE_W, align: 'center', lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLORS.emerald100)
      .text(`NIT: ${empresa.nit} — NRC: ${empresa.nrc}`, LEFT, y + 20, { width: PAGE_W, align: 'center', lineBreak: false });
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.white)
      .text('Sistema de Nómina y Perfiles de Puestos — El Salvador', LEFT, y + 8, {
        width: PAGE_W,
        align: 'center',
        lineBreak: false,
      });
  }
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.emerald100)
    .text('República de El Salvador — Ministerio de Hacienda', LEFT, y + 32, {
      width: PAGE_W,
      align: 'center',
      lineBreak: false,
    });
  y += 50;

  // ── Title ──────────────────────────────────────────────────
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(COLORS.primaryDark)
    .text('CONSTANCIA DE RETENCIÓN DE IMPUESTO SOBRE LA RENTA', LEFT, y, { width: PAGE_W, align: 'center' });
  y += 18;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.medium)
    .text(`Formulario F-910 — Art. 157 Código Tributario`, LEFT, y, { width: PAGE_W, align: 'center', lineBreak: false });
  y += 12;

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.primaryDark)
    .text(`Período: ${meses[periodo.mes - 1]} ${periodo.anio}`, LEFT, y, { width: PAGE_W, align: 'center', lineBreak: false });
  y += 14;
  y = thinLine(doc, y);
  y += 4;

  // ── Employer Info ─────────────────────────────────────────
  y = sectionBar(doc, 'Datos del Empleador (Agente Retenedor)', y);

  if (empresa) {
    y = row(doc, 'Razón Social / Nombre:', empresa.nombre, y, { alt: true });
    y = row(doc, 'NIT:', empresa.nit, y, { x: LEFT, w: PAGE_W / 2, alt: true });
    const yNrc = y - ROW_H;
    row(doc, 'NRC:', empresa.nrc, yNrc, { x: LEFT + PAGE_W / 2, w: PAGE_W / 2, alt: true });
    if (empresa.direccion) {
      y = row(doc, 'Dirección:', empresa.direccion, y, { alt: false });
    }
  } else {
    y = row(doc, 'Razón Social / Nombre:', 'N/A', y, { alt: true });
    y = row(doc, 'NIT:', 'N/A', y, { x: LEFT, w: PAGE_W / 2, alt: true });
    const yNrc = y - ROW_H;
    row(doc, 'NRC:', 'N/A', yNrc, { x: LEFT + PAGE_W / 2, w: PAGE_W / 2, alt: true });
  }
  y += 4;

  // ── Employee Info ─────────────────────────────────────────
  y = sectionBar(doc, 'Datos del Trabajador (Sujeto Retenido)', y);

  const fullName = [
    empleado.primer_nombre,
    empleado.segundo_nombre,
    empleado.primer_apellido,
    empleado.segundo_apellido,
  ].filter(Boolean).join(' ');

  const halfW = PAGE_W / 2;

  y = row(doc, 'Nombre:', fullName, y, { alt: true });
  y = row(doc, 'DUI:', empleado.dui, y, { x: LEFT, w: halfW, alt: true });
  const yNit = y - ROW_H;
  row(doc, 'NIT:', empleado.nit || 'N/A', yNit, { x: LEFT + halfW, w: halfW, alt: true });
  y = row(doc, 'Puesto:', empleado.perfil_puesto?.nombre_puesto || 'N/A', y, { x: LEFT, w: halfW, alt: true });
  const yArea = y - ROW_H;
  row(doc, 'Área:', empleado.area?.nombre || 'N/A', yArea, { x: LEFT + halfW, w: halfW, alt: true });
  y = row(doc, 'Código Empleado:', empleado.codigo_empleado, y, { alt: false });
  y += 4;

  // ── Income Breakdown ──────────────────────────────────────
  y = sectionBar(doc, 'Desglose de Ingresos y Retención', y);

  y = row(doc, 'Salario Bruto:', fmt(calculo.salario_bruto), y, { alt: true, bold: false });
  y = row(doc, 'ISSS Laboral (3%):', fmt(calculo.isss_laboral), y, { alt: false, color: COLORS.red });
  y = row(doc, 'AFP Laboral (7.25%):', fmt(calculo.afp_laboral), y, { alt: true, color: COLORS.red });
  y = row(doc, 'Total Deducciones:', fmt(calculo.total_deducciones), y, { alt: false, color: COLORS.red, bold: true });
  y = row(doc, 'Renta Neta Imponible:', fmt(calculo.renta_imponible), y, { alt: true, bold: true, color: COLORS.primaryDark });

  // ISR Retenido highlight box
  const isrH = ROW_H + 6;
  doc.save().rect(LEFT, y - 1, PAGE_W, isrH).fill(COLORS.emerald50).restore();
  doc
    .save()
    .rect(LEFT, y - 1, PAGE_W, isrH)
    .strokeColor(COLORS.primary)
    .lineWidth(1.5)
    .stroke()
    .restore();
  row(doc, 'ISR RETENIDO:', fmt(calculo.isr_retenido), y + 1, {
    bold: true,
    color: calculo.isr_retenido > 0 ? COLORS.red : COLORS.primaryDark,
  });
  y += isrH + 3;

  y = row(doc, 'Tramo ISR Aplicable:', `Tramo ${calculo.tramo_aplicable}`, y, { alt: true, bold: true });
  y += 4;

  // ── ISR Calculation Detail (Tramo Table) ──────────────────
  y = sectionBar(doc, 'Tabla de Tramos ISR Vigentes', y);

  // Table header
  const cols = [0.1, 0.22, 0.22, 0.22, 0.24];
  const colWidths = cols.map(c => PAGE_W * c);
  const colX = cols.reduce((acc: number[], c, i) => {
    acc.push(i === 0 ? LEFT : acc[i - 1] + colWidths[i - 1]);
    return acc;
  }, []);

  // Header row
  doc.save().rect(LEFT, y - 1, PAGE_W, HDR_H - 2).fill(COLORS.primaryDark).restore();
  const headers = ['Tramo', 'Desde', 'Hasta', 'Porcentaje', 'Cuota Fija'];
  for (let i = 0; i < headers.length; i++) {
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(COLORS.white)
      .text(headers[i], colX[i] + 4, y + 3, { width: colWidths[i] - 8, align: i === 0 ? 'center' : 'right', lineBreak: false });
  }
  y += HDR_H;

  // Tramo rows
  for (let i = 0; i < tramos.length; i++) {
    const t = tramos[i];
    const isHighlighted = t.numero_tramo === calculo.tramo_aplicable;

    if (isHighlighted) {
      doc.save().rect(LEFT, y - 1, PAGE_W, ROW_H).fill(COLORS.emerald50).restore();
      doc
        .save()
        .rect(LEFT, y - 1, PAGE_W, ROW_H)
        .strokeColor(COLORS.primary)
        .lineWidth(1)
        .stroke()
        .restore();
    } else if (i % 2 === 0) {
      doc.save().rect(LEFT, y - 1, PAGE_W, ROW_H).fill(COLORS.light).restore();
    }

    const rowFont = isHighlighted ? 'Helvetica-Bold' : 'Helvetica';
    const rowColor = isHighlighted ? COLORS.primaryDark : COLORS.dark;

    doc.font(rowFont).fontSize(7).fillColor(rowColor)
      .text(`${t.numero_tramo}`, colX[0] + 4, y + 3, { width: colWidths[0] - 8, align: 'center', lineBreak: false });
    doc.font(rowFont).fontSize(7).fillColor(rowColor)
      .text(fmt(t.desde), colX[1] + 4, y + 3, { width: colWidths[1] - 8, align: 'right', lineBreak: false });
    doc.font(rowFont).fontSize(7).fillColor(rowColor)
      .text(t.hasta ? fmt(t.hasta) : 'En adelante', colX[2] + 4, y + 3, { width: colWidths[2] - 8, align: 'right', lineBreak: false });
    doc.font(rowFont).fontSize(7).fillColor(rowColor)
      .text(`${(t.porcentaje * 100).toFixed(2)}%`, colX[3] + 4, y + 3, { width: colWidths[3] - 8, align: 'right', lineBreak: false });
    doc.font(rowFont).fontSize(7).fillColor(rowColor)
      .text(fmt(t.cuota_fija), colX[4] + 4, y + 3, { width: colWidths[4] - 8, align: 'right', lineBreak: false });

    y += ROW_H;
  }

  // Legend for highlighted tramo
  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(COLORS.primary)
    .text('* Tramo resaltado aplica al trabajador', LEFT + 4, y + 2, { width: PAGE_W - 8, lineBreak: false });
  y += 14;

  // ── Annual Summary (if available) ─────────────────────────
  if (resumen_anual) {
    y = sectionBar(doc, 'Resumen Acumulado Anual (YTD)', y);

    const summaryH = ROW_H * 2 + 8;
    doc.save().rect(LEFT, y - 1, PAGE_W, summaryH).fill(COLORS.amber50).restore();
    doc
      .save()
      .rect(LEFT, y - 1, PAGE_W, summaryH)
      .strokeColor(COLORS.amber)
      .lineWidth(1)
      .stroke()
      .restore();

    row(doc, 'Total Ingresos YTD:', fmt(resumen_anual.total_ingreso_ytd), y + 2, { bold: true });
    row(doc, 'Total ISR Retenido YTD:', fmt(resumen_anual.total_isr_ytd), y + ROW_H + 2, { bold: true, color: COLORS.red });
    y += summaryH + 8;
  }

  // ── Legal Reference ────────────────────────────────────────
  y = sectionBar(doc, 'Base Legal', y);

  const legalText = [
    'Art. 157 Código Tributario de El Salvador:',
    '• El empleador actúa como agente retenedor del Impuesto sobre la Renta',
    '• Obligación de retener y enterar al fisco las retenciones practicadas',
    '• Formulario F-910: Declaración de Retenciones de ISR',
    '• Plazo de declaración: Día 10 del mes siguiente al de la retención',
  ];

  for (let i = 0; i < legalText.length; i++) {
    doc
      .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(7)
      .fillColor(i === 0 ? COLORS.dark : COLORS.medium)
      .text(legalText[i], LEFT + 5, y, { width: PAGE_W - 10, lineBreak: false });
    y += 11;
  }
  y += 6;

  // ── Signature Line ─────────────────────────────────────────
  y = thinLine(doc, y);
  y += 8;

  doc
    .save()
    .moveTo(LEFT + 60, y + 35)
    .lineTo(LEFT + 260, y + 35)
    .strokeColor(COLORS.dark)
    .lineWidth(0.5)
    .stroke()
    .restore();

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.medium)
    .text('Firma del Representante del Empleador', LEFT + 60, y + 38, { width: 200, align: 'center', lineBreak: false });

  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor(COLORS.border)
    .text('Nombre, cargo y sello', LEFT + 60, y + 47, { width: 200, align: 'center', lineBreak: false });

  // ── Footer ─────────────────────────────────────────────────
  const footerY = 710;
  thinLine(doc, footerY);

  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(COLORS.medium)
    .text(
      'Constancia emitida conforme al Art. 157 del Código Tributario de El Salvador.',
      LEFT,
      footerY + 5,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );

  doc
    .font('Helvetica-Oblique')
    .fontSize(6)
    .fillColor(COLORS.red)
    .text(
      'Documento sin valor legal sin firma y sello',
      LEFT,
      footerY + 14,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );

  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor(COLORS.border)
    .text(
      `Generado: ${new Date().toLocaleDateString('es-SV')} ${new Date().toLocaleTimeString('es-SV')} — F-910 — ${empleado.codigo_empleado} — ${meses[periodo.mes - 1]} ${periodo.anio}`,
      LEFT,
      footerY + 24,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );
}

// ============================================================
// Public API
// ============================================================
export async function generateConstanciaIsrPdf(data: ConstanciaIsrData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      bufferPages: false,
      autoFirstPage: true,
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    generateConstanciaIsrPage(doc, data);
    doc.end();
  });
}

export type { ConstanciaIsrData, TramoISR };
