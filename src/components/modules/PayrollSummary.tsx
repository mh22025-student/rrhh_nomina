'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, AlertCircle, Printer, FileText, Calendar,
  Users, CheckCircle, Clock, Building2, ChevronDown, ChevronUp,
  Search, ArrowLeft, ScrollText, Coins, Receipt, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface PayrollSummaryProps {
  accessToken: string;
  userRole: string;
  initialPlanillaId?: string | null;
  onBack?: () => void;
}

interface PlanillaListItem {
  id: string;
  codigo_planilla: string;
  tipo: string;
  estado: string;
  fecha_inicio_periodo: string;
  fecha_fin_periodo: string;
  total_empleados: number;
  total_salarios_brutos: number;
  total_neto_a_pagar: number;
}

interface DetallePlanilla {
  id: string;
  salario_bruto: number;
  isss_laboral: number;
  afp_laboral: number;
  isr_retenido: number;
  salario_neto: number;
  isss_patronal: number;
  afp_patronal: number;
  empleado: {
    id: string;
    primer_nombre: string;
    segundo_nombre: string | null;
    primer_apellido: string;
    segundo_apellido: string | null;
    area: { nombre: string } | null;
  };
}

interface PlanillaDetalle {
  id: string;
  codigo_planilla: string;
  tipo: string;
  estado: string;
  fecha_inicio_periodo: string;
  fecha_fin_periodo: string;
  total_empleados: number;
  total_salarios_brutos: number;
  total_neto_a_pagar: number;
  total_deducciones?: number;
  total_cargas_patronales?: number;
  calculada_por?: { nombre: string; apellido: string } | null;
  aprobada_por?: { nombre: string; apellido: string } | null;
  fecha_calculo: string | null;
  fecha_aprobacion: string | null;
  observaciones: string | null;
  detalles_planilla: DetallePlanilla[];
}

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPlain = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const estadoLabels: Record<string, string> = {
  BORRADOR: 'Borrador',
  CALCULADA: 'Calculada',
  EN_CORRECCION: 'En Corrección',
  APROBADA: 'Aprobada',
  PAGADA: 'Pagada',
};

const estadoStyles: Record<string, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600',
  CALCULADA: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
  EN_CORRECCION: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800',
  APROBADA: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
  PAGADA: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
};

