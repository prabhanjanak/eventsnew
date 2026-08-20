import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  LogOut,
  Trash2,
  Shield,
  Clock,
  MapPin,
  Loader2,
  Activity,
  Users,
  ShieldAlert,
  Laptop,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type ActiveSession = {
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
};

const USER_TYPE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-950/80 text-purple-300 border-purple-800/60",
  admin: "bg-rose-950/80 text-rose-300 border-rose-800/60",
  event_coordinator: "bg-amber-950/80 text-amber-300 border-amber-800/60",
  track_coordinator: "bg-indigo-950/80 text-indigo-300 border-indigo-800/60",
  food_coordinator: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60",
  scientific_committee: "bg-cyan-950/80 text-cyan-300 border-cyan-800/60",
  pr_member: "bg-blue-950/80 text-blue-300 border-blue-800/60",
  coordinator_view_only: "bg-zinc-800 text-zinc-300 border-zinc-700",
};

const USER_TYPE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  event_coordinator: "Event Coordinator",
  track_coordinator: "Track Coordinator",
  food_coordinator: "Food Coordinator",
  scientific_committee: "Scientific Committee",
  pr_member: "AV / Preview",
  coordinator_view_only: "View Only",
};

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="w-5 h-5 text-amber-400" />;
  if (type === "tablet") return <Tablet className="w-5 h-5 text-indigo-400" />;
  return <Laptop className="w-5 h-5 text-cyan-400" />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.ceil(diff / 60000);
  if (mins < 60) return `${mins}m remaining`;
  return `${Math.ceil(mins / 60)}h remaining`;
}

