import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  ArrowLeft,
  Share2,
  Clock,
  Mail,
  Phone,
  CheckCircle2,
  CalendarPlus,
  Compass,
  Gift,
  Utensils,
  QrCode,
  Tag,
  Lock,
  Coffee,
  Mic,
  Sparkles,
  Layers,
  CalendarDays,
  User,
  ExternalLink,
  Download,
  Users,
  Check,
  Flame,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Play,
  Pause,
  ImageIcon,
  FileText,
  Ticket,
  Camera,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ThreeAmbientScene } from "@/components/3d/three-ambient-scene";
import { PerspectiveCard } from "@/components/3d/perspective-card";
import { TactileButton } from "@/components/3d/tactile-button";
import { EventHeroBanner } from "@/components/3d/event-hero-banner";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

import { formatDateTextual, formatDateDDMMYYYY, safeDate } from "@/lib/date-utils";

export interface AgendaSlot {
  id: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  title: string;
  type: string;
  trackHall?: string;
  speaker?: string;
  description?: string;
}

function formatLumaDateFull(dateStr: string, timeFrom?: string, timeTo?: string) {
  const timeDisplay = timeFrom && timeTo ? `${timeFrom} – ${timeTo} IST` : "09:00 – 17:00 IST";
  if (!dateStr) return { formatted: "Date to be announced", weekday: "", time: timeDisplay };
  const d = safeDate(dateStr);
  if (!d) return { formatted: dateStr, weekday: "", time: timeDisplay };
  
  const formatted = formatDateTextual(d);
  const weekday = d.toLocaleDateString("en-IN", { weekday: "long" });
  return { formatted, weekday, time: timeDisplay };
}

// ── 3D Randomized Cursor-Reactive Momentum Photo Gallery ────────────────────
interface ConcludedPhotoGalleryProps {
  images: string[];
  onEnlarge: (imgUrl: string) => void;
}

const CARD_PRESETS = [
  { rot: -3.8, y: -4, scale: 0.98, border: "hover:border-amber-400/80", shadow: "hover:shadow-amber-500/20" },
  { rot: 2.9, y: 6, scale: 1.02, border: "hover:border-indigo-400/80", shadow: "hover:shadow-indigo-500/20" },
  { rot: -2.1, y: -2, scale: 1.0, border: "hover:border-emerald-400/80", shadow: "hover:shadow-emerald-500/20" },
  { rot: 4.1, y: 8, scale: 1.03, border: "hover:border-rose-400/80", shadow: "hover:shadow-rose-500/20" },
  { rot: -4.5, y: -6, scale: 0.99, border: "hover:border-cyan-400/80", shadow: "hover:shadow-cyan-500/20" },
  { rot: 1.8, y: 3, scale: 1.01, border: "hover:border-purple-400/80", shadow: "hover:shadow-purple-500/20" },
  { rot: -3.2, y: -5, scale: 0.97, border: "hover:border-blue-400/80", shadow: "hover:shadow-blue-500/20" },
  { rot: 3.5, y: 7, scale: 1.04, border: "hover:border-teal-400/80", shadow: "hover:shadow-teal-500/20" },
  { rot: -1.6, y: -3, scale: 1.0, border: "hover:border-amber-300/80", shadow: "hover:shadow-amber-400/20" },
  { rot: 2.7, y: 4, scale: 1.02, border: "hover:border-pink-400/80", shadow: "hover:shadow-pink-500/20" },
];

