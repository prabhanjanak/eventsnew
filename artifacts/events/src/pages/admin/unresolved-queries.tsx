import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  HelpCircle,
  Mail,
  Phone,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Trash2,
  Plus,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  User,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface UnresolvedTicket {
  id: number;
  ticketNumber: string;
  userIdentifier: string;
  userEmail: string;
  userPhone: string | null;
  userMessage: string;
  botDraftResponse: string | null;
  status: "pending" | "resolved" | "dismissed";
  adminReply: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  addedToKnowledgeBase: boolean;
  createdAt: string;
}

interface KbEntry {
  id: number;
  topic: string;
  questionKeywords: string;
  questionText: string;
  verifiedAnswer: string;
  source: string;
  addedBy: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

export default function AdminUnresolvedQueriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"pending" | "resolved" | "knowledge">("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Reply Modal state
  const [replyTicket, setReplyTicket] = useState<UnresolvedTicket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [addToKb, setAddToKb] = useState(true);
  const [kbTopic, setKbTopic] = useState("General");
  const [kbKeywords, setKbKeywords] = useState("");
  const [responderName, setResponderName] = useState("Super Admin (Sankara HQ)");

  // Manual Add KB Modal state
  const [isAddKbOpen, setIsAddKbOpen] = useState(false);
  const [newKbQuestion, setNewKbQuestion] = useState("");
  const [newKbAnswer, setNewKbAnswer] = useState("");
  const [newKbTopic, setNewKbTopic] = useState("General");
  const [newKbKeywords, setNewKbKeywords] = useState("");

  // Fetch Tickets
  const { data: ticketsData, isLoading: isTicketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ["/api/admin/unresolved-queries", activeTab, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: activeTab === "knowledge" ? "all" : activeTab,
        search: search.trim(),
        page: String(page),
        limit: "50",
      });
      const res = await fetch(`/api/admin/unresolved-queries?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
    enabled: activeTab !== "knowledge",
  });

  // Fetch Knowledge Base
  const { data: kbData, isLoading: isKbLoading, refetch: refetchKb } = useQuery({
    queryKey: ["/api/admin/knowledge-base"],
    queryFn: async () => {
      const res = await fetch("/api/admin/knowledge-base");
      if (!res.ok) throw new Error("Failed to fetch knowledge base");
      return res.json();
    },
    enabled: activeTab === "knowledge",
  });

  // Resolve Ticket Mutation
  const resolveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/admin/resolve-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to resolve query");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reply Dispatched Successfully! ✉️",
        description: `Official response emailed via Zoho SMTP & added to Drishti AI Knowledge Base.`,
      });
      setReplyTicket(null);
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unresolved-queries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-base"] });
    },
    onError: (err: any) => {
      toast({
        title: "Dispatch Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Create Manual KB Entry Mutation
  const addKbMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/admin/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create knowledge base entry");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Knowledge Entry Created! 🧠",
        description: "Drishti AI will now automatically use this verified answer.",
      });
      setIsAddKbOpen(false);
      setNewKbQuestion("");
      setNewKbAnswer("");
      setNewKbKeywords("");
      refetchKb();
    },
  });

  // Delete KB Entry Mutation
  const deleteKbMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/knowledge-base/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Entry Removed", description: "Knowledge base entry deleted." });
      refetchKb();
    },
  });

  const tickets: UnresolvedTicket[] = ticketsData?.tickets || [];
  const stats = ticketsData?.stats || { totalTickets: 0, pendingCount: 0, resolvedCount: 0 };
  const kbEntries: KbEntry[] = kbData?.entries || [];

  const handleOpenReplyModal = (t: UnresolvedTicket) => {
    setReplyTicket(t);
    setReplyText("");
    setKbTopic("General");
    setKbKeywords("");
  };

  const handleSendReply = () => {
    if (!replyTicket || !replyText.trim()) return;
    resolveMutation.mutate({
      ticketId: replyTicket.id,
      adminReply: replyText.trim(),
      resolvedByName: responderName.trim() || "Super Admin (Sankara HQ)",
      addToKnowledgeBase: addToKb,
      topic: kbTopic.trim() || "General",
      questionKeywords: kbKeywords.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── TOP HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E1E26] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase font-mono tracking-wider">
              Human-in-the-Loop Intelligence
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-400 font-medium">Zoho SMTP Mailer &amp; Self-Learning AI Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <HelpCircle className="w-7 h-7 text-amber-400" />
            <span>AI Escalations &amp; Self-Learning Knowledge Base</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Review delegate questions that required human verification, email official answers directly, and automatically train Drishti AI.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {activeTab === "knowledge" ? (
            <Button
              onClick={() => setIsAddKbOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 text-xs"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Verified Q&amp;A</span>
            </Button>
          ) : (
            <Button
              onClick={() => refetchTickets()}
              variant="outline"
              size="sm"
              className="border-[#272732] bg-[#121216] text-zinc-300 hover:bg-[#1A1A22] hover:text-white text-xs gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          )}

          <Link href="/admin/chat-logs">
            <Button
              variant="outline"
              size="sm"
              className="border-[#272732] bg-[#121216] text-zinc-300 hover:bg-[#1A1A22] hover:text-white text-xs gap-1.5"
            >
              <span>View All Chat Logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── STATS CARDS ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#121216] border border-[#1E1E26] flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{stats.pendingCount}</div>
            <div className="text-xs text-zinc-400 font-medium">Pending Inquiries Awaiting Reply</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121216] border border-[#1E1E26] flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{stats.resolvedCount}</div>
            <div className="text-xs text-zinc-400 font-medium">Inquiries Resolved &amp; Emailed</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121216] border border-[#1E1E26] flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{kbEntries.length || "Active"}</div>
            <div className="text-xs text-zinc-400 font-medium">Learned Knowledge Base Articles</div>
          </div>
        </div>
      </div>

      {/* ── TAB NAVIGATION & SEARCH ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-[#121216] p-1.5 rounded-xl border border-[#1E1E26]">
          <button
            onClick={() => { setActiveTab("pending"); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "pending"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>⚠️ Pending Escalations</span>
            {stats.pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black">
                {stats.pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab("resolved"); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "resolved"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>✅ Resolved &amp; Emailed</span>
          </button>

          <button
            onClick={() => { setActiveTab("knowledge"); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "knowledge"
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>🧠 Dynamic AI Knowledge Base</span>
          </button>
        </div>

        {activeTab !== "knowledge" && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by ticket, email, or query..."
              className="pl-9 bg-[#121216] border-[#1E1E26] text-white text-xs h-9"
            />
          </div>
        )}
      </div>

      {/* ── TAB CONTENT: TICKETS (PENDING OR RESOLVED) ─────────────────────────── */}
      {activeTab !== "knowledge" && (
        <div className="rounded-2xl bg-[#121216] border border-[#1E1E26] overflow-hidden">
          {isTicketsLoading ? (
            <div className="p-12 text-center text-zinc-500 text-sm">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="text-base font-bold text-white">No {activeTab} inquiries found</div>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {activeTab === "pending"
                  ? "All escalated delegate inquiries have been resolved. Drishti AI is operating with full confidence!"
                  : "No resolved inquiries matching your search criteria."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1E1E26]">
              {tickets.map((t) => (
                <div key={t.id} className="p-5 hover:bg-[#16161C] transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-200 font-mono text-xs font-bold border border-zinc-700">
                        #{t.ticketNumber}
                      </span>
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        {t.userIdentifier || "Anonymous Delegate"}
                      </span>
                      <span className="text-xs text-cyan-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {t.userEmail}
                      </span>
                      {t.userPhone && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {t.userPhone}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(t.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                    </div>
                  </div>

                  {/* Question */}
                  <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#272736] text-sm text-zinc-200">
                    <span className="font-bold text-amber-400 text-xs uppercase tracking-wide block mb-1">
                      Delegate Question:
                    </span>
                    <span className="font-semibold text-white">"{t.userMessage}"</span>
                  </div>

                  {/* Resolved Reply */}
                  {t.status === "resolved" && t.adminReply && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-sm text-emerald-200 space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span>Official Response (Emailed via Zoho SMTP):</span>
                        <span>Resolved by: {t.resolvedBy || "Super Admin"}</span>
                      </div>
                      <p className="text-xs text-zinc-300 whitespace-pre-wrap">{t.adminReply}</p>
                    </div>
                  )}

                  {/* Action Button */}
                  {t.status === "pending" && (
                    <div className="flex justify-end pt-1">
                      <Button
                        onClick={() => handleOpenReplyModal(t)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 shadow-md"
                        size="sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Reply &amp; Train AI</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: KNOWLEDGE BASE ───────────────────────────────────────── */}
      {activeTab === "knowledge" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-200 space-y-1">
              <strong className="text-white block font-bold text-sm">Continuous Self-Learning Architecture</strong>
              Whenever a Super Admin replies to an unhandled question, it is automatically cataloged here. When future delegates ask related questions, Drishti AI answers with 100% verified accuracy directly from this knowledge base!
            </div>
          </div>

          <div className="rounded-2xl bg-[#121216] border border-[#1E1E26] overflow-hidden">
            {isKbLoading ? (
              <div className="p-12 text-center text-zinc-500 text-sm">Loading knowledge base...</div>
            ) : kbEntries.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <BookOpen className="w-12 h-12 text-zinc-600 mx-auto" />
                <div className="text-base font-bold text-white">No knowledge base entries yet</div>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Click "Add Verified Q&amp;A" above or reply to any pending escalation to start training Drishti AI.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#1E1E26]">
                {kbEntries.map((kb) => (
                  <div key={kb.id} className="p-5 hover:bg-[#16161C] transition-colors space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-bold text-[11px] border border-indigo-500/30">
                          {kb.topic}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">Keywords: {kb.questionKeywords}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-emerald-400 font-bold">Used {kb.usageCount} times</span>
                        <Button
                          onClick={() => {
                            if (confirm("Delete this knowledge entry?")) {
                              deleteKbMutation.mutate(kb.id);
                            }
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-sm font-bold text-white">Q: {kb.questionText}</div>
                      <div className="text-xs text-zinc-300 bg-[#1A1A22] p-3 rounded-xl border border-[#272736] whitespace-pre-wrap">
                        {kb.verifiedAnswer}
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                      <span>Added by: {kb.addedBy} • Source: {kb.source}</span>
                      <span>{new Date(kb.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 1. REPLY & TRAIN AI MODAL ─────────────────────────────────────────── */}
      <Dialog open={!!replyTicket} onOpenChange={(open) => !open && setReplyTicket(null)}>
        <DialogContent className="bg-[#121216] border border-[#272736] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-400" />
              <span>Reply to Delegate &amp; Train Drishti AI</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Ticket <span className="text-amber-400 font-mono font-bold">#{replyTicket?.ticketNumber}</span> • This response will be dispatched to <span className="text-white font-bold">{replyTicket?.userEmail}</span> via Zoho SMTP.
            </DialogDescription>
          </DialogHeader>

          {replyTicket && (
            <div className="space-y-4 py-2">
              {/* Question Box */}
              <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#272736] space-y-1">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                  Delegate Question:
                </span>
                <p className="text-sm font-semibold text-white">"{replyTicket.userMessage}"</p>
                <div className="text-xs text-zinc-400 flex items-center gap-3 pt-1">
                  <span>👤 {replyTicket.userIdentifier}</span>
                  <span>📧 {replyTicket.userEmail}</span>
                  {replyTicket.userPhone && <span>📱 {replyTicket.userPhone}</span>}
                </div>
              </div>

              {/* Reply Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">
                  Official Secretariat Response (Markdown Supported):
                </label>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your official verified reply here..."
                  rows={5}
                  className="bg-[#1A1A22] border-[#2E2E3E] text-white text-xs leading-relaxed focus:border-indigo-500"
                />
              </div>

              {/* Responder Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">Responder Title / Name:</label>
                  <Input
                    value={responderName}
                    onChange={(e) => setResponderName(e.target.value)}
                    className="bg-[#1A1A22] border-[#2E2E3E] text-white text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">Knowledge Category / Topic:</label>
                  <Input
                    value={kbTopic}
                    onChange={(e) => setKbTopic(e.target.value)}
                    placeholder="e.g. Registration, Accommodation, Agenda"
                    className="bg-[#1A1A22] border-[#2E2E3E] text-white text-xs h-9"
                  />
                </div>
              </div>

              {/* Add to Knowledge Base Checkbox */}
              <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="addToKbCheckbox"
                  checked={addToKb}
                  onChange={(e) => setAddToKb(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-indigo-600 bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="addToKbCheckbox" className="text-xs text-indigo-200 cursor-pointer space-y-0.5">
                  <strong className="text-white block font-bold">Auto-train Drishti AI Knowledge Base</strong>
                  Save this question and verified answer so future delegates asking similar questions will automatically receive this answer.
                </label>
              </div>

              {addToKb && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">
                    Search Trigger Keywords (comma-separated, optional):
                  </label>
                  <Input
                    value={kbKeywords}
                    onChange={(e) => setKbKeywords(e.target.value)}
                    placeholder="e.g. food timing, lunch pass, banquet, dining hall"
                    className="bg-[#1A1A22] border-[#2E2E3E] text-white text-xs h-9"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplyTicket(null)}
              className="border-[#2E2E3E] text-zinc-300 hover:bg-[#1A1A22]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendReply}
              disabled={!replyText.trim() || resolveMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 shadow-lg"
              size="sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{resolveMutation.isPending ? "Dispatching Email..." : "Send Email via SMTP & Train AI"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 2. MANUAL ADD KNOWLEDGE ENTRY MODAL ──────────────────────────────── */}
      <Dialog open={isAddKbOpen} onOpenChange={setIsAddKbOpen}>
        <DialogContent className="bg-[#121216] border border-[#272736] text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              <span>Add Verified Q&amp;A to Drishti AI</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Directly train Drishti AI with verified institutional information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">Topic / Category:</label>
              <Input
                value={newKbTopic}
                onChange={(e) => setNewKbTopic(e.target.value)}
                placeholder="e.g. Accommodation, Shuttle, Certificate"
                className="bg-[#1A1A22] border-[#2E2E3E] text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">Question / Inquiry:</label>
              <Input
                value={newKbQuestion}
                onChange={(e) => setNewKbQuestion(e.target.value)}
                placeholder="e.g. Is transport shuttle provided from Coimbatore airport?"
                className="bg-[#1A1A22] border-[#2E2E3E] text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">Search Keywords (comma-separated):</label>
              <Input
                value={newKbKeywords}
                onChange={(e) => setNewKbKeywords(e.target.value)}
                placeholder="e.g. airport, cab, shuttle, transport, pickup"
                className="bg-[#1A1A22] border-[#2E2E3E] text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">Verified Answer:</label>
              <Textarea
                value={newKbAnswer}
                onChange={(e) => setNewKbAnswer(e.target.value)}
                placeholder="Type the official verified answer here..."
                rows={5}
                className="bg-[#1A1A22] border-[#2E2E3E] text-white text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddKbOpen(false)}
              className="border-[#2E2E3E] text-zinc-300 hover:bg-[#1A1A22]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newKbQuestion.trim() || !newKbAnswer.trim()) return;
                addKbMutation.mutate({
                  topic: newKbTopic.trim() || "General",
                  questionText: newKbQuestion.trim(),
                  questionKeywords: newKbKeywords.trim() || newKbQuestion.trim(),
                  verifiedAnswer: newKbAnswer.trim(),
                });
              }}
              disabled={!newKbQuestion.trim() || !newKbAnswer.trim() || addKbMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5"
              size="sm"
            >
              <span>{addKbMutation.isPending ? "Saving..." : "Save Knowledge Entry"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
