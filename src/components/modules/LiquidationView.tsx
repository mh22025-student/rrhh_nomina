'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Plus, Loader2, BookOpen, ArrowLeft, Scale,
  AlertTriangle, CheckCircle, Download, X, Calculator
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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

const tipoLabels: Record<string, string> = {
  DESPEDO_INJUSTIFICADO: 'Despido Injustificado',
  RENUNCIA_VOLUNTARIA: 'Renuncia Voluntaria',
  DESPEDO_JUSTIFICADO: 'Despido Justificado',
  FIN_CONTRATO: 'Fin de Contrato',
};

const estadoColors: Record<string, string> = {
  CALCULADA: 'bg-amber-100 text-amber-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  PAGADA: 'bg-green-100 text-green-800',
};

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
  const [empleados, setEmpleados] = useState<Array<{ id: string; codigo: string; nombre: string }>>([]);

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

  const fetchEmpleados = useCallback(async () => {
    try {
      // Fetch from the planillas API as a proxy for employee list
      // In production this would be a dedicated employee API
      const res = await fetch('/api/nomina/planillas?limit=1', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      // For now, we'll use a simpler approach
    } catch {
      // ignore
    }
  }, [accessToken]);

  useEffect(() => { fetchLiquidaciones(); }, [fetchLiquidaciones]);

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Liquidaciones</h3>
        <Button onClick={() => setShowNew(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" /> Nueva Liquidación
        </Button>
      </div>

      {/* Legal references */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Scale className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <p><strong>Art. 58 CT — Despido Injustificado:</strong> Indemnización = 30 días/año (máx 4 años salario)</p>
              <p><strong>Ley 523 — Renuncia Voluntaria:</strong> Prestación económica = 15 días/año</p>
              <p>Ambos incluyen: Vacación proporcional (Art. 177 CT) + Aguinaldo proporcional (Arts. 196-202 CT)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liquidation detail dialog */}
      {showDetail && detailResult && (
        <Card className="shadow-sm border-emerald-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Detalle de Liquidación</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Total */}
            <div className="p-4 bg-emerald-50 rounded-lg text-center">
              <p className="text-sm text-emerald-700">Total de Liquidación</p>
              <p className="text-2xl font-bold text-emerald-800">{fmt(detailResult.liquidacion.total_liquidacion)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {tipoLabels[detailResult.liquidacion.tipo] || detailResult.liquidacion.tipo} — {detailResult.liquidacion.anios_servicio.toFixed(1)} años de servicio
              </p>
            </div>

            {/* Breakdown */}
            <div className="space-y-3">
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
                  <div key={key} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{labels[key] || key}</p>
                      <p className="text-sm font-bold">{fmt(val.monto)}</p>
                    </div>
                    {val.base_legal !== 'N/A' && (
                      <p className="text-xs text-slate-500"><strong>Base legal:</strong> {val.base_legal}</p>
                    )}
                    {val.formula !== 'No aplica' && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{val.formula}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New liquidation dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Liquidación</DialogTitle>
            <DialogDescription>Calcule la liquidación para un empleado</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>ID del Empleado</Label>
              <Input
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                placeholder="Ingrese el ID del empleado"
              />
              <p className="text-xs text-slate-400">En producción, esto será un selector con búsqueda</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Liquidación</Label>
              <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DESPEDO_INJUSTIFICADO">Despido Injustificado (Art. 58 CT)</SelectItem>
                  <SelectItem value="RENUNCIA_VOLUNTARIA">Renuncia Voluntaria (Ley 523)</SelectItem>
                  <SelectItem value="DESPEDO_JUSTIFICADO">Despido Justificado</SelectItem>
                  <SelectItem value="FIN_CONTRATO">Fin de Contrato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha de Liquidación</Label>
              <Input type="date" value={selectedFecha} onChange={e => setSelectedFecha(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
              Calcular Liquidación
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Liquidaciones table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : liquidaciones.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <ClipboardList className="h-10 w-10 mx-auto mb-2" />
              <p className="text-sm">No hay liquidaciones registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-slate-50/80">
                    <th className="text-left font-medium text-slate-500 p-3">Empleado</th>
                    <th className="text-left font-medium text-slate-500 p-3">Tipo</th>
                    <th className="text-right font-medium text-slate-500 p-3">Indemnización</th>
                    <th className="text-right font-medium text-slate-500 p-3">Vacación</th>
                    <th className="text-right font-medium text-slate-500 p-3">Aguinaldo</th>
                    <th className="text-right font-medium text-slate-500 p-3">Total</th>
                    <th className="text-left font-medium text-slate-500 p-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidaciones.map(l => (
                    <tr key={l.id} className="border-b hover:bg-slate-50/50 transition-colors">
                      <td className="p-3">
                        <p className="font-medium">{l.empleado_nombre}</p>
                        <p className="text-xs text-slate-400">{l.empleado_codigo} · {l.anios_servicio.toFixed(1)} años</p>
                      </td>
                      <td className="p-3 text-xs">{tipoLabels[l.tipo] || l.tipo}</td>
                      <td className="p-3 text-right">{l.indemnizacion > 0 || l.prestacion_economica > 0 ? fmt(l.indemnizacion || l.prestacion_economica) : '-'}</td>
                      <td className="p-3 text-right">{l.vacacion_proporcional > 0 ? fmt(l.vacacion_proporcional) : '-'}</td>
                      <td className="p-3 text-right">{l.aguinaldo_proporcional > 0 ? fmt(l.aguinaldo_proporcional) : '-'}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">{fmt(l.total_liquidacion)}</td>
                      <td className="p-3">
                        <Badge className={`text-[10px] ${estadoColors[l.estado] || 'bg-slate-100'}`} variant="secondary">
                          {l.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
