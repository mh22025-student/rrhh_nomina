'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Edit2, Loader2, AlertTriangle, Users } from 'lucide-react';
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Bandas Salariales</h2>
        <p className="text-sm text-slate-500">Gestión de rangos salariales por grado</p>
      </div>

      {/* Bar Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" /> Rangos Salariales por Grado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {bandas.map((banda) => (
                <div key={banda.id} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600 w-20 truncate">G{banda.grado} {banda.nombre}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-8 relative overflow-hidden">
                    {/* Full range bar */}
                    <div
                      className="absolute top-0 h-full bg-emerald-200 rounded-full"
                      style={{
                        left: `${(banda.salario_minimo / maxSalario) * 100}%`,
                        width: `${((banda.salario_maximo - banda.salario_minimo) / maxSalario) * 100}%`,
                      }}
                    />
                    {/* Mid point marker */}
                    <div
                      className="absolute top-0 h-full w-0.5 bg-emerald-700"
                      style={{ left: `${(banda.salario_medio / maxSalario) * 100}%` }}
                    />
                    {/* Min label */}
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-[10px] font-medium text-emerald-800"
                      style={{ left: `${(banda.salario_minimo / maxSalario) * 100 + 1}%` }}
                    >
                      ${banda.salario_minimo.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 w-24 text-right">${banda.salario_maximo.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-semibold text-slate-700">Grado</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Nombre</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Mínimo</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Medio</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Máximo</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Empleados</th>
                  {canEdit && <th className="text-center p-3 font-semibold text-slate-700">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={canEdit ? 7 : 6} className="p-3"><Skeleton className="h-5 w-full" /></td>
                    </tr>
                  ))
                ) : bandas.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="p-8 text-center text-slate-500">
                      No hay bandas salariales configuradas
                    </td>
                  </tr>
                ) : (
                  bandas.map((banda) => (
                    <tr key={banda.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono">G{banda.grado}</Badge>
                      </td>
                      <td className="p-3 font-medium">{banda.nombre}</td>
                      <td className="p-3 text-right">${banda.salario_minimo.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">${banda.salario_medio.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">${banda.salario_maximo.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Users className="h-3.5 w-3.5" /> {banda.num_empleados}
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
                  ))
                )}
              </tbody>
              {!loading && bandas.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={5} className="p-3 text-right">Total Empleados:</td>
                    <td className="p-3 text-center">{totalEmpleados}</td>
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
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Editar Banda Salarial - G{editBanda?.grado} {editBanda?.nombre}
            </DialogTitle>
            <DialogDescription>Modifique los valores salariales de la banda</DialogDescription>
          </DialogHeader>
          {editBanda && (
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  El salario mínimo de cualquier banda no puede ser inferior al salario mínimo legal vigente.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Salario Mínimo (USD)</Label>
                <Input type="number" step="0.01" value={editForm.salario_minimo} onChange={(e) => setEditForm({ ...editForm, salario_minimo: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Salario Medio (USD)</Label>
                <Input type="number" step="0.01" value={editForm.salario_medio} onChange={(e) => setEditForm({ ...editForm, salario_medio: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Salario Máximo (USD)</Label>
                <Input type="number" step="0.01" value={editForm.salario_maximo} onChange={(e) => setEditForm({ ...editForm, salario_maximo: parseFloat(e.target.value) || 0 })} />
              </div>
              {/* Preview bar */}
              <div className="bg-slate-100 rounded-full h-6 relative overflow-hidden">
                <div
                  className="absolute top-0 h-full bg-emerald-300 rounded-full"
                  style={{
                    left: `${(editForm.salario_minimo / maxSalario) * 100}%`,
                    width: `${Math.max(1, ((editForm.salario_maximo - editForm.salario_minimo) / maxSalario) * 100)}%`,
                  }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-emerald-700"
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