const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function formatDateSV(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-SV', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function formatDateTimeSV(dateStr: Date): string {
  return dateStr.toLocaleDateString('es-SV', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getNombreCompleto(d: DetallePlanilla): string {
  return [
    d.empleado.primer_nombre,
    d.empleado.segundo_nombre,
    d.empleado.primer_apellido,
    d.empleado.segundo_apellido,
  ].filter(Boolean).join(' ');
}

export default function PayrollSummary({
  accessToken,
  userRole,
  initialPlanillaId,
  onBack,
}: PayrollSummaryProps) {
  const { toast } = useToast();
  const [planillas, setPlanillas] = useState<PlanillaListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialPlanillaId ?? null);
  const [detalle, setDetalle] = useState<PlanillaDetalle | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [generatedAt, setGeneratedAt] = useState<Date>(new Date());
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  // Load list of planillas
  const fetchPlanillas = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/nomina/planillas?limit=100', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al cargar planillas');
      const data = await res.json();
      const list = (data.planillas || []) as PlanillaListItem[];
      // Sort by creation descending (use fecha_fin as proxy)
      list.sort((a, b) =>
        new Date(b.fecha_fin_periodo).getTime() - new Date(a.fecha_fin_periodo).getTime()
      );
      setPlanillas(list);
      // If no selection yet, pick the first one (most recent)
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las planillas',
        variant: 'destructive',
      });
    } finally {
      setLoadingList(false);
    }
  }, [accessToken, toast, selectedId]);

  useEffect(() => {
    fetchPlanillas();
  }, [accessToken]);

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedId) {
      setDetalle(null);
      return;
    }
    let cancelled = false;
    const fetchDetalle = async () => {
      setLoadingDetalle(true);
      try {
        const res = await fetch(`/api/nomina/planillas/${selectedId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error('Error al cargar detalle');
        const data = await res.json();
        if (!cancelled) {
          setDetalle(data.planilla || null);
          setGeneratedAt(new Date());
        }
      } catch {
        if (!cancelled) {
          toast({
            title: 'Error',
            description: 'No se pudo cargar el detalle de la planilla',
            variant: 'destructive',
          });
          setDetalle(null);
        }
      } finally {
        if (!cancelled) setLoadingDetalle(false);
      }
    };
    fetchDetalle();
    return () => { cancelled = true; };
  }, [selectedId, accessToken, toast]);

  // Compute totals
  const totals = useMemo(() => {
    if (!detalle?.detalles_planilla) {
      return {
        bruto: 0, isss: 0, afp: 0, isr: 0, neto: 0,
        isssPatronal: 0, afpPatronal: 0, cargasPatronales: 0,
        deducciones: 0,
      };
    }
    const detalles = detalle.detalles_planilla;
    return {
      bruto: detalles.reduce((s, d) => s + d.salario_bruto, 0),
      isss: detalles.reduce((s, d) => s + d.isss_laboral, 0),
      afp: detalles.reduce((s, d) => s + d.afp_laboral, 0),
      isr: detalles.reduce((s, d) => s + d.isr_retenido, 0),
      neto: detalles.reduce((s, d) => s + d.salario_neto, 0),
      isssPatronal: detalles.reduce((s, d) => s + d.isss_patronal, 0),
      afpPatronal: detalles.reduce((s, d) => s + d.afp_patronal, 0),
      cargasPatronales: detalle.total_cargas_patronales
        ?? detalles.reduce((s, d) => s + d.isss_patronal + d.afp_patronal, 0),
      deducciones: detalle.total_deducciones
        ?? detalles.reduce((s, d) => s + d.isss_laboral + d.afp_laboral + d.isr_retenido, 0),
    };
  }, [detalle]);

  // Filtered + sorted rows
  const rows = useMemo(() => {
    if (!detalle?.detalles_planilla) return [];
    let arr = [...detalle.detalles_planilla];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      arr = arr.filter(d => {
        const nombre = getNombreCompleto(d).toLowerCase();
        const puesto = (d.empleado.area?.nombre || '').toLowerCase();
        return nombre.includes(q) || puesto.includes(q);
      });
    }
    if (sortConfig) {
      arr.sort((a, b) => {
        let cmp = 0;
        switch (sortConfig.key) {
          case 'nombre':
            cmp = getNombreCompleto(a).localeCompare(getNombreCompleto(b));
            break;
          case 'puesto':
            cmp = (a.empleado.area?.nombre || '').localeCompare(b.empleado.area?.nombre || '');
            break;
          case 'salario_bruto':
            cmp = a.salario_bruto - b.salario_bruto;
            break;
          case 'isss':
            cmp = a.isss_laboral - b.isss_laboral;
            break;
          case 'afp':
            cmp = a.afp_laboral - b.afp_laboral;
            break;
          case 'isr':
            cmp = a.isr_retenido - b.isr_retenido;
            break;
          case 'salario_neto':
            cmp = a.salario_neto - b.salario_neto;
            break;
          default:
            cmp = 0;
        }
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    } else {
      // Default sort: alphabetical by apellido
      arr.sort((a, b) =>
        getNombreCompleto(a).localeCompare(getNombreCompleto(b))
      );
    }
    return arr;
  }, [detalle, searchTerm, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'asc' };
    });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.dir === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />;
  };

  // Print handler — reuses the print-container element used elsewhere
  const handlePrint = useCallback(async () => {
    if (!detalle) return;
    setPrintLoading(true);
    try {
      const printContainer = document.getElementById('print-container');
      if (!printContainer) {
        toast({
          title: 'Error',
          description: 'No se pudo encontrar el contenedor de impresión',
          variant: 'destructive',
        });
        return;
      }

      const detalles = detalle.detalles_planilla || [];
      const deducciones = totals.deducciones;
      const cargasPatronales = totals.cargasPatronales;
      const totalIsssLaboral = totals.isss;
      const totalAfpLaboral = totals.afp;
      const totalIsr = totals.isr;
      const totalIsssPatronal = totals.isssPatronal;
      const totalAfpPatronal = totals.afpPatronal;
      const calculadaPor = detalle.calculada_por
        ? `${detalle.calculada_por.nombre} ${detalle.calculada_por.apellido}`.trim()
        : '—';
      const aprobadaPor = detalle.aprobada_por
        ? `${detalle.aprobada_por.nombre} ${detalle.aprobada_por.apellido}`.trim()
        : '—';

      printContainer.innerHTML = `
        <div style="font-family: 'Inter', Arial, Helvetica, sans-serif; color: #1a1a1a; width: 100%; padding: 8px 12px; box-sizing: border-box;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 18px; border-bottom: 3px solid #059669; padding-bottom: 14px;">
            <h1 style="font-size: 15pt; margin: 0 0 4px 0; color: #065f46; letter-spacing: 0.3px; font-weight: 700;">Ministerio de Hacienda — República de El Salvador</h1>
            <h2 style="font-size: 12pt; margin: 0 0 6px 0; color: #047857; font-weight: 600;">Resumen de Planilla de Nómina</h2>
            <p style="font-size: 9pt; color: #6b7280; margin: 0;">Generado: ${formatDateTimeSV(new Date())}</p>
          </div>

          <!-- Planilla Details: 4-column grid using a table for layout reliability in print -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9.5pt; table-layout: fixed;">
            <colgroup>
              <col style="width: 25%;"><col style="width: 25%;"><col style="width: 25%;"><col style="width: 25%;">
            </colgroup>
            <tr>
              <td style="padding: 5px 8px; vertical-align: top;"><strong style="color: #374151;">Código:</strong> <span style="color: #111827;">${detalle.codigo_planilla}</span></td>
              <td style="padding: 5px 8px; vertical-align: top;"><strong style="color: #374151;">Tipo:</strong> <span style="color: #111827;">${detalle.tipo === 'MENSUAL' ? 'Mensual' : 'Quincenal'}</span></td>
              <td style="padding: 5px 8px; vertical-align: top;"><strong style="color: #374151;">Estado:</strong> <span style="color: #111827;">${estadoLabels[detalle.estado] || detalle.estado}</span></td>
              <td style="padding: 5px 8px; vertical-align: top;"><strong style="color: #374151;">Empleados:</strong> <span style="color: #111827;">${detalle.total_empleados}</span></td>
            </tr>
            <tr>
              <td style="padding: 5px 8px; vertical-align: top;"><strong style="color: #374151;">Período:</strong> <span style="color: #111827;">${formatDateSV(detalle.fecha_inicio_periodo)} — ${formatDateSV(detalle.fecha_fin_periodo)}</span></td>
              <td style="padding: 5px 8px; vertical-align: top;"><strong style="color: #374151;">Fecha Cálculo:</strong> <span style="color: #111827;">${formatDateSV(detalle.fecha_calculo)}</span></td>
              <td style="padding: 5px 8px; vertical-align: top;"><strong style="color: #374151;">Calculada por:</strong> <span style="color: #111827;">${calculadaPor}</span></td>
              <td style="padding: 5px 8px; vertical-align: top;"><strong style="color: #374151;">Aprobada por:</strong> <span style="color: #111827;">${aprobadaPor}</span></td>
            </tr>
          </table>

          <!-- Employee Table with FIXED column widths to prevent overlap -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 8.5pt; table-layout: fixed;">
            <colgroup>
              <col style="width: 4%;">
              <col style="width: 28%;">
              <col style="width: 16%;">
              <col style="width: 13%;">
              <col style="width: 9%;">
              <col style="width: 9%;">
              <col style="width: 9%;">
              <col style="width: 12%;">
            </colgroup>
            <thead>
              <tr style="background-color: #059669 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <th style="padding: 7px 4px; border: 1px solid #047857; text-align: center; color: #ffffff !important; font-weight: 600;">#</th>
                <th style="padding: 7px 6px; border: 1px solid #047857; text-align: left; color: #ffffff !important; font-weight: 600;">Nombre</th>
                <th style="padding: 7px 6px; border: 1px solid #047857; text-align: left; color: #ffffff !important; font-weight: 600;">Puesto</th>
                <th style="padding: 7px 6px; border: 1px solid #047857; text-align: right; color: #ffffff !important; font-weight: 600;">Salario Bruto</th>
                <th style="padding: 7px 4px; border: 1px solid #047857; text-align: right; color: #ffffff !important; font-weight: 600;">ISSS</th>
                <th style="padding: 7px 4px; border: 1px solid #047857; text-align: right; color: #ffffff !important; font-weight: 600;">AFP</th>
                <th style="padding: 7px 4px; border: 1px solid #047857; text-align: right; color: #ffffff !important; font-weight: 600;">ISR</th>
                <th style="padding: 7px 6px; border: 1px solid #047857; text-align: right; color: #ffffff !important; font-weight: 600;">Salario Neto</th>
              </tr>
            </thead>
            <tbody>
              ${detalles.map((d, i) => {
                const nombre = getNombreCompleto(d);
                const rowBg = i % 2 === 0 ? '#ffffff' : '#f0fdf4';
                return `<tr style="background-color: ${rowBg} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                  <td style="padding: 5px 4px; border: 1px solid #d1d5db; text-align: center; color: #6b7280;">${i + 1}</td>
                  <td style="padding: 5px 6px; border: 1px solid #d1d5db; color: #111827; word-wrap: break-word; overflow-wrap: break-word;">${nombre}</td>
                  <td style="padding: 5px 6px; border: 1px solid #d1d5db; color: #374151;">${d.empleado.area?.nombre || '—'}</td>
                  <td style="padding: 5px 6px; border: 1px solid #d1d5db; text-align: right; font-family: 'Courier New', monospace; color: #111827;">${fmtPlain(d.salario_bruto)}</td>
                  <td style="padding: 5px 4px; border: 1px solid #d1d5db; text-align: right; font-family: 'Courier New', monospace; color: #b91c1c;">${fmtPlain(d.isss_laboral)}</td>
                  <td style="padding: 5px 4px; border: 1px solid #d1d5db; text-align: right; font-family: 'Courier New', monospace; color: #c2410c;">${fmtPlain(d.afp_laboral)}</td>
                  <td style="padding: 5px 4px; border: 1px solid #d1d5db; text-align: right; font-family: 'Courier New', monospace; color: #b45309;">${fmtPlain(d.isr_retenido)}</td>
                  <td style="padding: 5px 6px; border: 1px solid #d1d5db; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #065f46;">${fmtPlain(d.salario_neto)}</td>
                </tr>`;
              }).join('')}
              <tr style="background-color: #ecfdf5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <td style="padding: 7px 4px; border: 1px solid #047857; color: #065f46;" colspan="3"><strong>TOTALES</strong></td>
                <td style="padding: 7px 6px; border: 1px solid #047857; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #065f46;">${fmtPlain(totals.bruto)}</td>
                <td style="padding: 7px 4px; border: 1px solid #047857; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #065f46;">${fmtPlain(totalIsssLaboral)}</td>
                <td style="padding: 7px 4px; border: 1px solid #047857; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #065f46;">${fmtPlain(totalAfpLaboral)}</td>
                <td style="padding: 7px 4px; border: 1px solid #047857; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #065f46;">${fmtPlain(totalIsr)}</td>
                <td style="padding: 7px 6px; border: 1px solid #047857; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #065f46;">${fmtPlain(totals.neto)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Cargas Patronales: side-by-side with summary box for better space use -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; table-layout: fixed;">
            <colgroup>
              <col style="width: 50%;"><col style="width: 50%;">
            </colgroup>
            <tr>
              <!-- Cargas Patronales (left) -->
              <td style="vertical-align: top; padding-right: 8px;">
                <h3 style="font-size: 10pt; color: #065f46; margin: 0 0 6px 0; border-bottom: 2px solid #059669; padding-bottom: 3px; font-weight: 700;">Cargas Patronales</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                  <tr style="background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <td style="padding: 5px 8px; border: 1px solid #d1d5db; color: #374151;">ISSS Patronal (7.5%)</td>
                    <td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: right; font-family: 'Courier New', monospace; color: #111827; width: 40%;">${fmtPlain(totalIsssPatronal)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 8px; border: 1px solid #d1d5db; color: #374151;">AFP Patronal (7.75%)</td>
                    <td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: right; font-family: 'Courier New', monospace; color: #111827;">${fmtPlain(totalAfpPatronal)}</td>
                  </tr>
                  <tr style="background-color: #ecfdf5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <td style="padding: 6px 8px; border: 1px solid #047857; color: #065f46; font-weight: 700;">Total Cargas Patronales</td>
                    <td style="padding: 6px 8px; border: 1px solid #047857; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #065f46;">${fmtPlain(cargasPatronales)}</td>
                  </tr>
                </table>
              </td>
              <!-- Resumen Final (right) -->
              <td style="vertical-align: top; padding-left: 8px;">
                <h3 style="font-size: 10pt; color: #065f46; margin: 0 0 6px 0; border-bottom: 2px solid #059669; padding-bottom: 3px; font-weight: 700;">Resumen Final</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                  <tr style="background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <td style="padding: 5px 8px; border: 1px solid #d1d5db; color: #374151;">Total Salarios Brutos</td>
                    <td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: right; font-family: 'Courier New', monospace; color: #111827; width: 40%;">${fmtPlain(totals.bruto)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 8px; border: 1px solid #d1d5db; color: #374151;">Total Deducciones</td>
                    <td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: right; font-family: 'Courier New', monospace; color: #b91c1c;">${fmtPlain(deducciones)}</td>
                  </tr>
                  <tr style="background-color: #ecfdf5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <td style="padding: 6px 8px; border: 1px solid #047857; color: #065f46; font-weight: 700;">Total Neto a Pagar</td>
                    <td style="padding: 6px 8px; border: 1px solid #047857; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; color: #065f46; font-size: 11pt;">${fmtPlain(totals.neto)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Legal Footer -->
          <div style="text-align: center; margin-top: 18px; padding-top: 10px; border-top: 1px solid #d1d5db; font-size: 8pt; color: #6b7280;">
            <p style="margin: 0;">Documento generado conforme a la legislación laboral de El Salvador</p>
            <p style="margin: 2px 0 0 0;">Código de Trabajo, Ley del ISSS, Ley del Sistema de Ahorro para Pensiones — Ministerio de Hacienda</p>
          </div>
        </div>
      `;

      printContainer.style.display = 'block';
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          printContainer.style.display = 'none';
        }, 500);
      }, 300);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo generar el documento de impresión',
        variant: 'destructive',
      });
    } finally {
      setPrintLoading(false);
    }
  }, [detalle, totals, toast]);

  // Render helpers
  const isLoading = loadingList || loadingDetalle;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-5 text-white shadow-lg no-print">
        <div className="absolute -right-6 -bottom-6 opacity-10">
          <FileText className="h-32 w-32" />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-white hover:bg-white/15 h-9 px-3"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
            )}
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Resumen de Planilla de Nómina</h2>
              <p className="text-sm text-emerald-100/90">
                Visualización del detalle completo por período — Ministerio de Hacienda
              </p>
            </div>
          </div>
          <Button
            onClick={handlePrint}
            disabled={!detalle || printLoading}
            className="bg-white text-emerald-800 hover:bg-emerald-50 font-medium shadow-md"
          >
            {printLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            Imprimir Resumen
          </Button>
        </div>
      </div>

      {/* Period selector toolbar */}
      <Card className="border-emerald-200 dark:border-emerald-800 shadow-sm no-print">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1.5 uppercase tracking-wide">
                Seleccionar Período de Nómina
              </label>
              {loadingList ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedId ?? undefined}
                  onValueChange={(v) => setSelectedId(v)}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500">
                    <SelectValue placeholder="Seleccione una planilla..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {planillas.length === 0 && (
                      <SelectItem value="__empty" disabled>
                        No hay planillas disponibles
                      </SelectItem>
                    )}
                    {planillas.map((p) => {
                      const inicio = new Date(p.fecha_inicio_periodo);
                      const fin = new Date(p.fecha_fin_periodo);
                      const periodoDesc = `${MONTHS_FULL[inicio.getMonth()]} ${inicio.getFullYear()}`;
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${estadoStyles[p.estado]}`}
                            >
                              {estadoLabels[p.estado] || p.estado}
                            </Badge>
                            <span className="font-medium">{p.codigo_planilla}</span>
                            <span className="text-slate-500 text-xs">
                              · {periodoDesc} · {p.total_empleados} emp. · {fmt(p.total_neto_a_pagar)}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPlanillas()}
              disabled={loadingList}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              {loadingList ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Actualizar
            </Button>
          </div>
          {detalle && (
            <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900/50 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
              <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                Mostrando resumen generado el{' '}
                <strong className="text-emerald-800 dark:text-emerald-300">
                  {formatDateTimeSV(generatedAt)}
                </strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main content */}
      {!detalle && isLoading && (
        <Card className="border-emerald-100 dark:border-emerald-900/50">
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-2/3 mx-auto" />
            <Skeleton className="h-4 w-1/3 mx-auto" />
            <Skeleton className="h-px w-full" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}

      {!detalle && !isLoading && (
        <Card className="border-emerald-100 dark:border-emerald-900/50">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400">
              Seleccione un período para ver el resumen
            </p>
          </CardContent>
        </Card>
      )}

      {detalle && (
        <>
          {/* Official Document Header */}
          <Card className="border-emerald-300 dark:border-emerald-800 shadow-md overflow-hidden print:border-0 print:shadow-none">
            <CardContent className="p-0">
              {/* Header */}
              <div className="text-center bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900 px-6 py-6 border-b-4 border-emerald-600 dark:border-emerald-500">
                <div className="flex justify-center mb-2">
                  <div className="p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 ring-2 ring-emerald-300 dark:ring-emerald-700">
                    <Building2 className="h-7 w-7 text-emerald-700 dark:text-emerald-300" />
                  </div>
                </div>
                <h1 className="text-lg md:text-xl font-bold text-emerald-800 dark:text-emerald-200 tracking-tight">
                  Ministerio de Hacienda — República de El Salvador
                </h1>
                <h2 className="text-base md:text-lg font-semibold text-emerald-700 dark:text-emerald-300 mt-1">
                  Resumen de Planilla de Nómina
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Generado: {formatDateTimeSV(generatedAt)}
                </p>
              </div>

              {/* Planilla Details Grid */}
              <div className="p-5 bg-white dark:bg-slate-900">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DetailItem
                    icon={<FileText className="h-3.5 w-3.5" />}
                    label="Código"
                    value={detalle.codigo_planilla}
                    color="emerald"
                  />
                  <DetailItem
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Tipo"
                    value={detalle.tipo === 'MENSUAL' ? 'Mensual' : 'Quincenal'}
                    color="teal"
                  />
                  <DetailItem
                    icon={<CheckCircle className="h-3.5 w-3.5" />}
                    label="Estado"
                    value={
                      <Badge variant="outline" className={`text-[10px] ${estadoStyles[detalle.estado]}`}>
                        {estadoLabels[detalle.estado] || detalle.estado}
                      </Badge>
                    }
                    color="amber"
                  />
                  <DetailItem
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="Empleados"
                    value={String(detalle.total_empleados)}
                    color="cyan"
                  />
                  <DetailItem
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Período"
                    value={`${formatDateSV(detalle.fecha_inicio_periodo)} — ${formatDateSV(detalle.fecha_fin_periodo)}`}
                    color="emerald"
                  />
                  <DetailItem
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Fecha Cálculo"
                    value={formatDateSV(detalle.fecha_calculo)}
                    color="teal"
                  />
                  <DetailItem
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="Calculada por"
                    value={
                      detalle.calculada_por
                        ? `${detalle.calculada_por.nombre} ${detalle.calculada_por.apellido}`.trim()
                        : '—'
                    }
                    color="cyan"
                  />
                  <DetailItem
                    icon={<ShieldCheck className="h-3.5 w-3.5" />}
                    label="Aprobada por"
                    value={
                      detalle.aprobada_por
                        ? `${detalle.aprobada_por.nombre} ${detalle.aprobada_por.apellido}`.trim()
                        : '—'
                    }
                    color="amber"
                  />
                </div>
              </div>

              {/* Employee Table */}
              <div className="px-5 pb-5 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between mb-3 no-print">
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Detalle de Empleados
                  </h3>
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Buscar empleado o puesto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-xs bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white">
                        <th className="px-2 py-2.5 text-center font-semibold w-10">#</th>
                        <th className="px-3 py-2.5 text-left font-semibold cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort('nombre')}>
                          Nombre {getSortIcon('nombre')}
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort('puesto')}>
                          Puesto {getSortIcon('puesto')}
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort('salario_bruto')}>
                          Salario Bruto {getSortIcon('salario_bruto')}
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort('isss')}>
                          ISSS {getSortIcon('isss')}
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort('afp')}>
                          AFP {getSortIcon('afp')}
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort('isr')}>
                          ISR {getSortIcon('isr')}
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort('salario_neto')}>
                          Salario Neto {getSortIcon('salario_neto')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500">
                            No se encontraron empleados con ese criterio
                          </td>
                        </tr>
                      )}
                      {rows.map((d, i) => (
                        <tr
                          key={d.id}
                          className={
                            i % 2 === 0
                              ? 'bg-white dark:bg-slate-900'
                              : 'bg-emerald-50/70 dark:bg-emerald-950/20'
                          }
                        >
                          <td className="px-2 py-2 text-center text-slate-500 dark:text-slate-400 font-mono">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-100 font-medium">
                            {getNombreCompleto(d)}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {d.empleado.area?.nombre || '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">
                            {fmtPlain(d.salario_bruto)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-rose-600 dark:text-rose-400">
                            {fmtPlain(d.isss_laboral)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-orange-600 dark:text-orange-400">
                            {fmtPlain(d.afp_laboral)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-amber-700 dark:text-amber-400">
                            {fmtPlain(d.isr_retenido)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            {fmtPlain(d.salario_neto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-100 dark:bg-emerald-900/40 font-bold border-t-2 border-emerald-600 dark:border-emerald-500">
                        <td colSpan={3} className="px-3 py-3 text-emerald-900 dark:text-emerald-100 uppercase tracking-wide text-xs">
                          Totales
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-emerald-900 dark:text-emerald-100">
                          {fmtPlain(totals.bruto)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-rose-700 dark:text-rose-300">
                          {fmtPlain(totals.isss)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-orange-700 dark:text-orange-300">
                          {fmtPlain(totals.afp)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-amber-800 dark:text-amber-300">
                          {fmtPlain(totals.isr)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-emerald-900 dark:text-emerald-100 text-sm">
                          {fmtPlain(totals.neto)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {rows.length < (detalle.detalles_planilla?.length ?? 0) && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 no-print">
                    Mostrando {rows.length} de {detalle.detalles_planilla?.length ?? 0} empleados (filtrado por búsqueda)
                  </p>
                )}
              </div>

              {/* Cargas Patronales Section */}
              <div className="px-5 pb-5 bg-white dark:bg-slate-900">
                <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-3 border-b border-emerald-200 dark:border-emerald-900/60 pb-2">
                  <Receipt className="h-4 w-4" />
                  Cargas Patronales
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl">
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 mb-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      ISSS Patronal (7.5%)
                    </div>
                    <p className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-200">
                      {fmt(totals.isssPatronal)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/30 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300 mb-1">
                      <Coins className="h-3.5 w-3.5" />
                      AFP Patronal (7.75%)
                    </div>
                    <p className="text-lg font-bold font-mono text-teal-800 dark:text-teal-200">
                      {fmt(totals.afpPatronal)}
                    </p>
                  </div>
                  <div className="rounded-lg border-2 border-emerald-400 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-200 mb-1 font-semibold uppercase tracking-wide">
                      <Receipt className="h-3.5 w-3.5" />
                      Total Cargas Patronales
                    </div>
                    <p className="text-xl font-bold font-mono text-emerald-900 dark:text-emerald-100">
                      {fmt(totals.cargasPatronales)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Final Summary Box */}
              <div className="px-5 pb-5 bg-white dark:bg-slate-900">
                <div className="rounded-lg border-2 border-emerald-500 dark:border-emerald-600 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/40 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                    <ScrollText className="h-4 w-4" />
                    Resumen Final
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SummaryBox
                      label="Total Salarios Brutos"
                      value={fmt(totals.bruto)}
                      color="emerald"
                    />
                    <SummaryBox
                      label="Total Deducciones"
                      value={fmt(totals.deducciones)}
                      color="rose"
                    />
                    <SummaryBox
                      label="Total Neto a Pagar"
                      value={fmt(totals.neto)}
                      color="emerald"
                      highlight
                    />
                    <SummaryBox
                      label="Cargas Patronales"
                      value={fmt(totals.cargasPatronales)}
                      color="teal"
                    />
                  </div>
                </div>
              </div>

              {/* Legal Footer */}
              <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-center">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Documento generado conforme a la legislación laboral de El Salvador
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Código de Trabajo, Ley del ISSS, Ley del Sistema de Ahorro para Pensiones — Ministerio de Hacienda
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Hidden print container — always rendered in this view.
              The @media print CSS in globals.css isolates it so only
              this container's content appears in the printed PDF. */}
          <div
            id="print-container"
            style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '100%', background: 'white', zIndex: 9999 }}
          />
        </>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color: 'emerald' | 'teal' | 'amber' | 'cyan';
}

function DetailItem({ icon, label, value, color }: DetailItemProps) {
  const colorClasses: Record<DetailItemProps['color'], { wrap: string; iconBg: string; iconText: string; label: string }> = {
    emerald: {
      wrap: 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/60',
      iconText: 'text-emerald-700 dark:text-emerald-300',
      label: 'text-emerald-700 dark:text-emerald-300',
    },
    teal: {
      wrap: 'border-teal-200 dark:border-teal-800/60 bg-teal-50/50 dark:bg-teal-950/20',
      iconBg: 'bg-teal-100 dark:bg-teal-900/60',
      iconText: 'text-teal-700 dark:text-teal-300',
      label: 'text-teal-700 dark:text-teal-300',
    },
    amber: {
      wrap: 'border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20',
      iconBg: 'bg-amber-100 dark:bg-amber-900/60',
      iconText: 'text-amber-700 dark:text-amber-300',
      label: 'text-amber-700 dark:text-amber-300',
    },
    cyan: {
      wrap: 'border-cyan-200 dark:border-cyan-800/60 bg-cyan-50/50 dark:bg-cyan-950/20',
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/60',
      iconText: 'text-cyan-700 dark:text-cyan-300',
      label: 'text-cyan-700 dark:text-cyan-300',
    },
  };
  const c = colorClasses[color];
  return (
    <div className={`rounded-lg border ${c.wrap} p-2.5 flex items-start gap-2`}>
      <div className={`p-1 rounded ${c.iconBg} ${c.iconText} flex-shrink-0 mt-0.5`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-[10px] font-semibold uppercase tracking-wide ${c.label}`}>
          {label}
        </div>
        <div className="text-sm text-slate-800 dark:text-slate-100 font-medium mt-0.5 truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

interface SummaryBoxProps {
  label: string;
  value: string;
  color: 'emerald' | 'teal' | 'rose';
  highlight?: boolean;
}

function SummaryBox({ label, value, color, highlight }: SummaryBoxProps) {
  const colorClasses: Record<SummaryBoxProps['color'], string> = {
    emerald: 'text-emerald-800 dark:text-emerald-200',
    teal: 'text-teal-800 dark:text-teal-200',
    rose: 'text-rose-700 dark:text-rose-300',
  };
  return (
    <div className={`text-center ${highlight ? 'md:col-span-1' : ''}`}>
      <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`font-mono font-bold ${highlight ? 'text-2xl' : 'text-xl'} ${colorClasses[color]}`}>
        {value}
      </div>
    </div>
  );
}
