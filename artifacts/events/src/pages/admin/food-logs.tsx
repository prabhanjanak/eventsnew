import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, Loader2, Trash2, Utensils } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function FoodLogs() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { token, user } = useAuth();
  const { activeEvent, activeEventId } = useActiveEvent();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  const isAdmin = user?.userType === "admin" || (user?.userType as string) === "super_admin";

  const { data: logs = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/food/logs", debouncedSearch, activeEventId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activeEventId) params.set("eventId", String(activeEventId));
      const res = await fetch(`${BASE_URL}/api/food/logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["/api/food-sessions", activeEventId],
    queryFn: async () => {
      const url = activeEventId
        ? `${BASE_URL}/api/food-sessions?eventId=${activeEventId}`
        : `${BASE_URL}/api/food-sessions`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const urlParam = activeEventId ? `?eventId=${activeEventId}` : "";
      const res = await fetch(`${BASE_URL}/api/food/export${urlParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `food_logs_${activeEvent?.slug || "event"}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export Complete", description: "Food logs downloaded successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear ALL food coupon collection logs for this event?")) {
      return;
    }
    setClearing(true);
    try {
      const res = await fetch(`${BASE_URL}/api/food/logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear logs");
      toast({ title: "Logs Cleared", description: "All food logs cleared successfully." });
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this food log entry?")) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/food/logs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete log entry");
      toast({ title: "Log Deleted", description: "Log entry deleted successfully." });
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredLogs = logs.filter((log: any) => {
    if (activeTab !== "all" && String(log.foodSessionId) !== activeTab) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 text-zinc-100 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Food Collection Logs</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Audit trail of meal vouchers and digital coupon scans across sessions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={handleClearAll}
              disabled={clearing || logs.length === 0}
              className="h-10 px-4 gap-2 bg-[#18181C] border-[#2A2A32] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs font-bold rounded-2xl cursor-pointer"
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>Clear Logs</span>
            </Button>
          )}

          <Button
            onClick={handleExport}
            disabled={exporting || logs.length === 0}
            className="h-10 px-4 gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs rounded-2xl border-none cursor-pointer shadow-lg shadow-white/5"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* ── FILTERS & SESSIONS PILLS ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="p-4 rounded-3xl bg-[#151518] border border-[#26262B] shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search by name, pass ID, or registration number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#101013] border-[#2B2B32] text-zinc-200 placeholder:text-zinc-500 rounded-2xl text-xs h-10"
            />
          </div>

          <div className="text-xs text-zinc-400 font-mono">
            Showing <strong className="text-white">{filteredLogs.length}</strong> record{filteredLogs.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Session Selector Pills */}
        {sessions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "all"
                  ? "bg-white text-zinc-950 shadow-md"
                  : "bg-[#18181C] text-zinc-400 hover:text-white border border-[#26262B]"
              }`}
            >
              All Sessions ({logs.length})
            </button>
            {sessions.map((s: any) => {
              const count = logs.filter((l: any) => l.foodSessionId === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(String(s.id))}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    activeTab === String(s.id)
                      ? "bg-white text-zinc-950 shadow-md"
                      : "bg-[#18181C] text-zinc-400 hover:text-white border border-[#26262B]"
                  }`}
                >
                  {s.name} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TABLE ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#101013]/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429]">
              <tr>
                <th className="px-5 py-3.5 whitespace-nowrap">Time</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Participant</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Reg Number</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Meal Session</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Scanned By</th>
                {isAdmin && <th className="px-5 py-3.5 text-right whitespace-nowrap">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202026]">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={6} className="p-4">
                      <Skeleton className="h-8 bg-[#1B1B20] rounded-xl w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#1A1A1F]/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-zinc-400">
                      {log.collectedAt ? new Date(log.collectedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "—"}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-white">{log.participantName}</td>
                    <td className="px-4 py-3.5 font-mono font-bold text-zinc-300">{log.registrationNumber}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#202028] text-zinc-200 border border-[#2E2E38]">
                        {log.foodSessionName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400">{log.coordinatorName || "Scanner"}</td>
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete entry"
                          onClick={() => handleDelete(log.id)}
                          disabled={deletingId === log.id}
                          className="h-8 w-8 p-0 rounded-xl hover:bg-rose-950/50 text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <Utensils className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    <p className="font-semibold text-sm">No food logs recorded yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
