'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  GitBranch, Plus, Edit2, Users, ChevronRight, ChevronDown, Loader2, Building2,
  Network, BarChart3, Link2, ChevronUp, Search, X, User, DollarSign,
  Briefcase, LayoutGrid, List, Eye, ZoomIn, ZoomOut, Maximize2,
  AlertTriangle, TrendingUp, PieChart, Info,
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
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface OrgChartProps {
  accessToken: string;
  userRole: string;
}

interface Employee {
  id: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  puesto: string | null;
  salario_base: number | null;
  estado: string;
  empleado_code: string;
  codigo_empleado?: string;
  perfil_puesto?: { nombre_puesto: string } | null;
}

interface JobProfile {
  id: string;
  codigo: string;
  nombre_puesto: string;
  estado: string;
  banda_salarial?: { nombre: string; salario_minimo: number; salario_maximo: number } | null;
}

interface Area {
  id: string; nombre: string; codigo: string; descripcion: string | null;
  area_padre_id: string | null; nivel: number; activo: boolean;
  area_padre: { id: string; nombre: string; codigo: string } | null;
  areas_hijas: { id: string; nombre: string; codigo: string; nivel: number }[];
  _count: { empleados: number; perfiles_puesto: number };
  jefe?: { nombre: string; apellido: string } | null;
}

const levelColors: Record<number, { bg: string; border: string; accent: string; text: string; icon: string; gradient: string }> = {
  1: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', accent: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', icon: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500 to-emerald-600' },
  2: { bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800', accent: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', icon: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500 to-teal-600' },
  3: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800', accent: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', icon: 'text-cyan-600 dark:text-cyan-400', gradient: 'from-cyan-500 to-cyan-600' },
  4: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', accent: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500 to-amber-600' },
};

function getLevelStyle(nivel: number) {
  return levelColors[nivel] || levelColors[4] || levelColors[3] || levelColors[2] || levelColors[1];
}

function getInitials(nombre: string, apellido: string): string {
  return (nombre.charAt(0) + apellido.charAt(0)).toUpperCase();
}

