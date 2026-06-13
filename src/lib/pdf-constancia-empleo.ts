import PDFDocument from 'pdfkit';

// ============================================================
// PDF Employment Certificate (Constancia de Empleo) Generator
// El Salvador Payroll System
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
  new Date(d).toLocaleDateString('es-SV', { year: 'numeric', month: 'long', day: 'numeric' });

// ── Types ────────────────────────────────────────────────────
interface ConstanciaEmpleoData {
  empleado: {
    codigo_empleado: string;
    primer_nombre: string;
    segundo_nombre?: string | null;
    primer_apellido: string;
    segundo_apellido?: string | null;
    dui: string;
    fecha_ingreso: Date;
    salario_base: number;
    estado: string;
    area?: { nombre: string } | null;
    perfil_puesto?: { nombre_puesto: string } | null;
  };
  contrato?: {
    tipo_contrato: string;
    fecha_inicio: Date;
    fecha_fin?: Date | null;
  } | null;
  empresa?: {
    nombre: string;
    nit: string;
    nrc: string;
    direccion?: string;
  };
  tipo: 'empleo' | 'salario';
  incluir_salario: boolean;
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
    .text(label, x + 5, y + 2, { width: w * 0.45, lineBreak: false });

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

function getTipoContratoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    INDEFINIDO: 'Contrato Indefinido',
    PLAZO_FIJO: 'Contrato a Plazo Fijo',
    OBRA_LABOR: 'Contrato por Obra o Labor',
    TEMPORAL: 'Contrato Temporal',
  };
  return labels[tipo] || tipo;
}

