'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, Users, Loader2, ChevronLeft, ChevronRight,
  User, SearchX, FileDown, FileSpreadsheet, ChevronDown,
  UserCheck, DollarSign, Building2, UserX
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
  area: Area | null;
  perfil_puesto: PerfilPuesto | null;
}

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
        setPagination(data.pagination);
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
    const avgSalary = employees.length > 0
      ? employees.reduce((sum, e) => sum + e.salario_base, 0) / employees.length
      : 0;
    const uniqueAreas = new Set(employees.map(e => e.area?.nombre).filter(Boolean)).size;
    return { total, activos, avgSalary, uniqueAreas };
  }, [employees, pagination.total]);

  const formatSalary = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getNombreCompleto = (emp: Empleado) =>
    `${emp.primer_nombre}${emp.segundo_nombre ? ' ' + emp.segundo_nombre : ''} ${emp.primer_apellido}${emp.segundo_apellido ? ' ' + emp.segundo_apellido : ''}`;

  const exportCSV = () => {
    const headers = ['Código', 'Nombre Completo', 'DUI', 'Área', 'Puesto', 'Salario', 'Estado'];
    const rows = employees.map(emp => [
      emp.codigo_empleado,
      getNombreCompleto(emp),
      emp.dui,
      emp.area?.nombre || '',
      emp.perfil_puesto?.nombre_puesto || '',
      emp.salario_base.toString(),
      emp.estado,
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `empleados_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    // For now, export as CSV with Excel-friendly BOM
    const headers = ['Código', 'Nombre Completo', 'DUI', 'Área', 'Puesto', 'Salario', 'Estado'];
    const rows = employees.map(emp => [
      emp.codigo_empleado,
      getNombreCompleto(emp),
      emp.dui,
      emp.area?.nombre || '',
      emp.perfil_puesto?.nombre_puesto || '',
      emp.salario_base.toString(),
      emp.estado,
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `empleados_${new Date().toISOString().slice(0, 10)}.csv`;
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

  const canCreate = userRole === 'ADMIN' || userRole === 'ANALISTA';

  const getEstadoBadge = (estado: string) => {
    if (estado === 'ACTIVO') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    if (estado === 'INACTIVO') return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  };

  // Salary range max for progress bar
  const SALARY_MAX = 5000;

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
      <div className="p-6 rounded-full bg-slate-50 dark:bg-slate-800 mb-5">
        <SearchX className="h-14 w-14 text-slate-300 dark:text-slate-600" />
      </div>
      <p className="text-base font-semibold text-slate-600 dark:text-slate-300">No se encontraron empleados</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5 max-w-xs text-center">
        No hay resultados para los filtros actuales. Pruebe ajustando la búsqueda o los filtros.
      </p>
      {(search || areaFilter !== 'all' || estadoFilter !== 'all' || perfilFilter !== 'all') && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 text-sm border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
          onClick={clearFilters}
        >
          Limpiar Filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Directorio de Empleados
            <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold ml-1">
              {pagination.total}
            </Badge>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {pagination.total} empleado{pagination.total !== 1 ? 's' : ''} registrado{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={employees.length === 0}>
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
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onNavigateToNew}>
              <Plus className="h-4 w-4 mr-1.5" /> Nuevo Empleado
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 font-medium">Total Empleados</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-900/20 dark:to-teal-800/10">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10 dark:bg-teal-500/20">
              <UserCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-teal-700/70 dark:text-teal-400/70 font-medium">Activos</p>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 leading-tight">{stats.activos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-900/20 dark:to-sky-800/10">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 dark:bg-sky-500/20">
              <DollarSign className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-sky-700/70 dark:text-sky-400/70 font-medium">Salario Promedio</p>
              <p className="text-2xl font-bold text-sky-700 dark:text-sky-300 leading-tight">${stats.avgSalary.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-800/10">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10 dark:bg-violet-500/20">
              <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-violet-700/70 dark:text-violet-400/70 font-medium">Áreas</p>
              <p className="text-2xl font-bold text-violet-700 dark:text-violet-300 leading-tight">{stats.uniqueAreas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
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
              <SelectTrigger className="h-9"><SelectValue placeholder="Área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estadoFilter} onValueChange={(v) => { setEstadoFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="ACTIVO">Activo</SelectItem>
                <SelectItem value="INACTIVO">Inactivo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={perfilFilter} onValueChange={(v) => { setPerfilFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Puesto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los puestos</SelectItem>
                {perfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_puesto}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table */}
      <Card className="shadow-sm hidden lg:block overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/30">
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Nombre Completo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead className="text-right">Salario</TableHead>
                <TableHead className="w-[110px]">Estado</TableHead>
                <TableHead className="w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="border-b-0">
                    <EmptyState />
                  </TableCell>
                </TableRow>
              ) : (
                employees.map(emp => {
                  const fullName = getNombreCompleto(emp);
                  const avatarColor = getAvatarColor(fullName);
                  const salaryPercent = Math.min((emp.salario_base / SALARY_MAX) * 100, 100);
                  return (
                    <TableRow
                      key={emp.id}
                      className="cursor-pointer group border-l-4 border-l-transparent hover:border-l-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all duration-200 border-b border-slate-100 dark:border-slate-800"
                      onClick={() => onNavigateToDetail(emp.id)}
                    >
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">{emp.codigo_empleado}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={`${avatarColor} text-white text-xs font-semibold`}>
                              {getInitials(emp)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">{emp.area?.nombre || '—'}</TableCell>
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
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onNavigateToDetail(emp.id); }} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30">
                          <User className="h-4 w-4" />
                        </Button>
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
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
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
            const avatarColor = getAvatarColor(fullName);
            const salaryPercent = Math.min((emp.salario_base / SALARY_MAX) * 100, 100);
            return (
              <Card key={emp.id} className="shadow-sm cursor-pointer hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-emerald-500 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/50" onClick={() => onNavigateToDetail(emp.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className={`${avatarColor} text-white text-xs font-semibold`}>
                          {getInitials(emp)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{fullName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{emp.codigo_empleado} · DUI: {emp.dui}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">{emp.area?.nombre || 'Sin área'} — {emp.perfil_puesto?.nombre_puesto || 'Sin puesto'}</p>
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
                    <Button variant="ghost" size="sm" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                      Ver detalle →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        {pagination.totalPages > 1 ? (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Mostrando {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="h-8 w-8 p-0 dark:border-slate-700"
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
                  return (
                    <Button
                      key={pageNum}
                      variant={pagination.page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      className={`h-8 w-8 p-0 ${pagination.page === pageNum ? 'bg-emerald-600 hover:bg-emerald-700' : 'dark:border-slate-700'}`}
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
                className="h-8 w-8 p-0 dark:border-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {pagination.total > 0 && `${pagination.total} empleado${pagination.total !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>
    </div>
  );
}