function formatSalary(amount: number | null): string {
  if (amount === null) return 'N/A';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [areaEmployees, setAreaEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const treeRef = useRef<HTMLDivElement>(null);

  // New state for enhanced features
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [popoverAreaId, setPopoverAreaId] = useState<string | null>(null);
  const [popoverEmployees, setPopoverEmployees] = useState<Employee[]>([]);
  const [loadingPopover, setLoadingPopover] = useState(false);
  const [detailArea, setDetailArea] = useState<Area | null>(null);
  const [detailEmployees, setDetailEmployees] = useState<Employee[]>([]);
  const [detailProfiles, setDetailProfiles] = useState<JobProfile[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [collapsedTreeNodes, setCollapsedTreeNodes] = useState<Set<string>>(new Set());
  const treeContainerRef = useRef<HTMLDivElement>(null);

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

  const fetchAreaEmployees = useCallback(async (areaId: string) => {
    setLoadingEmployees(true);
    try {
      const res = await fetch(`/api/empleados?area_id=${areaId}&pageSize=100`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const empList = Array.isArray(data) ? data : data.data || [];
        setAreaEmployees(empList);
      }
    } catch (err) {
      console.error(err);
      setAreaEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }, [accessToken]);

  const fetchPopoverEmployees = useCallback(async (areaId: string) => {
    setLoadingPopover(true);
    try {
      const res = await fetch(`/api/empleados?area_id=${areaId}&pageSize=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPopoverEmployees(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      setPopoverEmployees([]);
    } finally {
      setLoadingPopover(false);
    }
  }, [accessToken]);

  const fetchAreaDetail = useCallback(async (area: Area) => {
    setDetailArea(area);
    setLoadingDetail(true);
    try {
      const [empRes, profRes] = await Promise.all([
        fetch(`/api/empleados?area_id=${area.id}&pageSize=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`/api/perfiles-puesto?area_id=${area.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      if (empRes.ok) {
        const empData = await empRes.json();
        setDetailEmployees(Array.isArray(empData) ? empData : empData.data || []);
      }
      if (profRes.ok) {
        const profData = await profRes.json();
        setDetailProfiles(Array.isArray(profData) ? profData : profData.data || []);
      }
    } catch {
      setDetailEmployees([]);
      setDetailProfiles([]);
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken]);

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

  const handleSelectArea = (area: Area) => {
    if (selectedArea?.id === area.id) {
      setSelectedArea(null);
      setAreaEmployees([]);
    } else {
      setSelectedArea(area);
      fetchAreaEmployees(area.id);
    }
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

  const rootAreas = areas.filter((a) => !a.area_padre_id);
  const getChildAreas = (parentId: string) => areas.filter((a) => a.area_padre_id === parentId);

  // Enhanced statistics
  const stats = useMemo(() => {
    const totalAreas = areas.length;
    const maxDepth = areas.length > 0 ? Math.max(...areas.map(a => a.nivel)) : 0;
    const totalEmployees = areas.reduce((s, a) => s + a._count.empleados, 0);
    const levelDistribution: Record<number, { count: number; employees: number; avgSalary: number }> = {};
    const vacancyAreas = areas.filter(a => a._count.empleados === 0);

    // Calculate average salary per level (we need to estimate from areas data)
    areas.forEach(a => {
      if (!levelDistribution[a.nivel]) {
        levelDistribution[a.nivel] = { count: 0, employees: 0, avgSalary: 0 };
      }
      levelDistribution[a.nivel].count++;
      levelDistribution[a.nivel].employees += a._count.empleados;
    });

    return { totalAreas, maxDepth, totalEmployees, levelDistribution, vacancyAreas, vacancyCount: vacancyAreas.length };
  }, [areas]);

  // Search filter
  const filteredAreas = useMemo(() => {
    if (!searchQuery.trim()) return areas;
    const q = searchQuery.toLowerCase();
    return areas.filter(a =>
      a.nombre.toLowerCase().includes(q) ||
      a.codigo.toLowerCase().includes(q) ||
      a.descripcion?.toLowerCase().includes(q)
    );
  }, [areas, searchQuery]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(
      areas
        .filter(a => a.nombre.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q))
        .map(a => a.id)
    );
  }, [areas, searchQuery]);

  const handleSearchSelect = (areaId: string) => {
    setHighlightId(areaId);
    const area = areas.find(a => a.id === areaId);
    if (area) {
      const ancestorIds: string[] = [];
      let current: Area | undefined = area;
      while (current?.area_padre_id) {
        ancestorIds.push(current.area_padre_id);
        current = areas.find(ar => ar.id === current!.area_padre_id);
      }
      setExpandedIds(prev => {
        const next = new Set(prev);
        ancestorIds.forEach(id => next.add(id));
        return next;
      });
    }
    setTimeout(() => setHighlightId(null), 3000);
  };

  // Employee panel stats
  const employeePanelStats = useMemo(() => {
    if (areaEmployees.length === 0) return null;
    const activeCount = areaEmployees.filter(e => e.estado === 'ACTIVO').length;
    const totalSalary = areaEmployees.reduce((s, e) => s + (e.salario_base || 0), 0);
    const avgSalary = totalSalary / areaEmployees.length;
    return { activeCount, totalSalary, avgSalary, count: areaEmployees.length };
  }, [areaEmployees]);

  // Detail dialog budget summary
  const detailBudget = useMemo(() => {
    if (detailEmployees.length === 0) return null;
    const totalSalary = detailEmployees.reduce((s, e) => s + (e.salario_base || 0), 0);
    const avgSalary = totalSalary / detailEmployees.length;
    const maxSalary = Math.max(...detailEmployees.map(e => e.salario_base || 0));
    const minSalary = Math.min(...detailEmployees.filter(e => e.salario_base && e.salario_base > 0).map(e => e.salario_base || 0));
    return { totalSalary, avgSalary, maxSalary, minSalary: minSalary === -Infinity ? 0 : minSalary };
  }, [detailEmployees]);

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.15, 2));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.15, 0.3));
  const handleFitToScreen = () => {
    setZoomLevel(1);
    if (treeContainerRef.current) {
      treeContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  // Donut chart data for headcount distribution
  const donutData = useMemo(() => {
    const levels = Object.entries(stats.levelDistribution).sort(([a], [b]) => Number(a) - Number(b));
    if (levels.length === 0) return { gradient: 'conic-gradient(#e2e8f0 0% 100%)', segments: [] };

    const colors = ['#10b981', '#14b8a6', '#06b6d4', '#f59e0b', '#8b5cf6', '#f43f5e'];
    let cumulative = 0;
    const segments: { level: string; pct: number; color: string; employees: number }[] = [];
    const gradientParts: string[] = [];

    levels.forEach(([nivel, data], idx) => {
      const pct = stats.totalEmployees > 0 ? (data.employees / stats.totalEmployees) * 100 : 0;
      const color = colors[idx % colors.length];
      segments.push({ level: nivel, pct, color, employees: data.employees });
      gradientParts.push(`${color} ${cumulative}% ${cumulative + pct}%`);
      cumulative += pct;
    });

    return {
      gradient: `conic-gradient(${gradientParts.join(', ')})`,
      segments,
    };
  }, [stats]);

  // Toggle tree node collapse
  const toggleTreeNode = (id: string) => {
    setCollapsedTreeNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ==================== VISUAL TREE RENDERING ====================
  const renderVisualTreeNode = (area: Area) => {
    const children = getChildAreas(area.id);
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedTreeNodes.has(area.id);
    const style = getLevelStyle(area.nivel);
    const isHighlighted = highlightId === area.id;
    const isSearchMatch = searchMatches.has(area.id);
    const isVacancy = area._count.empleados === 0;

    return (
      <div key={area.id} className="flex flex-col items-center">
        {/* Node Card */}
        <div
          className={`
            relative rounded-xl border-2 ${style.border} ${style.bg} shadow-md
            transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer
            min-w-[160px] max-w-[220px]
            ${isHighlighted ? 'ring-4 ring-emerald-400 ring-offset-2 dark:ring-offset-slate-900 animate-pulse' : ''}
            ${isSearchMatch ? 'ring-4 ring-teal-400 ring-offset-2 dark:ring-offset-slate-900 shadow-lg shadow-teal-200/50 dark:shadow-teal-800/30' : ''}
            ${isVacancy ? 'animate-pulse border-amber-300 dark:border-amber-700' : ''}
          `}
          onClick={(e) => {
            e.stopPropagation();
            setPopoverAreaId(popoverAreaId === area.id ? null : area.id);
            fetchPopoverEmployees(area.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            fetchAreaDetail(area);
          }}
        >
          {/* Gradient Header */}
          <div className={`h-2 rounded-t-xl bg-gradient-to-r ${style.gradient}`} />

          <div className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`p-1 rounded-md bg-gradient-to-br ${style.gradient} shrink-0 shadow-sm`}>
                <Building2 className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold truncate dark:text-slate-100 leading-tight">{area.nombre}</span>
            </div>

            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] shrink-0 dark:border-slate-600 dark:text-slate-300">{area.codigo}</Badge>
              <Badge className={`text-[9px] px-1.5 py-0 bg-gradient-to-r ${style.gradient} text-white border-0`}>
                N{area.nivel}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {area._count.empleados}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {area._count.perfiles_puesto}
              </span>
            </div>

            {area.jefe && (
              <div className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate">
                <User className="h-2.5 w-2.5 shrink-0" />
                {area.jefe.nombre} {area.jefe.apellido}
              </div>
            )}

            {isVacancy && (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                <AlertTriangle className="h-2.5 w-2.5" />
                Sin personal
              </div>
            )}

            {/* Admin buttons */}
            {canManage && (
              <div className="mt-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity" style={{ opacity: undefined }}>
                <button
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  onClick={(e) => { e.stopPropagation(); openEdit(area); }}
                >
                  <Edit2 className="h-2.5 w-2.5 text-slate-400" />
                </button>
                <button
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  onClick={(e) => { e.stopPropagation(); openCreate(area.id, area.nivel); }}
                >
                  <Plus className="h-2.5 w-2.5 text-slate-400" />
                </button>
              </div>
            )}
          </div>

          {/* Employee Popover */}
          <Popover open={popoverAreaId === area.id} onOpenChange={(open) => { if (!open) setPopoverAreaId(null); }}>
            <PopoverTrigger asChild>
              <span className="absolute inset-0" />
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 dark:bg-slate-900 dark:border-slate-700" side="right" align="start">
              <div className={`px-3 py-2 bg-gradient-to-r ${style.gradient} rounded-t-md`}>
                <p className="text-sm font-semibold text-white truncate">{area.nombre}</p>
                <p className="text-[10px] text-white/80">{area.codigo} · Nivel {area.nivel}</p>
              </div>
              <div className="p-3">
                {loadingPopover ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full dark:bg-slate-700" />)}
                  </div>
                ) : popoverEmployees.length === 0 ? (
                  <div className="text-center py-3 text-slate-400 dark:text-slate-500">
                    <Users className="h-6 w-6 mx-auto mb-1" />
                    <p className="text-xs">Sin empleados asignados</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                    {popoverEmployees.slice(0, 20).map(emp => {
                      const fullName = `${emp.primer_nombre} ${emp.segundo_nombre || ''} ${emp.primer_apellido} ${emp.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim();
                      const isActive = emp.estado === 'ACTIVO';
                      return (
                        <div key={emp.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                            {getInitials(emp.primer_nombre, emp.primer_apellido)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate dark:text-slate-200">{fullName}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                              {emp.perfil_puesto?.nombre_puesto || emp.puesto || 'Sin puesto'}
                            </p>
                          </div>
                          <Badge className={`text-[8px] px-1 py-0 ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}>
                            {emp.estado}
                          </Badge>
                        </div>
                      );
                    })}
                    {popoverEmployees.length > 20 && (
                      <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 pt-1">
                        +{popoverEmployees.length - 20} más... doble clic para ver todos
                      </p>
                    )}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Connecting lines and children */}
        {hasChildren && !isCollapsed && (
          <>
            {/* Vertical line from parent down */}
            <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />

            {/* Children row with horizontal connector */}
            <div className="relative">
              {/* Horizontal connector line spanning all children */}
              {children.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600"
                  style={{
                    left: '50%',
                    right: '50%',
                    transform: 'translateX(-50%)',
                    width: `${Math.max(0, children.length - 1) * 200}px`,
                  }}
                />
              )}

              <div className="flex gap-6 justify-center">
                {children.map((child) => (
                  <div key={child.id} className="flex flex-col items-center">
                    {/* Vertical line up to horizontal connector */}
                    <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />
                    {renderVisualTreeNode(child)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Collapsed indicator */}
        {hasChildren && isCollapsed && (
          <>
            <div className="w-0.5 h-4 bg-slate-300 dark:bg-slate-600" />
            <button
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              onClick={(e) => { e.stopPropagation(); toggleTreeNode(area.id); }}
            >
              <ChevronRight className="h-3 w-3" />
              {children.length} sub{children.length > 1 ? 'áreas' : 'área'}
            </button>
          </>
        )}

        {/* Expand button for collapsed nodes */}
        {hasChildren && !isCollapsed && (
          <button
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm"
            onClick={(e) => { e.stopPropagation(); toggleTreeNode(area.id); }}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  // ==================== LIST TREE RENDERING (original) ====================
  const renderAreaNode = (area: Area, depth: number = 0) => {
    const children = getChildAreas(area.id);
    const isExpanded = expandedIds.has(area.id);
    const hasChildren = children.length > 0;
    const style = getLevelStyle(area.nivel);
    const isHighlighted = highlightId === area.id;
    const isSearchMatch = searchMatches.has(area.id);
    const isSelected = selectedArea?.id === area.id;

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
            className={`group flex-1 min-w-0 rounded-xl border ${style.border} ${style.bg} p-3 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer
              ${isHighlighted ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-900' : ''}
              ${isSearchMatch ? 'ring-2 ring-teal-400 ring-offset-1 dark:ring-offset-slate-900' : ''}
              ${isSelected ? 'ring-2 ring-emerald-500 shadow-md' : ''}
            `}
            onClick={() => handleSelectArea(area)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${style.gradient} shrink-0 shadow-sm`}>
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate dark:text-slate-100">{area.nombre}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0 dark:border-slate-600 dark:text-slate-300">{area.codigo}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <Badge className={`text-[10px] px-1.5 py-0 ${style.bg} ${style.text} border ${style.border}`}>
                        {area._count.empleados}
                      </Badge>
                      empleados
                    </span>
                    <span>{area._count.perfiles_puesto} perfiles</span>
                    <Badge className={`text-[10px] px-1.5 py-0 bg-gradient-to-r ${style.gradient} text-white border-0`}>
                      Nivel {area.nivel}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {canManage && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity dark:hover:bg-slate-700" onClick={(e) => { e.stopPropagation(); openEdit(area); }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity dark:hover:bg-slate-700" onClick={(e) => { e.stopPropagation(); openCreate(area.id, area.nivel); }}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 dark:hover:bg-slate-700" onClick={(e) => { e.stopPropagation(); handleSelectArea(area); }}>
                  <Eye className="h-3 w-3 text-slate-400" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="relative">
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-300 dark:bg-slate-600 rounded-full"
              style={{ left: `${depth * 28 + 22}px` }}
            />
            {children.map((child) => (
              <div key={child.id} className="relative">
                <div
                  className="absolute top-5 h-0.5 bg-slate-300 dark:bg-slate-600"
                  style={{ left: `${depth * 28 + 22}px`, width: '8px' }}
                />
                {renderAreaNode(child, depth + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Gradient Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZ2LTZoNnptMC0zMHY2aC02VjRoNnptMCAxMHY2aC02di02aDZ6bTAgMTB2NmgtNnYtNmg2em0tMTAgMHY2aC02di02aDZ6bTAtMTB2NmgtNnYtNmg2em0tMTAgMHY2aC02di02aDZ6bTAtMTB2NmgtNnYtNmg2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Network className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Organigrama Institucional</h2>
              </div>
              <p className="text-emerald-100 text-sm mt-1">Estructura organizacional y jerarquía de áreas</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* View Mode Toggle */}
              <div className="flex rounded-lg overflow-hidden border border-white/30">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'tree' ? 'bg-white/30 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                >
                  <LayoutGrid className="h-3 w-3" /> Diagrama
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'list' ? 'bg-white/30 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                >
                  <List className="h-3 w-3" /> Lista
                </button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={expandAll}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
              >
                <ChevronDown className="h-4 w-4 mr-1" /> Expandir
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={collapseAll}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
              >
                <ChevronUp className="h-4 w-4 mr-1" /> Colapsar
              </Button>
              {canManage && (
                <Button
                  onClick={() => openCreate()}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-2" /> Nueva Área
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== STATISTICS DASHBOARD ==================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 dark:bg-slate-900 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shrink-0">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Total Áreas</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.totalAreas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-teal-200 dark:border-teal-800 dark:bg-slate-900 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 to-teal-600" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-md shrink-0">
              <GitBranch className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Niveles</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.maxDepth}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-cyan-200 dark:border-cyan-800 dark:bg-slate-900 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-cyan-600" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-md shrink-0">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Empleados</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.totalEmployees}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-amber-200 dark:border-amber-800 dark:bg-slate-900 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-md shrink-0">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Vacantes</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.vacancyCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Areas by Level - Horizontal Bar */}
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2 dark:text-slate-100">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Áreas por Nivel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(stats.levelDistribution)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([nivel, data]) => {
                const pct = stats.totalAreas > 0 ? (data.count / stats.totalAreas) * 100 : 0;
                const s = getLevelStyle(Number(nivel));
                return (
                  <div key={nivel}>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className={`font-medium ${s.text}`}>Nivel {nivel}</span>
                      <span className="text-slate-500 dark:text-slate-400">{data.count} áreas</span>
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${s.gradient} transition-all duration-700`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {/* Headcount Distribution - CSS Donut */}
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2 dark:text-slate-100">
              <PieChart className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> Distribución Headcount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div
                  className="w-24 h-24 rounded-full shadow-inner"
                  style={{ background: donutData.gradient }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                    <span className="text-xs font-bold dark:text-slate-100">{stats.totalEmployees}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                {donutData.segments.map((seg) => {
                  const s = getLevelStyle(Number(seg.level));
                  return (
                    <div key={seg.level} className="flex items-center gap-2 text-[10px]">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className={`font-medium ${s.text} truncate`}>Nivel {seg.level}</span>
                      <span className="text-slate-400 dark:text-slate-500 ml-auto">{seg.employees}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vacancy List & Quick Info */}
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2 dark:text-slate-100">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Áreas Vacantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.vacancyAreas.length === 0 ? (
              <div className="text-center py-4 text-slate-400 dark:text-slate-500">
                <Users className="h-8 w-8 mx-auto mb-1" />
                <p className="text-xs">Todas las áreas tienen personal</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                {stats.vacancyAreas.map(a => {
                  const s = getLevelStyle(a.nivel);
                  return (
                    <button
                      key={a.id}
                      className="w-full text-left flex items-center gap-2 p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors border border-amber-100 dark:border-amber-900/30"
                      onClick={() => handleSearchSelect(a.id)}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${s.accent} shrink-0 animate-pulse`} />
                      <span className="text-xs truncate dark:text-slate-300 flex-1">{a.nombre}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0 dark:border-slate-700 dark:text-slate-400">{a.codigo}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
            <Separator className="my-2 dark:bg-slate-800" />
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.levelDistribution)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([nivel, data]) => {
                  const s = getLevelStyle(Number(nivel));
                  return (
                    <div key={nivel} className="text-center p-1.5 rounded-md bg-slate-50 dark:bg-slate-800">
                      <p className={`text-[9px] font-medium ${s.text}`}>Nivel {nivel}</p>
                      <p className="text-xs font-bold dark:text-slate-200">{data.employees} emp</p>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar área o código... (resaltará nodos coincidentes)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setHighlightId(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchQuery && searchMatches.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from(searchMatches).map(id => {
                const area = areas.find(a => a.id === id);
                if (!area) return null;
                return (
                  <button
                    key={id}
                    onClick={() => handleSearchSelect(id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                  >
                    <Building2 className="h-3 w-3" />
                    {area.nombre} ({area.codigo})
                  </button>
                );
              })}
            </div>
          )}
          {searchQuery && searchMatches.size === 0 && areas.length > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No se encontraron áreas que coincidan con &ldquo;{searchQuery}&rdquo;</p>
          )}
        </CardContent>
      </Card>

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
              {/* Level distribution */}
              {Object.keys(stats.levelDistribution).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Distribución por Nivel</p>
                  <div className="space-y-2">
                    {Object.entries(stats.levelDistribution)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([nivel, data]) => {
                        const pct = stats.totalEmployees > 0
                          ? (data.employees / stats.totalEmployees) * 100
                          : 0;
                        const s = getLevelStyle(Number(nivel));
                        return (
                          <div key={nivel}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className={`font-medium ${s.text}`}>Nivel {nivel}</span>
                              <span className="text-slate-500 dark:text-slate-400">{data.employees} emp · {data.count} áreas</span>
                            </div>
                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full bg-gradient-to-r ${s.gradient} transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <Separator className="dark:bg-slate-800" />

              {/* Quick navigation */}
              {areas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Navegación Rápida
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {areas.map(a => {
                      const s = getLevelStyle(a.nivel);
                      return (
                        <button
                          key={a.id}
                          className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                          onClick={() => handleSearchSelect(a.id)}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${s.accent} shrink-0`} />
                          <span className="truncate dark:text-slate-300">{a.nombre}</span>
                          <Badge variant="outline" className="text-[9px] ml-auto shrink-0 dark:border-slate-700 dark:text-slate-400">{a._count.empleados}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Tree */}
        <div className={selectedArea ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 dark:text-slate-100">
                  <GitBranch className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {viewMode === 'tree' ? 'Diagrama Organizacional' : 'Árbol Organizacional'}
                </CardTitle>
                {viewMode === 'tree' && (
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 dark:bg-slate-800 dark:border-slate-700" onClick={handleZoomOut} title="Alejar">
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[3rem] text-center">{Math.round(zoomLevel * 100)}%</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 dark:bg-slate-800 dark:border-slate-700" onClick={handleZoomIn} title="Acercar">
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 dark:bg-slate-800 dark:border-slate-700 text-xs" onClick={handleFitToScreen} title="Ajustar a pantalla">
                      <Maximize2 className="h-3 w-3 mr-1" /> Ajustar
                    </Button>
                  </div>
                )}
              </div>
              {viewMode === 'tree' && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
                  <Info className="h-3 w-3" />
                  Clic para ver empleados · Doble clic para detalle completo · Scroll para navegar
                </p>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full dark:bg-slate-700" />)}</div>
              ) : rootAreas.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Building2 className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm">No hay áreas configuradas</p>
                </div>
              ) : viewMode === 'tree' ? (
                /* ==================== VISUAL TREE VIEW ==================== */
                <div
                  ref={treeContainerRef}
                  className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-950/50"
                  style={{ minHeight: '300px', maxHeight: '600px' }}
                >
                  <div
                    className="inline-flex min-w-full p-8 transition-transform duration-200 origin-top-left"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                  >
                    <div className="flex flex-col items-center gap-0 mx-auto">
                      {rootAreas.map((area, idx) => (
                        <React.Fragment key={area.id}>
                          {idx > 0 && <div className="w-0.5 h-4 bg-slate-300 dark:bg-slate-600" />}
                          {renderVisualTreeNode(area)}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* ==================== LIST TREE VIEW (original) ==================== */
                <div className="space-y-1.5" ref={treeRef}>
                  {rootAreas.map((area) => renderAreaNode(area))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Employee List Panel */}
        {selectedArea && (
          <div className="lg:col-span-1">
            <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800 sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2 dark:text-slate-100">
                    <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    {selectedArea.nombre}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 dark:hover:bg-slate-800"
                    onClick={() => { setSelectedArea(null); setAreaEmployees([]); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] dark:border-slate-700 dark:text-slate-400">{selectedArea.codigo}</Badge>
                  <Badge className={`text-[10px] bg-gradient-to-r ${getLevelStyle(selectedArea.nivel).gradient} text-white border-0`}>
                    Nivel {selectedArea.nivel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedArea.descripcion && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedArea.descripcion}</p>
                )}

                {/* Area summary */}
                {employeePanelStats && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Activos</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{employeePanelStats.activeCount}</p>
                    </div>
                    <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Total Sal.</p>
                      <p className="text-sm font-bold text-teal-700 dark:text-teal-300">{formatSalary(employeePanelStats.totalSalary)}</p>
                    </div>
                    <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Promedio</p>
                      <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300">{formatSalary(employeePanelStats.avgSalary)}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Total</p>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{employeePanelStats.count}</p>
                    </div>
                  </div>
                )}

                <Separator className="dark:bg-slate-800" />

                {/* Employee list */}
                {loadingEmployees ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full dark:bg-slate-700" />)}
                  </div>
                ) : areaEmployees.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 dark:text-slate-500">
                    <Users className="h-8 w-8 mx-auto mb-1" />
                    <p className="text-xs">No hay empleados en esta área</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                    {areaEmployees.map(emp => {
                      const fullName = `${emp.primer_nombre} ${emp.segundo_nombre || ''} ${emp.primer_apellido} ${emp.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim();
                      const isActive = emp.estado === 'ACTIVO';
                      return (
                        <div
                          key={emp.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            {getInitials(emp.primer_nombre, emp.primer_apellido)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate dark:text-slate-200">{fullName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {emp.puesto && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 truncate">
                                  <Briefcase className="h-2.5 w-2.5 shrink-0" /> {emp.puesto}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                <DollarSign className="h-2.5 w-2.5" /> {formatSalary(emp.salario_base)}
                              </span>
                              <Badge className={`text-[9px] px-1 py-0 ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                {emp.estado}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ==================== AREA DETAIL DIALOG ==================== */}
      <Dialog open={!!detailArea} onOpenChange={(open) => { if (!open) { setDetailArea(null); setDetailEmployees([]); setDetailProfiles([]); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800">
          {detailArea && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
                  <div className={`p-1.5 rounded-lg bg-gradient-to-br ${getLevelStyle(detailArea.nivel).gradient}`}>
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  {detailArea.nombre}
                  <Badge variant="outline" className="dark:border-slate-600 dark:text-slate-300">{detailArea.codigo}</Badge>
                  <Badge className={`bg-gradient-to-r ${getLevelStyle(detailArea.nivel).gradient} text-white border-0`}>
                    Nivel {detailArea.nivel}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="dark:text-slate-400">
                  {detailArea.descripcion || 'Sin descripción disponible'}
                </DialogDescription>
              </DialogHeader>

              {loadingDetail ? (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full dark:bg-slate-700" />)}
                  </div>
                  <Skeleton className="h-40 w-full dark:bg-slate-700" />
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  {/* Budget Summary */}
                  {detailBudget && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center border border-emerald-100 dark:border-emerald-900/30">
                        <DollarSign className="h-4 w-4 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Salario Total</p>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatSalary(detailBudget.totalSalary)}</p>
                      </div>
                      <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 text-center border border-teal-100 dark:border-teal-900/30">
                        <TrendingUp className="h-4 w-4 mx-auto text-teal-600 dark:text-teal-400 mb-1" />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Promedio</p>
                        <p className="text-sm font-bold text-teal-700 dark:text-teal-300">{formatSalary(detailBudget.avgSalary)}</p>
                      </div>
                      <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3 text-center border border-cyan-100 dark:border-cyan-900/30">
                        <Users className="h-4 w-4 mx-auto text-cyan-600 dark:text-cyan-400 mb-1" />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Empleados</p>
                        <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300">{detailEmployees.length}</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center border border-amber-100 dark:border-amber-900/30">
                        <Briefcase className="h-4 w-4 mx-auto text-amber-600 dark:text-amber-400 mb-1" />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Perfiles</p>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{detailProfiles.length}</p>
                      </div>
                    </div>
                  )}

                  <Separator className="dark:bg-slate-800" />

                  {/* Employee Table */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 dark:text-slate-100">
                      <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Empleados del Área
                    </h4>
                    {detailEmployees.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        <Users className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-xs">No hay empleados asignados a esta área</p>
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto custom-scrollbar rounded-lg border border-slate-200 dark:border-slate-700">
                        <Table>
                          <TableHeader>
                            <TableRow className="dark:border-slate-700">
                              <TableHead className="dark:text-slate-300">Empleado</TableHead>
                              <TableHead className="dark:text-slate-300">Puesto</TableHead>
                              <TableHead className="dark:text-slate-300">Salario</TableHead>
                              <TableHead className="dark:text-slate-300">Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailEmployees.map(emp => {
                              const fullName = `${emp.primer_nombre} ${emp.segundo_nombre || ''} ${emp.primer_apellido} ${emp.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim();
                              const isActive = emp.estado === 'ACTIVO';
                              return (
                                <TableRow key={emp.id} className="dark:border-slate-800">
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                        {getInitials(emp.primer_nombre, emp.primer_apellido)}
                                      </div>
                                      <div>
                                        <p className="text-xs font-medium dark:text-slate-200">{fullName}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{emp.codigo_empleado || emp.empleado_code || ''}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs dark:text-slate-300">
                                    {emp.perfil_puesto?.nombre_puesto || emp.puesto || '—'}
                                  </TableCell>
                                  <TableCell className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    {formatSalary(emp.salario_base)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={`text-[9px] ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                      {emp.estado}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <Separator className="dark:bg-slate-800" />

                  {/* Linked Job Profiles */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 dark:text-slate-100">
                      <Briefcase className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      Perfiles de Puesto Vinculados
                    </h4>
                    {detailProfiles.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        <Briefcase className="h-6 w-6 mx-auto mb-1" />
                        <p className="text-xs">No hay perfiles de puesto vinculados</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {detailProfiles.map(prof => (
                          <div
                            key={prof.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 rounded-md bg-teal-100 dark:bg-teal-900/30">
                                <Briefcase className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium dark:text-slate-200">{prof.nombre_puesto}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">{prof.codigo}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {prof.banda_salarial && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {formatSalary(prof.banda_salarial.salario_minimo)} - {formatSalary(prof.banda_salarial.salario_maximo)}
                                </span>
                              )}
                              <Badge className={`text-[9px] ${prof.estado === 'VIGENTE' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                                {prof.estado}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Area Hierarchy Path */}
                  <Separator className="dark:bg-slate-800" />
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 dark:text-slate-100">
                      <GitBranch className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      Ruta Jerárquica
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(() => {
                        const path: Area[] = [];
                        let current: Area | undefined = detailArea;
                        while (current) {
                          path.unshift(current);
                          current = current.area_padre_id ? areas.find(a => a.id === current!.area_padre_id) : undefined;
                        }
                        return path.map((a, idx) => (
                          <React.Fragment key={a.id}>
                            {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                            <Badge
                              variant={a.id === detailArea.id ? 'default' : 'outline'}
                              className={`text-[10px] ${a.id === detailArea.id ? 'bg-emerald-600 text-white' : 'dark:border-slate-700 dark:text-slate-300'}`}
                            >
                              {a.nombre}
                            </Badge>
                          </React.Fragment>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

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
