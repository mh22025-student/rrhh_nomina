'use client';

import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import {
  Users, Briefcase, Calculator, FileText, Settings, User, Shield,
  ChevronDown, ChevronRight, LogOut, Lock, Menu, X, LayoutDashboard,
  DollarSign, CheckCircle, Send, Gift, ClipboardList, ListChecks,
  BarChart3, BookOpen, GitBranch, Plug, ScrollText, Eye, EyeOff, Mail,
  AlertCircle, Loader2, KeyRound, ArrowLeft, Plus, XCircle,
  Sun, Moon, TrendingUp, TrendingDown, Bell, Info, AlertTriangle,
  PieChart, CalendarDays, Megaphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';

// Module components
import EmployeeDirectory from '@/components/modules/EmployeeDirectory';
import EmployeeDetail from '@/components/modules/EmployeeDetail';
import NewEmployeeForm from '@/components/modules/NewEmployeeForm';
import IncidenceManager from '@/components/modules/IncidenceManager';
import UserManagement from '@/components/modules/UserManagement';
import PayrollDashboard from '@/components/modules/PayrollDashboard';
import PayrollPeriods from '@/components/modules/PayrollPeriods';
import PayrollCalculation from '@/components/modules/PayrollCalculation';
import PayrollApproval from '@/components/modules/PayrollApproval';
import BankDispersion from '@/components/modules/BankDispersion';
import AguinaldoView from '@/components/modules/AguinaldoView';
import LiquidationView from '@/components/modules/LiquidationView';
import ProfileCatalog from '@/components/modules/ProfileCatalog';
import SalaryBands from '@/components/modules/SalaryBands';
import IsssReport from '@/components/modules/IsssReport';
import AfpReport from '@/components/modules/AfpReport';
import IsrReport from '@/components/modules/IsrReport';
import TalentReport from '@/components/modules/TalentReport';
import LegalParameters from '@/components/modules/LegalParameters';
import OrgChart from '@/components/modules/OrgChart';
import Integrations from '@/components/modules/Integrations';
import AuditLog from '@/components/modules/AuditLog';
import SelfServicePortal from '@/components/modules/SelfServicePortal';
import ProfileDescriptiveForm from '@/components/modules/ProfileDescriptiveForm';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import NotificationBell from '@/components/NotificationBell';

// ============================================================
// Types
// ============================================================
type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

interface UserData {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  debe_cambiar_password: boolean;
  empleadoId?: string;
}

interface AuthContextType {
  user: UserData | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  isLoading: boolean;
}

// ============================================================
// Auth Context
// ============================================================
const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ============================================================
// View Types
// ============================================================
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

// ============================================================
// Navigation Configuration (RBAC)
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
      { id: '02-04', label: 'Incidencias', icon: AlertCircle },
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

// Filter items within a group based on more granular RBAC
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

// Custom calendar icon since we can't import it from lucide
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
// VIEW LABELS MAP
// ============================================================
const VIEW_LABELS: Record<ViewId, string> = {
  'dashboard': 'Dashboard',
  '01-03': 'Gestión de Usuarios',
  '02-01': 'Directorio de Empleados',
  '02-02': 'Detalle de Empleado',
  '02-03': 'Nuevo Empleado',
  '02-04': 'Incidencias',
  '03-01': 'Catálogo de Perfiles',
  '03-02': 'Formulario de Perfil',
  '03-03': 'Bandas Salariales',
  '04-01': 'Dashboard Nómina',
  '04-02': 'Períodos de Nómina',
  '04-03': 'Cálculo de Nómina',
  '04-04': 'Aprobación de Nómina',
  '04-05': 'Dispersión de Pago',
  '04-06': 'Aguinaldo',
  '04-07': 'Liquidaciones',
  '05-01': 'Planilla ISSS',
  '05-02': 'Planilla AFP',
  '05-03': 'Retenciones ISR',
  '05-04': 'Gestión de Talento',
  '06-01': 'Parámetros Legales',
  '06-02': 'Organigrama',
  '06-03': 'Integraciones',
  '06-04': 'Bitácora',
  '06-05': 'Mi Portal',
};

// ============================================================
// LOGIN PAGE
// ============================================================
function LoginPage({ onLogin, isLoading }: { onLogin: (email: string, password: string) => Promise<void>; isLoading: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState('');

  // Lockout timer effect
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = lockoutUntil - Date.now();
      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        setLockoutCountdown('');
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setLockoutCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) return;

    setLoginError(null);
    try {
      await onLogin(email, password);
    } catch (err) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setLoginError(errorMsg);
      // Lockout after 5 failed attempts
      if (newAttempts >= 5) {
        setLockoutUntil(Date.now() + 5 * 60 * 1000); // 5 minute lockout
        setLoginError('Cuenta bloqueada por múltiples intentos fallidos. Intente nuevamente en 5 minutos.');
      }
    }
  };

  const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;
  const maxAttempts = 5;
  const remainingAttempts = maxAttempts - failedAttempts;

  const roleConfig: Record<string, { label: string; color: string; bg: string; border: string; hoverBg: string }> = {
    ADMIN: { label: 'ADMIN', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-950/50', border: 'border-red-200 dark:border-red-800/60', hoverBg: 'hover:bg-red-50 dark:hover:bg-red-950/30' },
    ANALISTA: { label: 'ANALISTA', color: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-100 dark:bg-teal-950/50', border: 'border-teal-200 dark:border-teal-800/60', hoverBg: 'hover:bg-teal-50 dark:hover:bg-teal-950/30' },
    APROBADOR: { label: 'APROBADOR', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-950/50', border: 'border-emerald-200 dark:border-emerald-800/60', hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
    GERENCIA: { label: 'GERENCIA', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-950/50', border: 'border-amber-200 dark:border-amber-800/60', hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-950/30' },
    AUDITOR: { label: 'AUDITOR', color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-100 dark:bg-violet-950/50', border: 'border-violet-200 dark:border-violet-800/60', hoverBg: 'hover:bg-violet-50 dark:hover:bg-violet-950/30' },
    EMPLEADO: { label: 'EMPLEADO', color: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-100 dark:bg-cyan-950/50', border: 'border-cyan-200 dark:border-cyan-800/60', hoverBg: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/30' },
  };

  const quickLoginCreds = [
    { email: 'admin@nomina.gob.sv', pass: 'Admin2026!', role: 'ADMIN' },
    { email: 'analista@nomina.gob.sv', pass: 'Analista2026!', role: 'ANALISTA' },
    { email: 'aprobador@nomina.gob.sv', pass: 'Aprobador2026!', role: 'APROBADOR' },
    { email: 'gerencia@nomina.gob.sv', pass: 'Gerencia2026!', role: 'GERENCIA' },
    { email: 'auditor@nomina.gob.sv', pass: 'Auditor2026!', role: 'AUDITOR' },
    { email: 'empleado@nomina.gob.sv', pass: 'Empleado2026!', role: 'EMPLEADO' },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Decorative Panel - hidden on mobile, visible on lg */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 flex-col justify-between p-10 xl:p-16">
        {/* Decorative SVG patterns */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Large hexagon pattern */}
          <svg className="absolute top-0 right-0 w-[500px] h-[500px] opacity-[0.07]" viewBox="0 0 200 200" fill="none">
            <path d="M100 10L180 50V130L100 170L20 130V50L100 10Z" stroke="white" strokeWidth="1"/>
            <path d="M100 30L160 60V120L100 150L40 120V60L100 30Z" stroke="white" strokeWidth="0.5"/>
            <path d="M100 50L140 70V110L100 130L60 110V70L100 50Z" stroke="white" strokeWidth="0.5"/>
          </svg>
          {/* Floating circles */}
          <div className="absolute top-[15%] left-[10%] w-64 h-64 bg-white/5 rounded-full blur-xl" />
          <div className="absolute bottom-[20%] right-[15%] w-80 h-80 bg-teal-400/10 rounded-full blur-2xl" />
          <div className="absolute top-[60%] left-[5%] w-40 h-40 bg-emerald-300/8 rounded-full blur-lg" />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }} />
          {/* Decorative lines */}
          <svg className="absolute bottom-0 left-0 w-full h-48 opacity-[0.06]" viewBox="0 0 400 100" fill="none" preserveAspectRatio="none">
            <path d="M0 80 Q100 20 200 60 T400 40" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M0 90 Q100 40 200 70 T400 55" stroke="white" strokeWidth="1" fill="none"/>
            <path d="M0 100 Q100 55 200 80 T400 70" stroke="white" strokeWidth="0.5" fill="none"/>
          </svg>
        </div>

        {/* Logo & Brand */}
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <svg viewBox="0 0 40 40" className="w-9 h-9 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4L4 12V28L20 36L36 28V12L20 4Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15"/>
              <path d="M20 4L4 12L20 20L36 12L20 4Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 12V28L20 36V20L4 12Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M36 12V28L20 36V20L36 12Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
            Sistema de Nómina<br />y Perfiles de Puestos
          </h1>
          <p className="text-emerald-100/80 mt-3 text-base leading-relaxed max-w-md">
            Plataforma integral de gestión salarial conforme a la legislación laboral de la República de El Salvador
          </p>
        </div>

        {/* Feature highlights */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <p className="text-white/90 font-medium text-sm">Cumplimiento Legal</p>
              <p className="text-emerald-200/60 text-xs">Cálculos de ISSS, AFP, ISR según normativa vigente</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <p className="text-white/90 font-medium text-sm">Seguridad y Auditoría</p>
              <p className="text-emerald-200/60 text-xs">Control de acceso basado en roles con trazabilidad completa</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <p className="text-white/90 font-medium text-sm">Aprobación y Dispersión</p>
              <p className="text-emerald-200/60 text-xs">Flujo de trabajo completo desde el cálculo hasta el pago</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div className="h-[1px] bg-white/10 mb-4" />
          <p className="text-emerald-200/40 text-xs">© 2026 Ministerio de Hacienda — República de El Salvador</p>
        </div>
      </div>

      {/* Mobile Header - visible only on mobile/tablet */}
      <div className="lg:hidden bg-gradient-to-br from-emerald-600 to-teal-700 p-6 pt-10 pb-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-white/5 rounded-full blur-xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-400/10 rounded-full blur-lg" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />
        </div>
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 mb-3">
            <svg viewBox="0 0 40 40" className="w-8 h-8 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4L4 12V28L20 36L36 28V12L20 4Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15"/>
              <path d="M20 4L4 12L20 20L36 12L20 4Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 12V28L20 36V20L4 12Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M36 12V28L20 36V20L36 12Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Sistema de Nómina</h1>
          <p className="text-emerald-100/70 text-sm mt-1">República de El Salvador</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 relative overflow-y-auto">
        {/* Background decorative elements (right side only) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-100/30 dark:bg-emerald-900/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-100/20 dark:bg-teal-900/10 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          {/* Login Card */}
          <Card className="shadow-xl shadow-slate-200/50 dark:shadow-slate-900/40 border border-slate-200/80 dark:border-slate-800 dark:bg-slate-900/95 animate-scale-in">
            <CardHeader className="pb-2 pt-6 px-6">
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 dark:shadow-emerald-800/30">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              </div>
              <CardTitle className="text-xl text-center dark:text-slate-100">Iniciar Sesión</CardTitle>
              <CardDescription className="text-center dark:text-slate-400">Ingrese sus credenciales para acceder al sistema</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email field with Mail icon prefix */}
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="usuario@nomina.gob.sv"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading || isLocked}
                      className="h-11 pl-10 transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* Password field with Lock icon prefix and show/hide toggle */}
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading || isLocked}
                      className="h-11 pl-10 pr-10 transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 dark:bg-slate-800 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember me + Forgot password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
                    />
                    <Label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">Recordarme</Label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRecovery(true)}
                    className="text-sm text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline transition-colors"
                  >
                    ¿Olvidó su contraseña?
                  </button>
                </div>

                {/* Security warnings */}
                {isLocked && lockoutCountdown && (
                  <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-800/60 animate-fade-in">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>Cuenta bloqueada. Intente en <strong>{lockoutCountdown}</strong></span>
                  </div>
                )}

                {!isLocked && failedAttempts >= 3 && remainingAttempts > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800/60 animate-fade-in">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Quedan <strong>{remainingAttempts}</strong> intento{remainingAttempts !== 1 ? 's' : ''} antes del bloqueo</span>
                  </div>
                )}

                {loginError && !isLocked && (
                  <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-800/60 animate-fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                {failedAttempts >= 2 && !isLocked && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 animate-fade-in">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>Múltiples intentos fallidos pueden bloquear su cuenta temporalmente</span>
                  </div>
                )}

                {/* Login button */}
                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                  disabled={isLoading || isLocked}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <span className="flex items-center gap-2">
                      Iniciar Sesión
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Quick Login Section */}
          <div className="mt-5 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Acceso Rápido (Demo)
              </span>
              <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quickLoginCreds.map((cred) => {
                const config = roleConfig[cred.role];
                return (
                  <button
                    key={cred.email}
                    type="button"
                    onClick={() => { setEmail(cred.email); setPassword(cred.pass); }}
                    disabled={isLoading || isLocked}
                    className={`flex flex-col items-start p-2.5 rounded-lg border ${config.border} ${config.hoverBg} transition-all duration-200 text-left group active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none bg-white dark:bg-slate-900/80`}
                  >
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${config.bg} ${config.color} mb-1.5`}>
                      {config.label}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate w-full leading-tight">
                      {cred.email}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Password Recovery Dialog */}
      <PasswordRecoveryDialog open={showRecovery} onOpenChange={setShowRecovery} />
    </div>
  );
}

// ============================================================
// PASSWORD RECOVERY DIALOG
// ============================================================
interface PasswordRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PasswordRecoveryDialog({ open, onOpenChange }: PasswordRecoveryDialogProps) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpId, setOtpId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { toast } = useToast();

  const handleReset = () => {
    setStep(1);
    setEmail('');
    setOtp('');
    setOtpId('');
    setNewPassword('');
    setConfirmPassword('');
    setDemoOtp(null);
    setIsLoading(false);
    setError(null);
    setSuccess(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) handleReset();
    onOpenChange(newOpen);
  };

  const handleStep1 = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al solicitar código');
        return;
      }
      setDemoOtp(data.demo_otp);
      setSuccess('Código enviado. Verifique su correo.');
      setStep(2);
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2 = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Código inválido');
        return;
      }
      setOtpId(data.otp_id);
      setSuccess('Código verificado');
      setStep(3);
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep3 = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_id: otpId, email, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al actualizar contraseña');
        return;
      }
      toast({
        title: 'Contraseña actualizada',
        description: 'Puede iniciar sesión con su nueva contraseña',
      });
      handleClose(false);
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabels = ['Email', 'Verificación', 'Nueva Contraseña'];
  const progressValue = (step / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-600" />
            Recuperar Contraseña
          </DialogTitle>
          <DialogDescription>
            Siga los pasos para restablecer su contraseña
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            {stepLabels.map((label, i) => (
              <span key={i} className={step > i ? 'text-emerald-600 font-medium' : step === i + 1 ? 'text-slate-900 font-medium' : ''}>
                {i + 1}. {label}
              </span>
            ))}
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && step > 1 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Step 1: Email */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Correo Electrónico</Label>
                <Input
                  type="email"
                  placeholder="usuario@nomina.gob.sv"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleStep1} disabled={isLoading || !email} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar Código
              </Button>
            </div>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código de Verificación</Label>
                <Input
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isLoading}
                  className="text-center text-lg tracking-[0.5em] font-mono"
                  maxLength={6}
                />
              </div>
              {demoOtp && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                  Demo - Código: <strong>{demoOtp}</strong>
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Volver
                </Button>
                <Button onClick={handleStep2} disabled={isLoading || otp.length !== 6} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verificar
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nueva Contraseña</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar Contraseña</Label>
                <Input
                  type="password"
                  placeholder="Repita la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleStep3} disabled={isLoading || !newPassword || !confirmPassword} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Actualizar Contraseña
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
interface SidebarProps {
  user: UserData;
  currentView: ViewId;
  onNavigate: (view: ViewId) => void;
  collapsed: boolean;
  onToggle: () => void;
}

function Sidebar({ user, currentView, onNavigate, collapsed, onToggle }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    NAV_GROUPS.forEach(g => {
      if (g.roles.includes(user.rol)) {
        initial.add(g.title);
      }
    });
    return initial;
  });

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-white transition-all duration-300 ease-in-out ${
          collapsed ? '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden' : 'w-64 translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0 shadow-lg shadow-emerald-900/40">
            <svg viewBox="0 0 40 40" className="w-5 h-5 text-white" fill="none">
              <path d="M20 4L4 12V28L20 36L36 28V12L20 4Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15"/>
              <path d="M20 4L4 12L20 20L36 12L20 4Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight whitespace-nowrap tracking-tight">Nómina SV</p>
            <p className="text-[10px] text-slate-500 whitespace-nowrap">El Salvador</p>
          </div>
          <button onClick={onToggle} className="ml-auto lg:hidden text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2 dark-scrollbar">
          <nav className="space-y-0.5 px-2">
            {/* Dashboard link at top */}
            <button
              onClick={() => { onNavigate('dashboard'); if (window.innerWidth < 1024) onToggle(); }}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-all mb-2 ${
                currentView === 'dashboard'
                  ? 'bg-emerald-600/20 text-emerald-400 font-medium'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <LayoutDashboard className={`h-4 w-4 ${currentView === 'dashboard' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Dashboard</span>
              {currentView === 'dashboard' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            </button>

            {NAV_GROUPS.map(group => {
              const visibleItems = getVisibleItems(group, user.rol);
              if (visibleItems.length === 0) return null;

              const isExpanded = expandedGroups.has(group.title);
              const GroupIcon = group.icon;

              return (
                <div key={group.title}>
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="flex items-center gap-2 w-full px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors rounded-md hover:bg-slate-800/30"
                  >
                    <GroupIcon className="h-3 w-3" />
                    <span className="truncate flex-1 text-left">{group.title}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                  </button>

                  <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-0.5 mt-0.5 mb-1.5">
                      {visibleItems.map(item => {
                        const isActive = currentView === item.id;
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onNavigate(item.id);
                              if (window.innerWidth < 1024) onToggle();
                            }}
                            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all relative group/item ${
                              isActive
                                ? 'bg-emerald-600/20 text-emerald-400 font-medium'
                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                            }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-400 rounded-r-full" />
                            )}
                            <ItemIcon className={`h-4 w-4 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-600 group-hover/item:text-slate-400'}`} />
                            <span>{item.label}</span>
                            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User info at bottom */}
        <div className="border-t border-slate-700/50 p-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
                {user.nombre[0]}{user.apellido[0]}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.nombre} {user.apellido}</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <p className="text-[10px] text-slate-400 truncate">{user.rol}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// TOP HEADER BAR
// ============================================================
interface HeaderBarProps {
  user: UserData;
  currentView: ViewId;
  accessToken: string | null;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onNavigate?: (viewId: ViewId) => void;
}

function HeaderBar({ user, currentView, accessToken, onToggleSidebar, onLogout, onNavigate }: HeaderBarProps) {
  const { toast } = useToast();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    onLogout();
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700/50 shadow-sm dark:shadow-slate-900/50 flex items-center px-4 gap-3 shrink-0 z-30">
      {/* Mobile menu toggle */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden text-slate-600 hover:text-slate-900 p-1 rounded-md hover:bg-slate-100 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleSidebar}
              className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Alternar menú</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Breadcrumb / Current view name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900 truncate">
            {VIEW_LABELS[currentView] || 'Dashboard'}
          </h2>
          {currentView !== 'dashboard' && (
            <Badge variant="secondary" className="text-[9px] shrink-0 bg-slate-100 text-slate-500">
              {currentView}
            </Badge>
          )}
        </div>
      </div>

      {/* Dark mode toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              aria-label="Cambiar tema"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Notification bell */}
      <NotificationBell accessToken={accessToken} onNavigate={onNavigate} />

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-medium">
                {user.nombre[0]}{user.apellido[0]}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-700 leading-tight">{user.nombre} {user.apellido}</p>
              <p className="text-[10px] text-slate-400 leading-tight">{user.rol}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.nombre} {user.apellido}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => toast({ title: 'Perfil', description: 'Módulo de perfil en desarrollo' })}>
            <User className="mr-2 h-4 w-4" />
            Mi Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
            <Lock className="mr-2 h-4 w-4" />
            Cambiar Contraseña
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        accessToken={accessToken}
      />
    </header>
  );
}

// ============================================================
// DASHBOARD / WELCOME VIEW
// ============================================================

// Mock payroll trend data for the bar chart
const PAYROLL_TREND_DATA = [
  { month: 'Ene', value: 45200 },
  { month: 'Feb', value: 43800 },
  { month: 'Mar', value: 47100 },
  { month: 'Abr', value: 46500 },
  { month: 'May', value: 48900 },
  { month: 'Jun', value: 50200 },
  { month: 'Jul', value: 49800 },
  { month: 'Ago', value: 51300 },
  { month: 'Sep', value: 52600 },
  { month: 'Oct', value: 54100 },
  { month: 'Nov', value: 53800 },
  { month: 'Dic', value: 55400 },
];

// Mock area distribution data
const AREA_DISTRIBUTION_DATA = [
  { name: 'Administración', count: 12, color: 'bg-teal-500' },
  { name: 'Ventas', count: 18, color: 'bg-emerald-500' },
  { name: 'Tecnología', count: 15, color: 'bg-cyan-500' },
  { name: 'Recursos Humanos', count: 8, color: 'bg-amber-500' },
  { name: 'Finanzas', count: 10, color: 'bg-violet-500' },
  { name: 'Operaciones', count: 14, color: 'bg-rose-500' },
];

// Mock announcements
const MOCK_ANNOUNCEMENTS = [
  { id: '1', title: 'Cierre de nómina febrero 2025', message: 'El plazo para el cierre de nómina del mes de febrero finaliza el 28 de febrero. Asegúrese de registrar todas las incidencias.', severity: 'high' as const, date: '2025-02-20', icon: CalendarDays },
  { id: '2', title: 'Actualización de parámetros ISSS', message: 'Se han actualizado los topes de cotización ISSS según la última resolución vigente.', severity: 'info' as const, date: '2025-02-15', icon: Info },
  { id: '3', title: 'Mantenimiento programado', message: 'El sistema estará en mantenimiento el próximo sábado de 02:00 a 06:00 AM. Guarde sus cambios antes de esa hora.', severity: 'warning' as const, date: '2025-02-18', icon: AlertTriangle },
];

// Enhanced sparkline bars component for KPI cards (3-5 small bars showing trend)
function SparklineBars({ trend, color }: { trend: 'up' | 'down' | 'neutral'; color: string }) {
  const heights = trend === 'up' ? [4, 6, 5, 8, 7, 10] : trend === 'down' ? [10, 7, 8, 5, 6, 4] : [6, 7, 6, 7, 6, 7];
  return (
    <div className="flex items-end gap-[3px] h-4">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm ${color}`}
          style={{ height: `${h}px`, opacity: 0.3 + (i / heights.length) * 0.7 }}
        />
      ))}
    </div>
  );
}

// Time-of-day greeting helper
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

// Get Spanish formatted date
function getSpanishDate(): string {
  return new Date().toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Get motivational message based on compliance level
function getMotivationalMessage(compliance: number | undefined): string {
  if (!compliance || compliance >= 90) return 'Cumplimiento laboral excelente. Continúe manteniendo los estándares del Código de Trabajo.';
  if (compliance >= 70) return 'Buen nivel de cumplimiento. Revise los elementos pendientes para alcanzar la conformidad total.';
  if (compliance >= 50) return 'Atención: Hay obligaciones laborales pendientes. Priorice los vencimientos próximos.';
  return 'Alerta: Cumplimiento por debajo del mínimo. Acción inmediata requerida según legislación salvadoreña.';
}

// Audit action-specific icons (create=plus, update=pencil, delete=trash, login=key)
function getEnhancedAuditIcon(accion: string) {
  const upper = accion.toUpperCase();
  if (upper.includes('LOGIN') || upper.includes('AUTH')) return <KeyRound className="h-4 w-4" />;
  if (upper.includes('CREATE') || upper.includes('INSERT')) return <Plus className="h-4 w-4" />;
  if (upper.includes('UPDATE') || upper.includes('EDIT') || upper.includes('MODIFY')) return <FileText className="h-4 w-4" />;
  if (upper.includes('DELETE') || upper.includes('REMOVE')) return <AlertCircle className="h-4 w-4" />;
  if (upper.includes('APPROVE') || upper.includes('APROBAR')) return <CheckCircle className="h-4 w-4" />;
  return <ScrollText className="h-4 w-4" />;
}

// Enhanced audit color-coding by severity level
function getEnhancedAuditColor(nivel: string) {
  if (nivel === 'ALTA') return 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800';
  if (nivel === 'MEDIA') return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800';
  return 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400 ring-1 ring-teal-200 dark:ring-teal-800';
}

function WelcomeDashboard({ user, accessToken, onNavigate }: { user: UserData; accessToken: string | null; onNavigate: (view: ViewId) => void }) {
  const [dashboardData, setDashboardData] = useState<{
    total_empleados_activos: number;
    nomina_mes: number;
    cumplimiento_previsional: number;
    semaforo: string;
    cumplimientos: { nombre: string; presentado: boolean; peso: number }[];
    vencimientos: { nombre: string; fecha: string; dias: number }[];
  } | null>(null);
  const [totalPerfiles, setTotalPerfiles] = useState(0);
  const [auditEntries, setAuditEntries] = useState<Array<{
    id: string;
    accion: string;
    tabla_afectada: string | null;
    fecha_accion: string;
    nivel_criticidad: string;
    usuario_email: string | null;
    usuario: { nombre: string; apellido: string } | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  // System stats state
  const [planillasCount, setPlanillasCount] = useState(0);
  const [incidenciasCount, setIncidenciasCount] = useState(0);
  const [usuariosActivos, setUsuariosActivos] = useState(0);
  const [areaDistribution, setAreaDistribution] = useState(AREA_DISTRIBUTION_DATA);
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastPayrollDate, setLastPayrollDate] = useState<string>('');
  const [nextDeadlineDate, setNextDeadlineDate] = useState<string>('');

  useEffect(() => {
    if (!accessToken) return;
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [dashRes, perfilesRes, auditRes] = await Promise.all([
          fetch('/api/nomina/dashboard', { headers }),
          fetch('/api/perfiles-puesto', { headers }),
          fetch('/api/admin/bitacora?page=1&page_size=5', { headers }),
        ]);
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          setDashboardData(dashData.kpis);
          // Extract next deadline from vencimientos
          if (dashData.kpis?.vencimientos?.length > 0) {
            const sorted = [...dashData.kpis.vencimientos].sort((a: { dias: number }, b: { dias: number }) => a.dias - b.dias);
            const next = sorted.find((v: { dias: number }) => v.dias > 0);
            if (next) setNextDeadlineDate(next.fecha);
          }
        }
        if (perfilesRes.ok) {
          const perfData = await perfilesRes.json();
          setTotalPerfiles(perfData.data?.length || 0);
        }
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditEntries(auditData.entries || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [accessToken]);

  // Fetch system stats
  useEffect(() => {
    if (!accessToken) return;
    const fetchStats = async () => {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [planillasRes, incidenciasRes, usuariosRes, empleadosRes] = await Promise.all([
          fetch('/api/nomina/planillas?limit=50', { headers }).catch(() => null),
          fetch('/api/incidencias', { headers }).catch(() => null),
          fetch('/api/usuarios', { headers }).catch(() => null),
          fetch('/api/empleados?page=1&pageSize=100', { headers }).catch(() => null),
        ]);

        if (planillasRes?.ok) {
          const data = await planillasRes.json();
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const planillas = data.data || data.planillas || data || [];
          const thisMonth = Array.isArray(planillas)
            ? planillas.filter((p: { fecha_creacion?: string; fecha?: string; periodo?: string }) => {
                const d = new Date(p.fecha_creacion || p.fecha || p.periodo || '');
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
              })
            : [];
          setPlanillasCount(thisMonth.length || (Array.isArray(planillas) ? planillas.length : 0));
          // Get last payroll date
          if (Array.isArray(planillas) && planillas.length > 0) {
            const sorted = [...planillas].sort((a: { fecha_creacion?: string; fecha?: string }, b: { fecha_creacion?: string; fecha?: string }) => {
              const da = new Date(a.fecha_creacion || a.fecha || '');
              const db = new Date(b.fecha_creacion || b.fecha || '');
              return db.getTime() - da.getTime();
            });
            const lastDate = sorted[0]?.fecha_creacion || sorted[0]?.fecha;
            if (lastDate) setLastPayrollDate(lastDate);
          }
        }

        if (incidenciasRes?.ok) {
          const data = await incidenciasRes.json();
          const incidencias = data.data || data.incidencias || data || [];
          if (Array.isArray(incidencias)) {
            const pending = incidencias.filter((inc: { estado?: string }) =>
              inc.estado === 'PENDIENTE' || inc.estado === 'pendiente' || inc.estado === 'Pendiente'
            );
            setIncidenciasCount(pending.length || incidencias.length);
          }
        }

        if (usuariosRes?.ok) {
          const data = await usuariosRes.json();
          const usuarios = data.data || data.usuarios || data || [];
          if (Array.isArray(usuarios)) {
            const active = usuarios.filter((u: { activo?: boolean; estado?: string }) =>
              u.activo === true || u.activo === 1 || u.estado === 'ACTIVO'
            );
            setUsuariosActivos(active.length || usuarios.length);
          }
        }

        if (empleadosRes?.ok) {
          const data = await empleadosRes.json();
          const empleados = data.data || data.empleados || data || [];
          if (Array.isArray(empleados) && empleados.length > 0) {
            const areaMap: Record<string, number> = {};
            empleados.forEach((emp: { area?: string; departamento?: string; seccion?: string }) => {
              const areaName = emp.area || emp.departamento || emp.seccion || 'Sin Área';
              areaMap[areaName] = (areaMap[areaName] || 0) + 1;
            });
            const colors = ['bg-teal-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-lime-500', 'bg-orange-500'];
            const distEntries = Object.entries(areaMap)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([name, count], i) => ({
                name,
                count,
                color: colors[i % colors.length],
              }));
            if (distEntries.length > 0) {
              setAreaDistribution(distEntries);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching system stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [accessToken]);

  // Enhanced KPI data with gradient borders, sparklines and change indicators
  const kpis = [
    {
      label: 'Empleados Activos',
      value: dashboardData?.total_empleados_activos ?? 0,
      icon: Users,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-900/30',
      gradient: 'from-teal-50/80 to-white dark:from-teal-950/40 dark:to-slate-900',
      borderAccent: 'border-l-teal-500',
      sparkColor: 'bg-teal-500',
      trend: 'up' as const,
      change: '+3.2%',
      changeLabel: 'vs mes anterior',
    },
    {
      label: 'Perfiles de Puesto',
      value: totalPerfiles,
      icon: Briefcase,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/30',
      gradient: 'from-emerald-50/80 to-white dark:from-emerald-950/40 dark:to-slate-900',
      borderAccent: 'border-l-emerald-500',
      sparkColor: 'bg-emerald-500',
      trend: 'up' as const,
      change: '+1.5%',
      changeLabel: 'vs mes anterior',
    },
    {
      label: 'Nómina del Mes',
      value: dashboardData?.nomina_mes ? `$${dashboardData.nomina_mes.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$0.00',
      icon: Calculator,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-900/30',
      gradient: 'from-cyan-50/80 to-white dark:from-cyan-950/40 dark:to-slate-900',
      borderAccent: 'border-l-cyan-500',
      sparkColor: 'bg-cyan-500',
      trend: 'up' as const,
      change: '+2.5%',
      changeLabel: 'vs mes anterior',
    },
    {
      label: 'Cumplimiento',
      value: dashboardData ? `${dashboardData.cumplimiento_previsional}%` : '0%',
      icon: Shield,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/30',
      gradient: 'from-amber-50/80 to-white dark:from-amber-950/40 dark:to-slate-900',
      borderAccent: 'border-l-amber-500',
      sparkColor: 'bg-amber-500',
      trend: (dashboardData?.cumplimiento_previsional ?? 0) >= 80 ? 'up' as const : 'down' as const,
      change: dashboardData && dashboardData.cumplimiento_previsional >= 80 ? '+5.0%' : '-2.3%',
      changeLabel: 'vs mes anterior',
    },
  ];

  // Enhanced quick actions with gradient icon backgrounds and count summaries
  const quickActions: Array<{ label: string; desc: string; icon: React.ElementType; color: string; bg: string; gradientBg: string; viewId: ViewId; roles: UserRole[]; count?: string }> = [
    { label: 'Directorio Empleados', desc: 'Buscar y gestionar empleados', icon: Users, color: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-50', gradientBg: 'bg-gradient-to-br from-teal-400 to-teal-600', viewId: '02-01', roles: ['ADMIN', 'ANALISTA', 'AUDITOR'], count: `${dashboardData?.total_empleados_activos ?? 0} activos` },
    { label: 'Dashboard Nómina', desc: 'Ver resumen de nómina', icon: LayoutDashboard, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50', gradientBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600', viewId: '04-01', roles: ['ADMIN', 'ANALISTA', 'GERENCIA', 'AUDITOR'], count: `${planillasCount} planillas` },
    { label: 'Calcular Nómina', desc: 'Iniciar cálculo del período', icon: Calculator, color: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-50', gradientBg: 'bg-gradient-to-br from-cyan-400 to-cyan-600', viewId: '04-03', roles: ['ADMIN', 'ANALISTA'] },
    { label: 'Aprobar Nómina', desc: 'Revisar y aprobar nóminas', icon: CheckCircle, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50', gradientBg: 'bg-gradient-to-br from-amber-400 to-amber-600', viewId: '04-04', roles: ['ADMIN', 'APROBADOR'], count: incidenciasCount > 0 ? `${incidenciasCount} pendientes` : undefined },
    { label: 'Gestionar Usuarios', desc: 'Crear, editar y desactivar', icon: Users, color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50', gradientBg: 'bg-gradient-to-br from-rose-400 to-rose-600', viewId: '01-03', roles: ['ADMIN'], count: `${usuariosActivos} activos` },
    { label: 'Reportes', desc: 'Planillas ISSS, AFP, ISR', icon: BarChart3, color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50', gradientBg: 'bg-gradient-to-br from-violet-400 to-violet-600', viewId: '05-01', roles: ['ADMIN', 'GERENCIA', 'AUDITOR'] },
    { label: 'Mi Portal', desc: 'Vacaciones, recibos, solicitudes', icon: Eye, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50', gradientBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600', viewId: '06-05', roles: ['EMPLEADO'] },
  ];

  const visibleActions = quickActions.filter(a => a.roles.includes(user.rol));

  // System health status items
  const systemHealthItems = [
    {
      label: 'Estado del Sistema',
      value: 'Operativo',
      statusColor: 'bg-emerald-500',
      statusGlow: 'shadow-emerald-500/50',
      icon: <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
    {
      label: 'Usuarios Activos',
      value: statsLoading ? '...' : `${usuariosActivos}`,
      statusColor: 'bg-emerald-500',
      statusGlow: 'shadow-emerald-500/50',
      icon: <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />,
      iconBg: 'bg-teal-100 dark:bg-teal-900/40',
    },
    {
      label: 'Última Nómina',
      value: lastPayrollDate ? new Date(lastPayrollDate).toLocaleDateString('es-SV', { day: '2-digit', month: 'short' }) : 'N/A',
      statusColor: lastPayrollDate ? 'bg-emerald-500' : 'bg-amber-500',
      statusGlow: lastPayrollDate ? 'shadow-emerald-500/50' : 'shadow-amber-500/50',
      icon: <CalendarDays className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />,
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/40',
    },
    {
      label: 'Próximo Vencimiento',
      value: nextDeadlineDate ? new Date(nextDeadlineDate).toLocaleDateString('es-SV', { day: '2-digit', month: 'short' }) : 'N/A',
      statusColor: dashboardData?.vencimientos?.some((v: { dias: number }) => v.dias <= 5) ? 'bg-red-500' : 'bg-emerald-500',
      statusGlow: dashboardData?.vencimientos?.some((v: { dias: number }) => v.dias <= 5) ? 'shadow-red-500/50' : 'shadow-emerald-500/50',
      icon: <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    },
  ];

  // Compute bar chart values
  const maxValue = Math.max(...PAYROLL_TREND_DATA.map(d => d.value));

  // Compute area total
  const areaTotal = areaDistribution.reduce((sum, a) => sum + a.count, 0);

  // Announcement severity styles
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20';
      case 'warning': return 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20';
      case 'info': return 'border-l-teal-500 bg-teal-50/50 dark:bg-teal-950/20';
      default: return 'border-l-slate-400 bg-slate-50/50 dark:bg-slate-800/50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'info': return <Info className="h-4 w-4 text-teal-500" />;
      default: return <Bell className="h-4 w-4 text-slate-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high': return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px]">Urgente</Badge>;
      case 'warning': return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]">Precaución</Badge>;
      case 'info': return <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 text-[10px]">Informativo</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-700 text-[10px]">Normal</Badge>;
    }
  };

  // Urgency color for vencimientos countdown
  const getUrgencyClasses = (dias: number) => {
    if (dias <= 3) return { bg: 'bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-600 dark:text-red-400', countdown: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' };
    if (dias <= 7) return { bg: 'bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600 dark:text-amber-400', countdown: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
    return { bg: 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', countdown: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
  };

  // Greeting and date
  const greeting = getGreeting();
  const todayFormatted = getSpanishDate();
  const motivationalMsg = getMotivationalMessage(dashboardData?.cumplimiento_previsional);

  return (
    <div className="space-y-6 stagger-children">
      {/* ═══════════════════════════════════════════════════════════
          1. ENHANCED WELCOME BANNER - Time-based greeting, Spanish date, motivational message, gradient
          ═══════════════════════════════════════════════════════════ */}
      <div className="relative rounded-xl overflow-hidden shadow-lg animate-fade-in">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-teal-600 to-emerald-800" />
        {/* Decorative shapes */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 animate-float" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/[0.03] rounded-lg rotate-12 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/4 left-1/3 w-10 h-10 bg-white/[0.04] rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
        {/* Shimmer overlay */}
        <div className="absolute inset-0 animate-shimmer opacity-20" />
        {/* Content */}
        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-emerald-200 text-sm font-medium mb-1">{greeting}</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {user.nombre} {user.apellido}
              </h1>
              <p className="text-emerald-100/80 mt-1 text-sm">
                Sistema de Nómina y Perfiles de Puestos — República de El Salvador
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="secondary" className="bg-white/15 text-white border-white/20 hover:bg-white/25 backdrop-blur-sm">
                  <Shield className="h-3 w-3 mr-1" />
                  {user.rol}
                </Badge>
                <Badge variant="secondary" className="bg-white/15 text-white border-white/20 hover:bg-white/25 backdrop-blur-sm">
                  <CalendarDays className="h-3 w-3 mr-1" />
                  {todayFormatted}
                </Badge>
              </div>
            </div>
            {/* Compliance indicator in banner */}
            {dashboardData && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2.5 border border-white/10">
                <div className={`w-3 h-3 rounded-full animate-pulse ${dashboardData.semaforo === 'verde' ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : dashboardData.semaforo === 'amarillo' ? 'bg-amber-400 shadow-lg shadow-amber-400/50' : 'bg-red-400 shadow-lg shadow-red-400/50'}`} />
                <div>
                  <p className="text-xs text-white/70">Cumplimiento</p>
                  <p className="text-lg font-bold text-white">{dashboardData.cumplimiento_previsional}%</p>
                </div>
              </div>
            )}
          </div>
          {/* Motivational / legal compliance message */}
          <div className="mt-4 p-3 rounded-lg bg-white/[0.08] backdrop-blur-sm border border-white/10">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-emerald-200 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-100/90 leading-relaxed">{motivationalMsg}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          3. SYSTEM STATUS WIDGET - Health indicators with colored dots
          ═══════════════════════════════════════════════════════════ */}
      <Card className="shadow-sm border-0 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/80">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40">
              <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Estado del Sistema</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {systemHealthItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                <div className={`p-2 rounded-lg ${item.iconBg} shrink-0`}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${item.statusColor} shadow-sm ${item.statusGlow} animate-pulse`} />
                    {statsLoading && item.label !== 'Estado del Sistema' ? (
                      <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{item.value}</p>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════
          2. ENHANCED KPI CARDS - Gradient left border, sparkline bars, skeleton, change indicators
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm border-l-4 border-l-slate-200 dark:border-l-slate-700">
              <CardContent className="p-4 sm:p-6">
                <div className="animate-pulse space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
                    <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  </div>
                  <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-24" />
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-10" />
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          kpis.map(kpi => (
            <Card key={kpi.label} className={`shadow-sm card-hover-lift bg-gradient-to-br ${kpi.gradient} border-slate-200/60 dark:border-slate-700/40 border-l-4 ${kpi.borderAccent} transition-all duration-200 hover:shadow-md`}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                    <SparklineBars trend={kpi.trend} color={kpi.sparkColor} />
                  </div>
                  <div className={`p-2 sm:p-2.5 rounded-xl ${kpi.bg} shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                    <kpi.icon className={`h-5 w-5 sm:h-5 sm:w-5 ${kpi.color}`} />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">{kpi.value}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  {kpi.trend === 'up' ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  ) : kpi.trend === 'down' ? (
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  ) : null}
                  <span className={`text-xs font-semibold ${kpi.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : kpi.trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                    {kpi.change}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{kpi.changeLabel}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          8. PAYROLL TREND CHART + AREA DISTRIBUTION MINI-CHART
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Mini Payroll Trend Chart */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
              Tendencia de Nómina
            </CardTitle>
            <CardDescription className="text-xs">Totales mensuales (últimos 12 meses)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-44 sm:h-52">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border-b border-slate-100 dark:border-slate-800 relative">
                    <span className="absolute -left-0 -top-2.5 text-[9px] text-slate-400 dark:text-slate-500">
                      {i === 0 ? '' : `$${Math.round(maxValue - (i * maxValue / 4)).toLocaleString()}`}
                    </span>
                  </div>
                ))}
              </div>
              {/* Bars */}
              <div className="absolute inset-0 flex items-end gap-1 sm:gap-1.5 pl-10 sm:pl-12 pb-5 pt-1">
                {PAYROLL_TREND_DATA.map((item) => {
                  const heightPct = (item.value / maxValue) * 100;
                  return (
                    <div key={item.month} className="flex-1 flex flex-col items-center justify-end h-full group">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-1 text-[9px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm border border-slate-100 dark:border-slate-700 whitespace-nowrap z-10">
                        ${item.value.toLocaleString()}
                      </div>
                      <div
                        className="w-full rounded-t-sm sm:rounded-t transition-all duration-200 group-hover:opacity-90"
                        style={{
                          height: `${heightPct}%`,
                          background: `linear-gradient(to top, oklch(0.6 0.15 160), oklch(0.55 0.12 180))`,
                          minHeight: '4px',
                        }}
                      />
                      <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Area Distribution Visual */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-teal-500" />
              Distribución por Área
            </CardTitle>
            <CardDescription className="text-xs">Empleados por departamento ({areaTotal} total)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Horizontal stacked bar */}
            <div className="flex h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              {areaDistribution.map((area) => {
                const pct = areaTotal > 0 ? (area.count / areaTotal) * 100 : 0;
                return (
                  <div
                    key={area.name}
                    className={`${area.color} transition-all duration-300 hover:opacity-80 relative group`}
                    style={{ width: `${pct}%`, minWidth: pct > 0 ? '4px' : '0' }}
                    title={`${area.name}: ${area.count} (${pct.toFixed(1)}%)`}
                  >
                    {pct > 12 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold text-white/90 truncate px-0.5">
                        {pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend with mini bars */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {areaDistribution.map((area) => {
                const pct = areaTotal > 0 ? (area.count / areaTotal) * 100 : 0;
                return (
                  <div key={area.name} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-sm ${area.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{area.name}</span>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 ml-1">{area.count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-0.5">
                        <div
                          className={`h-1.5 rounded-full ${area.color} opacity-70 transition-all duration-300`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ANNOUNCEMENTS / ALERTS SECTION
          ═══════════════════════════════════════════════════════════ */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-amber-500" />
            Avisos del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {MOCK_ANNOUNCEMENTS.map((announcement) => (
              <div
                key={announcement.id}
                className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${getSeverityStyle(announcement.severity)} transition-all duration-200 hover:shadow-sm`}
              >
                <div className="shrink-0 mt-0.5">
                  {getSeverityIcon(announcement.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{announcement.title}</p>
                    {getSeverityBadge(announcement.severity)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{announcement.message}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {new Date(announcement.date).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════
          5. ENHANCED COMPLIANCE SEMAPHORE & 7. ENHANCED VENCIMIENTOS
          ═══════════════════════════════════════════════════════════ */}
      {dashboardData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Enhanced Compliance Semaphore */}
          <Card className="shadow-sm overflow-hidden">
            {/* Colored top bar based on semaphore */}
            <div className={`h-1.5 ${
              dashboardData.semaforo === 'verde' ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
              dashboardData.semaforo === 'amarillo' ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
              'bg-gradient-to-r from-red-400 to-red-600'
            }`} />
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-500" />
                Semáforo de Cumplimiento
                {/* Prominent animated traffic light */}
                <div className="flex items-center gap-1.5 ml-auto p-1.5 bg-slate-900 dark:bg-slate-700 rounded-full shadow-inner">
                  <div className={`w-3 h-3 rounded-full transition-all duration-500 ${dashboardData.semaforo === 'rojo' ? 'bg-red-500 shadow-md shadow-red-500/60 animate-pulse' : 'bg-red-900/40'}`} />
                  <div className={`w-3 h-3 rounded-full transition-all duration-500 ${dashboardData.semaforo === 'amarillo' ? 'bg-amber-400 shadow-md shadow-amber-400/60 animate-pulse' : 'bg-amber-900/40'}`} />
                  <div className={`w-3 h-3 rounded-full transition-all duration-500 ${dashboardData.semaforo === 'verde' ? 'bg-emerald-400 shadow-md shadow-emerald-400/60 animate-pulse' : 'bg-emerald-900/40'}`} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Overall compliance progress bar */}
              <div className="p-3 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Cumplimiento General</span>
                  <span className={`text-sm font-bold ${dashboardData.cumplimiento_previsional >= 80 ? 'text-emerald-600 dark:text-emerald-400' : dashboardData.cumplimiento_previsional >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                    {dashboardData.cumplimiento_previsional}%
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${
                      dashboardData.cumplimiento_previsional >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                      dashboardData.cumplimiento_previsional >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                      'bg-gradient-to-r from-red-400 to-red-600'
                    }`}
                    style={{ width: `${dashboardData.cumplimiento_previsional}%` }}
                  />
                </div>
              </div>
              {/* Compliance items grid with progress bars */}
              <div className="grid grid-cols-1 gap-2">
                {dashboardData.cumplimientos?.map((c: { nombre: string; presentado: boolean; peso: number }) => (
                  <div key={c.nombre} className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {c.presentado ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <span className="text-sm text-slate-700 dark:text-slate-300">{c.nombre}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Peso: {c.peso}%</span>
                        <Badge className={`text-[10px] ${c.presentado ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                          {c.presentado ? 'Presentado' : 'Pendiente'}
                        </Badge>
                      </div>
                    </div>
                    {/* Progress bar for each compliance item */}
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${c.presentado ? 'bg-emerald-500' : 'bg-red-400'}`}
                        style={{ width: c.presentado ? '100%' : `${Math.max(c.peso * 0.3, 5)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Vencimientos with countdown display and urgency gradient */}
          <Card className="shadow-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-500" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-500" />
                Próximos Vencimientos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardData.vencimientos?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Todos los pagos al día</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No hay vencimientos próximos</p>
                </div>
              ) : (
                dashboardData.vencimientos?.map((v: { nombre: string; fecha: string; dias: number }) => {
                  const urgency = getUrgencyClasses(v.dias);
                  return (
                    <div key={v.nombre} className={`p-3 rounded-lg border ${urgency.bg} ${urgency.border} transition-all duration-200 hover:shadow-sm`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${urgency.dot === 'bg-red-500' ? 'bg-red-100 dark:bg-red-900/30' : urgency.dot === 'bg-amber-500' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                            <CalendarDays className={`h-4 w-4 ${urgency.countdown}`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{v.nombre}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(v.fecha).toLocaleDateString('es-SV', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <div className="text-center shrink-0 ml-2">
                          {v.dias > 0 ? (
                            <>
                              <p className={`text-2xl sm:text-3xl font-bold ${urgency.countdown}`}>{v.dias}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">días</p>
                            </>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs">Vencido</Badge>
                          )}
                        </div>
                      </div>
                      {/* Urgency progress bar */}
                      {v.dias > 0 && (
                        <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-1 rounded-full transition-all duration-500 ${
                              v.dias <= 3 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                              v.dias <= 7 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                              'bg-gradient-to-r from-emerald-400 to-emerald-600'
                            }`}
                            style={{ width: `${Math.min((1 - v.dias / 30) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          4. ENHANCED QUICK ACTIONS + 6. ENHANCED AUDIT TIMELINE
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Enhanced Quick Actions */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-emerald-500" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleActions.map(action => (
                <button
                  key={action.viewId + action.label}
                  onClick={() => onNavigate(action.viewId)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all duration-200 cursor-pointer text-left border border-slate-100 dark:border-slate-700/50 hover:border-emerald-200 dark:hover:border-emerald-700/50 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <div className={`p-2.5 rounded-xl ${action.gradientBg} shrink-0 shadow-sm group-hover:shadow-md transition-all duration-200`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{action.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{action.desc}</p>
                    {action.count && (
                      <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">{action.count}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Audit Timeline */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-emerald-500" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <ScrollText className="h-8 w-8 mb-2" />
                <p className="text-sm">Sin actividad reciente</p>
              </div>
            ) : (
              <div className="relative max-h-80 overflow-y-auto pr-1">
                {/* Timeline connecting line */}
                <div className="absolute left-5 top-3 bottom-3 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-1">
                  {auditEntries.map((entry, idx) => (
                    <div key={entry.id} className="relative flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 group">
                      {/* Timeline node */}
                      <div className={`relative z-10 p-2 rounded-full shrink-0 mt-0.5 ${getEnhancedAuditColor(entry.nivel_criticidad)} shadow-sm group-hover:shadow-md transition-shadow duration-200`}>
                        {getEnhancedAuditIcon(entry.accion)}
                      </div>
                      {/* Content */}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {entry.accion.replace(/_/g, ' ')}
                          </p>
                          {entry.nivel_criticidad === 'ALTA' && (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[9px] py-0 px-1.5">Alta</Badge>
                          )}
                        </div>
                        {entry.tabla_afectada && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            Tabla: <span className="font-mono text-slate-500 dark:text-slate-400">{entry.tabla_afectada}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {entry.usuario?.nombre ? `${entry.usuario.nombre} ${entry.usuario.apellido}` : entry.usuario_email || 'Sistema'}
                          <span className="mx-1">·</span>
                          {new Date(entry.fecha_accion).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// PLACEHOLDER VIEW
// ============================================================
function PlaceholderView({ viewId }: { viewId: ViewId }) {
  const label = VIEW_LABELS[viewId] || 'Vista';
  return (
    <Card className="shadow-sm">
      <CardContent className="p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-4">
          <LayoutDashboard className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{label}</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          Este módulo se encuentra en desarrollo. Pronto estará disponible con todas sus funcionalidades.
        </p>
        <Badge variant="secondary" className="mt-4">
          Vista {viewId}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ============================================================
// MAIN APPLICATION LAYOUT
// ============================================================
interface AppLayoutProps {
  user: UserData;
  accessToken: string | null;
  onLogout: () => void;
}

function AppLayout({ user, accessToken, onLogout }: AppLayoutProps) {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const renderView = () => {
    if (currentView === 'dashboard') {
      return <WelcomeDashboard user={user} accessToken={accessToken} onNavigate={setCurrentView} />;
    }
    switch (currentView) {
      case '02-01':
        return <EmployeeDirectory accessToken={accessToken} userRole={user.rol} onNavigateToDetail={(id) => { setSelectedEmployeeId(id); setCurrentView('02-02'); }} onNavigateToNew={() => setCurrentView('02-03')} />;
      case '02-02':
        return selectedEmployeeId ? <EmployeeDetail empleadoId={selectedEmployeeId} onBack={() => setCurrentView('02-01')} userRole={user.rol} accessToken={accessToken} /> : <PlaceholderView viewId={currentView} />;
      case '02-03':
        return <NewEmployeeForm accessToken={accessToken} userRole={user.rol} onBack={() => setCurrentView('02-01')} onSuccess={() => setCurrentView('02-01')} />;
      case '02-04':
        return <IncidenceManager accessToken={accessToken} userRole={user.rol} />;
      case '01-03':
        return <UserManagement accessToken={accessToken} />;
      case '04-01':
        return <PayrollDashboard accessToken={accessToken || ''} userRole={user.rol} onNavigate={setCurrentView} />;
      case '04-02':
        return <PayrollPeriods accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-03':
        return <PayrollCalculation accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-04':
        return <PayrollApproval accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-05':
        return <BankDispersion accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-06':
        return <AguinaldoView accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-07':
        return <LiquidationView accessToken={accessToken || ''} userRole={user.rol} />;
      case '03-01':
        return <ProfileCatalog accessToken={accessToken || ''} userRole={user.rol} />;
      case '03-02':
        return <ProfileDescriptiveForm accessToken={accessToken || ''} userRole={user.rol} />;
      case '03-03':
        return <SalaryBands accessToken={accessToken || ''} userRole={user.rol} />;
      case '05-01':
        return <IsssReport accessToken={accessToken || ''} userRole={user.rol} />;
      case '05-02':
        return <AfpReport accessToken={accessToken || ''} userRole={user.rol} />;
      case '05-03':
        return <IsrReport accessToken={accessToken || ''} userRole={user.rol} />;
      case '05-04':
        return <TalentReport accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-01':
        return <LegalParameters accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-02':
        return <OrgChart accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-03':
        return <Integrations accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-04':
        return <AuditLog accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-05':
        return <SelfServicePortal accessToken={accessToken || ''} userRole={user.rol} />;
      default:
        return <PlaceholderView viewId={currentView} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar
        user={user}
        currentView={currentView}
        onNavigate={setCurrentView}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <HeaderBar
          user={user}
          currentView={currentView}
          accessToken={accessToken}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onLogout={onLogout}
          onNavigate={setCurrentView}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 dark:bg-slate-950" key={currentView}>
          <div className="animate-fade-in">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// AUTH PROVIDER
// ============================================================
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!res.ok) return null;
      const data = await res.json();
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.accessToken;
    } catch {
      return null;
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const init = async () => {
      const token = await refreshAccessToken();
      if (!token) {
        setUser(null);
        setAccessToken(null);
      }
      setIsLoading(false);
    };
    init();
  }, [refreshAccessToken]);

  // Auto refresh token before expiry
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(async () => {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        setUser(null);
        setAccessToken(null);
      }
    }, 55 * 60 * 1000); // Refresh every 55 minutes (token expires in 1h)
    return () => clearInterval(interval);
  }, [accessToken, refreshAccessToken]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, refreshAccessToken, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function HomePage() {
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  return (
    <AuthProvider>
      <AuthGate
        loginError={loginError}
        setLoginError={setLoginError}
        isLoginLoading={isLoginLoading}
        setIsLoginLoading={setIsLoginLoading}
      />
    </AuthProvider>
  );
}

function AuthGate({
  loginError,
  setLoginError,
  isLoginLoading,
  setIsLoginLoading,
}: {
  loginError: string | null;
  setLoginError: React.Dispatch<React.SetStateAction<string | null>>;
  isLoginLoading: boolean;
  setIsLoginLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { user, accessToken, login, logout, isLoading } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    setLoginError(null);
    setIsLoginLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setLoginError(errorMsg);
      throw err;
    } finally {
      setIsLoginLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} isLoading={isLoginLoading} />;
  }

  return <AppLayout user={user} accessToken={accessToken} onLogout={logout} />;
}
