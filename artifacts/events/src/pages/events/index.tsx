import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  MapPin,
  Search,
  Lock,
  Clock,
  Sparkles,
  ChevronRight,
  CalendarCheck,
  Compass,
  CalendarDays,
  Shield,
  Layers,
  Ticket,
  Mail,
  Phone,
  User,
  Users,
  Building,
  ArrowRight,
  Loader2,
  ShieldCheck,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GoogleWalletButton } from "@/components/google-wallet-button";
import { ThreeAmbientScene } from "@/components/3d/three-ambient-scene";
import { PerspectiveCard } from "@/components/3d/perspective-card";
import { TactileButton } from "@/components/3d/tactile-button";
import { HolographicPassCard } from "@/components/3d/holographic-pass-card";
import { Sankara3DEmblem } from "@/components/3d/sankara-3d-emblem";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string; badgeBg: string }> = {
  conference: { label: "Conference", color: "text-white", badgeBg: "bg-zinc-900 border-zinc-800" },
  cme: { label: "CME Academic", color: "text-white", badgeBg: "bg-zinc-900 border-zinc-800" },
  workshop: { label: "Surgical Workshop", color: "text-white", badgeBg: "bg-zinc-900 border-zinc-800" },
  symposium: { label: "Fellowship Symposium", color: "text-white", badgeBg: "bg-zinc-900 border-zinc-800" },
  internal_staff: { label: "Staff Internal", color: "text-white", badgeBg: "bg-zinc-900 border-zinc-800" },
};

function formatLumaDate(dateStr: string) {
  if (!dateStr) return { month: "TBD", day: "--", weekday: "Date TBA" };
  try {
    const d = new Date(dateStr);
    const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const day = d.getDate().toString().padStart(2, "0");
    const weekday = d.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
    return { month, day, weekday };
  } catch {
    return { month: "DATE", day: "--", weekday: dateStr };
  }
}

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

