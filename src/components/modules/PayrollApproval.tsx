'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, AlertTriangle, Loader2, Shield, FileCheck, PenTool,
  RefreshCw, Lock, Eye, XCircle, DollarSign, Clock, ArrowRight,
  Ban, Send, History
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
}

// Workflow step definitions
const WORKFLOW_STEPS = [
  { key: 'CALCULADA', label: 'Calculada', icon: Clock, description: 'Planilla calculada por analista' },
  { key: 'EN_CORRECCION', label: 'En Corrección', icon: RefreshCw, description: 'Devuelta para corrección' },
  { key: 'APROBADA', label: 'Aprobada', icon: CheckCircle, description: 'Aprobada por aprobador' },
  { key: 'PAGADA', label: 'Pagada', icon: DollarSign, description: 'Pago confirmado' },
];

const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  CALCULADA: 'bg-amber-100 text-amber-800',
  EN_CORRECCION: 'bg-orange-100 text-orange-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  PAGADA: 'bg-green-100 text-green-800',
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

  const fetchPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nomina/planillas?limit=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      // Show all planillas that are in workflow states (not BORRADOR)
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

      // Reset forms
      setSignatureName('');
      setConfirmChecked(false);
      setRejectionReason('');
      setPaymentReference('');
      setShowRejectForm(false);
      setShowPayForm(false);
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

  // Determine what actions the current user can take
  const canApprove = selectedPlanilla &&
    ['CALCULADA', 'EN_CORRECCION'].includes(selectedPlanilla.estado) &&
    ['ADMIN', 'APROBADOR', 'GERENCIA'].includes(userRole);

  const canReject = selectedPlanilla &&
    ['CALCULADA', 'EN_CORRECCION'].includes(selectedPlanilla.estado) &&
    ['ADMIN', 'APROBADOR', 'GERENCIA'].includes(userRole);

  const canPay = selectedPlanilla &&
    selectedPlanilla.estado === 'APROBADA' &&
    ['ADMIN', 'APROBADOR', 'GERENCIA'].includes(userRole);

  // Get current step index for stepper
  const getCurrentStepIndex = (estado: string) => {
    if (estado === 'PAGADA') return 3;
    if (estado === 'APROBADA') return 2;
    if (estado === 'EN_CORRECCION') return 1;
    return 0; // CALCULADA or BORRADOR
  };

  return (
    <div className="space-y-4">
      {/* Planilla selection */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Flujo de Aprobación de Planillas
          </CardTitle>
          <CardDescription>Segregación de funciones: Analista calcula → Aprobador aprueba → Admin/Admin paga</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : planillas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No hay planillas en el flujo de aprobación</p>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Seleccione una planilla..." /></SelectTrigger>
              <SelectContent>
                {planillas.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.codigo_planilla} — {p.tipo} — {fmt(p.total_neto_a_pagar)} ({p.total_empleados} emp.)
                      <Badge className={`text-[9px] ml-1 ${ESTADO_COLORS[p.estado] || 'bg-slate-100'}`} variant="secondary">
                        {p.estado}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedId && selectedPlanilla && (
        <>
          {/* Workflow Stepper */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                {WORKFLOW_STEPS.map((step, idx) => {
                  const currentIdx = getCurrentStepIndex(selectedPlanilla.estado);
                  const isCompleted = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  const isPending = idx > currentIdx;
                  const StepIcon = step.icon;

                  return (
                    <React.Fragment key={step.key}>
                      <div className="flex flex-col items-center gap-1 flex-1">
                        <div className={`
                          h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all
                          ${isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : ''}
                          ${isCurrent ? 'bg-amber-50 border-amber-500 text-amber-600' : ''}
                          ${isPending ? 'bg-slate-50 border-slate-200 text-slate-300' : ''}
                        `}>
                          {isCompleted ? <CheckCircle className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                        </div>
                        <p className={`text-xs font-medium text-center ${isCurrent ? 'text-amber-700' : isCompleted ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {step.label}
                        </p>
                        <p className="text-[10px] text-slate-400 text-center hidden sm:block">{step.description}</p>
                      </div>
                      {idx < WORKFLOW_STEPS.length - 1 && (
                        <ArrowRight className={`h-4 w-4 shrink-0 mx-1 ${idx < currentIdx ? 'text-emerald-500' : 'text-slate-200'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Rejection reason banner */}
          {selectedPlanilla.estado === 'EN_CORRECCION' && selectedPlanilla.motivo_rechazo && (
            <Card className="shadow-sm border-orange-200 bg-orange-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-orange-800">Motivo de rechazo / corrección:</p>
                    <p className="text-sm text-orange-700 mt-1">{selectedPlanilla.motivo_rechazo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment info banner */}
          {selectedPlanilla.estado === 'PAGADA' && (
            <Card className="shadow-sm border-green-200 bg-green-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-green-800 space-y-1">
                    <p className="font-medium">Pago Confirmado</p>
                    {selectedPlanilla.fecha_pago && (
                      <p>Fecha de pago: {new Date(selectedPlanilla.fecha_pago).toLocaleDateString('es-SV')}</p>
                    )}
                    {selectedPlanilla.referencia_pago && (
                      <p>Referencia: {selectedPlanilla.referencia_pago}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left column: Checklist + Timeline */}
            <div className="space-y-4">
              {/* Checklist */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="h-4 w-4" /> Checklist de Aprobación
                  </CardTitle>
                  <CardDescription>Todos los items deben ser completados antes de aprobar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingChecklist ? (
                    <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
                  ) : checklist.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">No hay items de checklist</p>
                  ) : (
                    checklist.map(item => (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                        <Checkbox
                          checked={item.completado}
                          onCheckedChange={(checked) => handleToggleChecklist(item.id, !!checked)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${item.completado ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>
                            {item.item}
                          </p>
                          {item.completado && item.completado_por && (
                            <p className="text-xs text-slate-400">
                              Completado por: {item.completado_por.nombre} {item.completado_por.apellido}
                            </p>
                          )}
                        </div>
                        {item.completado ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-slate-300 shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                  {!allChecked && checklist.length > 0 && (
                    <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700 flex items-center gap-2">
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
                      <History className="h-4 w-4" /> Historial de Cambios
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setShowTimeline(!showTimeline)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> {showTimeline ? 'Ocultar' : 'Mostrar'}
                    </Button>
                  </div>
                </CardHeader>
                {showTimeline && (
                  <CardContent>
                    {timeline.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-2">No hay historial de cambios</p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {timeline.map((entry, idx) => (
                          <div key={entry.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`h-3 w-3 rounded-full mt-1 ${
                                entry.accion.includes('RECHAZO') ? 'bg-orange-400' :
                                entry.accion.includes('PAGO') ? 'bg-green-500' :
                                entry.accion.includes('APROBACION') ? 'bg-emerald-500' :
                                'bg-slate-400'
                              }`} />
                              {idx < timeline.length - 1 && <div className="w-px h-full bg-slate-200 mt-1" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700">
                                {ACCION_LABELS[entry.accion] || entry.accion}
                              </p>
                              <p className="text-[11px] text-slate-500">{entry.usuario_email || 'Sistema'}</p>
                              <p className="text-[11px] text-slate-400">
                                {new Date(entry.fecha_accion).toLocaleString('es-SV')}
                              </p>
                              {entry.detalle_adicional && (
                                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{entry.detalle_adicional}</p>
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
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Resumen de Planilla</CardTitle>
                    <Badge className={`text-xs ${ESTADO_COLORS[selectedPlanilla.estado] || 'bg-slate-100'}`} variant="secondary">
                      {selectedPlanilla.estado}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-slate-500">Código:</div><div className="font-mono">{selectedPlanilla.codigo_planilla}</div>
                    <div className="text-slate-500">Tipo:</div><div>{selectedPlanilla.tipo}</div>
                    <div className="text-slate-500">Empleados:</div><div>{selectedPlanilla.total_empleados}</div>
                    <div className="text-slate-500">Total Bruto:</div><div className="font-medium">{fmt(selectedPlanilla.total_salarios_brutos)}</div>
                    <div className="text-slate-500">Total Neto:</div><div className="font-bold text-emerald-700">{fmt(selectedPlanilla.total_neto_a_pagar)}</div>
                    <div className="text-slate-500">Cargas Patronales:</div><div>{fmt(selectedPlanilla.total_cargas_patronales)}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Inmutabilidad warning */}
              <Card className="shadow-sm border-amber-200 bg-amber-50/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <p className="font-medium">Segregación de Funciones</p>
                      <p className="mt-1">El analista que calculó la planilla no puede aprobarla. Solo APROBADOR, GERENCIA o ADMIN pueden aprobar.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Role-specific action panels */}
              {/* Approve Action */}
              {canApprove && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <PenTool className="h-4 w-4" /> Aprobar Planilla
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Nombre del Aprobador</Label>
                      <Input
                        value={signatureName}
                        onChange={e => setSignatureName(e.target.value)}
                        placeholder="Ingrese su nombre completo"
                        disabled={!allChecked}
                      />
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={confirmChecked}
                        onCheckedChange={(checked) => setConfirmChecked(!!checked)}
                        disabled={!allChecked}
                        className="mt-0.5"
                      />
                      <Label className="text-xs text-slate-600 leading-tight">
                        Confirmo que he revisado la planilla y autorizo su aprobación conforme a las normativas vigentes.
                      </Label>
                    </div>
                    <Button
                      onClick={handleApprove}
                      disabled={!allChecked || !signatureName.trim() || !confirmChecked || approving}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      {approving ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aprobando...</>
                      ) : (
                        <><CheckCircle className="h-4 w-4 mr-1" /> Aprobar Planilla</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Reject Action */}
              {canReject && !showRejectForm && (
                <Button
                  variant="outline"
                  className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => setShowRejectForm(true)}
                >
                  <Ban className="h-4 w-4 mr-1" /> Devolver para Corrección
                </Button>
              )}

              {canReject && showRejectForm && (
                <Card className="shadow-sm border-orange-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                      <Ban className="h-4 w-4" /> Devolver para Corrección
                    </CardTitle>
                    <CardDescription>La planilla volverá al estado EN_CORRECCIÓN</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Motivo de rechazo / corrección *</Label>
                      <Textarea
                        value={rejectionReason}
                        onChange={e => setRejectionReason(e.target.value)}
                        placeholder="Indique el motivo por el cual se devuelve la planilla para corrección..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleReject}
                        disabled={!rejectionReason.trim() || rejecting}
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                      >
                        {rejecting ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
                        ) : (
                          <><XCircle className="h-4 w-4 mr-1" /> Confirmar Rechazo</>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setShowRejectForm(false)} className="flex-1">
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pay Action */}
              {canPay && !showPayForm && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => setShowPayForm(true)}
                >
                  <DollarSign className="h-4 w-4 mr-1" /> Confirmar Pago
                </Button>
              )}

              {canPay && showPayForm && (
                <Card className="shadow-sm border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-green-700">
                      <DollarSign className="h-4 w-4" /> Confirmar Pago
                    </CardTitle>
                    <CardDescription>Marcar planilla como PAGADA</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Referencia de Pago (opcional)</Label>
                      <Input
                        value={paymentReference}
                        onChange={e => setPaymentReference(e.target.value)}
                        placeholder="Número de referencia, lote, etc."
                      />
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <p className="text-xs text-emerald-800">
                        <strong>Total a pagar:</strong> {fmt(selectedPlanilla.total_neto_a_pagar)} ({selectedPlanilla.total_empleados} empleados)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handlePay}
                        disabled={paying}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {paying ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
                        ) : (
                          <><DollarSign className="h-4 w-4 mr-1" /> Confirmar Pago</>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setShowPayForm(false)} className="flex-1">
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ANALISTA info: can only send for approval */}
              {userRole === 'ANALISTA' && selectedPlanilla.estado === 'CALCULADA' && (
                <Card className="shadow-sm border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <Send className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-800">
                        <p className="font-medium">Rol Analista</p>
                        <p className="mt-1">Como analista, usted ha calculado esta planilla. Un APROBADOR, GERENCIA o ADMIN debe revisarla y aprobarla.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
