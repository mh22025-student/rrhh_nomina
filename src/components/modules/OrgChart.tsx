'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Edit2, Users, ChevronRight, ChevronDown, Loader2, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface OrgChartProps {
  accessToken: string;
  userRole: string;
}

interface Area {
  id: string; nombre: string; codigo: string; descripcion: string | null;
  area_padre_id: string | null; nivel: number; activo: boolean;
  area_padre: { id: string; nombre: string; codigo: string } | null;
  areas_hijas: { id: string; nombre: string; codigo: string; nivel: number }[];
  _count: { empleados: number; perfiles_puesto: number };
}

export default function OrgChart({ accessToken, userRole }: OrgChartProps) {
  const { toast } = useToast();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editArea, setEditArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', codigo: '', descripcion: '', area_padre_id: '', nivel: 1 });

  const fetchAreas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/areas', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const rawData = await res.json();
        const areasList = Array.isArray(rawData) ? rawData : rawData.data || [];
        setAreas(areasList);
        // Auto-expand root level
        const rootIds = new Set(areasList.filter((a: Area) => !a.area_padre_id).map((a: Area) => a.id));
        setExpandedIds(rootIds);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!form.nombre || !form.codigo) {
      toast({ title: 'Error', description: 'Nombre y código son requeridos', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/areas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast({ title: 'Área creada', description: 'El área ha sido creada exitosamente' });
        setShowCreateDialog(false);
        setForm({ nombre: '', codigo: '', descripcion: '', area_padre_id: '', nivel: 1 });
        fetchAreas();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editArea) return;
    setSaving(true);
    try {
      const res = await fetch('/api/areas', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editArea.id, nombre: form.nombre, descripcion: form.descripcion, area_padre_id: form.area_padre_id || null, nivel: form.nivel }),
      });
      if (res.ok) {
        toast({ title: 'Área actualizada', description: 'El área ha sido actualizada' });
        setShowEditDialog(false);
        setEditArea(null);
        fetchAreas();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (area: Area) => {
    setEditArea(area);
    setForm({
      nombre: area.nombre,
      codigo: area.codigo,
      descripcion: area.descripcion || '',
      area_padre_id: area.area_padre_id || '',
      nivel: area.nivel,
    });
    setShowEditDialog(true);
  };

  const openCreate = (parentId?: string, parentNivel?: number) => {
    setForm({ nombre: '', codigo: '', descripcion: '', area_padre_id: parentId || '', nivel: (parentNivel || 0) + 1 });
    setShowCreateDialog(true);
  };

  const canManage = userRole === 'ADMIN';

  // Build tree structure
  const rootAreas = areas.filter((a) => !a.area_padre_id);
  const getChildAreas = (parentId: string) => areas.filter((a) => a.area_padre_id === parentId);

  const renderAreaNode = (area: Area, depth: number = 0) => {
    const children = getChildAreas(area.id);
    const isExpanded = expandedIds.has(area.id);
    const hasChildren = children.length > 0;

    return (
      <div key={area.id} className="ml-0">
        <div
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded-lg transition-colors group"
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          {hasChildren ? (
            <button onClick={() => toggleExpand(area.id)} className="p-0.5 hover:bg-slate-200 rounded">
              {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div className="flex items-center gap-2 bg-white border rounded-lg p-2 shadow-sm flex-1 min-w-0">
            <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{area.nombre}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{area.codigo}</Badge>
                <Badge variant="secondary" className="text-[10px] shrink-0">N{area.nivel}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {area._count.empleados}</span>
                <span>{area._count.perfiles_puesto} perfiles</span>
              </div>
            </div>
            {canManage && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(area)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openCreate(area.id, area.nivel)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="relative">
            {/* Connection lines */}
            <div className="absolute top-0 bottom-0 border-l-2 border-slate-200" style={{ left: `${depth * 24 + 20}px` }} />
            {children.map((child) => renderAreaNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Organigrama</h2>
          <p className="text-sm text-slate-500">Estructura organizacional de áreas</p>
        </div>
        {canManage && (
          <Button onClick={() => openCreate()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" /> Nueva Área
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-500">Total Áreas</p>
            <p className="text-xl font-bold">{areas.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-500">Niveles</p>
            <p className="text-xl font-bold">{areas.length > 0 ? Math.max(...areas.map((a) => a.nivel)) : 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-500">Total Empleados</p>
            <p className="text-xl font-bold">{areas.reduce((s, a) => s + a._count.empleados, 0)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-500">Perfiles</p>
            <p className="text-xl font-bold">{areas.reduce((s, a) => s + a._count.perfiles_puesto, 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tree */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-emerald-600" /> Árbol Organizacional
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : rootAreas.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Building2 className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No hay áreas configuradas</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {rootAreas.map((area) => renderAreaNode(area))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) { setShowCreateDialog(false); setShowEditDialog(false); setEditArea(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              {editArea ? 'Editar Área' : 'Nueva Área'}
            </DialogTitle>
            <DialogDescription>{editArea ? 'Modifique la información del área' : 'Complete la información para crear un área'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} disabled={!!editArea} placeholder="Ej: DIR" />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del área" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción opcional" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Área Padre</Label>
              <Select value={form.area_padre_id || 'none'} onValueChange={(v) => setForm({ ...form, area_padre_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sin padre (raíz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin padre (raíz)</SelectItem>
                  {areas.filter((a) => a.id !== editArea?.id).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre} ({a.codigo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nivel</Label>
              <Input type="number" value={form.nivel} onChange={(e) => setForm({ ...form, nivel: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); setEditArea(null); }}>Cancelar</Button>
              <Button onClick={editArea ? handleEdit : handleCreate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editArea ? 'Guardar' : 'Crear Área'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
