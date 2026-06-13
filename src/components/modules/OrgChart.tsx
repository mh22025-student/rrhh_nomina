'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitBranch, Plus, Edit2, Users, ChevronRight, ChevronDown, Loader2, Building2,
  Network, BarChart3, Link2, ChevronUp,
} from 'lucide-react';
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
  jefe?: { nombre: string; apellido: string } | null;
}

const levelColors: Record<number, { bg: string; border: string; accent: string; text: string; icon: string }> = {
  1: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', accent: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', icon: 'text-emerald-600 dark:text-emerald-400' },
  2: { bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800', accent: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', icon: 'text-teal-600 dark:text-teal-400' },
  3: { bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-800', accent: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300', icon: 'text-sky-600 dark:text-sky-400' },
  4: { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800', accent: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', icon: 'text-violet-600 dark:text-violet-400' },
};

function getLevelStyle(nivel: number) {
  return levelColors[nivel] || levelColors[4] || levelColors[3] || levelColors[2] || levelColors[1];
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
  const [highlightId, setHighlightId] = useState<string | null>(null);

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

  const expandAll = () => {
    setExpandedIds(new Set(areas.map(a => a.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set(areas.filter(a => !a.area_padre_id).map(a => a.id)));
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

  // Sidebar stats
  const sidebarStats = useMemo(() => {
    const totalAreas = areas.length;
    const maxDepth = areas.length > 0 ? Math.max(...areas.map(a => a.nivel)) : 0;
    const totalEmployees = areas.reduce((s, a) => s + a._count.empleados, 0);
    const levelDistribution: Record<number, { count: number; employees: number }> = {};
    areas.forEach(a => {
      if (!levelDistribution[a.nivel]) {
        levelDistribution[a.nivel] = { count: 0, employees: 0 };
      }
      levelDistribution[a.nivel].count++;
      levelDistribution[a.nivel].employees += a._count.empleados;
    });
    return { totalAreas, maxDepth, totalEmployees, levelDistribution };
  }, [areas]);

  const renderAreaNode = (area: Area, depth: number = 0) => {
    const children = getChildAreas(area.id);
    const isExpanded = expandedIds.has(area.id);
    const hasChildren = children.length > 0;
    const style = getLevelStyle(area.nivel);
    const isHighlighted = highlightId === area.id;

    return (
      <div key={area.id} className="ml-0">
        <div
          className="flex items-start gap-2 py-1.5"
          style={{ paddingLeft: `${depth * 28 + 8}px` }}
        >
          {/* Expand/collapse toggle */}
          <div className="flex items-center h-full pt-2">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(area.id)}
                className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${style.icon}`}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <div className="w-6 flex items-center justify-center">
                <span className={`w-1.5 h-1.5 rounded-full ${style.accent} opacity-50`} />
              </div>
            )}
          </div>

          {/* Node Card */}
          <div
            className={`flex-1 min-w-0 rounded-xl border ${style.border} ${style.bg} p-3 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${isHighlighted ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-1.5 rounded-lg ${style.accent} bg-opacity-20 shrink-0`}>
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate dark:text-slate-100">{area.nombre}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0 dark:border-slate-600 dark:text-slate-300">{area.codigo}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {area._count.empleados} empleados
                    </span>
                    <span>{area._count.perfiles_puesto} perfiles</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${style.bg} ${style.text} border ${style.border}`}>
                      Nivel {area.nivel}
                    </Badge>
                  </div>
                </div>
              </div>
              {canManage && (
                <div className="opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 dark:hover:bg-slate-700" onClick={() => openEdit(area)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 dark:hover:bg-slate-700" onClick={() => openCreate(area.id, area.nivel)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="relative">
            {/* Connection line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 rounded-full dark:opacity-30"
              style={{
                left: `${depth * 28 + 22}px`,
                background: `linear-gradient(to bottom, var(--tw-gradient-stops))`,
              }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-300 dark:bg-slate-600 rounded-full"
              style={{ left: `${depth * 28 + 22}px` }}
            />
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Organigrama</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Estructura organizacional de áreas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
            <ChevronDown className="h-4 w-4 mr-1" /> Expandir
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
            <ChevronUp className="h-4 w-4 mr-1" /> Colapsar
          </Button>
          {canManage && (
            <Button onClick={() => openCreate()} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
              <Plus className="h-4 w-4 mr-2" /> Nueva Área
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Area Stats Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 dark:text-slate-100">
                <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Estadísticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                  <Network className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Áreas</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{sidebarStats.totalAreas}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30">
                  <GitBranch className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Profundidad</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{sidebarStats.maxDepth} niveles</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-900/30">
                  <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Empleados</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{sidebarStats.totalEmployees}</p>
                </div>
              </div>

              {/* Level distribution */}
              {Object.keys(sidebarStats.levelDistribution).length > 0 && (
                <div className="pt-2 border-t dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Distribución por Nivel</p>
                  <div className="space-y-2">
                    {Object.entries(sidebarStats.levelDistribution)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([nivel, data]) => {
                        const pct = sidebarStats.totalEmployees > 0
                          ? (data.employees / sidebarStats.totalEmployees) * 100
                          : 0;
                        const s = getLevelStyle(Number(nivel));
                        return (
                          <div key={nivel}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className={`font-medium ${s.text}`}>Nivel {nivel}</span>
                              <span className="text-slate-500 dark:text-slate-400">{data.employees} emp · {data.count} áreas</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${s.accent} transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Quick navigation */}
              {areas.length > 0 && (
                <div className="pt-2 border-t dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Navegación Rápida
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {areas.map(a => (
                      <button
                        key={a.id}
                        className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setHighlightId(a.id);
                          // Expand all ancestors
                          const ancestorIds: string[] = [];
                          let current: Area | undefined = a;
                          while (current?.area_padre_id) {
                            ancestorIds.push(current.area_padre_id);
                            current = areas.find(ar => ar.id === current!.area_padre_id);
                          }
                          setExpandedIds(prev => {
                            const next = new Set(prev);
                            ancestorIds.forEach(id => next.add(id));
                            return next;
                          });
                          setTimeout(() => setHighlightId(null), 2000);
                        }}
                      >
                        <Building2 className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate dark:text-slate-300">{a.nombre}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Tree */}
        <div className="lg:col-span-3">
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 dark:text-slate-100">
                <GitBranch className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Árbol Organizacional
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full dark:bg-slate-700" />)}</div>
              ) : rootAreas.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Building2 className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm">No hay áreas configuradas</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {rootAreas.map((area) => renderAreaNode(area))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) { setShowCreateDialog(false); setShowEditDialog(false); setEditArea(null); }
      }}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
              <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {editArea ? 'Editar Área' : 'Nueva Área'}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">{editArea ? 'Modifique la información del área' : 'Complete la información para crear un área'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Código *</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} disabled={!!editArea} placeholder="Ej: DIR" className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del área" className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción opcional" rows={2} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Área Padre</Label>
              <Select value={form.area_padre_id || 'none'} onValueChange={(v) => setForm({ ...form, area_padre_id: v === 'none' ? '' : v })}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue placeholder="Sin padre (raíz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin padre (raíz)</SelectItem>
                  {areas.filter((a) => a.id !== editArea?.id).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre} ({a.codigo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Nivel</Label>
              <Input type="number" value={form.nivel} onChange={(e) => setForm({ ...form, nivel: parseInt(e.target.value) || 1 })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); setEditArea(null); }} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">Cancelar</Button>
              <Button onClick={editArea ? handleEdit : handleCreate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
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