export default function EventsDirectory() {
  const [location] = useLocation();
  const getInitialTab = (): "discover" | "registrations" => {
    if (typeof window === "undefined") return "discover";
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") === "registrations" || window.location.pathname.includes("my-registrations")
      ? "registrations"
      : "discover";
  };

  const [mainTab, setMainTab] = useState<"discover" | "registrations">(getInitialTab);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTimeline, setActiveTimeline] = useState<"upcoming" | "past">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const { user, token, logout, loginAttendee } = useAuth();
  const { toast } = useToast();

  // Registrations state
  const [myRegistrations, setMyRegistrations] = useState<EventRegistration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  // Home Page Auth Modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authStep, setAuthStep] = useState<"email" | "otp">("email");
  const [authEmail, setAuthEmail] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Mobile / Profile Completion Modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileMobile, setProfileMobile] = useState("");
  const [profileInstitution, setProfileInstitution] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Catch URL tab param or location change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "registrations" || location.includes("my-registrations") || location === "/my-registrations") {
      setMainTab("registrations");
    } else if (tabParam === "discover" || location === "/" || location === "/events") {
      if (!params.get("tab")) {
        setMainTab("discover");
      }
    }

    const authToken = params.get("auth_token");
    const errorParam = params.get("error");

    if (authToken) {
      localStorage.setItem("vision2020_token", authToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      if (loginAttendee) {
        loginAttendee(authToken, { userType: "attendee" });
      }
      toast({ title: "Signed In Successfully", description: "Welcome to Sankara Events." });
      checkProfileCompletion();
      fetchRegistrationsData(authToken);
      return;
    }

    if (errorParam) {
      toast({ title: "Authentication Error", description: errorParam, variant: "destructive" });
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const activeToken = token || localStorage.getItem("vision2020_token");
    if (activeToken) {
      fetchRegistrationsData(activeToken);
      if ((user?.userType as string) === "attendee") {
        checkProfileCompletion();
      }
    }
  }, [token, location]);

  async function fetchRegistrationsData(authToken?: string) {
    const activeToken = authToken || token || localStorage.getItem("vision2020_token");
    if (!activeToken) return;
    setRegistrationsLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/my-registrations`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch passes");
      const data = await res.json();
      setMyRegistrations(data.registrations || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setRegistrationsLoading(false);
    }
  }

  function checkProfileCompletion() {
    const savedMobile = localStorage.getItem("attendee_mobile");
    if (!savedMobile) {
      setProfileName(user?.name || "");
      setShowProfileModal(true);
    }
  }

  const { data: events, isLoading } = useQuery<any[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/events`);
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const filteredEvents = (events || []).filter((e) => {
    if (activeCategory !== "all" && e.eventType !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title?.toLowerCase().includes(q);
      const matchCity = e.city?.toLowerCase().includes(q);
      const matchVenue = e.venue?.toLowerCase().includes(q);
      const matchDesc = e.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchCity && !matchVenue && !matchDesc) return false;
    }
    return true;
  });

  const todayIso = new Date().toISOString().split("T")[0];
  const upcomingEvents = filteredEvents.filter(
    (e) => (e.endDate || e.startDate) >= todayIso && e.status !== "completed" && e.status !== "archived"
  );
  const pastEvents = filteredEvents.filter(
    (e) => (e.endDate || e.startDate) < todayIso || e.status === "completed" || e.status === "archived"
  );
  const upcomingCount = upcomingEvents.length;
  const pastCount = pastEvents.length;
  const displayedEvents = activeTimeline === "upcoming" ? upcomingEvents : pastEvents;

  // Handle requesting email OTP
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!authEmail.trim() || !authEmail.includes("@")) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/attendee/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code.");
      setAuthStep("otp");
      toast({ title: "OTP Sent!", description: `6-digit code sent to ${authEmail}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send code.", variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  }

  // Handle verifying email OTP
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!authOtp.trim()) return;
    setAuthLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/attendee/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim().toLowerCase(),
          otp: authOtp.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid or expired OTP code.");

      loginAttendee(data.token, data.user);
      setShowAuthModal(false);
      toast({ title: "Signed In Successfully", description: `Welcome back, ${data.user.name || "Delegate"}!` });

      // Trigger profile check
      const savedMobile = localStorage.getItem("attendee_mobile");
      if (!savedMobile) {
        setProfileName(data.user.name || authEmail.split("@")[0]);
        setShowProfileModal(true);
      }
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err.message || "Could not verify code.", variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  }

  // Handle saving post-login profile & mobile number
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const cleanMobile = profileMobile.replace(/\D/g, "");
    if (cleanMobile.length < 10) {
      toast({ title: "Invalid Mobile Number", description: "Please enter a valid 10-digit mobile number.", variant: "destructive" });
      return;
    }

    setProfileSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/attendee/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || localStorage.getItem("vision2020_token")}`,
        },
        body: JSON.stringify({
          name: profileName.trim(),
          mobile: cleanMobile,
          institution: profileInstitution.trim(),
        }),
      });

      localStorage.setItem("attendee_mobile", cleanMobile);
      if (profileName.trim()) {
        localStorage.setItem("attendee_name", profileName.trim());
      }
      setShowProfileModal(false);
      toast({ title: "Profile Completed", description: "Your details have been saved." });
    } catch (err: any) {
      localStorage.setItem("attendee_mobile", cleanMobile);
      setShowProfileModal(false);
      toast({ title: "Saved Locally", description: "Your mobile number has been set." });
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-transparent text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white overflow-hidden">
      {/* 3D Interactive GPU-accelerated Particle Cosmos */}
      <ThreeAmbientScene particleCount={65} className="z-0 opacity-80" />

      {/* Top Lu.ma Obsidian Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b border-[#242428]/80 bg-[#09090B]/80 backdrop-blur-xl">
        <div className="max-w-7xl 2xl:max-w-[1540px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Left: Brand Logo & Title */}
          <Link href="/events" className="flex items-center gap-2.5 sm:gap-3 group cursor-pointer">
            <img
              src="/sankara-eye-logo.png"
              alt="Sankara Eye Care"
              className="h-8 sm:h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-black text-sm sm:text-base tracking-tight text-white">
                  Sankara Eye Foundation
                </span>
                <span className="font-bold text-xs text-zinc-300">
                  India
                </span>
              </div>
            </div>
          </Link>

          {/* Center Navigation Links (Dissolve Tab Switcher) */}
          <div className="hidden sm:flex items-center gap-1 bg-[#1C1C20] border border-[#2B2B30] p-1 rounded-full text-zinc-400">
            <button
              onClick={() => setMainTab("discover")}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                mainTab === "discover"
                  ? "bg-[#27272D] text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Discover Events</span>
            </button>
            <button
              onClick={() => {
                setMainTab("registrations");
                if (!user) {
                  setAuthStep("email");
                  setShowAuthModal(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                mainTab === "registrations"
                  ? "bg-[#27272D] text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>My Registrations</span>
              {myRegistrations.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-black">
                  {myRegistrations.length}
                </span>
              )}
            </button>
          </div>

          {/* Right: Actions / Auth Button */}
          <div className="flex items-center gap-2.5 text-zinc-400">
            <button
              onClick={() => {
                setMainTab(mainTab === "discover" ? "registrations" : "discover");
                if (!user && mainTab === "discover") {
                  setAuthStep("email");
                  setShowAuthModal(true);
                }
              }}
              className="sm:hidden text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1 mr-1 cursor-pointer"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>{mainTab === "discover" ? "My Passes" : "Events"}</span>
            </button>

            {(user?.userType as string) === "super_admin" || (user?.userType as string) === "admin" || (user?.userType as string) === "event_coordinator" ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  asChild
                  className="h-8.5 rounded-full bg-[#18181D] hover:bg-[#222228] text-white border border-[#2B2B33] font-bold text-xs shadow-md px-3.5 cursor-pointer flex items-center gap-2 transition-transform active:scale-98"
                >
                  <Link href="/admin/dashboard">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Admin Operations Console</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400 ml-0.5" />
                  </Link>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    logout();
                    setMyRegistrations([]);
                    toast({ title: "Signed Out" });
                  }}
                  className="h-8.5 w-8.5 p-0 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (user?.userType as string) === "attendee" ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setMainTab(mainTab === "discover" ? "registrations" : "discover")}
                  className="h-8.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow px-3.5 cursor-pointer"
                >
                  <Ticket className="w-3.5 h-3.5 mr-1 text-zinc-950" />
                  {mainTab === "discover" ? `My Passes (${myRegistrations.length})` : "Browse Events"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    logout();
                    setMyRegistrations([]);
                    toast({ title: "Signed Out" });
                  }}
                  className="h-8.5 w-8.5 p-0 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : user ? (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-8.5 rounded-full border-[#2B2B30] bg-[#1C1C20] hover:bg-[#27272D] text-zinc-300 font-semibold text-xs px-3.5"
              >
                <Link href="/admin/dashboard">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  <span>Dashboard</span>
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setAuthStep("email");
                    setShowAuthModal(true);
                  }}
                  className="h-8.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow px-4 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Attendee Sign In</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Container (Wide Full-Screen Layout) */}
      <main className="max-w-7xl 2xl:max-w-[1540px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 sm:py-12 w-full flex-1">
        {mainTab === "discover" ? (
          <div key="discover-tab" className="animate-dissolve space-y-8">
            {/* Hero Section — 3D Interactive Centerpiece & Animated Emblem */}
            <div className="text-center space-y-4 pt-1 sm:pt-2">
              <div className="flex justify-center pb-1">
                <Sankara3DEmblem size="lg" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                  Sankara Eye Foundation <span className="text-zinc-500 font-light">India</span>
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
                  Official Medical Conferences, Scientific CMEs, Clinical Workshops &amp; Foundation Events
                </p>
              </div>
            </div>

            {/* Search & Category Filter Pills */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search by event, speaker, or venue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9.5 h-10 bg-[#1A1A1E] border-[#2B2B32] rounded-full text-xs sm:text-sm text-white placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: "all", label: "All" },
                  { id: "conference", label: "Conferences" },
                  { id: "cme", label: "CMEs" },
                  { id: "workshop", label: "Workshops" },
                  { id: "internal_staff", label: "Staff Internal" },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setActiveCategory(pill.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      activeCategory === pill.id
                        ? "bg-white text-zinc-950 font-bold shadow-sm"
                        : "bg-[#1A1A1E] text-zinc-400 hover:text-white hover:bg-[#25252A] border border-[#2B2B32]"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Filter Switcher (Upcoming / Past) */}
            <div className="flex items-center justify-between border-b border-[#242428] pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTimeline("upcoming")}
                  className={`text-sm font-bold transition-colors cursor-pointer ${
                    activeTimeline === "upcoming"
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Upcoming Events ({upcomingCount})
                </button>
                <span className="text-zinc-600">•</span>
                <button
                  onClick={() => setActiveTimeline("past")}
                  className={`text-sm font-bold transition-colors cursor-pointer ${
                    activeTimeline === "past"
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Past Archives ({pastCount})
                </button>
              </div>

              <span className="text-xs text-zinc-500 font-medium hidden sm:inline-block">
                Showing {displayedEvents.length} {displayedEvents.length === 1 ? "Event" : "Events"}
              </span>
            </div>

            {/* Events Grid (2-Column Responsive Matrix on Desktop) */}
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-36 rounded-3xl bg-[#141417] border border-[#242428] animate-pulse p-6" />
                ))}
              </div>
            ) : displayedEvents.length === 0 ? (
              <div className="text-center py-20 bg-[#161619] rounded-3xl border border-[#242428] p-8 space-y-4">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-[#1F1F24] border border-[#2C2C33] flex items-center justify-center text-zinc-500 font-black text-3xl select-none">
                  0
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">
                    No {activeTimeline === "upcoming" ? "Upcoming" : "Past"} Events
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    {activeTimeline === "upcoming"
                      ? "There are no upcoming events scheduled under this filter."
                      : "There are no past events found under this filter."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {displayedEvents.map((event) => {
                    const dateInfo = formatLumaDate(event.startDate);
                    const badge = EVENT_TYPE_LABELS[event.eventType] || {
                      label: event.eventType || "Event",
                      color: "text-white",
                      badgeBg: "bg-zinc-900 border-zinc-800",
                    };

                    return (
                      <Link
                        key={event.id}
                        href={`/events/${event.slug || event.id}`}
                        className="block group"
                      >
                        <PerspectiveCard
                          depth={8}
                          className="bg-[#141417] hover:bg-[#1A1A1E] border border-[#242428] hover:border-zinc-600 rounded-3xl p-5 sm:p-6 transition-all duration-200"
                        >
                          <div className="flex items-start gap-4 sm:gap-6">
                            {/* 3D Obsidian Date Badge */}
                            <div
                              className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-[#09090B] border border-[#2B2B32] flex flex-col items-center justify-center shrink-0 shadow-inner group-hover:border-zinc-500 transition-colors"
                              style={{ transform: "translateZ(15px)" }}
                            >
                              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">
                                {dateInfo.month}
                              </span>
                              <span className="text-lg sm:text-2xl font-black text-white leading-none tracking-tight">
                                {dateInfo.day}
                              </span>
                              <span className="text-[9px] font-semibold text-zinc-500 uppercase">
                                {dateInfo.weekday}
                              </span>
                            </div>

                            {/* Event Details */}
                            <div className="flex-1 min-w-0 space-y-1.5" style={{ transform: "translateZ(10px)" }}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.badgeBg} ${badge.color}`}
                                >
                                  {badge.label}
                                </span>
                                {event.badgeSubtitle && (
                                  <span className="text-[11px] text-zinc-400 font-medium truncate">
                                    • {event.badgeSubtitle}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-zinc-200 transition-colors truncate">
                                {event.title}
                              </h3>

                              {event.description && (
                                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                  {event.description}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 pt-1">
                                {(event.timeFrom || event.timeTo) && (
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                    <span>
                                      {event.timeFrom || "09:00 AM"} – {event.timeTo || "05:00 PM"}
                                    </span>
                                  </div>
                                )}

                                {(event.venue || event.city) && (
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                    <span className="truncate">
                                      {event.venue ? `${event.venue}, ` : ""}
                                      {event.city}
                                    </span>
                                  </div>
                                )}

                                {(() => {
                                  const todayStr = new Date().toISOString().split("T")[0];
                                  const isPast =
                                    activeTimeline === "past" ||
                                    event.status === "completed" ||
                                    event.status === "archived" ||
                                    (event.endDate ? event.endDate < todayStr : event.startDate < todayStr);
                                  const footfall =
                                    event.postEventVisitorCount ||
                                    event.totalParticipants ||
                                    (event as any).attendanceCount ||
                                    0;

                                  if (isPast) {
                                    return (
                                      <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                                        <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span>
                                          {footfall > 0
                                            ? `${footfall.toLocaleString()} Footfall`
                                            : "Event Concluded"}
                                        </span>
                                      </div>
                                    );
                                  }

                                  if (event.maxCapacity) {
                                    return (
                                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        <span>
                                          {event.seatsLeft !== undefined
                                            ? `${event.seatsLeft} seats left`
                                            : `${event.maxCapacity} capacity`}
                                        </span>
                                      </div>
                                    );
                                  }

                                  return null;
                                })()}
                              </div>
                            </div>

                            {/* Arrow Chevron Action */}
                            <div className="self-center hidden sm:block pl-2 text-zinc-600 group-hover:text-white group-hover:translate-x-1 transition-all">
                              <ChevronRight className="w-5 h-5" />
                            </div>
                          </div>
                        </PerspectiveCard>
                      </Link>
                    );
                  })}
                </div>
              )}
          </div>
        ) : (
          <div key="registrations-tab" className="animate-dissolve space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                  <Ticket className="w-7 h-7 text-blue-400" />
                  My Registrations &amp; Passes
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Access your digital admission passes, Google Wallet passes, and check-in QR codes.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setMainTab("discover")}
                className="self-start sm:self-auto h-8 rounded-full border border-[#2B2B32] bg-[#141417] hover:bg-[#222228] text-white text-xs font-bold px-3.5 cursor-pointer"
              >
                + Register for New Event
              </Button>
            </div>

            {/* Passes Content */}
            {!user ? (
              <div className="bg-[#141417] border border-[#2B2B32] rounded-3xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-6 shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">Sign In to View Your Passes</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Log in with your registered Google account or request a 6-digit OTP code to view your event passes.
                  </p>
                </div>
                <div className="space-y-3">
                  <a
                    href={`${BASE_URL}/api/auth/google`}
                    className="flex items-center justify-center gap-3 w-full h-11 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs transition-all shadow cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign in with Google</span>
                  </a>
                  <Button
                    onClick={() => {
                      setAuthStep("email");
                      setShowAuthModal(true);
                    }}
                    variant="outline"
                    className="w-full h-11 rounded-xl border-[#2B2B32] bg-[#09090B] hover:bg-[#1E1E24] text-white text-xs font-bold cursor-pointer"
                  >
                    <Mail className="w-4 h-4 mr-2 text-zinc-400" />
                    Sign in with Email OTP
                  </Button>
                </div>
              </div>
            ) : registrationsLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="border border-[#242428] rounded-2xl bg-[#141417] p-6 space-y-4">
                    <Skeleton className="h-6 w-1/3 bg-[#232328]" />
                    <Skeleton className="h-4 w-1/2 bg-[#232328]" />
                    <Skeleton className="h-24 w-full bg-[#232328]" />
                  </div>
                ))}
              </div>
            ) : myRegistrations.length === 0 ? (
              <div className="bg-[#141417] border border-[#2B2B32] rounded-3xl p-12 text-center max-w-md mx-auto space-y-4 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-[#222228] text-zinc-400 flex items-center justify-center mx-auto">
                  <Ticket className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">No Registrations Found</h3>
                  <p className="text-xs text-zinc-400">
                    You haven't registered for any events yet under <span className="text-white font-mono">{(user as any)?.email || "this account"}</span>.
                  </p>
                </div>
                <Button
                  onClick={() => setMainTab("discover")}
                  className="rounded-full bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold px-6 py-2 cursor-pointer shadow"
                >
                  Explore Upcoming Events
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {myRegistrations.map((reg) => {
                  const dateInfo = formatLumaDate(reg.eventStartDate);
                  return (
                    <div
                      key={reg.id}
                      className="bg-[#141417] border border-[#242428] hover:border-zinc-700 rounded-3xl p-6 sm:p-8 transition-all shadow-xl space-y-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-[#09090B] border border-[#2B2B32] flex flex-col items-center justify-center shrink-0 shadow-inner">
                            <span className="text-[10px] font-bold uppercase text-zinc-400">{dateInfo.month}</span>
                            <span className="text-2xl font-black text-white leading-none">{dateInfo.day}</span>
                            <span className="text-[9px] font-semibold text-zinc-500 uppercase">{dateInfo.weekday}</span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                                {reg.approvalStatus === "approved" ? "Confirmed Pass" : "Registered"}
                              </span>
                              <span className="text-xs font-mono font-bold text-zinc-300">
                                #{reg.registrationNumber}
                              </span>
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-white">
                              {reg.eventTitle}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-zinc-500" />
                                {reg.name}
                              </span>
                              {reg.institution && (
                                <span className="flex items-center gap-1">
                                  <Building className="w-3.5 h-3.5 text-zinc-500" />
                                  {reg.institution}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                                {reg.eventVenue}, {reg.eventCity}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:items-end gap-2.5 shrink-0 pt-2 sm:pt-0">
                          <GoogleWalletButton
                            registrationNumber={reg.registrationNumber}
                            className="w-full sm:w-auto"
                            showHint
                          />
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl border-[#2B2B32] bg-[#09090B] hover:bg-[#1E1E24] text-white text-xs font-bold px-4"
                          >
                            <Link href={`/events/${reg.eventSlug || reg.eventId}`}>
                              View Event Details &amp; Agenda
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── HOME PAGE SIGN IN MODAL (Google OAuth + Email OTP) ── */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="bg-[#141417] border border-[#2B2B32] text-white rounded-3xl max-w-sm sm:max-w-md p-6 sm:p-8 shadow-2xl">
          <DialogHeader className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-white text-zinc-950 flex items-center justify-center mx-auto shadow-lg">
              <Ticket className="w-6 h-6 text-zinc-950" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Sign In to Sankara Events
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Access your digital admission passes, event registrations, and schedules.
            </DialogDescription>
          </DialogHeader>

          <div className="pt-4 space-y-4">
            {/* Google 1-Click Login */}
            <a
              href={`${BASE_URL}/api/auth/google`}
              className="flex items-center justify-center gap-3 w-full h-11 rounded-xl bg-[#09090B] hover:bg-[#1E1E24] border border-[#2B2B32] text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </a>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-[#141417] px-2 text-zinc-500 font-bold tracking-wider">Or with email</span>
              </div>
            </div>

            {authStep === "email" ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-zinc-300">Your Email Address</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                    <Input
                      type="email"
                      required
                      placeholder="doctor@hospital.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="pl-9 h-10 rounded-xl bg-[#09090B] border-[#2B2B32] text-white text-xs placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={authLoading}
                  className="w-full h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow cursor-pointer"
                >
                  {authLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sending OTP...
                    </span>
                  ) : (
                    <span>Continue with Email OTP</span>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-zinc-300">Enter 6-Digit OTP</Label>
                    <button
                      type="button"
                      onClick={() => setAuthStep("email")}
                      className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer"
                    >
                      Change Email
                    </button>
                  </div>
                  <Input
                    required
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={authOtp}
                    onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, ""))}
                    className="h-10 text-center font-mono text-base tracking-widest bg-[#09090B] border-[#2B2B32] text-white rounded-xl focus:border-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={authLoading}
                  className="w-full h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow cursor-pointer"
                >
                  {authLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    <span>Verify &amp; Sign In</span>
                  )}
                </Button>
              </form>
            )}

            <div className="pt-2 text-center">
              <Link
                href="/login"
                onClick={() => setShowAuthModal(false)}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Coordinator / Admin Login →
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── POST-LOGIN PROFILE & MOBILE NUMBER PROMPT MODAL ── */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="bg-[#141417] border border-[#2B2B32] text-white rounded-3xl max-w-sm sm:max-w-md p-6 sm:p-8 shadow-2xl">
          <DialogHeader className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-white text-zinc-950 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-6 h-6 text-zinc-950" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Complete Your Account
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Please provide your mobile number so we can link your event passes and SMS alerts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="pt-3 space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-300">Full Name</Label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <Input
                  required
                  placeholder="Dr. John Doe"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-[#09090B] border-[#2B2B32] text-white text-xs placeholder:text-zinc-600 focus:border-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-300">Mobile Number (Required)</Label>
              <div className="relative">
                <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <Input
                  required
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={profileMobile}
                  onChange={(e) => setProfileMobile(e.target.value.replace(/\D/g, ""))}
                  className="pl-9 h-10 rounded-xl bg-[#09090B] border-[#2B2B32] text-white font-mono text-xs placeholder:text-zinc-600 focus:border-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-300">Hospital / Institution (Optional)</Label>
              <div className="relative">
                <Building className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <Input
                  placeholder="e.g. Sankara Eye Hospital"
                  value={profileInstitution}
                  onChange={(e) => setProfileInstitution(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-[#09090B] border-[#2B2B32] text-white text-xs placeholder:text-zinc-600 focus:border-white"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={profileSaving}
              className="w-full h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-md transition-transform active:scale-98 cursor-pointer mt-2"
            >
              {profileSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                  Saving Profile...
                </span>
              ) : (
                <span>Save &amp; Continue</span>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Comprehensive Sankara Eye Foundation India Footer (www.sankaraeye.com) ── */}
      <footer className="border-t border-[#242428] bg-[#09090B] text-zinc-400 text-xs mt-16">
        <div className="max-w-7xl 2xl:max-w-[1540px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-12 sm:py-16 space-y-12">
          {/* 3-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Col 1: Brand & Institution Overview (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="/sankara-eye-logo.png"
                  alt="Sankara Eye Foundation India"
                  className="h-11 w-auto object-contain"
                />
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
                <p><span className="text-zinc-300 font-semibold">National Helpline:</span> 1800 425 1977 / +91 422 4236789</p>
                <p><span className="text-zinc-300 font-semibold">Email:</span> <a href="mailto:events@sankaraeye.com" className="hover:text-white underline">events@sankaraeye.com</a></p>
              </div>
            </div>

            {/* Col 2: About the Hospital (5 cols) */}
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

            {/* Col 3: Quick Portals & Staff Login (3 cols) */}
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
