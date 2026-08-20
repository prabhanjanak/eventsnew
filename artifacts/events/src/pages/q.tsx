/**
 * Smart QR Landing Page — /q/:regNumber
 *
 * Behaviour:
 *  • Anyone can open this URL (no login required).
 *  • If the viewer is NOT logged in (or is a participant):
 *      → Show the attendee agenda panel:
 *            - "General Conference Agenda" → opens the official PDF
 *            - "My Personal Schedule" → opens /agenda/:regNumber
 *  • If the viewer IS logged in as staff (admin / coordinator / etc.):
 *      → Show the staff action panel with action buttons based on their permissions:
 *            - "Mark Attendance" + "Goodies / Reg Kit"  (if has attendance/goodies permission)
 *            - "Food Coupon"  (if has food permission)
 *      → Also show the agenda panel below (always visible)
 */

import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useListFoodSessions } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  CheckSquare, Gift, Utensils, CalendarDays, User,
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, XCircle, RefreshCw, Shield, Mail, Phone, Check,
} from "lucide-react";
import { getCache, setCache } from "@/lib/indexeddb-cache";
import { OtpInput } from "@/components/ui/otp-input";
import { ThreeAmbientScene } from "@/components/3d/three-ambient-scene";
import { PerspectiveCard } from "@/components/3d/perspective-card";
import { TactileButton } from "@/components/3d/tactile-button";
import { HolographicPassCard } from "@/components/3d/holographic-pass-card";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const AGENDA_PDF = "/brochurev2020";

