import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  RefreshCw,
  QrCode,
  Printer,
  Search,
  Users,
  ShieldCheck,
  Building2,
  Phone,
  User,
  Check,
  Sparkles,
  Store,
  HardHat,
  Crown,
  UserCheck,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Hash,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ParticipantQRDialog } from "@/components/participant-qr-dialog";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const ROLE_OPTIONS = [
  { value: "delegate", label: "Delegate / Attendee", icon: UserCheck },
  { value: "team_sankara", label: "Team Sankara (Staff / Crew)", icon: HardHat },
  { value: "vendor", label: "Vendor Partner (Catering / AV / Security)", icon: ShieldCheck },
  { value: "exhibitor", label: "Exhibitor / Stall / Shops", icon: Store },
  { value: "guest", label: "Guest / VIP Dignitary", icon: Crown },
];

export default function AdminOnSpot() {
  const { token, user } = useAuth();
  const { activeEvent, activeEventId } = useActiveEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isCoordinatorViewOnly = user?.userType === "coordinator_view_only";

  // Filter & Search states
  const [activeRoleTab, setActiveRoleTab] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Card Generator Modal State (By Card Number / Range)
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genMode, setGenMode] = useState<"single" | "range" | "count">("single");
  const [singleCardNumber, setSingleCardNumber] = useState<string>("");
  const [startCardNumber, setStartCardNumber] = useState<string>("");
  const [endCardNumber, setEndCardNumber] = useState<string>("");
  const [generateCount, setGenerateCount] = useState<number>(20);
  const [generateRole, setGenerateRole] = useState<string>("delegate");
  const [generating, setGenerating] = useState(false);

  // Scan Gun Input & Linking State
  const [scannedCardCode, setScannedCardCode] = useState("");
  const [activeCardId, setActiveCardId] = useState<string>("");
  const [linkRole, setLinkRole] = useState("delegate");
  const [linkName, setLinkName] = useState("");
  const [linkPhone, setLinkPhone] = useState("");
  const [linkOrg, setLinkOrg] = useState("");
  const [linking, setLinking] = useState(false);
  const [cardStatusMessage, setCardStatusMessage] = useState<{
    type: "ready" | "existing" | "not_found";
    text: string;
  } | null>(null);

  // Last activated notification
  const [lastActivated, setLastActivated] = useState<{
    regNumber: string;
    name: string;
    role: string;
  } | null>(null);

  // QR & Print states
  const [qrParticipant, setQrParticipant] = useState<{ id: number; name: string; registrationNumber: string } | null>(null);
  const [printCard, setPrintCard] = useState<any | null>(null);

  // Input refs for rapid keyboard / scan gun workflow
  const scanGunInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const orgInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus scan gun input on page load
  useEffect(() => {
    scanGunInputRef.current?.focus();
  }, []);

  // Query On-Spot Cards
  const { data: onSpotCards = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/onspot/list", activeEventId, activeRoleTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeEventId) params.set("eventId", String(activeEventId));
      if (activeRoleTab !== "all") params.set("role", activeRoleTab);

      const res = await fetch(`${BASE_URL}/api/onspot/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load on-spot cards");
      return res.json();
    },
    enabled: !!token,
  });

  // Handle Scan Gun Lookup when card code is scanned/entered
  const handleScanGunLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    try {
      const res = await fetch(`${BASE_URL}/api/onspot/lookup-card/${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        // If not found in system, allow direct on-the-fly card ID creation/activation
        setActiveCardId(trimmed.toUpperCase());
        setCardStatusMessage({
          type: "ready",
          text: `Card ${trimmed.toUpperCase()} scanned — Enter details to validate pass.`,
        });
        phoneInputRef.current?.focus();
        return;
      }

      const data = await res.json();
      if (data.found && data.participant) {
        const p = data.participant;
        setActiveCardId(p.registrationNumber);
        setLinkRole(p.delegateType || "delegate");

        if (p.isLinked) {
          // Already linked card (edit mode)
          setLinkName(p.name !== "Unassigned Pass" ? p.name : "");
          setLinkPhone(p.mobile || "");
          setLinkOrg(p.institution || "");
          setCardStatusMessage({
            type: "existing",
            text: `Card ${p.registrationNumber} is already VALID for ${p.name}. You can update details below.`,
          });
        } else {
          // Unassigned card ready to be activated
          setLinkName("");
          setLinkPhone("");
          setLinkOrg("");
          setCardStatusMessage({
            type: "ready",
            text: `Card ${p.registrationNumber} ready — Enter Name, Phone & Org to make valid.`,
          });
        }

        // Move focus immediately to phone number input
        setTimeout(() => {
          phoneInputRef.current?.focus();
        }, 100);
      }
    } catch {
      setActiveCardId(trimmed.toUpperCase());
      phoneInputRef.current?.focus();
    }
  };

  // Handle Generating Cards by Number or Range
  const handleGenerateCards = async () => {
    setGenerating(true);
    try {
      const payload: any = {
        eventId: activeEventId || 1,
        role: generateRole,
      };

      if (genMode === "single") {
        if (!singleCardNumber) {
          toast({ title: "Validation Error", description: "Please enter a card number.", variant: "destructive" });
          setGenerating(false);
          return;
        }
        payload.singleNumber = singleCardNumber;
      } else if (genMode === "range") {
        if (!startCardNumber || !endCardNumber) {
          toast({ title: "Validation Error", description: "Please enter start and end numbers.", variant: "destructive" });
          setGenerating(false);
          return;
        }
        payload.startNumber = Number(startCardNumber);
        payload.endNumber = Number(endCardNumber);
      } else {
        payload.count = Number(generateCount) || 10;
      }

      const res = await fetch(`${BASE_URL}/api/onspot/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate cards");

      toast({
        title: "Cards Generated ✓",
        description: data.message || `Cards generated successfully. Ready to be scanned & validated.`,
      });

      setGenerateOpen(false);
      setSingleCardNumber("");
      setStartCardNumber("");
      setEndCardNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/onspot/list"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Handle Validating & Activating the Card with Phone, Name, Org
  const handleActivateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const cardIdToLink = activeCardId.trim() || scannedCardCode.trim();

    if (!cardIdToLink) {
      toast({
        title: "Scan Card First",
        description: "Please scan a card with the scan gun or enter the Card ID.",
        variant: "destructive",
      });
      scanGunInputRef.current?.focus();
      return;
    }

    if (!linkPhone.trim() || !linkName.trim()) {
      toast({
        title: "Missing Information",
        description: "Phone Number and Person Name are required to make this card valid.",
        variant: "destructive",
      });
      if (!linkPhone.trim()) phoneInputRef.current?.focus();
      else nameInputRef.current?.focus();
      return;
    }

    setLinking(true);
    try {
      const res = await fetch(`${BASE_URL}/api/onspot/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          registrationNumber: cardIdToLink,
          name: linkName.trim(),
          mobile: linkPhone.trim(),
          institution: linkOrg.trim() || "Sankara Eye Hospital",
          delegateType: linkRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to activate card");

      // Set last activated banner
      setLastActivated({
        regNumber: cardIdToLink.toUpperCase(),
        name: linkName.trim(),
        role: linkRole,
      });

      toast({
        title: "Card is now VALID & ACTIVE ✓",
        description: `Card ${cardIdToLink.toUpperCase()} activated for ${linkName.trim()} (${linkPhone.trim()})`,
      });

      // Clear form & return cursor directly to scan gun for next attendee
      setScannedCardCode("");
      setActiveCardId("");
      setLinkName("");
      setLinkPhone("");
      setLinkOrg("");
      setCardStatusMessage(null);

      queryClient.invalidateQueries({ queryKey: ["/api/onspot/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });

      setTimeout(() => {
        scanGunInputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      toast({ title: "Activation Failed", description: err.message, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  // Filter Cards
  const filteredCards = onSpotCards.filter((c) => {
    // Status filter
    if (statusFilter === "valid" && !c.isOnSpotLinked) return false;
    if (statusFilter === "pending" && c.isOnSpotLinked) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.registrationNumber?.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.mobile?.toLowerCase().includes(q) ||
      c.institution?.toLowerCase().includes(q)
    );
  });

  const totalCards = onSpotCards.length;
  const validCards = onSpotCards.filter((c) => c.isOnSpotLinked).length;
  const pendingCards = totalCards - validCards;

  return (
    <div className="space-y-6 text-zinc-100 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              On-Spot Desk &amp; Scan Gun Activation
            </h1>
            {activeEvent && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#202028] text-zinc-300 border border-[#2F2F38]">
                {activeEvent.title}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Scan physical numbered card with scan gun, enter Phone, Name &amp; Org — then only that card ID becomes valid.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isCoordinatorViewOnly && (
            <Button
              onClick={() => setGenerateOpen(true)}
              className="h-10 px-4 gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs rounded-2xl border-none cursor-pointer shadow-lg shadow-white/5"
            >
              <Hash className="w-4 h-4" />
              <span>Generate Card Numbers</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => refetch()}
            className="h-10 px-3.5 gap-1.5 bg-[#18181C] border-[#2A2A32] text-zinc-200 hover:text-white rounded-2xl text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ── INTERACTIVE METRICS STAT CARDS ROW ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Cards Metric */}
        <div
          onClick={() => setStatusFilter("all")}
          className={`p-5 rounded-3xl bg-[#14151B]/90 border backdrop-blur-xl transition-all cursor-pointer select-none group ${
            statusFilter === "all"
              ? "border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.08)] ring-1 ring-white/20"
              : "border-white/10 hover:border-white/20 hover:bg-[#181922]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
              Total Cards Pool
            </span>
            <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300 group-hover:text-white">
              <Hash className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-white mt-2 tracking-tight">{totalCards}</div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Physical stock generated</span>
            <span className="font-mono text-zinc-500">100%</span>
          </div>
        </div>

        {/* Valid & Active Passes Metric */}
        <div
          onClick={() => setStatusFilter("valid")}
          className={`p-5 rounded-3xl bg-[#14151B]/90 border backdrop-blur-xl transition-all cursor-pointer select-none group ${
            statusFilter === "valid"
              ? "border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30"
              : "border-white/10 hover:border-emerald-500/30 hover:bg-[#181922]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Valid &amp; Active Passes
            </span>
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-300 mt-2 tracking-tight">{validCards}</div>
          <div className="mt-3 space-y-1">
            <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${totalCards > 0 ? (validCards / totalCards) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span>Activated &amp; Assigned</span>
              <span>{totalCards > 0 ? Math.round((validCards / totalCards) * 100) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Pending Scan Metric */}
        <div
          onClick={() => setStatusFilter("pending")}
          className={`p-5 rounded-3xl bg-[#14151B]/90 border backdrop-blur-xl transition-all cursor-pointer select-none group ${
            statusFilter === "pending"
              ? "border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30"
              : "border-white/10 hover:border-amber-500/30 hover:bg-[#181922]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-amber-300 uppercase tracking-wider">
              Pending Scan / Unassigned
            </span>
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-amber-200 mt-2 tracking-tight">{pendingCards}</div>
          <div className="mt-3 space-y-1">
            <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${totalCards > 0 ? (pendingCards / totalCards) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span>Awaiting Desk Scan</span>
              <span>{totalCards > 0 ? Math.round((pendingCards / totalCards) * 100) : 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SCAN GUN INSTANT ACTIVATION STATION (MAIN WORKFLOW) ─────────────── */}
      {!isCoordinatorViewOnly && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#151518] border-2 border-[#2A2A32] shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#242429] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white text-zinc-950 flex items-center justify-center shadow-md">
                <ScanLine className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  Scan Gun Activation Counter
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Step 1: Scan card QR/barcode with gun → Step 2: Enter Phone &amp; Name → Step 3: Card becomes Valid
                </p>
              </div>
            </div>

            {lastActivated && (
              <div className="px-3.5 py-1.5 rounded-2xl bg-emerald-950/80 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Last Validated: <strong>{lastActivated.regNumber}</strong> ({lastActivated.name})
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleActivateCard} autoComplete="off" autoCorrect="off" spellCheck={false} className="space-y-4">
            {/* Top Bar: Scan Gun Input */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8 space-y-1.5">
                <Label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ScanLine className="w-3.5 h-3.5 text-zinc-400" />
                  1. Scan Physical Card with Gun (or enter Card #) *
                </Label>
                <div className="relative">
                  <Input
                    ref={scanGunInputRef}
                    value={scannedCardCode}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    onChange={(e) => {
                      setScannedCardCode(e.target.value);
                      handleScanGunLookup(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleScanGunLookup(scannedCardCode);
                      }
                    }}
                    placeholder="Aim scan gun here & pull trigger (e.g. OS-1001 or 1001)..."
                    className="h-12 bg-[#0C0C0E] border-2 border-white/30 focus:border-white text-white placeholder:text-zinc-500 rounded-2xl text-sm font-mono tracking-wider pl-4 shadow-inner"
                  />
                </div>
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Role / Category *
                </Label>
                <Select value={linkRole} onValueChange={setLinkRole}>
                  <SelectTrigger className="h-12 bg-[#0C0C0E] border border-[#2B2B32] text-zinc-100 rounded-2xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status Message */}
            {cardStatusMessage && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                  cardStatusMessage.type === "ready"
                    ? "bg-zinc-800/80 border border-zinc-700 text-zinc-200"
                    : "bg-emerald-950/60 border border-emerald-800/40 text-emerald-300"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{cardStatusMessage.text}</span>
              </div>
            )}

            {/* Bottom Row: Phone, Name, Organization + Activate Button */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-zinc-300">
                    2. Mobile Number (Strict 10-Digits) *
                  </Label>
                  {linkPhone && linkPhone.length === 10 && (
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ 10 Digits</span>
                  )}
                </div>
                <Input
                  ref={phoneInputRef}
                  value={linkPhone}
                  type="tel"
                  maxLength={10}
                  autoComplete="new-password"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  onChange={(e) => setLinkPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      nameInputRef.current?.focus();
                    }
                  }}
                  placeholder="e.g. 9876543210"
                  className="h-11 bg-[#0C0C0E] border border-[#2B2B32] text-white placeholder:text-zinc-500 rounded-2xl text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300">
                  3. Person Full Name *
                </Label>
                <Input
                  ref={nameInputRef}
                  value={linkName}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  onChange={(e) => setLinkName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      orgInputRef.current?.focus();
                    }
                  }}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  className="h-11 bg-[#0C0C0E] border border-[#2B2B32] text-white placeholder:text-zinc-500 rounded-2xl text-xs"
                />
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300">
                  4. Organization / Dept / Stall
                </Label>
                <div className="flex gap-2">
                  <Input
                    ref={orgInputRef}
                    value={linkOrg}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    onChange={(e) => setLinkOrg(e.target.value)}
                    placeholder="Hospital, Stall #, Vendor"
                    className="h-11 bg-[#0C0C0E] border border-[#2B2B32] text-white placeholder:text-zinc-500 rounded-2xl text-xs"
                  />
                  <Button
                    type="submit"
                    disabled={linking}
                    className="h-11 px-5 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs rounded-2xl border-none shrink-0 cursor-pointer shadow-lg"
                  >
                    {linking ? "Validating..." : "Validate & Activate"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── ROLE & STATUS TABS ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex border border-[#26262B] bg-[#161619] rounded-2xl p-1 gap-1 w-full max-w-2xl shadow-sm overflow-x-auto">
          {[
            { key: "all", label: `All Cards (${totalCards})` },
            { key: "team_sankara", label: "Team Sankara" },
            { key: "vendor", label: "Vendors" },
            { key: "exhibitor", label: "Exhibitors & Stalls" },
            { key: "guest", label: "Guests / VIPs" },
            { key: "delegate", label: "Delegates" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveRoleTab(tab.key)}
              className={`py-2 px-3 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeRoleTab === tab.key
                  ? "bg-white text-zinc-950 shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "all" ? "bg-[#25252C] text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            All Status
          </button>
          <button
            onClick={() => setStatusFilter("valid")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "valid" ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/40" : "text-zinc-400 hover:text-white"
            }`}
          >
            Valid Only ({validCards})
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "pending" ? "bg-zinc-800 text-zinc-200" : "text-zinc-400 hover:text-white"
            }`}
          >
            Pending Scan ({pendingCards})
          </button>
        </div>
      </div>

      {/* ── CARD INVENTORY DIRECTORY TABLE ──────────────────────────────────── */}
      <div className="rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#242429] flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search card ID, name, mobile number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#101013] border-[#2B2B32] text-zinc-200 placeholder:text-zinc-500 rounded-2xl text-xs h-9"
            />
          </div>

          <div className="text-xs text-zinc-400 whitespace-nowrap">
            Showing <strong className="text-white">{filteredCards.length}</strong> cards
          </div>
        </div>

        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="sticky top-0 bg-[#101013]/95 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242429] z-10">
              <tr>
                <th className="px-5 py-3.5 whitespace-nowrap">Card ID Number</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Role Category</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Card Validity</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Assigned Attendee</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Phone Number</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Organization / Stall</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202026]">
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td colSpan={7} className="p-4">
                      <Skeleton className="h-8 bg-[#1B1B20] rounded-xl w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredCards.length > 0 ? (
                filteredCards.map((item) => (
                  <tr key={item.id} className="hover:bg-[#1A1A1F]/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-white whitespace-nowrap">
                      {item.registrationNumber}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#202028] text-zinc-200 border border-[#2E2E38] inline-flex items-center gap-1">
                        {item.delegateType === "team_sankara"
                          ? "Team Sankara"
                          : item.delegateType === "vendor"
                          ? "Vendor Partner"
                          : item.delegateType === "exhibitor"
                          ? "Exhibitor / Stall"
                          : item.delegateType === "guest"
                          ? "Guest / VIP"
                          : "Delegate"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {item.isOnSpotLinked ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Valid &amp; Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-zinc-500" /> Not Valid (Pending Scan)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {item.isOnSpotLinked ? (
                        <span className="font-bold text-white text-sm">{item.name}</span>
                      ) : (
                        <span className="text-zinc-500 italic">Unassigned Card</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-zinc-300">
                      {item.isOnSpotLinked && item.mobile && !item.mobile.startsWith("OS")
                        ? `+91 ${item.mobile}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-300 whitespace-nowrap">
                      {item.isOnSpotLinked && item.institution !== "Unassigned Physical Card"
                        ? item.institution
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View 3D QR Card"
                          onClick={() =>
                            setQrParticipant({
                              id: item.id,
                              name: item.isOnSpotLinked ? item.name : "Unassigned Card",
                              registrationNumber: item.registrationNumber,
                            })
                          }
                          className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-zinc-400 hover:text-white"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          title="Print ID Card (ID + QR only)"
                          onClick={() => setPrintCard(item)}
                          className="h-8 w-8 p-0 rounded-xl hover:bg-[#25252E] text-zinc-400 hover:text-white"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-zinc-500">
                    <Users className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    <p className="font-semibold text-sm">No cards found matching current filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── GENERATE CARD NUMBERS MODAL ─────────────────────────────────────── */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">Generate Numbered Cards</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Creates physical cards with Card ID &amp; QR Code (No person name on card). Cards become valid once scanned and assigned with Phone &amp; Name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Mode selection: Single Number vs Range */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#101013] border border-[#26262B] rounded-2xl text-center">
              <button
                type="button"
                onClick={() => setGenMode("single")}
                className={`py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  genMode === "single" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
                }`}
              >
                Single Card #
              </button>
              <button
                type="button"
                onClick={() => setGenMode("range")}
                className={`py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  genMode === "range" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
                }`}
              >
                Number Range
              </button>
              <button
                type="button"
                onClick={() => setGenMode("count")}
                className={`py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  genMode === "count" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
                }`}
              >
                Next Batch
              </button>
            </div>

            {genMode === "single" && (
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Card Number</Label>
                <Input
                  placeholder="e.g. 101 or 1005"
                  value={singleCardNumber}
                  onChange={(e) => setSingleCardNumber(e.target.value)}
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-2xl h-10 text-xs font-mono"
                />
              </div>
            )}

            {genMode === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 font-bold">Start Card #</Label>
                  <Input
                    placeholder="e.g. 1001"
                    value={startCardNumber}
                    onChange={(e) => setStartCardNumber(e.target.value)}
                    className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-2xl h-10 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 font-bold">End Card #</Label>
                  <Input
                    placeholder="e.g. 1050"
                    value={endCardNumber}
                    onChange={(e) => setEndCardNumber(e.target.value)}
                    className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-2xl h-10 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {genMode === "count" && (
              <div className="space-y-1.5">
                <Label className="text-zinc-300 font-bold">Number of Next Sequential Cards</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Number(e.target.value))}
                  className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-2xl h-10 text-xs font-mono"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-zinc-300 font-bold">Default Role Category</Label>
              <Select value={generateRole} onValueChange={setGenerateRole}>
                <SelectTrigger className="bg-[#101013] border-[#2B2B32] text-zinc-200 rounded-2xl h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-[#242429]">
            <Button
              variant="outline"
              onClick={() => setGenerateOpen(false)}
              className="rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateCards}
              disabled={generating}
              className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs border-none"
            >
              {generating ? "Creating..." : "Create Card Numbers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── PRINT BADGE PREVIEW MODAL (STRICTLY ID + QR) ─────────────────────── */}
      <Dialog open={!!printCard} onOpenChange={() => setPrintCard(null)}>
        <DialogContent className="max-w-sm bg-[#141417] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white text-center">Physical Badge Preview</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 text-center">
              Pre-printed badge card with Card ID and QR code only (No person name on card).
            </DialogDescription>
          </DialogHeader>

          {printCard && (
            <div className="p-6 rounded-3xl bg-[#0C0C0E] border-2 border-white/20 text-center space-y-4 shadow-2xl">
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  {activeEvent?.title || "Sankara Medical Conference"}
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-zinc-950 uppercase tracking-widest mt-1.5 inline-block">
                  {printCard.delegateType?.replace("_", " ")}
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-md">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    `${window.location.origin}/q/${printCard.registrationNumber}`
                  )}`}
                  alt="Badge QR"
                  className="w-40 h-40"
                />
              </div>

              <div className="space-y-0.5">
                <div className="font-mono text-xl font-black text-white tracking-wider">
                  {printCard.registrationNumber}
                </div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-widest">
                  Scan at Entry &amp; Food Desks
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setPrintCard(null)}
              className="w-full rounded-xl border-[#2B2B32] bg-[#18181C] text-zinc-300 text-xs"
            >
              Close
            </Button>
            <Button
              onClick={() => window.print()}
              className="w-full rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs border-none"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── QR DIALOG ───────────────────────────────────────────────────────── */}
      {qrParticipant && (
        <ParticipantQRDialog
          open={!!qrParticipant}
          onOpenChange={() => setQrParticipant(null)}
          participant={qrParticipant}
        />
      )}
    </div>
  );
}
