import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Utensils, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type FoodSession = {
  id: number;
  eventId?: number | null;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
  createdAt: string;
};

type FoodSessionInput = {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
};

const EMPTY_FORM: FoodSessionInput = { name: "", date: "", startTime: "", endTime: "", enabled: false };

export default function FoodSessions() {
  const { user, token } = useAuth();
  const { activeEvent, activeEventId } = useActiveEvent();
  const isCoordinatorViewOnly = user?.userType === "coordinator_view_only";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading, refetch } = useQuery<FoodSession[]>({
    queryKey: ["/api/food-sessions", activeEventId],
    queryFn: async () => {
      const url = activeEventId
        ? `${BASE_URL}/api/food-sessions?eventId=${activeEventId}`
        : `${BASE_URL}/api/food-sessions`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<FoodSession | null>(null);
  const [form, setForm] = useState<FoodSessionInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FoodSession | null>(null);

  const openCreate = () => {
    setEditingSession(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (s: FoodSession) => {
    setEditingSession(s);
    setForm({ name: s.name, date: s.date, startTime: s.startTime, endTime: s.endTime, enabled: s.enabled });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.date || !form.startTime || !form.endTime) {
      toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingSession) {
        const resp = await fetch(`${BASE_URL}/api/food-sessions/${editingSession.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        });
        if (!resp.ok) throw new Error("Failed to update session");
        toast({ title: "Session updated successfully" });
      } else {
        const payload = { ...form, eventId: activeEventId || undefined };
        const resp = await fetch(`${BASE_URL}/api/food-sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error("Failed to create food session");
        toast({ title: "Food session created successfully" });
      }
      setDialogOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/food-sessions"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const resp = await fetch(`${BASE_URL}/api/food-sessions/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to delete session");
      toast({ title: "Session deleted successfully" });
      setDeleteTarget(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/food-sessions"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      const resp = await fetch(`${BASE_URL}/api/food-sessions/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled }),
      });
      if (!resp.ok) throw new Error("Failed to toggle session status");
      toast({ title: `Session ${enabled ? "enabled" : "disabled"}` });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/food-sessions"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 text-zinc-100 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Food Sessions</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure meal scanning sessions (Breakfast, Lunch, High Tea, Dinner)
          </p>
        </div>
        {!isCoordinatorViewOnly && (
          <Button
            onClick={openCreate}
            className="h-10 px-4 gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs rounded-2xl border-none cursor-pointer shadow-lg shadow-white/5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Session</span>
          </Button>
        )}
      </div>

      {/* ── TABLE ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#101013]/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429]">
              <tr>
                <th className="px-5 py-3.5 whitespace-nowrap">Session Name</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Time Window</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Scanning Status</th>
                {!isCoordinatorViewOnly && <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202026]">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={5} className="p-4">
                      <Skeleton className="h-8 bg-[#1B1B20] rounded-xl w-full" />
                    </td>
                  </tr>
                ))
              ) : sessions.length > 0 ? (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-[#1A1A1F]/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#202028] border border-[#2F2F38] flex items-center justify-center text-zinc-200">
                          <Utensils className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-white text-sm">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-zinc-300">{s.date}</td>
                    <td className="px-4 py-4 font-mono text-zinc-400">
                      {s.startTime} – {s.endTime}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={s.enabled}
                          onCheckedChange={(checked) => handleToggle(s.id, checked)}
                          disabled={isCoordinatorViewOnly}
                        />
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            s.enabled
                              ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/40"
                              : "bg-[#202028] text-zinc-400 border-[#2D2D35]"
                          }`}
                        >
                          {s.enabled ? "Active for Scanning" : "Disabled"}
                        </span>
                      </div>
                    </td>
                    {!isCoordinatorViewOnly && (
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit"
                            onClick={() => openEdit(s)}
                            className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-zinc-400 hover:text-white"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            onClick={() => setDeleteTarget(s)}
                            className="h-8 w-8 p-0 rounded-xl hover:bg-rose-950/50 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <Utensils className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    <p className="font-semibold text-sm">No food sessions configured yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE / EDIT MODAL ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">
              {editingSession ? "Edit Food Session" : "Create Meal Session"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Configure session name, date, and valid scanning hours.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Session Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Day 1 Conference Lunch"
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Start Time *</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">End Time *</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#101013] border border-[#2B2B32] mt-2">
              <div>
                <span className="text-xs font-bold text-white block">Enable for Scanning</span>
                <span className="text-[11px] text-zinc-400">Allow coordinators to scan for this meal</span>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-[#242429]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs border-none"
            >
              {saving ? "Saving..." : editingSession ? "Update Session" : "Create Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE MODAL ────────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-white">Delete Food Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-400">
              Are you sure you want to delete <strong className="text-white">{deleteTarget?.name}</strong>?
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
              Delete Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