// ============================================================
// Generate the Employment Certificate PDF page
// ============================================================
function generateConstanciaEmpleoPage(doc: PDFDocument, data: ConstanciaEmpleoData) {
  const { empleado, contrato, empresa, tipo, incluir_salario } = data;
  let y = 40;

  const fullName = [
    empleado.primer_nombre,
    empleado.segundo_nombre,
    empleado.primer_apellido,
    empleado.segundo_apellido,
  ].filter(Boolean).join(' ');

  const isSalario = tipo === 'salario';

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
    .fontSize(16)
    .fillColor(COLORS.primaryDark)
    .text(isSalario ? 'CONSTANCIA DE EMPLEO Y SALARIO' : 'CONSTANCIA DE EMPLEO', LEFT, y, { width: PAGE_W, align: 'center', lineBreak: false });
  y += 24;
  y = thinLine(doc, y);
  y += 8;

  // ── Body Text ──────────────────────────────────────────────
  const bodyText = `Por medio de la presente se hace constar que el(la) señor(a) ${fullName}, portador(a) del Documento Único de Identidad número ${empleado.dui}, labora en esta institución desde el ${fmtDate(empleado.fecha_ingreso)}, desempeñando el cargo de ${empleado.perfil_puesto?.nombre_puesto || 'N/A'}${empleado.area ? ` en el departamento de ${empleado.area.nombre}` : ''}.`;

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.dark)
    .text(bodyText, LEFT + 4, y, { width: PAGE_W - 8, lineGap: 4 });
  y += 70;

  // ── Employment Details ─────────────────────────────────────
  y = sectionBar(doc, 'Detalle de Empleo', y);

  const halfW = PAGE_W / 2;

  y = row(doc, 'Nombre completo:', fullName, y, { alt: true });
  y = row(doc, 'DUI:', empleado.dui, y, { x: LEFT, w: halfW, alt: true });
  const yCod = y - ROW_H;
  row(doc, 'Código:', empleado.codigo_empleado, yCod, { x: LEFT + halfW, w: halfW, alt: true });
  y = row(doc, 'Puesto:', empleado.perfil_puesto?.nombre_puesto || 'N/A', y, { alt: false });
  y = row(doc, 'Departamento:', empleado.area?.nombre || 'N/A', y, { alt: true });
  y = row(doc, 'Fecha de Ingreso:', fmtDate(empleado.fecha_ingreso), y, { x: LEFT, w: halfW, alt: false });
  const yEstado = y - ROW_H;
  row(doc, 'Estado:', empleado.estado, yEstado, { x: LEFT + halfW, w: halfW, alt: false });

  if (contrato) {
    y = row(doc, 'Tipo de Contrato:', getTipoContratoLabel(contrato.tipo_contrato), y, { x: LEFT, w: halfW, alt: true });
    const yFin = y - ROW_H;
    row(doc, 'Vigencia:', contrato.fecha_fin ? fmtDate(contrato.fecha_fin) : 'Indefinido', yFin, { x: LEFT + halfW, w: halfW, alt: true });
  } else {
    y = row(doc, 'Tipo de Contrato:', 'N/A', y, { alt: true });
  }

  // ── Salary Section (if requested) ──────────────────────────
  if (incluir_salario || isSalario) {
    y += 4;
    y = sectionBar(doc, 'Información Salarial', y);

    // Salary highlight box
    const salaryH = ROW_H + 8;
    doc.save().rect(LEFT, y - 1, PAGE_W, salaryH).fill(COLORS.emerald50).restore();
    doc
      .save()
      .rect(LEFT, y - 1, PAGE_W, salaryH)
      .strokeColor(COLORS.primary)
      .lineWidth(1.5)
      .stroke()
      .restore();

    row(doc, 'Salario Mensual:', fmt(empleado.salario_base), y + 2, {
      bold: true,
      color: COLORS.primaryDark,
    });
    y += salaryH + 4;

    // Salary disclaimer
    doc
      .font('Helvetica-Oblique')
      .fontSize(7)
      .fillColor(COLORS.medium)
      .text('* La información salarial es confidencial y se proporciona únicamente a solicitud del interesado(a)', LEFT + 4, y, { width: PAGE_W - 8, lineBreak: false });
    y += 14;
  }

  y += 8;

  // ── Closing Text ───────────────────────────────────────────
  const closingText = 'Se extiende la presente constancia a solicitud del interesado(a), para los fines que al mismo(a) convengan.';
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.dark)
    .text(closingText, LEFT + 4, y, { width: PAGE_W - 8, lineGap: 3 });
  y += 36;

  // ── City and Date ──────────────────────────────────────────
  const cityText = `San Salvador, ${fmtDate(new Date())}`;
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.dark)
    .text(cityText, LEFT + 4, y, { width: PAGE_W - 8, align: 'right', lineBreak: false });
  y += 24;

  // ── Signature Line ─────────────────────────────────────────
  y = thinLine(doc, y);
  y += 12;

  // RRHH signature
  doc
    .save()
    .moveTo(LEFT + PAGE_W / 2 - 100, y + 35)
    .lineTo(LEFT + PAGE_W / 2 + 100, y + 35)
    .strokeColor(COLORS.dark)
    .lineWidth(0.5)
    .stroke()
    .restore();

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(COLORS.dark)
    .text('Recursos Humanos', LEFT + PAGE_W / 2 - 100, y + 38, { width: 200, align: 'center', lineBreak: false });

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.medium)
    .text('Firma y sello', LEFT + PAGE_W / 2 - 100, y + 48, { width: 200, align: 'center', lineBreak: false });

  // ── Seal Placeholder ───────────────────────────────────────
  // Right side: circular seal placeholder
  const sealCx = LEFT + PAGE_W - 60;
  const sealCy = y + 20;
  doc.save();
  doc.circle(sealCx, sealCy, 25).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.circle(sealCx, sealCy, 22).strokeColor(COLORS.border).lineWidth(0.3).stroke();
  doc
    .font('Helvetica')
    .fontSize(5)
    .fillColor(COLORS.border)
    .text('SELLO', sealCx - 15, sealCy - 3, { width: 30, align: 'center', lineBreak: false });
  doc.restore();

  // ── Footer ─────────────────────────────────────────────────
  const footerY = 710;
  thinLine(doc, footerY);

  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(COLORS.medium)
    .text(
      'Documento sin valor legal sin firma y sello.',
      LEFT,
      footerY + 5,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );

  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor(COLORS.border)
    .text(
      `Generado: ${new Date().toLocaleDateString('es-SV')} ${new Date().toLocaleTimeString('es-SV')} — Constancia de Empleo — ${empleado.codigo_empleado}`,
      LEFT,
      footerY + 16,
      { width: PAGE_W, align: 'center', lineBreak: false }
    );
}

// ============================================================
// Public API
// ============================================================
export async function generateConstanciaEmpleoPdf(data: ConstanciaEmpleoData): Promise<Buffer> {
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

    generateConstanciaEmpleoPage(doc, data);
    doc.end();
  });
}

export type { ConstanciaEmpleoData };
