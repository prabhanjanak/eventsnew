import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";
import { ParticipantQRDialog } from "@/components/participant-qr-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Search,
  Plus,
  Trash2,
  QrCode,
  Download,
  Loader2,
  UserCheck,
  Building,
  Phone,
  ShieldCheck,
  Utensils,
  Check,
  AlertTriangle,
  Users,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface SpecialPass {
  id: number;
  registrationNumber: string;
  name: string;
  mobile: string;
  email: string;
  institution: string;
  delegateType: "exhibitor" | "vendor" | "external" | "crew" | "committee";
  address?: string;
  collectedCoupons: {
    foodSessionId: number;
    collectedAt: string;
  }[];
}

const VENDOR_COMPANIES = [
  "Catering Team",
  "AV & Lights Vendor",
  "Stall Fabricator / Decorator",
  "Stage & Setup Vendor",
  "Security Agency",
  "Housekeeping / Cleaning Team",
  "Event Management Agency",
  "Other (Specify Custom Name)",
];

const CREW_DEPARTMENTS = [
  "IT & Technical Support",
  "Reception & Registration Desk",
  "Help Desk & Information",
  "Scientific Committee Crew",
  "Food & Beverages Committee",
  "Transport & Logistics",
  "Venue Coordinators",
  "Student Volunteers",
  "Other (Specify Custom Name)",
];

