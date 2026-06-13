'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, Save, Plus, Trash2, Loader2, AlertCircle, ChevronDown, ChevronRight,
  BookOpen, Target, Award, Shield, Settings2, History, RotateCcw, Sparkles,
  Lock, Building2, DollarSign, Globe, MapPin, Tag, GripVertical, Star,
  TrendingUp, Layers, GraduationCap, Briefcase, Code2, ChevronUp,
  Search, X, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface ProfileDescriptiveFormProps {
  accessToken: string;
  userRole: string;
}

interface Area {
  id: string;
  nombre: string;
  codigo: string;
}
interface Banda {
  id: string;
  nombre: string;
  grado: number;
  salario_minimo: number;
  salario_maximo: number;
}
interface PerfilListItem {
  id: string;
  codigo: string;
  nombre_puesto: string;
  estado: string;
  version: number;
  puntos_total: number;
  area: Area;
  banda_salarial: Banda | null;
}
interface VersionHistory {
  id: string;
  version: number;
  cambio_descripcion: string;
  fecha_creacion: string;
  creado_por: { nombre: string; apellido: string } | null;
}

interface PointFactor {
  label: string;
  value: number;
}

interface PointGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  factors: PointFactor[];
}

const SECTORES = ['COMERCIO', 'INDUSTRIA', 'SERVICIOS', 'AGROPECUARIO', 'MAQUILA', 'TRANSPORTE'];
const ESTADOS = ['BORRADOR', 'VIGENTE', 'EN_REVISION', 'OBSOLETO'];

const sectorIcons: Record<string, React.ReactNode> = {
  COMERCIO: <Building2 className="h-3.5 w-3.5" />,
  INDUSTRIA: <Layers className="h-3.5 w-3.5" />,
  SERVICIOS: <Briefcase className="h-3.5 w-3.5" />,
  AGROPECUARIO: <Globe className="h-3.5 w-3.5" />,
  MAQUILA: <Code2 className="h-3.5 w-3.5" />,
  TRANSPORTE: <MapPin className="h-3.5 w-3.5" />,
};

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  VIGENTE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  EN_REVISION: 'bg-sky-100 text-sky-800 border-sky-200',
  OBSOLETO: 'bg-slate-100 text-slate-600 border-slate-200',
};

const estadoDotColors: Record<string, string> = {
  BORRADOR: 'bg-yellow-500',
  VIGENTE: 'bg-emerald-500',
  EN_REVISION: 'bg-sky-500',
  OBSOLETO: 'bg-slate-400',
};

const educationLevels = [
  'Primaria', 'Bachillerato', 'Técnico', 'Tecnólogo', 'Licenciatura', 'Ingeniería', 'Maestría', 'Doctorado',
];

const skillLevels = ['Básico', 'Intermedio', 'Avanzado'] as const;
type SkillLevel = typeof skillLevels[number];

