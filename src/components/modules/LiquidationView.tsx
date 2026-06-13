'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ClipboardList, Plus, Loader2, Scale,
  Download, X, Calculator, FileText,
  Search, DollarSign, CalendarDays,
  Briefcase, Clock, CheckCircle2,
  AlertCircle, User, Hash,
  Receipt, Banknote, Umbrella, Award, CreditCard,
  Users, Gift
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface LiquidationViewProps {
  accessToken: string;
  userRole: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface LiquidacionItem {
  id: string;
  empleado_id: string;
  empleado_codigo: string;
  empleado_nombre: string;
  tipo: string;
  fecha_liquidacion: string;
  salario_base_liquidacion: number;
  anios_servicio: number;
  indemnizacion: number;
  prestacion_economica: number;
  vacacion_proporcional: number;
  aguinaldo_proporcional: number;
  salario_pendiente: number;
  total_liquidacion: number;
  estado: string;
  aprobada_por: string | null;
  observaciones: string | null;
}

interface LiquidacionResult {
  liquidacion: {
    id: string;
    tipo: string;
    fecha_liquidacion: string;
    salario_base: number;
    anios_servicio: number;
    indemnizacion: number;
    prestacion_economica: number;
    vacacion_proporcional: number;
    aguinaldo_proporcional: number;
    salario_pendiente: number;
    total_liquidacion: number;
    estado: string;
  };
  desglose: {
    indemnizacion: { monto: number; base_legal: string; formula: string };
    prestacion_economica: { monto: number; base_legal: string; formula: string };
    vacacion_proporcional: { monto: number; base_legal: string; formula: string };
    aguinaldo_proporcional: { monto: number; base_legal: string; formula: string };
    salario_pendiente: { monto: number; base_legal: string; formula: string };
  };
}

interface EmployeeOption {
  id: string;
  codigo_empleado: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  fecha_ingreso: string;
  estado: string;
  area: { id: string; nombre: string; codigo: string } | null;
  perfil_puesto: { id: string; nombre_puesto: string; codigo: string } | null;
  contratos: Array<{ salario_base_contrato: number; fecha_inicio: string; cargo: string }>;
}

const tipoLabels: Record<string, string> = {
  DESPEDO_INJUSTIFICADO: 'Despido Injustificado',
  RENUNCIA_VOLUNTARIA: 'Renuncia Voluntaria',
  DESPEDO_JUSTIFICADO: 'Despido Justificado',
  FIN_CONTRATO: 'Fin de Contrato',
};

const tipoDescriptions: Record<string, string> = {
  DESPEDO_INJUSTIFICADO: 'Indemnización Art. 58 CT — 30 días/año, máx. 4 años',
  RENUNCIA_VOLUNTARIA: 'Prestación económica Ley 523 — 15 días/año',
  DESPEDO_JUSTIFICADO: 'Solo vacación y aguinaldo proporcionales',
  FIN_CONTRATO: 'Solo vacación y aguinaldo proporcionales',
};

const estadoColors: Record<string, string> = {
  CALCULADA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  APROBADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PAGADA: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

// Animated number counter hook
function useAnimatedNumber(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
      else {
        setValue(target);
        prevTarget.current = target;
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

// Step card for the calculator
function CalculatorStep({
  stepNumber,
  icon: Icon,
  label,
  legalRef,
  formula,
  amount,
  totalSoFar,
  color = 'emerald',
}: {
  stepNumber: number;
  icon: React.ElementType;
  label: string;
  legalRef: string;
  formula: string;
  amount: number;
  totalSoFar: number;
  color?: string;
}) {
  const colorClasses: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-300' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', icon: 'text-teal-600 dark:text-teal-400', text: 'text-teal-700 dark:text-teal-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', text: 'text-amber-700 dark:text-amber-300' },
    sky: { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', icon: 'text-sky-600 dark:text-sky-400', text: 'text-sky-700 dark:text-sky-300' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', icon: 'text-violet-600 dark:text-violet-400', text: 'text-violet-700 dark:text-violet-300' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', icon: 'text-rose-600 dark:text-rose-400', text: 'text-rose-700 dark:text-rose-300' },
  };
  const c = colorClasses[color] || colorClasses.emerald;

  return (
    <div className={`relative p-4 rounded-xl border ${c.border} ${c.bg} transition-all duration-300`}>
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${c.bg} border ${c.border}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold ${c.text} bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded`}>
              PASO {stepNumber}
            </span>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</h4>
          </div>
          {legalRef !== 'N/A' && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Scale className="h-3 w-3" /> {legalRef}
            </p>
          )}
          {formula !== 'No aplica' && (
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mb-2">{formula}</p>
          )}
          <div className="flex items-center justify-between">
            <p className={`text-lg font-bold ${c.text}`}>{fmt(amount)}</p>
            {amount > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Subtotal</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{fmt(totalSoFar)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiquidationView({ accessToken }: LiquidationViewProps) {
  const { toast } = useToast();
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('DESPEDO_INJUSTIFICADO');
  const [selectedFecha, setSelectedFecha] = useState('');
  const [detailResult, setDetailResult] = useState<LiquidacionResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  // Employee search
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchLiquidaciones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nomina/liquidaciones', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setLiquidaciones(data.liquidaciones || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar liquidaciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { fetchLiquidaciones(); }, [fetchLiquidaciones]);

  // Fetch employees for searchable dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch('/api/empleados?pageSize=200&estado=ACTIVO', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.data || []);
        }
      } catch { /* ignore */ }
    };
    fetchEmployees();
  }, [accessToken]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowEmpDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!empSearch) return employees.slice(0, 20);
    const s = empSearch.toLowerCase();
    return employees.filter(e =>
      `${e.primer_nombre} ${e.segundo_nombre} ${e.primer_apellido} ${e.segundo_apellido}`.toLowerCase().includes(s) ||
      e.codigo_empleado.toLowerCase().includes(s)
    ).slice(0, 20);
  }, [employees, empSearch]);

  const handleSelectEmployee = (emp: EmployeeOption) => {
    setSelectedEmpId(emp.id);
    setSelectedEmployee(emp);
    setEmpSearch(`${emp.primer_nombre} ${emp.primer_apellido}`);
    setShowEmpDropdown(false);
  };

  const animatedTotal = useAnimatedNumber(detailResult?.liquidacion.total_liquidacion || 0);

  const handleCreate = async () => {
    if (!selectedEmpId || !selectedTipo || !selectedFecha) {
      toast({ title: 'Error', description: 'Complete todos los campos', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/nomina/liquidaciones', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: selectedEmpId,
          tipo: selectedTipo,
          fecha_liquidacion: selectedFecha,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular liquidación');
      setDetailResult(data);
      setShowDetail(true);
      setShowNew(false);
      fetchLiquidaciones();
      toast({ title: 'Liquidación Calculada', description: `Total: ${fmt(data.liquidacion.total_liquidacion)}` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al calcular liquidación', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleGeneratePdf = async (empleadoId: string, codigoEmpleado: string) => {
    setGeneratingPdf(empleadoId);
    try {
      const res = await fetch(`/api/nomina/liquidaciones/pdf?empleado_id=${empleadoId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al generar PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liquidacion-${codigoEmpleado}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF Generado', description: `Constancia de liquidación para ${codigoEmpleado}` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al generar PDF', variant: 'destructive' });
    } finally {
      setGeneratingPdf(null);
    }
  };

  // Computed stats for history
  const historyStats = useMemo(() => {
    const total = liquidaciones.reduce((s, l) => s + l.total_liquidacion, 0);
    const pagadas = liquidaciones.filter(l => l.estado === 'PAGADA').length;
    const pendientes = liquidaciones.filter(l => l.estado === 'CALCULADA').length;
    return { total, pagadas, pendientes, count: liquidaciones.length };
  }, [liquidaciones]);

  // Build calculator steps from detail result
  const calculatorSteps = useMemo(() => {
    if (!detailResult) return [];
    const { desglose, liquidacion } = detailResult;
    let running = 0;
    const steps: Array<{
      step: number;
      icon: React.ElementType;
      label: string;
      legalRef: string;
      formula: string;
      amount: number;
      totalSoFar: number;
      color: string;
    }> = [];

    // Step 1: Salario Base (info)
    steps.push({
      step: 1,
      icon: DollarSign,
      label: 'Salario Base (Diario)',
      legalRef: 'Base de cálculo',
      formula: `Salario mensual ${fmt(liquidacion.salario_base)} ÷ 30 = ${fmt(liquidacion.salario_base / 30)}/día`,
      amount: liquidacion.salario_base / 30,
      totalSoFar: 0,
      color: 'emerald',
    });

    // Step 2: Indemnización or Prestación Económica
    if (desglose.indemnizacion.monto > 0) {
      running += desglose.indemnizacion.monto;
      steps.push({
        step: 2,
        icon: Award,
        label: 'Indemnización',
        legalRef: desglose.indemnizacion.base_legal,
        formula: desglose.indemnizacion.formula,
        amount: desglose.indemnizacion.monto,
        totalSoFar: running,
        color: 'rose',
      });
    } else if (desglose.prestacion_economica.monto > 0) {
      running += desglose.prestacion_economica.monto;
      steps.push({
        step: 2,
        icon: CreditCard,
        label: 'Prestación Económica',
        legalRef: desglose.prestacion_economica.base_legal,
        formula: desglose.prestacion_economica.formula,
        amount: desglose.prestacion_economica.monto,
        totalSoFar: running,
        color: 'violet',
      });
    }

    // Step 3: Aguinaldo Proporcional
    if (desglose.aguinaldo_proporcional.monto > 0) {
      running += desglose.aguinaldo_proporcional.monto;
      steps.push({
        step: steps.length + 1,
        icon: Gift,
        label: 'Aguinaldo Proporcional',
        legalRef: desglose.aguinaldo_proporcional.base_legal,
        formula: desglose.aguinaldo_proporcional.formula,
        amount: desglose.aguinaldo_proporcional.monto,
        totalSoFar: running,
        color: 'amber',
      });
    }

    // Step 4: Vacación Proporcional
    if (desglose.vacacion_proporcional.monto > 0) {
      running += desglose.vacacion_proporcional.monto;
      steps.push({
        step: steps.length + 1,
        icon: Umbrella,
        label: 'Vacación No Gozada',
        legalRef: desglose.vacacion_proporcional.base_legal,
        formula: desglose.vacacion_proporcional.formula,
        amount: desglose.vacacion_proporcional.monto,
        totalSoFar: running,
        color: 'teal',
      });
    }

    // Step 5: Salario Pendiente
    if (desglose.salario_pendiente.monto > 0) {
      running += desglose.salario_pendiente.monto;
      steps.push({
        step: steps.length + 1,
        icon: Banknote,
        label: 'Salario Pendiente',
        legalRef: desglose.salario_pendiente.base_legal,
        formula: desglose.salario_pendiente.formula,
        amount: desglose.salario_pendiente.monto,
        totalSoFar: running,
        color: 'sky',
      });
    }

    return steps;
  }, [detailResult]);

  const getInitials = (emp: EmployeeOption) =>
    `${emp.primer_nombre?.[0] || ''}${emp.primer_apellido?.[0] || ''}`.toUpperCase();

  return (
    <div className="space-y-6">
      {/* ── Enhanced Header with Legal Reference ──────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Liquidaciones
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Cálculo de liquidación laboral según legislación salvadoreña
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-4 w-4 mr-1" /> Nueva Liquidación
        </Button>
      </div>

      {/* Legal Banner */}
      <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
              <Scale className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Art. 58 Código de Trabajo — Liquidación
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Todo empleado tiene derecho a recibir una liquidación al finalizar la relación laboral.
                En caso de <strong>despido injustificado</strong>, corresponde indemnización de 30 días por año de servicio
                (máximo 4 años de salario). En <strong>renuncia voluntaria</strong>, prestación económica de 15 días por año.
                Ambos incluyen vacación proporcional (Art. 177 CT) y aguinaldo proporcional (Arts. 196-202 CT).
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
                  Art. 58 CT — Despido Injustificado
                </Badge>
                <Badge variant="outline" className="text-[10px] border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300">
                  Ley 523 — Renuncia Voluntaria
                </Badge>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                  Art. 177 CT — Vacación
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Liquidation Detail with Step-by-Step Calculator ──────────────── */}
      {showDetail && detailResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Step-by-step calculator */}
          <div className="lg:col-span-2 space-y-3">
            <Card className="shadow-sm border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-emerald-600" />
                      Calculadora de Liquidación — Paso a Paso
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {tipoLabels[detailResult.liquidacion.tipo]} • {detailResult.liquidacion.anios_servicio.toFixed(1)} años de servicio
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {calculatorSteps.map((s) => (
                  <CalculatorStep
                    key={s.step}
                    stepNumber={s.step}
                    icon={s.icon}
                    label={s.label}
                    legalRef={s.legalRef}
                    formula={s.formula}
                    amount={s.amount}
                    totalSoFar={s.totalSoFar}
                    color={s.color}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right: Running total & Summary card */}
          <div className="space-y-4">
            {/* Running total */}
            <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40">
              <CardContent className="p-5 text-center">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">Total de Liquidación</p>
                <p className="text-3xl font-bold text-emerald-800 dark:text-emerald-200">
                  {fmt(animatedTotal)}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Badge className={`text-[10px] ${estadoColors[detailResult.liquidacion.estado] || 'bg-slate-100'}`} variant="secondary">
                    {detailResult.liquidacion.estado}
                  </Badge>
                  <span className="text-[10px] text-slate-400">{tipoLabels[detailResult.liquidacion.tipo]}</span>
                </div>
              </CardContent>
            </Card>

            {/* Recibo de Liquidación card */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  Recibo de Liquidación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Empresa</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Sistema de Nómina SV</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Empleado</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {selectedEmployee ? `${selectedEmployee.primer_nombre} ${selectedEmployee.primer_apellido}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Código</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedEmployee?.codigo_empleado || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Fecha</span>
                    <span className="text-slate-700 dark:text-slate-300">{detailResult.liquidacion.fecha_liquidacion}</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  {Object.entries(detailResult.desglose).map(([key, val]) => {
                    if (val.monto === 0) return null;
                    const labels: Record<string, string> = {
                      indemnizacion: 'Indemnización',
                      prestacion_economica: 'Prestación Económica',
                      vacacion_proporcional: 'Vacación Proporcional',
                      aguinaldo_proporcional: 'Aguinaldo Proporcional',
                      salario_pendiente: 'Salario Pendiente',
                    };
                    return (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">{labels[key] || key}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{fmt(val.monto)}</span>
                      </div>
                    );
                  })}
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-900 dark:text-slate-100">TOTAL</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-lg">
                    {fmt(detailResult.liquidacion.total_liquidacion)}
                  </span>
                </div>
                <Button
                  onClick={() => selectedEmployee && handleGeneratePdf(selectedEmployee.id, selectedEmployee.codigo_empleado)}
                  disabled={!selectedEmployee || generatingPdf === selectedEmployee?.id}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
                >
                  {generatingPdf === selectedEmployee?.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Generar PDF
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── New liquidation dialog with searchable employee ──────────────── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-600" />
              Nueva Liquidación
            </DialogTitle>
            <DialogDescription>Calcule la liquidación para un empleado según la legislación de El Salvador</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Searchable Employee Selector */}
            <div className="space-y-2" ref={dropdownRef}>
              <Label className="text-sm font-medium">Empleado</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={empSearch}
                  onChange={e => {
                    setEmpSearch(e.target.value);
                    setShowEmpDropdown(true);
                    if (selectedEmployee) {
                      setSelectedEmployee(null);
                      setSelectedEmpId('');
                    }
                  }}
                  onFocus={() => setShowEmpDropdown(true)}
                  placeholder="Buscar por nombre o código..."
                  className="pl-9"
                />
                {showEmpDropdown && (
                  <div className="absolute z-50 top-full mt-1 w-full max-h-64 overflow-y-auto rounded-lg border bg-white dark:bg-slate-900 shadow-lg">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-400">
                        <Users className="h-6 w-6 mx-auto mb-1 opacity-40" />
                        No se encontraron empleados
                      </div>
                    ) : (
                      filteredEmployees.map(emp => (
                        <button
                          key={emp.id}
                          onClick={() => handleSelectEmployee(emp)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors text-left"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs font-semibold">
                              {getInitials(emp)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {emp.primer_nombre} {emp.segundo_nombre} {emp.primer_apellido} {emp.segundo_apellido}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {emp.codigo_empleado} • {emp.perfil_puesto?.nombre_puesto || 'Sin puesto'}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {/* Selected employee info */}
              {selectedEmployee && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200 text-sm font-bold">
                        {getInitials(selectedEmployee)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Salario
                        </p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedEmployee.contratos?.[0]
                            ? fmt(selectedEmployee.contratos[0].salario_base_contrato)
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> Ingreso
                        </p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedEmployee.fecha_ingreso
                            ? new Date(selectedEmployee.fecha_ingreso).toLocaleDateString('es-SV')
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Briefcase className="h-3 w-3" /> Puesto
                        </p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {selectedEmployee.perfil_puesto?.nombre_puesto || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tipo de Liquidación */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de Liquidación</Label>
              <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DESPEDO_INJUSTIFICADO">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                      Despido Injustificado (Art. 58 CT)
                    </span>
                  </SelectItem>
                  <SelectItem value="RENUNCIA_VOLUNTARIA">
                    <span className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-violet-500" />
                      Renuncia Voluntaria (Ley 523)
                    </span>
                  </SelectItem>
                  <SelectItem value="DESPEDO_JUSTIFICADO">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
                      Despido Justificado
                    </span>
                  </SelectItem>
                  <SelectItem value="FIN_CONTRATO">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-sky-500" />
                      Fin de Contrato
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {tipoDescriptions[selectedTipo] && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded">
                  {tipoDescriptions[selectedTipo]}
                </p>
              )}
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fecha de Liquidación</Label>
              <Input type="date" value={selectedFecha} onChange={e => setSelectedFecha(e.target.value)} />
            </div>

            <Button onClick={handleCreate} disabled={creating || !selectedEmpId} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
              Calcular Liquidación
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Liquidation History ─────────────────────────────────────────── */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-emerald-600" />
                Historial de Liquidaciones
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Registro de todas las liquidaciones calculadas
              </CardDescription>
            </div>
            {historyStats.count > 0 && (
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1 text-slate-500">
                  <Hash className="h-3 w-3" /> {historyStats.count} total
                </span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> {historyStats.pagadas} pagadas
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Clock className="h-3 w-3" /> {historyStats.pendientes} pendientes
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ))}</div>
          ) : liquidaciones.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No hay liquidaciones registradas</p>
              <p className="text-xs mt-1">Cree una nueva liquidación para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-t border-b bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Empleado</th>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Tipo</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Indemnización</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Vacación</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Aguinaldo</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Total</th>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Estado</th>
                    <th className="text-center font-medium text-slate-500 dark:text-slate-400 p-3">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidaciones.map(l => (
                    <tr key={l.id} className="border-b hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px] font-bold">
                              {l.empleado_nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{l.empleado_nombre}</p>
                            <p className="text-[11px] text-slate-400">{l.empleado_codigo} · {l.anios_servicio.toFixed(1)} años</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-xs">{tipoLabels[l.tipo] || l.tipo}</td>
                      <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                        {l.indemnizacion > 0 || l.prestacion_economica > 0 ? fmt(l.indemnizacion || l.prestacion_economica) : '-'}
                      </td>
                      <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                        {l.vacacion_proporcional > 0 ? fmt(l.vacacion_proporcional) : '-'}
                      </td>
                      <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                        {l.aguinaldo_proporcional > 0 ? fmt(l.aguinaldo_proporcional) : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400">{fmt(l.total_liquidacion)}</td>
                      <td className="p-3">
                        <Badge className={`text-[10px] ${estadoColors[l.estado] || 'bg-slate-100'}`} variant="secondary">
                          {l.estado}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          onClick={() => handleGeneratePdf(l.empleado_id, l.empleado_codigo)}
                          disabled={generatingPdf === l.empleado_id}
                          title="Generar Constancia de Liquidación PDF"
                        >
                          {generatingPdf === l.empleado_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {historyStats.count > 0 && (
                  <tfoot>
                    <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 border-t-2 border-emerald-200 dark:border-emerald-800">
                      <td colSpan={5} className="p-3 text-sm font-bold text-slate-700 dark:text-slate-300 text-right">
                        Total General
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        {fmt(historyStats.total)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
