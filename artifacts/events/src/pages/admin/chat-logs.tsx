import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  MessageSquare,
  Download,
  Search,
  Bot,
  User,
  Clock,
  Sparkles,
  RefreshCw,
  Eye,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ChatLog {
  id: number;
  sessionId: string;
  userIdentifier: string;
  userMessage: string;
  botResponse: string;
  modelUsed: string;
  latencyMs: number;
  createdAt: string;
}

interface ChatLogsResponse {
  logs: ChatLog[];
  pagination: {
    page: number;
    limit: number;
  };
  stats: {
    totalQueries: number;
    uniqueSessions: number;
    avgLatencyMs: number;
  };
}

export default function AdminChatLogsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<ChatLog | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<ChatLogsResponse>({
    queryKey: ["/api/admin/chat-logs", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        search: search.trim(),
      });
      const res = await fetch(`/api/admin/chat-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch chat logs");
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const stats = data?.stats || { totalQueries: 0, uniqueSessions: 0, avgLatencyMs: 0 };

  const handleDownloadCsv = () => {
    window.location.href = "/api/admin/chat-logs/export-csv";
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── TOP HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E1E26] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase font-mono tracking-wider">
              NVIDIA Nemotron 70B Engine
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-400 font-medium">NVIDIA NIM &amp; Hugging Face</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-7 h-7 text-cyan-400" />
            <span>AI Chatbot Telemetry &amp; Interaction Logs</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Audit delegate queries, monitor response latency, and export conversation transcripts for quality control.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            disabled={isFetching}
            className="h-9 rounded-xl border-[#2A2A36] bg-[#16161D] hover:bg-[#20202A] text-zinc-300 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin text-cyan-400" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={handleDownloadCsv}
            size="sm"
            className="h-9 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/30 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download CSV Logs
          </Button>
        </div>
      </div>

      {/* ── TELEMETRY STATS CARDS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#141419] border border-[#242430] space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>Total User Queries</span>
            <MessageSquare className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {stats.totalQueries.toLocaleString("en-IN")}
          </div>
          <p className="text-[10px] text-zinc-500 font-medium">Logged interaction turns</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141419] border border-[#242430] space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>Unique Sessions</span>
            <User className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {stats.uniqueSessions.toLocaleString("en-IN")}
          </div>
          <p className="text-[10px] text-zinc-500 font-medium">Distinct delegate threads</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141419] border border-[#242430] space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>Avg Response Speed</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {stats.avgLatencyMs} <span className="text-sm font-normal text-zinc-400">ms</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-medium">End-to-end inference latency</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141419] border border-[#242430] space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>LLM Model In Use</span>
            <Bot className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-sm font-black text-amber-300 truncate pt-1 font-mono">
            Llama-3.1-8B-Instruct
          </div>
          <p className="text-[10px] text-zinc-500 font-medium truncate">Grounded with Live PostgreSQL DB</p>
        </div>
      </div>

      {/* ── SEARCH FILTER ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search queries, delegate names, responses, or session IDs..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9.5 h-10 bg-[#16161D] border-[#2A2A36] rounded-xl text-xs sm:text-sm text-white placeholder:text-zinc-500"
          />
        </div>

        <span className="text-xs text-zinc-400 font-medium">
          Showing {logs.length} entries on page {page}
        </span>
      </div>

      {/* ── CHAT LOGS TABLE ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#22222C] bg-[#121216] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181820] text-zinc-400 uppercase text-[10px] font-black tracking-wider border-b border-[#242430]">
              <tr>
                <th className="py-3.5 px-4">Timestamp (IST)</th>
                <th className="py-3.5 px-4">Delegate / User</th>
                <th className="py-3.5 px-4">User Question</th>
                <th className="py-3.5 px-4">AI Response Snippet</th>
                <th className="py-3.5 px-4">Latency</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F28] text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Loading AI chat logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500 space-y-2">
                    <MessageSquare className="w-8 h-8 mx-auto text-zinc-600" />
                    <p className="text-sm font-bold text-zinc-400">No chat interactions found</p>
                    <p className="text-xs text-zinc-600">Queries submitted to the public chatbot widget will appear here in real-time.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const istDate = log.createdAt
                    ? new Date(log.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                    : "—";

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#181820] transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                        {istDate}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white max-w-[140px] truncate">
                        {log.userIdentifier || "Anonymous Delegate"}
                      </td>
                      <td className="py-3.5 px-4 max-w-[220px] truncate font-medium text-zinc-200">
                        "{log.userMessage}"
                      </td>
                      <td className="py-3.5 px-4 max-w-[280px] truncate text-zinc-400">
                        {log.botResponse}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.latencyMs < 1000
                            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
                            : log.latencyMs < 3000
                            ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                            : "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                        }`}>
                          {log.latencyMs} ms
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="h-7 px-2.5 rounded-lg text-cyan-400 hover:text-white hover:bg-cyan-950/40 text-xs font-bold"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PAGINATION CONTROLS ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-[#1E1E26] pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="h-8 rounded-xl border-[#2A2A36] bg-[#16161D] text-xs font-bold text-zinc-300"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
        </Button>
        <span className="text-xs text-zinc-500 font-mono">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
          disabled={logs.length < 50}
          className="h-8 rounded-xl border-[#2A2A36] bg-[#16161D] text-xs font-bold text-zinc-300"
        >
          Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      {/* ── DETAIL MODAL ─────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        {selectedLog && (
          <DialogContent className="max-w-2xl bg-[#14141A] border-[#2A2A36] text-white p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                <span>Chat Interaction Details</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Session: <span className="font-mono text-zinc-300">{selectedLog.sessionId}</span> • Model:{" "}
                <span className="font-mono text-amber-300">{selectedLog.modelUsed}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300 uppercase">
                  <span>Delegate Question ({selectedLog.userIdentifier})</span>
                  <span>{new Date(selectedLog.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                </div>
                <p className="text-sm font-medium text-white whitespace-pre-wrap">{selectedLog.userMessage}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38] space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-cyan-400 uppercase">
                  <span>AI Assistant Response</span>
                  <span>{selectedLog.latencyMs} ms Latency</span>
                </div>
                <div className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {selectedLog.botResponse}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
