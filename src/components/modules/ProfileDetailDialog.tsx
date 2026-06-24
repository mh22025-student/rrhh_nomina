'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Building2, DollarSign, Star, Users, Clock, FileText, GraduationCap,
  Briefcase, Award, Settings, Shield, Printer, Edit, History, CheckCircle2,
  Target, TrendingUp, Hash, Calendar, User, ChevronRight, Sparkles, Layers,
  AlertTriangle, FileSignature, ListChecks, Palette, Gauge, BadgeCheck,
  ArrowUpRight, Quote, ScrollText,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProfileDetailDialogProps {
  perfil: Perfil | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  userRole: string;
  onEdit?: (perfil: Perfil) => void;
}

interface Area { id: string; nombre: string; codigo: string; }
interface Banda {
  id: string; nombre: string; grado: number;
  salario_minimo: number; salario_maximo: number;
}
interface Version {
  id: string; version: number; cambio_descripcion: string;
  fecha_creacion: string; contenido?: string;
  creado_por: { nombre: string; apellido: string } | null;
}
interface Creador { nombre: string; apellido: string; email: string; }
export interface Perfil {
  id: string; codigo: string; nombre_puesto: string; estado: string; version: number;
  puntos_total: number; proposito: string | null; funciones_esenciales: string | null;
  requisitos_educacion: string | null; requisitos_experiencia: string | null;
  requisitos_habilidades: string | null; responsabilidades: string | null;
  condiciones_trabajo: string | null; sector_laboral: string;
  fecha_creacion?: string; fecha_actualizacion?: string;
  area: Area; banda_salarial: Banda | null;
  creado_por?: Creador | null;
  _count: { empleados_perfil: number };
  versiones?: Version[];
}

interface Empleado {
  id: string; codigo_empleado: string; primer_nombre: string; segundo_nombre: string | null;
  primer_apellido: string; segundo_apellido: string | null; estado: string;
  salario_base: number; fecha_ingreso: string;
}

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800',
  ACTIVO: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
  OBSOLETO: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  VIGENTE: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
};

const estadoDotColors: Record<string, string> = {
  BORRADOR: 'bg-yellow-500',
  ACTIVO: 'bg-emerald-500',
  OBSOLETO: 'bg-red-500',
  VIGENTE: 'bg-emerald-500',
};

