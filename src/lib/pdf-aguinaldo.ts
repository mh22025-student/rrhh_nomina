import PDFDocument from 'pdfkit';

// ============================================================
// PDF Aguinaldo (Christmas Bonus) Generator
// El Salvador Payroll System — Arts. 196-202 CT
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
};

const fmt = (n: number): string =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date): string =>
  new Date(d).toLocaleDateString('es-SV');

// ── Types ────────────────────────────────────────────────────
interface AguinaldoData {
  empleado: {
    codigo_empleado: string;
    primer_nombre: string;
    segundo_nombre?: string | null;
    primer_apellido: string;
    segundo_apellido?: string | null;
    dui: string;
    fecha_ingreso: Date;
    area?: { nombre: string } | null;
    perfil_puesto?: { nombre_puesto: string } | null;
  };
  calculo: {
    anio: number;
    salario_ordinario_mensual: number;
    salario_diario: number;
    anios_servicio: number;
    dias_aguinaldo: number;
    aguinaldo_bruto: number;
    exencion_isr: number;
    aguinaldo_gravado: number;
    isr_aguinaldo: number;
    aguinaldo_neto: number;
  };
  empresa?: {
    nombre: string;
    nit: string;
    nrc: string;
  };
}

// ── Layout constants ────────────────────────────────────────
const LEFT = 50;
const PAGE_W = 512; // 612 - 2*50
const ROW_H = 14;
const HDR_H = 18;

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

function getDiasAguinaldoLabel(anios: number): string {
  if (anios < 1) return 'Proporcional';
  if (anios < 3) return '15 días';
  if (anios < 10) return '19 días';
  return '21 días';
}