const skillLevelColors: Record<SkillLevel, string> = {
  Básico: 'bg-slate-100 text-slate-600 border-slate-200',
  Intermedio: 'bg-amber-100 text-amber-700 border-amber-200',
  Avanzado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const weightOptions = ['Alta', 'Media', 'Baja'] as const;
type Weight = typeof weightOptions[number];

const weightColors: Record<Weight, string> = {
  Alta: 'bg-red-100 text-red-700',
  Media: 'bg-amber-100 text-amber-700',
  Baja: 'bg-sky-100 text-sky-700',
};

const defaultPointGroups: PointGroup[] = [
  {
    key: 'habilidades',
    label: 'Habilidades',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'emerald',
    factors: [
      { label: 'Educación', value: 0 },
      { label: 'Experiencia', value: 0 },
      { label: 'Habilidades técnicas', value: 0 },
    ],
  },
  {
    key: 'esfuerzo',
    label: 'Esfuerzo',
    icon: <Target className="h-4 w-4" />,
    color: 'amber',
    factors: [
      { label: 'Esfuerzo físico', value: 0 },
      { label: 'Esfuerzo mental', value: 0 },
      { label: 'Concentración', value: 0 },
    ],
  },
  {
    key: 'responsabilidad',
    label: 'Responsabilidad',
    icon: <Shield className="h-4 w-4" />,
    color: 'sky',
    factors: [
      { label: 'Supervisión', value: 0 },
      { label: 'Fondos', value: 0 },
      { label: 'Confidencialidad', value: 0 },
      { label: 'Equipos', value: 0 },
    ],
  },
  {
    key: 'condiciones',
    label: 'Condiciones',
    icon: <Settings2 className="h-4 w-4" />,
    color: 'purple',
    factors: [
      { label: 'Ambiente', value: 0 },
      { label: 'Riesgos', value: 0 },
      { label: 'Exposición', value: 0 },
    ],
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; accent: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-500', ring: 'ring-emerald-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-500', ring: 'ring-amber-500' },
  sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', accent: 'bg-sky-500', ring: 'ring-sky-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-500', ring: 'ring-purple-500' },
};

const sectionBorderColors: Record<string, string> = {
  A: 'border-l-emerald-500',
  B: 'border-l-amber-500',
  C: 'border-l-sky-500',
  D: 'border-l-purple-500',
};

const sectionBadgeColors: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-amber-100 text-amber-700',
  C: 'bg-sky-100 text-sky-700',
  D: 'bg-purple-100 text-purple-700',
};

/* ─── helpers ─── */
function getGradeLabel(total: number): { label: string; color: string } {
  if (total <= 200) return { label: 'Operativo', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  if (total <= 400) return { label: 'Técnico', color: 'bg-sky-100 text-sky-700 border-sky-200' };
  if (total <= 700) return { label: 'Profesional', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  return { label: 'Directivo', color: 'bg-purple-100 text-purple-700 border-purple-200' };
}

/* ─── skill chip with level ─── */
interface SkillItem {
  name: string;
  level: SkillLevel;
}

/* ─── responsibility with weight ─── */
interface ResponsibilityItem {
  text: string;
  weight: Weight;
}

export default function ProfileDescriptiveForm({ accessToken, userRole }: ProfileDescriptiveFormProps) {
  const { toast } = useToast();

  // Data
  const [perfiles, setPerfiles] = useState<PerfilListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [bandas, setBandas] = useState<Banda[]>([]);
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form mode
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>('');
  const [isNewMode, setIsNewMode] = useState(true);
  const [profileSearch, setProfileSearch] = useState('');

  // Section collapse state
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    A: true, B: true, C: false, D: false, valuation: false,
  });

  // Form state
  const [form, setForm] = useState({
    codigo: '',
    nombre_puesto: '',
    area_id: '',
    banda_salarial_id: '',
    sector_laboral: 'COMERCIO',
    estado: 'BORRADOR',
    proposito: '',
    funciones_esenciales: [] as string[],
    requisitos_educacion: '',
    requisitos_experiencia: '',
    requisitos_habilidades: [] as string[],
    responsabilidades: [] as string[],
    condiciones_trabajo: '',
  });

  // Enhanced skill items with level
  const [skillItems, setSkillItems] = useState<SkillItem[]>([]);
  // Enhanced responsibility items with weight
  const [responsibilityItems, setResponsibilityItems] = useState<ResponsibilityItem[]>([]);

  const [pointGroups, setPointGroups] = useState<PointGroup[]>(
    defaultPointGroups.map(g => ({ ...g, factors: g.factors.map(f => ({ ...f })) }))
  );

  // Dynamic list input states
  const [newFuncion, setNewFuncion] = useState('');
  const [newHabilidad, setNewHabilidad] = useState('');
  const [newHabilidadLevel, setNewHabilidadLevel] = useState<SkillLevel>('Intermedio');
  const [newResponsabilidad, setNewResponsabilidad] = useState('');
  const [newResponsabilidadWeight, setNewResponsabilidadWeight] = useState<Weight>('Media');
  const [selectedBanda, setSelectedBanda] = useState<Banda | null>(null);
  const [experienceYears, setExperienceYears] = useState<[number, number]>([0, 5]);

  const canEdit = userRole === 'ADMIN' || userRole === 'ANALISTA';

  // Calculated total points
  const totalPoints = useMemo(() => {
    return pointGroups.reduce((sum, group) => {
      return sum + group.factors.reduce((s, f) => s + f.value, 0);
    }, 0);
  }, [pointGroups]);

  // Group subtotals
  const groupSubtotals = useMemo(() => {
    const map: Record<string, number> = {};
    pointGroups.forEach(g => {
      map[g.key] = g.factors.reduce((s, f) => s + f.value, 0);
    });
    return map;
  }, [pointGroups]);

  // Grade label
  const gradeInfo = useMemo(() => getGradeLabel(totalPoints), [totalPoints]);

  // Filtered profiles for search
  const filteredPerfiles = useMemo(() => {
    if (!profileSearch.trim()) return perfiles;
    const q = profileSearch.toLowerCase();
    return perfiles.filter(p =>
      p.nombre_puesto.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
    );
  }, [perfiles, profileSearch]);

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [perfilesRes, areasRes, bandasRes] = await Promise.all([
        fetch('/api/perfiles', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/areas', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/bandas', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);

      if (perfilesRes.ok) {
        const data = await perfilesRes.json();
        setPerfiles(Array.isArray(data) ? data : data.data || []);
      }
      if (areasRes.ok) {
        const data = await areasRes.json();
        setAreas(data.data || data || []);
      }
      if (bandasRes.ok) {
        const data = await bandasRes.json();
        setBandas(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // Fetch existing perfil when selected
  const handleSelectPerfil = useCallback(async (perfilId: string) => {
    if (!perfilId) {
      setIsNewMode(true);
      setSelectedPerfilId('');
      resetForm();
      return;
    }

    setIsNewMode(false);
    setSelectedPerfilId(perfilId);

    try {
      const res = await fetch(`/api/perfiles/${perfilId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const perfil = await res.json();

        let funciones: string[] = [];
        try { funciones = perfil.funciones_esenciales ? JSON.parse(perfil.funciones_esenciales) : []; } catch { funciones = perfil.funciones_esenciales ? [perfil.funciones_esenciales] : []; }

        let habilidades: string[] = [];
        try { habilidades = perfil.requisitos_habilidades ? JSON.parse(perfil.requisitos_habilidades) : []; } catch { habilidades = perfil.requisitos_habilidades ? [perfil.requisitos_habilidades] : []; }

        let responsabilidadesArr: string[] = [];
        try { responsabilidadesArr = perfil.responsabilidades ? JSON.parse(perfil.responsabilidades) : []; } catch { responsabilidadesArr = perfil.responsabilidades ? [perfil.responsabilidades] : []; }

        setForm({
          codigo: perfil.codigo || '',
          nombre_puesto: perfil.nombre_puesto || '',
          area_id: perfil.area_id || '',
          banda_salarial_id: perfil.banda_salarial_id || '',
          sector_laboral: perfil.sector_laboral || 'COMERCIO',
          estado: perfil.estado || 'BORRADOR',
          proposito: perfil.proposito || '',
          funciones_esenciales: Array.isArray(funciones) ? funciones : [],
          requisitos_educacion: perfil.requisitos_educacion || '',
          requisitos_experiencia: perfil.requisitos_experiencia || '',
          requisitos_habilidades: Array.isArray(habilidades) ? habilidades : [],
          responsabilidades: Array.isArray(responsabilidadesArr) ? responsabilidadesArr : [],
          condiciones_trabajo: perfil.condiciones_trabajo || '',
        });

        // Sync enhanced skills
        setSkillItems((Array.isArray(habilidades) ? habilidades : []).map(h => ({
          name: h,
          level: 'Intermedio' as SkillLevel,
        })));

        // Sync enhanced responsibilities
        setResponsibilityItems((Array.isArray(responsabilidadesArr) ? responsabilidadesArr : []).map(r => ({
          text: r,
          weight: 'Media' as Weight,
        })));

        // Sync banda
        if (perfil.banda_salarial_id) {
          const found = bandas.find(b => b.id === perfil.banda_salarial_id);
          setSelectedBanda(found || null);
        } else {
          setSelectedBanda(null);
        }

        if (perfil.puntos_total > 0) {
          const totalFactors = pointGroups.reduce((s, g) => s + g.factors.length, 0);
          const pointsPerFactor = Math.floor(perfil.puntos_total / totalFactors);
          const remainder = perfil.puntos_total - (pointsPerFactor * totalFactors);
          let remainderIdx = 0;
          setPointGroups(prev => prev.map(g => ({
            ...g,
            factors: g.factors.map(f => {
              const extra = remainderIdx < remainder ? 1 : 0;
              remainderIdx++;
              return { ...f, value: pointsPerFactor + extra };
            }),
          })));
        }

        setVersionHistory(perfil.versiones || []);
      }
    } catch (err) {
      console.error('Error fetching perfil:', err);
      toast({ title: 'Error', description: 'No se pudo cargar el perfil', variant: 'destructive' });
    }
  }, [accessToken, toast, pointGroups, bandas]);

  const resetForm = () => {
    setForm({
      codigo: '',
      nombre_puesto: '',
      area_id: '',
      banda_salarial_id: '',
      sector_laboral: 'COMERCIO',
      estado: 'BORRADOR',
      proposito: '',
      funciones_esenciales: [],
      requisitos_educacion: '',
      requisitos_experiencia: '',
      requisitos_habilidades: [],
      responsabilidades: [],
      condiciones_trabajo: '',
    });
    setSkillItems([]);
    setResponsibilityItems([]);
    setSelectedBanda(null);
    setPointGroups(defaultPointGroups.map(g => ({ ...g, factors: g.factors.map(f => ({ ...f })) })));
    setVersionHistory([]);
  };

  const handleNew = () => {
    setSelectedPerfilId('');
    setIsNewMode(true);
    resetForm();
    const nextNum = perfiles.length + 1;
    setForm(prev => ({ ...prev, codigo: `CARGO-${String(nextNum).padStart(3, '0')}` }));
  };

  // Dynamic list operations
  const addItem = (field: 'funciones_esenciales' | 'requisitos_habilidades' | 'responsabilidades', value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (!value.trim()) return;
    setForm(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }));
    setter('');
  };

  const removeItem = (field: 'funciones_esenciales' | 'requisitos_habilidades' | 'responsabilidades', index: number) => {
    setForm(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  // Enhanced skill operations
  const addSkill = () => {
    if (!newHabilidad.trim()) return;
    const item: SkillItem = { name: newHabilidad.trim(), level: newHabilidadLevel };
    setSkillItems(prev => [...prev, item]);
    setForm(prev => ({ ...prev, requisitos_habilidades: [...prev.requisitos_habilidades, newHabilidad.trim()] }));
    setNewHabilidad('');
  };

  const removeSkill = (index: number) => {
    setSkillItems(prev => prev.filter((_, i) => i !== index));
    setForm(prev => ({ ...prev, requisitos_habilidades: prev.requisitos_habilidades.filter((_, i) => i !== index) }));
  };

  const updateSkillLevel = (index: number, level: SkillLevel) => {
    setSkillItems(prev => prev.map((s, i) => i === index ? { ...s, level } : s));
  };

  // Enhanced responsibility operations
  const addResponsibility = () => {
    if (!newResponsabilidad.trim()) return;
    const item: ResponsibilityItem = { text: newResponsabilidad.trim(), weight: newResponsabilidadWeight };
    setResponsibilityItems(prev => [...prev, item]);
    setForm(prev => ({ ...prev, responsabilidades: [...prev.responsabilidades, newResponsabilidad.trim()] }));
    setNewResponsabilidad('');
  };

  const removeResponsibility = (index: number) => {
    setResponsibilityItems(prev => prev.filter((_, i) => i !== index));
    setForm(prev => ({ ...prev, responsabilidades: prev.responsabilidades.filter((_, i) => i !== index) }));
  };

  const updateResponsibilityWeight = (index: number, weight: Weight) => {
    setResponsibilityItems(prev => prev.map((r, i) => i === index ? { ...r, weight } : r));
  };

  // Point factor change
  const updatePointFactor = (groupKey: string, factorIndex: number, value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    setPointGroups(prev => prev.map(g =>
      g.key === groupKey
        ? { ...g, factors: g.factors.map((f, i) => i === factorIndex ? { ...f, value: clamped } : f) }
        : g
    ));
  };

  // Save handler
  const handleSave = async () => {
    if (!canEdit) {
      toast({ title: 'Sin permisos', description: 'No tiene permisos para guardar', variant: 'destructive' });
      return;
    }

    if (!form.nombre_puesto.trim()) {
      toast({ title: 'Campo requerido', description: 'El nombre del puesto es obligatorio', variant: 'destructive' });
      return;
    }
    if (!form.area_id) {
      toast({ title: 'Campo requerido', description: 'El área es obligatoria', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: form.codigo,
        nombre_puesto: form.nombre_puesto,
        area_id: form.area_id,
        banda_salarial_id: form.banda_salarial_id || null,
        sector_laboral: form.sector_laboral,
        estado: form.estado,
        proposito: form.proposito || null,
        funciones_esenciales: JSON.stringify(form.funciones_esenciales),
        requisitos_educacion: form.requisitos_educacion || null,
        requisitos_experiencia: form.requisitos_experiencia || null,
        requisitos_habilidades: JSON.stringify(form.requisitos_habilidades),
        responsabilidades: JSON.stringify(form.responsabilidades),
        condiciones_trabajo: form.condiciones_trabajo || null,
        puntos_total: totalPoints,
        cambio_descripcion: isNewMode ? 'Creación inicial del perfil' : `Actualización versión - ${form.nombre_puesto}`,
      };

      let res: Response;
      if (isNewMode) {
        if (!form.codigo) {
          const nextNum = perfiles.length + 1;
          payload.codigo = `CARGO-${String(nextNum).padStart(3, '0')}`;
        }
        res = await fetch('/api/perfiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/perfiles/${selectedPerfilId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (res.ok) {
        toast({
          title: isNewMode ? 'Perfil creado' : 'Perfil actualizado',
          description: `${form.nombre_puesto} - ${isNewMode ? 'Versión 1' : `Actualizado exitosamente`}`,
        });
        fetchInitialData();
        if (!isNewMode && selectedPerfilId) {
          handleSelectPerfil(selectedPerfilId);
        }
      } else {
        toast({ title: 'Error', description: data.error || 'Error al guardar perfil', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════
          ENHANCED HEADER — Gradient banner
         ═══════════════════════════════════════════ */}
      <Card className="overflow-hidden border-0 shadow-lg">
        {/* Gradient banner */}
        <div className="h-20 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-700 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-60" />
          <div className="absolute inset-0 flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Perfil Descriptivo de Puesto</h2>
                <p className="text-sm text-white/80">Valuación por puntos • Metodología vigente</p>
              </div>
            </div>
            {!isNewMode && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-xs backdrop-blur-sm">
                  v{versionHistory.length || 1}
                </Badge>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <div className={`h-2 w-2 rounded-full ${estadoDotColors[form.estado] || 'bg-slate-400'}`} />
                  <span className="text-xs text-white font-medium">{form.estado}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Profile selector bar */}
        <div className="p-4 bg-white dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {form.codigo && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{form.codigo}</span>
                </div>
              )}
              {form.nombre_puesto && (
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{form.nombre_puesto}</span>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search + Profile selector */}
              <div className="relative flex-1 sm:w-[280px]">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <Select value={selectedPerfilId} onValueChange={handleSelectPerfil}>
                  <SelectTrigger className="h-9 text-sm pl-8">
                    <SelectValue placeholder="Buscar perfil existente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input
                        placeholder="Filtrar perfiles..."
                        value={profileSearch}
                        onChange={e => setProfileSearch(e.target.value)}
                        className="h-7 text-xs"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    {filteredPerfiles.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">No se encontraron perfiles</p>
                    ) : (
                      filteredPerfiles.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono text-xs mr-2">{p.codigo}</span>
                          {p.nombre_puesto}
                          <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 ${estadoColors[p.estado] || ''}`}>
                            {p.estado}
                          </Badge>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" onClick={handleNew} className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <Plus className="h-4 w-4 mr-1" /> Nuevo
              </Button>
            </div>
          </div>
          {/* Mode indicator */}
          <div className="flex items-center gap-2 mt-3">
            <Badge variant={isNewMode ? 'default' : 'secondary'} className={isNewMode ? 'bg-emerald-600' : 'bg-amber-600'}>
              {isNewMode ? 'Creando nuevo perfil' : `Editando: ${form.codigo}`}
            </Badge>
            {!isNewMode && (
              <Badge variant="outline" className={estadoColors[form.estado] || ''}>
                {form.estado} • v{versionHistory.length || 1}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* ═══════════════════════════════════════════
          SECTION A - Identificación del Puesto
         ═══════════════════════════════════════════ */}
      <Collapsible open={sectionOpen.A} onOpenChange={(v) => setSectionOpen(p => ({ ...p, A: v }))}>
        <Card className={`shadow-sm border-l-4 ${sectionBorderColors.A}`}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className={`flex items-center justify-center h-7 w-7 rounded-lg ${sectionBadgeColors.A} text-xs font-bold`}>A</span>
                  Identificación del Puesto
                </CardTitle>
                {sectionOpen.A ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Auto-generated code with lock */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Código
                  </Label>
                  <div className="relative">
                    <Input
                      value={form.codigo}
                      readOnly
                      className="h-9 text-sm bg-slate-50 dark:bg-slate-800 font-mono pr-8"
                      placeholder="Auto-generado"
                    />
                    <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> Nombre del Puesto *
                  </Label>
                  <Input
                    value={form.nombre_puesto}
                    onChange={e => setForm(p => ({ ...p, nombre_puesto: e.target.value }))}
                    className="h-9 text-sm"
                    placeholder="Ej: Analista de Nómina"
                    disabled={!canEdit}
                  />
                </div>
                {/* Area dropdown with hierarchy */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Área *
                  </Label>
                  <Select value={form.area_id} onValueChange={v => setForm(p => ({ ...p, area_id: v }))} disabled={!canEdit}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                    <SelectContent>
                      {areas.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="text-slate-400 font-mono text-xs mr-1.5">{a.codigo}</span>
                          {a.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Salary band with range preview */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Banda Salarial
                  </Label>
                  <Select value={form.banda_salarial_id} onValueChange={v => {
                    setForm(p => ({ ...p, banda_salarial_id: v }));
                    const found = bandas.find(b => b.id === v);
                    setSelectedBanda(found || null);
                  }} disabled={!canEdit}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar banda" /></SelectTrigger>
                    <SelectContent>
                      {bandas.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          <span className="font-mono text-xs mr-1.5">G{b.grado}</span>
                          {b.nombre}
                          <span className="text-xs text-slate-400 ml-1">(${b.salario_minimo.toLocaleString()}-${b.salario_maximo.toLocaleString()})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Salary range preview */}
                  {selectedBanda && (
                    <div className="mt-2 p-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>Rango: ${selectedBanda.salario_minimo.toLocaleString()}</span>
                        <span>${selectedBanda.salario_maximo.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-emerald-200 dark:bg-emerald-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: '50%' }}
                        />
                      </div>
                      <p className="text-[10px] text-emerald-600 mt-1 text-center">Grado {selectedBanda.grado}</p>
                    </div>
                  )}
                </div>
                {/* Sector laboral with icons */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Sector Laboral
                  </Label>
                  <Select value={form.sector_laboral} onValueChange={v => setForm(p => ({ ...p, sector_laboral: v }))} disabled={!canEdit}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SECTORES.map(s => (
                        <SelectItem key={s} value={s}>
                          <span className="flex items-center gap-1.5">
                            {sectorIcons[s]} {s}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Estado with colored badges */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Estado
                  </Label>
                  <Select value={form.estado} onValueChange={v => setForm(p => ({ ...p, estado: v }))} disabled={!canEdit}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map(e => (
                        <SelectItem key={e} value={e}>
                          <span className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${estadoDotColors[e]}`} />
                            {e}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Current estado badge preview */}
                  <div className="mt-2">
                    <Badge variant="outline" className={`${estadoColors[form.estado] || ''} text-xs`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${estadoDotColors[form.estado]} mr-1.5`} />
                      {form.estado}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══════════════════════════════════════════
          SECTION B - Propósito y Funciones
         ═══════════════════════════════════════════ */}
      <Collapsible open={sectionOpen.B} onOpenChange={(v) => setSectionOpen(p => ({ ...p, B: v }))}>
        <Card className={`shadow-sm border-l-4 ${sectionBorderColors.B}`}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className={`flex items-center justify-center h-7 w-7 rounded-lg ${sectionBadgeColors.B} text-xs font-bold`}>B</span>
                  Propósito y Funciones
                </CardTitle>
                {sectionOpen.B ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-5">
              {/* Propósito with character count */}
              <div>
                <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Target className="h-3 w-3" /> Propósito del Puesto
                </Label>
                <div className="relative">
                  <Textarea
                    value={form.proposito}
                    onChange={e => setForm(p => ({ ...p, proposito: e.target.value }))}
                    className="text-sm min-h-[80px] pb-6"
                    placeholder="Describa el propósito general del puesto..."
                    disabled={!canEdit}
                    maxLength={500}
                  />
                  <span className="absolute bottom-2 right-2 text-[10px] text-slate-400">
                    {form.proposito.length}/500
                  </span>
                </div>
              </div>

              {/* Funciones esenciales with drag-reorder handles */}
              <div>
                <Label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-2">
                  <Layers className="h-3 w-3" /> Funciones Esenciales
                  <Badge variant="outline" className="text-[10px] ml-1">{form.funciones_esenciales.length}</Badge>
                </Label>
                <div className="space-y-2">
                  {form.funciones_esenciales.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 group transition-all hover:shadow-sm">
                      <GripVertical className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0 cursor-grab" />
                      <span className="h-5 w-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                      <span className="text-sm flex-1 text-slate-700 dark:text-slate-300">{f}</span>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem('funciones_esenciales', i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <div className="flex gap-2">
                      <Input
                        value={newFuncion}
                        onChange={e => setNewFuncion(e.target.value)}
                        className="h-8 text-sm flex-1"
                        placeholder="Agregar función esencial..."
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('funciones_esenciales', newFuncion, setNewFuncion); } }}
                      />
                      <Button size="sm" variant="outline" onClick={() => addItem('funciones_esenciales', newFuncion, setNewFuncion)} className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                      </Button>
                    </div>
                  )}
                  {form.funciones_esenciales.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-3">No hay funciones registradas</p>
                  )}
                </div>

                {/* Preview card */}
                {form.funciones_esenciales.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg border border-dashed border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/5">
                    <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wider mb-2">Vista Previa</p>
                    <ul className="space-y-1">
                      {form.funciones_esenciales.map((f, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══════════════════════════════════════════
          SECTION C - Requisitos del Cargo
         ═══════════════════════════════════════════ */}
      <Collapsible open={sectionOpen.C} onOpenChange={(v) => setSectionOpen(p => ({ ...p, C: v }))}>
        <Card className={`shadow-sm border-l-4 ${sectionBorderColors.C}`}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className={`flex items-center justify-center h-7 w-7 rounded-lg ${sectionBadgeColors.C} text-xs font-bold`}>C</span>
                  Requisitos del Cargo
                </CardTitle>
                {sectionOpen.C ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Education level selector */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> Requisitos de Educación
                  </Label>
                  <Select value={form.requisitos_educacion} onValueChange={v => setForm(p => ({ ...p, requisitos_educacion: v }))} disabled={!canEdit}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar nivel educativo" /></SelectTrigger>
                    <SelectContent>
                      {educationLevels.map(lvl => (
                        <SelectItem key={lvl} value={lvl}>
                          <span className="flex items-center gap-1.5">
                            <GraduationCap className="h-3 w-3 text-slate-400" /> {lvl}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Allow custom education text */}
                  <Input
                    value={form.requisitos_educacion}
                    onChange={e => setForm(p => ({ ...p, requisitos_educacion: e.target.value }))}
                    className="h-9 text-sm mt-2"
                    placeholder="O especificar manualmente..."
                    disabled={!canEdit}
                  />
                </div>
                {/* Experience years range */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> Requisitos de Experiencia
                  </Label>
                  <Textarea
                    value={form.requisitos_experiencia}
                    onChange={e => setForm(p => ({ ...p, requisitos_experiencia: e.target.value }))}
                    className="text-sm min-h-[80px]"
                    placeholder="Ej: Mínimo 3 años en posiciones similares..."
                    disabled={!canEdit}
                  />
                  {/* Experience range slider */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Años de experiencia</span>
                      <span className="font-mono">{experienceYears[0]} - {experienceYears[1]} años</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={experienceYears[0]}
                        onChange={e => setExperienceYears(prev => [Math.min(Number(e.target.value), prev[1]), prev[1]])}
                        className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-emerald-500"
                        disabled={!canEdit}
                      />
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={experienceYears[1]}
                        onChange={e => setExperienceYears(prev => [prev[0], Math.max(Number(e.target.value), prev[0])])}
                        className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-emerald-500"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-300 mt-0.5">
                      <span>0</span>
                      <span>10</span>
                      <span>20</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills with tag-style chips and level */}
              <div>
                <Label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-2">
                  <Code2 className="h-3 w-3" /> Requisitos de Habilidades
                  <Badge variant="outline" className="text-[10px] ml-1">{skillItems.length}</Badge>
                </Label>
                {/* Skill chips */}
                {skillItems.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {skillItems.map((skill, i) => (
                      <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-white dark:bg-slate-800 group transition-all hover:shadow-sm">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{skill.name}</span>
                        <Select value={skill.level} onValueChange={v => updateSkillLevel(i, v as SkillLevel)} disabled={!canEdit}>
                          <select
                            value={skill.level}
                            onChange={e => updateSkillLevel(i, e.target.value as SkillLevel)}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border cursor-pointer ${skillLevelColors[skill.level]} ${!canEdit ? 'opacity-60' : ''}`}
                            disabled={!canEdit}
                          >
                            {skillLevels.map(lvl => (
                              <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                          </select>
                        </Select>
                        {canEdit && (
                          <button
                            onClick={() => removeSkill(i)}
                            className="h-4 w-4 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {canEdit && (
                  <div className="flex gap-2 items-center">
                    <Input
                      value={newHabilidad}
                      onChange={e => setNewHabilidad(e.target.value)}
                      className="h-8 text-sm flex-1"
                      placeholder="Agregar habilidad..."
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    />
                    <select
                      value={newHabilidadLevel}
                      onChange={e => setNewHabilidadLevel(e.target.value as SkillLevel)}
                      className="h-8 text-xs px-2 rounded-md border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700"
                    >
                      {skillLevels.map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={addSkill} className="shrink-0 border-sky-200 text-sky-700 hover:bg-sky-50">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                    </Button>
                  </div>
                )}
                {skillItems.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-3">No hay habilidades registradas</p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══════════════════════════════════════════
          SECTION D - Responsabilidades y Condiciones
         ═══════════════════════════════════════════ */}
      <Collapsible open={sectionOpen.D} onOpenChange={(v) => setSectionOpen(p => ({ ...p, D: v }))}>
        <Card className={`shadow-sm border-l-4 ${sectionBorderColors.D}`}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className={`flex items-center justify-center h-7 w-7 rounded-lg ${sectionBadgeColors.D} text-xs font-bold`}>D</span>
                  Responsabilidades y Condiciones
                </CardTitle>
                {sectionOpen.D ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-5">
              {/* Responsibilities with weight */}
              <div>
                <Label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-2">
                  <Shield className="h-3 w-3" /> Responsabilidades
                  <Badge variant="outline" className="text-[10px] ml-1">{responsibilityItems.length}</Badge>
                </Label>
                <div className="space-y-2">
                  {responsibilityItems.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 group transition-all hover:shadow-sm">
                      <GripVertical className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0 cursor-grab" />
                      <span className="h-5 w-5 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                      <span className="text-sm flex-1 text-slate-700 dark:text-slate-300">{r.text}</span>
                      {/* Weight indicator */}
                      <select
                        value={r.weight}
                        onChange={e => updateResponsibilityWeight(i, e.target.value as Weight)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer font-medium ${weightColors[r.weight]} ${!canEdit ? 'opacity-60' : ''}`}
                        disabled={!canEdit}
                      >
                        {weightOptions.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeResponsibility(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <div className="flex gap-2 items-center">
                      <Input
                        value={newResponsabilidad}
                        onChange={e => setNewResponsabilidad(e.target.value)}
                        className="h-8 text-sm flex-1"
                        placeholder="Agregar responsabilidad..."
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addResponsibility(); } }}
                      />
                      <select
                        value={newResponsabilidadWeight}
                        onChange={e => setNewResponsabilidadWeight(e.target.value as Weight)}
                        className="h-8 text-xs px-2 rounded-md border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700"
                      >
                        {weightOptions.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline" onClick={addResponsibility} className="shrink-0 border-purple-200 text-purple-700 hover:bg-purple-50">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                      </Button>
                    </div>
                  )}
                  {responsibilityItems.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-3">No hay responsabilidades registradas</p>
                  )}
                </div>
              </div>

              {/* Conditions with suggestions */}
              <div>
                <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Settings2 className="h-3 w-3" /> Condiciones de Trabajo
                </Label>
                <Textarea
                  value={form.condiciones_trabajo}
                  onChange={e => setForm(p => ({ ...p, condiciones_trabajo: e.target.value }))}
                  className="text-sm min-h-[80px]"
                  placeholder="Describa las condiciones de trabajo del puesto..."
                  disabled={!canEdit}
                />
                {/* Legal reference suggestions */}
                <div className="mt-2">
                  <p className="text-[10px] text-slate-400 mb-1">Referencias legales sugeridas:</p>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Art. 117 Código de Trabajo',
                      'Art. 44 Reglamento ISSS',
                      'Art. 12 Ley AFP',
                      'Decreto Riesgos Laborales',
                    ].map((ref, i) => (
                      <button
                        key={i}
                        type="button"
                        className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => canEdit && setForm(p => ({ ...p, condiciones_trabajo: p.condiciones_trabajo ? `${p.condiciones_trabajo}\n${ref}` : ref }))}
                        disabled={!canEdit}
                      >
                        {ref}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══════════════════════════════════════════
          VALUACIÓN POR PUNTOS — 4-quadrant grid
         ═══════════════════════════════════════════ */}
      <Collapsible open={sectionOpen.valuation} onOpenChange={(v) => setSectionOpen(p => ({ ...p, valuation: v }))}>
        <Card className="shadow-sm border-2 border-dashed border-emerald-300 bg-emerald-50/20 dark:bg-emerald-900/5">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-600" />
                  Valuación por Puntos
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-600 text-white text-sm px-3 py-1">
                    Total: {totalPoints} pts
                  </Badge>
                  <Badge variant="outline" className={`${gradeInfo.color} text-xs`}>
                    {gradeInfo.label}
                  </Badge>
                  {sectionOpen.valuation ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <CardDescription className="mb-4">
                Asigne puntos (0-100) para cada factor de valuación. El total determina el grado del puesto.
              </CardDescription>

              {/* 4-quadrant grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pointGroups.map(group => {
                  const colors = colorMap[group.color] || colorMap.emerald;
                  const subtotal = groupSubtotals[group.key] || 0;
                  const maxPossible = group.factors.length * 100;
                  return (
                    <div key={group.key} className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-4`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${colors.accent} text-white`}>
                            {group.icon}
                          </span>
                          <div>
                            <h4 className={`font-semibold text-sm ${colors.text}`}>{group.label}</h4>
                            <p className="text-[10px] text-slate-400">Máx. {maxPossible} pts</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`${colors.border} ${colors.text} font-mono`}>
                            {subtotal} pts
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {group.factors.map((factor, fIdx) => (
                          <div key={fIdx} className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">{factor.label}</Label>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={factor.value}
                                  onChange={e => updatePointFactor(group.key, fIdx, parseInt(e.target.value) || 0)}
                                  className="h-6 w-14 text-xs text-center font-mono border-emerald-200 dark:border-emerald-800"
                                  disabled={!canEdit}
                                />
                                <span className="text-[10px] text-slate-400">pts</span>
                              </div>
                            </div>
                            {/* Visual progress bar + slider */}
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={factor.value}
                                onChange={e => updatePointFactor(group.key, fIdx, parseInt(e.target.value))}
                                className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-emerald-500"
                                disabled={!canEdit}
                              />
                            </div>
                            {/* Visual progress bar */}
                            <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full ${colors.accent} rounded-full transition-all duration-300`}
                                style={{ width: `${factor.value}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Subtotal progress bar */}
                      <div className="mt-3 pt-3 border-t border-white/40 dark:border-slate-700/40">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>Subtotal</span>
                          <span className="font-mono">{subtotal}/{maxPossible}</span>
                        </div>
                        <div className="h-2.5 bg-white/60 dark:bg-slate-700/40 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors.accent} rounded-full transition-all duration-500`}
                            style={{ width: `${Math.min(100, (subtotal / maxPossible) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total with grade indicator */}
              <Separator className="my-5" />
              <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300">Total de Puntos de Valuación</span>
                      <p className="text-xs text-emerald-600/70">Grado del puesto basado en el puntaje total</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">{totalPoints}</span>
                    <div className="mt-1">
                      <Badge className={`${gradeInfo.color} text-xs`}>
                        {gradeInfo.label}
                      </Badge>
                    </div>
                  </div>
                </div>
                {/* Grade scale */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    { label: 'Operativo', range: '≤200', active: totalPoints <= 200, color: 'bg-slate-400' },
                    { label: 'Técnico', range: '201-400', active: totalPoints > 200 && totalPoints <= 400, color: 'bg-sky-500' },
                    { label: 'Profesional', range: '401-700', active: totalPoints > 400 && totalPoints <= 700, color: 'bg-emerald-500' },
                    { label: 'Directivo', range: '>700', active: totalPoints > 700, color: 'bg-purple-500' },
                  ].map((g, i) => (
                    <div key={i} className={`text-center p-2 rounded-lg border transition-all ${g.active ? 'border-emerald-300 bg-white dark:bg-slate-800 shadow-sm' : 'border-transparent opacity-50'}`}>
                      <div className={`h-2 rounded-full ${g.color} ${g.active ? '' : 'opacity-30'} mb-1.5`} />
                      <p className={`text-[10px] font-medium ${g.active ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>{g.label}</p>
                      <p className="text-[9px] text-slate-400">{g.range}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══════════════════════════════════════════
          VERSION HISTORY
         ═══════════════════════════════════════════ */}
      {!isNewMode && versionHistory.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              Historial de Versiones
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {versionHistory.map(v => (
                <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 text-sm">
                  <Badge variant="outline" className="text-xs shrink-0 font-mono">v{v.version}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 dark:text-slate-300 truncate">{v.cambio_descripcion}</p>
                    <p className="text-xs text-slate-400">
                      {v.creado_por ? `${v.creado_por.nombre} ${v.creado_por.apellido} • ` : ''}
                      {v.fecha_creacion ? new Date(v.fecha_creacion).toLocaleDateString('es-SV') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════
          ACTIONS
         ═══════════════════════════════════════════ */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <Button variant="outline" size="sm" onClick={() => { resetForm(); setIsNewMode(true); setSelectedPerfilId(''); }}>
          <RotateCcw className="h-4 w-4 mr-1" /> Limpiar Formulario
        </Button>
        {canEdit && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSave}
            disabled={saving || !form.nombre_puesto || !form.area_id}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {isNewMode ? 'Crear Perfil' : 'Guardar Cambios'}
          </Button>
        )}
        {!canEdit && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <AlertCircle className="h-4 w-4" />
            Solo lectura — sin permisos de edición
          </div>
        )}
      </div>
    </div>
  );
}
