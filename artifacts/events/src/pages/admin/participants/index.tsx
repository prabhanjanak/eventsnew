import { useState, useRef, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime24h } from "@/lib/date-utils";
import {
  Search,
  Eye,
  FileSpreadsheet,
  Pencil,
  QrCode,
  Trash2,
  Plus,
  Download,
  Check,
  XCircle,
  ShieldCheck,
  Mail,
  Phone,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";
import { ParticipantQRDialog } from "@/components/participant-qr-dialog";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type EditForm = {
  name: string;
  mobile: string;
  email: string;
  institution: string;
  designation?: string;
  isPaid: boolean;
  isSponsored: boolean;
  sponsorType: string;
  utrNumber: string;
};

interface AddForm {
  eventId?: number | string;
  registrationNumber: string;
  name: string;
  mobile: string;
  email: string;
  institution: string;
  designation?: string;
  isPaid: boolean;
  isSponsored: boolean;
  sponsorType: string;
  utrNumber: string;
}

export default function AdminParticipants() {
  const { activeEvent, activeEventId } = useActiveEvent();
  const [activeTab, setActiveTab] = useState<"all" | "prior_attendee" | "prior_faculty" | "on_spot">("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedEventId, setSelectedEventId] = useState<string>(() => (activeEventId ? String(activeEventId) : "all"));

  useEffect(() => {
    if (activeEventId) {
      setSelectedEventId(String(activeEventId));
    }
  }, [activeEventId]);

  const [filterApproval, setFilterApproval] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Edit Dialog States
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    mobile: "",
    email: "",
    institution: "",
    designation: "",
    isPaid: false,
    isSponsored: false,
    sponsorType: "",
    utrNumber: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Add Dialog States
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    eventId: "",
    registrationNumber: "",
    name: "",
    mobile: "",
    email: "",
    institution: "",
    designation: "",
    isPaid: false,
    isSponsored: false,
    sponsorType: "",
    utrNumber: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  // Add Faculty Dialog States
  const [addNonPartOpen, setAddNonPartOpen] = useState(false);
  const [addNonPartForm, setAddNonPartForm] = useState({ name: "", mobile: "", email: "", institution: "", designation: "" });
  const [addNonPartRoles, setAddNonPartRoles] = useState<string[]>([]);
  const [addNonPartSpeakerDetails, setAddNonPartSpeakerDetails] = useState({ track: "Track 1", date: "2026-07-10", sessionName: "", time: "" });
  const [addNonPartSaving, setAddNonPartSaving] = useState(false);

  // Delete Dialog States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // QR Viewer State
  const [qrParticipant, setQrParticipant] = useState<{ id: number; name: string; registrationNumber: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { token, user } = useAuth();

  const isCoordinatorViewOnly = user?.userType === "coordinator_view_only";

  // Fetch events list for dropdown
  const { data: events = [] } = useQuery<any[]>({
    queryKey: ["/api/events/filter-list"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  // Query participants with eventId and approval filters
  const { data, isLoading, refetch } = useQuery<{ participants: any[]; total: number }>({
    queryKey: ["/api/participants", debouncedSearch, page, activeTab, selectedEventId, filterApproval, filterPayment],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("page", String(page));
      params.set("limit", "10000");
      if (activeTab && activeTab !== "all") params.set("type", activeTab);
      if (selectedEventId !== "all") params.set("eventId", selectedEventId);
      if (filterApproval !== "all") params.set("approvalStatus", filterApproval);
      if (filterPayment !== "all") params.set("paymentStatus", filterPayment);

      const res = await fetch(`${BASE_URL}/api/participants?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
    enabled: !!token,
  });

  const handleApprove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${BASE_URL}/api/participants/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to approve");
      toast({ title: "Approved!", description: "Delegate registration approved." });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${BASE_URL}/api/participants/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: "Rejected by event coordinator" }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      toast({ title: "Rejected", description: "Registration marked as rejected." });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  function openEdit(p: any) {
    setEditId(p.id);
    setEditForm({
      name: p.name ?? "",
      mobile: p.mobile ?? "",
      email: p.email ?? "",
      institution: p.institution ?? "",
      designation: p.designation ?? "",
      isPaid: Boolean(p.isPaid),
      isSponsored: Boolean(p.isSponsored),
      sponsorType: p.sponsorType ?? "",
      utrNumber: p.utrNumber ?? "",
    });
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editId) return;
    setEditSaving(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/participants/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editForm.name.trim() || undefined,
          mobile: editForm.mobile.trim() || undefined,
          email: editForm.email.trim() || undefined,
          institution: editForm.institution.trim() || undefined,
          designation: editForm.designation?.trim() || undefined,
          isPaid: editForm.isPaid,
          isSponsored: editForm.isSponsored,
          sponsorType: editForm.sponsorType || undefined,
          utrNumber: editForm.utrNumber || undefined,
        }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error ?? "Update failed");
      }
      toast({ title: "Participant updated ✓" });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      setEditOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddSave() {
    if (!addForm.name.trim() || !addForm.mobile.trim()) {
      toast({ title: "Validation Error", description: "Name and Mobile are required.", variant: "destructive" });
      return;
    }
    const cleanMob = addForm.mobile.replace(/[^0-9]/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMob)) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).",
        variant: "destructive",
      });
      return;
    }
    setAddSaving(true);
    try {
      const targetEventId = addForm.eventId
        ? Number(addForm.eventId)
        : selectedEventId !== "all"
        ? Number(selectedEventId)
        : activeEventId || 1;

      const resp = await fetch(`${BASE_URL}/api/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventId: targetEventId,
          registrationNumber: addForm.registrationNumber.trim() || undefined,
          name: addForm.name.trim(),
          mobile: cleanMob,
          email: addForm.email.trim() || undefined,
          institution: addForm.institution.trim() || undefined,
          designation: addForm.designation?.trim() || undefined,
          isPaid: addForm.isPaid,
          isSponsored: addForm.isSponsored,
          sponsorType: addForm.sponsorType || undefined,
          utrNumber: addForm.utrNumber || undefined,
        }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error ?? "Add failed");
      }
      toast({ title: "Delegate added successfully ✓" });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      setAddOpen(false);
      setAddForm({
        registrationNumber: "",
        name: "",
        mobile: "",
        email: "",
        institution: "",
        designation: "",
        isPaid: false,
        isSponsored: false,
        sponsorType: "",
        utrNumber: "",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddSaving(false);
    }
  }

  async function handleAddNonParticipant(e: React.FormEvent) {
    e.preventDefault();
    if (!addNonPartForm.name || !addNonPartForm.institution) {
      toast({ title: "Validation Error", description: "Name and Institution are required", variant: "destructive" });
      return;
    }
    setAddNonPartSaving(true);
    try {
      const targetEventId = selectedEventId !== "all" ? Number(selectedEventId) : activeEventId || 1;
      const assignments = addNonPartRoles.map((role) => ({
        role,
        track: addNonPartSpeakerDetails.track || "Track 1",
        date: addNonPartSpeakerDetails.date || "2026-07-10",
        sessionName: addNonPartSpeakerDetails.sessionName || "General Session",
        time: addNonPartSpeakerDetails.time || "09:00 - 09:30",
        hall: "Main Auditorium",
      }));

      const resp = await fetch(`${BASE_URL}/api/participants/create-non-participant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventId: targetEventId,
          name: addNonPartForm.name.trim(),
          mobile: addNonPartForm.mobile.trim() || undefined,
          email: addNonPartForm.email.trim() || undefined,
          institution: addNonPartForm.institution.trim(),
          designation: addNonPartForm.designation?.trim() || undefined,
          assignments,
        }),
      });

      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error ?? "Failed to add faculty");
      }

      toast({ title: "Faculty Added ✓", description: "Presenter profile created successfully." });
      setAddNonPartOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddNonPartSaving(false);
    }
  }

  function triggerDelete(id: number, name: string) {
    setDeleteId(id);
    setDeleteName(name);
    setDeleteConfirmOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/participants/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to delete participant");
      toast({ title: "Participant deleted successfully ✓" });
      setSelectedIds((ids) => ids.filter((id) => id !== deleteId));
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      setDeleteConfirmOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkDeleteConfirm() {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/participants/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!resp.ok) throw new Error("Bulk delete failed");
      toast({ title: `${selectedIds.length} delegates removed successfully ✓` });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      setBulkDeleteConfirmOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSelectAll() {
    if (!data?.participants) return;
    const pageIds = data.participants.map((p) => p.id);
    const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedIds((ids) => ids.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((ids) => [...new Set([...ids, ...pageIds])]);
    }
  }

  function toggleSelectRow(id: number) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const handleExportExcel = () => {
    const eventParam = selectedEventId !== "all" ? `?eventId=${selectedEventId}` : (activeEventId ? `?eventId=${activeEventId}` : "");
    window.location.href = `${BASE_URL}/api/participants/export${eventParam}${eventParam ? "&" : "?"}token=${encodeURIComponent(token || "")}`;
  };

  const handleDownloadQRs = () => {
    const eventParam = selectedEventId !== "all" ? `?eventId=${selectedEventId}` : (activeEventId ? `?eventId=${activeEventId}` : "");
    window.location.href = `${BASE_URL}/api/participants/qr-batch${eventParam}${eventParam ? "&" : "?"}token=${encodeURIComponent(token || "")}`;
  };

  const participantsList = data?.participants || [];

  return (
    <div className="space-y-6 text-zinc-100 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Delegates &amp; Attendees Registry
            </h1>
            {activeEvent && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#202028] text-zinc-300 border border-[#2F2F38]">
                {activeEvent.title}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {data
              ? `${data.total} registered delegates for this event`
              : "Loading registration directory…"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isCoordinatorViewOnly && (
            <>
              <Button
                onClick={() => {
                  setAddNonPartForm({ name: "", mobile: "", email: "", institution: "", designation: "" });
                  setAddNonPartRoles(["Speaker"]);
                  setAddNonPartSpeakerDetails({ track: "Track 1", date: "2026-07-10", sessionName: "", time: "09:00 - 09:30" });
                  setAddNonPartOpen(true);
                }}
                className="h-10 px-3.5 gap-1.5 bg-[#18181C] hover:bg-[#25252E] text-zinc-200 hover:text-white text-xs font-bold rounded-2xl border border-[#2B2B34] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Faculty</span>
              </Button>
              <Button
                onClick={() => {
                  setAddForm({
                    registrationNumber: "",
                    name: "",
                    mobile: "",
                    email: "",
                    institution: "",
                    designation: "",
                    isPaid: false,
                    isSponsored: false,
                    sponsorType: "",
                    utrNumber: "",
                  });
                  setAddOpen(true);
                }}
                className="h-10 px-4 gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs rounded-2xl border-none cursor-pointer shadow-lg shadow-white/5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Attendee</span>
              </Button>
            </>
          )}

          <Button
            variant="outline"
            onClick={handleDownloadQRs}
            className="h-10 px-3.5 gap-1.5 bg-[#18181C] border-[#2A2A32] text-zinc-200 hover:text-white rounded-2xl text-xs font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download QRs</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="h-10 px-3.5 gap-1.5 bg-[#18181C] border-[#2A2A32] text-zinc-200 hover:text-white rounded-2xl text-xs font-bold cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* ── TABS (PURE MONOCHROME) ──────────────────────────────────────────── */}
      <div className="flex border border-[#26262B] bg-[#161619] rounded-2xl p-1 gap-1 w-full max-w-2xl shadow-sm">
        <button
          onClick={() => {
            setActiveTab("all");
            setPage(1);
            setSelectedIds([]);
          }}
          className={`flex-1 py-2 px-3 font-bold text-xs rounded-xl transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-white text-zinc-950 shadow-md"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          All Delegates ({data?.total ?? "…"})
        </button>
        <button
          onClick={() => {
            setActiveTab("prior_attendee");
            setPage(1);
            setSelectedIds([]);
          }}
          className={`flex-1 py-2 px-3 font-bold text-xs rounded-xl transition-all cursor-pointer ${
            activeTab === "prior_attendee"
              ? "bg-white text-zinc-950 shadow-md"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          General Attendees
        </button>
        <button
          onClick={() => {
            setActiveTab("prior_faculty");
            setPage(1);
            setSelectedIds([]);
          }}
          className={`flex-1 py-2 px-3 font-bold text-xs rounded-xl transition-all cursor-pointer ${
            activeTab === "prior_faculty"
              ? "bg-white text-zinc-950 shadow-md"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Faculty &amp; Speakers
        </button>
        <button
          onClick={() => {
            setActiveTab("on_spot");
            setPage(1);
            setSelectedIds([]);
          }}
          className={`flex-1 py-2 px-3 font-bold text-xs rounded-xl transition-all cursor-pointer ${
            activeTab === "on_spot"
              ? "bg-white text-zinc-950 shadow-md"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          On-Spot Kiosk
        </button>
      </div>

      {/* ── SEARCH & FILTERS BAR ────────────────────────────────────────────── */}
      <div className="p-4 rounded-3xl bg-[#151518] border border-[#26262B] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search name, ID, email, mobile, hospital, payment ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 bg-[#101013] border-[#2B2B32] text-zinc-200 placeholder:text-zinc-500 rounded-2xl text-xs h-10"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto items-center">
          {/* Event Filter */}
          <Select
            value={selectedEventId}
            onValueChange={(val) => {
              setSelectedEventId(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-44 rounded-2xl bg-[#101013] border-[#2B2B32] text-xs text-zinc-200">
              <SelectValue placeholder="Event" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
              <SelectItem value="all">All Events</SelectItem>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={String(ev.id)}>
                  {ev.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Payment Status Filter */}
          <Select
            value={filterPayment}
            onValueChange={(val) => {
              setFilterPayment(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-36 rounded-2xl bg-[#101013] border-[#2B2B32] text-xs text-zinc-200">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="paid">Paid &amp; Waived</SelectItem>
              <SelectItem value="unpaid">Unpaid Only</SelectItem>
            </SelectContent>
          </Select>

          {/* Approval Filter */}
          <Select
            value={filterApproval}
            onValueChange={(val) => {
              setFilterApproval(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-36 rounded-2xl bg-[#101013] border-[#2B2B32] text-xs text-zinc-200">
              <SelectValue placeholder="Approval" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
              <SelectItem value="all">All Approvals</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending Approval</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-10 px-3 bg-[#101013] border-[#2B2B32] text-zinc-300 hover:text-white rounded-2xl text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>

          {selectedIds.length > 0 && !isCoordinatorViewOnly && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteConfirmOpen(true)}
              className="h-10 px-3 gap-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── TABLE CONTAINER ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="sticky top-0 bg-[#101013]/95 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429] z-10">
              <tr>
                {!isCoordinatorViewOnly && (
                  <th className="w-12 px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-[#35353D] bg-[#1E1E23] text-white focus:ring-zinc-500 h-4 w-4 cursor-pointer"
                      checked={
                        participantsList.length > 0 &&
                        participantsList.every((p) => selectedIds.includes(p.id))
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-5 py-3.5 whitespace-nowrap">ID / Reg No.</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Delegate Name</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Auth &amp; Contact</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Institution / Org</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Category</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Payment</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">Gate Approval</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Registered At</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202026]">
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td colSpan={10} className="p-4">
                      <Skeleton className="h-8 bg-[#1B1B20] rounded-xl w-full" />
                    </td>
                  </tr>
                ))
              ) : participantsList.length > 0 ? (
                participantsList.map((p) => (
                  <tr key={p.id} className="hover:bg-[#1A1A1F]/70 transition-colors">
                    {!isCoordinatorViewOnly && (
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-[#35353D] bg-[#1E1E23] text-white focus:ring-zinc-500 h-4 w-4 cursor-pointer"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelectRow(p.id)}
                        />
                      </td>
                    )}
                    <td className="px-5 py-3.5 font-mono font-bold text-white whitespace-nowrap">
                      {p.registrationNumber}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      {p.designation && (
                        <div className="text-[11px] text-zinc-400 mt-0.5">{p.designation}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <div className="flex items-center gap-1.5 text-zinc-200">
                          <Mail className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="font-mono">{p.email || "No email"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-zinc-500" />
                          <span>{p.mobile ? `+91 ${p.mobile}` : "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-300">
                      <div className="truncate max-w-[200px]">{p.institution || "—"}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#202028] text-zinc-200 border border-[#2E2E38]">
                        {p.delegateType || (p.roles && p.roles.length > 0 ? p.roles.join(", ") : "Attendee")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        {p.isPaid ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 inline-flex items-center gap-1 w-max">
                            <Check className="w-3 h-3" /> Paid {p.paymentAmount ? `(₹${p.paymentAmount})` : ""}
                          </span>
                        ) : p.isSponsored ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#202028] text-zinc-300 border border-[#2E2E38] inline-flex items-center w-max">
                            Sponsored
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/40 inline-flex items-center w-max">
                            Unpaid
                          </span>
                        )}
                        {p.paymentId && (
                          <span className="text-[9px] font-mono text-zinc-500 truncate max-w-28" title={p.paymentId}>
                            {p.paymentId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {p.approvalStatus === "approved" ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                          Approved ✓
                        </span>
                      ) : p.approvalStatus === "rejected" ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/40">
                          Rejected
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => handleApprove(p.id, e)}
                            className="px-2 py-1 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-[10px] font-bold cursor-pointer"
                            title="Approve registration"
                          >
                            Approve
                          </button>
                          <button
                            onClick={(e) => handleReject(p.id, e)}
                            className="px-2 py-1 rounded-lg bg-[#202026] text-rose-400 hover:bg-rose-950/50 text-[10px] font-bold cursor-pointer"
                            title="Reject registration"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {formatDateTime24h(p.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View 3D QR Pass"
                          onClick={() => setQrParticipant({ id: p.id, name: p.name, registrationNumber: p.registrationNumber })}
                          className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-zinc-400 hover:text-white"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </Button>
                        {!isCoordinatorViewOnly && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit Details"
                              onClick={() => openEdit(p)}
                              className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-zinc-400 hover:text-white"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete"
                              onClick={() => triggerDelete(p.id, p.name)}
                              className="h-8 w-8 p-0 rounded-xl hover:bg-rose-950/50 text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        <Link href={`/admin/participants/${p.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View Full Profile"
                            className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-zinc-400 hover:text-white"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-zinc-500">
                    <Users className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    <p className="font-semibold text-sm">
                      {search ? `No delegates found matching "${search}"` : "No registered delegates found for this event."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="p-4 border-t border-[#26262B] bg-[#101013]/90 flex items-center justify-between text-xs text-zinc-400">
            <div>
              Showing <strong className="text-white">{participantsList.length}</strong> of{" "}
              <strong className="text-white">{data.total}</strong> delegates
            </div>
          </div>
        )}
      </div>

      {/* ── QR PASS DIALOG ──────────────────────────────────────────────────── */}
      {qrParticipant && (
        <ParticipantQRDialog
          open={!!qrParticipant}
          onOpenChange={() => setQrParticipant(null)}
          participant={qrParticipant}
        />
      )}

      {/* ── EDIT MODAL ──────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">Edit Delegate Profile</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Update participant contact information and registration status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Full Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Mobile Number *</Label>
                <Input
                  value={editForm.mobile}
                  onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Email Address</Label>
                <Input
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Institution / Hospital</Label>
                <Input
                  value={editForm.institution}
                  onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Designation / Role</Label>
                <Input
                  value={editForm.designation || ""}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#101013] border border-[#2B2B32] mt-2">
              <div>
                <span className="text-xs font-bold text-white block">Payment Completed</span>
                <span className="text-[11px] text-zinc-400">Mark registration fee as paid</span>
              </div>
              <input
                type="checkbox"
                checked={editForm.isPaid}
                onChange={(e) => setEditForm({ ...editForm, isPaid: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-[#242429]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving}
              className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs border-none"
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD ATTENDEE MODAL ──────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">Add New Attendee</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Register a delegate directly to the current event.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleAddSave(); }} autoComplete="off" autoCorrect="off" spellCheck={false} className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Full Name *</Label>
              <Input
                value={addForm.name}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Dr. John Doe"
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-300 font-bold">Mobile (Strict 10-Digits) *</Label>
                  {addForm.mobile && addForm.mobile.length === 10 && (
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ 10 Digits</span>
                  )}
                </div>
                <Input
                  value={addForm.mobile}
                  type="tel"
                  maxLength={10}
                  autoComplete="new-password"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) })}
                  placeholder="9876543210"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Email Address</Label>
                <Input
                  value={addForm.email}
                  type="email"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="john@example.com"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Institution</Label>
                <Input
                  value={addForm.institution}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  onChange={(e) => setAddForm({ ...addForm, institution: e.target.value })}
                  placeholder="Hospital / Org"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Designation</Label>
                <Input
                  value={addForm.designation || ""}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                  placeholder="e.g. Consultant"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#101013] border border-[#2B2B32] mt-2">
              <div>
                <span className="text-xs font-bold text-white block">Mark as Paid</span>
                <span className="text-[11px] text-zinc-400">Payment already collected offline</span>
              </div>
              <input
                type="checkbox"
                checked={addForm.isPaid}
                onChange={(e) => setAddForm({ ...addForm, isPaid: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
          </form>

          <DialogFooter className="gap-2 pt-2 border-t border-[#242429]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSave}
              disabled={addSaving}
              className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs border-none"
            >
              {addSaving ? "Registering..." : "Create Delegate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD FACULTY MODAL ──────────────────────────────────────────────── */}
      <Dialog open={addNonPartOpen} onOpenChange={setAddNonPartOpen}>
        <DialogContent className="max-w-md bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">Add Faculty / Speaker</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Add a guest speaker, moderator, or judge to this event.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddNonParticipant} className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Faculty Name *</Label>
              <Input
                value={addNonPartForm.name}
                onChange={(e) => setAddNonPartForm({ ...addNonPartForm, name: e.target.value })}
                placeholder="Dr. Speaker Name"
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Mobile</Label>
                <Input
                  value={addNonPartForm.mobile}
                  onChange={(e) => setAddNonPartForm({ ...addNonPartForm, mobile: e.target.value })}
                  placeholder="Mobile number"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Email</Label>
                <Input
                  value={addNonPartForm.email}
                  onChange={(e) => setAddNonPartForm({ ...addNonPartForm, email: e.target.value })}
                  placeholder="Email"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Institution / Hospital *</Label>
              <Input
                value={addNonPartForm.institution}
                onChange={(e) => setAddNonPartForm({ ...addNonPartForm, institution: e.target.value })}
                placeholder="Hospital or Medical Institute"
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Primary Role</Label>
              <Select
                value={addNonPartRoles[0] || "Speaker"}
                onValueChange={(val) => setAddNonPartRoles([val])}
              >
                <SelectTrigger className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
                  <SelectItem value="Speaker">Speaker</SelectItem>
                  <SelectItem value="Presenter">Presenter</SelectItem>
                  <SelectItem value="Moderator">Moderator</SelectItem>
                  <SelectItem value="Judge">Judge</SelectItem>
                  <SelectItem value="Chair">Chair / Co-Chair</SelectItem>
                  <SelectItem value="Panelist">Panelist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-[#242429]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddNonPartOpen(false)}
                className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addNonPartSaving}
                className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs border-none"
              >
                {addNonPartSaving ? "Adding..." : "Add Faculty"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRMATION ─────────────────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white">Delete Delegate?</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Are you sure you want to remove <strong className="text-white">{deleteName}</strong> from this event? All check-in history will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs border-none"
            >
              {deleting ? "Deleting..." : "Delete Delegate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BULK DELETE CONFIRMATION ────────────────────────────────────────── */}
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white">Bulk Delete Delegates?</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Are you sure you want to delete <strong className="text-white">{selectedIds.length}</strong> selected delegates?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteConfirmOpen(false)}
              className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDeleteConfirm}
              disabled={bulkDeleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs border-none"
            >
              {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.length} Delegates`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
