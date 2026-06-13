'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, AlertTriangle, Loader2, Shield, FileCheck, PenTool,
  RefreshCw, Lock, Eye, XCircle, DollarSign, Clock, ArrowRight,
  Ban, Send, History, Users, TrendingUp, ChevronDown, ChevronRight,
  CalendarDays, ClipboardCheck, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface PayrollApprovalProps {
  accessToken: string;
  userRole: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ChecklistItem {
  id: string;
  item: string;
  completado: boolean;
  completado_por: { nombre: string; apellido: string } | null;
  fecha_completado: string | null;
}

interface TimelineEntry {
  id: string;
  accion: string;
  usuario_email: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  detalle_adicional: string | null;
  fecha_accion: string;
}

interface PlanillaSummary {
  id: string;
  codigo_planilla: string;
  tipo: string;
  estado: string;
  total_empleados: number;
  total_salarios_brutos: number;
  total_neto_a_pagar: number;
  total_cargas_patronales: number;
  motivo_rechazo?: string | null;
  fecha_pago?: string | null;
  referencia_pago?: string | null;
  fecha_creacion?: string;
  fecha_generacion?: string;
  total_deducciones?: number;
}

// Workflow step definitions
const WORKFLOW_STEPS = [
  { key: 'CALCULADA', label: 'Calculada', icon: Clock, description: 'Planilla calculada por analista' },
  { key: 'EN_CORRECCION', label: 'En Revisión', icon: RefreshCw, description: 'Devuelta para corrección' },
  { key: 'APROBADA', label: 'Aprobada', icon: CheckCircle, description: 'Aprobada por aprobador' },
  { key: 'PAGADA', label: 'Pagada', icon: DollarSign, description: 'Pago confirmado' },
];

const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CALCULADA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  EN_CORRECCION: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  APROBADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  PAGADA: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
};

const ESTADO_DOT_COLORS: Record<string, string> = {
  CALCULADA: 'bg-amber-500',
  EN_CORRECCION: 'bg-orange-500',
  APROBADA: 'bg-emerald-500',
  PAGADA: 'bg-green-500',
};

const ACCION_LABELS: Record<string, string> = {
  CALCULO_PLANILLA: 'Cálculo de Planilla',
  CALCULO_AGUINALDO: 'Cálculo de Aguinaldo',
  ENVIO_APROBACION: 'Envío para Aprobación',
  APROBACION_PLANILLA: 'Aprobación',
  RECHAZO_PLANILLA: 'Rechazo / Corrección',
  CORRECCION_PLANILLA: 'Corrección Aplicada',
  PAGO_PLANILLA: 'Pago Confirmado',
};

