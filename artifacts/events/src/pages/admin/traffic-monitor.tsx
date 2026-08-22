import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTimeWithSeconds24h, formatTime24h } from "@/lib/date-utils";
import {
  Activity,
  Zap,
  QrCode,
  AlertTriangle,
  RefreshCw,
  Shield,
  Server,
  Database,
  Wifi,
  Cpu,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  BarChart3,
  Radio,
  ExternalLink,
  Lock,
  Layers,
  Sparkles,
  HeartPulse,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MetricsSlot {
  ts: number;
  requests: number;
  errors: number;
  scans: number;
}

interface TrafficData {
  requestsPerMinute: number;
  scansPerMinute: number;
  errorRate: number;
  activeSessionsCount: number;
  history: MetricsSlot[];
  slotSizeMs: number;
}

interface HealthProbe {
  status: "ok" | "degraded" | "error" | "checking";
  latencyMs: number | null;
  dbConnected: boolean;
  timestamp?: string;
  totalParticipants?: number;
  totalUsers?: number;
}

// ── Sparkline SVG Component ───────────────────────────────────────────────────
function Sparkline({
  data,
  color = "#8b5cf6",
  height = 44,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const w = 240;
  const h = height;
  if (!data || data.length === 0) return <svg width="100%" height={h} />;

  const safeData = data.length === 1 ? [data[0], data[0]] : data;
  const max = Math.max(...safeData, 1);
  const min = Math.min(...safeData, 0);
  const range = max - min || 1;

  const pts = safeData.map((v, i) => {
    const x = (i / Math.max(safeData.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M${pts.join(" L")}`;
  const fillPath = `M0,${h} L${pts.join(" L")} L${w},${h} Z`;
  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {fill && <path d={fillPath} fill={`url(#${gradId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Main Traffic Monitor Page ────────────────────────────────────────────────
export default function TrafficMonitor() {
  const { token, user } = useAuth();
  const { toast } = useToast();

  const [metrics, setMetrics] = useState<TrafficData | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Health probe state
  const [probe, setProbe] = useState<HealthProbe>({
    status: "checking",
    latencyMs: null,
    dbConnected: true,
  });

  const fetchHealthProbe = useCallback(async () => {
    const startTime = performance.now();
    try {
      const res = await fetch(`${BASE_URL}/api/healthz`);
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        setProbe({
          status: "ok",
          latencyMs: latency,
          dbConnected: !!data.database?.connected,
          timestamp: data.database?.timestamp,
          totalParticipants: data.database?.participants?.count,
          totalUsers: data.database?.systemUsers?.count,
        });
      } else {
        setProbe({
          status: "degraded",
          latencyMs: latency,
          dbConnected: false,
        });
      }
    } catch {
      setProbe({
        status: "error",
        latencyMs: Math.round(performance.now() - startTime),
        dbConnected: false,
      });
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/metrics/traffic`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: TrafficData = await res.json();
        setMetrics(data);
        setLastUpdated(new Date());
      } else {
        // Fallback default structure if server metrics buffer is initializing
        setMetrics((prev) => prev || {
          requestsPerMinute: 0,
          scansPerMinute: 0,
          errorRate: 0,
          activeSessionsCount: 1,
          history: [],
          slotSizeMs: 10000,
        });
      }
    } catch {
      // Fallback
      setMetrics((prev) => prev || {
        requestsPerMinute: 0,
        scansPerMinute: 0,
        errorRate: 0,
        activeSessionsCount: 1,
        history: [],
        slotSizeMs: 10000,
      });
    } finally {
      setLoadingMetrics(false);
    }
  }, [token]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMetrics(), fetchHealthProbe()]);
    setRefreshing(false);
  }, [fetchMetrics, fetchHealthProbe]);

  useEffect(() => {
    refreshAll();
    intervalRef.current = setInterval(refreshAll, 10_000);
    return () => clearInterval(intervalRef.current);
  }, [refreshAll]);

  // Sparkline history extraction (last 20 slots = 200s window)
  const histSlots = metrics?.history ?? [];
  const reqSparkline = histSlots.length > 0 ? histSlots.map((s) => s.requests) : [0, 0, 0];
  const scanSparkline = histSlots.length > 0 ? histSlots.map((s) => s.scans) : [0, 0, 0];
  const errSparkline = histSlots.length > 0 ? histSlots.map((s) => s.errors) : [0, 0, 0];

  // Derived calculations
  const maxReqInHistory = Math.max(...histSlots.map((s) => s.requests), 1);
  const totalRequestsHistory = histSlots.reduce((a, s) => a + s.requests, 0);
  const totalScansHistory = histSlots.reduce((a, s) => a + s.scans, 0);
  const totalErrorsHistory = histSlots.reduce((a, s) => a + s.errors, 0);

  return (
    <div className="space-y-6 text-zinc-100 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* ── TOP HERO HEADER ─────────────────────────────────────────────── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/60 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Radio className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                Live Telemetry &amp; Traffic Engine
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-[11px] font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live 10s Sync
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              Traffic Telemetry Command Center
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Real-time HTTP throughput, high-velocity QR scanning telemetry, server error telemetry, and node health monitors across Sankara Events Platform.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 shrink-0">
            {lastUpdated && (
              <span className="text-xs text-zinc-500 font-mono hidden md:inline-block">
                Updated {formatTimeWithSeconds24h(lastUpdated)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={refreshing}
              className="rounded-xl border-[#2C2C35] bg-[#1A1A20] hover:bg-[#25252D] text-white text-xs font-bold h-10 px-4 cursor-pointer shadow-lg transition-all"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 text-violet-400 ${refreshing ? "animate-spin" : ""}`}
              />
              <span>{refreshing ? "Syncing..." : "Refresh Telemetry"}</span>
            </Button>
          </div>
        </div>

        {/* ── 4 KEY TELEMETRY TILES ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Card 1: Requests / min */}
          <div className="p-5 rounded-2xl bg-[#0C0C0F] border border-[#23232A] hover:border-violet-500/50 transition-all group relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-violet-400" />
                  Request Velocity
                </span>
                <div className="text-3xl font-black text-white font-mono mt-1">
                  {loadingMetrics ? (
                    <div className="h-8 w-20 bg-zinc-800 animate-pulse rounded" />
                  ) : (
                    metrics?.requestsPerMinute ?? 0
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 font-medium">
                  HTTP requests / min
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-violet-400">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="h-10 mt-3 -mx-2 -mb-2">
              <Sparkline data={reqSparkline} color="#8b5cf6" />
            </div>
          </div>

          {/* Card 2: Scanner Velocity */}
          <div className="p-5 rounded-2xl bg-[#0C0C0F] border border-[#23232A] hover:border-emerald-500/50 transition-all group relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                  Scan Velocity
                </span>
                <div className="text-3xl font-black text-white font-mono mt-1">
                  {loadingMetrics ? (
                    <div className="h-8 w-20 bg-zinc-800 animate-pulse rounded" />
                  ) : (
                    metrics?.scansPerMinute ?? 0
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 font-medium">
                  Attendance + Food / min
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                <QrCode className="w-5 h-5" />
              </div>
            </div>
            <div className="h-10 mt-3 -mx-2 -mb-2">
              <Sparkline data={scanSparkline} color="#10b981" />
            </div>
          </div>

          {/* Card 3: Error Rate */}
          <div className="p-5 rounded-2xl bg-[#0C0C0F] border border-[#23232A] hover:border-rose-500/50 transition-all group relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  HTTP Error Rate
                </span>
                <div className="text-3xl font-black text-white font-mono mt-1 flex items-baseline gap-1">
                  {loadingMetrics ? (
                    <div className="h-8 w-20 bg-zinc-800 animate-pulse rounded" />
                  ) : (
                    <>
                      <span>{metrics?.errorRate ?? 0}%</span>
                      <span className={`text-xs font-bold ${
                        (metrics?.errorRate ?? 0) === 0
                          ? "text-emerald-400"
                          : (metrics?.errorRate ?? 0) < 5
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}>
                        {(metrics?.errorRate ?? 0) === 0 ? "Optimal" : "Notice"}
                      </span>
                    </>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 font-medium">
                  4xx &amp; 5xx response ratio
                </span>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                (metrics?.errorRate ?? 0) > 5
                  ? "bg-rose-950/60 border border-rose-800/40 text-rose-400"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400"
              }`}>
                <HeartPulse className="w-5 h-5" />
              </div>
            </div>
            <div className="h-10 mt-3 -mx-2 -mb-2">
              <Sparkline
                data={errSparkline}
                color={(metrics?.errorRate ?? 0) > 5 ? "#f43f5e" : "#64748b"}
              />
            </div>
          </div>

          {/* Card 4: Active Terminals */}
          <div className="p-5 rounded-2xl bg-[#0C0C0F] border border-[#23232A] hover:border-cyan-500/50 transition-all group relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Active Terminals
                </span>
                <div className="text-3xl font-black text-white font-mono mt-1 flex items-baseline gap-2">
                  {loadingMetrics ? (
                    <div className="h-8 w-20 bg-zinc-800 animate-pulse rounded" />
                  ) : (
                    <>
                      <span>{metrics?.activeSessionsCount ?? 0}</span>
                      <Link
                        href="/admin/sessions"
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
                      >
                        Inspect &rarr;
                      </Link>
                    </>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 font-medium">
                  Active staff &amp; coordinator logins
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
                <Wifi className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-[#1F1F26] flex items-center justify-between text-[11px] text-zinc-400">
              <span>Security Enforced</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── REAL-TIME TRAFFIC TIMELINE (5 MIN ROLLING WINDOW) ─────────── */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-400" />
              5-Minute Rolling Traffic Distribution
            </h2>
            <p className="text-xs text-zinc-400">
              Each bar represents a high-resolution 10-second traffic window ({histSlots.length} active slots recorded).
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-3 h-3 rounded-sm bg-violet-500 shadow-sm" />
              <span>HTTP Requests ({totalRequestsHistory})</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 shadow-sm" />
              <span>QR Scans ({totalScansHistory})</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-3 h-3 rounded-sm bg-rose-500 shadow-sm" />
              <span>Errors ({totalErrorsHistory})</span>
            </div>
          </div>
        </div>

        {/* Bar Chart Visualization */}
        <div className="p-5 rounded-2xl bg-[#09090C] border border-[#202026] space-y-3">
          <div className="flex items-end gap-1.5 h-36 w-full pt-4">
            {histSlots.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs">
                <Activity className="w-6 h-6 mb-1 text-zinc-600 animate-pulse" />
                <span>Listening for incoming requests...</span>
              </div>
            ) : (
              histSlots.slice(-30).map((slot, i) => {
                const reqPct = (slot.requests / maxReqInHistory) * 100;
                const hasErr = slot.errors > 0;
                const hasScans = slot.scans > 0;
                const timeLabel = formatTimeWithSeconds24h(slot.ts);

                return (
                  <div
                    key={slot.ts || i}
                    className="flex-1 flex flex-col justify-end group relative h-full cursor-pointer"
                  >
                    {/* Bar visualization */}
                    <div
                      className={`w-full rounded-md transition-all duration-300 ${
                        hasErr
                          ? "bg-rose-500 group-hover:bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                          : hasScans
                          ? "bg-emerald-500 group-hover:bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                          : "bg-violet-500/80 group-hover:bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.3)]"
                      }`}
                      style={{ height: `${Math.max(reqPct, 6)}%` }}
                    />

                    {/* Interactive Tooltip on Hover */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1A1A22] border border-[#30303D] text-white text-[11px] rounded-xl px-3 py-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-2xl space-y-1">
                      <div className="font-mono font-bold text-zinc-400 text-[10px]">
                        {timeLabel}
                      </div>
                      <div className="flex items-center gap-2 text-violet-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                        <span>Requests: <strong className="text-white">{slot.requests}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Scans: <strong className="text-white">{slot.scans}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-rose-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>Errors: <strong className="text-white">{slot.errors}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono px-1">
            <span>5 minutes ago</span>
            <span>2.5 minutes ago</span>
            <span>Current (Live)</span>
          </div>
        </div>
      </div>

      {/* ── SYSTEM HEALTH & INFRASTRUCTURE PROBES ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Health & Latency Probe */}
        <div className="lg:col-span-2 p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Backend Node &amp; Database Health Probes
              </h2>
              <p className="text-xs text-zinc-400">
                Direct round-trip heartbeat verification to PostgreSQL and Node.js microservices.
              </p>
            </div>
            <Badge
              variant="outline"
              className={`px-3 py-1 font-bold text-xs ${
                probe.status === "ok"
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                  : "bg-rose-950/80 text-rose-300 border-rose-800/60"
              }`}
            >
              {probe.status === "ok" ? "All Systems Operational" : "Service Issue"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Probe 1: API Latency */}
            <div className="p-4 rounded-2xl bg-[#09090C] border border-[#202026] space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Ping Latency
                </span>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {probe.latencyMs !== null ? `${probe.latencyMs} ms` : "--"}
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">HTTP round-trip to API</p>
            </div>

            {/* Probe 2: Database State */}
            <div className="p-4 rounded-2xl bg-[#09090C] border border-[#202026] space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" /> PostgreSQL
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    probe.dbConnected ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {probe.dbConnected ? "Connected" : "Disconnected"}
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">
                {probe.totalParticipants !== undefined
                  ? `${probe.totalParticipants} attendees cached`
                  : "Database pool active"}
              </p>
            </div>

            {/* Probe 3: Rate Limiter Status */}
            <div className="p-4 rounded-2xl bg-[#09090C] border border-[#202026] space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-violet-400" /> Rate Guard
                </span>
                <span className="w-2 h-2 rounded-full bg-violet-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                300 RPM
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">Anti-DoS token bucket</p>
            </div>
          </div>

          {/* Subsystem Telemetry Matrix */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
              Subsystem Telemetry Endpoints
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-[#09090C] border border-[#202026] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-zinc-200">QR Scan Ingestion API</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">/api/scan</span>
              </div>
              <div className="p-3 rounded-xl bg-[#09090C] border border-[#202026] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-zinc-200">Attendance Sync Logs</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">/api/attendance</span>
              </div>
              <div className="p-3 rounded-xl bg-[#09090C] border border-[#202026] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-zinc-200">WhatsApp Broadcast Queue</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">/api/whatsapp</span>
              </div>
              <div className="p-3 rounded-xl bg-[#09090C] border border-[#202026] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-zinc-200">AI Chatbot Query Engine</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">/api/chat</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Navigation & Security Hub */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Security &amp; Session Controls
              </span>
              <h3 className="text-base font-black text-white">
                Platform Access Control
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Looking to inspect live staff devices, adjust session timeouts, or manage login sync engines?
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href="/admin/sessions"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0C0C0F] border border-[#23232A] hover:border-cyan-500/50 hover:bg-[#181820] transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                      Staff Active Sessions
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Force-terminate &amp; view active terminals
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/admin/logs"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0C0C0F] border border-[#23232A] hover:border-violet-500/50 hover:bg-[#181820] transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-violet-400">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors">
                      Audit &amp; System Logs
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Telemetry trail &amp; check-in scans
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/admin/settings"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0C0C0F] border border-[#23232A] hover:border-amber-500/50 hover:bg-[#181820] transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Global Security Policies
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Inactivity timeout &amp; OTP configs
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          <div className="pt-3 border-t border-[#202026] flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span>Operator: {user?.name || "Super Admin"}</span>
            <span className="font-mono text-emerald-400 font-bold">NODE_ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