export default function AdminCrewVendors() {
  const { token, user } = useAuth();
  const { activeEvent, activeEventId } = useActiveEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isCoordinatorViewOnly = user?.userType === "coordinator_view_only";

  // Filter & Search states
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // QR dialog state
  const [qrPass, setQrPass] = useState<{ id: number; name: string; registrationNumber: string } | null>(null);

  // Add pass form states
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    category: "crew",
    mobile: "",
    org: "IT & Technical Support",
    stallNumber: "",
  });
  const [presetOrg, setPresetOrg] = useState("IT & Technical Support");
  const [addSaving, setAddSaving] = useState(false);

  // Delete pass states
  const [deletePass, setDeletePass] = useState<SpecialPass | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk ZIP state
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Load Special Passes
  const { data: passes = [], isLoading: passesLoading } = useQuery<SpecialPass[]>({
    queryKey: ["special-passes", activeEventId],
    queryFn: async () => {
      const urlParam = activeEventId ? `?eventId=${activeEventId}` : "";
      const resp = await fetch(`${BASE_URL}/api/participants/special-passes${urlParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!token,
  });

  // Load Food Sessions
  const { data: foodSessions = [] } = useQuery<any[]>({
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

  const activeFoodSessions = foodSessions.filter((s: any) => s.enabled);

  // Stats calculation
  const totalPasses = passes.length;
  const countCrew = passes.filter((p) => p.delegateType === "crew").length;
  const countExh = passes.filter((p) => p.delegateType === "exhibitor").length;
  const countVen = passes.filter((p) => p.delegateType === "vendor").length;
  const countExt = passes.filter((p) => p.delegateType === "external").length;

  // Filtered passes list
  const filteredPasses = passes.filter((p) => {
    const matchesCategory = categoryFilter === "all" || p.delegateType === categoryFilter;
    const matchesSearch =
      !debouncedSearch.trim() ||
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.registrationNumber.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (p.mobile && p.mobile.includes(debouncedSearch)) ||
      (p.institution && p.institution.toLowerCase().includes(debouncedSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Add pass handler
  const handleAddPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setAddSaving(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/participants/special-passes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: addForm.name.trim(),
          category: addForm.category,
          mobile: addForm.mobile.trim() || undefined,
          institution: addForm.org.trim() || undefined,
          address: addForm.category === "exhibitor" ? addForm.stallNumber.trim() || undefined : undefined,
          eventId: activeEventId || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create pass");
      }

      toast({ title: "Special Pass Created ✓", description: `Added ${addForm.name} to list.` });
      setAddOpen(false);
      setAddForm({ name: "", category: "crew", mobile: "", org: "", stallNumber: "" });
      queryClient.invalidateQueries({ queryKey: ["special-passes"] });
    } catch (err: any) {
      toast({
        title: "Creation Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setAddSaving(false);
    }
  };

  // Delete pass handler
  const handleDeletePass = async () => {
    if (!deletePass) return;
    setDeleting(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/participants/special-passes/${deletePass.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete pass");
      }

      toast({ title: "Pass Deleted", description: `Removed ${deletePass.name} successfully.` });
      setDeletePass(null);
      queryClient.invalidateQueries({ queryKey: ["special-passes"] });
    } catch (err: any) {
      toast({
        title: "Deletion Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Download ZIP handler
  const handleDownloadBulkQR = async () => {
    setDownloadingZip(true);
    try {
      const urlParam = activeEventId ? `?eventId=${activeEventId}` : "";
      const resp = await fetch(`${BASE_URL}/api/participants/special-passes/qr-batch${urlParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Could not construct zip on server");
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `special_passes_qr_codes_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "ZIP download started", description: "All crew & exhibitor QRs downloaded." });
    } catch (err: any) {
      toast({
        title: "Download Failed",
        description: err.message || "Could not retrieve ZIP package.",
        variant: "destructive",
      });
    } finally {
      setDownloadingZip(false);
    }
  };

  const categoryLabels: Record<string, string> = {
    crew: "Team Sankara",
    exhibitor: "Exhibitor / Stall",
    vendor: "Vendor Partner",
    external: "External Team",
    committee: "Sankara Committee",
  };

  return (
    <div className="space-y-6 text-zinc-100 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#242428]/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Exhibitors &amp; Team Sankara Passes
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage food coupon QR passes for venue support teams, host employees, and stall partners
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleDownloadBulkQR}
            disabled={downloadingZip || totalPasses === 0}
            className="h-10 px-4 gap-2 bg-[#18181C] border-[#2A2A32] text-zinc-200 hover:text-white hover:bg-[#222228] text-xs font-bold rounded-2xl cursor-pointer"
          >
            {downloadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Download All QRs (ZIP)</span>
          </Button>

          {!isCoordinatorViewOnly && (
            <Button
              onClick={() => setAddOpen(true)}
              className="h-10 px-4 gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs rounded-2xl border-none cursor-pointer shadow-lg shadow-white/5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Special Pass</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── METRIC CARDS (MONOCHROME HIGH CONTRAST) ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-[#151518] border border-[#26262B] shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Passes</span>
          <span className="text-2xl font-black text-white mt-1 block">{passesLoading ? "…" : totalPasses}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#151518] border border-[#26262B] shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Team Sankara</span>
          <span className="text-2xl font-black text-white mt-1 block">{passesLoading ? "…" : countCrew}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#151518] border border-[#26262B] shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Exhibitors</span>
          <span className="text-2xl font-black text-white mt-1 block">{passesLoading ? "…" : countExh}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#151518] border border-[#26262B] shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Vendors (VEN)</span>
          <span className="text-2xl font-black text-white mt-1 block">{passesLoading ? "…" : countVen}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#151518] border border-[#26262B] shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">External (EXT)</span>
          <span className="text-2xl font-black text-white mt-1 block">{passesLoading ? "…" : countExt}</span>
        </div>
      </div>

      {/* ── SEARCH & FILTER ─────────────────────────────────────────────────── */}
      <div className="p-4 rounded-3xl bg-[#151518] border border-[#26262B] shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search name, code, mobile, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#101013] border-[#2B2B32] text-zinc-200 placeholder:text-zinc-500 rounded-2xl text-xs h-10"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-10 w-full sm:w-48 rounded-2xl bg-[#101013] border-[#2B2B32] text-xs text-zinc-200">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="crew">Team Sankara</SelectItem>
            <SelectItem value="committee">Sankara Committee</SelectItem>
            <SelectItem value="exhibitor">Exhibitors</SelectItem>
            <SelectItem value="vendor">Vendor Partners</SelectItem>
            <SelectItem value="external">External Team</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── TABLE ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#101013]/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429]">
              <tr>
                <th className="px-5 py-3.5 whitespace-nowrap">ID / Code</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Pass Holder</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Category</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Org / Department</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Mobile</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Food Coupons</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202026]">
              {passesLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={7} className="p-4">
                      <Skeleton className="h-8 bg-[#1B1B20] rounded-xl w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredPasses.length > 0 ? (
                filteredPasses.map((pass) => (
                  <tr key={pass.id} className="hover:bg-[#1A1A1F]/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-white whitespace-nowrap">
                      {pass.registrationNumber}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-white">{pass.name}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#202028] text-zinc-200 border border-[#2E2E38]">
                        {categoryLabels[pass.delegateType] || pass.delegateType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400">
                      {pass.institution || "Venue Team"} {pass.address ? `(${pass.address})` : ""}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-400">{pass.mobile || "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-semibold text-zinc-300">
                        {pass.collectedCoupons?.length || 0} collected
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View QR"
                          onClick={() => setQrPass(pass)}
                          className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-zinc-300 hover:text-white"
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                        {!isCoordinatorViewOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete Pass"
                            onClick={() => setDeletePass(pass)}
                            className="h-8 w-8 p-0 rounded-xl hover:bg-rose-950/50 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <UserCheck className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    <p className="font-semibold text-sm">No special passes found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Dialog */}
      {qrPass && (
        <ParticipantQRDialog
          open={!!qrPass}
          onOpenChange={() => setQrPass(null)}
          participant={qrPass}
        />
      )}

      {/* Create Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">Create Special Pass</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Generate an event credential for staff, stall vendors, or exhibitors.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddPass} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Pass Holder Name *</Label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Full Name"
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Category</Label>
              <Select
                value={addForm.category}
                onValueChange={(val) => setAddForm({ ...addForm, category: val })}
              >
                <SelectTrigger className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
                  <SelectItem value="crew">Team Sankara</SelectItem>
                  <SelectItem value="committee">Sankara Committee</SelectItem>
                  <SelectItem value="exhibitor">Exhibitor / Stall</SelectItem>
                  <SelectItem value="vendor">Vendor Partner</SelectItem>
                  <SelectItem value="external">External Team</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Mobile Number</Label>
              <Input
                value={addForm.mobile}
                onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })}
                placeholder="10-digit mobile"
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Organization / Team</Label>
              <Input
                value={addForm.org}
                onChange={(e) => setAddForm({ ...addForm, org: e.target.value })}
                placeholder="Department or Vendor Company"
                className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-xl h-9 text-xs"
              />
            </div>

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
                type="submit"
                disabled={addSaving}
                className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs border-none"
              >
                {addSaving ? "Creating..." : "Create Pass"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
