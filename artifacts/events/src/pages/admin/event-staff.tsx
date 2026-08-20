import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  Activity,
  AlertCircle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const ROLE_LABELS: Record<string, string> = {
  admin: "Event Admin",
  super_admin: "Super Admin",
  track_coordinator: "Track / Attendance Coordinator",
  food_coordinator: "Food Coordinator",
  goodies_coordinator: "Goodies & Kit Coordinator",
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
  "Main Lobby & Registration Desk",
  "Dining Pavilion",
  "Delegate Kit Counter",
];

type SystemUser = {
  id: number;
  empId: string;
  name: string;
  email?: string | null;
  mobile?: string | null;
  userType: string;
  assignedTrack?: string | null;
  assignedEventIds?: number[];
  mustChangePassword?: boolean;
  permissions?: string[];
  createdAt?: string;
};

type FormData = {
  empId: string;
  name: string;
  email: string;
  mobile: string;
  userType: string;
  assignedTrack: string;
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
  password: "Welcome@123",
  permissions: ["attendance"],
};

function togglePermission(current: string[], perm: string): string[] {
  return current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm];
}

export default function EventStaffPage() {
  const { token, user: currentUser } = useAuth();
  const { activeEvent, activeEventId, events = [] } = useActiveEvent();
  const { data: allUsers = [], isLoading, refetch } = useListSystemUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const currentEvent = activeEvent || (events.length > 0 ? (events.find((e) => e.id === activeEventId) || events[0]) : null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);

  const [qrUser, setQrUser] = useState<SystemUser | null>(null);
  const [staffQrData, setStaffQrData] = useState<string | null>(null);
  const [staffQrLoading, setStaffQrLoading] = useState(false);

  // Enabled event module toggles
  const enableAttendance = currentEvent?.enableAttendance !== false;
  const enableFood = currentEvent?.enableFood !== false;
  const enableGoodies = currentEvent?.enableGoodies !== false;

  // Filter users belonging to this specific event (or super_admin / global admin)
  const eventUsers = useMemo(() => {
    if (!currentEvent) return [];
    return allUsers.filter((u: any) => {
      if (u.userType === "super_admin") return true;
      if (u.assignedEventIds && u.assignedEventIds.includes(currentEvent.id)) return true;
      return false;
    });
  }, [allUsers, currentEvent]);

  const filteredUsers = useMemo(() => {
    return eventUsers.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.empId.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.includes(q)) ||
        (u.assignedTrack && u.assignedTrack.toLowerCase().includes(q));

      const matchRole = roleFilter === "all" || u.userType === roleFilter;
      return matchSearch && matchRole;
    });
  }, [eventUsers, search, roleFilter]);

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
    // Set smart default role & permissions according to event toggles
    let defaultRole = "track_coordinator";
    let defaultPerms: string[] = [];
    if (enableAttendance) {
      defaultRole = "track_coordinator";
      defaultPerms.push("attendance");
    } else if (enableFood) {
      defaultRole = "food_coordinator";
      defaultPerms.push("food");
    } else if (enableGoodies) {
      defaultRole = "track_coordinator";
      defaultPerms.push("goodies");
    } else {
      defaultRole = "admin";
      defaultPerms = ["attendance", "food", "goodies"];
    }

    setForm({
      ...EMPTY_FORM,
      userType: defaultRole,
      permissions: defaultPerms,
    });
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
    if (!currentEvent) {
      toast({ title: "Error", description: "No active event selected", variant: "destructive" });
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
          assignedEventIds: [currentEvent.id],
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
        toast({ title: "Coordinator updated successfully" });
      } else {
        const payload: Record<string, unknown> = {
          empId: form.empId.trim(),
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          mobile: form.mobile.trim() || undefined,
          userType: form.userType,
          assignedTrack: form.assignedTrack.trim() || undefined,
          assignedEventIds: [currentEvent.id],
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
        toast({ title: "Event Coordinator Created! 🎉", description: `Assigned to ${currentEvent.title}` });
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
      toast({ title: "Coordinator removed" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/system-users"] });
    } catch {
      toast({ title: "Error removing coordinator", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  if (!currentEvent) {
    return (
      <div className="p-12 text-center text-zinc-400 bg-[#151518] rounded-3xl border border-[#26262B] space-y-4 max-w-xl mx-auto my-12">
        <ShieldAlert className="w-12 h-12 mx-auto text-zinc-600" />
        <h2 className="text-xl font-bold text-white">No Event Selected</h2>
        <p className="text-xs text-zinc-400">
          Please select an event from the Events Directory to manage its coordinators and scanner staff.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-zinc-100 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* ── HEADER BANNER ─────────────────────────────────────────────────── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Event Staff &amp; Coordinators
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {currentEvent.title}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Coordinator &amp; Scanner Team
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Create and assign event-scoped scanning staff (Attendance, Food, Delegate Kits) tailored specifically to the modules enabled for this event.
            </p>
          </div>

          {/* Action CTA */}
          <Button
            onClick={openCreate}
            className="h-10 px-5 rounded-2xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center gap-2 border-none shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Event Coordinator</span>
          </Button>
        </div>

        {/* ── EVENT FEATURE TOGGLES TELEMETRY ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#222228]">
          {/* Attendance Module Status */}
          <div className={`p-4 rounded-2xl border space-y-1 ${
            enableAttendance
              ? "bg-emerald-950/20 border-emerald-800/40"
              : "bg-zinc-950/40 border-zinc-800/50 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                Attendance &amp; Tracks
              </span>
              <Badge variant="outline" className={enableAttendance ? "bg-emerald-950 text-emerald-300 border-emerald-700 text-[10px]" : "text-zinc-500 border-zinc-700 text-[10px]"}>
                {enableAttendance ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400">
              {enableAttendance ? "Track-level QR check-in active" : "Attendance tracking disabled in event"}
            </p>
          </div>

          {/* Food Module Status */}
          <div className={`p-4 rounded-2xl border space-y-1 ${
            enableFood
              ? "bg-amber-950/20 border-amber-800/40"
              : "bg-zinc-950/40 border-zinc-800/50 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-amber-400" />
                Dining &amp; Food Sessions
              </span>
              <Badge variant="outline" className={enableFood ? "bg-amber-950 text-amber-300 border-amber-700 text-[10px]" : "text-zinc-500 border-zinc-700 text-[10px]"}>
                {enableFood ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400">
              {enableFood ? "Meal token QR redemption active" : "Food scanning disabled in event"}
            </p>
          </div>

          {/* Goodies Module Status */}
          <div className={`p-4 rounded-2xl border space-y-1 ${
            enableGoodies
              ? "bg-purple-950/20 border-purple-800/40"
              : "bg-zinc-950/40 border-zinc-800/50 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-purple-400" />
                Kit Bags &amp; Goodies
              </span>
              <Badge variant="outline" className={enableGoodies ? "bg-purple-950 text-purple-300 border-purple-700 text-[10px]" : "text-zinc-500 border-zinc-700 text-[10px]"}>
                {enableGoodies ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400">
              {enableGoodies ? "Delegate gift bag scanner active" : "Goodies distribution disabled in event"}
            </p>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ───────────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#141417] border border-[#26262D] shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search coordinator by name, EMP ID, track..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#101013] border-[#2B2B32] text-zinc-200 placeholder:text-zinc-500 rounded-2xl text-xs h-10"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-10 w-full sm:w-48 rounded-2xl bg-[#101013] border-[#2B2B32] text-xs text-zinc-200">
              <SelectValue placeholder="All Coordinator Roles" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
              <SelectItem value="all">All Assigned Staff ({eventUsers.length})</SelectItem>
              <SelectItem value="admin">Event Admin</SelectItem>
              {enableAttendance && <SelectItem value="track_coordinator">Track / Attendance</SelectItem>}
              {enableFood && <SelectItem value="food_coordinator">Food Coordinator</SelectItem>}
              <SelectItem value="scientific_committee">Scientific Committee</SelectItem>
              <SelectItem value="pr_member">AV / Preview Room</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── STAFF TABLE ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-[#151518] border border-[#26262D] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#101013]/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429]">
              <tr>
                <th className="px-5 py-3.5">Coordinator</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Assigned Role</th>
                <th className="px-4 py-3.5">Hall / Track</th>
                <th className="px-4 py-3.5">Enabled Scanner Privileges</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202026]">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={7} className="p-4">
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

                  const isAdmin = user.userType === "admin" || user.userType === "super_admin";

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
                            user.userType === "super_admin"
                              ? "bg-purple-950/70 text-purple-300 border-purple-800/50"
                              : user.userType === "admin"
                              ? "bg-rose-950/70 text-rose-300 border-rose-800/50"
                              : user.userType === "track_coordinator"
                              ? "bg-indigo-950/70 text-indigo-300 border-indigo-800/50"
                              : user.userType === "food_coordinator"
                              ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/50"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700"
                          }`}
                        >
                          {ROLE_LABELS[user.userType] ?? user.userType.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Track / Hall */}
                      <td className="px-4 py-4 text-zinc-300 text-xs">
                        {user.assignedTrack || <span className="text-zinc-500">General / All Halls</span>}
                      </td>

                      {/* Scanner Privileges */}
                      <td className="px-4 py-4">
                        {isAdmin ? (
                          <span className="text-[11px] font-bold text-amber-300">All Operations</span>
                        ) : ((user as any).permissions ?? []).length === 0 ? (
                          <span className="text-[11px] text-zinc-600 italic">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {((user as any).permissions ?? []).includes("attendance") && enableAttendance && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                                <CheckSquare className="w-2.5 h-2.5" /> Attendance
                              </span>
                            )}
                            {((user as any).permissions ?? []).includes("food") && enableFood && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-800/40 flex items-center gap-1">
                                <Utensils className="w-2.5 h-2.5" /> Food
                              </span>
                            )}
                            {((user as any).permissions ?? []).includes("goodies") && enableGoodies && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-950/70 text-purple-300 border border-purple-800/40 flex items-center gap-1">
                                <Gift className="w-2.5 h-2.5" /> Goodies
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1 w-fit">
                          <Check className="w-3 h-3" /> Active
                        </span>
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
                            className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-[#23232B]"
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>

                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit Coordinator"
                            onClick={() => openEdit(user)}
                            className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-[#23232B]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>

                          {/* Remove from this event */}
                          {user.userType !== "super_admin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete Coordinator"
                              onClick={() => setDeleteTarget(user)}
                              className="h-8 w-8 p-0 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-zinc-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <p className="font-bold text-sm text-zinc-300">No Coordinators Assigned Yet</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Click "+ Add Event Coordinator" to create scanning staff for this event.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE / EDIT MODAL ───────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#141417] border border-[#2B2B32] text-zinc-100 max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <span>{editUser ? "Edit Event Coordinator" : "Add Event Coordinator"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Create an operational user scoped specifically for <strong>{currentEvent.title}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* EMP ID & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">EMP ID / Username *</Label>
                <Input
                  value={form.empId}
                  disabled={!!editUser}
                  onChange={(e) => setForm({ ...form, empId: e.target.value })}
                  placeholder="e.g. CRD001"
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs font-mono"
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
                  placeholder="coordinator@sankaraeye.in"
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
                <Label className="text-zinc-300 font-bold">Coordinator Role</Label>
                <Select value={form.userType} onValueChange={(val) => {
                  let perms = form.permissions;
                  if (val === "food_coordinator") perms = ["food"];
                  if (val === "track_coordinator") perms = ["attendance"];
                  if (val === "admin") perms = ["attendance", "food", "goodies"];
                  setForm({ ...form, userType: val, permissions: perms });
                }}>
                  <SelectTrigger className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
                    <SelectItem value="admin">⚡ Event Admin (Full Access for this Event)</SelectItem>
                    {enableAttendance && (
                      <SelectItem value="track_coordinator">📍 Attendance / Track Coordinator</SelectItem>
                    )}
                    {enableFood && (
                      <SelectItem value="food_coordinator">🍽️ Food Session Coordinator</SelectItem>
                    )}
                    <SelectItem value="scientific_committee">🔬 Scientific Committee</SelectItem>
                    <SelectItem value="pr_member">🖥️ AV / Preview Room</SelectItem>
                    <SelectItem value="coordinator_view_only">👁️ Coordinator (View Only)</SelectItem>
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
                    <SelectItem value="none">General / All Halls</SelectItem>
                    {TRACKS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scanner Privileges (Tailored strictly to event toggles) */}
            {form.userType !== "admin" && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#101013] border border-[#2B2B32]">
                <Label className="text-zinc-300 font-bold block">Scanner Privileges for this Event</Label>
                <div className="flex flex-wrap gap-4 pt-1">
                  {enableAttendance && (
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-200 text-xs font-medium">
                      <Checkbox
                        checked={form.permissions.includes("attendance")}
                        onCheckedChange={() =>
                          setForm({ ...form, permissions: togglePermission(form.permissions, "attendance") })
                        }
                      />
                      <span>Attendance QR Check-in</span>
                    </label>
                  )}

                  {enableFood && (
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-200 text-xs font-medium">
                      <Checkbox
                        checked={form.permissions.includes("food")}
                        onCheckedChange={() =>
                          setForm({ ...form, permissions: togglePermission(form.permissions, "food") })
                        }
                      />
                      <span>Meal Token Scanner</span>
                    </label>
                  )}

                  {enableGoodies && (
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-200 text-xs font-medium">
                      <Checkbox
                        checked={form.permissions.includes("goodies")}
                        onCheckedChange={() =>
                          setForm({ ...form, permissions: togglePermission(form.permissions, "goodies") })
                        }
                      />
                      <span>Kit Bag / Goodies Scanner</span>
                    </label>
                  )}
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
              {saving ? "Saving..." : editUser ? "Update Coordinator" : "Create & Assign to Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── STAFF QR PASS MODAL ───────────────────────────────────────────── */}
      <Dialog open={!!qrUser} onOpenChange={() => setQrUser(null)}>
        <DialogContent className="bg-[#141417] border border-[#2B2B32] text-zinc-100 max-w-sm rounded-3xl p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">Staff QR Pass</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Authorized scanner pass for {qrUser?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-white rounded-2xl mx-auto my-3 flex items-center justify-center shadow-lg">
            {staffQrLoading ? (
              <div className="w-48 h-48 flex items-center justify-center text-zinc-400">
                Generating QR...
              </div>
            ) : staffQrData ? (
              <img src={staffQrData} alt="Staff QR Pass" className="w-48 h-48 object-contain" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-zinc-400">
                QR Unavailable
              </div>
            )}
          </div>

          <div className="space-y-1 font-mono text-xs text-zinc-300">
            <div className="font-bold text-white text-sm">{qrUser?.name}</div>
            <div className="text-zinc-400">EMP ID: {qrUser?.empId}</div>
            <div className="text-indigo-400 font-semibold">{ROLE_LABELS[qrUser?.userType || ""] || qrUser?.userType}</div>
          </div>

          <DialogFooter className="pt-3">
            {staffQrData && (
              <Button asChild className="w-full rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-bold text-xs">
                <a href={staffQrData} download={`staff-pass-${qrUser?.empId}.png`}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download QR Pass
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRMATION ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-black">Remove Coordinator?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-xs">
              Are you sure you want to remove <strong>{deleteTarget?.name}</strong> from this event? They will lose scanner access to this event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1A1A20] text-zinc-300 border-[#2B2B32] hover:bg-[#25252D] rounded-xl text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs border-none"
            >
              Remove Coordinator
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
