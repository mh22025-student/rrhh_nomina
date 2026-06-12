'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, AlertTriangle, Loader2, Shield, FileCheck, PenTool,
  RefreshCw, Lock, Eye
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

interface PlanillaSummary {
  id: string;
  codigo_planilla: string;
  tipo: string;
  estado: string;
  total_empleados: number;
  total_salarios_brutos: number;
  total_neto_a_pagar: number;
  total_cargas_patronales: number;
}

export default function PayrollApproval({ accessToken }: PayrollApprovalProps) {
  const { toast } = useToast();
  const [planillas, setPlanillas] = useState<PlanillaSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [approving, setApproving] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [planillaDetail, setPlanillaDetail] = useState<Record<string, unknown> | null>(null);

  const fetchPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nomina/planillas?limit=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setPlanillas(data.planillas?.filter((p: PlanillaSummary) => ['CALCULADA', 'EN_CORRECCION'].includes(p.estado)) || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar planillas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  const fetchChecklist = useCallback(async (planillaId: string) => {
    setLoadingChecklist(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${planillaId}/checklist`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setChecklist(data.checklist || []);

      // Also fetch detail
      const detRes = await fetch(`/api/nomina/planillas/${planillaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (detRes.ok) {
        const detData = await detRes.json();
        setPlanillaDetail(detData.planilla);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el checklist', variant: 'destructive' });
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
      setSelectedId('');
      setChecklist([]);
      setSignatureName('');
      setConfirmChecked(false);
      setPlanillaDetail(null);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al aprobar', variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  const allChecked = checklist.length > 0 && checklist.every(c => c.completado);
  const selectedPlanilla = planillas.find(p => p.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Planilla selection */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Seleccione Planilla para Aprobar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : planillas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No hay planillas pendientes de aprobación</p>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Seleccione una planilla..." /></SelectTrigger>
              <SelectContent>
                {planillas.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo_planilla} — {p.tipo} — {fmt(p.total_neto_a_pagar)} ({p.total_empleados} emp.)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          {/* Planilla summary + Signature */}
          <div className="space-y-4">
            {/* Summary */}
            {selectedPlanilla && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumen de Planilla</CardTitle>
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
            )}

            {/* Inmutabilidad warning */}
            <Card className="shadow-sm border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Inmutabilidad</p>
                    <p className="mt-1">Una vez aprobada, no se podrán modificar los montos de la planilla. Solo es posible cambiar el estado a PAGADA o EN_CORRECCIÓN.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Digital signature */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PenTool className="h-4 w-4" /> Firma Digital
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
          </div>
        </div>
      )}
    </div>
  );
}
