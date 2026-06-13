'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator, Users, FileText, DollarSign, Shield, CheckCircle,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, Download,
  ArrowLeft, ArrowRight, RefreshCw, Eye, Circle, Minus
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface PayrollCalculationProps {
  accessToken: string;
  userRole: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STEPS = [
  { num: 1, label: 'Seleccionar Período', icon: FileText },
  { num: 2, label: 'Verificar Empleados', icon: Users },
  { num: 3, label: 'Cargar Incidencias', icon: AlertTriangle },
  { num: 4, label: 'Salarios Brutos', icon: DollarSign },
  { num: 5, label: 'Deducciones', icon: Shield },
  { num: 6, label: 'Descuentos Adicionales', icon: Calculator },
  { num: 7, label: 'Salarios Netos', icon: DollarSign },
  { num: 8, label: 'Revisar y Confirmar', icon: CheckCircle },
];

interface CalculationResult {
  planilla: {
    id: string;
    codigo_planilla: string;
    tipo: string;
    estado: string;
    total_empleados: number;
    total_salarios_brutos: number;
    total_isss_laboral: number;
    total_afp_laboral: number;
    total_isr_retenido: number;
    total_descuentos: number;
    total_neto_a_pagar: number;
    total_cargas_patronales: number;
  };
  detalles: Array<{
    empleado_id: string;
    salario_base: number;
    total_horas_extra: number;
    total_comisiones: number;
    total_bonos: number;
    salario_bruto: number;
    isss_laboral: number;
    afp_laboral: number;
    renta_imponible: number;
    isr_retenido: number;
    cuota_alimenticia: number;
    prestamo_patronal: number;
    seguro_complementario: number;
    otros_descuentos: number;
    total_descuentos: number;
    salario_neto: number;
    observaciones: string;
  }>;
  anomalies: Array<{
    empleado_id: string;
    empleado_nombre: string;
    tipo: string;
    detalle: string;
    severidad: string;
  }>;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const avatarColors = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
];

export default function PayrollCalculation({ accessToken }: PayrollCalculationProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipo, setTipo] = useState('MENSUAL');
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [empleados, setEmpleados] = useState<Array<{ id: string; codigo: string; nombre: string; tieneContrato: boolean; tieneISSS: boolean; tieneAFP: boolean; salarioBase?: number }>>([]);
  const [incidencias, setIncidencias] = useState<Array<{ empleado: string; tipo: string; monto: number; horas: number | null; estado: string }>>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedEmpleados, setSelectedEmpleados] = useState<Set<string>>(new Set());

  const fetchPreviewData = useCallback(async () => {
    if (!fechaInicio || !fechaFin) return;
    setLoadingData(true);
    try {
      const empRes = await fetch('/api/nomina/planillas?limit=1', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, [accessToken, fechaInicio, fechaFin]);

  const handleCalculate = async () => {
    if (!fechaInicio || !fechaFin) {
      toast({ title: 'Error', description: 'Complete las fechas del período', variant: 'destructive' });
      return;
    }
    setCalculating(true);
    try {
      const res = await fetch('/api/nomina/calcular', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoInicio: fechaInicio, periodoFin: fechaFin, tipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular');
      setResult(data);
      const emps = data.detalles.map((d: CalculationResult['detalles'][0]) => ({
        id: d.empleado_id,
        codigo: d.empleado_id.substring(0, 8),
        nombre: d.observaciones || 'Empleado',
        tieneContrato: true,
        tieneISSS: true,
        tieneAFP: true,
        salarioBase: d.salario_base,
      }));
      setEmpleados(emps);
      setSelectedEmpleados(new Set(emps.map((e: { id: string }) => e.id)));
      setIncidencias(
        data.detalles
          .filter((d: CalculationResult['detalles'][0]) => d.total_horas_extra > 0 || d.total_comisiones > 0 || d.total_bonos > 0)
          .map((d: CalculationResult['detalles'][0]) => ({
            empleado: d.empleado_id.substring(0, 8),
            tipo: 'Mixto',
            monto: d.total_horas_extra + d.total_comisiones + d.total_bonos,
            horas: d.total_horas_extra > 0 ? d.total_horas_extra : null,
            estado: 'APROBADA',
          }))
      );
      toast({ title: 'Cálculo Completado', description: `${data.planilla.total_empleados} empleados procesados` });
      setStep(8);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al calcular nómina', variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  };

  const exportCSV = () => {
    if (!result) return;
    const headers = ['Empleado ID', 'Salario Base', 'Horas Extra', 'Comisiones', 'Bonos', 'Salario Bruto', 'ISSS Laboral', 'AFP Laboral', 'Renta Imponible', 'ISR Retenido', 'Descuentos', 'Salario Neto'];
    const rows = result.detalles.map(d => [
      d.empleado_id, d.salario_base, d.total_horas_extra, d.total_comisiones, d.total_bonos,
      d.salario_bruto, d.isss_laboral, d.afp_laboral, d.renta_imponible, d.isr_retenido,
      d.total_descuentos, d.salario_neto,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomina_${result.planilla.codigo_planilla}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nextStep = () => setStep(Math.min(step + 1, 8));
  const prevStep = () => setStep(Math.max(step - 1, 1));

  const toggleEmpleado = (id: string) => {
    setSelectedEmpleados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllEmpleados = () => {
    setSelectedEmpleados(new Set(empleados.map(e => e.id)));
  };

  const deselectAllEmpleados = () => {
    setSelectedEmpleados(new Set());
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-base dark:text-slate-100">Seleccionar Período</CardTitle>
              <CardDescription className="dark:text-slate-400">Defina el rango de fechas y tipo de nómina</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="dark:text-slate-300">Tipo de Nómina</Label>
                <div className="flex gap-2">
                  {['MENSUAL', 'QUINCENAL'].map(t => (
                    <Button
                      key={t}
                      variant={tipo === t ? 'default' : 'outline'}
                      className={tipo === t ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600' : 'dark:border-slate-600 dark:text-slate-300'}
                      onClick={() => setTipo(t)}
                    >
                      {t === 'MENSUAL' ? 'Mensual' : 'Quincenal'}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Fecha Inicio</Label>
                  <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Fecha Fin</Label>
                  <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
                </div>
              </div>
              {fechaInicio && fechaFin && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-sm text-emerald-800 dark:text-emerald-300">
                  <strong>Período:</strong> {new Date(fechaInicio).toLocaleDateString('es-SV')} — {new Date(fechaFin).toLocaleDateString('es-SV')} ({tipo})
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base dark:text-slate-100">Verificar Empleados</CardTitle>
                  <CardDescription className="dark:text-slate-400">Confirmar que los empleados activos tienen contrato vigente</CardDescription>
                </div>
                {empleados.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllEmpleados} className="text-xs dark:border-slate-600 dark:text-slate-300">
                      Seleccionar Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllEmpleados} className="text-xs dark:border-slate-600 dark:text-slate-300">
                      Deseleccionar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-sm text-amber-800 dark:text-amber-300 mb-4">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Los empleados sin contrato activo serán excluidos del cálculo.
                {empleados.length > 0 && (
                  <span className="ml-2 font-medium">
                    {selectedEmpleados.size} de {empleados.length} seleccionados
                  </span>
                )}
              </div>
              
              {empleados.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                  {empleados.map((emp, idx) => {
                    const isSelected = selectedEmpleados.has(emp.id);
                    const colorClass = avatarColors[idx % avatarColors.length];
                    return (
                      <div
                        key={emp.id}
                        onClick={() => toggleEmpleado(emp.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30'
                            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 opacity-60'
                        }`}
                      >
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colorClass}`}>
                          {getInitials(emp.nombre)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{emp.nombre}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{emp.codigo}</span>
                            {emp.tieneContrato && (
                              <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                                <CheckCircle className="h-2.5 w-2.5" /> Contrato
                              </span>
                            )}
                          </div>
                          {emp.salarioBase !== undefined && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{fmt(emp.salarioBase)}</p>
                          )}
                        </div>
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500 dark:border-emerald-400 dark:bg-emerald-400'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {isSelected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Los datos de empleados se cargarán durante el cálculo. Continúe al siguiente paso.
                </p>
              )}
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-base dark:text-slate-100">Cargar Incidencias</CardTitle>
              <CardDescription className="dark:text-slate-400">Incidencias aprobadas del período serán aplicadas automáticamente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-sm text-emerald-800 dark:text-emerald-300 mb-4">
                <CheckCircle className="h-4 w-4 inline mr-1" />
                Solo se aplicarán incidencias en estado &quot;APROBADA&quot; dentro del rango de fechas.
              </div>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <p><strong className="dark:text-slate-300">Tipos de incidencia soportados:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>HORAS_EXTRA: Diurna (×2.0), Nocturna (×2.5), Descanso (×3.0), Asueto (×3.0)</li>
                  <li>COMISION: Monto directo</li>
                  <li>BONO: Monto directo</li>
                  <li>DESCUENTO_ESPECIAL: Cuota alimenticia, préstamo, seguro, otros</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-base dark:text-slate-100">Salarios Brutos</CardTitle>
              <CardDescription className="dark:text-slate-400">Salario base + incidencias remunerativas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm space-y-2 dark:text-slate-300">
                <p><strong>Fórmula:</strong></p>
                <p className="font-mono text-xs bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-2 rounded">Salario Bruto = Salario Base + Horas Extra + Comisiones + Bonos</p>
              </div>
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-base dark:text-slate-100">Deducciones Legales</CardTitle>
              <CardDescription className="dark:text-slate-400">ISSS, AFP e ISR según parámetros legales vigentes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm space-y-2 dark:text-slate-300">
                <p><strong>ISSS Laboral:</strong> MIN(Salario Bruto, $1,000) × 3.00% = máx $30.00/mes</p>
                <p><strong>AFP Laboral:</strong> Salario Bruto × 7.25% (sin tope)</p>
                <p><strong>Renta Imponible:</strong> Bruto − ISSS − AFP</p>
                <p><strong>ISR:</strong> Según tabla de tramos vigente</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                Art. 169 CT: Horas extra diurnas = 100% recargo. Los tramos ISR se leen de parámetros_legales.
              </div>
            </CardContent>
          </Card>
        );

      case 6:
        return (
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-base dark:text-slate-100">Descuentos Adicionales</CardTitle>
              <CardDescription className="dark:text-slate-400">Cuota alimenticia, préstamos, seguros y otros</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm space-y-2 dark:text-slate-300">
                <p><strong>Prioridad de descuentos:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Cuota alimenticia (mayor prioridad)</li>
                  <li>Préstamo patronal</li>
                  <li>Seguro complementario</li>
                  <li>Otros descuentos</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        );

      case 7:
        return (
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-base dark:text-slate-100">Salarios Netos</CardTitle>
              <CardDescription className="dark:text-slate-400">Resultado final después de todas las deducciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm space-y-2 dark:text-slate-300">
                <p><strong>Fórmula:</strong></p>
                <p className="font-mono text-xs bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-2 rounded">Neto = Bruto − ISSS − AFP − ISR − Descuentos Especiales</p>
                <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg text-xs text-red-700 dark:text-red-300 mt-2">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                  Si el salario neto resulta ≤ $0.00, se generará una anomalía de severidad ALTA.
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 8:
        return (
          <div className="space-y-4">
            {result ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 overflow-hidden relative">
                    <div className="absolute top-2 right-2 opacity-10">
                      <DollarSign className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <CardContent className="p-4">
                      <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Total Bruto</p>
                      <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{fmt(result.planilla.total_salarios_brutos)}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-0 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20 overflow-hidden relative">
                    <div className="absolute top-2 right-2 opacity-10">
                      <Minus className="h-12 w-12 text-red-600 dark:text-red-400" />
                    </div>
                    <CardContent className="p-4">
                      <p className="text-[11px] font-medium text-red-700 dark:text-red-300">Total Deducciones</p>
                      <p className="text-xl font-bold text-red-900 dark:text-red-100">-{fmt(result.planilla.total_descuentos)}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-0 bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-950/40 dark:to-teal-900/20 overflow-hidden relative">
                    <div className="absolute top-2 right-2 opacity-10">
                      <CheckCircle className="h-12 w-12 text-teal-600 dark:text-teal-400" />
                    </div>
                    <CardContent className="p-4">
                      <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300">Total Neto</p>
                      <p className="text-xl font-bold text-teal-900 dark:text-teal-100">{fmt(result.planilla.total_neto_a_pagar)}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-0 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/60 dark:to-slate-700/30 overflow-hidden relative">
                    <div className="absolute top-2 right-2 opacity-10">
                      <Shield className="h-12 w-12 text-slate-500 dark:text-slate-400" />
                    </div>
                    <CardContent className="p-4">
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Cargas Patronales</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{fmt(result.planilla.total_cargas_patronales)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Visual Breakdown - Horizontal Stacked Bar */}
                <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base dark:text-slate-100">Desglose Visual de Deducciones</CardTitle>
                    <CardDescription className="dark:text-slate-400">Distribución del salario bruto en conceptos</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(() => {
                      const bruto = result.planilla.total_salarios_brutos || 1;
                      const neto = result.planilla.total_neto_a_pagar;
                      const isss = result.planilla.total_isss_laboral;
                      const afp = result.planilla.total_afp_laboral;
                      const isr = result.planilla.total_isr_retenido;
                      const otros = result.planilla.total_descuentos - isss - afp - isr;
                      
                      const segments = [
                        { label: 'Neto', value: neto, color: 'bg-emerald-500 dark:bg-emerald-400', textColor: 'text-emerald-700 dark:text-emerald-300' },
                        { label: 'ISSS', value: isss, color: 'bg-amber-400 dark:bg-amber-500', textColor: 'text-amber-700 dark:text-amber-300' },
                        { label: 'AFP', value: afp, color: 'bg-orange-400 dark:bg-orange-500', textColor: 'text-orange-700 dark:text-orange-300' },
                        { label: 'ISR', value: isr, color: 'bg-red-400 dark:bg-red-500', textColor: 'text-red-700 dark:text-red-300' },
                        { label: 'Otros Desc.', value: Math.max(0, otros), color: 'bg-slate-400 dark:bg-slate-500', textColor: 'text-slate-600 dark:text-slate-300' },
                      ];

                      return (
                        <>
                          {/* Stacked bar */}
                          <div className="flex rounded-lg overflow-hidden h-8">
                            {segments.map(s => (
                              <div
                                key={s.label}
                                className={`${s.color} transition-all duration-500 flex items-center justify-center`}
                                style={{ width: `${Math.max((s.value / bruto) * 100, 0.5)}%` }}
                                title={`${s.label}: ${fmt(s.value)}`}
                              >
                                {(s.value / bruto) * 100 > 8 && (
                                  <span className="text-[10px] font-bold text-white drop-shadow-sm">{Math.round((s.value / bruto) * 100)}%</span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Legend */}
                          <div className="flex flex-wrap gap-3">
                            {segments.map(s => (
                              <div key={s.label} className="flex items-center gap-1.5">
                                <div className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
                                <span className={`text-xs font-medium ${s.textColor}`}>
                                  {s.label}: {fmt(s.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Anomalies */}
                {result.anomalies.length > 0 && (
                  <Card className="shadow-sm border-amber-200 dark:border-amber-800 dark:bg-slate-900">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4" /> Anomalías Detectadas ({result.anomalies.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {result.anomalies.map((a, i) => (
                          <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${a.severidad === 'ALTA' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">{a.tipo.replace(/_/g, ' ')}</p>
                              <p>{a.empleado_nombre}: {a.detalle}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Employee details table */}
                <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base dark:text-slate-100">Detalle por Empleado</CardTitle>
                      <Button variant="outline" size="sm" onClick={exportCSV} className="dark:border-slate-600 dark:text-slate-300">
                        <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-b bg-slate-50/80 dark:bg-slate-800/80">
                            <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3 w-8"></th>
                            <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Empleado</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Salario Base</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Bruto</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">ISSS</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">AFP</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">ISR</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Neto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.detalles.map((d) => (
                            <React.Fragment key={d.empleado_id}>
                              <tr
                                className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                onClick={() => setExpandedRow(expandedRow === d.empleado_id ? null : d.empleado_id)}
                              >
                                <td className="p-3 dark:text-slate-400">
                                  {expandedRow === d.empleado_id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </td>
                                <td className="p-3 font-mono text-xs dark:text-slate-300">{d.empleado_id.substring(0, 8)}...</td>
                                <td className="p-3 text-right dark:text-slate-300">{fmt(d.salario_base)}</td>
                                <td className="p-3 text-right font-medium dark:text-slate-200">{fmt(d.salario_bruto)}</td>
                                <td className="p-3 text-right text-red-600 dark:text-red-400">-{fmt(d.isss_laboral)}</td>
                                <td className="p-3 text-right text-red-600 dark:text-red-400">-{fmt(d.afp_laboral)}</td>
                                <td className="p-3 text-right text-red-600 dark:text-red-400">-{fmt(d.isr_retenido)}</td>
                                <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400">{fmt(d.salario_neto)}</td>
                              </tr>
                              {expandedRow === d.empleado_id && (
                                <tr>
                                  <td colSpan={8} className="bg-slate-50/50 dark:bg-slate-800/50 p-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                      <div><span className="text-slate-500 dark:text-slate-400">Horas Extra:</span> <span className="font-medium dark:text-slate-200">{fmt(d.total_horas_extra)}</span></div>
                                      <div><span className="text-slate-500 dark:text-slate-400">Comisiones:</span> <span className="font-medium dark:text-slate-200">{fmt(d.total_comisiones)}</span></div>
                                      <div><span className="text-slate-500 dark:text-slate-400">Bonos:</span> <span className="font-medium dark:text-slate-200">{fmt(d.total_bonos)}</span></div>
                                      <div><span className="text-slate-500 dark:text-slate-400">Renta Imponible:</span> <span className="font-medium dark:text-slate-200">{fmt(d.renta_imponible)}</span></div>
                                      <div><span className="text-slate-500 dark:text-slate-400">Cuota Alimenticia:</span> <span className="font-medium dark:text-slate-200">{fmt(d.cuota_alimenticia)}</span></div>
                                      <div><span className="text-slate-500 dark:text-slate-400">Préstamo:</span> <span className="font-medium dark:text-slate-200">{fmt(d.prestamo_patronal)}</span></div>
                                      <div><span className="text-slate-500 dark:text-slate-400">Seguro:</span> <span className="font-medium dark:text-slate-200">{fmt(d.seguro_complementario)}</span></div>
                                      <div><span className="text-slate-500 dark:text-slate-400">Otros Desc:</span> <span className="font-medium dark:text-slate-200">{fmt(d.otros_descuentos)}</span></div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
                <CardContent className="p-8 text-center">
                  <Calculator className="h-10 w-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">Ejecute el cálculo para ver resultados</p>
                  <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Complete los pasos anteriores y presione &quot;Ejecutar Cálculo&quot;</p>
                </CardContent>
              </Card>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Step Indicator */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-start min-w-max">
          {STEPS.map((s, i) => {
            const isCompleted = step > s.num;
            const isActive = step === s.num;
            const isPending = step < s.num;
            const Icon = s.icon;

            return (
              <React.Fragment key={s.num}>
                <button
                  onClick={() => setStep(s.num)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={`flex items-center justify-center h-9 w-9 rounded-full transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-500 dark:bg-emerald-600 shadow-md shadow-emerald-200 dark:shadow-emerald-900/50'
                      : isActive
                      ? 'bg-amber-500 dark:bg-amber-600 shadow-lg shadow-amber-200 dark:shadow-amber-900/50'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-4.5 w-4.5 text-white" />
                    ) : isActive ? (
                      <>
                        <span className="absolute h-9 w-9 rounded-full bg-amber-400 animate-ping opacity-30" />
                        <span className="relative text-white text-sm font-bold">{s.num}</span>
                      </>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">{s.num}</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium transition-colors max-w-[72px] text-center leading-tight ${
                    isCompleted
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : isActive
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 min-w-[24px] h-0.5 mt-[18px] mx-1 rounded transition-colors ${
                    isCompleted
                      ? 'bg-emerald-400 dark:bg-emerald-600'
                      : isActive
                      ? 'bg-gradient-to-r from-emerald-400 to-amber-400 dark:from-emerald-600 dark:to-amber-600'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {renderStepContent()}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={prevStep} disabled={step === 1} className="dark:border-slate-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < 8 ? (
          <Button onClick={nextStep} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
            Siguiente <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div className="flex gap-2">
            {!result && (
              <Button onClick={handleCalculate} disabled={calculating} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
                {calculating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</> : <><Calculator className="h-4 w-4 mr-1" /> Ejecutar Cálculo</>}
              </Button>
            )}
            {result && (
              <Button variant="outline" onClick={() => { setResult(null); setStep(1); }} className="dark:border-slate-600 dark:text-slate-300">
                <RefreshCw className="h-4 w-4 mr-1" /> Nuevo Cálculo
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
