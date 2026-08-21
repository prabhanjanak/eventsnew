/**
 * Smart QR Landing Page — /q/:regNumber
 *
 * Modern Lu.ma Dark Glassmorphic Design with GlitterWrap Cosmic Particle Tunnel
 * 100% Mobile Responsive & Dynamic Multi-Event Aware
 */

import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useListFoodSessions } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  CheckSquare,
  Gift,
  Utensils,
  CalendarDays,
  User,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Shield,
  Check,
  Share2,
  Copy,
  ExternalLink,
  MapPin,
  Sparkles,
  Ticket,
  Clock,
  ChevronRight,
  QrCode,
} from "lucide-react";
import { getCache, setCache } from "@/lib/indexeddb-cache";
import { OtpInput } from "@/components/ui/otp-input";
import GlitterWrap from "@/components/originkit/ui/glitter-wrap";
import QRCode from "qrcode";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Participant = {
  id: number;
  eventId?: number;
  name: string;
  registrationNumber: string;
  qrToken?: string;
  institution: string;
  designation?: string;
  isFaculty: boolean;
  isOnSpot?: boolean;
  isOnSpotLinked?: boolean;
  isOnSpotOnboarded?: boolean;
  mobile?: string;
  email?: string;
  delegateType?: string;
  event?: {
    id: number;
    title: string;
    slug: string;
    startDate: string;
    endDate: string;
    venue: string;
    city: string;
    agendaPdfUrl?: string | null;
    agendaPdfButtonText?: string | null;
    customPdfUrl?: string | null;
    customPdfButtonText?: string | null;
    bannerUrl?: string | null;
  } | null;
  foodSessions?: Array<{
    id: number;
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    enabled: boolean;
    isRedeemed: boolean;
    collectedAt?: string | null;
  }>;
};

type StaffUser = {
  id: number;
  name: string;
  userType: string;
  permissions: string[];
};

type ActionState = {
  loading: boolean;
  success: boolean;
  error: string | null;
  message: string | null;
  alreadyDone: boolean;
};

const freshAction = (): ActionState => ({
  loading: false,
  success: false,
  error: null,
  message: null,
  alreadyDone: false,
});