type Participant = {
  id: number;
  name: string;
  registrationNumber: string;
  institution: string;
  isFaculty: boolean;
  isOnSpot?: boolean;
  isOnSpotLinked?: boolean;
  isOnSpotOnboarded?: boolean;
  mobile?: string;
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

const freshAction = (): ActionState => ({ loading: false, success: false, error: null, message: null, alreadyDone: false });

export default function SmartQRLanding() {
  const params = useParams<{ regNumber: string }>();
  const regNumber = params.regNumber?.toUpperCase() ?? "";
  const queryClient = useQueryClient();

  const { data: activeSession } = useQuery({
    queryKey: ["/api/sync-sessions/active"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/sync-sessions/active`);
      if (r.ok) {
        return r.json();
      }
      return null;
    }
  });

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [pLoading, setPLoading] = useState(true);
  const [pError, setPError] = useState<string | null>(null);

  const [currentParticipantUser, setCurrentParticipantUser] = useState<any>(null);
  const [emailInput, setEmailInput] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [, setLocation] = useLocation();

  // Quick OTP login states
  const [quickOtpStep, setQuickOtpStep] = useState<"email" | "otp">("email");
  const [quickOtpValue, setQuickOtpValue] = useState("");
  const [quickParticipantInfo, setQuickParticipantInfo] = useState<{ id: number; name: string } | null>(null);
  const [quickOtpSentMessage, setQuickOtpSentMessage] = useState("");

  useEffect(() => {
    if (!participant) return;
    const token = localStorage.getItem("vision2020_token");
    if (!token) return;
    fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((u) => {
        if (u && u.userType === "participant" && u.participantId === participant.id) {
          setCurrentParticipantUser(u);
        }
      })
      .catch(() => null);
  }, [participant]);

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
          title: "Failed to access",
          description: data.error || "Please check your entry and try again",
          variant: "destructive",
        });
        return;
      }

      localStorage.setItem("vision2020_token", data.token);
      toast({ title: `Welcome, ${data.user.name || "Delegate"}!` });
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
          description: data.error || "Invalid or expired OTP. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Store long-lived trusted browser token
      if (data.trustedToken) {
        localStorage.setItem(`vision2020_trusted_token_${emailInput.trim().toLowerCase()}`, data.trustedToken);
      }

      localStorage.setItem("vision2020_token", data.token);
      toast({ title: `Welcome back, ${data.user.name}!` });
      setLocation("/participant/dashboard");
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [staffChecked, setStaffChecked] = useState(false);

  const [selectedFoodSession, setSelectedFoodSession] = useState<string>("");
  const [attendanceState, setAttendanceState] = useState<ActionState>(freshAction());
  const [goodiesState, setGoodiesState] = useState<ActionState>(freshAction());
  const [foodState, setFoodState] = useState<ActionState>(freshAction());

  const { toast } = useToast();

  // On-Spot Onboarding States
  const [obName, setObName] = useState(() => localStorage.getItem("ob_name") || "");
  const [obEmail, setObEmail] = useState(() => localStorage.getItem("ob_email") || "");
  const [obMobile, setObMobile] = useState(() => localStorage.getItem("ob_mobile") || "");
  const [obAge, setObAge] = useState(() => localStorage.getItem("ob_age") || "");
  const [obGender, setObGender] = useState(() => localStorage.getItem("ob_gender") || "");
  const [obInstitution, setObInstitution] = useState(() => localStorage.getItem("ob_institution") || "");
  const [obAddress, setObAddress] = useState(() => localStorage.getItem("ob_address") || "");
  const [obSubmitting, setObSubmitting] = useState(false);
  const [obError, setObError] = useState<string | null>(null);

  // Sync state to localStorage to prevent data loss on mobile browser tab refreshes / app switching
  useEffect(() => {
    localStorage.setItem("ob_name", obName);
  }, [obName]);

  useEffect(() => {
    localStorage.setItem("ob_email", obEmail);
  }, [obEmail]);

  useEffect(() => {
    localStorage.setItem("ob_mobile", obMobile);
  }, [obMobile]);

  useEffect(() => {
    localStorage.setItem("ob_age", obAge);
  }, [obAge]);

  useEffect(() => {
    localStorage.setItem("ob_gender", obGender);
  }, [obGender]);

  useEffect(() => {
    localStorage.setItem("ob_institution", obInstitution);
  }, [obInstitution]);

  useEffect(() => {
    localStorage.setItem("ob_address", obAddress);
  }, [obAddress]);

  const handleDirectOnboardOnSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obName.trim() || !obEmail.trim() || !obMobile.trim() || !obAge.trim() || !obGender || !obInstitution.trim()) {
      setObError("Please fill out all required fields (Name, Email ID, Mobile Number, Age, Gender, Institution).");
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
      // Direct Onboarding API call without OTP check!
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

      // Store tokens
      localStorage.setItem("vision2020_token", onboardData.token);
      if (onboardData.trustedToken) {
        localStorage.setItem(`vision2020_trusted_token_${cleanEmail}`, onboardData.trustedToken);
      }

      // Clear local storage fields
      localStorage.removeItem("ob_name");
      localStorage.removeItem("ob_email");
      localStorage.removeItem("ob_mobile");
      localStorage.removeItem("ob_age");
      localStorage.removeItem("ob_gender");
      localStorage.removeItem("ob_institution");
      localStorage.removeItem("ob_address");

      // Update local cache
      try {
        const cacheKey = `lookup_${regNumber}`;
        const updatedParticipant = {
          ...participant!,
          name: obName.trim(),
          email: cleanEmail,
          mobile: cleanMobile,
          institution: obInstitution.trim(),
          isOnSpotOnboarded: true,
        };
        await setCache(cacheKey, updatedParticipant, 10 * 60 * 1000);
      } catch (cacheErr) {
        // Ignore cache write errors
      }

      setParticipant(prev => prev ? {
        ...prev,
        name: obName.trim(),
        mobile: cleanMobile,
        email: cleanEmail,
        institution: obInstitution.trim(),
        isOnSpotOnboarded: true,
      } : null);

      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile Activated ✓", description: "Your profile has been created successfully." });
    } catch (err: any) {
      setObError(err.message || "Failed to onboard profile");
    } finally {
      setObSubmitting(false);
    }
  };

  const { data: foodSessions } = useListFoodSessions({ query: { enabled: !!staffUser && (staffUser.userType === "admin" || staffUser.permissions.includes("food")) } as any });
  const activeSessions = foodSessions?.filter((s) => s.enabled) ?? [];

  // Auto-select first active food session
  useEffect(() => {
    if (activeSessions.length > 0 && !selectedFoodSession) {
      setSelectedFoodSession(String(activeSessions[0].id));
    }
  }, [activeSessions.length]);

  // Load participant info (public)
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
            throw new Error(e.error ?? "Not found");
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
            setObMobile(prev => prev || cleanedMobile);
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

  // Check if a staff user is logged in
  useEffect(() => {
    const token = localStorage.getItem("vision2020_token");
    if (!token) { setStaffChecked(true); return; }
    fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((u: StaffUser | null) => {
        if (u && u.userType !== "participant") setStaffUser(u);
      })
      .catch(() => null)
      .finally(() => setStaffChecked(true));
  }, []);

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
      const data = await r.json() as { success: boolean; message?: string; status?: string; collectedAt?: string };
      if (!r.ok) throw new Error((data as { error?: string }).error ?? "Failed");
      setState({
        loading: false,
        success: data.success,
        error: data.success ? null : (data.message ?? "Failed"),
        message: data.message ?? null,
        alreadyDone: data.status === "already_collected" || data.status === "already_marked",
      });
    } catch (e: unknown) {
      setState({ loading: false, success: false, error: e instanceof Error ? e.message : "Error", message: null, alreadyDone: false });
    }
  }

  const hasPerm = (perm: string) => {
    if (!staffUser) return false;
    if (staffUser.userType === "admin") return true;
    return staffUser.permissions.includes(perm);
  };

  const canAttendance = hasPerm("attendance");
  const canGoodies = hasPerm("goodies");
  const canFood = hasPerm("food");
  const hasAnyPermission = canAttendance || canGoodies || canFood;

  // 1. Unlinked on-spot card state
  if (participant && participant.isOnSpot && !participant.isOnSpotLinked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50 px-4 py-8 flex flex-col justify-center items-center">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 text-amber-600 shadow-md mb-2">
            <AlertCircle className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Unassigned ID Card</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            This ID card is unassigned. Please bring it to the registration desk to link it with a participant.
          </p>
          <div className="pt-4">
            <Link href="/login">
              <span className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 justify-center cursor-pointer">
                <ArrowLeft className="w-3 h-3" /> Staff login
              </span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Linked but un-onboarded on-spot card state (Onboarding profile form)
  if (participant && participant.isOnSpot && !participant.isOnSpotOnboarded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50 px-4 py-6">
        <div className="max-w-sm mx-auto space-y-4">
          {/* Header */}
          <div className="text-center pb-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F58220] to-[#e07010] shadow-lg mb-3">
              <span className="text-white font-black text-xl">V</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              {activeSession?.name ? `${activeSession.name} On-Spot` : "Vision 2020 On-Spot Registration"}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Please fill in your details to activate your conference ID at {activeSession?.locationName || "the venue"}.
            </p>
          </div>

          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-white/80 backdrop-blur-md">
            <div className="bg-gradient-to-r from-[#6F42C1] to-[#5a35a0] px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <User className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm leading-tight truncate">
                    Hello, {obName.trim() || participant.registrationNumber}
                  </div>
                  <div className="text-white/70 text-[10px] font-mono mt-0.5">On-Spot Profile Activation</div>
                </div>
              </div>
            </div>

            <CardContent className="p-5">
              <form onSubmit={handleDirectOnboardOnSpot} className="space-y-4">
                {obError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{obError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="ob-mobile" className="text-xs font-semibold text-gray-600">Mobile Number <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">+91</span>
                    <input
                      id="ob-mobile"
                      type="tel"
                      required
                      placeholder="10-digit number"
                      value={obMobile}
                      onChange={(e) => setObMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                      className="w-full h-10 pl-11 pr-3 border border-gray-200 focus:border-[#F58220] focus:ring-1 focus:ring-[#F58220] rounded-xl text-sm outline-none transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ob-name" className="text-xs font-semibold text-gray-600">Full Name <span className="text-red-500">*</span></Label>
                  <input
                    id="ob-name"
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={obName}
                    onChange={(e) => setObName(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-200 focus:border-[#F58220] focus:ring-1 focus:ring-[#F58220] rounded-xl text-sm outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ob-email" className="text-xs font-semibold text-gray-600">Email ID <span className="text-red-500">*</span></Label>
                  <input
                    id="ob-email"
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={obEmail}
                    onChange={(e) => setObEmail(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-200 focus:border-[#F58220] focus:ring-1 focus:ring-[#F58220] rounded-xl text-sm outline-none transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="ob-age" className="text-xs font-semibold text-gray-600">Age <span className="text-red-500">*</span></Label>
                    <input
                      id="ob-age"
                      type="number"
                      required
                      min={1}
                      max={120}
                      placeholder="Age"
                      value={obAge}
                      onChange={(e) => setObAge(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-200 focus:border-[#F58220] focus:ring-1 focus:ring-[#F58220] rounded-xl text-sm outline-none transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="ob-gender" className="text-xs font-semibold text-gray-600">Gender <span className="text-red-500">*</span></Label>
                    <Select value={obGender} onValueChange={setObGender}>
                      <SelectTrigger id="ob-gender" className="h-10 rounded-xl text-sm border-gray-200 font-medium">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ob-institution" className="text-xs font-semibold text-gray-600">Institution / Organization <span className="text-red-500">*</span></Label>
                  <input
                    id="ob-institution"
                    type="text"
                    required
                    placeholder="Hospital, College or Eye Bank name"
                    value={obInstitution}
                    onChange={(e) => setObInstitution(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-200 focus:border-[#F58220] focus:ring-1 focus:ring-[#F58220] rounded-xl text-sm outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ob-address" className="text-xs font-semibold text-gray-600">Address (Optional)</Label>
                  <textarea
                    id="ob-address"
                    rows={2}
                    placeholder="Enter your address"
                    value={obAddress}
                    onChange={(e) => setObAddress(e.target.value)}
                    className="w-full py-2 px-3 border border-gray-200 focus:border-[#F58220] focus:ring-1 focus:ring-[#F58220] rounded-xl text-sm outline-none transition-all resize-none font-medium"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={obSubmitting}
                    className="w-full bg-[#F58220] hover:bg-[#e07010] text-white font-bold h-11 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {obSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    {obSubmitting ? "Activating..." : "Activate Profile & Get Badge"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="text-center pt-2">
            <span className="text-[10px] text-gray-400 leading-normal block">
              Once submitted, details are finalized. Edits can only be performed by the backend administrator.
            </span>
            <div className="mt-4">
              <Link href="/login">
                <span className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 justify-center cursor-pointer">
                  <ArrowLeft className="w-3 h-3" /> Staff login
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-transparent text-zinc-100 flex flex-col items-center justify-center px-4 py-8 overflow-hidden font-sans selection:bg-zinc-800 selection:text-white">
      {/* 3D Interactive GPU-accelerated Particle Cosmos */}
      <ThreeAmbientScene particleCount={50} className="z-0 opacity-75" />

      <div className="max-w-sm w-full mx-auto space-y-5 relative z-10">
        {/* Header */}
        <div className="text-center pb-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white text-zinc-950 p-2 shadow-[0_10px_25px_rgba(255,255,255,0.15)] mb-3">
            <img src="/sankara-eye-logo.png" alt="Sankara Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-lg font-black text-white leading-tight">
            {(participant as any)?.event?.title || "Sankara Events Digital Badge"}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {(participant as any)?.event?.venue ? `${(participant as any).event.venue}, ${(participant as any).event.city}` : "Sankara Eye Care Institutions"}
          </p>
        </div>

        {/* Participant Holographic Card */}
        {pLoading ? (
          <div className="bg-[#141417] border border-[#2B2B32] rounded-3xl p-6 text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" />
            <span className="text-xs text-zinc-400 block">Loading verified delegate badge…</span>
          </div>
        ) : regNumber.startsWith("STAFF-") ? (
          <PerspectiveCard depth={10} className="bg-[#141417] border border-[#2B2B32] p-8 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 mx-auto bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Staff Command Portal</h2>
              <p className="text-xs text-zinc-400 mt-2">Welcome to the Sankara Events Coordinator Hub.</p>
            </div>
            
            <div className="pt-4 space-y-3">
              {!staffUser && (
                <TactileButton variant="primary" className="w-full" onClick={() => window.location.href = "/login"}>
                  Log in to Staff Dashboard
                </TactileButton>
              )}
              {staffUser && (
                <TactileButton variant="glow-blue" className="w-full" onClick={() => window.location.href = "/admin/dashboard"}>
                  Go to Admin Dashboard
                </TactileButton>
              )}
            </div>
          </PerspectiveCard>
        ) : pError ? (
          <div className="bg-red-950/40 border border-red-800/60 p-5 rounded-2xl flex items-center gap-3 text-red-400 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Participant record not found for this QR pass.</span>
          </div>
        ) : participant ? (
          participant.isOnSpot && !participant.isOnSpotLinked ? (
            <PerspectiveCard depth={12} className="bg-[#151518] border border-amber-500/30 p-6 rounded-3xl shadow-2xl space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Card Not Activated
                </span>
                <h2 className="text-base font-black text-white mt-2">Physical Badge Pending Registration</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Card ID <strong className="text-white font-mono">{participant.registrationNumber}</strong> has not yet been assigned to an attendee.
                </p>
              </div>
              <div className="p-3.5 bg-[#0E0E11] rounded-2xl border border-[#242429] text-xs text-zinc-400 text-left space-y-1.5">
                <div className="text-zinc-200 font-bold">To activate this pass:</div>
                <div className="text-[11px] text-zinc-400 leading-relaxed">
                  Please visit the <strong>On-Spot Desk</strong>. The coordinator will scan this card and register your Name, Phone Number, and Organization. Then only this ID will become valid.
                </div>
              </div>
            </PerspectiveCard>
          ) : (
            <PerspectiveCard depth={12} className="bg-gradient-to-br from-[#18181C] via-[#121215] to-[#0A0A0D] border border-white/15 p-6 rounded-3xl shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-md">
                    <img src="/sankara-eye-logo.png" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block">Sankara Eye Foundation</span>
                    <span className="text-[10px] text-zinc-400 font-mono">Verified Admission Pass</span>
                  </div>
                </div>
                <Badge className="bg-white text-zinc-950 text-[10px] font-black uppercase">
                  {participant.isFaculty
                    ? "Faculty Pass"
                    : (participant as any).delegateType === "team_sankara"
                    ? "Team Sankara"
                    : (participant as any).delegateType === "vendor"
                    ? "Vendor"
                    : (participant as any).delegateType === "exhibitor"
                    ? "Exhibitor"
                    : (participant as any).delegateType === "guest"
                    ? "VIP Guest"
                    : "Delegate Pass"}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="text-lg font-black text-white truncate">{participant.name}</div>
                <div className="text-xs font-mono font-bold text-zinc-400">{participant.registrationNumber}</div>
                <div className="text-xs text-zinc-300 truncate">{participant.institution}</div>
              </div>
            </PerspectiveCard>
          )
        ) : null}

        {/* ── STAFF PANEL ─────────────────────────────────── */}
        {staffChecked && staffUser && hasAnyPermission && participant && (
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-semibold text-gray-700">Staff: {staffUser.name}</span>
            </div>
            <CardContent className="p-4 space-y-3">

              {/* Attendance + Goodies (grouped together) */}
              {(canAttendance || canGoodies) && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Registration</div>

                  {canAttendance && (
                    <ActionButton
                      icon={CheckSquare}
                      label="Mark Attendance"
                      state={attendanceState}
                      color="green"
                      onAction={() => doAction("attendance")}
                      onReset={() => setAttendanceState(freshAction())}
                    />
                  )}

                  {canGoodies && (
                    <ActionButton
                      icon={Gift}
                      label="Goodies / Reg Kit Collected"
                      state={goodiesState}
                      color="purple"
                      onAction={() => doAction("goodies")}
                      onReset={() => setGoodiesState(freshAction())}
                    />
                  )}
                </div>
              )}

              {/* Food (separate group) */}
              {canFood && (
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Food Coupon</div>

                  {activeSessions.length === 0 ? (
                    <div className="text-xs text-gray-400 italic px-1">No active food sessions right now.</div>
                  ) : (
                    <>
                      {activeSessions.length > 1 && (
                        <Select value={selectedFoodSession} onValueChange={setSelectedFoodSession}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select session" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeSessions.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                                {s.name} ({s.date})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {activeSessions.length === 1 && (
                        <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 font-medium">
                          Session: {activeSessions[0].name}
                        </div>
                      )}

                      <ActionButton
                        icon={Utensils}
                        label="Issue Food Coupon"
                        state={foodState}
                        color="orange"
                        onAction={() => doAction("food")}
                        onReset={() => setFoodState(freshAction())}
                        disabled={!selectedFoodSession}
                      />
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── LIVE FOOD / MEAL SCANS STATUS ───────────────── */}
        {participant && (participant as any).foodSessions && (participant as any).foodSessions.length > 0 && (
          <div className="p-5 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#242428] pb-2.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-zinc-300" /> Live Food &amp; Meal Coupons
              </span>
              <span className="text-[10px] font-bold text-zinc-400">
                {(participant as any).foodSessions.filter((s: any) => s.isRedeemed).length} / {(participant as any).foodSessions.length} Redeemed
              </span>
            </div>

            <div className="space-y-2">
              {(participant as any).foodSessions.map((session: any) => (
                <div
                  key={session.id}
                  className="p-3 rounded-2xl bg-[#0D0D10] border border-[#222228] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">{session.name}</span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {session.date} • {session.startTime} - {session.endTime}
                    </span>
                  </div>

                  {session.isRedeemed ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Redeemed
                    </span>
                  ) : session.enabled ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-white text-zinc-950 inline-flex items-center gap-1 shadow-sm">
                      Ready to Scan
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-[#1E1E24] text-zinc-400 border border-[#2C2C36]">
                      Upcoming
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ATTENDEE / PUBLIC AGENDA & PDF BUTTONS ───────── */}
        {participant && (
          <div className="p-5 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-3">
            <div className="border-b border-[#242428] pb-2.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-zinc-300" /> Event Agenda &amp; Documents
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Event Custom Agenda PDF Button */}
              {((participant as any)?.event?.agendaPdfUrl || AGENDA_PDF) && (
                <a
                  href={(participant as any)?.event?.agendaPdfUrl || AGENDA_PDF}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#0D0D10] hover:bg-[#1A1A20] border border-[#242429] transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-white text-zinc-950 flex items-center justify-center shrink-0 shadow-md">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white group-hover:text-zinc-200">
                      {(participant as any)?.event?.agendaPdfButtonText || "Download Event Agenda (PDF)"}
                    </div>
                    <div className="text-[10px] text-zinc-400">Official conference schedule &amp; brochure</div>
                  </div>
                </a>
              )}

              {/* Event Custom Secondary Document Button (e.g. Floor Map, Stalls) */}
              {(participant as any)?.event?.customPdfUrl && (
                <a
                  href={(participant as any).event.customPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#0D0D10] hover:bg-[#1A1A20] border border-[#242429] transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 text-white flex items-center justify-center shrink-0 border border-zinc-700">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white group-hover:text-zinc-200">
                      {(participant as any).event.customPdfButtonText || "View Document (PDF)"}
                    </div>
                    <div className="text-[10px] text-zinc-400">Floor map, stalls, and guidelines</div>
                  </div>
                </a>
              )}

              <Link
                href={`/agenda/${participant.registrationNumber}`}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#0D0D10] hover:bg-[#1A1A20] border border-[#242429] transition-all group cursor-pointer block"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center shrink-0 border border-zinc-700">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white">Interactive Tracks &amp; Sessions</div>
                    <div className="text-[10px] text-zinc-400">Explore hall sessions, timings, and scientific topics</div>
                  </div>
                </div>
              </Link>
            </div>

              {currentParticipantUser ? (
                <Button className="w-full bg-white hover:bg-zinc-200 text-zinc-950 py-5 text-xs font-black rounded-2xl cursor-pointer" asChild>
                  <Link href="/participant/dashboard">
                    Go to my Personal Dashboard &amp; Wishlist →
                  </Link>
                </Button>
              ) : quickOtpStep === "email" ? (
                <form onSubmit={handleQuickEmailSubmit} className="space-y-3 pt-3 border-t border-[#242429]">
                  <div className="text-xs font-bold text-zinc-300">Personal Agenda &amp; Wish to Attend (Login)</div>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                      placeholder="Enter Registered Email ID"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                      className="pl-10 h-10 bg-[#0D0D10] border-[#2B2B32] text-white rounded-2xl text-xs"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-10 bg-white hover:bg-zinc-200 text-zinc-950 font-black rounded-2xl text-xs shadow-md cursor-pointer border-none"
                    disabled={loggingIn || !emailInput.trim()}
                  >
                    {loggingIn ? "Accessing..." : "Access My Dashboard →"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleQuickOtpVerify} className="space-y-3 pt-3 border-t border-[#242429] text-center">
                  <div className="text-xs font-bold text-zinc-300 mb-1">Enter Verification OTP</div>
                  <p className="text-[10px] text-zinc-400 mb-2">
                    {quickOtpSentMessage}
                  </p>
                  <div className="py-2">
                    <OtpInput
                      value={quickOtpValue}
                      onChange={setQuickOtpValue}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setQuickOtpStep("email");
                        setQuickOtpValue("");
                      }}
                      className="flex-1 h-9 rounded-2xl text-xs bg-[#0D0D10] border-[#2B2B32] text-zinc-300"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-[2] h-9 bg-white hover:bg-zinc-200 text-zinc-950 font-black rounded-2xl text-xs shadow-md cursor-pointer border-none"
                      disabled={loggingIn || quickOtpValue.length !== 6}
                    >
                      {loggingIn ? "Verifying..." : "Verify & Log In →"}
                    </Button>
                  </div>
                </form>
              )}
          </div>
        )}

        {/* Back link */}
        <div className="text-center pt-2">
          <Link href="/login">
            <span className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 justify-center">
              <ArrowLeft className="w-3 h-3" /> Staff login
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Reusable action button ──────────────────────────────────────────────────
const COLOR_MAP = {
  green: { btn: "bg-green-600 hover:bg-green-700 text-white", success: "bg-green-50 border-green-200 text-green-800", warn: "bg-amber-50 border-amber-200 text-amber-800", icon: "text-green-600" },
  purple: { btn: "bg-[#6F42C1] hover:bg-[#5a35a0] text-white", success: "bg-purple-50 border-purple-200 text-purple-800", warn: "bg-amber-50 border-amber-200 text-amber-800", icon: "text-purple-600" },
  orange: { btn: "bg-[#F58220] hover:bg-[#e07010] text-white", success: "bg-orange-50 border-orange-200 text-orange-800", warn: "bg-amber-50 border-amber-200 text-amber-800", icon: "text-orange-600" },
};

function ActionButton({
  icon: Icon, label, state, color, onAction, onReset, disabled = false,
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
      <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${c.success}`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${c.icon}`} />
          <span className="text-sm font-semibold">{state.message}</span>
        </div>
        <button onClick={onReset} className="text-xs opacity-60 hover:opacity-100">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!state.success && state.error) {
    return (
      <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${state.alreadyDone ? c.warn : "bg-red-50 border-red-200 text-red-800"}`}>
        <div className="flex items-center gap-2">
          {state.alreadyDone ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-600" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span className="text-sm font-medium">{state.error}</span>
        </div>
        <button onClick={onReset} className="text-xs opacity-60 hover:opacity-100">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Button
      className={`w-full justify-start gap-3 h-10 text-sm font-semibold ${c.btn}`}
      onClick={onAction}
      disabled={state.loading || disabled}
    >
      {state.loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        <Icon className="w-4 h-4 shrink-0" />
      )}
      {state.loading ? "Processing…" : label}
    </Button>
  );
}
