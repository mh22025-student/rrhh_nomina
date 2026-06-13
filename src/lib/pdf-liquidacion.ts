import PDFDocument from 'pdfkit';

// ============================================================
// PDF Liquidación (Severance Pay) Generator
// El Salvador Payroll System — Art. 58 CT
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
  orange: '#ea580c',
  orange50: '#fff7ed',
};

const fmt = (n: number): string =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date): string =>
  new Date(d).toLocaleDateString('es-SV');

// ── Types ────────────────────────────────────────────────────
interface LiquidacionData {
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
  liquidacion: {
    tipo: string;
    fecha_liquidacion: Date;
    salario_base: number;
    salario_diario: number;
    anios_servicio: number;
    indemnizacion: number;
    prestacion_economica: number;
    vacacion_proporcional: number;
    aguinaldo_proporcional: number;
    salario_pendiente: number;
    total_liquidacion: number;
  };
  desglose: {
    indemnizacion: { monto: number; base_legal: string; formula: string };
    prestacion_economica: { monto: number; base_legal: string; formula: string };
    vacacion_proporcional: { monto: number; base_legal: string; formula: string };
    aguinaldo_proporcional: { monto: number; base_legal: string; formula: string };
    salario_pendiente: { monto: number; base_legal: string; formula: string };
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

const tipoLabels: Record<string, string> = {
  DESPEDO_INJUSTIFICADO: 'Despido Injustificado',
  RENUNCIA_VOLUNTARIA: 'Renuncia Voluntaria',
  DESPEDO_JUSTIFICADO: 'Despido Justificado',
  FIN_CONTRATO: 'Fin de Contrato',
};

// ============================================================
// Generate the Liquidación PDF page
// ============================================================
function generateLiquidacionPage(doc: PDFDocument, data: LiquidacionData) {
  const { empleado, liquidacion, desglose, empresa } = data;
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
    .text('CONSTANCIA DE LIQUIDACIÓN', LEFT, y, { width: PAGE_W, align: 'center', lineBreak: false });
  y += 16;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.orange)
    .text(`Tipo: ${tipoLabels[liquidacion.tipo] || liquidacion.tipo}`, LEFT, y, { width: PAGE_W, align: 'center', lineBreak: false });
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
  y = row(doc, 'Fecha de Ingreso:', fmtDate(empleado.fecha_ingreso), y, { x: LEFT, w: halfW, alt: true });
  const yFechaLiq = y - ROW_H;
  row(doc, 'Fecha Liquidación:', fmtDate(liquidacion.fecha_liquidacion), yFechaLiq, { x: LEFT + halfW, w: halfW, alt: true });
  y = row(doc, 'Años de Servicio:', liquidacion.anios_servicio.toFixed(1), y, { alt: false });
  y += 4;

  // ── Salary Info ────────────────────────────────────────────
  y = sectionBar(doc, 'Información Salarial', y);

  y = row(doc, 'Salario Base Mensual:', fmt(liquidacion.salario_base), y, { alt: true });
  y = row(doc, 'Salario Diario (mensual ÷ 30):', fmt(liquidacion.salario_diario), y, { alt: false });
  y += 4;

  // ── Calculation Breakdown ─────────────────────────────────
  y = sectionBar(doc, 'Desglose de Liquidación', y);

  // Each component
  const components: Array<{ label: string; monto: number; base_legal: string; formula: string }> = [
    { label: 'Indemnización (Art. 58 CT)', ...desglose.indemnizacion },
    { label: 'Prestación Económica (Ley 523)', ...desglose.prestacion_economica },
    { label: 'Vacación Proporcional', ...desglose.vacacion_proporcional },
    { label: 'Aguinaldo Proporcional', ...desglose.aguinaldo_proporcional },
    { label: 'Salario Pendiente', ...desglose.salario_pendiente },
  ];

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    if (comp.monto <= 0) continue;

    y = row(doc, comp.label, fmt(comp.monto), y, {
      alt: i % 2 === 0,
      bold: false,
    });

    // Show base legal if applicable
    if (comp.base_legal && comp.base_legal !== 'N/A') {
      doc
        .font('Helvetica-Oblique')
        .fontSize(6.5)
        .fillColor(COLORS.medium)
        .text(comp.base_legal, LEFT + 15, y - 4, { width: PAGE_W - 20, lineBreak: false });
      y += 8;
    }
  }
  y += 4;

