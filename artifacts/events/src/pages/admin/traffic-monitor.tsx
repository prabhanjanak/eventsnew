import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity, Users, QrCode, Zap, AlertTriangle, RefreshCw, LogOut,
  Loader2, Wifi, Monitor, Smartphone, Tablet, Shield, KeyRound,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MetricsSlot { ts: number; requests: number; errors: number; scans: number; }
interface TrafficData {
  requestsPerMinute: number;
  scansPerMinute: number;
  errorRate: number;
  activeSessionsCount: number;
  history: MetricsSlot[];
  slotSizeMs: number;
}
interface Session {
  id: number;
  userId: number;
  userType: string;
  userName: string;
  ipAddress: string | null;
  deviceType: string | null;
  deviceName: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({
  data,
  color = "#6F42C1",
  height = 48,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const w = 200;
  const h = height;
  if (!data.length) return <svg width="100%" height={h} />;

  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - (v / max) * (h - 4);
    return `${x},${y}`;
  });

  const linePath = `M${pts.join(" L")}`;
  const fillPath = `M0,${h} L${pts.join(" L")} L${w},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {fill && (
        <path d={fillPath} fill={`url(#grad-${color.replace("#", "")})`} />
      )}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, icon: Icon, color, sparkData, sparkColor, trend,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: any;
  color: string;
  sparkData: number[];
  sparkColor: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-md">
      <CardContent className="p-0">
        <div className={`px-5 pt-5 pb-3 bg-gradient-to-br ${color}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">{label}</div>
              <div className="text-white text-3xl font-black mt-1 leading-none">{value}</div>
              {sub && <div className="text-white/60 text-xs mt-1">{sub}</div>}
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        <div className="h-12 bg-white/5 -mt-1">
          <Sparkline data={sparkData} color={sparkColor} fill />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Device icon helper ────────────────────────────────────────────────────────
function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="w-4 h-4 text-gray-400" />;
  if (type === "tablet") return <Tablet className="w-4 h-4 text-gray-400" />;
  return <Monitor className="w-4 h-4 text-gray-400" />;
}

function userTypeBadgeClass(t: string) {
  switch (t) {
    case "super_admin": return "bg-red-100 text-red-700 border-red-200";
    case "admin": return "bg-purple-100 text-purple-700 border-purple-200";
    case "participant": return "bg-blue-100 text-blue-700 border-blue-200";
    case "food_coordinator": return "bg-orange-100 text-orange-700 border-orange-200";
    case "track_coordinator": return "bg-green-100 text-green-700 border-green-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TrafficMonitor() {
  const { token, user } = useAuth();
  const { toast } = useToast();

  const [metrics, setMetrics] = useState<TrafficData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Session Timeout Control State
  const [sessionTimeout, setSessionTimeout] = useState<number>(30);
  const [submissionsOpenSetting, setSubmissionsOpenSetting] = useState<boolean>(true);
  const [savingTimeout, setSavingTimeout] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/submissions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionTimeout(data.sessionTimeoutMinutes ?? 30);
        setSubmissionsOpenSetting(data.submissionsOpen ?? true);
      }
    } catch { /* silent */ }
  }, [token]);

  const handleApplyLimit = async () => {
    setSavingTimeout(true);
    try {
      const res = await fetch("/api/settings/submissions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          submissionsOpen: submissionsOpenSetting,
          sessionTimeoutMinutes: Number(sessionTimeout),
        }),
      });
      if (res.ok) {
        toast({
          title: "Policy Applied ✓",
          description: `Session inactivity limit updated to ${sessionTimeout} minutes.`,
        });
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update limit");
      }
    } catch (err: any) {
      toast({
        title: "Error applying policy",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingTimeout(false);
    }
  };

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics/traffic", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
        setLastUpdated(new Date());
      }
    } catch { /* silent */ } finally {
      setLoadingMetrics(false);
    }
  }, [token]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch { /* silent */ } finally {
      setLoadingSessions(false);
    }
  }, [token]);

  const refreshAll = useCallback(() => {
    fetchMetrics();
    fetchSessions();
  }, [fetchMetrics, fetchSessions]);

  useEffect(() => {
    fetchSettings();
    refreshAll();
    intervalRef.current = setInterval(refreshAll, 10_000);
    return () => clearInterval(intervalRef.current);
  }, [refreshAll, fetchSettings]);

  const handleRevoke = async (sessionId: number, userName: string) => {
    setRevokingId(sessionId);
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: `Session revoked`, description: `${userName}'s session has been terminated.` });
        setSessions(s => s.filter(x => x.id !== sessionId));
      } else {
        throw new Error("Failed to revoke session");
      }
    } catch {
      toast({ title: "Error revoking session", variant: "destructive" });
    } finally {
      setRevokingId(null);
    }
  };

  // Derived sparkline arrays (last 20 history slots)
  const histSlots = (metrics?.history ?? []).slice(-20);
  const reqSparkline = histSlots.map(s => s.requests);
  const scanSparkline = histSlots.map(s => s.scans);
  const errSparkline = histSlots.map(s => s.errors);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </span>
            Traffic Monitor
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Live server metrics — auto-refresh every 10 seconds
            {lastUpdated && (
              <span className="ml-2 text-gray-400">
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={refreshAll}
          variant="outline"
          className="gap-2 border-gray-200 hover:bg-gray-50 font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Now
        </Button>
      </div>

      {/* ── Live Metric Cards ────────────────────────────────────── */}
      {loadingMetrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Requests / min"
            value={metrics.requestsPerMinute}
            sub="Last 60 seconds"
            icon={Zap}
            color="from-violet-600 to-purple-700"
            sparkData={reqSparkline}
            sparkColor="#a78bfa"
          />
          <MetricCard
            label="Active Sessions"
            value={metrics.activeSessionsCount}
            sub="Non-expired users"
            icon={Users}
            color="from-blue-500 to-blue-700"
            sparkData={[...reqSparkline].map(() => metrics.activeSessionsCount)}
            sparkColor="#93c5fd"
          />
          <MetricCard
            label="Scans / min"
            value={metrics.scansPerMinute}
            sub="Attendance + food"
            icon={QrCode}
            color="from-emerald-500 to-green-700"
            sparkData={scanSparkline}
            sparkColor="#6ee7b7"
          />
          <MetricCard
            label="Error Rate"
            value={`${metrics.errorRate}%`}
            sub="4xx / 5xx responses"
            icon={AlertTriangle}
            color={metrics.errorRate > 10 ? "from-red-500 to-red-700" : "from-slate-500 to-slate-700"}
            sparkData={errSparkline}
            sparkColor={metrics.errorRate > 10 ? "#fca5a5" : "#94a3b8"}
          />
        </div>
      ) : null}

      {/* ── Requests Graph (Bar chart) ────────────────────────────── */}
      {metrics && metrics.history.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-500" />
              Request History (last 5 min, 10s slots)
            </CardTitle>
            <CardDescription>Each bar = one 10-second window</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-0.5 h-24 w-full">
              {metrics.history.slice(-30).map((slot, i) => {
                const maxReq = Math.max(...metrics.history.map(s => s.requests), 1);
                const pct = (slot.requests / maxReq) * 100;
                const hasErr = slot.errors > 0;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col justify-end group relative"
                    title={`${slot.requests} req, ${slot.errors} err`}
                  >
                    <div
                      className={`w-full rounded-sm transition-all duration-300 ${hasErr ? "bg-red-400 group-hover:bg-red-500" : "bg-violet-400 group-hover:bg-violet-500"}`}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {slot.requests}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-sm bg-violet-400 inline-block" /> Requests
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> With Errors
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Session Security Policy Card ────────────────────────── */}
      {((user?.userType as string) === "super_admin" || (user?.userType as string) === "admin") && (
        <Card className="border border-gray-150 shadow-sm rounded-3xl bg-white overflow-hidden p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
              <KeyRound className="w-6 h-6 text-[#F58220]" />
            </div>
            <div>
              <h2 className="font-black tracking-wide text-slate-800 text-sm md:text-base uppercase">
                Session Security Policy
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Configures session validation limit
              </p>
            </div>
          </div>

          <hr className="border-gray-100" />

          <p className="text-sm text-slate-500 leading-relaxed font-medium">
            Define the session inactivity limit in minutes. Once configured, coordinators and staff are automatically booted off the platform if inactive for this set duration.
          </p>

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="inactivity-limit" className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
              Inactivity Limit
            </Label>
            <div className="flex items-center gap-3 max-w-sm">
              <Input
                id="inactivity-limit"
                type="number"
                min={1}
                max={480}
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(Number(e.target.value))}
                className="w-full max-w-[200px] h-12 font-bold text-slate-800 border-gray-200 rounded-xl px-4 focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:border-orange-500"
              />
              <Button
                onClick={handleApplyLimit}
                disabled={savingTimeout}
                className="h-12 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs tracking-wider rounded-xl px-6 border-none transition-all uppercase shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {savingTimeout ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Apply Limit
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Active Sessions Table ────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500" />
                Active Sessions
                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                  {sessions.length}
                </span>
              </CardTitle>
              <CardDescription className="mt-0.5">
                All non-expired, non-revoked sessions. You can terminate any session instantly.
              </CardDescription>
            </div>
            {loadingSessions && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Wifi className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              <p className="text-sm font-semibold">No active sessions found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sessions.map(session => {
                const isMe = session.userType === user?.userType && session.userName === user?.name;
                const expiresAt = new Date(session.expiresAt);
                const lastSeen = new Date(session.lastSeenAt);
                const minLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60_000));

                return (
                  <div key={session.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors ${isMe ? "bg-blue-50/50" : ""}`}>
                    {/* Device icon */}
                    <DeviceIcon type={session.deviceType} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm truncate">{session.userName}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${userTypeBadgeClass(session.userType)}`}>
                          {session.userType.replace(/_/g, " ")}
                        </Badge>
                        {isMe && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{session.deviceName || "Unknown device"}</span>
                        {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                        <span>Last seen: {lastSeen.toLocaleTimeString()}</span>
                        <span className={`font-semibold ${minLeft < 5 ? "text-red-500" : "text-gray-400"}`}>
                          Expires in {minLeft}m
                        </span>
                      </div>
                    </div>

                    {/* Revoke */}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revokingId === session.id || isMe}
                      onClick={() => handleRevoke(session.id, session.userName)}
                      className={`gap-1.5 text-xs shrink-0 ${!isMe ? "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300" : "opacity-40 cursor-not-allowed"}`}
                      title={isMe ? "Cannot revoke your own session" : "Revoke session"}
                    >
                      {revokingId === session.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <LogOut className="w-3 h-3" />
                      )}
                      {!isMe && "Revoke"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── System Info ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        System operational — monitoring since server start · Logged in as{" "}
        <span className="font-bold text-gray-600">{user?.name}</span>
        {" "}(Super Admin)
      </div>
    </div>
  );
}
