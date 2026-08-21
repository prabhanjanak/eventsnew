import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  CheckCircle2,
  ArrowRight,
  LogOut,
  Mail,
  KeyRound,
  Loader2,
  ExternalLink,
  Download,
  Share2,
  ChevronLeft,
  Sparkles,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleWalletButton } from "@/components/google-wallet-button";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface EventRegistration {
  id: number;
  eventId: number;
  registrationNumber: string;
  name: string;
  email: string;
  mobile: string;
  institution?: string | null;
  isPaid: boolean;
  approvalStatus: string;
  createdAt: string;
  eventTitle: string;
  eventSlug: string;
  eventStartDate: string;
  eventEndDate: string;
  eventTimeFrom?: string | null;
  eventTimeTo?: string | null;
  eventVenue: string;
  eventCity: string;
  eventRegistrationFee?: number;
  eventBanner?: string | null;
}

export default function MyRegistrationsPage() {
  const [, setLocation] = useLocation();
  const { user, token, logout, loginAttendee } = useAuth();
  const { toast } = useToast();

  // Login Gate States
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Registrations state
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeRegModal, setActiveRegModal] = useState<EventRegistration | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchStr = params.toString() ? `&${params.toString()}` : "";
    setLocation(`/events?tab=registrations${searchStr}`);
  }, []);

  async function fetchRegistrationsWithToken(t: string) {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/my-registrations`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error("Failed to load passes");
      const data = await res.json();
      setRegistrations(data.registrations || []);
    } catch (err: any) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRegistrations() {
    const activeToken = token || localStorage.getItem("vision2020_token");
    if (!activeToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/my-registrations`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load registrations");
      }
      const data = await res.json();
      setRegistrations(data.registrations || []);
    } catch (err: any) {
      console.warn("Registrations fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setSendingOtp(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/attendee/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send verification code.");
      setStep("otp");
      toast({
        title: "Code Sent!",
        description: `A 6-digit verification code was sent to ${email}.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to send code.",
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) {
      toast({ title: "OTP Required", description: "Please enter the 6-digit code.", variant: "destructive" });
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/attendee/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed.");
      
      // Save long-lived session
      localStorage.setItem("vision2020_token", data.token);
      if (loginAttendee) {
        loginAttendee(data.token, data.user);
      } else {
        window.location.reload();
      }
      toast({
        title: "Welcome Back!",
        description: "Successfully signed in to Sankara Events.",
      });
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message || "Invalid or expired code.",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  }

  function generateCalendarLinks(reg: EventRegistration) {
    const startIso = (reg.eventStartDate || "").replace(/-/g, "");
    const endIso = (reg.eventEndDate || reg.eventStartDate || "").replace(/-/g, "");
    const titleEnc = encodeURIComponent(reg.eventTitle);
    const detailsEnc = encodeURIComponent(
      `Pass ID: ${reg.registrationNumber}\nDelegate: ${reg.name}\nVenue: ${reg.eventVenue}, ${reg.eventCity}\nOrganized by Sankara Eye Foundation India`
    );
    const locEnc = encodeURIComponent(`${reg.eventVenue}, ${reg.eventCity}`);

    const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleEnc}&dates=${startIso}T033000Z/${endIso}T123000Z&details=${detailsEnc}&location=${locEnc}`;
    const outlook = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${titleEnc}&startdt=${reg.eventStartDate}T09:00:00&enddt=${reg.eventEndDate || reg.eventStartDate}T18:00:00&body=${detailsEnc}&location=${locEnc}`;
    return { google, outlook };
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white">
      {/* Top Lu.ma Obsidian Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b border-[#242428]/80 bg-[#09090B]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Explore Events</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-bold text-white tracking-wide">My Registrations</span>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline truncate max-w-[180px]">
                  {(user as any)?.email || user.name}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    logout();
                    toast({ title: "Logged Out", description: "You have been signed out." });
                  }}
                  className="h-7 rounded-full border-[#2B2B30] bg-[#141417] hover:bg-[#222228] text-white hover:text-white text-xs font-bold px-3 cursor-pointer"
                >
                  <LogOut className="w-3 h-3 mr-1" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-xs text-zinc-400 hover:text-white font-medium transition-colors"
              >
                Coordinator Portal
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full flex-1">
        {!user && !token ? (
          /* ── NOT LOGGED IN: Clean 3D Obsidian Email OTP Login Gate ── */
          <div className="max-w-md mx-auto py-6 sm:py-12">
            <div className="bg-[#141417] border border-[#2B2B32] rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.7)] relative overflow-hidden transition-all duration-300 hover:border-zinc-700">
              {/* Top Glow Accent */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-zinc-700 via-white to-zinc-700 opacity-30" />

              <div className="text-center space-y-3 pb-6">
                <div className="w-16 h-16 rounded-2xl bg-white text-zinc-950 flex items-center justify-center mx-auto shadow-xl">
                  <Ticket className="w-8 h-8 text-zinc-950" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  My Registrations
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Enter your email address to access your event passes, digital admission badges, and schedules.
                </p>
              </div>

              {step === "email" ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300">Your Registered Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                      <Input
                        type="email"
                        required
                        placeholder="doctor@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 rounded-xl bg-[#09090B] border-[#2B2B32] text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white text-sm"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={sendingOtp}
                    className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-md transition-transform active:scale-98 cursor-pointer"
                  >
                    {sendingOtp ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                        Sending Verification Code...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Continue with Email
                        <ArrowRight className="w-4 h-4 text-zinc-950" />
                      </span>
                    )}
                  </Button>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-[#141417] px-2 text-zinc-500 font-bold tracking-wider">Or</span>
                    </div>
                  </div>

                  <a
                    href={`${BASE_URL}/api/auth/google`}
                    className="flex items-center justify-center gap-3 w-full h-11 rounded-xl bg-[#09090B] hover:bg-[#1A1A1E] border border-[#2B2B32] text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign in with Google</span>
                  </a>

                  <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Secure passwordless authentication</span>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-300">Enter 6-Digit OTP</label>
                      <button
                        type="button"
                        onClick={() => setStep("email")}
                        className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        Change Email
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                      <Input
                        type="text"
                        maxLength={6}
                        required
                        autoFocus
                        placeholder="e.g. 849201"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.trim())}
                        className="pl-10 h-11 rounded-xl bg-[#09090B] border-[#2B2B32] text-white placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white font-mono tracking-widest text-center text-base"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Code sent to <span className="text-zinc-300 font-semibold">{email}</span>
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={verifyingOtp}
                    className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-md transition-transform active:scale-98 cursor-pointer"
                  >
                    {verifyingOtp ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                        Verifying...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Verify & Access My Passes
                        <ArrowRight className="w-4 h-4 text-zinc-950" />
                      </span>
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      disabled={sendingOtp}
                      onClick={handleRequestOtp}
                      className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Didn't receive the code? Resend Code
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* ── LOGGED IN: Delegate Passes & Registrations List ── */
          <div className="space-y-8">
            {/* Header Title Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                  <Ticket className="w-7 h-7 text-white" />
                  Your Event Passes
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Active registrations and admission badges for <span className="text-zinc-200 font-semibold">{(user as any)?.email || "Delegate"}</span>
                </p>
              </div>

              <Button
                size="sm"
                asChild
                className="h-9 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-md px-4 self-start sm:self-auto cursor-pointer"
              >
                <Link href="/events">+ Browse More Events</Link>
              </Button>
            </div>

            {loading ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-white animate-spin mx-auto" />
                <p className="text-xs font-semibold text-zinc-400">Loading your registrations...</p>
              </div>
            ) : registrations.length === 0 ? (
              <div className="bg-[#141417] border border-[#2B2B32] rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                  <Ticket className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">No Registrations Found</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    We couldn't find any event passes registered under <strong className="text-zinc-200">{(user as any)?.email || "this account"}</strong>.
                  </p>
                </div>
                <Button
                  asChild
                  className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs px-5 h-10 shadow-md cursor-pointer"
                >
                  <Link href="/events">Explore Sankara Events</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {registrations.map((reg) => {
                  const calLinks = generateCalendarLinks(reg);
                  return (
                    <div
                      key={reg.id}
                      className="bg-[#141417] border border-[#2B2B32] rounded-3xl p-6 shadow-xl transition-all duration-300 hover:border-zinc-600 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col justify-between relative overflow-hidden group"
                    >
                      {/* Top Accent Line */}
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-zinc-700 via-white to-zinc-700 opacity-20 group-hover:opacity-40 transition-opacity" />

                      <div className="space-y-4">
                        {/* Event Title & Badge ID */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                              Confirmed Pass
                            </span>
                            <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                              {reg.eventTitle}
                            </h3>
                          </div>

                          <div className="bg-white text-zinc-950 rounded-xl px-2.5 py-1 text-center shadow-md shrink-0">
                            <span className="text-[9px] font-extrabold tracking-wider block text-zinc-600 uppercase">Pass ID</span>
                            <span className="font-mono text-xs font-black">{reg.registrationNumber}</span>
                          </div>
                        </div>

                        {/* Event Logistics Metadata */}
                        <div className="space-y-2 text-xs text-zinc-300 bg-[#0C0C0E] p-3.5 rounded-2xl border border-zinc-900">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="font-semibold text-white">
                              {reg.eventStartDate} {reg.eventEndDate && reg.eventEndDate !== reg.eventStartDate ? `– ${reg.eventEndDate}` : ""}
                            </span>
                          </div>
                          {(reg.eventTimeFrom || reg.eventTimeTo) && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span>{reg.eventTimeFrom || "09:00 AM"} – {reg.eventTimeTo || "05:30 PM"} IST</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate">{reg.eventVenue}, {reg.eventCity}</span>
                          </div>
                        </div>

                        {/* QR Code Pass Box */}
                        <div className="flex items-center justify-between bg-white text-zinc-950 p-3.5 rounded-2xl shadow-inner">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-zinc-950">Official Delegate Pass</p>
                            <p className="text-[11px] text-zinc-600 font-medium">Present at check-in counter</p>
                            <p className="text-[10px] font-mono text-zinc-500 pt-1">{reg.name}</p>
                          </div>

                          <div className="p-1 bg-white rounded-lg border border-zinc-200">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(`https://events.sankaraeye.in/q/${(reg as any).qrToken || reg.registrationNumber}`)}`}
                              alt={`QR for ${reg.registrationNumber}`}
                              className="w-16 h-16 object-contain"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-5 border-t border-zinc-900 mt-4 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <GoogleWalletButton
                            registrationNumber={reg.registrationNumber}
                            variant="compact"
                            showHint
                          />
                          <a
                            href={calLinks.google}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1.5 rounded-xl transition-colors"
                          >
                            📅 Cal
                          </a>
                        </div>

                        <Button
                          size="sm"
                          asChild
                          className="h-8 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow px-3 cursor-pointer"
                        >
                          <Link href={`/events/${reg.eventSlug}`}>
                            View Event & Schedule
                            <ArrowRight className="w-3 h-3 ml-1 text-zinc-950" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Comprehensive Sankara Eye Foundation India Footer (www.sankaraeye.com) ── */}
      <footer className="border-t border-[#242428] bg-[#09090B] text-zinc-400 text-xs mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Col 1: Brand & Bio */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-zinc-950 flex items-center justify-center p-1 shadow-md">
                  <img
                    src="/sankara-eye-logo.png"
                    alt="Sankara Eye Foundation India"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Sankara Eye Foundation
                  </h3>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                    India • Sri Kanchi Kamakoti Medical Trust
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Dedicated to eliminating curable and preventable blindness since 1977. Conducting world-class clinical ophthalmology conferences, academic CMEs, surgical workshops, and fellowship symposia across India.
              </p>

              <div className="space-y-1 pt-1 text-[11px] text-zinc-400">
                <p><span className="text-zinc-300 font-semibold">Headquarters:</span> Sivanandapuram, Saravanampatti, Coimbatore - 641035, TN</p>
                <p><span className="text-zinc-300 font-semibold">Helpline:</span> 1800 425 1977 / +91 422 4236789</p>
                <p><span className="text-zinc-300 font-semibold">Email:</span> <a href="mailto:events@sankaraeye.com" className="hover:text-white underline">events@sankaraeye.com</a></p>
              </div>
            </div>

            {/* Col 2: About the Hospital */}
            <div className="lg:col-span-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                About the Hospital
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Founded in 1977, Sankara Eye Care Institutions (a unit of Sri Kanchi Kamakoti Medical Trust) is one of India's largest and most respected eye care networks. With a mission to provide compassionate, world-class eye care to all sections of society, we combine clinical excellence with community outreach to transform lives across the nation.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#111114] rounded-xl border border-[#1C1C20] p-3 space-y-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-lg font-black text-white">14</p>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">+1 Upcoming</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Hospitals Across India</p>
                  <p className="text-[9px] text-zinc-500">14 Operating • 1 Upcoming in Patna, Bihar</p>
                </div>
                <div className="bg-[#111114] rounded-xl border border-[#1C1C20] p-3 space-y-0.5">
                  <p className="text-lg font-black text-white">1500+</p>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Surgeries Per Day</p>
                  <p className="text-[9px] text-zinc-500">Free Surgeries for the Curable Blind</p>
                </div>
                <div className="bg-[#111114] rounded-xl border border-[#1C1C20] p-3 space-y-0.5">
                  <p className="text-lg font-black text-white">3M+</p>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Free Surgeries Done</p>
                  <p className="text-[9px] text-zinc-500">Restoring Vision Across Rural India</p>
                </div>
                <div className="bg-[#111114] rounded-xl border border-[#1C1C20] p-3 space-y-0.5">
                  <p className="text-lg font-black text-white">NABH &amp; Other</p>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Accredited Hospitals</p>
                  <p className="text-[9px] text-zinc-500">National Healthcare Quality Standards</p>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] text-zinc-400">
                <p className="flex items-start gap-2">
                  <span className="text-zinc-500 mt-0.5">•</span>
                  <span>DNB & Fellowship programs through <span className="text-zinc-300 font-semibold">Sankara Academy of Vision</span></span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-zinc-500 mt-0.5">•</span>
                  <span>Nationwide community outreach with free screening camps &amp; rural eye care</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-zinc-500 mt-0.5">•</span>
                  <span>Advanced super-specialty services across Cataract, Retina, Cornea, Glaucoma, Oculoplasty &amp; Paediatric Ophthalmology</span>
                </p>
              </div>
            </div>

            {/* Col 3: Quick Portals & Staff Login */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Portals &amp; Links
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/events" className="text-zinc-400 hover:text-white transition-colors">
                    Events Calendar
                  </Link>
                </li>
                <li>
                  <Link href="/my-registrations" className="text-zinc-400 hover:text-white transition-colors">
                    My Registrations
                  </Link>
                </li>
                <li>
                  <a
                    href="https://www.sankaraeye.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>sankaraeye.com</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.sankaraeye.com/about"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>About Us</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.sankaraeye.com/contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>Contact Us</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </li>
                <li className="pt-2 border-t border-zinc-800">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-semibold text-[11px] transition-all"
                  >
                    <Lock className="w-3 h-3 text-zinc-400" />
                    <span>Staff Login</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div className="pt-8 border-t border-[#1C1C20] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
            <p>
              © 2026 Sankara Eye Foundation India • Sri Kanchi Kamakoti Medical Trust. All rights reserved.
            </p>
            <p className="text-zinc-400 font-medium">
              Developed by Team IS - MHQ
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
