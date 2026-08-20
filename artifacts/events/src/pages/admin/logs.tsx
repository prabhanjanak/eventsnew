import { useState, useEffect } from "react";
import { 
  ClipboardList, Search, RefreshCw, 
  ArrowLeft, FileText, Calendar, Clock, User, UserCheck
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type BackendLog = {
  id: number;
  type: string;
  message: string;
  timestamp: string;
};

type ScanningLog = {
  id: string;
  type: "attendance" | "food";
  timestamp: string;
  participantName: string;
  registrationNumber: string;
  details: string;
  coordinatorName: string;
};

type UploadLog = {
  id: number;
  filename: string;
  originalName: string;
  fileType: string;
  size: number;
  version: number;
  timestamp: string;
  participantName: string;
  registrationNumber: string;
  role: string;
  presentationTitle: string;
};

type LogsResponse = {
  backend: BackendLog[];
  scanning: ScanningLog[];
  uploads: UploadLog[];
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("backend");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("vision2020_token");
      const res = await fetch(`${BASE_URL}/api/dashboard/logs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          toast({ title: "Session Expired", description: "Please log in again.", variant: "destructive" });
          setLocation("/login");
          return;
        }
        throw new Error("Failed to load logs");
      }

      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      toast({
        title: "Error Loading Logs",
        description: err.message || "Could not fetch audit history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredBackend = logs?.backend.filter(l => 
    l.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredScanning = logs?.scanning.filter(l => 
    l.participantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.coordinatorName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredUploads = logs?.uploads.filter(l => 
    l.participantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.presentationTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.role.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 text-zinc-100 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]/80">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/dashboard" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5 cursor-pointer" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              System Audit Logs
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Audit logs for sync processes, attendee scanning activity, and faculty file uploads
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchLogs} 
          disabled={loading}
          className="h-10 px-4 gap-2 bg-[#18181C] border-[#2A2A32] text-zinc-200 hover:text-white rounded-2xl text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Logs</span>
        </Button>
      </div>

      {/* ── SEARCH & TABS ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="p-4 rounded-3xl bg-[#151518] border border-[#26262B] shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search logs by keyword, name, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#101013] border-[#2B2B32] text-zinc-200 placeholder:text-zinc-500 rounded-2xl text-xs h-10"
            />
          </div>

          <div className="flex rounded-2xl border border-[#26262B] bg-[#101013] p-1 gap-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("backend")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "backend"
                  ? "bg-white text-zinc-950 shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              System Events ({filteredBackend.length})
            </button>
            <button
              onClick={() => setActiveTab("scanning")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "scanning"
                  ? "bg-white text-zinc-950 shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Check-In Scans ({filteredScanning.length})
            </button>
            <button
              onClick={() => setActiveTab("uploads")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "uploads"
                  ? "bg-white text-zinc-950 shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              File Uploads ({filteredUploads.length})
            </button>
          </div>
        </div>
      </div>

      {/* ── TABLE CONTAINER ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-10 bg-[#1B1B20] rounded-2xl w-full" />
            ))}
          </div>
        ) : activeTab === "backend" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#101013]/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429]">
                <tr>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Audit Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202026]">
                {filteredBackend.length > 0 ? (
                  filteredBackend.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1A1A1F]/70 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-zinc-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#202028] text-zinc-200 border border-[#2E2E38]">
                          {log.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-white">{log.message}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-zinc-500">
                      No system logs found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === "scanning" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#101013]/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429]">
                <tr>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-4 py-3.5">Participant</th>
                  <th className="px-4 py-3.5">Reg Number</th>
                  <th className="px-4 py-3.5">Activity</th>
                  <th className="px-4 py-3.5">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202026]">
                {filteredScanning.length > 0 ? (
                  filteredScanning.map((scan) => (
                    <tr key={scan.id} className="hover:bg-[#1A1A1F]/70 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-zinc-400 whitespace-nowrap">
                        {new Date(scan.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-white">{scan.participantName}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-zinc-300">{scan.registrationNumber}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#202028] text-zinc-200 border border-[#2E2E38]">
                          {scan.details}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-zinc-400">{scan.coordinatorName}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      No scanning audit records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#101013]/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429]">
                <tr>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-4 py-3.5">Faculty Presenter</th>
                  <th className="px-4 py-3.5">Reg Number</th>
                  <th className="px-4 py-3.5">File Name</th>
                  <th className="px-4 py-3.5">Presentation Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202026]">
                {filteredUploads.length > 0 ? (
                  filteredUploads.map((up) => (
                    <tr key={up.id} className="hover:bg-[#1A1A1F]/70 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-zinc-400 whitespace-nowrap">
                        {new Date(up.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-white">{up.participantName}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-zinc-300">{up.registrationNumber}</td>
                      <td className="px-4 py-3.5 text-zinc-300 font-mono text-[11px]">{up.originalName || up.filename}</td>
                      <td className="px-4 py-3.5 text-zinc-300 font-medium truncate max-w-xs">{up.presentationTitle || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      No upload logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