export default function SmartQRLanding() {
  const params = useParams<{ regNumber: string }>();
  const regNumber = params.regNumber?.toUpperCase() ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [pLoading, setPLoading] = useState(true);
  const [pError, setPError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [currentParticipantUser, setCurrentParticipantUser] = useState<any>(null);
  const [emailInput, setEmailInput] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Quick OTP login states
  const [quickOtpStep, setQuickOtpStep] = useState<"email" | "otp">("email");
  const [quickOtpValue, setQuickOtpValue] = useState("");
  const [quickParticipantInfo, setQuickParticipantInfo] = useState<{ id: number; name: string } | null>(null);
  const [quickOtpSentMessage, setQuickOtpSentMessage] = useState("");

  // Staff States
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [staffChecked, setStaffChecked] = useState(false);
  const [selectedFoodSession, setSelectedFoodSession] = useState<string>("");
  const [attendanceState, setAttendanceState] = useState<ActionState>(freshAction());
  const [goodiesState, setGoodiesState] = useState<ActionState>(freshAction());
  const [foodState, setFoodState] = useState<ActionState>(freshAction());

  // On-Spot Onboarding States
  const [obName, setObName] = useState(() => localStorage.getItem("ob_name") || "");
  const [obEmail, setObEmail] = useState(() => localStorage.getItem("ob_email") || "");
  const [obMobile, setObMobile] = useState(() => localStorage.getItem("ob_mobile") || "");
  const [obAge, setObAge] = useState(() => localStorage.getItem("ob_age") || "");
  const [obGender, setObGender] = useState(() => localStorage.getItem("ob_gender") || "Male");
  const [obInstitution, setObInstitution] = useState(() => localStorage.getItem("ob_institution") || "");
  const [obAddress, setObAddress] = useState(() => localStorage.getItem("ob_address") || "");
  const [obSubmitting, setObSubmitting] = useState(false);
  const [obError, setObError] = useState<string | null>(null);

  // Active sync session
  const { data: activeSession } = useQuery({
    queryKey: ["/api/sync-sessions/active"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/sync-sessions/active`);
      if (r.ok) return r.json();
      return null;
    },
  });

  // Food sessions for staff
  const { data: foodSessions } = useListFoodSessions({
    query: {
      enabled: !!staffUser && (staffUser.userType === "admin" || staffUser.permissions.includes("food")),
    } as any,
  });
  const activeSessions = foodSessions?.filter((s) => s.enabled) ?? [];

  useEffect(() => {
    if (activeSessions.length > 0 && !selectedFoodSession) {
      setSelectedFoodSession(String(activeSessions[0].id));
    }
  }, [activeSessions.length]);

  // Load participant info
  useEffect(() => {
    if (!regNumber) return;

    if (regNumber.startsWith("STAFF-")) {
      setPLoading(false);
      setParticipant(null);
      return;
    }

    async function fetchParticipant() {
      setPLoading(true);
      setPError(null);
      try {
        const cacheKey = `lookup_${regNumber}`;
        let data = await getCache<Participant>(cacheKey);

        if (!data) {
          const r = await fetch(`${BASE_URL}/api/participants/public-lookup/${regNumber}`);
          if (!r.ok) {
            const e = await r.json();
            throw new Error(e.error ?? "Participant pass not found");
          }
          data = await r.json();
          if (data) {
            await setCache(cacheKey, data, 10 * 60 * 1000);
          }
        }

        if (data) {
          setParticipant(data);
          if (data.isOnSpot && !data.isOnSpotOnboarded) {
            const cleanedMobile = data.mobile && !data.mobile.startsWith("OS") ? data.mobile : "";
            setObMobile((prev) => prev || cleanedMobile);
          }
        }
      } catch (e: any) {
        setPError(e.message);
      } finally {
        setPLoading(false);
      }
    }
    fetchParticipant();
  }, [regNumber]);

  // Check logged-in user
  useEffect(() => {
    const token = localStorage.getItem("vision2020_token");
    if (!token) {
      setStaffChecked(true);
      return;
    }
    fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          if (u.userType !== "participant") {
            setStaffUser(u);
          } else if (participant && u.participantId === participant.id) {
            setCurrentParticipantUser(u);
          }
        }
      })
      .catch(() => null)
      .finally(() => setStaffChecked(true));
  }, [participant]);

  // Copy registration number
  const handleCopyCode = () => {
    if (!participant) return;
    navigator.clipboard.writeText(participant.registrationNumber);
    setCopied(true);
    toast({ title: "Registration ID Copied", description: participant.registrationNumber });
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate Scannable QR Pass
  useEffect(() => {
    if (!participant?.registrationNumber) return;
    const tokenCode = participant.qrToken || participant.registrationNumber;
    const url = `${window.location.origin}/q/${tokenCode}`;
    QRCode.toDataURL(url, {
      width: 340,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then(setQrDataUrl)
      .catch(() => null);
  }, [participant?.registrationNumber, participant?.qrToken]);

  // Staff Quick Action Handler
  async function doAction(action: "attendance" | "goodies" | "food") {
    const setState = action === "attendance" ? setAttendanceState : action === "goodies" ? setGoodiesState : setFoodState;
    setState({ loading: true, success: false, error: null, message: null, alreadyDone: false });

    const token = localStorage.getItem("vision2020_token");
    const body: Record<string, unknown> = { registrationNumber: regNumber, action };
    if (action === "food") body.foodSessionId = Number(selectedFoodSession);

    try {
      const r = await fetch(`${BASE_URL}/api/scan/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as { success: boolean; message?: string; status?: string; collectedAt?: string };
      if (!r.ok) throw new Error((data as { error?: string }).error ?? "Action failed");
      setState({
        loading: false,
        success: data.success,
        error: data.success ? null : data.message ?? "Action failed",
        message: data.message ?? null,
        alreadyDone: data.status === "already_collected" || data.status === "already_marked",
      });
    } catch (e: unknown) {
      setState({
        loading: false,
        success: false,
        error: e instanceof Error ? e.message : "Error",
        message: null,
        alreadyDone: false,
      });
    }
  }

  const hasPerm = (perm: string) => {
    if (!staffUser) return false;
    if (staffUser.userType === "admin" || staffUser.userType === "super_admin") return true;
    return staffUser.permissions?.includes(perm) || false;
  };

  const canAttendance = hasPerm("attendance");
  const canGoodies = hasPerm("goodies");
  const canFood = hasPerm("food");
  const hasAnyPermission = canAttendance || canGoodies || canFood;

  // On-Spot Direct Onboarding
  const handleDirectOnboardOnSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obName.trim() || !obEmail.trim() || !obMobile.trim() || !obAge.trim() || !obGender || !obInstitution.trim()) {
      setObError("Please fill out all required fields.");
      return;
    }
    const cleanEmail = obEmail.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      setObError("Please enter a valid email address.");
      return;
    }
    const cleanMobile = obMobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length !== 10) {
      setObError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setObSubmitting(true);
    setObError(null);

    try {
      const onboardRes = await fetch(`${BASE_URL}/api/onspot/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: regNumber,
          name: obName.trim(),
          age: obAge.trim(),
          gender: obGender,
          institution: obInstitution.trim(),
          address: obAddress.trim(),
          mobile: cleanMobile,
          email: cleanEmail,
        }),
      });

      const onboardData = await onboardRes.json();
      if (!onboardRes.ok) {
        throw new Error(onboardData.error || "Onboarding failed");
      }

      localStorage.setItem("vision2020_token", onboardData.token);

      setParticipant((prev) =>
        prev
          ? {
              ...prev,
              name: obName.trim(),
              mobile: cleanMobile,
              email: cleanEmail,
              institution: obInstitution.trim(),
              isOnSpotOnboarded: true,
            }
          : null
      );

      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile Activated ✓", description: "Your digital pass is now active." });
    } catch (err: any) {
      setObError(err.message || "Failed to activate profile");
    } finally {
      setObSubmitting(false);
    }
  };

  const handleQuickEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participant) return;
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid Email ID.", variant: "destructive" });
      return;
    }

    setLoggingIn(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/auth/quick-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: participant.registrationNumber,
          email,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        toast({
          title: "Access Failed",
          description: data.error || "Please verify your email address.",
          variant: "destructive",
        });
        return;
      }

      localStorage.setItem("vision2020_token", data.token);
      toast({ title: `Welcome, ${data.user?.name || "Delegate"}!` });
      setLocation("/participant/dashboard");
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  const handleQuickOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickParticipantInfo || !quickOtpValue.trim()) return;

    setLoggingIn(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/auth/participant/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: quickParticipantInfo.id,
          otp: quickOtpValue.trim(),
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        toast({
          title: "Verification failed",
          description: data.error || "Invalid or expired OTP.",
          variant: "destructive",
        });
        return;
      }

      localStorage.setItem("vision2020_token", data.token);
      toast({ title: `Welcome back, ${data.user?.name}!` });
      setLocation("/participant/dashboard");
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  // Badge category pill
  const getBadgeCategory = (p: Participant) => {
    if (p.isFaculty) return { label: "FACULTY PASS", style: "bg-purple-500/20 text-purple-300 border-purple-500/40" };
    const dt = p.delegateType?.toLowerCase();
    if (dt === "team_sankara") return { label: "TEAM SANKARA", style: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
    if (dt === "vendor") return { label: "VENDOR PASS", style: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
    if (dt === "exhibitor") return { label: "EXHIBITOR PASS", style: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" };
    if (dt === "guest") return { label: "VIP GUEST", style: "bg-rose-500/20 text-rose-300 border-rose-500/40" };
    return { label: "DELEGATE PASS", style: "bg-blue-500/20 text-blue-300 border-blue-500/40" };
  };

  return (
    <div className="relative min-h-screen bg-[#07070A] text-zinc-100 flex flex-col font-sans overflow-x-hidden selection:bg-white/20 selection:text-white">
      {/* ── Originkit GlitterWrap Cosmic Particle Tunnel ─────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <GlitterWrap
          particleCount={450}
          color1="#ffffff"
          color2="#38BDF8"
          color3="#818CF8"
          speed={4.5}
          density={80}
          starSize={16}
          focalDepth={12}
          glitterIntensity={2.5}
          trailAmount={90}
          brightness={90}
        />
      </div>

      {/* ── Atmospheric Shadow Overlay ─────────────────────────────────────── */}
      <div className="fixed inset-0 bg-black/50 pointer-events-none z-0" />

      {/* ── Top Header Navigation ──────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-[#0E0E14]/85 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400 group-hover:-translate-x-1 transition-transform" />
            <span>Sankara Events Portal</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-black text-emerald-400 tracking-wider uppercase font-mono">
              Live Scanner
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Container ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-6 sm:py-8 space-y-5 relative z-10">
        {/* Loading State */}
        {pLoading && (
          <div className="p-8 rounded-3xl bg-[#121216]/90 backdrop-blur-2xl border border-white/10 text-center space-y-3 shadow-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
            <p className="text-sm font-bold text-white">Validating Pass Identification...</p>
            <p className="text-xs text-zinc-400">Connecting to Sankara Verification Cloud</p>
          </div>
        )}

        {/* Error / Not Found State */}
        {!pLoading && pError && (
          <div className="p-6 rounded-3xl bg-red-950/40 border border-red-800/60 backdrop-blur-2xl text-center space-y-3 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Participant Record Not Found</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No registered attendee matches ID <strong className="text-white font-mono">{regNumber}</strong>. Please check your QR code or visit the registration desk.
            </p>
            <Button
              variant="outline"
              onClick={() => setLocation("/events")}
              className="h-10 text-xs border-white/15 bg-white/5 hover:bg-white/10 text-white rounded-xl"
            >
              Browse Event Directory
            </Button>
          </div>
        )}

        {/* Staff Card Scan Landing (e.g. STAFF-010177) */}
        {!pLoading && regNumber.startsWith("STAFF-") && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#121216]/90 backdrop-blur-2xl border border-purple-500/30 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/40 mx-auto flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black uppercase tracking-wider">
                Staff Identity Badge
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white mt-2">Sankara Staff &amp; Coordinator Portal</h2>
              <p className="text-xs text-zinc-400 mt-1 font-mono">{regNumber}</p>
            </div>
            <div className="pt-2">
              <Button
                onClick={() => setLocation("/login")}
                className="w-full h-11 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-purple-900/40 cursor-pointer"
              >
                Log In to Coordinator Hub →
              </Button>
            </div>
          </div>
        )}

        {/* Unassigned Physical Card (Pending On-Spot Link) */}
        {!pLoading && participant && participant.isOnSpot && !participant.isOnSpotLinked && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#121216]/90 backdrop-blur-2xl border border-amber-500/40 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Card Pending Assignment
              </span>
              <h2 className="text-base sm:text-lg font-black text-white mt-2">Unassigned On-Spot Physical Badge</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Badge ID <strong className="text-white font-mono">{participant.registrationNumber}</strong> has not yet been linked to an attendee.
              </p>
            </div>
            <div className="p-4 bg-[#0A0A0E] rounded-2xl border border-white/10 text-xs text-left space-y-2">
              <p className="text-zinc-200 font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" /> How to activate:
              </p>
              <p className="text-zinc-400 leading-relaxed text-[11px]">
                Please present this badge at the <strong>On-Spot Registration Desk</strong>. The event coordinator will scan it to assign your Name, Organization, and Admission Pass.
              </p>
            </div>
          </div>
        )}

        {/* Linked but Un-onboarded On-Spot Profile Form */}
        {!pLoading && participant && participant.isOnSpot && !participant.isOnSpotOnboarded && (
          <div className="p-6 sm:p-7 rounded-3xl bg-[#121216]/95 backdrop-blur-2xl border border-cyan-500/40 space-y-5 shadow-2xl">
            <div className="text-center space-y-1.5 pb-2 border-b border-white/10">
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider">
                Instant Badge Activation
              </span>
              <h2 className="text-base sm:text-lg font-black text-white">Activate Your Digital Profile</h2>
              <p className="text-xs text-zinc-400">
                Badge ID: <strong className="text-cyan-400 font-mono">{participant.registrationNumber}</strong>
              </p>
            </div>

            <form onSubmit={handleDirectOnboardOnSpot} className="space-y-3.5">
              {obError && (
                <div className="p-3 bg-red-950/50 border border-red-800/60 text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{obError}</span>
                </div>
              )}

              <div>
                <Label className="text-xs font-bold text-zinc-300 block mb-1">Mobile Number (10 Digits) *</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold select-none">+91</span>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={obMobile}
                    onChange={(e) => setObMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                    className="w-full h-10.5 pl-11 pr-3 rounded-xl bg-[#09090D] border border-white/15 text-white placeholder:text-zinc-600 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-300 block mb-1">Full Name *</Label>
                <input
                  type="text"
                  required
                  placeholder="Dr. / Mr. / Ms. Full Name"
                  value={obName}
                  onChange={(e) => setObName(e.target.value)}
                  className="w-full h-10.5 px-3.5 rounded-xl bg-[#09090D] border border-white/15 text-white placeholder:text-zinc-600 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-300 block mb-1">Email ID *</Label>
                <input
                  type="email"
                  required
                  placeholder="doctor@hospital.org"
                  value={obEmail}
                  onChange={(e) => setObEmail(e.target.value)}
                  className="w-full h-10.5 px-3.5 rounded-xl bg-[#09090D] border border-white/15 text-white placeholder:text-zinc-600 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-zinc-300 block mb-1">Age *</Label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    placeholder="32"
                    value={obAge}
                    onChange={(e) => setObAge(e.target.value)}
                    className="w-full h-10.5 px-3.5 rounded-xl bg-[#09090D] border border-white/15 text-white placeholder:text-zinc-600 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-zinc-300 block mb-1">Gender *</Label>
                  <Select value={obGender} onValueChange={setObGender}>
                    <SelectTrigger className="h-10.5 rounded-xl bg-[#09090D] border border-white/15 text-white text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121216] border-white/15 text-white">
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-300 block mb-1">Hospital / Medical College *</Label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sankara Eye Hospital, Coimbatore"
                  value={obInstitution}
                  onChange={(e) => setObInstitution(e.target.value)}
                  className="w-full h-10.5 px-3.5 rounded-xl bg-[#09090D] border border-white/15 text-white placeholder:text-zinc-600 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-300 block mb-1">City / Address (Optional)</Label>
                <input
                  type="text"
                  placeholder="e.g. Coimbatore, Tamil Nadu"
                  value={obAddress}
                  onChange={(e) => setObAddress(e.target.value)}
                  className="w-full h-10.5 px-3.5 rounded-xl bg-[#09090D] border border-white/15 text-white placeholder:text-zinc-600 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Consent for communication */}
              <div className="pt-1 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="ob-consent"
                  required
                  defaultChecked={true}
                  className="w-4 h-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-0 mt-0.5 cursor-pointer"
                />
                <Label htmlFor="ob-consent" className="text-[11px] text-zinc-400 font-normal leading-tight cursor-pointer">
                  I consent to Sankara Eye Foundation India collecting my email ID and contact details for official event updates, certificates, and future CME communications.
                </Label>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={obSubmitting}
                  className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-cyan-900/40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {obSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{obSubmitting ? "Activating Pass..." : "Activate Pass & Unlock Agenda"}</span>
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── 1. VERIFIED DIGITAL DELEGATE PASS (Regular Active Attendee) ───── */}
        {!pLoading && participant && (!participant.isOnSpot || participant.isOnSpotOnboarded) && (
          <div className="space-y-5">
            {/* Holographic Header Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#181822] via-[#121218] to-[#0A0A0F] border border-white/15 p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(56,189,248,0.15)] space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-black/80 border border-white/20 flex items-center justify-center p-2 shadow-inner">
                    <img src="/sankara-eye-logo.png" alt="Sankara Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white tracking-tight">Sankara Eye Foundation</h4>
                    <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>VERIFIED ADMISSION PASS</span>
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase font-mono ${getBadgeCategory(participant).style}`}>
                  {getBadgeCategory(participant).label}
                </span>
              </div>

              {/* Attendee Details */}
              <div className="space-y-1.5">
                <div className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                  {participant.name}
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <span className="px-2.5 py-0.5 rounded-lg bg-black/60 border border-white/15 text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{participant.registrationNumber}</span>
                  </span>
                  <button
                    onClick={handleCopyCode}
                    title="Copy Registration Number"
                    className="p-1 rounded-md bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <p className="text-xs text-zinc-300 font-medium pt-1">
                  {participant.institution || "Medical Practitioner / Delegate"}
                </p>
              </div>

              {/* Show / Hide QR Code Toggle Button */}
              <div className="pt-1">
                <Button
                  type="button"
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="w-full h-11 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-400/50 text-cyan-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-950/40 active:scale-[0.98]"
                >
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  <span>{showQrCode ? "Hide Digital QR Pass ▲" : "Show My Digital QR Code for Scanning ▼"}</span>
                </Button>
              </div>

              {/* Dynamic Expandable QR Code Container */}
              {showQrCode && (
                <div className="p-5 rounded-2xl bg-white text-zinc-950 text-center space-y-3 shadow-2xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2 px-1">
                    <div className="text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 block">Sankara Official Pass</span>
                      <span className="text-xs font-black text-zinc-900">{participant.name}</span>
                    </div>
                    <Badge className="bg-zinc-900 text-white text-[10px] font-mono font-bold">
                      {participant.registrationNumber}
                    </Badge>
                  </div>

                  {qrDataUrl ? (
                    <div className="p-2.5 bg-white rounded-2xl inline-block shadow-inner mx-auto border border-zinc-200">
                      <img
                        src={qrDataUrl}
                        alt={`Digital Pass QR - ${participant.registrationNumber}`}
                        className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center mx-auto">
                      <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
                    </div>
                  )}

                  <p className="text-[11px] font-semibold text-zinc-600 max-w-xs mx-auto leading-tight">
                    Present this digital QR pass at hall check-ins, attendance counters, and dining sessions.
                  </p>
                </div>
              )}

              {/* Event Context Pill */}
              <div className="p-3.5 rounded-2xl bg-[#09090D]/90 border border-white/10 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-white truncate">
                    {participant.event?.title || "National Ophthalmology Conference 2026"}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 text-cyan-400" />
                      <span>{participant.event?.startDate || "2026-07-10"}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-rose-400" />
                      <span>{participant.event?.venue || "Coimbatore Auditorium"}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 2. STAFF SCANNING ACTION CARD (If logged in as Staff) ────── */}
            {staffChecked && staffUser && hasAnyPermission && (
              <div className="p-5 sm:p-6 rounded-3xl bg-[#14141D] border border-cyan-500/40 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-white">Staff Terminal: {staffUser.name}</span>
                  </div>
                  <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px]">
                    {staffUser.userType.toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {canAttendance && (
                    <ActionButton
                      icon={CheckSquare}
                      label="Mark Registration & Attendance"
                      state={attendanceState}
                      color="green"
                      onAction={() => doAction("attendance")}
                      onReset={() => setAttendanceState(freshAction())}
                    />
                  )}

                  {canGoodies && (
                    <ActionButton
                      icon={Gift}
                      label="Mark Goodies / Delegate Kit Handover"
                      state={goodiesState}
                      color="purple"
                      onAction={() => doAction("goodies")}
                      onReset={() => setGoodiesState(freshAction())}
                    />
                  )}

                  {canFood && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide block">Food Coupon Verification</span>
                      {activeSessions.length === 0 ? (
                        <div className="text-xs text-zinc-500 italic">No active food sessions enabled.</div>
                      ) : (
                        <>
                          {activeSessions.length > 1 && (
                            <Select value={selectedFoodSession} onValueChange={setSelectedFoodSession}>
                              <SelectTrigger className="h-9 text-xs bg-[#09090D] border-white/15 text-white">
                                <SelectValue placeholder="Select Food Session" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#121216] border-white/15 text-white">
                                {activeSessions.map((s) => (
                                  <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                                    {s.name} ({s.date})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {activeSessions.length === 1 && (
                            <div className="text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 rounded-xl p-2 font-medium">
                              Active: {activeSessions[0].name} ({activeSessions[0].startTime} - {activeSessions[0].endTime})
                            </div>
                          )}
                          <ActionButton
                            icon={Utensils}
                            label="Redeem Meal Coupon"
                            state={foodState}
                            color="cyan"
                            onAction={() => doAction("food")}
                            onReset={() => setFoodState(freshAction())}
                            disabled={!selectedFoodSession}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 3. LIVE MEAL & DINING STATUS ─────────────────────────────── */}
            {participant.foodSessions && participant.foodSessions.length > 0 && (
              <div className="p-5 sm:p-6 rounded-3xl bg-[#121218]/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                      <Utensils className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Conference Catering &amp; Meal Coupons</h4>
                      <p className="text-[10px] text-zinc-400">100% Pure Vegetarian Culinary Hospitality</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-cyan-300">
                    {participant.foodSessions.filter((s) => s.isRedeemed).length} / {participant.foodSessions.length} Redeemed
                  </span>
                </div>

                <div className="space-y-2">
                  {participant.foodSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-3.5 rounded-2xl bg-[#09090D] border border-white/10 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-white block truncate">{session.name}</span>
                        <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{session.date} • {session.startTime} - {session.endTime}</span>
                        </span>
                      </div>

                      {session.isRedeemed ? (
                        <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3" /> Redeemed
                        </span>
                      ) : session.enabled ? (
                        <span className="px-3 py-1 rounded-xl bg-cyan-500 text-zinc-950 font-bold text-[10px] shadow-sm shrink-0">
                          Ready to Scan
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-xl bg-white/5 text-zinc-500 border border-white/10 text-[10px] font-medium shrink-0">
                          Upcoming
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 4. EVENT AGENDA & ACADEMIC DOCUMENTS ─────────────────────── */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#121218]/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-3.5">
              <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                    <CalendarDays className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Event Documents &amp; Timetable</h4>
                    <p className="text-[10px] text-zinc-400">Scientific sessions, tracks, and official brochures</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {/* Official Agenda PDF */}
                {participant.event?.agendaPdfUrl && (
                  <a
                    href={participant.event.agendaPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-[#09090D] hover:bg-[#14141C] border border-white/10 hover:border-cyan-500/40 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                          {participant.event.agendaPdfButtonText || "Download Scientific Agenda (PDF)"}
                        </div>
                        <div className="text-[10px] text-zinc-400">Official conference schedule &amp; guidelines</div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 shrink-0" />
                  </a>
                )}

                {/* Secondary Custom Document (if any) */}
                {participant.event?.customPdfUrl && (
                  <a
                    href={participant.event.customPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-[#09090D] hover:bg-[#14141C] border border-white/10 hover:border-purple-500/40 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-purple-300 truncate">
                          {participant.event.customPdfButtonText || "View Event Document (PDF)"}
                        </div>
                        <div className="text-[10px] text-zinc-400">Floor map, stalls, and speaker guidelines</div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 shrink-0" />
                  </a>
                )}

                {/* Interactive Tracks & Sessions */}
                <Link
                  href={`/agenda/${participant.registrationNumber}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-[#09090D] hover:bg-[#14141C] border border-white/10 hover:border-indigo-500/40 transition-all group cursor-pointer block"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                        Interactive Tracks &amp; Sessions
                      </div>
                      <div className="text-[10px] text-zinc-400">Explore hall sessions, timings, and scientific topics</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400 shrink-0" />
                </Link>
              </div>

              {/* Log in to Your Dashboard Link */}
              <div className="pt-3 border-t border-white/10">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/login")}
                  className="w-full h-11 border-white/15 bg-white/5 hover:bg-white/10 text-zinc-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <User className="w-4 h-4 text-cyan-400" />
                  <span>Log in to Your Dashboard →</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center pt-4 pb-8 space-y-2">
          <Link href="/login">
            <span className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 cursor-pointer transition-colors">
              <Shield className="w-3.5 h-3.5" /> Staff &amp; Coordinator Access
            </span>
          </Link>
          <p className="text-[10px] text-zinc-600">
            © {new Date().getFullYear()} Sankara Eye Foundation India • Verified Admission Engine
          </p>
        </div>
      </main>
    </div>
  );
}

// ── Reusable Action Button Component ─────────────────────────────────────────
const COLOR_MAP = {
  green: {
    btn: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50",
    success: "bg-emerald-950/60 border-emerald-800/60 text-emerald-300",
    warn: "bg-amber-950/60 border-amber-800/60 text-amber-300",
    icon: "text-emerald-400",
  },
  purple: {
    btn: "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/50",
    success: "bg-purple-950/60 border-purple-800/60 text-purple-300",
    warn: "bg-amber-950/60 border-amber-800/60 text-amber-300",
    icon: "text-purple-400",
  },
  cyan: {
    btn: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/50",
    success: "bg-cyan-950/60 border-cyan-800/60 text-cyan-300",
    warn: "bg-amber-950/60 border-amber-800/60 text-amber-300",
    icon: "text-cyan-400",
  },
};

function ActionButton({
  icon: Icon,
  label,
  state,
  color,
  onAction,
  onReset,
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  state: ActionState;
  color: keyof typeof COLOR_MAP;
  onAction: () => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const c = COLOR_MAP[color];

  if (state.success) {
    return (
      <div className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 ${c.success}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 className={`w-4.5 h-4.5 shrink-0 ${c.icon}`} />
          <span className="text-xs font-bold truncate">{state.message}</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs opacity-60 hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!state.success && state.error) {
    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 ${
          state.alreadyDone ? c.warn : "bg-red-950/60 border-red-800/60 text-red-300"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {state.alreadyDone ? (
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-amber-400" />
          ) : (
            <XCircle className="w-4.5 h-4.5 shrink-0 text-red-400" />
          )}
          <span className="text-xs font-medium truncate">{state.error}</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs opacity-60 hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Button
      className={`w-full justify-start gap-3 h-11 text-xs font-bold rounded-2xl shadow-lg cursor-pointer transition-all ${c.btn}`}
      onClick={onAction}
      disabled={state.loading || disabled}
    >
      {state.loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Icon className="w-4 h-4 shrink-0" />}
      <span>{state.loading ? "Processing Scan..." : label}</span>
    </Button>
  );
}