// ============================================================
// Generate the Aguinaldo PDF page
// ============================================================
function generateAguinaldoPage(doc: PDFDocument, data: AguinaldoData) {
  const { empleado, calculo, empresa } = data;
  let y = 40;

  // ── Company Header ────────────────────────────────────────
  doc.save().rect(LEFT, y, PAGE_W, 42).fill(COLORS.primary).restore();

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
    .text('República de El Salvador — Ministerio de Trabajo y Previsión Social', LEFT, y + 32, {
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
    .text('CONSTANCIA DE AGUINALDO', LEFT, y, { width: PAGE_W, align: 'center', lineBreak: false });
  y += 18;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.medium)
    .text(`Ejercicio Fiscal: ${calculo.anio}`, LEFT, y, { width: PAGE_W, align: 'center', lineBreak: false });
  y += 14;
  y = thinLine(doc, y);
  y += 4;

  // ── Employee Information ──────────────────────────────────
  y = sectionBar(doc, 'Información del Empleado', y);

  const fullName = [
    empleado.primer_nombre,
    empleado.segundo_nombre,
    empleado.primer_apellido,
    empleado.segundo_apellido,
  ].filter(Boolean).join(' ');

  const halfW = PAGE_W / 2;

  y = row(doc, 'Nombre:', fullName, y, { alt: true });
  y = row(doc, 'Código Empleado:', empleado.codigo_empleado, y, { x: LEFT, w: halfW, alt: true });
  const yDui = y - ROW_H;
  row(doc, 'DUI:', empleado.dui, yDui, { x: LEFT + halfW, w: halfW, alt: true });
  y = row(doc, 'Puesto:', empleado.perfil_puesto?.nombre_puesto || 'N/A', y, { x: LEFT, w: halfW, alt: true });
  const yArea = y - ROW_H;
  row(doc, 'Área:', empleado.area?.nombre || 'N/A', yArea, { x: LEFT + halfW, w: halfW, alt: true });
  y = row(doc, 'Fecha de Ingreso:', fmtDate(empleado.fecha_ingreso), y, { alt: true });
  y = row(doc, 'Años de Servicio:', calculo.anios_servicio.toFixed(1), y, { alt: false });
  y += 4;

  // ── Calculation Breakdown ─────────────────────────────────
  y = sectionBar(doc, 'Desglose de Cálculo', y);

  y = row(doc, 'Salario Ordinario Mensual:', fmt(calculo.salario_ordinario_mensual), y, { alt: true });
  y = row(doc, 'Salario Diario (mensual ÷ 30):', fmt(calculo.salario_diario), y, { alt: false });

  // Aguinaldo days with legal reference
  const diasLabel = getDiasAguinaldoLabel(calculo.anios_servicio);
  y = row(doc, `Días de Aguinaldo (${diasLabel}):`, calculo.dias_aguinaldo.toFixed(1), y, { alt: true });
  y = row(doc, 'Aguinaldo Bruto (diario × días):', fmt(calculo.aguinaldo_bruto), y, { alt: false, bold: true, color: COLORS.primaryDark });
  y += 3;

  // ISR calculation
  y = thinLine(doc, y);
  y += 2;

  y = row(doc, 'Exención ISR (2× salario mínimo):', fmt(calculo.exencion_isr), y, { alt: true });
  y = row(doc, 'Aguinaldo Gravado:', fmt(calculo.aguinaldo_gravado), y, { alt: false });
  y = row(doc, 'ISR sobre Aguinaldo:', fmt(calculo.isr_aguinaldo), y, { alt: true, color: calculo.isr_aguinaldo > 0 ? COLORS.red : COLORS.dark });
  y += 4;

  // ── Net Total Box ─────────────────────────────────────────
  const summaryH = ROW_H * 2 + 8;
  doc.save().rect(LEFT, y - 1, PAGE_W, summaryH).fill(COLORS.emerald50).restore();
  doc
    .save()
    .rect(LEFT, y - 1, PAGE_W, summaryH)
    .strokeColor(COLORS.primary)
    .lineWidth(1.5)
    .stroke()
    .restore();

  row(doc, 'AGUINALDO NETO A PAGAR', fmt(calculo.aguinaldo_neto), y + 4, {
    bold: true,
    color: COLORS.primaryDark,
  });
  y += summaryH + 8;

  // ── Legal Reference ────────────────────────────────────────
  y = sectionBar(doc, 'Base Legal', y);

  const legalText = [
    'Arts. 196-202 Código de Trabajo de El Salvador:',
    '• Art. 196: Todo trabajador tiene derecho a aguinaldo',
    '• Art. 197: 15 días (1-3 años), 19 días (3-10 años), 21 días (10+ años)',
    '• Art. 198: Proporcional si no completó el año',
    '• Art. 199: Base de cálculo = salario ordinario',
    '• Exención ISR: Hasta 2× salario mínimo del sector',
  ];

  for (let i = 0; i < legalText.length; i++) {
    doc
      .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(7)
      .fillColor(i === 0 ? COLORS.dark : COLORS.medium)
      .text(legalText[i], LEFT + 5, y, { width: PAGE_W - 10, lineBreak: false });
    y += 11;
  }
  y += 8;

  // ── Signature Line ─────────────────────────────────────────
  y = thinLine(doc, y);
  y += 6;

  // Left signature: Employer
  doc
    .save()
    .moveTo(LEFT + 30, y + 40)
    .lineTo(LEFT + 200, y + 40)
    .strokeColor(COLORS.dark)
    .lineWidth(0.5)
    .stroke()
    .restore();

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.medium)
    .text('Firma del Empleador', LEFT + 30, y + 43, { width: 170, align: 'center', lineBreak: false });

  // Right signature: Employee
  doc
    .save()
    .moveTo(LEFT + PAGE_W - 200, y + 40)
    .lineTo(LEFT + PAGE_W - 30, y + 40)
    .strokeColor(COLORS.dark)
    .lineWidth(0.5)
    .stroke()
    .restore();

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.medium)
    .text('Firma del Empleado', LEFT + PAGE_W - 200, y + 43, { width: 170, align: 'center', lineBreak: false });

  // ── Footer ─────────────────────────────────────────────────
  const footerY = 710;
  thinLine(doc, footerY);

  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(COLORS.medium)
    .text(
      'Documento generado conforme a los Arts. 196-202 del Código de Trabajo de El Salvador.',
      LEFT,
      footerY + 5,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );

  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor(COLORS.border)
    .text(
      `Generado: ${new Date().toLocaleDateString('es-SV')} — Aguinaldo ${calculo.anio} — ${empleado.codigo_empleado}`,
      LEFT,
      footerY + 16,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );
}

// ============================================================
// Public API
// ============================================================
export async function generateAguinaldoPdf(data: AguinaldoData): Promise<Buffer> {
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

    generateAguinaldoPage(doc, data);
    doc.end();
  });
}

export type { AguinaldoData };