function Randomized3DPhotoGallery({ images, onEnlarge }: ConcludedPhotoGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const total = images.length;

  // Track cursor position for subtle 3D tilt
  const handleMouseMoveContainer = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setCursorX(x);
    setCursorY(y);

    // Smooth drag scroll if mouse is down
    if (isDragging && trackRef.current) {
      e.preventDefault();
      const walk = (e.clientX - startX) * 1.6;
      trackRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    setIsDragging(true);
    setStartX(e.clientX);
    setScrollLeft(trackRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleScrollBy = (offset: number) => {
    if (!trackRef.current) return;
    trackRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (total === 0) return null;

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsDragging(false);
        setCursorX(0);
        setCursorY(0);
      }}
      onMouseMove={handleMouseMoveContainer}
      className="p-6 sm:p-8 rounded-3xl bg-[#121215]/90 border border-[#24242B] space-y-6 shadow-2xl relative overflow-hidden select-none backdrop-blur-xl"
    >
      {/* Dynamic Ambient Color Aura (follows cursor) */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent blur-[100px] pointer-events-none transition-all duration-300 -z-10"
        style={{
          transform: `translate(calc(${cursorX * 120}px + 50%), calc(${cursorY * 100}px + 10%))`,
        }}
      />

      {/* Header Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#242429]">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="uppercase tracking-wider">Visual Memoirs &amp; 3D Interactive Exhibition</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Event Photo Archive
          </h2>
          <p className="text-xs text-zinc-400">
            Slide and explore captured moments with dynamic 3D depth. Click any photo to enlarge.
          </p>
        </div>

        {/* Action Controls & Navigation Chevrons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#1A1A22] text-zinc-300 border border-[#2C2C38]">
            {total} Moments Captured
          </span>
          <button
            type="button"
            onClick={() => handleScrollBy(-380)}
            className="p-2 rounded-xl bg-[#1A1A22] hover:bg-[#262632] border border-[#2C2C38] text-white hover:text-amber-300 transition-all active:scale-95 cursor-pointer shadow-md"
            title="Slide Left"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => handleScrollBy(380)}
            className="p-2 rounded-xl bg-[#1A1A22] hover:bg-[#262632] border border-[#2C2C38] text-white hover:text-amber-300 transition-all active:scale-95 cursor-pointer shadow-md"
            title="Slide Right"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* ── 3D HORIZONTAL MOMENTUM CAROUSEL STAGE ───────────────────────────── */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className={`flex items-center gap-6 sm:gap-8 overflow-x-auto py-8 px-3 scrollbar-none select-none scroll-smooth ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ perspective: "1400px" }}
      >
        {images.map((imgUrl, idx) => {
          const preset = CARD_PRESETS[idx % CARD_PRESETS.length];
          // Interactive dynamic 3D rotation influenced by cursor
          const tiltX = isHovered ? -cursorY * 6 : 0;
          const tiltY = isHovered ? cursorX * 8 : 0;

          return (
            <div
              key={idx}
              onClick={() => onEnlarge(imgUrl)}
              style={{
                transform: `rotate(${preset.rot}deg) translateY(${preset.y}px) scale(${preset.scale}) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`group relative shrink-0 w-[280px] sm:w-[340px] p-2.5 rounded-3xl bg-[#18181E]/95 border border-[#2D2D38] ${preset.border} shadow-[0_20px_45px_rgba(0,0,0,0.7)] ${preset.shadow} hover:shadow-[0_30px_70px_rgba(0,0,0,0.95)] transition-all duration-300 hover:rotate-0 hover:scale-108 hover:translate-y-[-10px] hover:z-30 cursor-pointer select-none [-webkit-user-select:none] [-webkit-touch-callout:none]`}
            >
              {/* Top Accent Glare */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Photo Frame with Specular Corner Bevel */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-black select-none pointer-events-none">
                <img
                  src={imgUrl}
                  alt={`Sankara event memory ${idx + 1}`}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-700 ease-out group-hover:scale-112"
                />

                {/* Hover Shimmer Overlay & Enlarge Badge */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3.5">
                  <span className="text-xs font-bold text-white bg-black/85 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-md flex items-center gap-1.5">
                    <Maximize2 className="w-3 h-3 text-amber-300" />
                    <span>Enlarge</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold text-amber-300 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded border border-amber-400/30">
                    Moment #{idx + 1}
                  </span>
                </div>
              </div>

              {/* Polaroid-style Bottom Label */}
              <div className="pt-3 pb-1 px-2 flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="font-semibold text-zinc-300 group-hover:text-white transition-colors truncate">
                  Sankara Memoirs
                </span>
                <span className="text-zinc-500 font-bold">#{idx + 1}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide Navigation Hint Footer */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Click and drag with cursor to slide horizontally</span>
        </span>
        <span>Showing all {total} photographs</span>
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const [, params] = useRoute("/events/:slug");
  const slug = params?.slug;
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [agendaCategory, setAgendaCategory] = useState<string>("all");
  const [selectedRoleTierId, setSelectedRoleTierId] = useState<string>("delegate");
  const [calendarModalOpen, setCalendarModalOpen] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data: event, isLoading, error } = useQuery<any>({
    queryKey: ["/api/events", slug],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/events/${slug}`);
      if (!res.ok) throw new Error("Event not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Event link copied to clipboard.",
      });
    }
  };

  const getCalendarLinks = () => {
    if (!event) return { google: "", outlook: "", office365: "", yahoo: "" };
    
    const startIso = (event.startDate || "").replace(/-/g, "");
    const endIso = (event.endDate || event.startDate || "").replace(/-/g, "");
    
    const googleStart = `${startIso}T033000Z`; // 09:00 AM IST in UTC
    const googleEnd = `${endIso}T123000Z`;   // 06:00 PM IST in UTC
    
    const title = encodeURIComponent(event.title || "Sankara Event");
    const details = encodeURIComponent(`${event.description || event.shortDescription || ""}\n\nVenue: ${event.venue || "Sankara Eye Hospital"}, ${event.city || "Coimbatore"}\nPresented by: ${event.organizerName || "Sankara Eye Care Institutions"}`);
    const location = encodeURIComponent(`${event.venue || "Sankara Eye Hospital"}, ${event.city || "Coimbatore"}`);

    // Google Calendar
    const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${googleStart}/${googleEnd}&details=${details}&location=${location}`;

    // Microsoft Office 365 / Teams Web Calendar
    const office365 = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${title}&startdt=${event.startDate}T09:00:00&enddt=${event.endDate || event.startDate}T18:00:00&body=${details}&location=${location}`;

    // Outlook.com / Live Web Calendar
    const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${event.startDate}T09:00:00&enddt=${event.endDate || event.startDate}T18:00:00&body=${details}&location=${location}`;

    // Yahoo Calendar
    const yahoo = `https://calendar.yahoo.com/?v=60&title=${title}&st=${googleStart}&et=${googleEnd}&desc=${details}&in_loc=${location}`;

    return { google, outlook, office365, yahoo };
  };

  const handleDownloadIcs = () => {
    if (!event) return;
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sankara Events//Universal Hub//EN",
      "BEGIN:VEVENT",
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ""}`,
      `LOCATION:${event.venue || ""}, ${event.city || ""}`,
      `DTSTART:${(event.startDate || "").replace(/-/g, "")}T090000Z`,
      `DTEND:${(event.endDate || event.startDate || "").replace(/-/g, "")}T180000Z`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${event.slug || "event"}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Calendar Event (.ics) Downloaded",
      description: "You can open this file to add to Apple Calendar or your default device calendar.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-6 flex flex-col justify-center max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-64 w-full rounded-3xl bg-zinc-800" />
        <Skeleton className="h-10 w-2/3 bg-zinc-800" />
        <Skeleton className="h-24 w-full bg-zinc-800" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <Compass className="w-12 h-12 text-zinc-600 mb-3" />
        <h2 className="text-lg font-bold text-white">Event not found</h2>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          The event you requested could not be found or may have concluded.
        </p>
        <Button asChild className="mt-5 rounded-full bg-white text-zinc-950 text-xs font-bold">
          <Link href="/events">Explore All Events</Link>
        </Button>
      </div>
    );
  }

  const dateMeta = formatLumaDateFull(event.startDate, event.timeFrom, event.timeTo);
  const isPaid = event.isPaid && event.registrationFee > 0;
  const todayIso = new Date().toISOString().split("T")[0];
  const isConcluded = event ? ((event.endDate || event.startDate) < todayIso) : false;

  let galleryImages: string[] = [];
  try {
    if (event?.postEventGalleryJson) {
      galleryImages = typeof event.postEventGalleryJson === "string"
        ? JSON.parse(event.postEventGalleryJson)
        : event.postEventGalleryJson;
    }
  } catch {}

  // Parse agenda slots
  let agendaItems: AgendaSlot[] = [];
  try {
    if (event?.agendaJson) {
      const parsed = JSON.parse(event.agendaJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        agendaItems = parsed;
      }
    }
  } catch {}

  if (agendaItems.length === 0 && event) {
    agendaItems = [
      {
        id: "d1-1",
        date: event.startDate,
        timeFrom: "08:30 AM",
        timeTo: "09:30 AM",
        title: "Registration, Welcome Breakfast & Badge Collection",
        type: "break_tea",
        speaker: "Registration Team",
        trackHall: "Main Lobby & Reception",
        description: "Receive your delegate kits, QR badging pass, and join colleagues for hot breakfast.",
      },
      {
        id: "d1-2",
        date: event.startDate,
        timeFrom: "09:30 AM",
        timeTo: "10:30 AM",
        title: "Inaugural Ceremony & Lamp Lighting",
        type: "keynote",
        speaker: "Dr. R.V. Ramani & Chief Dignitaries",
        trackHall: "Grand Auditorium - Hall A",
        description: "Official opening remarks, invocation, and vision address.",
      },
      {
        id: "d1-3",
        date: event.startDate,
        timeFrom: "10:30 AM",
        timeTo: "01:00 PM",
        title: "Scientific Symposium: Clinical Masterclass & Advances",
        type: "session",
        speaker: "Chief Academic Surgeons & International Faculty",
        trackHall: "Grand Auditorium - Hall A",
        description: "High-impact scientific deliberations, surgical video techniques, and Q&A.",
      },
      {
        id: "d1-4",
        date: event.startDate,
        timeFrom: "01:00 PM",
        timeTo: "02:00 PM",
        title: "Buffet Lunch & Delegate Networking",
        type: "break_lunch",
        speaker: "Hospitality Team",
        trackHall: "Dining Pavilion",
        description: "Full multi-cuisine buffet lunch for all registered delegates and faculty.",
      },
      {
        id: "d1-5",
        date: event.startDate,
        timeFrom: "02:00 PM",
        timeTo: "04:00 PM",
        title: "Hands-on Workshop & Case Discussions",
        type: "workshop",
        speaker: "Senior Faculty Mentors",
        trackHall: "Workshop Suites 1 & 2",
        description: "Interactive skill-building session and hands-on demonstrations.",
      },
      {
        id: "d1-6",
        date: event.startDate,
        timeFrom: "04:00 PM",
        timeTo: "04:30 PM",
        title: "Evening High Tea & Refreshments",
        type: "break_tea",
        speaker: "Hospitality Committee",
        trackHall: "Main Foyer",
        description: "Tea, filter coffee, and traditional evening snacks.",
      },
      {
        id: "d1-7",
        date: event.startDate,
        timeFrom: "04:30 PM",
        timeTo: "05:30 PM",
        title: "Grand Panel Discussion, Valedictory & Awards",
        type: "panel",
        speaker: "Distinguished Panelists",
        trackHall: "Grand Auditorium",
        description: "Summary of scientific insights, best paper awards, and closing remarks.",
      },
    ];
  }

  const uniqueDates = Array.from(new Set(agendaItems.map((item) => item.date).filter(Boolean)));
  const activeDate = selectedDate || uniqueDates[0] || event.startDate || "";
  const currentItems = uniqueDates.length > 1 && activeDate
    ? agendaItems.filter((item) => item.date === activeDate)
    : agendaItems;

  const filteredItems = currentItems.filter((slot) => {
    if (agendaCategory === "all") return true;
    if (agendaCategory === "keynote") return slot.type === "keynote";
    if (agendaCategory === "sessions") return slot.type === "session" || slot.type === "workshop" || slot.type === "panel";
    if (agendaCategory === "breaks") return slot.type === "break_tea" || slot.type === "break_lunch";
    return true;
  });

  const maxCapacity = event.maxCapacity || 500;
  const totalRegistered = event.totalRegistered || event.totalParticipants || 0;
  const seatsLeft = event.seatsLeft !== undefined ? event.seatsLeft : Math.max(0, maxCapacity - totalRegistered);
  const percentBooked = Math.min(100, Math.round((totalRegistered / maxCapacity) * 100));

  const pricingTiers: any[] = event.pricingTiers && event.pricingTiers.length > 0
    ? event.pricingTiers
    : [
        {
          id: "attendee",
          name: "General Attendee",
          role: "attendee",
          price: 1500,
          earlyBirdPrice: 1200,
          earlyBirdDeadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          description: "Ideal for observers, hospital visitors, and general delegates.",
          inclusions: ["Access to Keynote & Main Stage", "Digital Event Pass & Dynamic QR", "E-Certificate of Attendance", "Conference Lunch & Refreshments"],
          badgeLabel: "Early Bird 20% OFF",
        },
        {
          id: "delegate",
          name: "Official CME Delegate",
          role: "delegate",
          price: 3000,
          earlyBirdPrice: 2400,
          earlyBirdDeadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          description: "Full clinical conference delegation with accredited CME points.",
          inclusions: ["Priority Seating in Grand Auditorium", "Accredited Medical Council CME Credits", "Hands-on Surgical & Clinical Workshops", "Premium Delegate Kit & Bag", "Gala Networking Dinner & Lunch"],
          badgeLabel: "Most Popular",
          popular: true,
        },
        {
          id: "member",
          name: "Sankara / AIOS Member",
          role: "member",
          price: 2000,
          earlyBirdPrice: 1600,
          earlyBirdDeadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          description: "Exclusive subsidized tariff for active institutional and society members.",
          inclusions: ["Subsidized Member Registration Tariff", "Access to Exclusive Member Lounge", "All CME Academic Tracks & Symposia", "Special Member Certificate & Badge", "Complete Delegate Dining & Refreshments"],
          badgeLabel: "Member Tariff",
        },
        {
          id: "non_member",
          name: "Non-Member Physician",
          role: "non_member",
          price: 2800,
          earlyBirdPrice: 2200,
          earlyBirdDeadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          description: "Standard registration for non-member practicing clinicians and surgeons.",
          inclusions: ["Full 3-Day Scientific Conference Access", "CME Credit Accreditation Certificate", "Conference Proceeding Papers & Video Library", "Delegate Welcome Kit", "All-Days Refreshments & Lunch"],
          badgeLabel: "Standard",
        },
        {
          id: "student_pg",
          name: "PG Resident / Fellow",
          role: "student",
          price: 999,
          earlyBirdPrice: 799,
          earlyBirdDeadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          description: "Special subsidized rate for post-graduate students, residents, and research fellows.",
          inclusions: ["Heavy Subsidized Student Fee", "Poster & Paper Presentation Eligibility", "Resident Mentorship Masterclass Access", "Digital Certificate of Merit / Attendance", "Student Lunch & Refreshments"],
          badgeLabel: "Student Rate",
        },
      ];

  const activeTier = pricingTiers.find((t) => t.id === selectedRoleTierId || t.role === selectedRoleTierId) || pricingTiers[0];
  const isEarlyBirdActive = isPaid && activeTier?.earlyBirdPrice !== undefined && (activeTier.earlyBirdDeadline ? new Date(activeTier.earlyBirdDeadline) >= new Date() : true);
  const currentPassPrice = isPaid ? (isEarlyBirdActive ? activeTier.earlyBirdPrice : activeTier.price) : 0;
  const daysLeftForEarlyBird = activeTier?.earlyBirdDeadline
    ? Math.max(0, Math.ceil((new Date(activeTier.earlyBirdDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 30;

  return (
    <div className="relative min-h-screen bg-transparent text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white overflow-hidden">
      {/* 3D Interactive GPU-accelerated Particle Cosmos */}
      <ThreeAmbientScene particleCount={55} className="z-0 opacity-75" />

      {/* Lu.ma Minimalist Navigation */}
      <header className="border-b border-zinc-800/80 bg-[#09090B]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl 2xl:max-w-[1540px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/events" className="inline-flex items-center gap-3 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer group">
            <ArrowLeft className="w-4 h-4 text-zinc-400 group-hover:text-white" />
            <img
              src="/sankara-eye-logo.png"
              alt="Sankara Eye Care"
              className="h-9 sm:h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-bold text-sm text-white hidden sm:inline-block">All Events</span>
          </Link>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="rounded-full text-xs h-9 px-3.5 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 font-medium cursor-pointer shrink-0"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span>Share</span>
            </Button>
            <TactileButton
              size="sm"
              variant="primary"
              onClick={() => {
                window.location.href = "/events?tab=registrations";
              }}
              className="h-9 text-xs font-bold px-5 sm:px-6 shadow-lg whitespace-nowrap flex flex-row items-center justify-center gap-2 shrink-0"
            >
              <Ticket className="w-4 h-4 text-zinc-950 shrink-0" />
              <span className="whitespace-nowrap">My Passes</span>
            </TactileButton>
          </div>
        </div>
      </header>

      {/* Main Lu.ma Content (Wide Full-Screen Utilization) */}
      <main className="max-w-7xl 2xl:max-w-[1540px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-10 w-full flex-1 relative z-10">
        {isConcluded ? (
          /* ═════════════════════════════════════════════════════════════════════
             CONCLUDED PAST EVENT ARCHIVE: PHOTO SLIDER ON TOP, OPEN VERTICAL FLOW
             (Zero registration / ticketing / purchasing elements)
             ═════════════════════════════════════════════════════════════════════ */
          <div className="space-y-10 animate-in fade-in duration-300">
            {/* ── HEADER HERO OVERVIEW ────────────────────────────────────────── */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl relative overflow-hidden space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-black uppercase tracking-wider">
                  🏁 Concluded Event Archive
                </span>
                <span className="px-3 py-1 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60 text-xs font-bold font-mono">
                  {event.eventType ? event.eventType.toUpperCase() : "CONFERENCE"}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  /{event.slug}
                </span>
              </div>

              <div className="space-y-2 max-w-4xl">
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {event.title}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 font-normal leading-relaxed">
                  {event.shortDescription || event.description || "Official conference proceedings, scientific sessions, and photographic archive."}
                </p>
              </div>

              {/* 3 Metric Telemetry Tiles: Footfall, Dates, Venue */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-[#09090C] border border-[#222228] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Official Footfall</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono">
                    {event.postEventVisitorCount ? Number(event.postEventVisitorCount).toLocaleString("en-IN") : (event.totalParticipants ? Number(event.totalParticipants).toLocaleString("en-IN") : "500+")}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-medium">Verified Attendees</p>
                </div>

                <div className="p-4 rounded-2xl bg-[#09090C] border border-[#222228] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    <CalendarDays className="w-4 h-4 text-indigo-400" />
                    <span>Concluded On</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {event.startDate}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-medium">{event.endDate && event.endDate !== event.startDate ? `to ${event.endDate}` : "Single-Day Event"}</p>
                </div>

                <div className="p-4 rounded-2xl bg-[#09090C] border border-[#222228] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    <MapPin className="w-4 h-4 text-rose-400" />
                    <span>Venue Location</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {event.city || "Coimbatore"}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-medium truncate">{event.venue || "Sankara Eye Hospital"}</p>
                </div>
              </div>

              {/* Access Your Photos / Samaro AI Gallery Action Button */}
              {(() => {
                const photosGalleryUrl =
                  (event as any)?.photosUrl ||
                  (event as any)?.galleryUrl ||
                  (event?.slug?.toLowerCase().includes("vision") || event?.title?.toLowerCase().includes("vision")
                    ? "https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media"
                    : "https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media");

                return (
                  <div className="pt-2">
                    <a
                      href={photosGalleryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 hover:from-blue-600/30 hover:via-indigo-600/30 hover:to-purple-600/30 border border-indigo-500/40 hover:border-indigo-400/80 shadow-xl shadow-indigo-950/40 transition-all duration-300 transform active:scale-[0.99] cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 sm:gap-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-indigo-500/25 border border-indigo-400/40 flex items-center justify-center text-indigo-300 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-inner">
                          <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base font-black text-white group-hover:text-indigo-200 transition-colors flex items-center gap-1.5">
                              Access Your Photos &amp; Event Media
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-500/50 text-[10px] font-black uppercase tracking-wider">
                              Samaro.ai AI Gallery
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Browse, find your photos using AI facial recognition, and download high-resolution event media.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-indigo-300 group-hover:text-white group-hover:translate-x-1 transition-all pl-2 shrink-0">
                        <span className="text-xs font-bold hidden sm:inline">Open Gallery</span>
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </a>
                  </div>
                );
              })()}
            </div>

            {/* ── 1. 3D RANDOMIZED CURSOR-REACTIVE PHOTO EXHIBITION (ABOVE CONTENT) ── */}
            {galleryImages.length > 0 && (
              <Randomized3DPhotoGallery
                images={galleryImages}
                onEnlarge={(img) => setLightboxImage(img)}
              />
            )}

            {/* ── 2. SINGLE FULL-WIDTH OPEN EVENT SUMMARY (OPEN, NOT DOUBLE BOX) ── */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#141417]/80 border border-[#24242B] space-y-4 shadow-xl">
              <div className="flex items-center gap-3 pb-3 border-b border-[#222228]">
                <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-lg">
                  📝
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">Event Summary &amp; Overview</h2>
                  <p className="text-xs text-zinc-400">Comprehensive recap and proceedings of how the event unfolded.</p>
                </div>
              </div>

              <div className="text-sm sm:text-base text-zinc-200 leading-relaxed font-normal space-y-3 whitespace-pre-line pl-1 border-l-2 border-blue-500/40">
                {event.postEventSummary || event.description || "The event concluded with distinguished faculty lectures and enthusiastic delegate participation across all surgical and academic tracks."}
              </div>
            </div>

            {/* ── 3. SINGLE FULL-WIDTH OPEN KEY HIGHLIGHTS & SCIENTIFIC TRACKS ── */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#141417]/80 border border-[#24242B] space-y-4 shadow-xl">
              <div className="flex items-center gap-3 pb-3 border-b border-[#222228]">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-lg">
                  🎯
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">Key Highlights, Scientific Tracks &amp; Milestones</h2>
                  <p className="text-xs text-zinc-400">Academic milestones, thematic tracks, and surgical demonstrations.</p>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-3 pl-1 border-l-2 border-amber-500/40">
                {event.postEventDescription ? (
                  <div className="space-y-2 whitespace-pre-line font-normal">
                    {event.postEventDescription}
                  </div>
                ) : (
                  <p className="text-zinc-400">
                    Featuring comprehensive scientific tracks, live surgical demonstrations, and academic masterclasses led by chief ophthalmologists.
                  </p>
                )}
              </div>
            </div>

            {/* ── 4. SINGLE FULL-WIDTH DELIVERED EVENT AGENDA & SCHEDULE ──────── */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#141417]/80 border border-[#24242B] space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24242B]">
                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-indigo-400" />
                    <span>Delivered Event Agenda &amp; Program Schedule</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Chronological scientific timetable and session tracks delivered during the conference.
                  </p>
                </div>

                {/* PDF Download CTAs */}
                <div className="flex items-center gap-2 flex-wrap">
                  {event.agendaPdfUrl && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-[#2D2D35] bg-[#18181D] hover:bg-[#24242C] text-white text-xs font-bold h-9"
                    >
                      <a href={event.agendaPdfUrl} target="_blank" rel="noopener noreferrer" download>
                        <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                        <span>{event.agendaPdfName || "Download Agenda (PDF)"}</span>
                      </a>
                    </Button>
                  )}
                  {event.floorMapPdfUrl && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-[#2D2D35] bg-[#18181D] hover:bg-[#24242C] text-white text-xs font-bold h-9"
                    >
                      <a href={event.floorMapPdfUrl} target="_blank" rel="noopener noreferrer" download>
                        <Download className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                        <span>{event.floorMapPdfName || "Download Floor Map (PDF)"}</span>
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Agenda Single-Column Timeline Rows */}
              <div className="space-y-3">
                {agendaItems.map((slot, idx) => (
                  <div
                    key={slot.id || idx}
                    className="p-4 sm:p-5 rounded-2xl bg-[#09090C] border border-[#202026] hover:border-[#32323D] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#18181F] text-zinc-200 border border-[#2A2A35]">
                          {slot.timeFrom} – {slot.timeTo}
                        </span>
                        {slot.trackHall && (
                          <span className="text-xs text-zinc-400 font-medium">
                            📍 {slot.trackHall}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-black text-white">
                        {slot.title}
                      </h3>
                      {slot.description && (
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {slot.description}
                        </p>
                      )}
                    </div>

                    {slot.speaker && (
                      <div className="text-xs text-zinc-400 shrink-0 flex items-center gap-1.5 sm:border-l sm:border-[#202026] sm:pl-4">
                        <User className="w-4 h-4 text-zinc-500 shrink-0" />
                        <span><strong className="text-zinc-200 font-semibold">{slot.speaker}</strong></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── 5. SINGLE FULL-WIDTH CONCLUDING REMARKS & ACKNOWLEDGMENTS ───── */}
            {event.postEventEndingNotes && (
              <div className="p-6 sm:p-8 rounded-3xl bg-[#141417]/80 border border-[#26262D] space-y-3 shadow-xl">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🕊️</span>
                  <h2 className="text-base sm:text-lg font-black text-white">Concluding Remarks &amp; Acknowledgments</h2>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line pl-1 border-l-2 border-emerald-500/40">
                  {event.postEventEndingNotes}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ═════════════════════════════════════════════════════════════════════
             ACTIVE UPCOMING/ONGOING EVENT: 2-COLUMN REGISTRATION & DETAILS LAYOUT
             ═════════════════════════════════════════════════════════════════════ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-10 items-start">
            {/* ─── LEFT MAIN CONTENT COLUMN (7 cols) ─── */}
            <div className="lg:col-span-7 xl:col-span-7 space-y-6">
              {/* Cover Banner / Graphic (3D Futuristic Hologram Hero Banner) */}
              <EventHeroBanner event={event} seatsLeft={seatsLeft} isPaid={isPaid} isConcluded={isConcluded} />

              {/* Event Title & Narrative */}
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
                  {event.title}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 font-normal leading-relaxed">
                  {event.description || event.shortDescription || "Join us for this specialized session."}
                </p>
              </div>

              {/* Date & Location Side-by-Side Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Date Block */}
                <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                      <Calendar className="w-4 h-4 text-zinc-300" />
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h3 className="font-bold text-[11px] uppercase tracking-wider text-zinc-400">Date &amp; Time</h3>
                      <p className="text-xs sm:text-sm text-zinc-200 font-bold truncate">
                        {dateMeta.formatted}
                      </p>
                      <p className="text-[11px] text-zinc-400 font-mono flex items-center gap-1 pt-0.5">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>{dateMeta.time}</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCalendarModalOpen(true)}
                    className="rounded-xl text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 font-semibold h-7 self-start cursor-pointer gap-1 px-2"
                  >
                    <CalendarPlus className="w-3 h-3" />
                    <span>Add to Calendar</span>
                  </Button>
                </div>

                {/* Location Block */}
                <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-zinc-300" />
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h3 className="font-bold text-[11px] uppercase tracking-wider text-zinc-400">Venue Location</h3>
                      <p className="text-xs sm:text-sm text-zinc-200 font-bold leading-snug truncate">
                        {event.venue || "Sankara Eye Hospital"}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {event.city || "Coimbatore, Tamil Nadu"}
                      </p>
                    </div>
                  </div>
                  {event.locationMapUrl ? (
                    <a
                      href={event.locationMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-[11px] font-semibold text-blue-400 hover:underline self-start"
                    >
                      View on Google Maps →
                    </a>
                  ) : (
                    <span className="text-[11px] text-zinc-500 self-start">Grand Convention Hall</span>
                  )}
                </div>
              </div>

              {/* ── Compact 2-Column Event Schedule & Agenda ── */}
              <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-indigo-400" />
                      <h3 className="font-extrabold text-sm sm:text-base text-white">Event Schedule &amp; Agenda</h3>
                      <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-300">
                        {filteredItems.length} {filteredItems.length === 1 ? "Session" : "Sessions"}
                      </span>
                    </div>
                  </div>

                  {/* Day Tabs if multi-day */}
                  {uniqueDates.length > 1 && (
                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto overflow-x-auto max-w-full">
                      {uniqueDates.map((dStr, idx) => (
                        <button
                          key={dStr}
                          onClick={() => setSelectedDate(dStr)}
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            activeDate === dStr
                              ? "bg-white text-zinc-950 font-bold shadow-sm"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          Day {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category Filter Pills for Quick Navigation */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { id: "all", label: "All Sessions" },
                    { id: "keynote", label: "Keynotes" },
                    { id: "sessions", label: "Workshops & Tracks" },
                    { id: "breaks", label: "Dining & Breaks" },
                  ].map((pill) => (
                    <button
                      key={pill.id}
                      onClick={() => setAgendaCategory(pill.id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        agendaCategory === pill.id
                          ? "bg-white text-zinc-950 font-bold shadow-sm"
                          : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* 2-Column Responsive Timeline Items Grid with Compact Viewport */}
                <div className="max-h-[480px] overflow-y-auto pr-1 space-y-3 scrollbar-thin">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredItems.map((slot, idx) => {
                      const isTea = slot.type === "break_tea";
                      const isLunch = slot.type === "break_lunch";
                      const isKeynote = slot.type === "keynote";
                      const isWorkshop = slot.type === "workshop";
                      const isPanel = slot.type === "panel";

                      return (
                        <div
                          key={slot.id || idx}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2.5 ${
                            isTea
                              ? "bg-amber-950/20 border-amber-900/30 hover:border-amber-700/50"
                              : isLunch
                              ? "bg-blue-950/20 border-blue-900/30 hover:border-blue-700/50"
                              : isKeynote
                              ? "bg-purple-950/20 border-purple-900/30 hover:border-purple-700/50"
                              : isWorkshop
                              ? "bg-emerald-950/20 border-emerald-900/30 hover:border-emerald-700/50"
                              : isPanel
                              ? "bg-indigo-950/20 border-indigo-900/30 hover:border-indigo-700/50"
                              : "bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700"
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                  isTea
                                    ? "bg-amber-950/80 text-amber-300 border-amber-800/60"
                                    : isLunch
                                    ? "bg-blue-950/80 text-blue-300 border-blue-800/60"
                                    : isKeynote
                                    ? "bg-purple-950/80 text-purple-300 border-purple-800/60"
                                    : isWorkshop
                                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                                    : isPanel
                                    ? "bg-indigo-950/80 text-indigo-300 border-indigo-800/60"
                                    : "bg-zinc-800 text-zinc-300 border-zinc-700"
                                }`}
                              >
                                {isTea
                                  ? "Tea Break"
                                  : isLunch
                                  ? "Lunch Break"
                                  : isKeynote
                                  ? "Keynote"
                                  : isWorkshop
                                  ? "Workshop"
                                  : isPanel
                                  ? "Panel"
                                  : "Session"}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                                {slot.timeFrom} – {slot.timeTo}
                              </span>
                            </div>

                            <h4 className="font-bold text-xs sm:text-sm text-white leading-snug">
                              {slot.title}
                            </h4>

                            {slot.description && (
                              <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                                {slot.description}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
                            {slot.trackHall && (
                              <span className="truncate max-w-[140px] text-zinc-300 font-medium">
                                📍 {slot.trackHall}
                              </span>
                            )}
                            {slot.speaker && (
                              <span className="truncate max-w-[140px] text-zinc-400 italic">
                                {slot.speaker}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── RIGHT SIDEBAR / REGISTRATION COLUMN (5 cols) ─── */}
            <div className="lg:col-span-5 xl:col-span-5 sticky top-20 space-y-5">
              {/* Main Registration Card */}
              <div className="bg-[#141417]/95 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl space-y-5">
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Select Registration Pass
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Choose your delegation category to receive dynamic QR access.
                  </p>
                </div>

                {/* Role / Tier Multi-button Tabs Grid */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800/90">
                    {pricingTiers.map((tier) => {
                      const isSelected = activeTier.id === tier.id;
                      return (
                        <button
                          key={tier.id}
                          onClick={() => setSelectedRoleTierId(tier.id)}
                          className={`px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between min-h-[58px] ${
                            isSelected
                              ? "bg-white text-zinc-950 shadow-md font-bold ring-1 ring-white/50"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-900/80"
                          }`}
                        >
                          <span className="text-[11px] font-bold leading-tight block line-clamp-2">
                            {tier.name}
                          </span>
                          <span className={`text-[11px] font-mono font-bold mt-1 ${isSelected ? "text-zinc-950 font-black" : "text-zinc-400"}`}>
                            {isPaid ? `₹${(tier.earlyBirdPrice || tier.price).toLocaleString("en-IN")}` : "Free"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price Display with Early Bird Callout */}
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block">
                        {activeTier.name} Tariff
                      </span>
                      <div className="flex items-baseline gap-2 pt-0.5">
                        <h3 className="text-2xl sm:text-3xl font-black text-white">
                          {isPaid ? `₹${currentPassPrice.toLocaleString("en-IN")}` : "Free Pass"}
                        </h3>
                        {isEarlyBirdActive && activeTier.price > currentPassPrice && (
                          <span className="text-sm text-zinc-500 line-through font-semibold font-mono">
                            ₹{activeTier.price.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>

                    {isEarlyBirdActive && activeTier.price > currentPassPrice && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Save ₹{activeTier.price - currentPassPrice}
                      </span>
                    )}
                  </div>

                  {/* Early Bird Deadline Notification */}
                  {isEarlyBirdActive && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/40 px-2.5 py-1.5 rounded-xl border border-amber-800/40 font-medium">
                      <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        Early Bird Price active! Deadline in <strong className="font-bold">{daysLeftForEarlyBird} days</strong>
                      </span>
                    </div>
                  )}

                  {activeTier.description && (
                    <p className="text-xs text-zinc-400 leading-relaxed pt-1">
                      {activeTier.description}
                    </p>
                  )}

                  {/* Inclusions checklist for this role */}
                  {activeTier.inclusions && activeTier.inclusions.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                        Role Pass Privileges:
                      </span>
                      <ul className="space-y-1 text-xs text-zinc-300">
                        {activeTier.inclusions.map((inc: string, i: number) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{inc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Status details */}
                <div className="space-y-2 pt-1 text-xs text-zinc-400">
                  {event.requiresApproval ? (
                    <div className="flex items-center gap-2 text-amber-300 bg-amber-950/40 p-3 rounded-xl border border-amber-800/50 font-medium">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>Requires Coordinator Review &amp; Approval</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-300 bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/50 font-medium">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>Instant Digital Pass &amp; QR Badge</span>
                    </div>
                  )}

                  {isPaid && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 pt-0.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Discount coupons &amp; sponsored passes accepted at checkout</span>
                    </div>
                  )}
                </div>

                {/* Capacity and Seats Left Telemetry Box / Footfall Telemetry */}
                {isConcluded ? (
                  <div className="bg-[#141417] border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-amber-400" />
                        Official Event Footfall
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Event Concluded
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs pt-1">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
                          Total Attendance &amp; Footfall
                        </span>
                        <span className="text-2xl font-black text-white font-mono">
                          {(event.postEventVisitorCount || event.totalParticipants || (event as any).attendanceCount || 0).toLocaleString()}{" "}
                          <span className="text-xs text-zinc-400 font-normal">Attendees</span>
                        </span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
                          Max Capacity
                        </span>
                        <span className="text-sm font-black text-zinc-300 font-mono">
                          {maxCapacity} Max
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
                      This event has concluded. Registrations are closed.
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-4 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-blue-400" />
                        Seats Availability
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          seatsLeft === 0
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : seatsLeft <= 25
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {seatsLeft === 0 ? "Sold Out" : seatsLeft <= 25 ? "Filling Fast 🔥" : "Available"}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs pt-1">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
                          Seats Remaining
                        </span>
                        <span className="text-xl font-black text-white font-mono">
                          {seatsLeft} <span className="text-xs text-zinc-400 font-normal">left</span>
                        </span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
                          Total Capacity
                        </span>
                        <span className="text-sm font-black text-zinc-300 font-mono">
                          {maxCapacity} Max
                        </span>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="w-full h-2.5 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800 p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percentBooked >= 90
                              ? "bg-gradient-to-r from-amber-500 to-rose-500"
                              : "bg-gradient-to-r from-blue-500 to-emerald-400"
                          }`}
                          style={{ width: `${percentBooked}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium">
                        <span>{totalRegistered} Registered ({percentBooked}% filled)</span>
                        <span>{seatsLeft} Available</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary CTA */}
                <Button
                  asChild
                  className="w-full h-12 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  <Link href={`/events/${event.slug}/register?tier=${activeTier.id}`}>
                    {event.requiresApproval ? "Request to Join" : `Register as ${activeTier.name}`}
                  </Link>
                </Button>

                <p className="text-[11px] text-center text-zinc-500 font-medium">
                  Digital pass with dynamic QR check-in sent immediately after confirmation.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Comprehensive Sankara Eye Foundation India Footer (www.sankaraeye.com) ── */}
      <footer className="border-t border-[#242428] bg-[#09090B] text-zinc-400 text-xs mt-16">
        <div className="max-w-7xl 2xl:max-w-[1540px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-12 sm:py-16 space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Col 1: Brand & Bio */}
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
      {/* ── 1-Click Calendar Add Dialog ── */}
      <Dialog open={calendarModalOpen} onOpenChange={setCalendarModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#18181C] border border-[#2D2D35] text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
              <CalendarPlus className="w-5 h-5 text-indigo-400" />
              <span>Add to Your Calendar</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Select your preferred calendar provider to save <strong>{event.title}</strong> directly with schedule and location pre-filled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 pt-3">
            {/* Google Calendar */}
            <a
              href={getCalendarLinks().google}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setCalendarModalOpen(false)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#202026] border border-[#2C2C35] hover:bg-[#282830] hover:border-zinc-500 transition-all text-zinc-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2A2A35] flex items-center justify-center text-amber-400 font-black text-sm">
                  G
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-amber-100 transition-colors">Google Calendar</div>
                  <div className="text-[11px] text-zinc-400">Direct 1-click web sync</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white" />
            </a>

            {/* Microsoft Teams & Office 365 */}
            <a
              href={getCalendarLinks().office365}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setCalendarModalOpen(false)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#202026] border border-[#2C2C35] hover:bg-[#282830] hover:border-zinc-500 transition-all text-zinc-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2A2A35] flex items-center justify-center text-blue-400 font-black text-sm">
                  T
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-blue-100 transition-colors">Microsoft Teams &amp; Office 365</div>
                  <div className="text-[11px] text-zinc-400">Sync with institutional account</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white" />
            </a>

            {/* Outlook.com */}
            <a
              href={getCalendarLinks().outlook}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setCalendarModalOpen(false)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#202026] border border-[#2C2C35] hover:bg-[#282830] hover:border-zinc-500 transition-all text-zinc-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2A2A35] flex items-center justify-center text-sky-400 font-black text-sm">
                  O
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-sky-100 transition-colors">Outlook / Live</div>
                  <div className="text-[11px] text-zinc-400">Personal Microsoft Calendar</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white" />
            </a>

            {/* Apple Calendar / iCal File (.ics) */}
            <button
              type="button"
              onClick={() => {
                setCalendarModalOpen(false);
                handleDownloadIcs();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#202026] border border-[#2C2C35] hover:bg-[#282830] hover:border-zinc-500 transition-all text-zinc-200 group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2A2A35] flex items-center justify-center text-zinc-200 font-black text-sm">
                  
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-zinc-100 transition-colors">Apple Calendar &amp; Device Apps (.ics)</div>
                  <div className="text-[11px] text-zinc-400">Direct import for Mac, iPhone, &amp; Windows</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-zinc-500 group-hover:text-white" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Photo Gallery Lightbox Dialog ── */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent
          onContextMenu={(e) => e.preventDefault()}
          className="sm:max-w-4xl p-2 bg-black/95 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl select-none"
        >
          {lightboxImage && (
            <div className="relative aspect-video flex items-center justify-center bg-black select-none">
              <img
                src={lightboxImage}
                alt="Event Enlarged Capture"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl select-none pointer-events-none [-webkit-user-select:none] [-webkit-touch-callout:none]"
              />
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-white text-xs font-bold border border-zinc-700 cursor-pointer shadow"
              >
                Close ✕
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
