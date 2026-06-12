'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Calendar, Loader2, RefreshCw, AlertCircle, Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface PayrollPeriodsProps {
  accessToken: string;
  userRole: string;
}

interface Planilla {
  id: string;
  codigo_planilla: string;
  tipo: string;
  estado: string;
  fecha_inicio_periodo: string;
  fecha_fin_periodo: string;
  total_empleados: number;
  total_salarios_brutos: number;
  total_neto_a_pagar: number;
  calculada_por: string | null;
  aprobada_por: string | null;
  fecha_calculo: string | null;
  fecha_aprobacion: string | null;
  observaciones: string | null;
  fecha_creacion: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  CALCULADA: 'bg-amber-100 text-amber-800',
  EN_CORRECCION: 'bg-orange-100 text-orange-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  PAGADA: 'bg-green-100 text-green-800',
};

const estadoLabels: Record<string, string> = {
  BORRADOR: 'Borrador',
  CALCULADA: 'Calculada',
  EN_CORRECCION: 'En Corrección',
  APROBADA: 'Aprobada',
  PAGADA: 'Pagada',
};

export default function PayrollPeriods({ accessToken }: PayrollPeriodsProps) {
  const { toast } = useToast();
  const [planillas, setPlanillas] = useState<Planilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTipo, setNewTipo] = useState('MENSUAL');
  const [newFechaInicio, setNewFechaInicio] = useState('');
  const [newFechaFin, setNewFechaFin] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nomina/planillas?limit=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al cargar planillas');
      const data = await res.json();
      setPlanillas(data.planillas || []);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudieron cargar las planillas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { fetchPlanillas(); }, [fetchPlanillas]);

  const handleCreate = async () => {
    if (!newFechaInicio || !newFechaFin) {
      toast({ title: 'Error', description: 'Complete las fechas del período', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/nomina/calcular', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoInicio: newFechaInicio, periodoFin: newFechaFin, tipo: newTipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear planilla');
      toast({ title: 'Planilla Calculada', description: `${data.planilla.codigo_planilla} — ${data.planilla.total_empleados} empleados, ${fmt(data.planilla.total_neto_a_pagar)}` });
      setShowNew(false);
      setNewFechaInicio('');
      setNewFechaFin('');
      fetchPlanillas();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al crear planilla', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // Current period: most recent CALCULADA or EN_CORRECCION
  const currentPeriod = planillas.find(p => ['CALCULADA', 'EN_CORRECCION'].includes(p.estado));

  return (
    <div className="space-y-4">
      {/* Current Period Card */}
      {currentPeriod && (
        <Card className="shadow-sm border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">Período en Progreso</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{currentPeriod.codigo_planilla}</h3>
                <p className="text-sm text-slate-600">
                  {new Date(currentPeriod.fecha_inicio_periodo).toLocaleDateString('es-SV')} — {new Date(currentPeriod.fecha_fin_periodo).toLocaleDateString('es-SV')}
                </p>
              </div>
              <div className="text-right space-y-2">
                <Badge className={estadoColors[currentPeriod.estado]} variant="secondary">
                  {estadoLabels[currentPeriod.estado] || currentPeriod.estado}
                </Badge>
                <p className="text-lg font-bold text-slate-900">{fmt(currentPeriod.total_neto_a_pagar)}</p>
                <p className="text-xs text-slate-500">{currentPeriod.total_empleados} empleados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Historial de Períodos</h3>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> Nuevo Período
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Período de Nómina</DialogTitle>
              <DialogDescription>Configure el período y ejecute el cálculo de nómina</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Tipo de Nómina</Label>
                <Select value={newTipo} onValueChange={setNewTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSUAL">Mensual</SelectItem>
                    <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha Inicio</Label>
                  <Input type="date" value={newFechaInicio} onChange={e => setNewFechaInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Fin</Label>
                  <Input type="date" value={newFechaFin} onChange={e => setNewFechaFin(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</> : 'Ejecutar Cálculo de Nómina'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Period history table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : planillas.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Calendar className="h-10 w-10 mx-auto mb-2" />
              <p className="text-sm">No hay planillas registradas</p>
              <p className="text-xs mt-1">Cree un nuevo período para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-slate-50/80">
                    <th className="text-left font-medium text-slate-500 p-3">Código</th>
                    <th className="text-left font-medium text-slate-500 p-3">Tipo</th>
                    <th className="text-left font-medium text-slate-500 p-3">Período</th>
                    <th className="text-left font-medium text-slate-500 p-3">Estado</th>
                    <th className="text-right font-medium text-slate-500 p-3">Neto</th>
                    <th className="text-right font-medium text-slate-500 p-3">Empleados</th>
                    <th className="text-left font-medium text-slate-500 p-3">Calculada por</th>
                  </tr>
                </thead>
                <tbody>
                  {planillas.map(p => (
                    <tr key={p.id} className="border-b hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-mono text-xs font-medium">{p.codigo_planilla}</td>
                      <td className="p-3">{p.tipo}</td>
                      <td className="p-3 text-xs">
                        {new Date(p.fecha_inicio_periodo).toLocaleDateString('es-SV')} — {new Date(p.fecha_fin_periodo).toLocaleDateString('es-SV')}
                      </td>
                      <td className="p-3">
                        <Badge className={`text-[10px] ${estadoColors[p.estado] || 'bg-slate-100 text-slate-700'}`} variant="secondary">
                          {estadoLabels[p.estado] || p.estado}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium">{fmt(p.total_neto_a_pagar)}</td>
                      <td className="p-3 text-right">{p.total_empleados}</td>
                      <td className="p-3 text-xs text-slate-500">{p.calculada_por || '-'}</td>
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