export default function AdminSessions() {
  const { token, user: currentUser } = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<number | null>(null);
  const [purging, setPurging] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [filterRole, setFilterRole] = useState<string>("all");

  const fetchSessions = useCallback(async () => {
    try {
      const resp = await fetch(`${BASE_URL}/api/sessions/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to fetch sessions");
      const data = await resp.json();
      // Filter specifically for staff / coordinator sessions
      const staffSessions = Array.isArray(data)
        ? data.filter((s: ActiveSession) => s.userType !== "participant")
        : [];
      setSessions(staffSessions);
      setLastRefreshed(new Date());
    } catch (err: any) {
      toast({ title: "Failed to load sessions", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleRevoke = async (id: number, name: string) => {
    setRevoking(id);
    try {
      const resp = await fetch(`${BASE_URL}/api/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to revoke session");
      toast({ title: "Session Terminated", description: `${name}'s login session has been remotely invalidated.` });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      toast({ title: "Failed to revoke session", description: err.message, variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/sessions/purge-expired`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to purge sessions");
      const data = await resp.json();
      toast({ title: "Purge Complete", description: data.message });
      fetchSessions();
    } catch (err: any) {
      toast({ title: "Purge Failed", description: err.message, variant: "destructive" });
    } finally {
      setPurging(false);
    }
  };

  // Filter sessions by selected role pill
  const filteredSessions = sessions.filter((s) => {
    if (filterRole === "all") return true;
    if (filterRole === "admins") return s.userType === "super_admin" || s.userType === "admin";
    if (filterRole === "coordinators") return s.userType.includes("coordinator") || s.userType === "scientific_committee" || s.userType === "pr_member";
    return s.userType === filterRole;
  });

  const stats = {
    total: sessions.length,
    admins: sessions.filter((s) => s.userType === "super_admin" || s.userType === "admin").length,
    coordinators: sessions.filter((s) => s.userType.includes("coordinator") || s.userType === "scientific_committee" || s.userType === "pr_member").length,
    desktop: sessions.filter((s) => s.deviceType === "desktop" || !s.deviceType).length,
    mobile: sessions.filter((s) => s.deviceType === "mobile" || s.deviceType === "tablet").length,
  };

  return (
    <div className="space-y-6 text-zinc-100 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Staff Telemetry &amp; Security
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                Auto-sync 30s
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Staff &amp; Coordinator Active Sessions
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Real-time monitoring of all active administrator, coordinator, and staff terminal logins. Invalidate or force-logout unauthorized devices remotely.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSessions}
              className="rounded-xl border-[#2C2C35] bg-[#1A1A20] hover:bg-[#25252D] text-white text-xs font-bold h-10 px-4 cursor-pointer shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-cyan-400 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePurge}
              disabled={purging}
              className="rounded-xl border-rose-900/40 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 text-xs font-bold h-10 px-4 cursor-pointer shadow"
            >
              {purging ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-400" />}
              <span>Purge Expired</span>
            </Button>
          </div>
        </div>

        {/* ── 4 KPI STATS TILES ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-[#09090C] border border-[#202026] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-wider">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Active Staff</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {stats.total}
            </div>
            <p className="text-[10px] text-zinc-500 font-medium">Logged in currently</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#09090C] border border-[#202026] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Administrators</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {stats.admins}
            </div>
            <p className="text-[10px] text-zinc-500 font-medium">Super &amp; Core Admins</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#09090C] border border-[#202026] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-wider">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Coordinators</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {stats.coordinators}
            </div>
            <p className="text-[10px] text-zinc-500 font-medium">Tracks &amp; Food Scanning</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#09090C] border border-[#202026] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-wider">
              <Laptop className="w-4 h-4 text-cyan-400" />
              <span>Workstations</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {stats.desktop} / {stats.mobile}
            </div>
            <p className="text-[10px] text-zinc-500 font-medium">Desktop vs Mobile/Tab</p>
          </div>
        </div>
      </div>

      {/* ── SESSIONS LIST CARD ────────────────────────────────────────────── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242429]">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              Active Terminal Sessions
            </h2>
            <p className="text-xs text-zinc-400">
              Staff sessions automatically expire after {currentUser?.sessionTimeoutMinutes ?? 30} minutes of inactivity.
            </p>
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "all", label: `All Staff (${sessions.length})` },
              { id: "admins", label: `Admins (${stats.admins})` },
              { id: "coordinators", label: `Coordinators (${stats.coordinators})` },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setFilterRole(pill.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  filterRole === pill.id
                    ? "bg-white text-zinc-950 shadow"
                    : "bg-[#1B1B22] text-zinc-400 border border-[#2A2A33] hover:text-white"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-xs text-zinc-400 font-mono">Loading active staff terminals...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 border border-dashed border-[#242429] rounded-2xl space-y-2">
            <Shield className="w-10 h-10 mx-auto text-zinc-600 opacity-60" />
            <p className="font-bold text-sm text-zinc-300">No Active Sessions Found</p>
            <p className="text-xs text-zinc-500">All matching staff and coordinator terminals are currently signed out.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => {
              const isCurrentSession = currentUser?.name === session.userName && session.ipAddress === "127.0.0.1";
              return (
                <div
                  key={session.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[#09090C] border border-[#202026] hover:border-[#32323D] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Left: Device Icon + User Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#181820] border border-[#2C2C38] flex items-center justify-center shrink-0">
                      <DeviceIcon type={session.deviceType} />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm text-white truncate">
                          {session.userName}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wide border ${
                            USER_TYPE_COLORS[session.userType] || "bg-zinc-800 text-zinc-300 border-zinc-700"
                          }`}
                        >
                          {USER_TYPE_LABELS[session.userType] || session.userType}
                        </Badge>
                        {isCurrentSession && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                            Current Session
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                        <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-300">
                          <MapPin className="w-3 h-3 text-zinc-500" />
                          {session.ipAddress || "Unknown IP"}
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate max-w-[280px]">
                          {session.deviceName || "Unknown Browser / Terminal"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Time & Force Logout CTA */}
                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1B1B22]">
                    <div className="text-left sm:text-right space-y-0.5 font-mono">
                      <div className="text-xs text-zinc-300 flex items-center gap-1 sm:justify-end">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>Active {timeAgo(session.lastSeenAt)}</span>
                      </div>
                      <div className="text-[11px] text-emerald-400 font-semibold">
                        {timeLeft(session.expiresAt)}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(session.id, session.userName)}
                      disabled={revoking === session.id}
                      className="rounded-xl border-rose-900/50 bg-rose-950/30 hover:bg-rose-950/80 text-rose-300 hover:text-white text-xs font-bold h-9 px-3.5 cursor-pointer shadow transition-all"
                    >
                      {revoking === session.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <LogOut className="w-3.5 h-3.5 mr-1" />
                      )}
                      <span>Force Logout</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