export default function PayrollApproval({ accessToken, userRole }: PayrollApprovalProps) {
  const { toast } = useToast();
  const [planillas, setPlanillas] = useState<PlanillaSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [planillaDetail, setPlanillaDetail] = useState<Record<string, unknown> | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [expandedPlanilla, setExpandedPlanilla] = useState<string | null>(null);

  const fetchPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nomina/planillas?limit=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setPlanillas(data.planillas?.filter((p: PlanillaSummary) =>
        ['CALCULADA', 'EN_CORRECCION', 'APROBADA', 'PAGADA'].includes(p.estado)
      ) || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar planillas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  const fetchChecklist = useCallback(async (planillaId: string) => {
    setLoadingChecklist(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${planillaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setChecklist(data.planilla?.checklist_aprobacion || []);
      setTimeline(data.timeline || []);
      setPlanillaDetail(data.planilla);

      setSignatureName('');
      setConfirmChecked(false);
      setRejectionReason('');
      setPaymentReference('');
      setShowRejectForm(false);
      setShowPayForm(false);
      setShowApprovalDialog(false);
      setShowRejectDialog(false);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el detalle', variant: 'destructive' });
    } finally {
      setLoadingChecklist(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { fetchPlanillas(); }, [fetchPlanillas]);

  useEffect(() => {
    if (selectedId) fetchChecklist(selectedId);
  }, [selectedId, fetchChecklist]);

  const handleToggleChecklist = async (itemId: string, completado: boolean) => {
    try {
      const res = await fetch(`/api/nomina/planillas/${selectedId}/checklist`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, completado }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      setChecklist(prev => prev.map(c => c.id === itemId ? { ...c, completado, completado_por: completado ? { nombre: 'Usted', apellido: '' } : null, fecha_completado: completado ? new Date().toISOString() : null } : c));
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al actualizar', variant: 'destructive' });
    }
  };

  const handleApprove = async () => {
    if (!signatureName.trim()) {
      toast({ title: 'Error', description: 'Ingrese su nombre como firma digital', variant: 'destructive' });
      return;
    }
    if (!confirmChecked) {
      toast({ title: 'Error', description: 'Debe confirmar la aprobación', variant: 'destructive' });
      return;
    }
    setApproving(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${selectedId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'APROBADA' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aprobar');
      toast({ title: 'Planilla Aprobada', description: 'La planilla ha sido aprobada exitosamente' });
      setShowApprovalDialog(false);
      fetchPlanillas();
      fetchChecklist(selectedId);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al aprobar', variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: 'Error', description: 'Debe indicar el motivo de rechazo', variant: 'destructive' });
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${selectedId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'EN_CORRECCION', motivo_rechazo: rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al rechazar');
      toast({ title: 'Planilla Devuelta', description: 'La planilla ha sido devuelta para corrección', variant: 'default' });
      setShowRejectDialog(false);
      fetchPlanillas();
      fetchChecklist(selectedId);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al rechazar', variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  const handlePay = async () => {
    setPaying(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${selectedId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'PAGADA', referencia_pago: paymentReference || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al marcar como pagada');
      toast({ title: 'Planilla Pagada', description: 'La planilla ha sido marcada como pagada exitosamente' });
      fetchPlanillas();
      fetchChecklist(selectedId);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al pagar', variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const allChecked = checklist.length > 0 && checklist.every(c => c.completado);
  const selectedPlanilla = planillas.find(p => p.id === selectedId);

  const canApprove = selectedPlanilla &&
    ['CALCULADA', 'EN_CORRECCION'].includes(selectedPlanilla.estado) &&
    ['ADMIN', 'APROBADOR', 'GERENCIA'].includes(userRole);

  const canReject = selectedPlanilla &&
    ['CALCULADA', 'EN_CORRECCION'].includes(selectedPlanilla.estado) &&
    ['ADMIN', 'APROBADOR', 'GERENCIA'].includes(userRole);

  const canPay = selectedPlanilla &&
    selectedPlanilla.estado === 'APROBADA' &&
    ['ADMIN', 'APROBADOR', 'GERENCIA'].includes(userRole);

  const getCurrentStepIndex = (estado: string) => {
    if (estado === 'PAGADA') return 3;
    if (estado === 'APROBADA') return 2;
    if (estado === 'EN_CORRECCION') return 1;
    return 0;
  };

  // KPI calculations
  const pendientesCount = planillas.filter(p => ['CALCULADA', 'EN_CORRECCION'].includes(p.estado)).length;
  const aprobadasHoyCount = planillas.filter(p => p.estado === 'APROBADA').length;
  const montoPendiente = planillas.filter(p => ['CALCULADA', 'EN_CORRECCION'].includes(p.estado)).reduce((s, p) => s + p.total_neto_a_pagar, 0);
  const montoAprobadoHoy = planillas.filter(p => p.estado === 'APROBADA').reduce((s, p) => s + p.total_neto_a_pagar, 0);

  return (
    <div className="space-y-5">
      {/* ========== KPI HEADER STATS ========== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm border-l-4 border-l-amber-500 dark:border-l-amber-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pendientes de Aprobación</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{pendientesCount}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] text-amber-600 dark:text-amber-400">Requieren revisión</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-emerald-500 dark:border-l-emerald-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Aprobadas Hoy</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{aprobadasHoyCount}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Listas para pago</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-teal-500 dark:border-l-teal-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Monto Total Pendiente</p>
                <p className="text-lg font-bold text-teal-700 dark:text-teal-400 mt-1">{fmt(montoPendiente)}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40">
                <DollarSign className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <AlertCircle className="h-3 w-3 text-teal-500" />
              <span className="text-[10px] text-teal-600 dark:text-teal-400">Por aprobar</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-green-500 dark:border-l-green-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Monto Aprobado Hoy</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-1">{fmt(montoAprobadoHoy)}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-green-600 dark:text-green-400">Aprobado</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== VISUAL APPROVAL WORKFLOW ========== */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Flujo de Aprobación de Planillas
          </CardTitle>
          <CardDescription>Segregación de funciones: Analista calcula → Aprobador aprueba → Admin/Admin paga</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((step, idx) => {
              const currentIdx = selectedPlanilla ? getCurrentStepIndex(selectedPlanilla.estado) : -1;
              const isCompleted = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              const isPending = idx > currentIdx || !selectedPlanilla;
              const StepIcon = step.icon;

              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={`
                      h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center border-2 transition-all duration-300
                      ${isCompleted ? 'bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-700 dark:border-emerald-700 shadow-md shadow-emerald-200 dark:shadow-emerald-900/30' : ''}
                      ${isCurrent ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-400 ring-4 ring-emerald-100 dark:ring-emerald-900/20' : ''}
                      ${isPending ? 'bg-slate-50 border-slate-200 text-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500' : ''}
                    `}>
                      {isCompleted ? <CheckCircle className="h-5 w-5" /> : <StepIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
                    </div>
                    <p className={`text-xs font-medium text-center ${isCurrent ? 'text-emerald-700 dark:text-emerald-400' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center hidden sm:block max-w-[100px]">{step.description}</p>
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="flex-1 flex items-center justify-center px-1">
                      <div className={`h-0.5 w-full rounded-full transition-colors duration-300 ${
                        idx < currentIdx ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`} />
                      <ArrowRight className={`h-4 w-4 shrink-0 mx-0.5 ${
                        idx < currentIdx ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-200 dark:text-slate-700'
                      }`} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ========== PLANILLA CARDS ========== */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : planillas.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <FileCheck className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-500">No hay planillas en el flujo de aprobación</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Planillas en Flujo ({planillas.length})</h3>
          </div>
          {planillas.map(p => {
            const isExpanded = expandedPlanilla === p.id;
            const isSelected = selectedId === p.id;
            const stepIdx = getCurrentStepIndex(p.estado);
            const deducciones = p.total_salarios_brutos - p.total_neto_a_pagar;

            return (
              <Card
                key={p.id}
                className={`shadow-sm cursor-pointer transition-all duration-200 overflow-hidden ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 dark:ring-emerald-600 border-emerald-300 dark:border-emerald-700'
                    : 'hover:border-emerald-200 dark:hover:border-emerald-800'
                }`}
                onClick={() => { setSelectedId(p.id); setExpandedPlanilla(isExpanded ? null : p.id); }}
              >
                <CardContent className="p-4 sm:p-5">
                  {/* Card header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Status dot */}
                      <div className={`mt-1.5 h-3 w-3 rounded-full shrink-0 ${ESTADO_DOT_COLORS[p.estado] || 'bg-slate-400'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm dark:text-slate-100">{p.codigo_planilla}</span>
                          <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-slate-700 dark:text-slate-300">{p.tipo}</Badge>
                          <Badge className={`text-[10px] ${ESTADO_COLORS[p.estado] || 'bg-slate-100 dark:bg-slate-700'}`}>{p.estado}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.total_empleados} empleados</span>
                          {p.fecha_creacion && (
                            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(p.fecha_creacion).toLocaleDateString('es-SV')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{fmt(p.total_neto_a_pagar)}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Total Neto</p>
                    </div>
                  </div>

                  {/* Financial summary row */}
                  <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Total Bruto</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{fmt(p.total_salarios_brutos)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Deducciones</p>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">{fmt(deducciones > 0 ? deducciones : 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Cargas Patronales</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{fmt(p.total_cargas_patronales)}</p>
                    </div>
                  </div>

                  {/* Expandable section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-4">
                      {/* Progress indicator */}
                      <div className="flex items-center gap-1">
                        {WORKFLOW_STEPS.map((step, idx) => {
                          const isCompleted = idx < stepIdx;
                          const isCurrent = idx === stepIdx;
                          const StepIcon = step.icon;
                          return (
                            <React.Fragment key={step.key}>
                              <div className="flex items-center gap-1.5">
                                <div className={`
                                  h-6 w-6 rounded-full flex items-center justify-center
                                  ${isCompleted ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : ''}
                                  ${isCurrent ? 'bg-emerald-500 text-white dark:bg-emerald-600' : ''}
                                  ${!isCompleted && !isCurrent ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : ''}
                                `}>
                                  {isCompleted ? <CheckCircle className="h-3.5 w-3.5" /> : <StepIcon className="h-3 w-3" />}
                                </div>
                                <span className={`text-[10px] ${isCurrent ? 'font-semibold text-emerald-700 dark:text-emerald-400' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                  {step.label}
                                </span>
                              </div>
                              {idx < WORKFLOW_STEPS.length - 1 && (
                                <ArrowRight className={`h-3 w-3 mx-0.5 ${idx < stepIdx ? 'text-emerald-500' : 'text-slate-200 dark:text-slate-600'}`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Rejection reason for EN_CORRECCION */}
                      {p.estado === 'EN_CORRECCION' && p.motivo_rechazo && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-red-800 dark:text-red-300">Motivo de Rechazo:</p>
                              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{p.motivo_rechazo}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment info for PAGADA */}
                      {p.estado === 'PAGADA' && (
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <div className="flex items-start gap-2">
                            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-green-800 dark:text-green-300 space-y-1">
                              <p className="font-semibold">Pago Confirmado</p>
                              {p.fecha_pago && <p>Fecha: {new Date(p.fecha_pago).toLocaleDateString('es-SV')}</p>}
                              {p.referencia_pago && <p>Referencia: {p.referencia_pago}</p>}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action buttons for CALCULADA */}
                      {['CALCULADA', 'EN_CORRECCION'].includes(p.estado) && ['ADMIN', 'APROBADOR', 'GERENCIA'].includes(userRole) && (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-emerald-700 dark:to-teal-700 dark:hover:from-emerald-800 dark:hover:to-teal-800 text-white shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(p.id);
                              setShowApprovalDialog(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" /> Aprobar
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(p.id);
                              setShowRejectDialog(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1.5" /> Rechazar
                          </Button>
                        </div>
                      )}

                      {/* Pay button for APROBADA */}
                      {p.estado === 'APROBADA' && ['ADMIN', 'APROBADOR', 'GERENCIA'].includes(userRole) && !showPayForm && (
                        <Button
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 dark:from-green-700 dark:to-emerald-700 dark:hover:from-green-800 dark:hover:to-emerald-800 text-white shadow-sm"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); setShowPayForm(true); }}
                        >
                          <DollarSign className="h-4 w-4 mr-1.5" /> Confirmar Pago
                        </Button>
                      )}

                      {/* Analista info */}
                      {userRole === 'ANALISTA' && p.estado === 'CALCULADA' && (
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-start gap-2">
                            <Send className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              <p className="font-semibold">Rol Analista</p>
                              <p className="mt-1">Como analista, usted calculó esta planilla. Un APROBADOR, GERENCIA o ADMIN debe revisarla.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expand toggle */}
                  <div className="flex justify-center mt-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-300 dark:text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========== APPROVAL CONFIRMATION DIALOG ========== */}
      {showApprovalDialog && selectedPlanilla && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowApprovalDialog(false)}>
          <Card className="w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <CheckCircle className="h-5 w-5" /> Confirmar Aprobación
              </CardTitle>
              <CardDescription className="dark:text-slate-400">Revise el resumen antes de aprobar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Planilla summary */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-500 dark:text-slate-400">Código:</div><div className="font-mono font-medium dark:text-slate-200">{selectedPlanilla.codigo_planilla}</div>
                  <div className="text-slate-500 dark:text-slate-400">Tipo:</div><div className="dark:text-slate-200">{selectedPlanilla.tipo}</div>
                  <div className="text-slate-500 dark:text-slate-400">Empleados:</div><div className="dark:text-slate-200">{selectedPlanilla.total_empleados}</div>
                  <div className="text-slate-500 dark:text-slate-400">Total Bruto:</div><div className="font-medium dark:text-slate-200">{fmt(selectedPlanilla.total_salarios_brutos)}</div>
                  <div className="text-slate-500 dark:text-slate-400">Total Neto:</div><div className="font-bold text-emerald-700 dark:text-emerald-400">{fmt(selectedPlanilla.total_neto_a_pagar)}</div>
                </div>
                <Separator />
                {!allChecked && checklist.length > 0 && (
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Debe completar todos los items del checklist antes de aprobar
                  </div>
                )}
              </div>

              {/* Signature */}
              <div className="space-y-2">
                <Label className="dark:text-slate-200">Nombre del Aprobador *</Label>
                <Input
                  value={signatureName}
                  onChange={e => setSignatureName(e.target.value)}
                  placeholder="Ingrese su nombre completo como firma digital"
                  disabled={!allChecked}
                />
              </div>

              {/* Confirmation checkbox */}
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={confirmChecked}
                  onCheckedChange={(checked) => setConfirmChecked(!!checked)}
                  disabled={!allChecked}
                  className="mt-0.5"
                />
                <Label className="text-xs text-slate-600 dark:text-slate-400 leading-tight">
                  Confirmo que he revisado la planilla y autorizo su aprobación conforme a las normativas vigentes.
                </Label>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleApprove}
                  disabled={!allChecked || !signatureName.trim() || !confirmChecked || approving}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-emerald-700 dark:to-teal-700 dark:hover:from-emerald-800 dark:hover:to-teal-800 text-white"
                >
                  {approving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aprobando...</>
                  ) : (
                    <><CheckCircle className="h-4 w-4 mr-1.5" /> Confirmar Aprobación</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowApprovalDialog(false)} className="flex-1 dark:border-slate-600 dark:text-slate-300">
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== REJECTION CONFIRMATION DIALOG ========== */}
      {showRejectDialog && selectedPlanilla && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowRejectDialog(false)}>
          <Card className="w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
              <CardTitle className="text-base flex items-center gap-2 text-red-800 dark:text-red-300">
                <Ban className="h-5 w-5" /> Confirmar Rechazo
              </CardTitle>
              <CardDescription className="dark:text-slate-400">La planilla volverá a estado EN_CORRECCIÓN</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Planilla summary */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-slate-500 dark:text-slate-400">Código:</div><div className="font-mono font-medium dark:text-slate-200">{selectedPlanilla.codigo_planilla}</div>
                  <div className="text-slate-500 dark:text-slate-400">Tipo:</div><div className="dark:text-slate-200">{selectedPlanilla.tipo}</div>
                  <div className="text-slate-500 dark:text-slate-400">Total Neto:</div><div className="font-bold text-red-700 dark:text-red-400">{fmt(selectedPlanilla.total_neto_a_pagar)}</div>
                </div>
              </div>

              {/* Motivo de rechazo */}
              <div className="space-y-2">
                <Label className="text-red-700 dark:text-red-400 font-medium">Motivo de rechazo / corrección *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Indique el motivo por el cual se devuelve la planilla para corrección..."
                  rows={4}
                  className="border-red-200 focus:border-red-500 dark:border-red-800 dark:focus:border-red-600"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleReject}
                  disabled={!rejectionReason.trim() || rejecting}
                  className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 dark:from-red-700 dark:to-orange-700 dark:hover:from-red-800 dark:hover:to-orange-800 text-white"
                >
                  {rejecting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
                  ) : (
                    <><XCircle className="h-4 w-4 mr-1.5" /> Confirmar Rechazo</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="flex-1 dark:border-slate-600 dark:text-slate-300">
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== SELECTED PLANILLA DETAIL ========== */}
      {selectedId && selectedPlanilla && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column: Checklist + Timeline */}
          <div className="space-y-4">
            {/* Checklist */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Checklist de Aprobación
                </CardTitle>
                <CardDescription>Todos los items deben ser completados antes de aprobar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingChecklist ? (
                  <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : checklist.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">No hay items de checklist</p>
                ) : (
                  checklist.map(item => (
                    <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      item.completado
                        ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                        : 'bg-slate-50 dark:bg-slate-800/50'
                    }`}>
                      <Checkbox
                        checked={item.completado}
                        onCheckedChange={(checked) => handleToggleChecklist(item.id, !!checked)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${item.completado ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                          {item.item}
                        </p>
                        {item.completado && item.completado_por && (
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            Completado por: {item.completado_por.nombre} {item.completado_por.apellido}
                          </p>
                        )}
                      </div>
                      {item.completado ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                      )}
                    </div>
                  ))
                )}
                {!allChecked && checklist.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Complete todos los items del checklist para habilitar la aprobación
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workflow Timeline */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Historial de Cambios
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowTimeline(!showTimeline)} className="dark:text-slate-400">
                    <Eye className="h-3.5 w-3.5 mr-1" /> {showTimeline ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
              </CardHeader>
              {showTimeline && (
                <CardContent>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">No hay historial de cambios</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                      {timeline.map((entry, idx) => (
                        <div key={entry.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`h-3 w-3 rounded-full mt-1 ${
                              entry.accion.includes('RECHAZO') ? 'bg-orange-400' :
                              entry.accion.includes('PAGO') ? 'bg-green-500' :
                              entry.accion.includes('APROBACION') ? 'bg-emerald-500' :
                              'bg-slate-400'
                            }`} />
                            {idx < timeline.length - 1 && <div className="w-px h-full bg-slate-200 dark:bg-slate-700 mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                              {ACCION_LABELS[entry.accion] || entry.accion}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{entry.usuario_email || 'Sistema'}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              {new Date(entry.fecha_accion).toLocaleString('es-SV')}
                            </p>
                            {entry.detalle_adicional && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{entry.detalle_adicional}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          {/* Right column: Summary + Actions */}
          <div className="space-y-4">
            {/* Summary */}
            <Card className="shadow-sm border-l-4 border-l-emerald-500 dark:border-l-emerald-600">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Resumen de Planilla</CardTitle>
                  <Badge className={`text-xs ${ESTADO_COLORS[selectedPlanilla.estado] || 'bg-slate-100 dark:bg-slate-700'}`} variant="secondary">
                    {selectedPlanilla.estado}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-500 dark:text-slate-400">Código:</div><div className="font-mono dark:text-slate-200">{selectedPlanilla.codigo_planilla}</div>
                  <div className="text-slate-500 dark:text-slate-400">Tipo:</div><div className="dark:text-slate-200">{selectedPlanilla.tipo}</div>
                  <div className="text-slate-500 dark:text-slate-400">Empleados:</div><div className="dark:text-slate-200">{selectedPlanilla.total_empleados}</div>
                  <div className="text-slate-500 dark:text-slate-400">Total Bruto:</div><div className="font-medium dark:text-slate-200">{fmt(selectedPlanilla.total_salarios_brutos)}</div>
                  <div className="text-slate-500 dark:text-slate-400">Total Neto:</div><div className="font-bold text-emerald-700 dark:text-emerald-400">{fmt(selectedPlanilla.total_neto_a_pagar)}</div>
                  <div className="text-slate-500 dark:text-slate-400">Cargas Patronales:</div><div className="dark:text-slate-200">{fmt(selectedPlanilla.total_cargas_patronales)}</div>
                </div>
              </CardContent>
            </Card>

            {/* Inmutabilidad warning */}
            <Card className="shadow-sm border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-medium">Segregación de Funciones</p>
                    <p className="mt-1">El analista que calculó la planilla no puede aprobarla. Solo APROBADOR, GERENCIA o ADMIN pueden aprobar.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pay Action (inline form) */}
            {canPay && showPayForm && (
              <Card className="shadow-sm border-green-200 dark:border-green-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                    <DollarSign className="h-4 w-4" /> Confirmar Pago
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">Marcar planilla como PAGADA</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="dark:text-slate-200">Referencia de Pago (opcional)</Label>
                    <Input
                      value={paymentReference}
                      onChange={e => setPaymentReference(e.target.value)}
                      placeholder="Número de referencia, lote, etc."
                    />
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">
                      <strong>Total a pagar:</strong> {fmt(selectedPlanilla.total_neto_a_pagar)} ({selectedPlanilla.total_empleados} empleados)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handlePay}
                      disabled={paying}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 dark:from-green-700 dark:to-emerald-700 text-white"
                    >
                      {paying ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
                      ) : (
                        <><DollarSign className="h-4 w-4 mr-1.5" /> Confirmar Pago</>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setShowPayForm(false)} className="flex-1 dark:border-slate-600 dark:text-slate-300">
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
