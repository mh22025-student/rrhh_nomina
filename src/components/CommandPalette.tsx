'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, Users, Briefcase, Calculator, FileText, Settings, User, Shield,
  CheckCircle, Send, Gift, ClipboardList, ListChecks, BarChart3, BookOpen,
  GitBranch, Plug, ScrollText, Eye, LayoutDashboard, DollarSign,
  ArrowRight, Loader2, Clock, Hash, LogOut, Plus, X
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

// ============================================================
// Types
// ============================================================
type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

type ViewId =
  | 'dashboard'
  | '02-01' | '02-02' | '02-03' | '02-04'
  | '03-01' | '03-02' | '03-03'
  | '04-01' | '04-02' | '04-03' | '04-04' | '04-05' | '04-06' | '04-07'
  | '05-01' | '05-02' | '05-03' | '05-04'
  | '06-01' | '06-02' | '06-03' | '06-04' | '06-05'
  | '01-03';

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  roles: UserRole[];
}

interface EmployeeResult {
  id: string;
  codigo_empleado: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  dui: string;
  area?: { nombre: string };
  perfil_puesto?: { nombre_puesto: string };
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (viewId: ViewId) => void;
  onNavigateToEmployee: (employeeId: string) => void;
  onLogout: () => void;
  accessToken: string | null;
  userRole: UserRole;
}

// ============================================================
// Navigation Configuration (mirrors page.tsx)
// ============================================================
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Seguridad',
    icon: Shield,
    roles: ['ADMIN'],
    items: [
      { id: '01-03', label: 'Gestión Usuarios', icon: Users },
    ],
  },
  {
    title: 'Módulo 02 - Empleados',
    icon: Users,
    roles: ['ADMIN', 'ANALISTA', 'AUDITOR'],
    items: [
      { id: '02-01', label: 'Directorio', icon: ListChecks },
      { id: '02-03', label: 'Nuevo Empleado', icon: User },
      { id: '02-04', label: 'Incidencias', icon: ClipboardList },
    ],
  },
  {
    title: 'Módulo 03 - Perfiles',
    icon: Briefcase,
    roles: ['ADMIN', 'ANALISTA', 'APROBADOR', 'AUDITOR'],
    items: [
      { id: '03-01', label: 'Catálogo', icon: BookOpen },
      { id: '03-02', label: 'Formulario de Perfil', icon: FileText },
      { id: '03-03', label: 'Bandas Salariales', icon: DollarSign },
    ],
  },
  {
    title: 'Módulo 04 - Nómina',
    icon: Calculator,
    roles: ['ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR'],
    items: [
      { id: '04-01', label: 'Dashboard', icon: LayoutDashboard },
      { id: '04-02', label: 'Períodos', icon: CalendarIcon },
      { id: '04-03', label: 'Cálculo', icon: Calculator },
      { id: '04-04', label: 'Aprobación', icon: CheckCircle },
      { id: '04-05', label: 'Dispersión', icon: Send },
      { id: '04-06', label: 'Aguinaldo', icon: Gift },
      { id: '04-07', label: 'Liquidaciones', icon: ClipboardList },
    ],
  },
  {
    title: 'Módulo 05 - Reportes',
    icon: FileText,
    roles: ['ADMIN', 'GERENCIA', 'AUDITOR'],
    items: [
      { id: '05-01', label: 'Planilla ISSS', icon: FileText },
      { id: '05-02', label: 'Planilla AFP', icon: FileText },
      { id: '05-03', label: 'Retenciones ISR', icon: FileText },
      { id: '05-04', label: 'Gestión Talento', icon: BarChart3 },
    ],
  },
  {
    title: 'Módulo 06 - Admin',
    icon: Settings,
    roles: ['ADMIN', 'APROBADOR'],
    items: [
      { id: '06-01', label: 'Parámetros Legales', icon: ScaleIcon },
      { id: '06-02', label: 'Organigrama', icon: GitBranch },
      { id: '06-03', label: 'Integraciones', icon: Plug },
      { id: '06-04', label: 'Bitácora', icon: ScrollText },
    ],
  },
  {
    title: 'Vista Empleado',
    icon: User,
    roles: ['EMPLEADO'],
    items: [
      { id: '06-05', label: 'Mi Portal', icon: Eye },
    ],
  },
];

