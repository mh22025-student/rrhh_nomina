'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Edit2, Loader2, AlertTriangle, Users, Layers, TrendingUp, ArrowUpDown, Minus, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface SalaryBandsProps {
  accessToken: string;
  userRole: string;
}

interface Banda {
  id: string; grado: number; nombre: string;
  salario_minimo: number; salario_medio: number; salario_maximo: number;
  moneda: string; num_empleados: number;
  _count?: { perfiles_puesto: number };
}

// Band gradient colors - from light to dark per grade
const bandGradients = [
  { from: '#6ee7b7', to: '#047857' },  // emerald
  { from: '#5eead4', to: '#0f766e' },  // teal
  { from: '#67e8f9', to: '#0e7490' },  // cyan
  { from: '#7dd3fc', to: '#0369a1' },  // sky
  { from: '#fcd34d', to: '#b45309' },  // amber
  { from: '#fdba74', to: '#c2410c' },  // orange
  { from: '#fda4af', to: '#be123c' },  // rose
  { from: '#c4b5fd', to: '#6d28d9' },  // violet
];

export default function SalaryBands({ accessToken, userRole }: SalaryBandsProps) {
  const { toast } = useToast();
  const [bandas, setBandas] = useState<Banda[]>([]);
  const [loading, setLoading] = useState(true);
  const [editBanda, setEditBanda] = useState<Banda | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ salario_minimo: 0, salario_medio: 0, salario_maximo: 0 });

  const fetchBandas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bandas', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBandas(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchBandas(); }, [fetchBandas]);

  const handleEdit = (banda: Banda) => {
    setEditBanda(banda);
    setEditForm({
      salario_minimo: banda.salario_minimo,
      salario_medio: banda.salario_medio,
      salario_maximo: banda.salario_maximo,
    });
  };

  const handleSave = async () => {
    if (!editBanda) return;
    if (editForm.salario_minimo > editForm.salario_medio || editForm.salario_medio > editForm.salario_maximo) {
      toast({ title: 'Error', description: 'Los valores deben cumplir: mínimo ≤ medio ≤ máximo', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/bandas', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editBanda.id, ...editForm }),
      });
      if (res.ok) {
        toast({ title: 'Banda actualizada', description: 'Los valores salariales han sido actualizados' });
        setEditBanda(null);
        fetchBandas();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Error al actualizar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const canEdit = userRole === 'ADMIN' || userRole === 'APROBADOR';

  const totalEmpleados = bandas.reduce((s, b) => s + b.num_empleados, 0);
  const maxSalario = Math.max(...bandas.map((b) => b.salario_maximo), 1);
  const minSalarioGeneral = bandas.length > 0 ? Math.min(...bandas.map((b) => b.salario_minimo)) : 0;
  const maxSalarioGeneral = bandas.length > 0 ? Math.max(...bandas.map((b) => b.salario_maximo)) : 0;
  const amplitudSalarial = maxSalarioGeneral - minSalarioGeneral;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Bandas Salariales</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Gestión de rangos salariales por grado</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Bandas */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <Layers className="h-14 w-14" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Total Bandas</p>
          <p className="mt-1 text-2xl font-bold font-mono">{bandas.length}</p>
          <p className="text-xs opacity-80">configuradas</p>
        </div>

        {/* Salario Mínimo General */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <Minus className="h-14 w-14" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Salario Mín.</p>
          <p className="mt-1 text-2xl font-bold font-mono">${minSalarioGeneral.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs opacity-80">general mínimo</p>
        </div>

        {/* Salario Máximo General */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <Plus className="h-14 w-14" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Salario Máx.</p>
          <p className="mt-1 text-2xl font-bold font-mono">${maxSalarioGeneral.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs opacity-80">general máximo</p>
        </div>

        {/* Amplitud Salarial */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <ArrowUpDown className="h-14 w-14" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Amplitud</p>
          <p className="mt-1 text-2xl font-bold font-mono">${amplitudSalarial.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs opacity-80">salarial total</p>
        </div>
      </div>

      {/* Salary Range Comparison Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Comparación de Rangos Salariales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : bandas.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">No hay bandas salariales configuradas</p>
          ) : (
            <div className="space-y-3">
              {/* Scale header */}
              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0" />
                <div className="flex-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
                  <span>${(0).toLocaleString()}</span>
                  <span>${(maxSalario / 4).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  <span>${(maxSalario / 2).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  <span>${((maxSalario * 3) / 4).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  <span>${maxSalario.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
              {bandas.map((banda, idx) => {
                const gradient = bandGradients[idx % bandGradients.length];
                const leftPct = (banda.salario_minimo / maxSalario) * 100;
                const widthPct = ((banda.salario_maximo - banda.salario_minimo) / maxSalario) * 100;
                const avgPct = (banda.salario_medio / maxSalario) * 100;
                return (
                  <div key={banda.id} className="flex items-center gap-3">
                    <div className="w-28 shrink-0">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">G{banda.grado}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block" title={banda.nombre}>{banda.nombre}</span>
                    </div>
                    <div className="flex-1 relative h-10">
                      {/* Background grid line */}
                      <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 rounded-full" />
                      {/* Range bar with gradient */}
                      <div
                        className="absolute top-0 h-full rounded-full shadow-sm"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(widthPct, 1)}%`,
                          background: `linear-gradient(to right, ${gradient.from}, ${gradient.to})`,
                          opacity: 0.85,
                        }}
                      />
                      {/* Average marker */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-white shadow-sm"
                        style={{ left: `${avgPct}%`, zIndex: 5 }}
                      />
                      {/* Average label */}
                      <span
                        className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow-sm z-10"
                        style={{ left: `${avgPct}%`, transform: 'translate(-50%, -50%)' }}
                      >
                        ${banda.salario_medio.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                      {/* Min label */}
                      <span
                        className="absolute text-[9px] font-mono text-slate-500 dark:text-slate-400"
                        style={{ left: `${leftPct}%`, top: '-14px', transform: 'translateX(-50%)' }}
                      >
                        ${banda.salario_minimo.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                      {/* Max label */}
                      <span
                        className="absolute text-[9px] font-mono text-slate-500 dark:text-slate-400"
                        style={{ left: `${leftPct + widthPct}%`, bottom: '-14px', transform: 'translateX(-50%)' }}
                      >
                        ${banda.salario_maximo.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <DollarSign className="h-4 w-4 text-emerald-600" /> Detalle de Bandas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-800">
                  <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Grado</th>
                  <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Nombre</th>
                  <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Rango</th>
                  <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Mínimo</th>
                  <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Medio</th>
                  <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Máximo</th>
                  <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Empleados</th>
                  {canEdit && <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b dark:border-slate-700">
                      <td colSpan={canEdit ? 8 : 7} className="p-3"><Skeleton className="h-5 w-full" /></td>
                    </tr>
                  ))
                ) : bandas.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      No hay bandas salariales configuradas
                    </td>
                  </tr>
                ) : (
                  bandas.map((banda, idx) => {
                    const gradient = bandGradients[idx % bandGradients.length];
                    const rangePct = ((banda.salario_maximo - banda.salario_minimo) / maxSalario) * 100;
                    return (
                      <tr
                        key={banda.id}
                        className={`border-b transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:border-slate-700 ${
                          idx % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50/50 dark:bg-slate-800/50'
                        }`}
                      >
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono border-slate-300 dark:border-slate-600">G{banda.grado}</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
                            />
                            <span className="font-medium text-slate-900 dark:text-slate-100">{banda.nombre}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="w-20 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(rangePct, 3)}%`,
                                background: `linear-gradient(to right, ${gradient.from}, ${gradient.to})`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">${banda.salario_minimo.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100">${banda.salario_medio.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">${banda.salario_maximo.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Users className="h-3.5 w-3.5" />
                            <span className="font-mono">{banda.num_empleados}</span>
                          </span>
                        </td>
                        {canEdit && (
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(banda)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {!loading && bandas.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800 font-semibold border-t dark:border-slate-700">
                    <td colSpan={6} className="p-3 text-right text-slate-700 dark:text-slate-300">Total Empleados:</td>
                    <td className="p-3 text-center font-mono text-slate-900 dark:text-slate-100">{totalEmpleados}</td>
                    {canEdit && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editBanda} onOpenChange={(open) => !open && setEditBanda(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Editar Banda Salarial - G{editBanda?.grado} {editBanda?.nombre}
            </DialogTitle>
            <DialogDescription>Modifique los valores salariales de la banda</DialogDescription>
          </DialogHeader>
          {editBanda && (
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  El salario mínimo de cualquier banda no puede ser inferior al salario mínimo legal vigente.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Salario Mínimo (USD)</Label>
                <Input type="number" step="0.01" value={editForm.salario_minimo} onChange={(e) => setEditForm({ ...editForm, salario_minimo: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Salario Medio (USD)</Label>
                <Input type="number" step="0.01" value={editForm.salario_medio} onChange={(e) => setEditForm({ ...editForm, salario_medio: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Salario Máximo (USD)</Label>
                <Input type="number" step="0.01" value={editForm.salario_maximo} onChange={(e) => setEditForm({ ...editForm, salario_maximo: parseFloat(e.target.value) || 0 })} />
              </div>
              {/* Preview bar */}
              <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-6 relative overflow-hidden">
                <div
                  className="absolute top-0 h-full bg-emerald-300 dark:bg-emerald-700 rounded-full"
                  style={{
                    left: `${(editForm.salario_minimo / maxSalario) * 100}%`,
                    width: `${Math.max(1, ((editForm.salario_maximo - editForm.salario_minimo) / maxSalario) * 100)}%`,
                  }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-emerald-700 dark:bg-emerald-300"
                  style={{ left: `${(editForm.salario_medio / maxSalario) * 100}%` }}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditBanda(null)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
