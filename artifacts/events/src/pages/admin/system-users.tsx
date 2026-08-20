import { useState, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useListSystemUsers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  ShieldAlert,
  CheckSquare,
  Gift,
  Utensils,
  QrCode,
  Download,
  Search,
  Users,
  Shield,
  Layers,
  Sparkles,
  Check,
  Building2,
  Calendar,
  Filter,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  super_admin: "Super Admin",
  track_coordinator: "Track Coordinator",
  food_coordinator: "Food Coordinator",
  scientific_committee: "Scientific Committee",
  pr_member: "AV / Preview Room",
  coordinator_view_only: "Coordinator (View Only)",
};

const TRACKS = [
  "Track 1",
  "Track 2",
  "Track 3",
  "Track 4",
  "Track 5 Hall A",
  "Track 5 Hall B",
  "Grand Auditorium",
  "Main Lobby",
  "Dining Pavilion",
];

type SystemUser = {
  id: number;
  empId: string;
  name: string;
  email: string | null;
  mobile: string | null;
  userType: string;
  assignedTrack: string | null;
  assignedEventIds?: number[];
  mustChangePassword: boolean;
  permissions: string[];
  createdAt: string;
};

type FormData = {
  empId: string;
  name: string;
  email: string;
  mobile: string;
  userType: string;
  assignedTrack: string;
  assignedEventIds: number[];
  password: string;
  permissions: string[];
};

const EMPTY_FORM: FormData = {
  empId: "",
  name: "",
  email: "",
  mobile: "",
  userType: "track_coordinator",
  assignedTrack: "",
  assignedEventIds: [],
  password: "Welcome@123",
  permissions: ["attendance"],
};

function togglePermission(current: string[], perm: string): string[] {
  return current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm];
}

function toggleEventId(current: number[], eventId: number): number[] {
  return current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId];
}