// RBAC item filter (mirrors page.tsx)
function getVisibleItems(group: NavGroup, role: UserRole): NavItem[] {
  const roleItemMap: Record<UserRole, Record<string, string[]>> = {
    ADMIN: {
      'Seguridad': ['01-03'],
      'Módulo 02 - Empleados': ['02-01', '02-03', '02-04'],
      'Módulo 03 - Perfiles': ['03-01', '03-02', '03-03'],
      'Módulo 04 - Nómina': ['04-01', '04-02', '04-03', '04-04', '04-05', '04-06', '04-07'],
      'Módulo 05 - Reportes': ['05-01', '05-02', '05-03', '05-04'],
      'Módulo 06 - Admin': ['06-01', '06-02', '06-03', '06-04'],
      'Vista Empleado': [],
    },
    ANALISTA: {
      'Módulo 02 - Empleados': ['02-01', '02-03', '02-04'],
      'Módulo 03 - Perfiles': ['03-01', '03-02'],
      'Módulo 04 - Nómina': ['04-01', '04-02', '04-03', '04-06'],
    },
    APROBADOR: {
      'Módulo 03 - Perfiles': ['03-03'],
      'Módulo 04 - Nómina': ['04-04', '04-05', '04-07'],
      'Módulo 06 - Admin': ['06-01'],
    },
    GERENCIA: {
      'Módulo 04 - Nómina': ['04-01'],
      'Módulo 05 - Reportes': ['05-01', '05-02', '05-03', '05-04'],
    },
    AUDITOR: {
      'Módulo 02 - Empleados': ['02-01'],
      'Módulo 03 - Perfiles': ['03-01'],
      'Módulo 04 - Nómina': ['04-01', '04-02', '04-03'],
      'Módulo 05 - Reportes': ['05-01', '05-02', '05-03', '05-04'],
      'Módulo 06 - Admin': ['06-04'],
    },
    EMPLEADO: {
      'Vista Empleado': ['06-05'],
    },
  };

  const allowedIds = roleItemMap[role]?.[group.title] ?? [];
  return group.items.filter(item => allowedIds.includes(item.id));
}

// Module badge color map
const MODULE_COLORS: Record<string, string> = {
  'Seguridad': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Módulo 02 - Empleados': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Módulo 03 - Perfiles': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'Módulo 04 - Nómina': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Módulo 05 - Reportes': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'Módulo 06 - Admin': 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  'Vista Empleado': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

// Short module labels for badges
const MODULE_SHORT: Record<string, string> = {
  'Seguridad': 'SEGURIDAD',
  'Módulo 02 - Empleados': 'EMPLEADOS',
  'Módulo 03 - Perfiles': 'PERFILES',
  'Módulo 04 - Nómina': 'NÓMINA',
  'Módulo 05 - Reportes': 'REPORTES',
  'Módulo 06 - Admin': 'ADMIN',
  'Vista Empleado': 'EMPLEADO',
};

// Quick actions
interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  viewId?: ViewId;
  action?: 'logout';
  roles: UserRole[];
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'qa-calcular',
    label: 'Calcular Nómina',
    description: 'Ir al cálculo de nómina',
    icon: Calculator,
    viewId: '04-03',
    roles: ['ADMIN', 'ANALISTA', 'AUDITOR'],
  },
  {
    id: 'qa-nuevo-empleado',
    label: 'Nuevo Empleado',
    description: 'Crear nuevo empleado',
    icon: Plus,
    viewId: '02-03',
    roles: ['ADMIN', 'ANALISTA'],
  },
  {
    id: 'qa-aprobar',
    label: 'Aprobar Nómina',
    description: 'Ir a aprobación de nómina',
    icon: CheckCircle,
    viewId: '04-04',
    roles: ['ADMIN', 'APROBADOR'],
  },
  {
    id: 'qa-dispersar',
    label: 'Dispersar Pago',
    description: 'Ir a dispersión bancaria',
    icon: Send,
    viewId: '04-05',
    roles: ['ADMIN', 'APROBADOR'],
  },
  {
    id: 'qa-directorio',
    label: 'Ver Directorio',
    description: 'Directorio de empleados',
    icon: Users,
    viewId: '02-01',
    roles: ['ADMIN', 'ANALISTA', 'AUDITOR'],
  },
  {
    id: 'qa-periodos',
    label: 'Períodos de Nómina',
    description: 'Gestionar períodos',
    icon: CalendarIcon,
    viewId: '04-02',
    roles: ['ADMIN', 'ANALISTA', 'AUDITOR'],
  },
  {
    id: 'qa-dashboard',
    label: 'Dashboard',
    description: 'Volver al dashboard principal',
    icon: LayoutDashboard,
    viewId: 'dashboard',
    roles: ['ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR', 'EMPLEADO'],
  },
  {
    id: 'qa-logout',
    label: 'Cerrar Sesión',
    description: 'Salir del sistema',
    icon: LogOut,
    action: 'logout',
    roles: ['ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR', 'EMPLEADO'],
  },
];

