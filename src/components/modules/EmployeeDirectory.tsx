'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, Users, Loader2, ChevronLeft, ChevronRight,
  User, SearchX, FileDown, FileSpreadsheet, ChevronDown,
  UserCheck, DollarSign, Building2, UserX, Eye, Pencil,
  Calendar, X, Filter, UserPlus, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip';

type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

interface EmployeeDirectoryProps {
  accessToken: string | null;
  userRole: UserRole;
  onNavigateToDetail: (empleadoId: string) => void;
  onNavigateToNew: () => void;
}

interface Area {
  id: string;
  nombre: string;
  codigo: string;
}

interface PerfilPuesto {
  id: string;
  nombre_puesto: string;
  codigo: string;
}

interface Empleado {
  id: string;
  codigo_empleado: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  dui: string;
  estado: string;
  salario_base: number;
  fecha_ingreso: string;
  area: Area | null;
  perfil_puesto: PerfilPuesto | null;
}

const AVATAR_GRADIENTS = [
  'from-emerald-400 to-teal-500',
  'from-teal-400 to-cyan-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-violet-400 to-purple-500',
  'from-cyan-400 to-emerald-500',
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(emp: Empleado): string {
  return (emp.primer_nombre?.[0] || '') + (emp.primer_apellido?.[0] || '');
}

export default function EmployeeDirectory({ accessToken, userRole, onNavigateToDetail, onNavigateToNew }: EmployeeDirectoryProps) {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [perfiles, setPerfiles] = useState<PerfilPuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [perfilFilter, setPerfilFilter] = useState('all');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 0 });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));
      if (search) params.set('search', search);
      if (areaFilter && areaFilter !== 'all') params.set('area_id', areaFilter);
      if (estadoFilter && estadoFilter !== 'all') params.set('estado', estadoFilter);
      if (perfilFilter && perfilFilter !== 'all') params.set('perfil_puesto_id', perfilFilter);

      const res = await fetch(`/api/empleados?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.data);
        setPagination(prev => ({
          ...data.pagination,
          pageSize: prev.pageSize,
        }));
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, pagination.page, pagination.pageSize, search, areaFilter, estadoFilter, perfilFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Fetch areas and perfiles for filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [areasRes, perfilesRes] = await Promise.all([
          fetch('/api/areas', { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch('/api/perfiles-puesto', { headers: { Authorization: `Bearer ${accessToken}` } }),
        ]);
        if (areasRes.ok) {
          const areasData = await areasRes.json();
          setAreas(areasData.data || areasData || []);
        }
        if (perfilesRes.ok) {
          const perfilesData = await perfilesRes.json();
          setPerfiles(perfilesData.data || perfilesData || []);
        }
      } catch {
        // Filters may fail silently
      }
    };
    fetchFilters();
  }, [accessToken]);

  // Summary stats computed from current data
  const stats = useMemo(() => {
    const total = pagination.total;
    const activos = employees.filter(e => e.estado === 'ACTIVO').length;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nuevos = employees.filter(e => {
      if (!e.fecha_ingreso) return false;
      const fecha = new Date(e.fecha_ingreso);
      return fecha >= startOfMonth;
    }).length;
    const avgSalary = employees.length > 0
      ? employees.reduce((sum, e) => sum + e.salario_base, 0) / employees.length
      : 0;
    return { total, activos, nuevos, avgSalary };
  }, [employees, pagination.total]);

  const formatSalary = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getNombreCompleto = (emp: Empleado) =>
    `${emp.primer_nombre}${emp.segundo_nombre ? ' ' + emp.segundo_nombre : ''} ${emp.primer_apellido}${emp.segundo_apellido ? ' ' + emp.segundo_apellido : ''}`;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-SV', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const exportCSV = () => {
    const headers = ['Código', 'Nombre Completo', 'DUI', 'Área', 'Puesto', 'Salario (USD)', 'Estado', 'Fecha de Ingreso'];
    const rows = employees.map(emp => [
      emp.codigo_empleado,
      `"${getNombreCompleto(emp)}"`,
      emp.dui,
      emp.area?.nombre || '',
      emp.perfil_puesto?.nombre_puesto || '',
      emp.salario_base.toFixed(2),
      emp.estado,
      emp.fecha_ingreso ? new Date(emp.fecha_ingreso).toLocaleDateString('es-SV') : '',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `directorio_empleados_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = ['Código', 'Nombre Completo', 'DUI', 'Área', 'Puesto', 'Salario (USD)', 'Estado', 'Fecha de Ingreso'];
    const rows = employees.map(emp => [
      emp.codigo_empleado,
      `"${getNombreCompleto(emp)}"`,
      emp.dui,
      emp.area?.nombre || '',
      emp.perfil_puesto?.nombre_puesto || '',
      emp.salario_base.toFixed(2),
      emp.estado,
      emp.fecha_ingreso ? new Date(emp.fecha_ingreso).toLocaleDateString('es-SV') : '',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `directorio_empleados_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch('');
    setAreaFilter('all');
    setEstadoFilter('all');
    setPerfilFilter('all');
    setPagination(p => ({ ...p, page: 1 }));
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (areaFilter !== 'all') count++;
    if (estadoFilter !== 'all') count++;
    if (perfilFilter !== 'all') count++;
    return count;
  }, [search, areaFilter, estadoFilter, perfilFilter]);

  const canCreate = userRole === 'ADMIN' || userRole === 'ANALISTA';
  const canEdit = userRole === 'ADMIN' || userRole === 'ANALISTA';

  const getEstadoBadge = (estado: string) => {
    if (estado === 'ACTIVO') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    if (estado === 'INACTIVO') return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  };

  // Salary range max for progress bar
  const SALARY_MAX = 5000;

  // Compute pagination display
  const pageStart = ((pagination.page - 1) * pagination.pageSize) + 1;
  const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
      <div className="relative mb-6">
        <div className="p-5 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700">
          <SearchX className="h-16 w-16 text-slate-300 dark:text-slate-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-white dark:bg-slate-800 shadow-md">
          <Filter className="h-5 w-5 text-slate-400 dark:text-slate-500" />
        </div>
      </div>
      <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">No se encontraron empleados</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5 max-w-xs text-center">
        No hay resultados para los filtros actuales. Pruebe ajustando la búsqueda o los filtros.
      </p>
      {activeFilterCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="mt-5 text-sm border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-all duration-200"
          onClick={clearFilters}
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Limpiar Filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Enhanced Header Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 dark:from-emerald-800 dark:via-emerald-900 dark:to-teal-900 p-6 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-teal-400/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-400/20 to-transparent rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Users className="h-7 w-7" />
              Directorio de Empleados
            </h2>
            <p className="text-emerald-100/80 mt-1 text-sm">
              {pagination.total} empleado{pagination.total !== 1 ? 's' : ''} registrado{pagination.total !== 1 ? 's' : ''} en el sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" disabled={employees.length === 0} className="bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm">
                  <FileDown className="h-4 w-4 mr-1.5" /> Exportar <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSV}>
                  <FileDown className="h-4 w-4 mr-2 text-slate-500" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canCreate && (
              <Button size="sm" className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-lg shadow-emerald-900/20" onClick={onNavigateToNew}>
                <Plus className="h-4 w-4 mr-1.5" /> Nuevo Empleado
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-900/20 dark:to-emerald-800/10 hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 font-medium">Total Empleados</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-gradient-to-br from-teal-50 to-teal-100/60 dark:from-teal-900/20 dark:to-teal-800/10 hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-400 to-teal-500 shadow-sm">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-teal-700/70 dark:text-teal-400/70 font-medium">Activos</p>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 leading-tight">{stats.activos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-gradient-to-br from-cyan-50 to-cyan-100/60 dark:from-cyan-900/20 dark:to-cyan-800/10 hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-500 shadow-sm">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-cyan-700/70 dark:text-cyan-400/70 font-medium">Nuevos este mes</p>
              <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300 leading-tight">{stats.nuevos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-900/20 dark:to-amber-800/10 hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-amber-700/70 dark:text-amber-400/70 font-medium">Salario Promedio</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 leading-tight">${stats.avgSalary.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <div className="sm:col-span-2 lg:col-span-1 xl:col-span-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nombre, DUI, código..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                  className="pl-9 h-9 border-slate-200 dark:border-slate-700 focus:border-emerald-400 focus:ring-emerald-400 bg-white dark:bg-slate-800"
                />
              </div>
              <Select value={areaFilter} onValueChange={(v) => { setAreaFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
                <SelectTrigger className="h-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <Building2 className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={estadoFilter} onValueChange={(v) => { setEstadoFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
                <SelectTrigger className="h-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <UserCheck className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="INACTIVO">Inactivo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={perfilFilter} onValueChange={(v) => { setPerfilFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
                <SelectTrigger className="h-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <User className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Puesto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los puestos</SelectItem>
                  {perfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_puesto}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Active Filter Chips */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  Filtros activos:
                </span>
                {search && (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 gap-1 pr-1.5">
                    &quot;{search}&quot;
                    <button onClick={() => { setSearch(''); setPagination(p => ({ ...p, page: 1 })); }} className="ml-0.5 p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {areaFilter !== 'all' && (
                  <Badge variant="secondary" className="bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 gap-1 pr-1.5">
                    {areas.find(a => a.id === areaFilter)?.nombre || 'Área'}
                    <button onClick={() => { setAreaFilter('all'); setPagination(p => ({ ...p, page: 1 })); }} className="ml-0.5 p-0.5 rounded-full hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {estadoFilter !== 'all' && (
                  <Badge variant="secondary" className="bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800 gap-1 pr-1.5">
                    {estadoFilter}
                    <button onClick={() => { setEstadoFilter('all'); setPagination(p => ({ ...p, page: 1 })); }} className="ml-0.5 p-0.5 rounded-full hover:bg-cyan-200 dark:hover:bg-cyan-800 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {perfilFilter !== 'all' && (
                  <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 gap-1 pr-1.5">
                    {perfiles.find(p => p.id === perfilFilter)?.nombre_puesto || 'Puesto'}
                    <button onClick={() => { setPerfilFilter('all'); setPagination(p => ({ ...p, page: 1 })); }} className="ml-0.5 p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors duration-200"
                  onClick={clearFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpiar todo
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table */}
      <Card className="shadow-sm hidden lg:block overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-800 dark:to-teal-800 hover:from-emerald-600 hover:to-teal-600 dark:hover:from-emerald-800 dark:hover:to-teal-800">
                <TableHead className="text-white/90 font-semibold">Código</TableHead>
                <TableHead className="text-white/90 font-semibold">Nombre Completo</TableHead>
                <TableHead className="text-white/90 font-semibold">Área</TableHead>
                <TableHead className="text-white/90 font-semibold">Puesto</TableHead>
                <TableHead className="text-white/90 font-semibold text-right">Salario</TableHead>
                <TableHead className="text-white/90 font-semibold">Estado</TableHead>
                <TableHead className="text-white/90 font-semibold">Ingreso</TableHead>
                <TableHead className="text-white/90 font-semibold text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="border-b-0">
                    <EmptyState />
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp, idx) => {
                  const fullName = getNombreCompleto(emp);
                  const gradient = getAvatarGradient(fullName);
                  const salaryPercent = Math.min((emp.salario_base / SALARY_MAX) * 100, 100);
                  return (
                    <TableRow
                      key={emp.id}
                      className={`cursor-pointer group transition-all duration-200 border-l-4 border-l-transparent hover:border-l-emerald-500 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20 hover:shadow-sm ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}
                      onClick={() => onNavigateToDetail(emp.id)}
                    >
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">{emp.codigo_empleado}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 shadow-sm">
                            <AvatarFallback className={`bg-gradient-to-br ${gradient} text-white text-xs font-semibold`}>
                              {getInitials(emp)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {emp.area ? (
                          <Badge variant="secondary" className="text-[11px] bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800">
                            {emp.area.nombre}
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">{emp.perfil_puesto?.nombre_puesto || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{formatSalary(emp.salario_base)}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">USD</span>
                          </div>
                          <Progress
                            value={salaryPercent}
                            className="h-1 w-16 bg-slate-100 dark:bg-slate-700 [&>[data-slot=progress-indicator]]:bg-emerald-500"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {emp.estado === 'ACTIVO' ? (
                          <Badge className="text-[10px] border bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" variant="secondary">
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-500 animate-pulse" />
                            ACTIVO
                          </Badge>
                        ) : emp.estado === 'INACTIVO' ? (
                          <Badge className="text-[10px] border bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 font-semibold" variant="secondary">
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-red-500" />
                            INACTIVO
                          </Badge>
                        ) : (
                          <Badge className={`text-[10px] border ${getEstadoBadge(emp.estado)}`} variant="secondary">
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-slate-400" />
                            {emp.estado}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {formatDate(emp.fecha_ingreso)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => onNavigateToDetail(emp.id)} className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-all duration-200">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalle</TooltipContent>
                          </Tooltip>
                          {canEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => onNavigateToDetail(emp.id)} className="h-8 w-8 p-0 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/30 transition-all duration-200">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Card Layout */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))
        ) : employees.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <EmptyState />
            </CardContent>
          </Card>
        ) : (
          employees.map(emp => {
            const fullName = getNombreCompleto(emp);
            const gradient = getAvatarGradient(fullName);
            const salaryPercent = Math.min((emp.salario_base / SALARY_MAX) * 100, 100);
            return (
              <Card
                key={emp.id}
                className="shadow-sm cursor-pointer hover:shadow-md active:scale-[0.99] transition-all duration-200 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 overflow-hidden"
                onClick={() => onNavigateToDetail(emp.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0 shadow-sm">
                        <AvatarFallback className={`bg-gradient-to-br ${gradient} text-white text-sm font-semibold`}>
                          {getInitials(emp)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{fullName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{emp.codigo_empleado} · DUI: {emp.dui}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {emp.area && (
                            <Badge variant="secondary" className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800">
                              {emp.area.nombre}
                            </Badge>
                          )}
                          {emp.perfil_puesto && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">{emp.perfil_puesto.nombre_puesto}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {emp.estado === 'ACTIVO' ? (
                      <Badge className="text-[10px] border shrink-0 ml-2 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" variant="secondary">
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 bg-emerald-500 animate-pulse" />
                        ACTIVO
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] border shrink-0 ml-2 bg-red-100 text-red-700 border-red-200 font-semibold dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" variant="secondary">
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 bg-red-500" />
                        INACTIVO
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">{formatSalary(emp.salario_base)}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">USD</span>
                      </div>
                      <Progress
                        value={salaryPercent}
                        className="h-1 w-14 mt-1 bg-slate-100 dark:bg-slate-700 [&>[data-slot=progress-indicator]]:bg-emerald-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      {emp.fecha_ingreso && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(emp.fecha_ingreso)}
                        </span>
                      )}
                      <Button variant="ghost" size="sm" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 h-7 text-xs transition-all duration-200">
                        Ver detalle →
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Enhanced Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-2">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {pagination.total > 0
              ? `Mostrando ${pageStart}–${pageEnd} de ${pagination.total} empleados`
              : 'No hay empleados'
            }
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 dark:text-slate-500">Filas:</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(v) => setPagination(p => ({ ...p, pageSize: Number(v), page: 1 }))}
            >
              <SelectTrigger className="h-7 w-[65px] text-xs border-slate-200 dark:border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              className="h-8 w-8 p-0 dark:border-slate-700 transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }
                const isCurrent = pagination.page === pageNum;
                return (
                  <Button
                    key={pageNum}
                    variant={isCurrent ? 'default' : 'outline'}
                    size="sm"
                    className={`h-8 w-8 p-0 font-medium transition-all duration-200 ${isCurrent ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' : 'dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400'}`}
                    onClick={() => setPagination(p => ({ ...p, page: pageNum }))}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline" size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              className="h-8 w-8 p-0 dark:border-slate-700 transition-all duration-200"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
