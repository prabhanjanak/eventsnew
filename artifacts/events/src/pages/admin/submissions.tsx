import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Download, Search, Filter, CheckSquare, Square, FileArchive,
  CheckCircle2, AlertCircle, Clock, MapPin, Calendar, ChevronDown,
  Loader2, FileText, ImageIcon, Presentation, RefreshCw, Archive,
  SlidersHorizontal, X, ChevronLeft, ChevronRight, Play, Trash2, Upload
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type UploadedFile = {
  id: number;
  filename: string;
  originalName: string;
  fileType: string;
  version: number;
  size: number;
  uploadedAt: string;
};

type Submission = {
  assignmentId: number;
  participantId: number;
  participantName: string;
  registrationNumber: string;
  institution: string;
  role: string;
  track: string | null;
  sessionName: string | null;
  hall: string | null;
  date: string | null;
  time: string | null;
  presentationTitle: string | null;
  uploadedFile: UploadedFile | null;
};

type SubmissionsResponse = {
  total: number;
  totalPresentations: number;
  totalSpeakers: number;
  totalDiscussion: number;
  totalPresenters: number;
  totalPosters: number;
  uploaded: number;
  pending: number;
  filters: { tracks: string[]; sessions: string[]; roles: string[]; dates: string[] };
  submissions: Submission[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const ROLE_COLOR: Record<string, string> = {
  Speaker: "bg-blue-100 text-blue-700 border-blue-200",
  Discussion: "bg-sky-100 text-sky-700 border-sky-200",
  Presenter: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Poster: "bg-cyan-100 text-cyan-700 border-cyan-200",
  Panelist: "bg-violet-100 text-violet-700 border-violet-200",
  Moderator: "bg-purple-100 text-purple-700 border-purple-200",
  Judge: "bg-amber-100 text-amber-700 border-amber-200",
  Chair: "bg-orange-100 text-orange-700 border-orange-200",
  CoChair: "bg-rose-100 text-rose-700 border-rose-200",
};

function needsUpload(role: string) {
  return ["Speaker", "Presenter", "Poster", "Discussion"].includes(role);
}

function FileIcon({ role }: { role: string }) {
  if (role === "Poster") return <ImageIcon className="w-3.5 h-3.5" />;
  return <Presentation className="w-3.5 h-3.5" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminSubmissions() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [filterTrack, setFilterTrack] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterUploaded, setFilterUploaded] = useState<"" | "true" | "false">("");
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Download states
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Viewer Modal State
  const [viewingFile, setViewingFile] = useState<Submission | null>(null);
  const [viewingSlideIndex, setViewingSlideIndex] = useState(0);

  // File Delete states
  const [fileToDelete, setFileToDelete] = useState<Submission | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);

  // Versions state
  const [selectedVersionFile, setSelectedVersionFile] = useState<UploadedFile | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeTabMap, setActiveTabMap] = useState<Record<number, number>>({});

  const handleDownloadApplicantZip = async (pSub: any) => {
    const fileIds = pSub.submissions
      .map((s: any) => s.uploadedFile?.id)
      .filter((id: any): id is number => typeof id === "number");
    if (fileIds.length === 0) {
      toast({ title: "No Files", description: "This applicant has no uploaded submissions to download.", variant: "destructive" });
      return;
    }
    
    try {
      const resp = await fetch("/api/files/download-zip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileIds }),
      });
      if (!resp.ok) throw new Error("Failed to download ZIP");
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pSub.participantName.replace(/\s+/g, "_")}_submissions.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      toast({ title: "Download Failed", description: err.message, variant: "destructive" });
    }
  };

  const setActiveTab = (participantId: number, index: number) => {
    setActiveTabMap((prev) => ({ ...prev, [participantId]: index }));
  };

  const { data: versions, isLoading: loadingVersions, refetch: refetchVersions } = useQuery<UploadedFile[]>({
    queryKey: ["/api/assignments", viewingFile?.assignmentId, "versions"],
    queryFn: async () => {
      if (!viewingFile) return [];
      const res = await fetch(`/api/assignments/${viewingFile.assignmentId}/versions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load file versions");
      return res.json();
    },
    enabled: !!token && !!viewingFile,
  });

  useEffect(() => {
    if (viewingFile) {
      setSelectedVersionFile(viewingFile.uploadedFile);
      setViewingSlideIndex(0);
    } else {
      setSelectedVersionFile(null);
    }
  }, [viewingFile]);

  const handleFileUpload = async (file: File) => {
    if (!viewingFile) return;
    
    const isPoster = viewingFile.role === "Poster";
    const ext = file.name.split(".").pop()?.toLowerCase();
    
    if (isPoster && !["jpg", "jpeg", "png"].includes(ext || "")) {
      toast({ title: "Validation Error", description: "Poster presenters must upload JPG, JPEG or PNG images only", variant: "destructive" });
      return;
    }
    if (!isPoster && !["pptx", "ppt", "pdf"].includes(ext || "")) {
      toast({ title: "Validation Error", description: "Speakers/Presenters must upload PPTX, PPT or PDF files only", variant: "destructive" });
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetch(`/api/assignments/${viewingFile.assignmentId}/file`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload file");
      }

      const result = (await resp.json()) as UploadedFile;
      toast({ title: "File uploaded successfully", description: `Uploaded version V${result.version}` });
      
      setSelectedVersionFile(result);
      queryClient.invalidateQueries({ queryKey: ["/api/submissions/all"] });
      refetchVersions();
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  // Build query string for backend filters
  const params = new URLSearchParams();
  if (filterTrack) params.set("track", filterTrack);
  if (filterSession) params.set("session", filterSession);
  if (filterRole) params.set("role", filterRole);
  if (filterDate) params.set("date", filterDate);
  if (filterUploaded) params.set("uploaded", filterUploaded);

  const { data, isLoading, refetch } = useQuery<SubmissionsResponse>({
    queryKey: ["/api/submissions/all", filterTrack, filterSession, filterRole, filterDate, filterUploaded],
    queryFn: async () => {
      const res = await fetch(`/api/submissions/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load submissions");
      return res.json();
    },
    enabled: !!token,
  });

  // Client-side search on top of server-side filters
  const submissions = useMemo(() => {
    if (!data?.submissions) return [];
    if (!search.trim()) return data.submissions;
    const s = search.toLowerCase();
    return data.submissions.filter(
      (r) =>
        r.participantName.toLowerCase().includes(s) ||
        r.registrationNumber.toLowerCase().includes(s) ||
        r.institution?.toLowerCase().includes(s) ||
        r.presentationTitle?.toLowerCase().includes(s)
    );
  }, [data, search]);

  const groupedSubmissions = useMemo(() => {
    const groups: Record<number, {
      participantId: number;
      participantName: string;
      registrationNumber: string;
      institution: string;
      submissions: Submission[];
    }> = {};
    for (const sub of submissions) {
      if (!groups[sub.participantId]) {
        groups[sub.participantId] = {
          participantId: sub.participantId,
          participantName: sub.participantName,
          registrationNumber: sub.registrationNumber,
          institution: sub.institution,
          submissions: [],
        };
      }
      groups[sub.participantId].submissions.push(sub);
    }
    return Object.values(groups);
  }, [submissions]);

  // Submissions that need/have uploads
  const uploadable = useMemo(() => submissions.filter((s) => needsUpload(s.role)), [submissions]);
  const uploadedSubs = useMemo(() => uploadable.filter((s) => s.uploadedFile), [uploadable]);

  // Selection helpers
  const allUploadedIds = useMemo(
    () => uploadable.filter((s) => s.uploadedFile).map((s) => s.uploadedFile!.id),
    [uploadable]
  );
  const allSelected = allUploadedIds.length > 0 && allUploadedIds.every((id) => selected.has(id));

  const toggleSelect = (fileId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allUploadedIds));
    }
  };

  // ── Download selected as ZIP ──
  const handleDownloadSelected = async () => {
    if (selected.size === 0) {
      toast({ title: "No files selected", description: "Tick at least one uploaded file", variant: "destructive" });
      return;
    }
    setDownloadingZip(true);
    try {
      const res = await fetch("/api/files/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileIds: [...selected] }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vision2020_selected_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `✅ ${selected.size} file(s) downloaded as ZIP` });
    } catch (err: unknown) {
      toast({ title: "Download failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setDownloadingZip(false);
    }
  };

  // ── Download ALL as ZIP ──
  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      const res = await fetch("/api/files/download-all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vision2020_all_submissions_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `✅ Complete submissions ZIP downloaded` });
    } catch (err: unknown) {
      toast({ title: "Download failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    setDeletingFile(true);
    try {
      const res = await fetch(`/api/assignments/${fileToDelete.assignmentId}/file`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete file");
      }
      toast({ title: "File deleted successfully", description: "The uploaded file has been removed." });
      setViewingFile(null); // Close the viewer since the file is gone
      setFileToDelete(null); // Close the confirmation modal
      queryClient.invalidateQueries({ queryKey: ["/api/submissions/all"] });
    } catch (err: any) {
      toast({ title: "Error deleting file", description: err.message, variant: "destructive" });
    } finally {
      setDeletingFile(false);
    }
  };

  const clearFilters = () => {
    setFilterTrack("");
    setFilterSession("");
    setFilterRole("");
    setFilterDate("");
    setFilterUploaded("");
    setSearch("");
  };

  const hasActiveFilters = filterTrack || filterSession || filterRole || filterDate || filterUploaded || search;

  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const fileUrl = selectedVersionFile
    ? `${window.location.origin}/api/files/${selectedVersionFile.id}/view?token=${encodeURIComponent(token || "")}`
    : "";

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Submissions Manager</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isLoading ? "Loading…" : `${data?.uploaded ?? 0} uploaded · ${data?.pending ?? 0} pending`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2 bg-[#18181C] border-[#2A2A32] text-zinc-300 hover:text-white rounded-xl cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSelected}
            disabled={selected.size === 0 || downloadingZip}
            className="gap-2 bg-[#18181C] border-[#2A2A32] text-zinc-300 hover:text-white rounded-xl cursor-pointer"
          >
            {downloadingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileArchive className="w-3.5 h-3.5" />}
            Download Selected ({selected.size})
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-xl border-none cursor-pointer"
          >
            {downloadingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
            Download All ZIP
          </Button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div 
            className="flex flex-col gap-1 p-3 rounded-xl border text-blue-800 bg-blue-50 border-opacity-40 cursor-pointer hover:opacity-80 transition-opacity hover:shadow-sm"
            onClick={() => setFilterRole("Speaker,Presenter")}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-blue-100 text-blue-600">
                <Presentation className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] font-bold uppercase text-blue-600/80">Presentation Submissions</div>
            </div>
            <div className="text-xl font-black leading-none">{data.totalPresentations}</div>
            <div className="text-[9px] font-semibold text-blue-600/70 mt-1 flex gap-2">
              <span>{data.totalSpeakers} Speakers</span>
              {(data.totalDiscussion ?? 0) > 0 && (
                <><span>•</span><span>{data.totalDiscussion} Discussion</span></>
              )}
              <span>•</span>
              <span>{data.totalPresenters} Presenters</span>
            </div>
          </div>

          <div 
            className="flex flex-col gap-1 p-3 rounded-xl border text-purple-800 bg-purple-50 border-opacity-40 cursor-pointer hover:opacity-80 transition-opacity hover:shadow-sm"
            onClick={() => setFilterRole("Poster")}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-100 text-purple-600">
                <ImageIcon className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] font-bold uppercase text-purple-600/80">Poster Submissions</div>
            </div>
            <div className="text-xl font-black leading-none">{data.totalPosters}</div>
            <div className="text-[9px] font-semibold text-purple-600/70 mt-1">
              Total assigned posters
            </div>
          </div>

          {[
            { label: "Uploaded", value: data.uploaded, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50", iconColor: "text-emerald-600 bg-emerald-100" },
            { label: "Pending", value: data.pending, icon: AlertCircle, color: "text-amber-700 bg-amber-50", iconColor: "text-amber-600 bg-amber-100" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div 
                key={s.label} 
                className={`flex flex-col gap-1 p-3 rounded-xl border ${s.color} border-opacity-40 cursor-pointer hover:opacity-80 transition-opacity hover:shadow-sm`}
                onClick={() => {
                  if (s.label === "Uploaded") setFilterUploaded("true");
                  if (s.label === "Pending") setFilterUploaded("false");
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${s.iconColor}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className={`text-[10px] font-bold uppercase opacity-80`}>{s.label}</div>
                </div>
                <div className="text-xl font-black leading-none">{s.value}</div>
                <div className="text-[9px] font-semibold opacity-70 mt-1">
                  {s.label === "Uploaded" ? "Successfully submitted files" : "Awaiting submission"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Toolbar ── */}
      <Card className="border-gray-100 shadow-sm">
        <CardContent className="p-3 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search name, reg no, title…"
                className="pl-8 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className={`gap-2 ${showFilters ? "border-[#6F42C1] text-[#6F42C1]" : ""}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 bg-[#F58220] text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">!</span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-400 gap-1.5">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}

            {/* Select all */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="gap-2 ml-auto"
            >
              {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {allSelected ? "Deselect All" : "Select All Uploaded"}
            </Button>
          </div>

          {/* Filter dropdowns */}
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-gray-100">
              {/* Role */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Role</div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#6F42C1]"
                >
                  <option value="">All Roles</option>
                  {filterRole === "Speaker,Presenter" && <option value="Speaker,Presenter" className="hidden">Presentations (Filtered)</option>}
                  {data?.filters.roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Track */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Track</div>
                <select
                  value={filterTrack}
                  onChange={(e) => setFilterTrack(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#6F42C1]"
                >
                  <option value="">All Tracks</option>
                  {data?.filters.tracks.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Session */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Session</div>
                <select
                  value={filterSession}
                  onChange={(e) => setFilterSession(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#6F42C1]"
                >
                  <option value="">All Sessions</option>
                  {data?.filters.sessions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Upload status */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Upload Status</div>
                <select
                  value={filterUploaded}
                  onChange={(e) => setFilterUploaded(e.target.value as "" | "true" | "false")}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#6F42C1]"
                >
                  <option value="">All</option>
                  <option value="true">Uploaded ✅</option>
                  <option value="false">Pending ⏳</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Submissions Table ── */}
      {/* ── Submissions Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="py-24 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
          {hasActiveFilters ? "No submissions match the current filters." : "No assignments found."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groupedSubmissions.map((pSub) => {
            const activeIndex = activeTabMap[pSub.participantId] ?? 0;
            const subIndex = Math.min(activeIndex, pSub.submissions.length - 1);
            const activeSub = pSub.submissions[subIndex] || pSub.submissions[0];
            if (!activeSub) return null;

            const hasFile = !!activeSub.uploadedFile;
            const canUpload = needsUpload(activeSub.role);
            const isSelected = hasFile && selected.has(activeSub.uploadedFile!.id);
            const roleClass = ROLE_COLOR[activeSub.role] || "bg-gray-100 text-gray-600 border-gray-200";
            const uploadedCount = pSub.submissions.filter(s => s.uploadedFile).length;

            return (
              <Card
                key={pSub.participantId}
                className="overflow-hidden transition-all duration-200 hover:shadow-md border-gray-200 bg-white flex flex-col justify-between"
              >
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-sm truncate">{pSub.participantName}</div>
                        <div className="text-[10px] text-gray-400 font-medium truncate">{pSub.institution}</div>
                        <div className="font-mono text-[9px] text-[#6F42C1] font-semibold mt-0.5">{pSub.registrationNumber}</div>
                      </div>
                      
                      {uploadedCount > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-purple-600 hover:bg-purple-50 shrink-0"
                          onClick={() => handleDownloadApplicantZip(pSub)}
                          title={`Download all ${uploadedCount} submissions as ZIP`}
                        >
                          <FileArchive className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Tabs */}
                    {pSub.submissions.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 border-b border-gray-100 scrollbar-none mt-2">
                        {pSub.submissions.map((s, idx) => (
                          <button
                            key={s.assignmentId}
                            onClick={() => setActiveTab(pSub.participantId, idx)}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all shrink-0 ${
                              idx === subIndex
                                ? "bg-purple-600 text-white border-transparent"
                                : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            {s.role} {s.uploadedFile ? "✅" : "⏳"}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Details */}
                    <div className="mt-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className={`${roleClass} text-[9px] font-extrabold border py-0 px-1.5`}>
                            {activeSub.role}
                          </Badge>
                          {activeSub.track && (
                            <Badge variant="outline" className="text-[9px] bg-gray-50 text-gray-600 border-gray-200 py-0 px-1.5">
                              {activeSub.track}
                            </Badge>
                          )}
                        </div>

                        {canUpload && hasFile ? (
                          <button
                            onClick={() => toggleSelect(activeSub.uploadedFile!.id)}
                            className={`shrink-0 transition-colors ${isSelected ? "text-[#6F42C1]" : "text-gray-300 hover:text-gray-400"}`}
                          >
                            {isSelected ? <CheckSquare className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5" />}
                          </button>
                        ) : null}
                      </div>

                      <div className="bg-gray-50/80 rounded-xl p-2.5 border border-gray-100/50 text-[11px] space-y-1">
                        {activeSub.sessionName && (
                          <div className="font-semibold text-gray-800 line-clamp-1" title={activeSub.sessionName}>
                            {activeSub.sessionName}
                          </div>
                        )}
                        {activeSub.presentationTitle && (
                          <div className="text-gray-500 italic line-clamp-2 text-[10px]" title={activeSub.presentationTitle}>
                            "{activeSub.presentationTitle}"
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-medium pt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" /> {formatDate(activeSub.date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {activeSub.time || "TBA"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-2">
                    {!canUpload ? (
                      <div className="text-[9px] font-bold text-gray-400 italic bg-gray-50 px-2 py-0.5 rounded-md">No Upload Required</div>
                    ) : hasFile ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <div>
                          <div className="text-[9px] font-bold leading-tight">Uploaded V{activeSub.uploadedFile!.version}</div>
                          <div className="text-[8px] text-emerald-600/70 font-semibold">{formatSize(activeSub.uploadedFile!.size)} • {activeSub.uploadedFile!.fileType.toUpperCase()}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[9px] font-bold">Pending Upload</span>
                      </div>
                    )}

                    {hasFile && (
                      <div className="flex items-center gap-1 shrink-0 ml-auto bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-[#F58220] hover:bg-white hover:shadow-sm transition-all hover:text-[#e07010]"
                          onClick={() => { setViewingFile(activeSub); setViewingSlideIndex(0); }}
                          title="View Document"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </Button>
                        <div className="w-px h-4 bg-gray-200" />
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-white hover:shadow-sm transition-all hover:text-gray-900"
                          asChild
                          title="Download Document"
                        >
                          <a href={`/api/files/${activeSub.uploadedFile!.id}/download?token=${encodeURIComponent(token || "")}`} download target="_blank" rel="noreferrer">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer summary */}
      {!isLoading && submissions.length > 0 && (
        <div className="px-4 py-3 rounded-2xl border border-gray-200 flex items-center justify-between text-xs text-gray-500 font-medium bg-white shadow-sm">
          <span>
            Showing {submissions.length} of {data?.total ?? 0} assignments
            {hasActiveFilters && " (filtered)"}
          </span>
          {selected.size > 0 && (
            <span className="font-bold text-[#6F42C1] bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100">{selected.size} file(s) selected</span>
          )}
        </div>
      )}

      {/* ZIP Structure hint */}
      <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-xs text-gray-500">
        <div className="font-bold text-gray-700 mb-1.5 flex items-center gap-2">
          <FileArchive className="w-3.5 h-3.5 text-[#6F42C1]" /> ZIP Folder Structure
        </div>
        <code className="text-[10px] text-gray-500 leading-relaxed block">
          vision2020_all_submissions.zip<br />
          &nbsp; └─ Day-1/<br />
          &nbsp;&nbsp;&nbsp;&nbsp; └─ Track-1/<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; └─ Digital-Platforms-for-eye-care/<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; └─ 9-00-9-08/<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; └─ Day-1_Track-1_Session_9-00-9-08_Speaker_V2020-00001_V1.pptx
        </code>
      </div>

      {/* ── Document Viewer Modal ── */}
      <Dialog open={!!viewingFile} onOpenChange={(open) => !open && setViewingFile(null)}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden bg-gray-950 border-gray-800 text-white rounded-3xl">
          <DialogHeader className="p-4 border-b border-gray-800 shrink-0 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <FileIcon role={viewingFile?.role || ""} />
                {selectedVersionFile?.originalName || viewingFile?.uploadedFile?.originalName || "Slide/Poster"}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-400 mt-0.5">
                Submitted by {viewingFile?.participantName} ({viewingFile?.registrationNumber})
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Left side: Preview Canvas */}
            <div className="flex-1 bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden group">
              {selectedVersionFile && (
                <>
                  {selectedVersionFile.fileType === "pdf" ? (
                    <iframe
                      src={`/api/files/${selectedVersionFile.id}/view?token=${encodeURIComponent(token || "")}`}
                      className="w-full h-full border-0 rounded-lg bg-white shadow-lg"
                      title="PDF Document Viewer"
                    />
                  ) : ["jpg", "jpeg", "png"].includes(selectedVersionFile.fileType.toLowerCase()) ? (
                    <div className="flex flex-col items-center justify-center h-full w-full gap-4">
                      <div className="flex-1 min-h-0 flex items-center justify-center">
                        <img
                          src={`/api/files/${selectedVersionFile.id}/view?token=${encodeURIComponent(token || "")}`}
                          alt="Poster Canvas View"
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
                        />
                      </div>
                      <div className="w-full max-w-2xl bg-black/60 border border-gray-800 rounded-xl p-4 text-center shrink-0 backdrop-blur-sm">
                        <h3 className="text-sm font-black text-white leading-snug">
                          {viewingFile?.presentationTitle || "Untitled Poster"}
                        </h3>
                        <p className="text-xs text-orange-400 font-extrabold mt-1.5 uppercase tracking-wide">
                          Presenter: {viewingFile?.participantName}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {viewingFile?.institution} · Registration No: {viewingFile?.registrationNumber}
                        </p>
                      </div>
                    </div>
                  ) : ["ppt", "pptx"].includes(selectedVersionFile.fileType.toLowerCase()) && !isLocalhost ? (
                    <iframe
                      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
                      className="w-full h-full border-0 rounded-lg bg-white shadow-lg"
                      title="PPTX Document Viewer"
                    />
                  ) : (
                    /* Mock slide preview player for PPTX */
                    <div className="w-full max-w-2xl aspect-[16/9] bg-[#0c1329] border border-gray-800 rounded-xl flex flex-col justify-between p-8 shadow-2xl relative overflow-hidden select-none">
                      {/* Gradient accents */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#F58220]/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#6F42C1]/10 rounded-full blur-2xl pointer-events-none" />
 
                      <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                        <span>Vision 2020 Bengaluru Conference</span>
                        <span>Slide {viewingSlideIndex + 1} of 3</span>
                      </div>
 
                      {/* Slide Content rendering */}
                      {viewingSlideIndex === 0 && (
                        <div className="my-auto text-center space-y-4 px-4">
                          <h1 className="text-xl md:text-2xl font-black leading-tight text-white line-clamp-2">
                            {viewingFile?.presentationTitle || "No Presentation Title Specified"}
                          </h1>
                          <div className="h-0.5 w-16 bg-[#F58220] mx-auto rounded-full" />
                          <div className="text-xs text-orange-400 font-bold uppercase tracking-wider">
                            Presenter: {viewingFile?.participantName}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {viewingFile?.institution} · Reg: {viewingFile?.registrationNumber}
                          </div>
                        </div>
                      )}
 
                      {viewingSlideIndex === 1 && (
                        <div className="my-auto space-y-4 px-6">
                          <div className="text-[10px] text-[#6F42C1] font-bold uppercase tracking-wide">
                            Speaking Schedule Details
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-bold text-gray-200">
                              Session: {viewingFile?.sessionName || "General Schedule"}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                              <div>📅 Date: {viewingFile ? formatDate(viewingFile.date) : ""}</div>
                              <div>🕒 Time: {viewingFile?.time || "Pending"}</div>
                              <div>📍 Track: {viewingFile?.track || "General"}</div>
                              <div>🏛️ Hall: {viewingFile?.hall || "Main Hall"}</div>
                            </div>
                          </div>
                        </div>
                      )}
 
                      {viewingSlideIndex === 2 && (
                        <div className="my-auto space-y-3 px-6">
                          <div className="text-[10px] text-[#F58220] font-bold uppercase tracking-wide">
                            Drizzle Database Mapping
                          </div>
                          <div className="space-y-1 font-mono text-[10px] text-gray-300 bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                            <div>File ID: {selectedVersionFile.id}</div>
                            <div className="truncate">Storage Name: {selectedVersionFile.filename}</div>
                            <div>Version Checked: V{selectedVersionFile.version}</div>
                            <div>Size Logged: {formatSize(selectedVersionFile.size)}</div>
                            <div>Upload Date: {new Date(selectedVersionFile.uploadedAt).toLocaleString()}</div>
                          </div>
                        </div>
                      )}
 
                      {/* Slide control buttons */}
                      <div className="flex items-center justify-between border-t border-gray-900/50 pt-4 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={viewingSlideIndex === 0}
                          onClick={() => setViewingSlideIndex((prev) => Math.max(0, prev - 1))}
                          className="h-8 text-xs font-semibold text-gray-400 hover:text-white"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                        </Button>
                        <span className="text-[10px] font-bold text-gray-500">
                          {viewingSlideIndex === 0 ? "Title Slide" : viewingSlideIndex === 1 ? "Schedule Details" : "Database Records"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={viewingSlideIndex === 2}
                          onClick={() => setViewingSlideIndex((prev) => Math.min(2, prev + 1))}
                          className="h-8 text-xs font-semibold text-gray-400 hover:text-white"
                        >
                          Next <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
 
            {/* Right side: Metadata Side Panel */}
            <div className="w-80 border-l border-gray-800 bg-gray-900/40 p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Presenter Profile</h3>
                  <div className="mt-2.5 space-y-1">
                    <div className="font-bold text-sm text-white">{viewingFile?.participantName}</div>
                    <div className="text-xs font-mono text-[#F58220]">{viewingFile?.registrationNumber}</div>
                    <div className="text-xs text-gray-400">{viewingFile?.institution}</div>
                  </div>
                </div>
 
                <hr className="border-gray-800" />
 
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assignment Details</h3>
                  <div className="mt-2.5 space-y-2 text-xs">
                    <div>
                      <span className="text-gray-400">Role: </span>
                      <Badge variant="outline" className={`${viewingFile ? ROLE_COLOR[viewingFile.role] : ""} font-bold border py-0 text-[10px] ml-1`}>
                        {viewingFile?.role}
                      </Badge>
                    </div>
                    {viewingFile?.track && (
                      <div><span className="text-gray-400">Track: </span><span className="text-gray-200 font-semibold">{viewingFile.track}</span></div>
                    )}
                    {viewingFile?.sessionName && (
                      <div><span className="text-gray-400">Session: </span><span className="text-gray-200 font-semibold">{viewingFile.sessionName}</span></div>
                    )}
                    {viewingFile?.hall && (
                      <div><span className="text-gray-400">Hall Location: </span><span className="text-gray-200 font-semibold">{viewingFile.hall}</span></div>
                    )}
                    {viewingFile?.presentationTitle && (
                      <div className="mt-1.5 p-2 bg-gray-800/40 border border-gray-800 rounded-lg text-gray-300 italic">
                        "{viewingFile.presentationTitle}"
                      </div>
                    )}
                  </div>
                </div>
 
                <hr className="border-gray-800" />
 
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">File Metadata</h3>
                  {selectedVersionFile && (
                    <div className="mt-2.5 space-y-1.5 text-xs text-gray-400">
                      <div><span className="text-gray-500">File Type: </span><span className="text-gray-200 font-mono font-bold uppercase">{selectedVersionFile.fileType}</span></div>
                      <div><span className="text-gray-500">Size: </span><span className="text-gray-200 font-semibold">{formatSize(selectedVersionFile.size)}</span></div>
                      <div><span className="text-gray-500">Version: </span><span className="text-gray-200 font-bold">V{selectedVersionFile.version}</span></div>
                      <div><span className="text-gray-500">Uploaded At: </span><span className="text-gray-200">{new Date(selectedVersionFile.uploadedAt).toLocaleString("en-IN")}</span></div>
                    </div>
                  )}
                </div>

                <hr className="border-gray-800" />

                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Version History</h3>
                  {loadingVersions ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading versions...
                    </div>
                  ) : versions && versions.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {versions.map((ver) => {
                        const isCurrent = selectedVersionFile?.id === ver.id;
                        return (
                          <div
                            key={ver.id}
                            onClick={() => setSelectedVersionFile(ver)}
                            className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex flex-col justify-between gap-1 ${
                              isCurrent
                                ? "bg-[#F58220]/10 border-[#F58220] text-white"
                                : "bg-gray-950/40 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span>Version V{ver.version}</span>
                              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${isCurrent ? "border-orange-500/30 text-orange-400" : "border-gray-800 text-gray-500"}`}>
                                {ver.fileType.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-500">
                              <span>{formatSize(ver.size)}</span>
                              <span>{new Date(ver.uploadedAt).toLocaleDateString("en-IN")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">No versions found</div>
                  )}
                </div>

                {/* Drag & Drop Upload Zone */}
                {viewingFile && (user?.userType === "super_admin" || user?.permissions?.includes("edit_submissions")) && (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="mt-4 p-4 border border-dashed border-gray-700 hover:border-[#F58220] rounded-xl bg-gray-950/40 text-center cursor-pointer transition-colors relative"
                  >
                    <input
                      type="file"
                      id="modal-file-upload"
                      className="hidden"
                      accept={viewingFile.role === "Poster" ? ".jpg,.jpeg" : ".pptx"}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <label htmlFor="modal-file-upload" className="cursor-pointer space-y-1 block w-full h-full">
                      {uploadingFile ? (
                        <div className="flex flex-col items-center justify-center py-2">
                          <Loader2 className="w-5 h-5 animate-spin text-[#F58220]" />
                          <span className="text-xs font-semibold text-gray-400 mt-2">Uploading modified file...</span>
                        </div>
                      ) : (
                        <div className="py-2">
                          <Upload className="w-5 h-5 mx-auto text-gray-500 mb-1" />
                          <span className="text-xs font-bold text-gray-300 block">Replace Slide / Upload modified PPT</span>
                          <span className="text-[10px] text-gray-500 block">
                            Drag &amp; drop or click to choose ({viewingFile.role === "Poster" ? "JPG/JPEG max 20MB" : "PPTX max 15MB"})
                          </span>
                        </div>
                      )}
                    </label>
                  </div>
                )}
              </div>
 
              <div className="pt-4 border-t border-gray-800 space-y-2 mt-4 shrink-0">
                {selectedVersionFile && (
                  <>
                    {selectedVersionFile.fileType === "pptx" && (
                      <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-400 leading-normal mb-1.5">
                        💡 <strong>Offline Note:</strong> Local localhost PPTX files must be downloaded to open in PowerPoint since Microsoft Office embed APIs require a public hosting domain.
                      </div>
                    )}
                    <a
                      href={`/api/files/${selectedVersionFile.id}/download?token=${encodeURIComponent(token || "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-[#F58220] hover:bg-[#e07010] text-white shadow transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download File
                    </a>
                    {user?.userType !== "pr_member" && user?.userType !== "coordinator_view_only" && (
                    <Button
                      variant="destructive"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white shadow transition-colors"
                      onClick={() => setFileToDelete(viewingFile)}
                    >
                      <Trash2 className="w-4 h-4" /> Delete File
                    </Button>
                    )}
                  </>
                )}

                <Button
                  variant="outline"
                  onClick={() => setViewingFile(null)}
                  className="w-full border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-white"
                >
                  Close Viewer
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── File Delete Confirmation Dialog ── */}
      <Dialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <DialogContent className="max-w-md bg-gray-900 border-gray-800 text-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete Uploaded File?
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-xs">
              Are you sure you want to permanently delete the uploaded file <strong>{fileToDelete?.uploadedFile?.originalName}</strong> for <strong>{fileToDelete?.participantName}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFileToDelete(null)}
              disabled={deletingFile}
              className="border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFile}
              disabled={deletingFile}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingFile ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Deleting...
                </>
              ) : (
                "Yes, Delete File"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