// ============================================================
// Custom Icons (mirrors page.tsx)
// ============================================================
function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  );
}

function ScaleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 3h5v5"/>
      <path d="M8 3H3v5"/>
      <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/>
      <path d="m15 9 6-6"/>
    </svg>
  );
}

// ============================================================
// Recent Searches Helper
// ============================================================
const RECENT_KEY = 'nomina-cmd-recent';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(term: string) {
  if (!term.trim()) return;
  try {
    const current = getRecentSearches().filter(t => t !== term);
    const updated = [term, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

// ============================================================
// Command Palette Component
// ============================================================
export default function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onNavigateToEmployee,
  onLogout,
  accessToken,
  userRole,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<EmployeeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Reset search when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSearch('');
      setEmployees([]);
      setRecentSearches(getRecentSearches());
    }
  }, [open]);

  // Debounced employee search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!search.trim() || search.length < 2) {
      setEmployees([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/empleados?search=${encodeURIComponent(search)}&pageSize=8`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.data || []);
        } else {
          setEmployees([]);
        }
      } catch {
        setEmployees([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, accessToken]);

  // Handle navigation item selection
  const handleNavSelect = useCallback((viewId: string) => {
    addRecentSearch(search);
    onOpenChange(false);
    onNavigate(viewId as ViewId);
  }, [search, onNavigate, onOpenChange]);

  // Handle employee selection
  const handleEmployeeSelect = useCallback((employeeId: string) => {
    addRecentSearch(search);
    onOpenChange(false);
    onNavigateToEmployee(employeeId);
  }, [search, onNavigateToEmployee, onOpenChange]);

  // Handle quick action selection
  const handleQuickAction = useCallback((action: QuickAction) => {
    addRecentSearch(search);
    onOpenChange(false);
    if (action.action === 'logout') {
      onLogout();
    } else if (action.viewId) {
      onNavigate(action.viewId);
    }
  }, [search, onNavigate, onLogout, onOpenChange]);

  // Handle recent search click
  const handleRecentSearch = useCallback((term: string) => {
    setSearch(term);
  }, []);

  // Get visible navigation items grouped by module
  const visibleNavGroups = useMemo(() => {
    return NAV_GROUPS
      .filter(group => group.roles.includes(userRole))
      .map(group => ({
        ...group,
        items: getVisibleItems(group, userRole),
      }))
      .filter(group => group.items.length > 0);
  }, [userRole]);

  // Get visible quick actions
  const visibleQuickActions = useMemo(() => {
    return QUICK_ACTIONS.filter(action => action.roles.includes(userRole));
  }, [userRole]);

  // Format employee name
  const formatEmployeeName = (emp: EmployeeResult) => {
    const parts = [emp.primer_nombre, emp.segundo_nombre, emp.primer_apellido, emp.segundo_apellido];
    return parts.filter(Boolean).join(' ');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />

      {/* Command Palette Dialog */}
      <div className="fixed inset-x-0 top-[10%] mx-auto w-full max-w-xl px-4 z-[61]">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl dark:shadow-slate-900/50 animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-700">
            <Search className="h-5 w-5 text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              autoFocus
              placeholder="Buscar vistas, empleados, acciones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 h-12 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            />
            {isSearching && (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[420px] overflow-y-auto overscroll-contain custom-scrollbar">
            {/* No results */}
            {search.length >= 2 && employees.length === 0 && !isSearching && visibleNavGroups.every(g =>
              g.items.every(item => !item.label.toLowerCase().includes(search.toLowerCase()))
            ) && visibleQuickActions.every(a =>
              !a.label.toLowerCase().includes(search.toLowerCase())
            ) && (
              <div className="py-8 text-center">
                <Search className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No se encontraron resultados</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Intenta con otro término de búsqueda</p>
              </div>
            )}

            {/* Recent searches (when no active search) */}
            {!search && recentSearches.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Búsquedas recientes</span>
                </div>
                {recentSearches.map((term, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRecentSearch(term)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="flex-1 text-left truncate">{term}</span>
                    <ArrowRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                  </button>
                ))}
              </div>
            )}

            {/* Navigation Groups */}
            {visibleNavGroups.map(group => {
              const filteredItems = search
                ? group.items.filter(item =>
                    item.label.toLowerCase().includes(search.toLowerCase())
                  )
                : group.items;

              if (filteredItems.length === 0) return null;

              return (
                <div key={group.title} className="p-2">
                  <div className="px-2 py-1.5 flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Navegación</span>
                    <Badge
                      variant="secondary"
                      className={`text-[9px] px-1.5 py-0 border-0 ${MODULE_COLORS[group.title] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {MODULE_SHORT[group.title] || group.title}
                    </Badge>
                  </div>
                  {filteredItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavSelect(item.id)}
                        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer group"
                      >
                        <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0" />
                        <span className="flex-1 text-left">{item.label}</span>
                        <Badge
                          variant="outline"
                          className="text-[9px] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 shrink-0"
                        >
                          {item.id}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Employee Results */}
            {(employees.length > 0 || isSearching) && search.length >= 2 && (
              <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                <div className="px-2 py-1.5 flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Empleados</span>
                  {isSearching && (
                    <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                  )}
                </div>
                {employees.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => handleEmployeeSelect(emp.id)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer group"
                  >
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate">
                        {formatEmployeeName(emp)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {emp.codigo_empleado} · {emp.dui}
                        {emp.area && ` · ${emp.area.nombre}`}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
                {employees.length === 0 && isSearching && (
                  <div className="px-2 py-3 text-center">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500 mx-auto" />
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            {visibleQuickActions.filter(action =>
              !search || action.label.toLowerCase().includes(search.toLowerCase()) || action.description.toLowerCase().includes(search.toLowerCase())
            ).length > 0 && (
              <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                <div className="px-2 py-1.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Acciones rápidas</span>
                </div>
                {visibleQuickActions
                  .filter(action =>
                    !search || action.label.toLowerCase().includes(search.toLowerCase()) || action.description.toLowerCase().includes(search.toLowerCase())
                  )
                  .map(action => {
                    const Icon = action.icon;
                    const isLogout = action.action === 'logout';
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleQuickAction(action)}
                        className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors cursor-pointer group ${
                          isLogout
                            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${
                          isLogout
                            ? 'text-red-400 dark:text-red-500'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                        }`} />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">{action.label}</p>
                          <p className={`text-xs ${isLogout ? 'text-red-400 dark:text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                            {action.description}
                          </p>
                        </div>
                        {action.viewId && (
                          <Badge
                            variant="outline"
                            className="text-[9px] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 shrink-0"
                          >
                            {action.viewId}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Footer with hints */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1 py-0.5">↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1 py-0.5">↵</kbd>
                seleccionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1 py-0.5">esc</kbd>
                cerrar
              </span>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1 py-0.5">⌘K</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