const sectorLabels: Record<string, { label: string; color: string }> = {
  COMERCIO: { label: 'Comercio', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  INDUSTRIA: { label: 'Industria', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  SERVICIOS: { label: 'Servicios', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  AGROPECUARIO: { label: 'Agropecuario', color: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300' },
};

const areaColors = [
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-teal-500 to-cyan-600',
  'from-orange-500 to-red-600',
  'from-cyan-500 to-blue-600',
];

function getAreaGradient(areaName: string): string {
  let hash = 0;
  for (let i = 0; i < areaName.length; i++) {
    hash = areaName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return areaColors[Math.abs(hash) % areaColors.length];
}

function getInitials(text: string): string {
  return text.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// Points tier system - based on Hay Group-style job evaluation
function getPointsTier(points: number): {
  tier: string; label: string; color: string; bg: string; icon: React.ElementType; description: string;
} {
  if (points >= 800) return {
    tier: 'PLATINO', label: 'Platino', color: 'text-cyan-700 dark:text-cyan-300',
    bg: 'from-cyan-500 to-blue-600', icon: Sparkles,
    description: 'Posición estratégica de alto impacto',
  };
  if (points >= 600) return {
    tier: 'ORO', label: 'Oro', color: 'text-amber-700 dark:text-amber-300',
    bg: 'from-amber-500 to-yellow-600', icon: Award,
    description: 'Posición senior con alta responsabilidad',
  };
  if (points >= 400) return {
    tier: 'PLATA', label: 'Plata', color: 'text-slate-700 dark:text-slate-300',
    bg: 'from-slate-400 to-slate-600', icon: Medal,
    description: 'Posición técnica especializada',
  };
  if (points >= 200) return {
    tier: 'BRONCE', label: 'Bronce', color: 'text-orange-700 dark:text-orange-300',
    bg: 'from-orange-600 to-amber-700', icon: Shield,
    description: 'Posición operativa con experiencia',
  };
  return {
    tier: 'BÁSICO', label: 'Básico', color: 'text-stone-700 dark:text-stone-300',
    bg: 'from-stone-500 to-stone-700', icon: Briefcase,
    description: 'Posición de entrada o apoyo',
  };
}

function Medal({ className }: { className?: string }) {
  return <Award className={className} />;
}

// Parse text content into bullet list - handles JSON arrays, "1. ", "- ", "• ", "|", and newline-separated
function parseBulletList(text: string | null): string[] {
  if (!text) return [];
  const trimmed = text.trim();

  // Try JSON array first
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // fall through to other parsers
    }
  }

  // Pipe-separated (used in seed data)
  if (trimmed.includes('|') && !trimmed.includes('\n')) {
    const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bullets: string[] = [];
  for (const line of lines) {
    // Also handle pipe-separated within lines
    const subParts = line.split('|').map((p) => p.trim()).filter(Boolean);
    for (const part of subParts) {
      const cleaned = part.replace(/^(\d+[\.\)]\s*|[-•·*]\s*|>\s*)/, '');
      if (cleaned) bullets.push(cleaned);
    }
  }
  return bullets;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-SV', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// Section card with icon header and colored accent
function SectionCard({
  icon: Icon, title, accentColor, children, isEmpty, emptyMessage,
}: {
  icon: React.ElementType; title: string; accentColor: string;
  children: React.ReactNode; isEmpty?: boolean; emptyMessage?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
        <div className={`p-2 rounded-lg ${accentColor}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h4>
      </div>
      <div className="p-4">
        {isEmpty ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 italic">
            <AlertTriangle className="h-3.5 w-3.5" />
            {emptyMessage || 'No especificado'}
          </div>
        ) : children}
      </div>
    </div>
  );
}

// Render text content - either as bullet list (if multi-line) or paragraph
function ContentRenderer({ text }: { text: string | null }) {
  if (!text) return null;
  const bullets = parseBulletList(text);
  if (bullets.length > 1) {
    return (
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{text}</p>;
}

export default function ProfileDetailDialog({
  perfil, open, onOpenChange, accessToken, userRole, onEdit,
}: ProfileDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);

  // Reset tab when perfil changes
  useEffect(() => {
    if (open) setActiveTab('resumen');
  }, [open, perfil?.id]);

  // Fetch employees for this profile when Empleados tab is opened
  useEffect(() => {
    if (!open || !perfil || activeTab !== 'empleados') return;
    let cancelled = false;
    const fetchEmpleados = async () => {
      setLoadingEmpleados(true);
      try {
        const res = await fetch(`/api/empleados?perfil_puesto_id=${perfil.id}&pageSize=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setEmpleados(Array.isArray(data) ? data : (data.data || []));
        }
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoadingEmpleados(false); }
    };
    fetchEmpleados();
    return () => { cancelled = true; };
  }, [open, perfil, activeTab, accessToken]);

  const tier = useMemo(() => perfil ? getPointsTier(perfil.puntos_total) : null, [perfil]);

  const salaryStats = useMemo(() => {
    if (!perfil?.banda_salarial) return null;
    const b = perfil.banda_salarial;
    const range = b.salario_maximo - b.salario_minimo;
    const midpoint = (b.salario_minimo + b.salario_maximo) / 2;
    // Estimate position based on points (out of 1000)
    const positionPct = Math.min((perfil.puntos_total / 1000) * 100, 100);
    const estimatedSalary = b.salario_minimo + (range * positionPct / 100);
    return { range, midpoint, positionPct, estimatedSalary, min: b.salario_minimo, max: b.salario_maximo };
  }, [perfil]);

  const canEdit = userRole === 'ADMIN' || userRole === 'ANALISTA';

  if (!perfil) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] p-0 overflow-hidden gap-0 dark:bg-slate-900 dark:border-slate-800">
        {/* Hero Header with gradient */}
        <div className={`relative bg-gradient-to-br ${getAreaGradient(perfil.area?.nombre || '')} text-white overflow-hidden`}>
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full bg-white/5" />

          <div className="relative px-6 py-5">
            {/* Top row: code badge + status + close hint */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 backdrop-blur-sm text-xs font-mono font-semibold">
                  <Hash className="h-3 w-3" />{perfil.codigo}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${estadoColors[perfil.estado] || 'bg-white/20 text-white border-white/30'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${estadoDotColors[perfil.estado] || 'bg-white'}`} />
                  {perfil.estado}
                </span>
                {sectorLabels[perfil.sector_laboral] && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${sectorLabels[perfil.sector_laboral].color}`}>
                    <Building2 className="h-3 w-3" />
                    {sectorLabels[perfil.sector_laboral].label}
                  </span>
                )}
              </div>
              {canEdit && onEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm"
                  onClick={() => onEdit(perfil)}
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Editar
                </Button>
              )}
            </div>

            {/* Title */}
            <div className="flex items-start gap-3 mb-3">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
                <Briefcase className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold leading-tight mb-1">{perfil.nombre_puesto}</h2>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{perfil.area?.nombre || 'Sin área'}</span>
                  <span className="text-white/40">·</span>
                  <span className="font-mono text-xs">{perfil.area?.codigo}</span>
                </div>
              </div>
            </div>

            {/* Quick info row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Version */}
              <div className="rounded-lg bg-white/15 backdrop-blur-sm px-3 py-2">
                <div className="flex items-center gap-1.5 text-white/70 text-[10px] uppercase tracking-wide font-medium">
                  <History className="h-3 w-3" /> Versión
                </div>
                <div className="text-lg font-bold mt-0.5">V{perfil.version}</div>
              </div>
              {/* Employees */}
              <div className="rounded-lg bg-white/15 backdrop-blur-sm px-3 py-2">
                <div className="flex items-center gap-1.5 text-white/70 text-[10px] uppercase tracking-wide font-medium">
                  <Users className="h-3 w-3" /> Empleados
                </div>
                <div className="text-lg font-bold mt-0.5">{perfil._count?.empleados_perfil ?? 0}</div>
              </div>
              {/* Points tier */}
              {tier && (
                <div className="rounded-lg bg-white/15 backdrop-blur-sm px-3 py-2">
                  <div className="flex items-center gap-1.5 text-white/70 text-[10px] uppercase tracking-wide font-medium">
                    <tier.icon className="h-3 w-3" /> Valuación
                  </div>
                  <div className="text-lg font-bold mt-0.5 flex items-center gap-1">
                    {perfil.puntos_total}<span className="text-xs font-normal text-white/70">pts</span>
                  </div>
                </div>
              )}
              {/* Created by */}
              {perfil.creado_por && (
                <div className="rounded-lg bg-white/15 backdrop-blur-sm px-3 py-2">
                  <div className="flex items-center gap-1.5 text-white/70 text-[10px] uppercase tracking-wide font-medium">
                    <User className="h-3 w-3" /> Creado por
                  </div>
                  <div className="text-sm font-semibold mt-0.5 truncate">
                    {perfil.creado_por.nombre} {perfil.creado_por.apellido}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-col h-[calc(95vh-280px)] min-h-[400px]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-slate-200 dark:border-slate-800 px-6">
              <TabsList className="bg-transparent h-12 p-0 gap-1">
                <TabsTrigger value="resumen" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 rounded-md gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Resumen
                </TabsTrigger>
                <TabsTrigger value="detalle" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 rounded-md gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" /> Detalle
                </TabsTrigger>
                <TabsTrigger value="valuacion" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 rounded-md gap-1.5">
                  <Gauge className="h-3.5 w-3.5" /> Valuación
                </TabsTrigger>
                <TabsTrigger value="empleados" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 rounded-md gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Empleados
                  <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                    {perfil._count?.empleados_perfil ?? 0}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="versiones" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 rounded-md gap-1.5">
                  <History className="h-3.5 w-3.5" /> Versiones
                  {(perfil.versiones?.length ?? 0) > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      {perfil.versiones!.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-6">

                {/* RESUMEN TAB */}
                <TabsContent value="resumen" className="mt-0 space-y-4">
                  {/* Tier banner */}
                  {tier && (
                    <div className={`rounded-xl bg-gradient-to-r ${tier.bg} text-white p-4 flex items-center gap-4 overflow-hidden relative`}>
                      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4" />
                      <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
                        <tier.icon className="h-8 w-8" />
                      </div>
                      <div className="flex-1 min-w-0 relative">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">Nivel de Valuación</span>
                          <BadgeCheck className="h-3.5 w-3.5 opacity-80" />
                        </div>
                        <h3 className="text-lg font-bold leading-tight">Tier {tier.tier} · {tier.label}</h3>
                        <p className="text-sm opacity-90 mt-0.5">{tier.description}</p>
                      </div>
                      <div className="text-right relative shrink-0">
                        <div className="text-3xl font-bold tabular-nums leading-none">{perfil.puntos_total}</div>
                        <div className="text-[10px] uppercase tracking-wider opacity-80 mt-1">puntos</div>
                      </div>
                    </div>
                  )}

                  {/* Propósito - prominent quote-style card */}
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 relative overflow-hidden">
                    <Quote className="absolute top-3 right-3 h-8 w-8 text-emerald-300 dark:text-emerald-800 opacity-50" />
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wide">Propósito del Puesto</h4>
                    </div>
                    {perfil.proposito ? (
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                        {perfil.proposito}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No definido</p>
                    )}
                  </div>

                  {/* Two-column grid: Funciones + Responsabilidades */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SectionCard
                      icon={ListChecks}
                      title="Funciones Esenciales"
                      accentColor="bg-sky-500"
                      isEmpty={!perfil.funciones_esenciales}
                      emptyMessage="No se han definido funciones esenciales"
                    >
                      <ContentRenderer text={perfil.funciones_esenciales} />
                    </SectionCard>
                    <SectionCard
                      icon={Shield}
                      title="Responsabilidades"
                      accentColor="bg-violet-500"
                      isEmpty={!perfil.responsabilidades}
                      emptyMessage="No se han definido responsabilidades"
                    >
                      <ContentRenderer text={perfil.responsabilidades} />
                    </SectionCard>
                  </div>

                  {/* Condiciones de trabajo */}
                  <SectionCard
                    icon={Settings}
                    title="Condiciones de Trabajo"
                    accentColor="bg-slate-500"
                    isEmpty={!perfil.condiciones_trabajo}
                    emptyMessage="No se han definido condiciones de trabajo"
                  >
                    <ContentRenderer text={perfil.condiciones_trabajo} />
                  </SectionCard>
                </TabsContent>

                {/* DETALLE TAB */}
                <TabsContent value="detalle" className="mt-0 space-y-4">
                  {/* Requisitos grid */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-slate-900 dark:bg-slate-100">
                        <GraduationCap className="h-4 w-4 text-white dark:text-slate-900" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Requisitos del Puesto</h3>
                      <Separator className="flex-1" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <SectionCard
                        icon={GraduationCap}
                        title="Educación"
                        accentColor="bg-blue-500"
                        isEmpty={!perfil.requisitos_educacion}
                        emptyMessage="No especificado"
                      >
                        <ContentRenderer text={perfil.requisitos_educacion} />
                      </SectionCard>
                      <SectionCard
                        icon={Briefcase}
                        title="Experiencia"
                        accentColor="bg-emerald-500"
                        isEmpty={!perfil.requisitos_experiencia}
                        emptyMessage="No especificado"
                      >
                        <ContentRenderer text={perfil.requisitos_experiencia} />
                      </SectionCard>
                      <SectionCard
                        icon={Palette}
                        title="Habilidades"
                        accentColor="bg-rose-500"
                        isEmpty={!perfil.requisitos_habilidades}
                        emptyMessage="No especificado"
                      >
                        <ContentRenderer text={perfil.requisitos_habilidades} />
                      </SectionCard>
                    </div>
                  </div>

                  {/* All long-form sections */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SectionCard
                      icon={Target}
                      title="Propósito"
                      accentColor="bg-emerald-500"
                      isEmpty={!perfil.proposito}
                    >
                      <ContentRenderer text={perfil.proposito} />
                    </SectionCard>
                    <SectionCard
                      icon={ListChecks}
                      title="Funciones Esenciales"
                      accentColor="bg-sky-500"
                      isEmpty={!perfil.funciones_esenciales}
                    >
                      <ContentRenderer text={perfil.funciones_esenciales} />
                    </SectionCard>
                    <SectionCard
                      icon={Shield}
                      title="Responsabilidades"
                      accentColor="bg-violet-500"
                      isEmpty={!perfil.responsabilidades}
                    >
                      <ContentRenderer text={perfil.responsabilidades} />
                    </SectionCard>
                    <SectionCard
                      icon={Settings}
                      title="Condiciones de Trabajo"
                      accentColor="bg-slate-500"
                      isEmpty={!perfil.condiciones_trabajo}
                    >
                      <ContentRenderer text={perfil.condiciones_trabajo} />
                    </SectionCard>
                  </div>

                  {/* Metadata footer */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
                    <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <FileSignature className="h-3.5 w-3.5" /> Metadatos del Registro
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-0.5">ID Interno</p>
                        <p className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate">{perfil.id}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-0.5">Versión Actual</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">V{perfil.version}</p>
                      </div>
                      {perfil.fecha_creacion && (
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-0.5">Fecha Creación</p>
                          <p className="font-medium text-slate-700 dark:text-slate-300">{formatDate(perfil.fecha_creacion)}</p>
                        </div>
                      )}
                      {perfil.fecha_actualizacion && (
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-0.5">Última Actualización</p>
                          <p className="font-medium text-slate-700 dark:text-slate-300">{formatDate(perfil.fecha_actualizacion)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* VALUACIÓN TAB */}
                <TabsContent value="valuacion" className="mt-0 space-y-4">
                  {tier && (
                    <>
                      {/* Tier system reference */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sistema de Valuación por Puntos</h4>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {[
                            { tier: 'PLATINO', label: 'Platino', range: '800-1000', color: 'from-cyan-500 to-blue-600', icon: Sparkles, desc: 'Estratégico' },
                            { tier: 'ORO', label: 'Oro', range: '600-799', color: 'from-amber-500 to-yellow-600', icon: Award, desc: 'Senior' },
                            { tier: 'PLATA', label: 'Plata', range: '400-599', color: 'from-slate-400 to-slate-600', icon: Medal, desc: 'Técnico' },
                            { tier: 'BRONCE', label: 'Bronce', range: '200-399', color: 'from-orange-600 to-amber-700', icon: Shield, desc: 'Operativo' },
                            { tier: 'BÁSICO', label: 'Básico', range: '0-199', color: 'from-stone-500 to-stone-700', icon: Briefcase, desc: 'Entrada' },
                          ].map((t) => {
                            const isCurrent = t.tier === tier.tier;
                            return (
                              <div
                                key={t.tier}
                                className={`relative rounded-lg border p-3 transition-all ${isCurrent
                                  ? 'border-slate-900 dark:border-slate-100 shadow-md scale-[1.02]'
                                  : 'border-slate-200 dark:border-slate-800 opacity-70'}`}
                              >
                                {isCurrent && (
                                  <span className="absolute -top-2 -right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold">
                                    <BadgeCheck className="h-3 w-3" /> ACTUAL
                                  </span>
                                )}
                                <div className={`inline-flex p-1.5 rounded-md bg-gradient-to-br ${t.color} mb-2`}>
                                  <t.icon className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.label}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{t.range} pts · {t.desc}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Points progress visual */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          Progreso de Valuación
                        </h4>
                        <div className="relative">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${tier.bg} rounded-full transition-all duration-700`}
                              style={{ width: `${Math.min((perfil.puntos_total / 1000) * 100, 100)}%` }}
                            />
                          </div>
                          {/* Tier markers */}
                          <div className="absolute top-0 left-0 right-0 h-4 flex justify-between px-0 pointer-events-none">
                            {[200, 400, 600, 800].map((m) => (
                              <div
                                key={m}
                                className="w-px h-4 bg-white/60 dark:bg-slate-900/60"
                                style={{ marginLeft: `${(m / 1000) * 100 - 0.5}%`, position: 'absolute' }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>0</span>
                          <span>200</span>
                          <span>400</span>
                          <span>600</span>
                          <span>800</span>
                          <span>1000</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Puntuaje actual</span>
                          <span className={`font-bold text-lg ${tier.color}`}>{perfil.puntos_total} / 1000</span>
                        </div>
                        {/* Next tier hint */}
                        {perfil.puntos_total < 800 && (
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                            {(() => {
                              const nextThreshold = perfil.puntos_total < 200 ? 200
                                : perfil.puntos_total < 400 ? 400
                                : perfil.puntos_total < 600 ? 600
                                : perfil.puntos_total < 800 ? 800 : null;
                              if (!nextThreshold) return null;
                              const diff = nextThreshold - perfil.puntos_total;
                              return (
                                <span className="flex items-center gap-1.5">
                                  <ArrowUpRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  Faltan <span className="font-semibold text-emerald-700 dark:text-emerald-300">{diff} puntos</span> para alcanzar el siguiente tier
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Salary band analysis */}
                  {salaryStats && perfil.banda_salarial && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Análisis de Banda Salarial · {perfil.banda_salarial.nombre} (G{perfil.banda_salarial.grado})
                        </h4>
                      </div>
                      <div className="p-4">
                        {/* Salary range visualization */}
                        <div className="mb-4">
                          <div className="relative h-10 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                            {/* Range fill */}
                            <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-400 dark:from-emerald-900/50 dark:via-emerald-800/60 dark:to-emerald-700/70" />
                            {/* Min marker */}
                            <div className="absolute inset-y-0 left-0 w-0.5 bg-emerald-700 dark:bg-emerald-300" />
                            {/* Max marker */}
                            <div className="absolute inset-y-0 right-0 w-0.5 bg-emerald-700 dark:bg-emerald-300" />
                            {/* Midpoint marker */}
                            <div
                              className="absolute inset-y-0 w-px bg-slate-900 dark:bg-slate-100"
                              style={{ left: '50%' }}
                            />
                            {/* Estimated salary marker */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="absolute inset-y-0 w-1 bg-rose-600 dark:bg-rose-400 cursor-help"
                                    style={{ left: `${salaryStats.positionPct}%` }}
                                  >
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-rose-600 dark:bg-rose-400 border-2 border-white dark:border-slate-900" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs font-semibold">Posición estimada: {formatCurrency(salaryStats.estimatedSalary)}</p>
                                  <p className="text-xs text-slate-500">Basado en valuación por puntos</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex justify-between mt-2 text-xs">
                            <div>
                              <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500">Mínimo</p>
                              <p className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(salaryStats.min)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500">Punto Medio</p>
                              <p className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(salaryStats.midpoint)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500">Máximo</p>
                              <p className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(salaryStats.max)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Salary stats grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                            <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-0.5">Amplitud Banda</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(salaryStats.range)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                            <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-0.5">Salario Estimado</p>
                            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(salaryStats.estimatedSalary)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                            <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-0.5">Posición en Banda</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{salaryStats.positionPct.toFixed(0)}%</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                            <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-0.5">Grado</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">G{perfil.banda_salarial.grado}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!perfil.banda_salarial && (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                      <DollarSign className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">Este perfil no tiene banda salarial asignada</p>
                    </div>
                  )}
                </TabsContent>

                {/* EMPLEADOS TAB */}
                <TabsContent value="empleados" className="mt-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Empleados con este Perfil
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {perfil._count?.empleados_perfil ?? 0} empleado(s) asignado(s) a {perfil.nombre_puesto}
                      </p>
                    </div>
                  </div>

                  {loadingEmpleados ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full dark:bg-slate-700" />
                      ))}
                    </div>
                  ) : empleados.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                      <Users className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">No hay empleados asignados a este perfil</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Código</th>
                              <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nombre</th>
                              <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</th>
                              <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Salario Base</th>
                              <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ingreso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {empleados.map((emp) => {
                              const fullName = `${emp.primer_nombre}${emp.segundo_nombre ? ' ' + emp.segundo_nombre : ''} ${emp.primer_apellido}${emp.segundo_apellido ? ' ' + emp.segundo_apellido : ''}`;
                              return (
                                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.codigo_empleado}</td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {getInitials(fullName)}
                                      </div>
                                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{fullName}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <Badge variant="outline" className="text-[10px] dark:border-slate-700 dark:text-slate-300">{emp.estado}</Badge>
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                                    {formatCurrency(emp.salario_base)}
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(emp.fecha_ingreso)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                            <tr>
                              <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Total: {empleados.length} empleado(s)</td>
                              <td className="px-4 py-2 text-right text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                                {formatCurrency(empleados.reduce((s, e) => s + e.salario_base, 0))}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* VERSIONES TAB */}
                <TabsContent value="versiones" className="mt-0 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Historial de Versiones
                  </h3>

                  {(!perfil.versiones || perfil.versiones.length === 0) ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                      <History className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">No hay historial de versiones registrado</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Las versiones se crean automáticamente al actualizar el perfil</p>
                    </div>
                  ) : (
                    <div className="relative pl-8">
                      {/* Vertical line */}
                      <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />

                      <div className="space-y-4">
                        {perfil.versiones.map((v, idx) => {
                          const isCurrent = v.version === perfil.version;
                          return (
                            <div key={v.id} className="relative">
                              {/* Dot */}
                              <div className={`absolute -left-8 top-3 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 ${isCurrent
                                ? 'bg-emerald-500'
                                : idx === 0 ? 'bg-slate-700 dark:bg-slate-300' : 'bg-slate-400 dark:bg-slate-600'}`}>
                                {isCurrent ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                ) : (
                                  <ScrollText className="h-3 w-3 text-white" />
                                )}
                              </div>

                              {/* Card */}
                              <div className={`rounded-xl border p-3 transition-all ${isCurrent
                                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-xs font-mono ${isCurrent
                                      ? 'border-emerald-400 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
                                      : 'dark:border-slate-700 dark:text-slate-300'}`}>
                                      V{v.version}
                                    </Badge>
                                    {isCurrent && (
                                      <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 text-white">ACTUAL</Badge>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                                    <Calendar className="h-3 w-3" />
                                    {formatDateTime(v.fecha_creacion)}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-1.5">
                                  {v.cambio_descripcion}
                                </p>
                                {v.creado_por && (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                    <User className="h-3 w-3" />
                                    <span>{v.creado_por.nombre} {v.creado_por.apellido}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

              </div>
            </ScrollArea>

            {/* Footer with print button */}
            <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <BookOpen className="h-3.5 w-3.5" />
                <span>Perfil de Puesto · {perfil.codigo}</span>
                <Separator orientation="vertical" className="h-3" />
                <span className="font-mono">V{perfil.version}</span>
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                        onClick={() => window.print()}
                      >
                        <Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generar documento impreso</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onOpenChange(false)}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
