import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import TracksPage, { getTrackMeta } from "@/pages/tracks";
import {
  useGetParticipant, getGetParticipantQueryKey,
  useGetParticipantQR, getGetParticipantQRQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import {
  Download, Upload, CheckCircle2, AlertCircle, User, Building2,
  Phone, Mail, QrCode, FileText, Clock, MapPin, Calendar,
  UserCheck, Gift, Utensils, Loader2, ExternalLink, RefreshCw,
  FileBadge, FileImage, Presentation, ChevronRight,
  Star, Search, LayoutGrid
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────
const FACULTY_ROLES = ["Speaker", "Presenter", "Poster", "Panelist", "Moderator", "Judge", "Chair", "CoChair"];

const ROLE_COLOR: Record<string, string> = {
  Speaker: "bg-blue-50 text-blue-700 border-blue-200",
  Presenter: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Poster: "bg-cyan-50 text-cyan-700 border-cyan-200",
  Panelist: "bg-violet-50 text-violet-700 border-violet-200",
  Moderator: "bg-purple-50 text-purple-700 border-purple-200",
  Judge: "bg-amber-50 text-amber-700 border-amber-200",
  Chair: "bg-orange-50 text-orange-700 border-orange-200",
  CoChair: "bg-rose-50 text-rose-700 border-rose-200",
};

const ROLE_GRADIENT: Record<string, string> = {
  Speaker: "from-blue-500 to-blue-700",
  Presenter: "from-indigo-500 to-indigo-700",
  Poster: "from-cyan-500 to-cyan-700",
  Panelist: "from-violet-500 to-violet-700",
  Moderator: "from-purple-500 to-purple-700",
  Judge: "from-amber-500 to-amber-700",
  Chair: "from-orange-500 to-orange-700",
  CoChair: "from-rose-500 to-rose-700",
};

function needsUpload(role: string) {
  return ["Speaker", "Presenter", "Poster"].includes(role);
}

function getFileIcon(role: string) {
  if (role === "Poster") return FileImage;
  return Presentation;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseDDMMYYYY(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1; // 0-indexed
    const y = parseInt(match[3], 10);
    return new Date(y, m, d);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = parseDDMMYYYY(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ParticipantDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const participantId = user?.participantId;

  const { data: participant, isLoading } = useGetParticipant(participantId as number, {
    query: { enabled: !!participantId, queryKey: getGetParticipantQueryKey(participantId as number) }
  });

  const { data: qrcodes, isLoading: isQRLoading } = useGetParticipantQR(participantId as number, {
    query: { enabled: !!participantId, queryKey: getGetParticipantQRQueryKey(participantId as number) }
  });

  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // ── Timetable states ──
  const [timetable, setTimetable] = useState<any>(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  // ── Schedule filtering states ──
  const [selectedTrack, setSelectedTrack] = useState<string>("All Tracks");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [agendaTab, setAgendaTab] = useState<"all" | "favorites">("all");

  // ── RSVP states ──
  const [rsvpList, setRsvpList] = useState<any[]>([]);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpToggling, setRsvpToggling] = useState<string | null>(null);

  // Load timetable on mount
  useEffect(() => {
    async function loadTimetable() {
      setTimetableLoading(true);
      try {
        const res = await fetch("/api/timetable");
        if (res.ok) setTimetable(await res.json());
      } catch { /* silent */ } finally {
        setTimetableLoading(false);
      }
    }
    loadTimetable();
  }, []);

  // Load RSVPs when participant is available
  useEffect(() => {
    if (!participantId) return;
    async function loadRsvps() {
      setRsvpLoading(true);
      try {
        const token = localStorage.getItem("vision2020_token");
        const res = await fetch(`/api/rsvp/${participantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setRsvpList(await res.json());
      } catch { /* silent */ } finally {
        setRsvpLoading(false);
      }
    }
    loadRsvps();
  }, [participantId]);

  const toggleRsvp = async (session: { trackName: string; sessionName: string; sessionDate: string; sessionTime: string }) => {
    const key = `${session.trackName}||${session.sessionName}||${session.sessionDate}`;
    const existing = rsvpList.find(
      (r) => r.trackName === session.trackName && r.sessionName === session.sessionName && r.sessionDate === session.sessionDate
    );
    setRsvpToggling(key);
    const token = localStorage.getItem("vision2020_token");
    try {
      if (existing) {
        const res = await fetch(`/api/rsvp/${existing.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setRsvpList((prev) => prev.filter((r) => r.id !== existing.id));
          toast({ title: "Wish to Attend Removed", description: `Removed from ${session.sessionName}` });
        }
      } else {
        const res = await fetch("/api/rsvp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(session),
        });
        if (res.ok) {
          const newRsvp = await res.json();
          setRsvpList((prev) => [...prev, newRsvp]);
          toast({ title: "Wish to Attend Added ✓", description: `You'll get a reminder before ${session.sessionName}` });
        }
      }
    } catch { toast({ title: "Wish to Attend Error", variant: "destructive" }); }
    finally { setRsvpToggling(null); }
  };

  const handleFileUpload = async (assignmentId: number, file: File) => {
    setUploadingId(assignmentId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/assignments/${assignmentId}/file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("vision2020_token")}` },
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload file");
      toast({ title: "✅ File uploaded successfully", description: "Your file has been received and stored." });
      queryClient.invalidateQueries({ queryKey: getGetParticipantQueryKey(participantId as number) });
    } catch (error: unknown) {
      toast({ title: "Upload failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  if (!user || !participantId) return <div className="p-8 text-slate-800">Participant data not found.</div>;

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-52 w-full rounded-3xl bg-slate-200/50 border border-slate-200" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl bg-slate-200/50 border border-slate-200" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl bg-slate-200/50 border border-slate-200" />
      </div>
    );
  }

  const assignments = participant?.assignments || [];
  const facultyAssignments = assignments.filter(a => needsUpload(a.role));
  const hasFacultyRole = assignments.some(a => FACULTY_ROLES.includes(a.role));
  const hasUploadableAssignment = facultyAssignments.length > 0;
  const primaryRoles = [...new Set(assignments.map(a => a.role))];
  const uploadedCount = facultyAssignments.filter(a => a.uploadedFile).length;
  const pendingCount = facultyAssignments.filter(a => !a.uploadedFile).length;

  // Food coupon stats
  const totalCoupons = participant?.foodCoupons?.length ?? 0;
  const usedCoupons = participant?.foodCoupons?.filter(c => c.collected).length ?? 0;

  // Initials for avatar
  const initials = (participant?.name || "??")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ── Filter timetable logic ──
  const dayData = timetable?.days?.[selectedDay];
  const filteredTimeSlots = dayData?.timeSlots?.map((slot: any) => {
    const filteredSessions = slot.sessions.map((s: any) => {
      const filteredItems = s.items.filter((item: any) => {
        if (selectedTrack !== "All Tracks" && s.track !== selectedTrack) return false;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchesSessionName = item.sessionName?.toLowerCase().includes(query);
          const matchesHall = item.hall?.toLowerCase().includes(query);
          const matchesSpeakers = item.speakers?.some(
            (sp: any) => sp.name?.toLowerCase().includes(query) || sp.role?.toLowerCase().includes(query) || sp.title?.toLowerCase().includes(query)
          );
          if (!matchesSessionName && !matchesHall && !matchesSpeakers) return false;
        }
        return true;
      });
      return { ...s, items: filteredItems };
    }).filter((s: any) => s.items.length > 0);
    return { ...slot, sessions: filteredSessions };
  }).filter((slot: any) => slot.sessions.length > 0) ?? [];

  return (
    <div className="relative min-h-full space-y-6 max-w-7xl mx-auto pb-8 z-10 text-slate-800 animate-in fade-in duration-500">

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PROFILE HERO BANNER */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl bg-white border border-slate-200 hover:border-orange-500/20 transition-all duration-500 z-10">
        {/* Colorful dynamic auroras inside the hero */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-gradient-to-br from-[#F58220]/10 to-[#6F42C1]/5 blur-3xl pointer-events-none animate-pulse duration-[6000ms]" />
        <div className="absolute -bottom-10 left-1/4 w-60 h-60 rounded-full bg-gradient-to-tr from-[#6F42C1]/12 to-pink-500/5 blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />

        {/* Main profile info */}
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-5 items-start">

            {/* Avatar */}
            <div className="relative shrink-0 group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#F58220] to-[#6F42C1] flex items-center justify-center shadow-xl shadow-orange-500/10 border-2 border-white group-hover:scale-105 group-hover:shadow-[#F58220]/20 group-hover:shadow-2xl transition-all duration-300">
                <span className="text-white text-2xl sm:text-3xl font-black tracking-tight drop-shadow-md">{initials}</span>
              </div>
              {hasFacultyRole && (
                <div className="absolute -bottom-2 -right-2 bg-[#F58220] rounded-full p-1 border-2 border-white shadow">
                  <FileBadge className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Name & Info */}
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight break-words">
                  {participant?.name}
                </h1>
                {hasFacultyRole && (
                  <span className="px-2.5 py-0.5 bg-[#F58220]/10 text-[#F58220] border border-[#F58220]/20 rounded-full text-xs font-bold tracking-wide uppercase">
                    Faculty
                  </span>
                )}
              </div>

              <div className="flex items-start gap-2 text-slate-500 text-sm mb-3">
                <Building2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span className="break-words font-semibold">{participant?.institution}</span>
              </div>

              {/* Role badges */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {primaryRoles.length > 0 ? primaryRoles.map(role => (
                  <span
                    key={role}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border bg-gradient-to-r ${ROLE_GRADIENT[role] || "from-gray-500 to-gray-750"} text-white border-white/10 shadow-sm`}
                  >
                    {role}
                  </span>
                )) : (
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">
                    Delegate
                  </span>
                )}
              </div>

              {/* Contact strip */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-400 font-bold">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="break-all">{participant?.email || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>{participant?.mobile || "—"}</span>
                </div>
              </div>
            </div>

            {/* Registration No. — right side */}
            <div className="shrink-0 text-left sm:text-right w-full sm:w-auto sm:pl-4 sm:border-l sm:border-slate-200 mt-4 sm:mt-0">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Reg. Number</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 tracking-wider">
                {participant?.registrationNumber}
              </div>
              <div className="text-xs text-slate-400 font-bold mt-1">Vision 2020 · Jul 2026</div>
            </div>
          </div>
        </div>

        {/* ── Status Bar ── */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-slate-100 bg-slate-50/40">
          {[
            {
              icon: UserCheck,
              label: "Attendance",
              value: participant?.attendanceMarked ? "Marked" : "Pending",
              ok: participant?.attendanceMarked,
            },
            {
              icon: Gift,
              label: "Goodies",
              value: participant?.goodiesCollected ? "Collected" : "Pending",
              ok: participant?.goodiesCollected,
            },
            {
              icon: Utensils,
              label: "Food Coupons",
              value: `${usedCoupons} / ${totalCoupons} Used`,
              ok: usedCoupons > 0,
            },
            {
              icon: Upload,
              label: "Uploads",
              value: hasUploadableAssignment
                ? (pendingCount === 0 ? "All Submitted" : `${pendingCount} Pending`)
                : "No Upload Required",
              ok: hasUploadableAssignment ? pendingCount === 0 : true,
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-4 py-3.5 border-slate-100 group/status cursor-default ${
                  i % 2 === 0 ? "border-r" : ""
                } ${
                  i < 2 ? "border-b md:border-b-0" : ""
                } md:border-b-0 md:border-r md:last:border-r-0 hover:bg-slate-100/50 transition-colors duration-200`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover/status:scale-110 ${item.ok ? "bg-emerald-100 border border-emerald-250" : "bg-slate-200/60 border border-slate-300"}`}>
                  <Icon className={`w-4 h-4 ${item.ok ? "text-emerald-600" : "text-slate-500"}`} />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide group-hover/status:text-slate-600 transition-colors">{item.label}</div>
                  <div className={`text-xs font-black mt-0.5 tracking-wide ${item.ok ? "text-emerald-600" : "text-slate-700"}`}>
                    {item.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT TABS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 border border-slate-200 p-1 rounded-xl h-auto flex overflow-x-auto max-w-full md:inline-flex gap-0.5 scrollbar-none snap-x whitespace-nowrap shadow-sm">
          <TabsTrigger 
            value="overview" 
            className="rounded-lg py-2 px-4 font-bold text-sm gap-1.5 shrink-0 snap-start text-slate-600 hover:text-slate-900 data-[state=active]:bg-[#F58220] data-[state=active]:text-white transition-all duration-200"
          >
            <User className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          {hasUploadableAssignment && (
            <TabsTrigger 
              value="uploads" 
              className="rounded-lg py-2 px-4 font-bold text-sm gap-1.5 shrink-0 snap-start text-slate-600 hover:text-slate-900 data-[state=active]:bg-[#F58220] data-[state=active]:text-white transition-all duration-200"
            >
              <Upload className="w-3.5 h-3.5" />
              Uploads
              {pendingCount > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger 
            value="schedule" 
            className="rounded-lg py-2 px-4 font-bold text-sm gap-1.5 shrink-0 snap-start text-slate-600 hover:text-slate-900 data-[state=active]:bg-[#F58220] data-[state=active]:text-white transition-all duration-200"
          >
            <Calendar className="w-3.5 h-3.5" /> My Commitments
          </TabsTrigger>
          <TabsTrigger 
            value="wishlist" 
            className="rounded-lg py-2 px-4 font-bold text-sm gap-1.5 shrink-0 snap-start text-slate-600 hover:text-slate-900 data-[state=active]:bg-[#F58220] data-[state=active]:text-white transition-all duration-200"
          >
            <Star className="w-3.5 h-3.5" /> Wish to Attend
          </TabsTrigger>
          <TabsTrigger 
            value="qr" 
            className="rounded-lg py-2 px-4 font-bold text-sm gap-1.5 shrink-0 snap-start text-slate-600 hover:text-slate-900 data-[state=active]:bg-[#F58220] data-[state=active]:text-white transition-all duration-200"
          >
            <QrCode className="w-3.5 h-3.5" /> My QR Codes
          </TabsTrigger>
          <TabsTrigger 
            value="map" 
            className="rounded-lg py-2 px-4 font-bold text-sm gap-1.5 shrink-0 snap-start text-slate-600 hover:text-slate-900 data-[state=active]:bg-[#F58220] data-[state=active]:text-white transition-all duration-200"
          >
            <MapPin className="w-3.5 h-3.5" /> Venue Map
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-5 space-y-5">
          {/* SAHAI Voice Feedback Banner */}
          <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/5 border border-teal-500/20 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />
            <div className="flex gap-4 items-center">
              <div className="p-1 bg-white rounded-2xl border border-slate-150 shadow-sm shrink-0">
                <img src="/sahailogo.png" alt="SAHAI Logo" className="w-12 h-12 object-contain" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-800 leading-snug flex items-center gap-1.5 flex-wrap">
                  Sankara Health through Artificial Intelligence — SAHAI
                  <Badge className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-[9px] uppercase tracking-wider">Voice Feedback</Badge>
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
                  We value your feedback. Speak your thoughts directly in any regional or local language to voice your comments.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => window.open("https://avi-live.pradhi.ai/sefi/af2e7849-2a14-446c-b486-42065ded3945/public/forms/30413d33-0065-427f-baf6-ab93767ed8aa/submissions", "_blank")}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shrink-0 cursor-pointer shadow-md shadow-teal-600/10 active:scale-[0.98] transition-transform"
            >
              Give Voice Feedback
            </Button>
          </div>
          {/* Chair / Co-Chair / Moderator slots highlight */}
          {assignments.some(a => ["Chair", "CoChair", "Moderator", "Judge"].includes(a.role)) && (
            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-800 tracking-tight uppercase text-[#F58220] flex items-center gap-2">
                <Star className="w-4 h-4 text-[#F58220] animate-pulse" /> My Chair / Co-Chair Session Duties
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignments
                  .filter(a => ["Chair", "CoChair", "Moderator", "Judge"].includes(a.role))
                  .map((assignment) => (
                    <Card key={assignment.id} className="bg-gradient-to-br from-[#0d1b3e] to-[#1a2f5a] border-0 text-white shadow-xl rounded-2xl overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-orange-500/10 blur-2xl pointer-events-none" />
                      <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="px-3 py-1 bg-[#F58220] text-white font-black text-xs rounded-lg uppercase tracking-wide">
                            {assignment.role}
                          </span>
                          <span className="text-white text-xs font-extrabold font-mono">
                            {getTrackMeta(assignment.track).name}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Session Topic</div>
                          <div className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">
                            {assignment.sessionName || "General Session"}
                          </div>
                        </div>

                        {assignment.presentationTitle && (
                          <div className="space-y-1">
                            <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Presentation Title</div>
                            <div className="text-sm font-bold text-orange-200 leading-snug">
                              "{assignment.presentationTitle}"
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10 text-sm font-bold">
                          <div>
                            <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3 text-orange-400" /> Timing</div>
                            <div className="text-base font-black text-white">{assignment.time || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="w-3 h-3 text-orange-400" /> Hall / Location</div>
                            <div className="text-base font-black text-orange-400">{assignment.hall || "—"}</div>
                          </div>
                        </div>

                        {assignment.date && (
                          <div className="text-[10px] text-white/40 font-bold flex items-center gap-1 mt-2">
                            <Calendar className="w-3 h-3 text-orange-400" /> Assigned Date: {formatDate(assignment.date)}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Profile Card */}
            <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-orange-500/25 transition-all duration-300 lg:col-span-2 text-slate-800">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700 font-bold">
                  <User className="w-4 h-4 text-[#F58220]" /> Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { icon: User, label: "Full Name", value: participant?.name },
                  { icon: Building2, label: "Institution / Hospital", value: participant?.institution },
                  { icon: Mail, label: "Email Address", value: participant?.email },
                  { icon: Phone, label: "Mobile Number", value: participant?.mobile },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#F58220]" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.label}</div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5 break-all">{item.value || "—"}</div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Food Coupons Card */}
            <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-purple-500/25 transition-all duration-300 text-slate-800">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700 font-bold">
                  <Utensils className="w-4 h-4 text-[#6F42C1]" /> Food Coupons
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2.5">
                {participant?.foodCoupons && participant.foodCoupons.length > 0 ? (
                  participant.foodCoupons.map((coupon) => (
                    <div
                      key={coupon.foodSessionId}
                      className={`flex items-center justify-between p-3 rounded-xl border text-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-sm ${
                        coupon.collected
                          ? "bg-emerald-50 border-emerald-150 text-emerald-800 font-semibold"
                          : "bg-slate-50/50 border-slate-200 hover:bg-orange-50/20 hover:border-orange-200"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{coupon.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">{coupon.date}</div>
                      </div>
                      {coupon.collected ? (
                        <div className="flex items-center gap-1 text-emerald-600 text-xs font-black">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Used
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px] font-bold">Unused</div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs text-center py-4 font-bold">No food sessions scheduled</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Upload CTA for faculty */}
          {hasFacultyRole && pendingCount > 0 && (
            <div
              onClick={() => setActiveTab("uploads")}
              className="cursor-pointer group flex items-center gap-4 p-4 rounded-2xl border border-amber-200 bg-amber-55/65 hover:border-amber-400 hover:shadow-lg hover:shadow-orange-500/5 hover:-translate-y-0.5 transition-all duration-300 animate-pulse duration-[3000ms]"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-amber-800 text-sm">
                  {pendingCount} Presentation{pendingCount > 1 ? "s" : ""} Awaiting Upload
                </div>
                <div className="text-amber-600 text-xs mt-0.5 font-bold">
                  Please submit your files before the conference deadline. Click to upload now.
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </TabsContent>

        {/* ── Uploads Tab ── */}
        {hasUploadableAssignment && (
          <TabsContent value="uploads" className="mt-5 space-y-4">
            <Card className="bg-[#F58220]/5 border border-[#F58220]/15 rounded-2xl p-4 text-slate-700">
              <div className="font-extrabold text-xs text-[#F58220] flex items-center gap-1.5 mb-1">
                <Upload className="w-4 h-4 text-[#F58220]" /> Faculty Slide Upload Guide
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 font-semibold">
                To submit your materials, click <strong className="text-[#F58220]">"Upload File"</strong> on the corresponding session card below. To modify or replace a previously submitted file, simply tap <strong className="text-[#F58220]">"Replace File"</strong> to upload the latest version.
              </p>
            </Card>

          {facultyAssignments.length === 0 ? (
            <Card className="bg-white border border-slate-200 shadow-sm text-slate-800">
              <CardContent className="py-16 text-center">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-600 font-bold">No file submissions required</p>
                <p className="text-slate-400 text-sm mt-1 font-semibold">
                  Only Speakers, Presenters, and Poster Presenters need to upload files.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Upload summary header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Presentation Files</h2>
                  <p className="text-sm text-slate-500 mt-0.5 font-semibold">
                    {uploadedCount} of {facultyAssignments.length} submitted
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pendingCount === 0 ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> All Submitted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-250">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-550" /> {pendingCount} Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200 shadow-inner">
                <div
                  className="h-2 bg-gradient-to-r from-[#F58220] to-[#6F42C1] rounded-full transition-all duration-500"
                  style={{ width: `${facultyAssignments.length > 0 ? (uploadedCount / facultyAssignments.length) * 100 : 0}%` }}
                />
              </div>

              {/* Upload cards */}
              <div className="space-y-4">
                {facultyAssignments.map((assignment) => {
                  const FileIcon = getFileIcon(assignment.role);
                  const uploaded = !!assignment.uploadedFile;
                  const isUploading = uploadingId === assignment.id;
                  const roleClass = ROLE_COLOR[assignment.role] || "bg-slate-100 text-slate-700 border-slate-200";

                  return (
                    <Card
                      key={assignment.id}
                      className={`border shadow-md overflow-hidden bg-white transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${
                        uploaded
                          ? "border-emerald-250 hover:border-emerald-400"
                          : "border-amber-250 hover:border-amber-400"
                      }`}
                    >
                      {/* Card header strip */}
                      <div className={`px-5 py-2.5 border-b flex items-center gap-3 ${
                        uploaded ? "border-emerald-100 bg-emerald-50/40" : "border-amber-100 bg-amber-50/30"
                      }`}>
                        <Badge variant="outline" className={`${roleClass} text-xs font-bold border`}>
                          {assignment.role}
                        </Badge>
                        {assignment.track && (
                          <span className="text-xs text-slate-500 font-bold">{getTrackMeta(assignment.track).name}</span>
                        )}
                        <div className="ml-auto flex items-center gap-1.5">
                          {uploaded ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-black">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Uploaded
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600 text-xs font-black">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Upload Required
                            </span>
                          )}
                        </div>
                      </div>

                      <CardContent className="p-5 text-slate-800">
                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* Left: assignment info */}
                          <div className="flex-1 min-w-0">
                            {assignment.presentationTitle && (
                              <h3 className="font-bold text-slate-900 text-sm leading-snug mb-2">
                                "{assignment.presentationTitle}"
                              </h3>
                            )}
                            {assignment.sessionName && (
                              <p className="text-xs text-slate-500 mb-3 font-semibold">{assignment.sessionName}</p>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-slate-400 font-bold">
                              {assignment.date && (
                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg text-slate-600">
                                  <Calendar className="w-3 h-3 text-[#F58220]" />
                                  {formatDate(assignment.date)}
                                </div>
                              )}
                              {assignment.time && (
                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg text-slate-600">
                                  <Clock className="w-3 h-3 text-[#F58220]" />
                                  {assignment.time}
                                </div>
                              )}
                              {assignment.hall && (
                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg text-slate-600">
                                  <MapPin className="w-3 h-3 text-[#F58220]" />
                                  {assignment.hall}
                                </div>
                              )}
                            </div>

                            {/* Uploaded file info */}
                            {assignment.uploadedFile && (
                              <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 border border-emerald-200 shadow-sm">
                                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-250">
                                  <FileIcon className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-slate-800 truncate">
                                    {assignment.uploadedFile.originalName}
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400 font-bold">
                                    <span>{formatFileSize(assignment.uploadedFile.size)}</span>
                                    <span>Version {assignment.uploadedFile.version}</span>
                                    <span>{formatDate(assignment.uploadedFile.uploadedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right: upload/download actions */}
                          <div className="flex flex-col gap-2.5 sm:items-end shrink-0">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide text-center sm:text-right mb-0.5">
                              {(assignment.role as string) === "Poster"
                                ? "Accepted: JPG, PNG"
                                : "Accepted: PPT, PPTX, PDF"}
                            </div>

                            {/* Upload button */}
                            <label htmlFor={`upload-${assignment.id}`} className="cursor-pointer w-full sm:w-auto">
                              <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                                uploaded
                                  ? "bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 shadow-sm"
                                  : "bg-gradient-to-r from-[#F58220] to-[#e07010] text-white shadow-md shadow-orange-100 hover:shadow-lg hover:shadow-orange-200 hover:-translate-y-0.5"
                              }`}>
                                {isUploading ? (
                                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                                ) : (
                                  <><Upload className="w-3.5 h-3.5" /> {uploaded ? "Replace File" : "Upload File"}</>
                                )}
                              </div>
                              <Input
                                id={`upload-${assignment.id}`}
                                type="file"
                                className="hidden"
                                accept={(assignment.role as string) === "Poster" ? ".jpg,.jpeg,.png" : ".ppt,.pptx,.pdf"}
                                disabled={isUploading}
                                onChange={(e) => {
                                  if (e.target.files?.[0]) handleFileUpload(assignment.id, e.target.files[0]);
                                }}
                              />
                            </label>

                            {/* Actions */}
                            {assignment.uploadedFile && (
                              <div className="flex gap-2">
                                <a
                                  href={`/api/assignments/${assignment.id}/file/view?token=${encodeURIComponent(localStorage.getItem("vision2020_token") || "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex-1 sm:flex-auto shadow-sm"
                                  title="View File"
                                >
                                  <Search className="w-3.5 h-3.5 text-[#6F42C1]" /> View
                                </a>
                                <a
                                  href={`/api/assignments/${assignment.id}/file/download?token=${encodeURIComponent(localStorage.getItem("vision2020_token") || "")}`}
                                  download
                                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex-1 sm:flex-auto shadow-sm"
                                  title="Download File"
                                >
                                  <Download className="w-3.5 h-3.5 text-[#F58220]" /> Download
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
        )}

        {/* ── Schedule Tab (My Commitments) ── */}
        <TabsContent value="schedule" className="mt-5 space-y-5">
          {/* My Presentations section (only if speaker/faculty has assignments) */}
          {assignments.length > 0 ? (
            <div className="space-y-3 bg-orange-50/20 border border-orange-500/10 p-5 rounded-2xl">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Presentation className="w-4 h-4 text-[#F58220]" />
                My Commitments
              </h3>
              <p className="text-xs text-slate-500 font-semibold mb-3">
                These are the sessions where you are registered as a speaker, moderator, or judge.
              </p>
              <div className="space-y-3">
                {assignments.map(assignment => {
                  const roleClass = ROLE_COLOR[assignment.role] || "bg-slate-100 text-slate-700 border-slate-200";
                  return (
                    <div key={assignment.id} className="flex gap-4 p-4 rounded-xl border border-slate-150 bg-white shadow-sm hover:shadow transition-shadow">
                      {/* Date chip */}
                      <div className="shrink-0 w-14 text-center">
                        {assignment.date && parseDDMMYYYY(assignment.date) ? (
                          <>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              {parseDDMMYYYY(assignment.date)!.toLocaleDateString("en-IN", { month: "short" })}
                            </div>
                            <div className="text-lg font-black text-slate-800 leading-none mt-0.5">
                              {parseDDMMYYYY(assignment.date)!.getDate()}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-400">TBD</div>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="w-px bg-slate-150 shrink-0" />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge variant="outline" className={`${roleClass} text-xs font-extrabold border`}>
                            {assignment.role}
                          </Badge>
                          {assignment.track && (
                            <span className="text-xs text-slate-900 font-extrabold">{getTrackMeta(assignment.track).name}</span>
                          )}
                        </div>
                        {assignment.presentationTitle && (
                          <p className="text-sm font-extrabold text-slate-900 mb-1 leading-snug">
                            {assignment.presentationTitle}
                          </p>
                        )}
                        {assignment.sessionName && (
                          <p className="text-xs text-slate-500 mb-2 font-semibold">{assignment.sessionName}</p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400 font-bold">
                          {assignment.time && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#F58220]" />{assignment.time}</span>
                          )}
                          {assignment.hall && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#F58220]" />{assignment.hall}</span>
                          )}
                        </div>
                      </div>

                      {/* Upload status for faculty */}
                      {needsUpload(assignment.role) && (
                        <div className="shrink-0 flex items-center">
                          {assignment.uploadedFile ? (
                            <span className="text-emerald-500"><CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100" /></span>
                          ) : (
                            <span className="text-amber-400"><AlertCircle className="w-5 h-5 text-amber-500 fill-amber-50" /></span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6">
              <Presentation className="w-8 h-8 text-slate-350 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">No Commitments Assigned</p>
              <p className="text-xs text-slate-400 mt-1">You do not have any registered speaker, moderator, or judge duties.</p>
            </div>
          )}
        </TabsContent>

        {/* ── Wish to Attend Tab (My Wishlist) ── */}
        <TabsContent value="wishlist" className="mt-5 space-y-5">
          {rsvpList.length > 0 ? (
            <div className="space-y-3 bg-[#6F42C1]/5 border border-[#6F42C1]/10 p-5 rounded-2xl">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Star className="w-4 h-4 text-[#6F42C1] fill-[#6F42C1]" />
                My Wishlist / RSVPs
              </h3>
              <p className="text-xs text-slate-500 font-semibold mb-3">
                Here are the sessions you have selected to attend. You can manage them here or in the session list below.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rsvpList.map(rsvp => (
                  <div key={rsvp.id} className="flex justify-between items-center p-3.5 rounded-xl border border-purple-100 bg-white shadow-xs hover:shadow-sm transition-all">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">{getTrackMeta(rsvp.trackName).name}</span>
                        <span className="text-[10px] text-slate-450 font-bold flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {rsvp.sessionTime}</span>
                      </div>
                      <p className="text-xs font-extrabold text-slate-800 truncate">{rsvp.sessionName}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRsvp(rsvp)}
                      disabled={rsvpToggling === `${rsvp.trackName}-${rsvp.sessionName}`}
                      className="h-8 border-red-200 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-750 font-extrabold text-[11px] rounded-lg shrink-0 cursor-pointer"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6">
              <Star className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">Your Wishlist is Empty</p>
              <p className="text-xs text-slate-400 mt-1">Select "Wish to Attend" on sessions in the program list below to build your schedule.</p>
            </div>
          )}

          <div className="border-t border-slate-200 pt-6">
            <TracksPage embedded={true} participantName={participant?.name || ""} participantEmail={participant?.email || ""} />
          </div>
        </TabsContent>

        {/* ── QR Codes Tab ── */}
        <TabsContent value="qr" className="mt-5">
          {isQRLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Skeleton className="h-72 rounded-2xl bg-slate-200/50 border border-slate-200" />
              <Skeleton className="h-72 rounded-2xl bg-slate-200/50 border border-slate-200" />
            </div>
          ) : qrcodes ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {/* QR 1 */}
              <Card className="border border-slate-200 bg-white shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-orange-500/25 transition-all duration-300 overflow-hidden text-slate-800">
                <div className="bg-gradient-to-r from-[#F58220] to-[#e07010] px-4 py-3 sm:px-5 sm:py-4 relative overflow-hidden">
                  {/* Decorative glow overlays */}
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-white/10 rounded-full" />
                  <div className="flex items-center gap-2 text-white relative z-10">
                    <QrCode className="w-5 h-5 shrink-0 text-white" />
                    <div>
                      <div className="font-bold text-sm">Registration QR</div>
                      <div className="text-xs text-white/80 font-medium">For attendance, goodies & food</div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4 sm:p-6 flex flex-col items-center gap-4">
                  <div className="bg-white p-2.5 rounded-2xl border-2 border-slate-100 shadow-md transition-transform duration-300 hover:scale-[1.02]">
                    <img src={qrcodes.qr1.dataUrl} alt="Registration QR" className="w-40 h-40 sm:w-48 sm:h-48" />
                  </div>
                  <p className="text-xs text-center text-slate-500 px-1 sm:px-2 font-semibold leading-relaxed">
                    Present at the registration desk to collect your conference badge, goodies bag, and scan for food coupon meals.
                  </p>
                  <Button className="w-full bg-[#F58220] hover:bg-[#e07010] text-white font-bold gap-2 hover:-translate-y-0.5 transition-transform duration-200" asChild>
                    <a href={qrcodes.qr1.dataUrl} download={qrcodes.qr1.downloadName}>
                      <Download className="w-4 h-4" /> Download QR 1
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* QR 2 */}
              <Card className="border border-slate-200 bg-white shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-purple-500/25 transition-all duration-300 overflow-hidden text-slate-800">
                <div className="bg-gradient-to-r from-[#6F42C1] to-[#5a35a0] px-4 py-3 sm:px-5 sm:py-4 relative overflow-hidden">
                  {/* Decorative glow overlays */}
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-white/10 rounded-full" />
                  <div className="flex items-center gap-2 text-white relative z-10">
                    <QrCode className="w-5 h-5 shrink-0 text-white" />
                    <div>
                      <div className="font-bold text-sm">Agenda Portal QR</div>
                      <div className="text-xs text-white/80 font-medium">Personal dashboard & general agenda</div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4 sm:p-6 flex flex-col items-center gap-4">
                  <div className="bg-white p-2.5 rounded-2xl border-2 border-slate-100 shadow-md transition-transform duration-300 hover:scale-[1.02]">
                    <img src={qrcodes.qr2.dataUrl} alt="Agenda QR" className="w-40 h-40 sm:w-48 sm:h-48" />
                  </div>
                  <p className="text-xs text-center text-slate-500 px-1 sm:px-2 font-semibold leading-relaxed">
                    Scan to open general conference brochure PDF or log in to view your personal commitments, upload status, and more.
                  </p>
                  <Button className="w-full bg-[#6F42C1] hover:bg-[#5a35a0] text-white font-bold gap-2 hover:-translate-y-0.5 transition-transform duration-200" asChild>
                    <a href={qrcodes.qr2.dataUrl} download={qrcodes.qr2.downloadName}>
                      <Download className="w-4 h-4" /> Download QR 2
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-white border border-slate-200 text-slate-800">
              <CardContent className="py-12 text-center text-slate-400 text-sm font-semibold">
                Could not load QR codes. Please refresh the page.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Venue Map Tab ── */}
        <TabsContent value="map" className="mt-5 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Interactive map visualization */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border border-slate-200 bg-white shadow-md rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-[#F58220]/10 to-[#6F42C1]/10 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#F58220]" />
                      Interactive Venue Floor Plan
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Explore halls, poster zones, and counter locations at the venue</p>
                  </div>
                  <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-700 text-[10px] font-bold">
                    📍 Sankara Campus
                  </Badge>
                </div>
                
                <CardContent className="p-6">
                  {/* Grid layout of the floor plan */}
                  <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 sm:p-6 overflow-x-auto">
                    <div className="min-w-[600px] grid grid-cols-6 gap-3">
                      
                      {/* Left: Main Auditoriums */}
                      <div className="col-span-2 space-y-3">
                        <div className="bg-[#6F42C1]/10 border-2 border-[#6F42C1]/40 rounded-xl p-4 text-center hover:bg-[#6F42C1]/15 transition-all cursor-default">
                          <div className="font-extrabold text-[#6F42C1] text-xs">MAIN AUDITORIUM</div>
                          <div className="text-[10px] text-slate-500 mt-1 font-bold">Scientific Tracks &amp; Panels</div>
                        </div>
                        <div className="bg-[#6F42C1]/5 border-2 border-[#6F42C1]/20 rounded-xl p-4 text-center hover:bg-[#6F42C1]/10 transition-all cursor-default">
                          <div className="font-bold text-[#6F42C1]/90 text-xs">SANKARA LECTURE HALL</div>
                          <div className="text-[10px] text-slate-500 mt-1 font-semibold">Hall 2 - Keynotes</div>
                        </div>
                      </div>

                      {/* Middle: Poster Zones and Lobby */}
                      <div className="col-span-2 space-y-3">
                        <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-xl p-4 text-center hover:bg-orange-500/15 transition-all cursor-default">
                          <div className="font-extrabold text-[#F58220] text-xs">POSTER HALL 1 (PH1)</div>
                          <div className="text-[10px] text-slate-500 mt-1 font-bold">Digital Poster Zone</div>
                        </div>
                        <div className="bg-orange-500/5 border-2 border-orange-500/20 rounded-xl p-4 text-center hover:bg-orange-500/10 transition-all cursor-default">
                          <div className="font-bold text-[#F58220]/90 text-xs">POSTER HALL 2 (PH2)</div>
                          <div className="text-[10px] text-slate-500 mt-1 font-semibold">Exhibitor Zone</div>
                        </div>
                      </div>

                      {/* Right: Registration & Dinning */}
                      <div className="col-span-2 space-y-3">
                        <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl p-4 text-center hover:bg-emerald-500/15 transition-all cursor-default">
                          <div className="font-extrabold text-emerald-700 text-xs">LUNCH &amp; FOOD COURT</div>
                          <div className="text-[10px] text-emerald-600 mt-1 font-bold">Catering &amp; Stalls</div>
                        </div>
                        <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-4 text-center hover:bg-blue-500/15 transition-all cursor-default">
                          <div className="font-extrabold text-blue-700 text-xs">REGISTRATION LOBBY</div>
                          <div className="text-[10px] text-blue-600 mt-1 font-bold">Badge Pick &amp; Help Desk</div>
                        </div>
                      </div>

                      {/* Bottom Entrance Yard */}
                      <div className="col-span-6 border-t border-dashed border-slate-300 pt-3 text-center">
                        <div className="inline-block bg-slate-200 border border-slate-300 rounded-lg px-4 py-2 text-[10px] font-bold text-slate-650 tracking-wider">
                          🚪 CONFERENCE MAIN GATE &amp; VEHICLE ARRIVAL
                        </div>
                      </div>

                    </div>
                  </div>
                  
                  {/* Detailed Locations Legend */}
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { title: "Main Auditorium", detail: "Inaugural and main scientific lectures." },
                      { title: "Sankara Lecture Hall (Hall 2)", detail: "Concurrent track presentations and sessions." },
                      { title: "Poster Zone (PH1 & PH2)", detail: "Case presentations & poster displays." },
                      { title: "Registration Desk", detail: "Near entrance lobby, collect delegates badge & goodies." },
                      { title: "Dining & Catering Yard", detail: "Located on the east side behind PH2." },
                      { title: "Help Desk / Admin Office", detail: "IT setup next to the Lobby gate." },
                    ].map((loc, i) => (
                      <div key={i} className="p-3 border border-slate-150 rounded-xl bg-slate-50/50 hover:bg-white transition-colors">
                        <div className="text-xs font-extrabold text-slate-800">{loc.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{loc.detail}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* QR usage instructions */}
            <div className="space-y-4">
              <Card className="border border-slate-200 bg-white shadow-md rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-[#6F42C1] to-[#5a35a0] px-5 py-4 text-white">
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5" />
                    How to Use QR Codes
                  </CardTitle>
                </div>
                <CardContent className="p-5 space-y-4 text-xs text-slate-700">
                  <div className="space-y-2">
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-orange-100 flex items-center justify-center text-[#F58220] font-black text-xs">1</div>
                      Registration QR (on Card)
                    </div>
                    <p className="leading-relaxed pl-6 text-slate-500">
                      Printed physically on your badge. Present it to conference coordinators at check-in desks, goodies bags distribution center, and catering gates to scan.
                    </p>
                  </div>

                  <hr className="border-slate-100" />

                  <div className="space-y-2">
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-purple-100 flex items-center justify-center text-[#6F42C1] font-black text-xs">2</div>
                      Agenda Hub QR (On Mobile)
                    </div>
                    <p className="leading-relaxed pl-6 text-slate-500">
                      Scan this QR code with your own smartphone camera to instantly log in and bookmark this portal. From here, you can choose sessions, modify files, and check timetables.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation button */}
              <Card className="border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 shadow-md rounded-2xl p-5 flex flex-col gap-3">
                <div className="text-xs font-bold text-slate-700">Need driving or walking directions?</div>
                <div className="w-full h-[220px] rounded-xl overflow-hidden border border-slate-200 bg-white shadow-inner">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4814.7335353297085!2d77.71300699999999!3d12.9565483!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae123a391ab619%3A0x5fa98b4737bb7ef4!2sSankara%20Eye%20Hospital%20Bangalore!5e1!3m2!1sen!2sin!4v1783234067454!5m2!1sen!2sin"
                    className="w-full h-full border-0"
                    allowFullScreen={true}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    title="Sankara Eye Hospital Bangalore"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Our conference is hosted on campus at Sankara Eye Hospital. Use the interactive map above or navigate using the Google Maps app.
                </p>
                <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 text-xs" asChild>
                  <a href="https://maps.app.goo.gl/K9zQj1qB7LzYpD7G7" target="_blank" rel="noopener noreferrer">
                    Open in Google Maps App 🧭
                  </a>
                </Button>
              </Card>
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