  // ── Total Box ──────────────────────────────────────────────
  const summaryH = ROW_H * 2 + 8;
  doc.save().rect(LEFT, y - 1, PAGE_W, summaryH).fill(COLORS.emerald50).restore();
  doc
    .save()
    .rect(LEFT, y - 1, PAGE_W, summaryH)
    .strokeColor(COLORS.primary)
    .lineWidth(1.5)
    .stroke()
    .restore();

  row(doc, 'TOTAL LIQUIDACIÓN', fmt(liquidacion.total_liquidacion), y + 4, {
    bold: true,
    color: COLORS.primaryDark,
  });
  y += summaryH + 8;

  // ── Legal Reference ────────────────────────────────────────
  y = sectionBar(doc, 'Base Legal', y);

  const legalText = liquidacion.tipo === 'DESPEDO_INJUSTIFICADO'
    ? [
        'Art. 58 Código de Trabajo de El Salvador — Despido Injustificado:',
        '• Indemnización: 30 días por año de servicio (máximo 4 años de salario)',
        '• Mínimo garantizado: 6 meses de salario',
        '• Incluye: Vacación proporcional (Art. 177 CT) + Aguinaldo proporcional (Arts. 196-202 CT)',
      ]
    : liquidacion.tipo === 'RENUNCIA_VOLUNTARIA'
      ? [
          'Ley 523 — Renuncia Voluntaria:',
          '• Prestación económica: 15 días por año de servicio',
          '• Incluye: Vacación proporcional (Art. 177 CT) + Aguinaldo proporcional (Arts. 196-202 CT)',
        ]
      : [
          'Código de Trabajo de El Salvador:',
          '• Vacación proporcional (Art. 177 CT)',
          '• Aguinaldo proporcional (Arts. 196-202 CT)',
          '• Salario pendiente (Art. 139 CT)',
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

  // ── Signature Lines ────────────────────────────────────────
  y = thinLine(doc, y);
  y += 6;

  // Left signature: Employer
  doc
    .save()
    .moveTo(LEFT + 30, y + 35)
    .lineTo(LEFT + 200, y + 35)
    .strokeColor(COLORS.dark)
    .lineWidth(0.5)
    .stroke()
    .restore();

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.medium)
    .text('Firma del Empleador', LEFT + 30, y + 38, { width: 170, align: 'center', lineBreak: false });

  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor(COLORS.border)
    .text('Nombre y sello', LEFT + 30, y + 47, { width: 170, align: 'center', lineBreak: false });

  // Right signature: Employee
  doc
    .save()
    .moveTo(LEFT + PAGE_W - 200, y + 35)
    .lineTo(LEFT + PAGE_W - 30, y + 35)
    .strokeColor(COLORS.dark)
    .lineWidth(0.5)
    .stroke()
    .restore();

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.medium)
    .text('Firma del Empleado', LEFT + PAGE_W - 200, y + 38, { width: 170, align: 'center', lineBreak: false });

  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor(COLORS.border)
    .text('Conforme con la liquidación', LEFT + PAGE_W - 200, y + 47, { width: 170, align: 'center', lineBreak: false });

  // ── Footer ─────────────────────────────────────────────────
  const footerY = 710;
  thinLine(doc, footerY);

  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(COLORS.medium)
    .text(
      'Documento generado conforme al Art. 58 del Código de Trabajo de El Salvador.',
      LEFT,
      footerY + 5,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );

  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor(COLORS.border)
    .text(
      `Generado: ${new Date().toLocaleDateString('es-SV')} — Liquidación — ${empleado.codigo_empleado}`,
      LEFT,
      footerY + 16,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );
}

// ============================================================
// Public API
// ============================================================
export async function generateLiquidacionPdf(data: LiquidacionData): Promise<Buffer> {
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

    generateLiquidacionPage(doc, data);
    doc.end();
  });
}

export type { LiquidacionData };
