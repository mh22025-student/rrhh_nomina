'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ClipboardList, Plus, Loader2, Scale,
  Download, X, Calculator, FileText,
  Search, DollarSign, CalendarDays,
  Briefcase, Clock, CheckCircle2,
  AlertCircle, User, Hash,
  Receipt, Banknote, Umbrella, Award, CreditCard,
  Users, Gift, ChevronRight, ChevronLeft,
  ArrowRight, Eye, BookOpen, AlertTriangle, Star
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
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const tipoColors: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  DESPEDO_INJUSTIFICADO: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-700',
    gradient: 'from-rose-500 to-rose-700 dark:from-rose-900 dark:to-rose-800',
  },
  RENUNCIA_VOLUNTARIA: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    gradient: 'from-amber-500 to-amber-700 dark:from-amber-900 dark:to-amber-800',
  },
  DESPEDO_JUSTIFICADO: {
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-300 dark:border-teal-700',
    gradient: 'from-teal-500 to-teal-700 dark:from-teal-900 dark:to-teal-800',
  },
  FIN_CONTRATO: {
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-300 dark:border-sky-700',
    gradient: 'from-sky-500 to-sky-700 dark:from-sky-900 dark:to-sky-800',
  },
};

const estadoColors: Record<string, string> = {
  CALCULADA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  APROBADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PAGADA: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

// Breakdown items with legal references
const breakdownDefinitions = [
  { key: 'indemnizacion', label: 'Indemnización', icon: Award, color: 'rose', legalRef: 'Art. 58 CT — Despido Injustificado', desc: '30 días de salario por cada año de servicio, máximo 4 años de salario' },
  { key: 'prestacion_economica', label: 'Prestación Económica', icon: CreditCard, color: 'violet', legalRef: 'Ley 523 — Renuncia Voluntaria', desc: '15 días de salario por cada año de servicio' },
  { key: 'vacacion_proporcional', label: 'Vacación Proporcional', icon: Umbrella, color: 'teal', legalRef: 'Art. 177 CT', desc: '1.25 días de vacaciones por cada mes trabajado en el período no gozado' },
  { key: 'aguinaldo_proporcional', label: 'Aguinaldo Proporcional', icon: Gift, color: 'amber', legalRef: 'Arts. 196-202 CT', desc: 'Proporción de aguinaldo por días trabajados en el año' },
  { key: 'salario_pendiente', label: 'Salario Pendiente', icon: Banknote, color: 'sky', legalRef: 'Art. 44 CT', desc: 'Salarios devengados y no pagados al momento de la liquidación' },
];

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

// Wizard step indicator
function WizardSteps({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((step, idx) => (
        <React.Fragment key={step}>
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
              idx < currentStep
                ? 'bg-emerald-500 text-white'
                : idx === currentStep
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-200 dark:ring-emerald-800'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              {idx < currentStep ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
            </div>
            <span className={`text-[11px] font-medium hidden sm:inline ${
              idx <= currentStep ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'
            }`}>
              {step}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-0.5 rounded transition-all ${
              idx < currentStep ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// Breakdown item card with legal reference
function BreakdownCard({
  label,
  icon: Icon,
  amount,
  formula,
  legalRef,
  color,
}: {
  label: string;
  icon: React.ElementType;
  amount: number;
  formula: string;
  legalRef: string;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; border: string; iconBg: string; iconText: string; amount: string }> = {
    rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', iconBg: 'bg-rose-100 dark:bg-rose-900/50', iconText: 'text-rose-600 dark:text-rose-400', amount: 'text-rose-700 dark:text-rose-300' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', iconBg: 'bg-violet-100 dark:bg-violet-900/50', iconText: 'text-violet-600 dark:text-violet-400', amount: 'text-violet-700 dark:text-violet-300' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', iconBg: 'bg-teal-100 dark:bg-teal-900/50', iconText: 'text-teal-600 dark:text-teal-400', amount: 'text-teal-700 dark:text-teal-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', iconBg: 'bg-amber-100 dark:bg-amber-900/50', iconText: 'text-amber-600 dark:text-amber-400', amount: 'text-amber-700 dark:text-amber-300' },
    sky: { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', iconBg: 'bg-sky-100 dark:bg-sky-900/50', iconText: 'text-sky-600 dark:text-sky-400', amount: 'text-sky-700 dark:text-sky-300' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', iconBg: 'bg-emerald-100 dark:bg-emerald-900/50', iconText: 'text-emerald-600 dark:text-emerald-400', amount: 'text-emerald-700 dark:text-emerald-300' },
  };
  const c = colorMap[color] || colorMap.emerald;

  if (amount === 0) return null;

  return (
    <div className={`p-4 rounded-xl border ${c.border} ${c.bg} transition-all`}>
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${c.iconBg} shrink-0`}>
          <Icon className={`h-4 w-4 ${c.iconText}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</h4>
            <Badge variant="outline" className="text-[9px] border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400 h-4">
              <Scale className="h-2.5 w-2.5 mr-0.5" />{legalRef}
            </Badge>
          </div>
          {formula && formula !== 'No aplica' && (
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mb-1">{formula}</p>
          )}
          <p className={`text-lg font-bold ${c.amount}`}>{fmt(amount)}</p>
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
  const [activeTab, setActiveTab] = useState('detail');

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0);
  const wizardSteps = ['Empleado', 'Tipo', 'Revisión', 'Confirmar'];

  // Comparison state
  const [comparisonResult, setComparisonResult] = useState<LiquidacionResult | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

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
      setActiveTab('detail');
      fetchLiquidaciones();
      toast({ title: 'Liquidación Calculada', description: `Total: ${fmt(data.liquidacion.total_liquidacion)}` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al calcular liquidación', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // Fetch comparison for the other type
  const fetchComparison = useCallback(async () => {
    if (!selectedEmpId || !selectedFecha || !detailResult) return;
    const otherTipo = detailResult.liquidacion.tipo === 'DESPEDO_INJUSTIFICADO' ? 'RENUNCIA_VOLUNTARIA' : 'DESPEDO_INJUSTIFICADO';
    setLoadingComparison(true);
    try {
      const res = await fetch('/api/nomina/liquidaciones', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: selectedEmpId,
          tipo: otherTipo,
          fecha_liquidacion: selectedFecha,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setComparisonResult(data);
      }
    } catch { /* ignore */ }
    finally {
      setLoadingComparison(false);
    }
  }, [selectedEmpId, selectedFecha, detailResult, accessToken]);

  useEffect(() => {
    if (detailResult && activeTab === 'comparison') {
      fetchComparison();
    }
  }, [detailResult, activeTab, fetchComparison]);

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
    const despidos = liquidaciones.filter(l => l.tipo === 'DESPEDO_INJUSTIFICADO').length;
    const renuncias = liquidaciones.filter(l => l.tipo === 'RENUNCIA_VOLUNTARIA').length;
    return { total, pagadas, pendientes, count: liquidaciones.length, despidos, renuncias };
  }, [liquidaciones]);

  const getInitials = (emp: EmployeeOption) =>
    `${emp.primer_nombre?.[0] || ''}${emp.primer_apellido?.[0] || ''}`.toUpperCase();

  // Wizard navigation
  const canAdvanceStep = () => {
    if (wizardStep === 0) return !!selectedEmpId;
    if (wizardStep === 1) return !!selectedTipo;
    if (wizardStep === 2) return !!selectedFecha;
    return true;
  };

  const resetWizard = () => {
    setWizardStep(0);
    setSelectedEmpId('');
    setSelectedTipo('DESPEDO_INJUSTIFICADO');
    setSelectedFecha('');
    setSelectedEmployee(null);
    setEmpSearch('');
  };

  const openWizard = () => {
    resetWizard();
    setShowNew(true);
  };

  return (
    <div className="space-y-6">
      {/* ── Enhanced Header with Gradient ─────────────────────────────── */}
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
        <Button onClick={openWizard} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
                <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300">
                  Art. 58 CT — Despido Injustificado (30d/año)
                </Badge>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                  Ley 523 — Renuncia Voluntaria (15d/año)
                </Badge>
                <Badge variant="outline" className="text-[10px] border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300">
                  Art. 177 CT — Vacación Proporcional
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Summary Cards ─────────────────────────────────────────── */}
      {!loading && liquidaciones.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-900 dark:to-emerald-800 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-4 text-center relative z-10">
              <div className="flex items-center justify-center mb-2">
                <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-[10px] text-emerald-100 font-medium">Total Liquidaciones</p>
              <p className="text-xl font-bold text-white mt-0.5">{fmt(historyStats.total)}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-500 to-teal-700 dark:from-teal-900 dark:to-teal-800 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-4 text-center relative z-10">
              <div className="flex items-center justify-center mb-2">
                <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                  <Hash className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-[10px] text-teal-100 font-medium">Total Registros</p>
              <p className="text-xl font-bold text-white mt-0.5">{historyStats.count}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-500 to-rose-700 dark:from-rose-900 dark:to-rose-800 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-4 text-center relative z-10">
              <div className="flex items-center justify-center mb-2">
                <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-[10px] text-rose-100 font-medium">Despidos / Renuncias</p>
              <p className="text-xl font-bold text-white mt-0.5">{historyStats.despidos} / {historyStats.renuncias}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-500 to-amber-700 dark:from-amber-900 dark:to-amber-800 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="p-4 text-center relative z-10">
              <div className="flex items-center justify-center mb-2">
                <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                  {historyStats.pendientes > 0 ? <Clock className="h-5 w-5 text-white" /> : <CheckCircle2 className="h-5 w-5 text-white" />}
                </div>
              </div>
              <p className="text-[10px] text-amber-100 font-medium">Pendientes / Pagadas</p>
              <p className="text-xl font-bold text-white mt-0.5">{historyStats.pendientes} / {historyStats.pagadas}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Liquidation Detail with Tabs ──────────────────────────────── */}
      {showDetail && detailResult && (
        <div className="space-y-4">
          {/* Detail header with close button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedEmployee && (
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200 text-sm font-bold">
                    {getInitials(selectedEmployee)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedEmployee ? `${selectedEmployee.primer_nombre} ${selectedEmployee.primer_apellido}` : 'Empleado'}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={`text-[10px] ${tipoColors[detailResult.liquidacion.tipo]?.bg || ''} ${tipoColors[detailResult.liquidacion.tipo]?.text || ''}`}>
                    {tipoLabels[detailResult.liquidacion.tipo]}
                  </Badge>
                  <Badge className={`text-[10px] ${estadoColors[detailResult.liquidacion.estado] || 'bg-slate-100'}`} variant="secondary">
                    {detailResult.liquidacion.estado}
                  </Badge>
                  <span className="text-[10px] text-slate-400">{detailResult.liquidacion.anios_servicio.toFixed(1)} años</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right mr-2">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Total Liquidación</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(animatedTotal)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="detail" className="text-xs">
                <Calculator className="h-3.5 w-3.5 mr-1" /> Desglose
              </TabsTrigger>
              <TabsTrigger value="comparison" className="text-xs">
                <Eye className="h-3.5 w-3.5 mr-1" /> Comparación
              </TabsTrigger>
              <TabsTrigger value="legal" className="text-xs">
                <BookOpen className="h-3.5 w-3.5 mr-1" /> Legal
              </TabsTrigger>
            </TabsList>

            {/* ── Breakdown Tab ─────────────────────────────────────────── */}
            <TabsContent value="detail">
              <div className="space-y-4 mt-4">
                {/* Breakdown Cards */}
                <Card className="shadow-sm border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-emerald-600" />
                      Desglose de Liquidación
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {tipoLabels[detailResult.liquidacion.tipo]} · Cada componente con referencia legal
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Salary base info */}
                    <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
                          <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Salario Base</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Mensual: {fmt(detailResult.liquidacion.salario_base)} · Diario: {fmt(detailResult.liquidacion.salario_base / 30)}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {detailResult.liquidacion.anios_servicio.toFixed(1)} años de servicio
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmt(detailResult.liquidacion.salario_base)}</p>
                          <p className="text-[10px] text-slate-400">/mes</p>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic breakdown cards */}
                    {Object.entries(detailResult.desglose).map(([key, val]) => {
                      if (val.monto === 0) return null;
                      const def = breakdownDefinitions.find(d => d.key === key);
                      if (!def) return null;
                      return (
                        <BreakdownCard
                          key={key}
                          label={def.label}
                          icon={def.icon}
                          amount={val.monto}
                          formula={val.formula}
                          legalRef={def.legalRef}
                          color={def.color}
                        />
                      );
                    })}

                    {/* Total */}
                    <div className="p-4 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-200 dark:bg-emerald-800">
                            <DollarSign className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Total de Liquidación</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Suma de todos los componentes
                            </p>
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(detailResult.liquidacion.total_liquidacion)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Receipt card */}
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
                        <span className="font-mono text-slate-700 dark:text-slate-300">{selectedEmployee?.codigo_empleado || '—'}</span>
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
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-lg">{fmt(detailResult.liquidacion.total_liquidacion)}</span>
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
            </TabsContent>

            {/* ── Comparison Tab ─────────────────────────────────────────── */}
            <TabsContent value="comparison">
              <Card className="shadow-sm border-slate-200 dark:border-slate-700 mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-600" />
                    Comparación: Despido Injustificado vs Renuncia Voluntaria
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Vea la diferencia entre ambos tipos de liquidación para el mismo empleado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingComparison ? (
                    <div className="p-8 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-3" />
                      <p className="text-sm text-slate-500">Calculando comparación...</p>
                    </div>
                  ) : comparisonResult ? (
                    <div className="space-y-6">
                      {/* Side-by-side comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Despido Injustificado */}
                        <div className="rounded-xl border-2 border-rose-300 dark:border-rose-700 overflow-hidden">
                          <div className="bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-800 dark:to-rose-900 p-4">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-white" />
                              <h4 className="text-sm font-bold text-white">Despido Injustificado</h4>
                            </div>
                            <p className="text-[10px] text-rose-100 mt-1">Art. 58 CT — 30 días/año</p>
                          </div>
                          <div className="p-4 space-y-2">
                            {(() => {
                              const despResult = detailResult.liquidacion.tipo === 'DESPEDO_INJUSTIFICADO' ? detailResult : comparisonResult;
                              return Object.entries(despResult.desglose).map(([key, val]) => {
                                if (val.monto === 0) return null;
                                const labels: Record<string, string> = {
                                  indemnizacion: 'Indemnización',
                                  prestacion_economica: 'Prestación Económica',
                                  vacacion_proporcional: 'Vacación',
                                  aguinaldo_proporcional: 'Aguinaldo',
                                  salario_pendiente: 'Salario Pend.',
                                };
                                return (
                                  <div key={key} className="flex justify-between text-xs">
                                    <span className="text-slate-600 dark:text-slate-400">{labels[key] || key}</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{fmt(val.monto)}</span>
                                  </div>
                                );
                              });
                            })()}
                            <Separator />
                            <div className="flex justify-between text-sm">
                              <span className="font-bold text-slate-900 dark:text-slate-100">TOTAL</span>
                              <span className="font-bold text-rose-700 dark:text-rose-300 text-lg">
                                {fmt((detailResult.liquidacion.tipo === 'DESPEDO_INJUSTIFICADO' ? detailResult : comparisonResult).liquidacion.total_liquidacion)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Renuncia Voluntaria */}
                        <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 overflow-hidden">
                          <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-800 dark:to-amber-900 p-4">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-white" />
                              <h4 className="text-sm font-bold text-white">Renuncia Voluntaria</h4>
                            </div>
                            <p className="text-[10px] text-amber-100 mt-1">Ley 523 — 15 días/año</p>
                          </div>
                          <div className="p-4 space-y-2">
                            {(() => {
                              const renResult = detailResult.liquidacion.tipo === 'RENUNCIA_VOLUNTARIA' ? detailResult : comparisonResult;
                              return Object.entries(renResult.desglose).map(([key, val]) => {
                                if (val.monto === 0) return null;
                                const labels: Record<string, string> = {
                                  indemnizacion: 'Indemnización',
                                  prestacion_economica: 'Prestación Económica',
                                  vacacion_proporcional: 'Vacación',
                                  aguinaldo_proporcional: 'Aguinaldo',
                                  salario_pendiente: 'Salario Pend.',
                                };
                                return (
                                  <div key={key} className="flex justify-between text-xs">
                                    <span className="text-slate-600 dark:text-slate-400">{labels[key] || key}</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{fmt(val.monto)}</span>
                                  </div>
                                );
                              });
                            })()}
                            <Separator />
                            <div className="flex justify-between text-sm">
                              <span className="font-bold text-slate-900 dark:text-slate-100">TOTAL</span>
                              <span className="font-bold text-amber-700 dark:text-amber-300 text-lg">
                                {fmt((detailResult.liquidacion.tipo === 'RENUNCIA_VOLUNTARIA' ? detailResult : comparisonResult).liquidacion.total_liquidacion)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Difference highlight */}
                      {(() => {
                        const despTotal = (detailResult.liquidacion.tipo === 'DESPEDO_INJUSTIFICADO' ? detailResult : comparisonResult).liquidacion.total_liquidacion;
                        const renTotal = (detailResult.liquidacion.tipo === 'RENUNCIA_VOLUNTARIA' ? detailResult : comparisonResult).liquidacion.total_liquidacion;
                        const diff = despTotal - renTotal;
                        const pctDiff = renTotal > 0 ? (diff / renTotal * 100) : 0;
                        return (
                          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                                <ArrowRight className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div>
                                <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">Diferencia</h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  El despido injustificado paga <strong className="text-emerald-700 dark:text-emerald-300">{fmt(diff)} más</strong> ({pctDiff.toFixed(1)}% adicional)
                                  que la renuncia voluntaria para este empleado.
                                </p>
                              </div>
                              <div className="ml-auto text-right">
                                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(diff)}</p>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">+{pctDiff.toFixed(1)}%</p>
                              </div>
                            </div>
                            {/* Visual bar comparison */}
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] w-24 text-rose-600 dark:text-rose-400 font-medium">Despido</span>
                                <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-rose-500 rounded-full" style={{ width: '100%' }} />
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-20 text-right">{fmt(despTotal)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] w-24 text-amber-600 dark:text-amber-400 font-medium">Renuncia</span>
                                <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(renTotal / despTotal * 100)}%` }} />
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-20 text-right">{fmt(renTotal)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                      <Eye className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No se pudo cargar la comparación</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Legal Reference Tab ────────────────────────────────────── */}
            <TabsContent value="legal">
              <div className="space-y-4 mt-4">
                <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
                        <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-300">Marco Legal — Liquidación Laboral</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Principales artículos del Código de Trabajo y leyes conexas
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Art. 58 */}
                <Card className="shadow-sm border-rose-200 dark:border-rose-800">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 shrink-0">
                        <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300 mb-1">Art. 58 CT</Badge>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Despido Injustificado — Indemnización</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                          Cuando el empleador despida injustificadamente al trabajador, deberá pagarle una indemnización equivalente
                          a <strong>30 días de salario por cada año de servicio</strong> y fracciones mayores de seis meses, con un
                          máximo de <strong>4 años de salario</strong>. El salario diario se calcula dividiendo el mensual entre 30.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ley 523 */}
                <Card className="shadow-sm border-amber-200 dark:border-amber-800">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 shrink-0">
                        <User className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300 mb-1">Ley 523</Badge>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Renuncia Voluntaria — Prestación Económica</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                          El trabajador que renuncie voluntariamente tiene derecho a una <strong>prestación económica de 15 días
                          de salario por cada año de servicio</strong>. No hay límite máximo de años. Se calcula sobre el salario diario.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Art. 177 */}
                <Card className="shadow-sm border-teal-200 dark:border-teal-800">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/50 shrink-0">
                        <Umbrella className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300 mb-1">Art. 177 CT</Badge>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Vacación Proporcional</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                          Todo trabajador tiene derecho a <strong>15 días de vacación pagada</strong> por cada año trabajado.
                          Al finalizar la relación laboral, se pagan las vacaciones no gozadas proporcionalmente.
                          La proporción es de <strong>1.25 días por mes</strong> trabajado.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Arts. 196-202 */}
                <Card className="shadow-sm border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
                        <Gift className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 mb-1">Arts. 196-202 CT</Badge>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Aguinaldo Proporcional</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                          Al finalizar la relación laboral, el trabajador tiene derecho al <strong>aguinaldo proporcional</strong>
                          por los días trabajados en el año. Base: 15 días (1-3 años), 19 días (3-10 años), 21 días (10+ años).
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Art. 44 */}
                <Card className="shadow-sm border-sky-200 dark:border-sky-800">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 shrink-0">
                        <Banknote className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300 mb-1">Art. 44 CT</Badge>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Salario Pendiente</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                          El empleador debe pagar al trabajador todos los <strong>salarios devengados y no pagados</strong>
                          al momento de finalizar la relación laboral. Esto incluye cualquier salario pendiente hasta la fecha de liquidación.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ── New Liquidation Wizard Dialog ──────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-600" />
              Nueva Liquidación
            </DialogTitle>
            <DialogDescription>Asistente paso a paso para calcular la liquidación</DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <WizardSteps currentStep={wizardStep} steps={wizardSteps} />

          <div className="space-y-5 pt-2">
            {/* Step 1: Select Employee */}
            {wizardStep === 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" /> Seleccione el Empleado
                </h4>
                <div className="space-y-2" ref={dropdownRef}>
                  <Label className="text-sm font-medium">Buscar Empleado</Label>
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
                                  {emp.codigo_empleado} · {emp.perfil_puesto?.nombre_puesto || 'Sin puesto'}
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
              </div>
            )}

            {/* Step 2: Select Type */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald-600" /> Tipo de Liquidación
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {/* Despido Injustificado */}
                  <button
                    onClick={() => setSelectedTipo('DESPEDO_INJUSTIFICADO')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedTipo === 'DESPEDO_INJUSTIFICADO'
                        ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Despido Injustificado</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Art. 58 CT — 30 días/año, máx. 4 años de salario</p>
                      </div>
                      {selectedTipo === 'DESPEDO_INJUSTIFICADO' && (
                        <CheckCircle2 className="h-5 w-5 text-rose-600 dark:text-rose-400 ml-auto" />
                      )}
                    </div>
                  </button>

                  {/* Renuncia Voluntaria */}
                  <button
                    onClick={() => setSelectedTipo('RENUNCIA_VOLUNTARIA')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedTipo === 'RENUNCIA_VOLUNTARIA'
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <User className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Renuncia Voluntaria</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Ley 523 — 15 días/año de servicio</p>
                      </div>
                      {selectedTipo === 'RENUNCIA_VOLUNTARIA' && (
                        <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400 ml-auto" />
                      )}
                    </div>
                  </button>

                  {/* Despido Justificado */}
                  <button
                    onClick={() => setSelectedTipo('DESPEDO_JUSTIFICADO')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedTipo === 'DESPEDO_JUSTIFICADO'
                        ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-teal-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Despido Justificado</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Solo vacación y aguinaldo proporcionales</p>
                      </div>
                      {selectedTipo === 'DESPEDO_JUSTIFICADO' && (
                        <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400 ml-auto" />
                      )}
                    </div>
                  </button>

                  {/* Fin de Contrato */}
                  <button
                    onClick={() => setSelectedTipo('FIN_CONTRATO')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedTipo === 'FIN_CONTRATO'
                        ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-sky-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Fin de Contrato</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Solo vacación y aguinaldo proporcionales</p>
                      </div>
                      {selectedTipo === 'FIN_CONTRATO' && (
                        <CheckCircle2 className="h-5 w-5 text-sky-600 dark:text-sky-400 ml-auto" />
                      )}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-600" /> Revise los Datos
                </h4>
                <div className="space-y-3">
                  {/* Employee review */}
                  {selectedEmployee && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200 text-sm font-bold">
                            {getInitials(selectedEmployee)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {selectedEmployee.primer_nombre} {selectedEmployee.primer_apellido}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {selectedEmployee.codigo_empleado} · {selectedEmployee.perfil_puesto?.nombre_puesto || 'Sin puesto'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Type review */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tipoColors[selectedTipo]?.bg || 'bg-slate-100'}`}>
                        {selectedTipo === 'DESPEDO_INJUSTIFICADO' && <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
                        {selectedTipo === 'RENUNCIA_VOLUNTARIA' && <User className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
                        {selectedTipo === 'DESPEDO_JUSTIFICADO' && <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
                        {selectedTipo === 'FIN_CONTRATO' && <Clock className="h-5 w-5 text-sky-600 dark:text-sky-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tipoLabels[selectedTipo]}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{tipoDescriptions[selectedTipo]}</p>
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Fecha de Liquidación</Label>
                    <Input type="date" value={selectedFecha} onChange={e => setSelectedFecha(e.target.value)} />
                    <p className="text-[10px] text-slate-400">La fecha determina el cálculo de años de servicio y proporcionales</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Confirmar Cálculo
                </h4>
                <div className="p-5 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200 text-base font-bold">
                        {selectedEmployee ? getInitials(selectedEmployee) : '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {selectedEmployee ? `${selectedEmployee.primer_nombre} ${selectedEmployee.primer_apellido}` : '—'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{selectedEmployee?.codigo_empleado}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Tipo</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{tipoLabels[selectedTipo]}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Fecha</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedFecha || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Salario</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedEmployee?.contratos?.[0] ? fmt(selectedEmployee.contratos[0].salario_base_contrato) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Ingreso</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedEmployee?.fecha_ingreso ? new Date(selectedEmployee.fecha_ingreso).toLocaleDateString('es-SV') : '—'}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Al confirmar se calculará la liquidación según la legislación vigente de El Salvador.
                </p>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-3 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  if (wizardStep > 0) setWizardStep(wizardStep - 1);
                  else setShowNew(false);
                }}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {wizardStep > 0 ? 'Anterior' : 'Cancelar'}
              </Button>
              {wizardStep < 3 ? (
                <Button
                  onClick={() => setWizardStep(wizardStep + 1)}
                  disabled={!canAdvanceStep()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
                  Calcular Liquidación
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Liquidation History Table ──────────────────────────────────── */}
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
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-t border-b bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Empleado</th>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Tipo</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Fecha</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Indemnización</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Vacación</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Aguinaldo</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Salario Pend.</th>
                    <th className="text-right font-medium text-emerald-600 dark:text-emerald-400 p-3 bg-emerald-50/50 dark:bg-emerald-950/20">Total</th>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Estado</th>
                    <th className="text-center font-medium text-slate-500 dark:text-slate-400 p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidaciones.map(l => {
                    const tc = tipoColors[l.tipo];
                    return (
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
                        <td className="p-3">
                          <Badge className={`text-[10px] ${tc?.bg || ''} ${tc?.text || ''}`} variant="secondary">
                            {tipoLabels[l.tipo] || l.tipo}
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-xs text-slate-600 dark:text-slate-400">
                          {l.fecha_liquidacion ? new Date(l.fecha_liquidacion).toLocaleDateString('es-SV') : '—'}
                        </td>
                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                          {l.indemnizacion > 0 ? fmt(l.indemnizacion) : l.prestacion_economica > 0 ? fmt(l.prestacion_economica) : '-'}
                        </td>
                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                          {l.vacacion_proporcional > 0 ? fmt(l.vacacion_proporcional) : '-'}
                        </td>
                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                          {l.aguinaldo_proporcional > 0 ? fmt(l.aguinaldo_proporcional) : '-'}
                        </td>
                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                          {l.salario_pendiente > 0 ? fmt(l.salario_pendiente) : '-'}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/5">
                          {fmt(l.total_liquidacion)}
                        </td>
                        <td className="p-3">
                          <Badge className={`text-[10px] ${estadoColors[l.estado] || 'bg-slate-100'}`} variant="secondary">
                            {l.estado}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              onClick={() => handleGeneratePdf(l.empleado_id, l.empleado_codigo)}
                              disabled={generatingPdf === l.empleado_id}
                              title="Generar PDF"
                            >
                              {generatingPdf === l.empleado_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              onClick={() => {
                                // View this liquidation detail by re-fetching
                                toast({ title: 'Ver Detalle', description: `Liquidación de ${l.empleado_nombre}` });
                              }}
                              title="Ver Detalle"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {historyStats.count > 0 && (
                  <tfoot>
                    <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 border-t-2 border-emerald-200 dark:border-emerald-800">
                      <td colSpan={7} className="p-3 text-sm font-bold text-slate-700 dark:text-slate-300 text-right">
                        Total General ({historyStats.count} liquidaciones)
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10">
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
