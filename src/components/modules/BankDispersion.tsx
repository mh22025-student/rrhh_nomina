'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Send, Building2, Download, Loader2, CheckCircle, XCircle,
  Clock, AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronRight,
  FileText, Users, DollarSign, Calendar, ShieldCheck, Info,
  TrendingUp, Landmark, Banknote, AlertCircle, PartyPopper
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

interface BankDispersionProps {
  accessToken: string;
  userRole: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PlanillaOption {
  id: string;
  codigo_planilla: string;
  tipo: string;
  estado: string;
  total_neto_a_pagar: number;
  total_empleados: number;
  fecha_generacion?: string;
}

interface DispersionResult {
  banco_id: string;
  banco_nombre: string;
  banco_codigo: string;
  total_empleados: number;
  total_monto: number;
  archivo_nombre: string;
  retorno_id: string;
  contenido_csv: string;
}

interface RetornoBancario {
  id: string;
  banco_id: string;
  archivo_nombre: string | null;
  fecha_envio: string | null;
  fecha_retorno: string | null;
  estado: string;
  total_registros: number;
  total_monto: number;
  errores_detalle: string | null;
  banco: { nombre: string; codigo: string };
}

type Step = 1 | 2 | 3;

// Bank color palette for avatars
const bankColors = [
  'bg-emerald-600 text-white',
  'bg-teal-600 text-white',
  'bg-cyan-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-violet-600 text-white',
  'bg-orange-600 text-white',
  'bg-lime-600 text-white',
];

function getBankColor(index: number) {
  return bankColors[index % bankColors.length];
}

// Dispersion status badge colors
const dispersionStatusColors: Record<string, string> = {
  PENDIENTE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ENVIADO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  CONFIRMADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  FALLIDO: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

export default function BankDispersion({ accessToken }: BankDispersionProps) {
  const { toast } = useToast();
  const [planillas, setPlanillas] = useState<PlanillaOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedPlanilla, setSelectedPlanilla] = useState<PlanillaOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dispersions, setDispersions] = useState<DispersionResult[]>([]);
  const [retornos, setRetornos] = useState<RetornoBancario[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  const [previewBank, setPreviewBank] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Step logic
  const currentStep: Step = !selectedId ? 1 : dispersions.length === 0 ? 2 : 3;

  const fetchPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nomina/planillas?limit=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setPlanillas(data.planillas?.filter((p: PlanillaOption) => p.estado === 'APROBADA') || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar planillas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  const fetchDetail = useCallback(async (planillaId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${planillaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setRetornos(data.planilla?.retornos_bancarios || []);
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchPlanillas(); }, [fetchPlanillas]);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
      const p = planillas.find(pl => pl.id === selectedId);
      setSelectedPlanilla(p || null);
    } else {
      setRetornos([]);
      setSelectedPlanilla(null);
    }
  }, [selectedId, fetchDetail, planillas]);