export default function SystemUsers() {
  const { token, user: currentUser } = useAuth();
  const { events = [] } = useActiveEvent();
  const { data: users = [], isLoading, refetch } = useListSystemUsers();
  const isCoordinatorViewOnly = currentUser?.userType === "coordinator_view_only";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);
  const [resetTarget, setResetTarget] = useState<SystemUser | null>(null);

  const [qrUser, setQrUser] = useState<SystemUser | null>(null);
  const [staffQrData, setStaffQrData] = useState<string | null>(null);
  const [staffQrLoading, setStaffQrLoading] = useState(false);

  function handleViewQr(user: SystemUser) {
    setQrUser(user);
    setStaffQrLoading(true);
    setStaffQrData(null);
    fetch(`${BASE_URL}/api/system-users/${user.id}/qr`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setStaffQrData(data.qr1.dataUrl);
      })
      .catch(() => {
        toast({ title: "Failed to load QR", variant: "destructive" });
      })
      .finally(() => setStaffQrLoading(false));
  }

  function openCreate() {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(user: SystemUser) {
    setEditUser(user);
    setForm({
      empId: user.empId,
      name: user.name,
      email: user.email || "",
      mobile: user.mobile || "",
      userType: user.userType,
      assignedTrack: user.assignedTrack || "",
      assignedEventIds: user.assignedEventIds || [],
      password: "",
      permissions: user.permissions ?? [],
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.empId || !form.name) {
      toast({ title: "Validation Error", description: "EMP ID and Name are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editUser) {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          mobile: form.mobile.trim() || undefined,
          userType: form.userType,
          assignedTrack: form.assignedTrack.trim() || undefined,
          assignedEventIds: form.userType === "super_admin" ? [] : form.assignedEventIds,
          permissions: (form.userType === "admin" || form.userType === "super_admin")
            ? ["attendance", "goodies", "food"]
            : form.permissions,
        };
        if (form.password) payload.password = form.password;

        const resp = await fetch(`${BASE_URL}/api/system-users/${editUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Failed to update user");
        }
        toast({ title: "User updated successfully" });
      } else {
        const payload: Record<string, unknown> = {
          empId: form.empId.trim(),
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          mobile: form.mobile.trim() || undefined,
          userType: form.userType,
          assignedTrack: form.assignedTrack.trim() || undefined,
          assignedEventIds: form.userType === "super_admin" ? [] : form.assignedEventIds,
          password: form.password || "Welcome@123",
          permissions: (form.userType === "admin" || form.userType === "super_admin")
            ? ["attendance", "goodies", "food"]
            : form.permissions,
        };
        const resp = await fetch(`${BASE_URL}/api/system-users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Failed to create user");
        }
        toast({ title: "Staff user created successfully" });
      }
      setModalOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/system-users"] });
    } catch (err: any) {
      toast({ title: "Save Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const resp = await fetch(`${BASE_URL}/api/system-users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Delete failed");
      toast({ title: "User deleted successfully" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/system-users"] });
    } catch {
      toast({ title: "Error deleting user", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    try {
      const resp = await fetch(`${BASE_URL}/api/system-users/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Reset failed");
      toast({
        title: "Password reset",
        description: `${resetTarget.name}'s password reset to Welcome@123. They must change it on next login.`,
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/system-users"] });
    } catch {
      toast({ title: "Error resetting password", variant: "destructive" });
    } finally {
      setResetTarget(null);
    }
  }

  // Filter users
  const filteredUsers = useMemo(() => {
    const raw = (users as unknown as SystemUser[]) || [];
    return raw.filter((u) => {
      const matchSearch =
        !search.trim() ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.empId.toLowerCase().includes(search.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
        (u.mobile && u.mobile.includes(search));

      const matchRole = roleFilter === "all" || u.userType === roleFilter;

      const matchEvent =
        eventFilter === "all" ||
        u.userType === "super_admin" ||
        u.userType === "admin" ||
        (u.assignedEventIds && u.assignedEventIds.includes(Number(eventFilter)));

      return matchSearch && matchRole && matchEvent;
    });
  }, [users, search, roleFilter, eventFilter]);

  // Telemetry counts
  const rawList = (users as unknown as SystemUser[]) || [];
  const totalStaff = rawList.length;
  const adminCount = rawList.filter((u) => u.userType === "admin" || u.userType === "super_admin").length;
  const coordinatorCount = rawList.filter((u) => u.userType.includes("coordinator")).length;
  const resetRequiredCount = rawList.filter((u) => u.mustChangePassword).length;

  return (
    <div className="space-y-6 text-zinc-100 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER TELEMETRY COMMAND BAR ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#242428]/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#1E1E24] border border-[#2B2B34] flex items-center justify-center text-amber-400 shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Staff &amp; Coordinators Access
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage role access, multi-event assignments, and QR scan permissions
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            className="h-10 px-4 gap-2 bg-[#18181C] border-[#2A2A32] text-zinc-300 hover:text-white hover:bg-[#222228] text-xs font-bold rounded-2xl cursor-pointer"
            onClick={() => {
              window.location.href = `${BASE_URL}/api/system-users/qr-batch?token=${encodeURIComponent(token || "")}`;
            }}
          >
            <Download className="w-4 h-4 text-zinc-400" />
            <span>Download All QRs</span>
          </Button>

          {!isCoordinatorViewOnly && (
            <Button
              onClick={openCreate}
              className="h-10 px-4 gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs rounded-2xl border-none cursor-pointer shadow-lg shadow-white/5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff User</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── QUICK METRIC PILLS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#151518] border border-[#26262B] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total Staff</span>
            <span className="text-2xl font-black text-white mt-0.5 block">{totalStaff}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#1E1E24] flex items-center justify-center text-zinc-300">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#151518] border border-[#26262B] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Admins</span>
            <span className="text-2xl font-black text-amber-300 mt-0.5 block">{adminCount}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-950/50 border border-amber-800/40 flex items-center justify-center text-amber-400">
            <Shield className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#151518] border border-[#26262B] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Coordinators</span>
            <span className="text-2xl font-black text-indigo-300 mt-0.5 block">{coordinatorCount}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-950/50 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
            <QrCode className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#151518] border border-[#26262B] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Reset Required</span>
            <span className="text-2xl font-black text-orange-400 mt-0.5 block">{resetRequiredCount}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-orange-950/50 border border-orange-800/40 flex items-center justify-center text-orange-400">
            <KeyRound className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── FILTERS & SEARCH BAR ─────────────────────────────────────────────── */}
      <div className="p-4 rounded-3xl bg-[#151518] border border-[#26262B] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search by name, EMP ID, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#101013] border-[#2B2B32] text-zinc-200 placeholder:text-zinc-500 rounded-2xl text-xs h-10 focus-visible:ring-1 focus-visible:ring-zinc-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-10 w-full sm:w-44 rounded-2xl bg-[#101013] border-[#2B2B32] text-xs text-zinc-200">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="track_coordinator">Track Coordinator</SelectItem>
              <SelectItem value="food_coordinator">Food Coordinator</SelectItem>
              <SelectItem value="scientific_committee">Scientific Committee</SelectItem>
              <SelectItem value="coordinator_view_only">View Only</SelectItem>
            </SelectContent>
          </Select>

          {/* Event Filter */}
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="h-10 w-full sm:w-48 rounded-2xl bg-[#101013] border-[#2B2B32] text-xs text-zinc-200">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200 max-h-56">
              <SelectItem value="all">All Hosted Events</SelectItem>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={String(ev.id)}>
                  {ev.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── STAFF OBSIDIAN TABLE ────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#101013]/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429]">
              <tr>
                <th className="px-5 py-3.5">Staff User</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Assigned Events</th>
                <th className="px-4 py-3.5">Track / Location</th>
                <th className="px-4 py-3.5">Scan Permissions</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202026]">
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td colSpan={8} className="p-4">
                      <Skeleton className="h-8 bg-[#1B1B20] rounded-xl w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const initials = user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  const isSuper = user.userType === "super_admin";
                  const isAdmin = user.userType === "admin";

                  return (
                    <tr key={user.id} className="hover:bg-[#1A1A1F]/70 transition-colors group">
                      {/* Name & EMP ID */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#202028] border border-[#30303C] flex items-center justify-center font-black text-xs text-zinc-200 shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="font-bold text-white block text-sm leading-tight">{user.name}</span>
                            <span className="font-mono text-[10px] text-zinc-400 font-semibold">{user.empId}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-4 space-y-0.5">
                        <div className="text-zinc-300 text-xs truncate max-w-44">{user.email || "—"}</div>
                        <div className="text-zinc-500 text-[11px] font-mono">{user.mobile || "—"}</div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-4 py-4">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full inline-block border ${
                            isSuper
                              ? "bg-rose-950/70 text-rose-300 border-rose-800/50"
                              : isAdmin
                              ? "bg-amber-950/70 text-amber-300 border-amber-800/50"
                              : user.userType === "track_coordinator"
                              ? "bg-indigo-950/70 text-indigo-300 border-indigo-800/50"
                              : user.userType === "food_coordinator"
                              ? "bg-orange-950/70 text-orange-300 border-orange-800/50"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700"
                          }`}
                        >
                          {ROLE_LABELS[user.userType] ?? user.userType.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Assigned Events */}
                      <td className="px-4 py-4">
                        {isSuper || isAdmin ? (
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> All Hosted Events
                          </span>
                        ) : user.assignedEventIds && user.assignedEventIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-48">
                            {user.assignedEventIds.map((id) => {
                              const ev = events.find((e) => e.id === id);
                              return (
                                <span
                                  key={id}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#202026] text-zinc-300 border border-[#2B2B34] truncate max-w-36"
                                  title={ev?.title || `Event #${id}`}
                                >
                                  {ev?.title || `Event #${id}`}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-500 italic">No event assigned</span>
                        )}
                      </td>

                      {/* Track / Hall */}
                      <td className="px-4 py-4 text-zinc-400 text-xs">
                        {user.assignedTrack || <span className="text-zinc-600">—</span>}
                      </td>

                      {/* Scan Permissions */}
                      <td className="px-4 py-4">
                        {isSuper || isAdmin ? (
                          <span className="text-[11px] font-bold text-amber-300">All Operations</span>
                        ) : (user.permissions ?? []).length === 0 ? (
                          <span className="text-[11px] text-zinc-600 italic">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(user.permissions ?? []).includes("attendance") && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                                <CheckSquare className="w-2.5 h-2.5" /> Attendance
                              </span>
                            )}
                            {(user.permissions ?? []).includes("food") && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-orange-950/70 text-orange-300 border border-orange-800/40 flex items-center gap-1">
                                <Utensils className="w-2.5 h-2.5" /> Food
                              </span>
                            )}
                            {(user.permissions ?? []).includes("goodies") && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-950/70 text-purple-300 border border-purple-800/40 flex items-center gap-1">
                                <Gift className="w-2.5 h-2.5" /> Goodies
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        {user.mustChangePassword ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-400 border border-amber-800/40 flex items-center gap-1 w-fit">
                            <ShieldAlert className="w-3 h-3" /> Reset Req.
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1 w-fit">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* QR Pass */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View Staff QR Pass"
                            onClick={() => handleViewQr(user)}
                            className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-zinc-400 hover:text-white"
                          >
                            <QrCode className="w-4 h-4 text-indigo-400" />
                          </Button>

                          {!isCoordinatorViewOnly && (user.userType !== "super_admin" || currentUser?.userType === "super_admin") && (
                            <>
                              {/* Edit */}
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Edit Staff"
                                onClick={() => openEdit(user)}
                                className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-zinc-400 hover:text-white"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>

                              {/* Reset Password */}
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Reset Password"
                                onClick={() => setResetTarget(user)}
                                className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-amber-400 hover:text-amber-300"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </Button>

                              {/* Delete */}
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Delete Staff"
                                onClick={() => setDeleteTarget(user)}
                                className="h-8 w-8 p-0 rounded-xl hover:bg-rose-950/50 text-rose-400 hover:text-rose-300"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <Users className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    <p className="font-semibold text-sm">No staff records match your criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD / EDIT STAFF MODAL (LU.MA OBSIDIAN DARK) ────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white tracking-tight">
              {editUser ? "Edit Staff User Access" : "Create New Staff Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Configure credentials, event scoping, track assignments, and scanning privileges.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* EMP ID & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">EMP ID / Username *</Label>
                <Input
                  value={form.empId}
                  disabled={!!editUser}
                  onChange={(e) => setForm({ ...form, empId: e.target.value })}
                  placeholder="e.g. EMP1024 or staff_qr"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Full Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Staff member name"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            {/* Email & Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Email Address</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="staff@sankaraeye.in"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Mobile Number</Label>
                <Input
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  placeholder="10-digit mobile"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            {/* Role & Track */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">System Role</Label>
                <Select value={form.userType} onValueChange={(val) => setForm({ ...form, userType: val })}>
                  <SelectTrigger className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
                    <SelectItem value="admin">⚡ Admin (Specific Event Full Access)</SelectItem>
                    <SelectItem value="track_coordinator">📍 Track / Attendance Coordinator</SelectItem>
                    <SelectItem value="food_coordinator">🍽️ Food Coordinator</SelectItem>
                    <SelectItem value="scientific_committee">🔬 Scientific Committee</SelectItem>
                    <SelectItem value="pr_member">🖥️ AV / Preview Room</SelectItem>
                    <SelectItem value="coordinator_view_only">👁️ Coordinator (View Only)</SelectItem>
                    {currentUser?.userType === "super_admin" && (
                      <SelectItem value="super_admin">🌐 Super Admin (All Events All Access)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Assigned Track / Hall</Label>
                <Select
                  value={form.assignedTrack || "none"}
                  onValueChange={(val) => setForm({ ...form, assignedTrack: val === "none" ? "" : val })}
                >
                  <SelectTrigger className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs">
                    <SelectValue placeholder="Select hall/track" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200 max-h-48">
                    <SelectItem value="none">None / General (All Halls)</SelectItem>
                    {TRACKS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Role Scope Guidance Note */}
            {form.userType === "super_admin" && (
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/50 text-xs text-purple-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span><strong>Super Admin:</strong> Unrestricted global authority across all hosted events, system settings, staff management, and audit logs.</span>
              </div>
            )}

            {form.userType === "admin" && (
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/50 text-xs text-amber-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <span><strong>Event Admin:</strong> Full operational and scanning control for the specific hosted event(s) selected below.</span>
              </div>
            )}

            {/* Assigned Hosted Events Multi-Select (For Admin and Coordinators) */}
            {form.userType !== "super_admin" && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#101013] border border-[#2B2B32]">
                <Label className="text-zinc-300 font-bold block">
                  {form.userType === "admin" ? "Specific Event Assignment *" : "Assigned Hosted Events"}
                </Label>
                <p className="text-[11px] text-zinc-400">
                  {form.userType === "admin"
                    ? "Select which event(s) this administrator has full management authority for:"
                    : "Select which event(s) this coordinator has scanning and management access to:"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-36 overflow-y-auto">
                  {events.map((ev) => (
                    <label
                      key={ev.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-colors ${
                        form.assignedEventIds.includes(ev.id)
                          ? "bg-amber-950/30 border-amber-800/60 text-white"
                          : "bg-[#16161B] hover:bg-[#1D1D24] border-[#24242A] text-zinc-300"
                      }`}
                    >
                      <Checkbox
                        checked={form.assignedEventIds.includes(ev.id)}
                        onCheckedChange={() =>
                          setForm({ ...form, assignedEventIds: toggleEventId(form.assignedEventIds, ev.id) })
                        }
                      />
                      <span className="text-xs font-medium truncate">{ev.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Scan Permissions Checkboxes (For Coordinators) */}
            {form.userType !== "admin" && form.userType !== "super_admin" && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#101013] border border-[#2B2B32]">
                <Label className="text-zinc-300 font-bold block">Scanner Privileges</Label>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-200">
                    <Checkbox
                      checked={form.permissions.includes("attendance")}
                      onCheckedChange={() =>
                        setForm({ ...form, permissions: togglePermission(form.permissions, "attendance") })
                      }
                    />
                    <span>Attendance Check-in Scanner</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-zinc-200">
                    <Checkbox
                      checked={form.permissions.includes("food")}
                      onCheckedChange={() =>
                        setForm({ ...form, permissions: togglePermission(form.permissions, "food") })
                      }
                    />
                    <span>Meal Token Scanner</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-zinc-200">
                    <Checkbox
                      checked={form.permissions.includes("goodies")}
                      onCheckedChange={() =>
                        setForm({ ...form, permissions: togglePermission(form.permissions, "goodies") })
                      }
                    />
                    <span>Kit Bag / Goodies Scanner</span>
                  </label>
                </div>
              </div>
            )}

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">
                {editUser ? "New Password (leave blank to keep current)" : "Initial Password"}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editUser ? "••••••••" : "Welcome@123"}
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-[#242429]">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs border-none"
            >
              {saving ? "Saving..." : editUser ? "Update Staff User" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── STAFF QR PASS MODAL ──────────────────────────────────────────────── */}
      <Dialog open={!!qrUser} onOpenChange={() => setQrUser(null)}>
        <DialogContent className="max-w-sm bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 text-center shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white">Staff Identification Badge</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {qrUser?.name} • {qrUser?.empId}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 flex flex-col items-center justify-center">
            {staffQrLoading ? (
              <Skeleton className="w-56 h-56 bg-[#1D1D22] rounded-2xl" />
            ) : staffQrData ? (
              <div className="p-3 bg-white rounded-2xl shadow-inner border border-zinc-300">
                <img src={staffQrData} alt="Staff QR" className="w-52 h-52 object-contain" />
              </div>
            ) : (
              <p className="text-xs text-zinc-500">QR unavailable</p>
            )}
            <span className="text-[11px] font-mono text-zinc-400 mt-3 block">{qrUser?.empId}</span>
          </div>

          <DialogFooter className="sm:justify-center">
            {staffQrData && (
              <Button
                asChild
                className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs border-none w-full"
              >
                <a href={staffQrData} download={`staff_qr_${qrUser?.empId}.png`}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download QR Code
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRMATION ──────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-white">Delete Staff Account?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-400">
              Are you sure you want to permanently remove <strong className="text-white">{deleteTarget?.name}</strong> (
              {deleteTarget?.empId})? They will immediately lose system access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs border-none"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── RESET PASSWORD CONFIRMATION ──────────────────────────────────────── */}
      <AlertDialog open={!!resetTarget} onOpenChange={() => setResetTarget(null)}>
        <AlertDialogContent className="bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-white">Reset Staff Password?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-400">
              Reset password for <strong className="text-white">{resetTarget?.name}</strong> to default{" "}
              <code className="bg-[#202028] px-1.5 py-0.5 rounded text-amber-300 font-mono">Welcome@123</code>? They will
              be prompted to create a new password on their next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              className="rounded-xl bg-amber-600 hover:bg-amber-500 text-zinc-950 font-black text-xs border-none"
            >
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