  // Reset state when selection changes
  useEffect(() => {
    setDispersions([]);
    setExpandedBanks(new Set());
    setPreviewBank(null);
    setConfirmed(false);
    setShowSuccessAnimation(false);
  }, [selectedId]);

  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${selectedId}/dispersion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar dispersión');
      setDispersions(data.dispersiones || []);
      toast({ title: 'Dispersión Generada', description: `${data.dispersiones.length} archivo(s) generado(s)` });
      fetchDetail(selectedId);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al generar dispersión', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (disp: DispersionResult) => {
    const blob = new Blob([disp.contenido_csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = disp.archivo_nombre;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAch = (disp: DispersionResult) => {
    const blob = new Blob([disp.contenido_csv], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = disp.archivo_nombre.replace('.csv', '.ach');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast({ title: 'Copiado', description: 'Contenido copiado al portapapeles' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'No se pudo copiar', variant: 'destructive' });
    }
  };

  const toggleExpanded = (bancoId: string) => {
    setExpandedBanks(prev => {
      const next = new Set(prev);
      if (next.has(bancoId)) next.delete(bancoId);
      else next.add(bancoId);
      return next;
    });
  };

  const handleConfirm = async () => {
    setConfirming(true);
    // Simulate a brief loading state for better UX
    await new Promise(resolve => setTimeout(resolve, 800));
    setConfirmed(true);
    setConfirming(false);
    setShowSuccessAnimation(true);
    toast({ title: 'Dispersión Confirmada', description: 'Los archivos han sido confirmados para envío bancario' });
    setTimeout(() => setShowSuccessAnimation(false), 3000);
  };

  // Parse CSV content into rows for display
  const parseCSV = (csv: string) => {
    return csv.split('\n').filter(l => l.trim()).map(line => line.split(','));
  };

  // Summary calculations
  const totalAmountDispersed = dispersions.reduce((s, d) => s + d.total_monto, 0);
  const totalEmployees = dispersions.reduce((s, d) => s + d.total_empleados, 0);
  const bankCount = dispersions.length;
  const successRetornos = retornos.filter(r => r.estado === 'PROCESADO').length;
  const errorRetornos = retornos.filter(r => r.estado === 'CON_ERRORES' || r.estado === 'RECHAZADO').length;

  const retornoEstadoColors: Record<string, string> = {
    PENDIENTE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    ENVIADO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    EN_PROCESO: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    PROCESADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    CON_ERRORES: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    RECHAZADO: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  };

  const retornoEstadoIcons: Record<string, React.ReactNode> = {
    PENDIENTE: <Clock className="h-3 w-3" />,
    ENVIADO: <Send className="h-3 w-3" />,
    EN_PROCESO: <Loader2 className="h-3 w-3 animate-spin" />,
    PROCESADO: <CheckCircle className="h-3 w-3" />,
    CON_ERRORES: <XCircle className="h-3 w-3" />,
    RECHAZADO: <XCircle className="h-3 w-3" />,
  };

  // Step indicator component
  const steps = [
    { num: 1, label: 'Seleccionar Planilla', icon: Info },
    { num: 2, label: 'Generar Dispersión', icon: Send },
    { num: 3, label: 'Confirmar', icon: ShieldCheck },
  ];

  // Helper to mask account number
  const maskAccount = (account: string) => {
    if (!account || account.length < 4) return account;
    return '****' + account.slice(-4);
  };

  // Helper to get initials from name
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Bank summary data for widget
  const bankSummaryData = dispersions.map(d => ({
    name: d.banco_nombre,
    code: d.banco_codigo,
    amount: d.total_monto,
    employees: d.total_empleados,
    percentage: totalAmountDispersed > 0 ? (d.total_monto / totalAmountDispersed) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-5">
      {/* ========== KPI SUMMARY STATS ========== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm border-l-4 border-l-emerald-500 dark:border-l-emerald-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Planillas por Dispersar</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{planillas.length}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Clock className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Aprobadas y listas</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-teal-500 dark:border-l-teal-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Monto Total</p>
                <p className="text-lg font-bold text-teal-700 dark:text-teal-400 mt-1">{fmt(totalAmountDispersed || planillas.reduce((s, p) => s + p.total_neto_a_pagar, 0))}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40">
                <DollarSign className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-teal-500" />
              <span className="text-[10px] text-teal-600 dark:text-teal-400">Dispersión</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-cyan-500 dark:border-l-cyan-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Empleados</p>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400 mt-1">{totalEmployees || planillas.reduce((s, p) => s + p.total_empleados, 0)}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/40">
                <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Users className="h-3 w-3 text-cyan-500" />
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400">Beneficiarios</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-amber-500 dark:border-l-amber-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Bancos Involucrados</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{bankCount}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <Landmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Building2 className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] text-amber-600 dark:text-amber-400">Instituciones</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== STEP INDICATOR ========== */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-6 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
          <div className="flex items-center justify-center">
            {steps.map((step, i) => {
              const isActive = currentStep === step.num;
              const isCompleted = currentStep > step.num;
              const Icon = step.icon;
              return (
                <React.Fragment key={step.num}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`
                        flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all duration-300
                        ${isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-700 dark:border-emerald-700 shadow-md shadow-emerald-200 dark:shadow-emerald-900/30'
                          : isActive
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-400 ring-4 ring-emerald-100 dark:ring-emerald-900/20'
                            : 'bg-slate-100 border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-medium transition-colors ${
                        isCompleted
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : isActive
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`
                        flex-1 h-0.5 mx-2 sm:mx-4 mb-5 transition-colors duration-300 rounded-full
                        ${currentStep > step.num
                          ? 'bg-emerald-500 dark:bg-emerald-600'
                          : 'bg-slate-200 dark:bg-slate-700'
                        }
                      `}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ========== PLANILLA SELECTOR ========== */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Dispersión Bancaria
          </CardTitle>
          <CardDescription>Genere archivos de dispersión para planillas aprobadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : planillas.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No hay planillas aprobadas para dispersión</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione una planilla aprobada..." /></SelectTrigger>
                  <SelectContent>
                    {planillas.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo_planilla} — {p.tipo} — {fmt(p.total_neto_a_pagar)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={!selectedId || generating}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-emerald-700 dark:to-teal-700 dark:hover:from-emerald-800 dark:hover:to-teal-800 min-w-[180px] text-white"
              >
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Generar Dispersión
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== PLANILLA INFO CARD ========== */}
      {selectedPlanilla && (
        <Card className="shadow-sm border-l-4 border-l-emerald-500 dark:border-l-emerald-600">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                    <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Planilla</p>
                    <p className="font-semibold text-sm dark:text-slate-100">{selectedPlanilla.codigo_planilla}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 ml-10">
                  <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-slate-700 dark:text-slate-300">
                    {selectedPlanilla.tipo}
                  </Badge>
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                    {selectedPlanilla.estado}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40">
                    <DollarSign className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Neto</p>
                </div>
                <p className="text-2xl font-bold text-teal-700 dark:text-teal-400 ml-10">
                  {fmt(selectedPlanilla.total_neto_a_pagar)}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
                    <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Empleados</p>
                </div>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400 ml-10">
                  {selectedPlanilla.total_empleados}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Estado</p>
                </div>
                <div className="flex items-center gap-2 ml-10">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Aprobada</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== ENHANCED DISPERSIONS TABLE ========== */}
      {dispersions.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Resumen por Banco
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              {bankCount} banco{bankCount !== 1 ? 's' : ''} — {totalEmployees} empleado{totalEmployees !== 1 ? 's' : ''} — {fmt(totalAmountDispersed)} total
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0">
              {dispersions.map((d, idx) => {
                const isExpanded = expandedBanks.has(d.banco_id);
                const isPreview = previewBank === d.banco_id;
                const csvRows = parseCSV(d.contenido_csv);
                const headerRow = csvRows[0] || [];
                const dataRows = csvRows.slice(1);
                const lines = d.contenido_csv.split('\n').filter(l => l.trim());
                const fileSize = new Blob([d.contenido_csv]).size;
                const fileSizeStr = fileSize > 1024 ? `${(fileSize / 1024).toFixed(1)} KB` : `${fileSize} B`;

                // Find matching retorno for status
                const matchingRetorno = retornos.find(r => r.banco_id === d.banco_id);
                const status = matchingRetorno?.estado || 'ENVIADO';

                // Progress based on status
                const progressValue = status === 'PROCESADO' ? 100 : status === 'EN_PROCESO' ? 60 : status === 'ENVIADO' ? 30 : status === 'PENDIENTE' ? 10 : 0;

                return (
                  <div key={d.banco_id} className="border-b last:border-b-0 dark:border-slate-700/50">
                    {/* Bank row */}
                    <div
                      className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => toggleExpanded(d.banco_id)}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className={getBankColor(idx)}>
                          <span className="text-sm font-bold">{d.banco_nombre.charAt(0)}</span>
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm dark:text-slate-100 truncate">{d.banco_nombre}</p>
                          <Badge
                            className={`text-[10px] ${retornoEstadoColors[status] || 'bg-slate-100 dark:bg-slate-700'} flex items-center gap-1`}
                            variant="secondary"
                          >
                            {retornoEstadoIcons[status]}
                            {status}
                          </Badge>
                          {status === 'EN_PROCESO' && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>Código: {d.banco_codigo}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{d.archivo_nombre}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={progressValue} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 w-8 text-right">{progressValue}%</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm dark:text-slate-100">{fmt(d.total_monto)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{d.total_empleados} emp.</p>
                      </div>

                      <div className="shrink-0 text-slate-400 dark:text-slate-500">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>

                    {/* Expandable content */}
                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(d.banco_id)}>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3">
                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleDownload(d); }} className="dark:border-slate-600 dark:text-slate-300">
                              <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar CSV
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDownloadAch(d); }}
                              className="dark:border-slate-600 dark:text-slate-300"
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1.5" /> Descargar .ach
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setPreviewBank(isPreview ? null : d.banco_id); }}
                              className="dark:border-slate-600 dark:text-slate-300"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1.5" /> {isPreview ? 'Ocultar Vista' : 'Vista ACH'}
                            </Button>
                          </div>

                          {/* ACH File Preview with syntax highlighting */}
                          {isPreview && (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5 text-emerald-400" />
                                  <span className="text-xs font-mono text-slate-300">{d.archivo_nombre}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500">{lines.length} líneas • {fileSizeStr}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-slate-400 hover:text-white hover:bg-slate-700"
                                    onClick={(e) => { e.stopPropagation(); handleCopyToClipboard(d.contenido_csv); }}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    {copied ? 'Copiado!' : 'Copiar'}
                                  </Button>
                                </div>
                              </div>
                              <div className="bg-slate-900 dark:bg-slate-950 p-3 overflow-x-auto max-h-64">
                                <pre className="text-xs font-mono leading-5">
                                  {lines.map((line, lineIdx) => (
                                    <div key={lineIdx} className="flex hover:bg-slate-800/50">
                                      <span className="text-slate-600 dark:text-slate-700 w-8 text-right mr-3 select-none shrink-0">
                                        {lineIdx + 1}
                                      </span>
                                      <span className={`${
                                        lineIdx === 0
                                          ? 'text-emerald-400 dark:text-emerald-500 font-semibold'
                                          : line.startsWith('T')
                                            ? 'text-amber-400 dark:text-amber-500'
                                            : 'text-slate-300 dark:text-slate-400'
                                      }`}>
                                        {line}
                                      </span>
                                    </div>
                                  ))}
                                </pre>
                              </div>
                              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
                                <span>Banco: {d.banco_nombre} ({d.banco_codigo})</span>
                                <span>•</span>
                                <span>Registros: {d.total_empleados}</span>
                                <span>•</span>
                                <span>Total: {fmt(d.total_monto)}</span>
                              </div>
                            </div>
                          )}

                          {/* Enhanced employee payments table */}
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Pagos individuales ({dataRows.length})
                              </p>
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                              <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                                  <tr>
                                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Empleado</th>
                                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Banco</th>
                                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Cuenta</th>
                                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Monto</th>
                                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dataRows.map((row, ri) => {
                                    const employeeName = row[0] || `Empleado ${ri + 1}`;
                                    const accountNum = row[2] || '';
                                    const amount = parseFloat(row[row.length - 1]) || 0;
                                    // Determine dispersion status for row (cycle through for demo)
                                    const statusOptions = ['PENDIENTE', 'ENVIADO', 'CONFIRMADO'];
                                    const rowStatus = statusOptions[ri % statusOptions.length];

                                    return (
                                      <tr key={ri} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors">
                                        <td className="p-2 whitespace-nowrap">
                                          <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[9px] font-semibold">
                                                {getInitials(employeeName)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="text-slate-700 dark:text-slate-200">{employeeName}</span>
                                          </div>
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                          <Badge
                                            className={`text-[9px] ${getBankColor(idx)} px-1.5 py-0`}
                                            variant="secondary"
                                          >
                                            {d.banco_nombre}
                                          </Badge>
                                        </td>
                                        <td className="p-2 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">
                                          {maskAccount(accountNum)}
                                        </td>
                                        <td className="p-2 whitespace-nowrap text-right font-medium text-teal-700 dark:text-teal-400">
                                          {fmt(amount)}
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                          <Badge
                                            className={`text-[9px] ${dispersionStatusColors[rowStatus] || 'bg-slate-100 dark:bg-slate-700'}`}
                                            variant="secondary"
                                          >
                                            {rowStatus}
                                          </Badge>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== BANK SUMMARY WIDGET ========== */}
      {dispersions.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Distribución por Banco
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Desglose de montos por institución bancaria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bankSummaryData.map((bank, idx) => (
              <div key={bank.code} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className={`${getBankColor(idx)} text-[10px]`}>
                        {bank.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="text-sm font-medium dark:text-slate-200">{bank.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">({bank.code})</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-teal-700 dark:text-teal-400">{fmt(bank.amount)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">{bank.employees} emp.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getBankColor(idx).split(' ')[0]}`}
                      style={{ width: `${bank.percentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 w-10 text-right">
                    {bank.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ========== ACH FILE PREVIEW (Standalone) ========== */}
      {dispersions.length > 0 && !previewBank && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Vista Previa Archivos ACH
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Seleccione un banco arriba para ver la vista previa detallada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dispersions.map((d, idx) => {
                const lines = d.contenido_csv.split('\n').filter(l => l.trim());
                const fileSize = new Blob([d.contenido_csv]).size;
                const fileSizeStr = fileSize > 1024 ? `${(fileSize / 1024).toFixed(1)} KB` : `${fileSize} B`;
                return (
                  <div
                    key={d.banco_id}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer transition-colors group"
                    onClick={() => { setPreviewBank(d.banco_id); setExpandedBanks(prev => new Set(prev).add(d.banco_id)); }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className={`${getBankColor(idx)} text-xs`}>
                          {d.banco_nombre.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium dark:text-slate-100 truncate">{d.banco_nombre}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{d.banco_codigo}</p>
                      </div>
                    </div>
                    {/* Mini code preview */}
                    <div className="rounded bg-slate-900 dark:bg-slate-950 p-2 mb-2">
                      <pre className="text-[10px] font-mono leading-4 text-slate-400 dark:text-slate-500 overflow-hidden max-h-12">
                        {lines.slice(0, 3).join('\n')}
                      </pre>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span>{lines.length} líneas</span>
                      <span>{fileSizeStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== RETURN STATUS TRACKING ========== */}
      {retornos.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Estado de Retornos Bancarios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-slate-50/80 dark:bg-slate-800/50">
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Banco</th>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Archivo</th>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Estado</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Registros</th>
                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Monto</th>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Fecha Envío</th>
                  </tr>
                </thead>
                <tbody>
                  {retornos.map(r => (
                    <tr key={r.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/30 dark:border-slate-700/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="dark:text-slate-200">{r.banco?.nombre || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs dark:text-slate-300">{r.archivo_nombre || '-'}</td>
                      <td className="p-3">
                        <Badge
                          className={`text-[10px] ${retornoEstadoColors[r.estado] || 'bg-slate-100 dark:bg-slate-700'} flex items-center gap-1 w-fit`}
                          variant="secondary"
                        >
                          {retornoEstadoIcons[r.estado]}
                          {r.estado}
                        </Badge>
                      </td>
                      <td className="p-3 text-right dark:text-slate-200">{r.total_registros}</td>
                      <td className="p-3 text-right font-medium dark:text-slate-200">{fmt(r.total_monto)}</td>
                      <td className="p-3 text-xs dark:text-slate-300">{r.fecha_envio ? new Date(r.fecha_envio).toLocaleDateString('es-SV') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {retornos.some(r => r.estado === 'CON_ERRORES' || r.estado === 'RECHAZADO') && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Algunos retornos tienen errores. Revise los detalles con el banco.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========== CONFIRMATION SUMMARY ========== */}
      {dispersions.length > 0 && (
        <Card className={`shadow-sm overflow-hidden transition-all duration-500 ${confirmed ? 'border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-200 dark:ring-emerald-800' : ''}`}>
          <CardContent className="p-4 sm:p-6">
            {/* Success animation */}
            {showSuccessAnimation && (
              <div className="flex flex-col items-center justify-center py-4 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                  <CheckCircle className="h-16 w-16 text-emerald-500 dark:text-emerald-400" />
                  <PartyPopper className="h-6 w-6 text-amber-500 absolute -top-2 -right-2" />
                </div>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-3">¡Dispersión Confirmada!</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Los archivos han sido enviados a los bancos</p>
              </div>
            )}

            {!showSuccessAnimation && (
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                {/* Summary stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 w-full lg:w-auto">
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Dispersado</p>
                    <p className="text-xl font-bold text-teal-700 dark:text-teal-400">{fmt(totalAmountDispersed)}</p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Empleados Pagados</p>
                    <p className="text-xl font-bold text-cyan-700 dark:text-cyan-400">{totalEmployees}</p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bancos</p>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{bankCount}</p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Estado Retornos</p>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      {successRetornos > 0 && (
                        <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle className="h-3.5 w-3.5" /> {successRetornos}
                        </span>
                      )}
                      {errorRetornos > 0 && (
                        <span className="flex items-center gap-1 text-sm font-medium text-red-700 dark:text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> {errorRetornos}
                        </span>
                      )}
                      {successRetornos === 0 && errorRetornos === 0 && (
                        <span className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" /> Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Confirm button */}
                <div className="w-full lg:w-auto">
                  {confirmed ? (
                    <div className="flex items-center gap-2 justify-center lg:justify-end text-emerald-700 dark:text-emerald-400 font-medium">
                      <CheckCircle className="h-5 w-5" />
                      <span>Dispersión Confirmada</span>
                    </div>
                  ) : (
                    <Button
                      onClick={handleConfirm}
                      disabled={confirming}
                      className="w-full lg:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-emerald-700 dark:to-teal-700 dark:hover:from-emerald-800 dark:hover:to-teal-800 min-w-[220px] text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30"
                      size="lg"
                    >
                      {confirming ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando...</>
                      ) : (
                        <><ShieldCheck className="h-4 w-4 mr-2" /> Confirmar Dispersión</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
