import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Sparkles,
  ExternalLink,
  Download,
  Filter,
  Search,
  Grid,
  List,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

export interface LumaEvent {
  id: number;
  slug: string;
  title: string;
  eventType: string;
  description?: string | null;
  shortDescription?: string | null;
  venue?: string;
  city?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  timeFrom?: string | null;
  timeTo?: string | null;
  isPaid?: boolean;
  registrationFee?: number;
  maxCapacity?: number | null;
  seatsLeft?: number;
  totalParticipants?: number;
  postEventVisitorCount?: number | null;
  status?: string;
  bannerUrl?: string | null;
  badgeSubtitle?: string | null;
}

interface LumaCalendarProps {
  events: LumaEvent[];
  isLoading?: boolean;
  className?: string;
  defaultView?: "month" | "week" | "agenda";
}

const CATEGORY_THEMES: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  conference: {
    label: "Conference",
    bg: "bg-indigo-500/15 hover:bg-indigo-500/25",
    text: "text-indigo-300",
    border: "border-indigo-500/30",
    dot: "bg-indigo-400",
  },
  cme: {
    label: "CME & Academic",
    bg: "bg-emerald-500/15 hover:bg-emerald-500/25",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  workshop: {
    label: "Workshop",
    bg: "bg-amber-500/15 hover:bg-amber-500/25",
    text: "text-amber-300",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
  },
  internal_staff: {
    label: "Staff Internal",
    bg: "bg-purple-500/15 hover:bg-purple-500/25",
    text: "text-purple-300",
    border: "border-purple-500/30",
    dot: "bg-purple-400",
  },
  symposium: {
    label: "Symposium",
    bg: "bg-cyan-500/15 hover:bg-cyan-500/25",
    text: "text-cyan-300",
    border: "border-cyan-500/30",
    dot: "bg-cyan-400",
  },
};

const DEFAULT_THEME = {
  label: "Event",
  bg: "bg-blue-500/15 hover:bg-blue-500/25",
  text: "text-blue-300",
  border: "border-blue-500/30",
  dot: "bg-blue-400",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Helper to generate Google Calendar URL
function getGoogleCalendarUrl(ev: LumaEvent): string {
  const title = encodeURIComponent(ev.title);
  const details = encodeURIComponent(
    `${ev.shortDescription || ev.description || "Sankara Eye Care Institutions Event"}\n\nVenue: ${ev.venue || "Sankara Eye Hospital"}, ${ev.city || "Coimbatore"}\n\nRegister & View Details: ${typeof window !== "undefined" ? window.location.origin : ""}/events/${ev.slug || ev.id}`
  );
  const location = encodeURIComponent(`${ev.venue || "Sankara Eye Hospital"}, ${ev.city || "Coimbatore"}`);
  
  const startClean = (ev.startDate || "").replace(/-/g, "");
  const endClean = (ev.endDate || ev.startDate || "").replace(/-/g, "");
  const datesParam = `${startClean}T033000Z/${endClean}T123000Z`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${datesParam}`;
}

// Helper to generate .ICS file
function downloadIcsFile(ev: LumaEvent) {
  const startClean = (ev.startDate || "").replace(/-/g, "");
  const endClean = (ev.endDate || ev.startDate || "").replace(/-/g, "");
  const nowClean = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sankara Eye Care Institutions//Events Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:sankara-event-${ev.id}@events.sankaraeye.in`,
    `DTSTAMP:${nowClean}`,
    `DTSTART;VALUE=DATE:${startClean}`,
    `DTEND;VALUE=DATE:${endClean}`,
    `SUMMARY:${ev.title}`,
    `DESCRIPTION:${(ev.shortDescription || ev.title).replace(/\n/g, "\\n")}`,
    `LOCATION:${ev.venue || "Sankara Eye Hospital"}, ${ev.city || "Coimbatore"}`,
    `URL:${typeof window !== "undefined" ? window.location.origin : ""}/events/${ev.slug || ev.id}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute("download", `${ev.slug || `event-${ev.id}`}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  toast({
    title: "Calendar Event Downloaded (.ICS) 📅",
    description: `Added "${ev.title}" to your calendar download queue.`,
  });
}

// Download Master ICS file containing all events
function downloadAllEventsIcs(eventsList: LumaEvent[]) {
  const nowClean = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const eventsIcs = eventsList.map((ev) => {
    const startClean = (ev.startDate || "").replace(/-/g, "");
    const endClean = (ev.endDate || ev.startDate || "").replace(/-/g, "");
    return [
      "BEGIN:VEVENT",
      `UID:sankara-event-${ev.id}@events.sankaraeye.in`,
      `DTSTAMP:${nowClean}`,
      `DTSTART;VALUE=DATE:${startClean}`,
      `DTEND;VALUE=DATE:${endClean}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${(ev.shortDescription || ev.title).replace(/\n/g, "\\n")}`,
      `LOCATION:${ev.venue || "Sankara Eye Hospital"}, ${ev.city || "Coimbatore"}`,
      `URL:${typeof window !== "undefined" ? window.location.origin : ""}/events/${ev.slug || ev.id}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ].join("\r\n");
  }).join("\r\n");

  const fullIcs = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sankara Eye Care Institutions//Events Schedule//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Sankara Events Calendar",
    "METHOD:PUBLISH",
    eventsIcs,
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([fullIcs], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute("download", "sankara-events-schedule.ics");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  toast({
    title: "Complete Schedule Exported 📅",
    description: `Exported ${eventsList.length} conferences and CMEs into Apple / Google / Outlook calendar.`,
  });
}

export function LumaCalendar({
  events,
  isLoading = false,
  className = "",
  defaultView = "month",
}: LumaCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const today = new Date();
    if (events && events.length > 0) {
      const sorted = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const firstUpcoming = sorted.find((e) => new Date(e.startDate) >= today);
      if (firstUpcoming) return new Date(firstUpcoming.startDate + "T00:00:00");
      return new Date(sorted[sorted.length - 1].startDate + "T00:00:00");
    }
    return today;
  });

  const todayIso = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [viewMode, setViewMode] = useState<"month" | "week" | "agenda">(defaultView);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Filter events by category and search
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (activeCategory !== "all" && ev.eventType !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesVenue = (ev.venue || "").toLowerCase().includes(q) || (ev.city || "").toLowerCase().includes(q);
        const matchesDesc = (ev.description || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesVenue && !matchesDesc) return false;
      }
      return true;
    });
  }, [events, activeCategory, searchQuery]);

  // Events Map indexed by date string "YYYY-MM-DD"
  const eventsByDate = useMemo(() => {
    const map: Record<string, LumaEvent[]> = {};
    filteredEvents.forEach((ev) => {
      const start = new Date(ev.startDate + "T00:00:00");
      const end = ev.endDate ? new Date(ev.endDate + "T00:00:00") : start;

      const curr = new Date(start);
      while (curr <= end) {
        const dateStr = curr.toISOString().split("T")[0];
        if (!map[dateStr]) map[dateStr] = [];
        if (!map[dateStr].some((existing) => existing.id === ev.id)) {
          map[dateStr].push(ev);
        }
        curr.setDate(curr.getDate() + 1);
      }
    });
    return map;
  }, [filteredEvents]);

  // Selected Date Events
  const selectedDateEvents = useMemo(() => {
    return eventsByDate[selectedDate] || [];
  }, [eventsByDate, selectedDate]);

  // Generate Month Grid Days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const date = new Date(currentYear, currentMonth - 1, dayNum);
      const dateStr = date.toISOString().split("T")[0];
      days.push({
        date,
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayIso,
        events: eventsByDate[dateStr] || [],
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      const dateStr = date.toISOString().split("T")[0];
      days.push({
        date,
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayIso,
        events: eventsByDate[dateStr] || [],
      });
    }

    // Next month padding days to complete grid
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(currentYear, currentMonth + 1, i);
      const dateStr = date.toISOString().split("T")[0];
      days.push({
        date,
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayIso,
        events: eventsByDate[dateStr] || [],
      });
    }

    return days;
  }, [currentYear, currentMonth, todayIso, eventsByDate]);

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };
  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(todayIso);
  };

  // Week View Days calculation
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      return {
        date,
        dateStr,
        dayName: DAYS_OF_WEEK[date.getDay()],
        dayNumber: date.getDate(),
        isToday: dateStr === todayIso,
        events: eventsByDate[dateStr] || [],
      };
    });
  }, [currentDate, todayIso, eventsByDate]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ── 1. OBSIDIAN TOP BAR: Month Selector, View Switcher & Actions ── */}
      <div className="bg-[#121215] border border-[#222227] rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Month & Navigation Group */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-[#18181D] border border-[#2A2A33] rounded-2xl p-1 shadow-inner">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-[#23232B] rounded-xl cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <div className="px-3 py-1 text-center min-w-[150px]">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </h2>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-[#23232B] rounded-xl cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-10 px-4 rounded-2xl border-[#2B2B36] bg-[#18181D] hover:bg-[#23232B] text-zinc-200 hover:text-white text-xs font-bold shadow cursor-pointer"
            >
              Today
            </Button>
          </div>

          {/* Search, View Modes & Export Button */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Search Bar */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search events, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3.5 rounded-2xl bg-[#18181D] border border-[#2A2A33] text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
            </div>

            {/* View Mode Toggle: Month | Week | Agenda */}
            <div className="flex items-center bg-[#18181D] border border-[#2A2A33] rounded-2xl p-1">
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "month"
                    ? "bg-white text-zinc-950 shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Month</span>
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "week"
                    ? "bg-white text-zinc-950 shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Week</span>
              </button>
              <button
                onClick={() => setViewMode("agenda")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "agenda"
                    ? "bg-white text-zinc-950 shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Agenda</span>
              </button>
            </div>

            {/* Master Calendar Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadAllEventsIcs(filteredEvents)}
              className="h-10 px-3.5 rounded-2xl border-[#2B2B36] bg-[#18181D] hover:bg-[#23232B] text-zinc-200 hover:text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
              title="Subscribe to Calendar (.ICS)"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Export iCal</span>
            </Button>
          </div>
        </div>

        {/* Category Filter Pills Ribbon */}
        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-[#202026] overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filters:
          </span>
          {[
            { id: "all", label: "All Events", dot: "bg-white" },
            { id: "conference", label: "Conferences", dot: "bg-indigo-400" },
            { id: "cme", label: "CMEs", dot: "bg-emerald-400" },
            { id: "workshop", label: "Workshops", dot: "bg-amber-400" },
            { id: "internal_staff", label: "Staff Internal", dot: "bg-purple-400" },
            { id: "symposium", label: "Symposia", dot: "bg-cyan-400" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? "bg-zinc-100 text-zinc-950 font-bold shadow"
                  : "bg-[#18181D] text-zinc-400 hover:text-white hover:bg-[#24242C] border border-[#272730]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. MAIN CALENDAR BODY (SPLIT VIEW: GRID + DAY INSPECTOR) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Matrix View (8 cols) */}
        <div className="xl:col-span-8 space-y-4">
          {viewMode === "month" && (
            <div className="bg-[#121215] border border-[#222227] rounded-3xl overflow-hidden shadow-2xl">
              {/* Day Header Row */}
              <div className="grid grid-cols-7 border-b border-[#222227] bg-[#16161B]">
                {DAYS_OF_WEEK.map((d, idx) => (
                  <div
                    key={d}
                    className={`py-3 text-center text-xs font-bold uppercase tracking-wider ${
                      idx === 0 || idx === 6 ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* 7-Column Month Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-[#1F1F26] border-b border-[#1F1F26]">
                {calendarDays.map((day) => {
                  const isSelected = day.dateStr === selectedDate;
                  const hasEvents = day.events.length > 0;

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setSelectedDate(day.dateStr)}
                      className={`min-h-[110px] sm:min-h-[130px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between relative group ${
                        !day.isCurrentMonth
                          ? "bg-[#0D0D10]/50 text-zinc-600 opacity-60"
                          : isSelected
                          ? "bg-indigo-950/20 ring-2 ring-inset ring-indigo-500/80 z-10"
                          : "bg-[#121215] hover:bg-[#18181E]"
                      }`}
                    >
                      {/* Day Number Header */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                            day.isToday
                              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/40"
                              : isSelected
                              ? "bg-white text-zinc-950"
                              : day.isCurrentMonth
                              ? "text-zinc-300 group-hover:text-white"
                              : "text-zinc-600"
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {hasEvents && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {day.events.length}
                          </span>
                        )}
                      </div>

                      {/* Day Events Stack */}
                      <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                        {day.events.slice(0, 3).map((ev) => {
                          const theme = CATEGORY_THEMES[ev.eventType] || DEFAULT_THEME;
                          return (
                            <TooltipProvider key={ev.id} delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link
                                    href={`/events/${ev.slug || ev.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`block px-1.5 py-0.5 rounded-lg text-[10px] font-bold truncate border transition-all ${theme.bg} ${theme.text} ${theme.border}`}
                                  >
                                    <span className="mr-1 opacity-70">•</span>
                                    {ev.title}
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="bg-[#18181E] border border-[#2F2F3D] text-zinc-100 p-3 rounded-2xl shadow-2xl max-w-xs space-y-1.5"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${theme.bg} ${theme.text} ${theme.border}`}>
                                      {theme.label}
                                    </span>
                                    <span className="text-[10px] text-zinc-400">
                                      {ev.timeFrom || "09:00 AM"}
                                    </span>
                                  </div>
                                  <p className="text-xs font-bold text-white leading-snug">{ev.title}</p>
                                  <p className="text-[10px] text-zinc-400 truncate">📍 {ev.venue || "Sankara Eye Hospital"}</p>
                                  <p className="text-[10px] font-bold text-indigo-400 pt-0.5">Click date to view details →</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}

                        {day.events.length > 3 && (
                          <div className="text-[9px] font-bold text-zinc-500 px-1">
                            +{day.events.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "week" && (
            <div className="bg-[#121215] border border-[#222227] rounded-3xl overflow-hidden shadow-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-[#202028]">
                {weekDays.map((day) => {
                  const isSelected = day.dateStr === selectedDate;
                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setSelectedDate(day.dateStr)}
                      className={`p-3 min-h-[300px] flex flex-col justify-start transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-950/20 ring-2 ring-inset ring-indigo-500/80"
                          : "bg-[#121215] hover:bg-[#18181F]"
                      }`}
                    >
                      <div className="border-b border-[#22222A] pb-2 mb-2 text-center">
                        <p className="text-[10px] font-bold uppercase text-zinc-400">{day.dayName}</p>
                        <p
                          className={`text-xl font-black mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full ${
                            day.isToday ? "bg-indigo-500 text-white" : "text-white"
                          }`}
                        >
                          {day.dayNumber}
                        </p>
                      </div>

                      <div className="space-y-2 flex-1">
                        {day.events.map((ev) => {
                          const theme = CATEGORY_THEMES[ev.eventType] || DEFAULT_THEME;
                          return (
                            <Link
                              key={ev.id}
                              href={`/events/${ev.slug || ev.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className={`block p-2 rounded-xl text-left border space-y-1 transition-all group ${theme.bg} ${theme.border}`}
                            >
                              <span className={`text-[9px] font-black uppercase tracking-wider block ${theme.text}`}>
                                {ev.timeFrom || "09:00 AM"}
                              </span>
                              <p className="text-xs font-bold text-white group-hover:text-zinc-200 line-clamp-2 leading-tight">
                                {ev.title}
                              </p>
                              <p className="text-[9px] text-zinc-400 truncate">
                                📍 {ev.city || "Coimbatore"}
                              </p>
                            </Link>
                          );
                        })}

                        {day.events.length === 0 && (
                          <div className="h-full flex items-center justify-center text-center p-3 text-zinc-600 text-[11px]">
                            No events
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "agenda" && (
            <div className="space-y-4">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-16 bg-[#121215] border border-[#222227] rounded-3xl p-6 text-zinc-500">
                  <CalendarIcon className="w-12 h-12 text-zinc-600 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold text-white">No Events Found</p>
                  <p className="text-xs text-zinc-500 mt-1">Try resetting search or filter criteria.</p>
                </div>
              ) : (
                filteredEvents.map((ev) => {
                  const theme = CATEGORY_THEMES[ev.eventType] || DEFAULT_THEME;
                  const isConcluded = ev.status === "completed" || (ev.endDate ? ev.endDate < todayIso : ev.startDate < todayIso);
                  const footfall = ev.postEventVisitorCount || ev.totalParticipants || 0;

                  return (
                    <div
                      key={ev.id}
                      className="bg-[#121215] hover:bg-[#17171C] border border-[#222227] hover:border-zinc-700 rounded-3xl p-5 transition-all shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-[#0B0B0E] border border-[#24242C] flex flex-col items-center justify-center shrink-0 text-center">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase">
                            {new Date(ev.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="text-xl font-black text-white leading-none">
                            {new Date(ev.startDate + "T00:00:00").getDate()}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${theme.bg} ${theme.text} ${theme.border}`}>
                              {theme.label}
                            </span>
                            {ev.timeFrom && (
                              <span className="text-xs text-zinc-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {ev.timeFrom} – {ev.timeTo || "05:00 PM"}
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-white hover:text-indigo-300 transition-colors">
                            <Link href={`/events/${ev.slug || ev.id}`}>{ev.title}</Link>
                          </h3>

                          <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-zinc-500" />
                              {ev.venue || "Sankara Eye Hospital"}, {ev.city || "Coimbatore"}
                            </span>
                            {isConcluded ? (
                              <span className="text-amber-400 font-semibold flex items-center gap-1">
                                <Users className="w-3 h-3" /> {footfall > 0 ? `${footfall.toLocaleString()} Footfall` : "Concluded"}
                              </span>
                            ) : ev.seatsLeft !== undefined ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <Users className="w-3 h-3" /> {ev.seatsLeft} seats left
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => downloadIcsFile(ev)}
                          className="h-9 w-9 rounded-xl border-[#2A2A33] bg-[#18181D] hover:bg-[#23232B] text-zinc-300 hover:text-white"
                          title="Add to iCal (.ICS)"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          asChild
                          className="h-9 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-black px-4 shadow"
                        >
                          <Link href={`/events/${ev.slug || ev.id}`}>
                            {isConcluded ? "View Wrapup" : "Register Now →"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── 3. RIGHT SPLIT: "EVENTS ON SELECTED DATE" INSPECTOR ── */}
        <div className="xl:col-span-4 bg-[#121215] border border-[#222227] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 sticky top-20">
          {/* Active Date Header */}
          <div className="border-b border-[#22222A] pb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <CalendarIcon className="w-4 h-4" />
                <span>Selected Date</span>
              </div>
              <h3 className="text-xl font-black text-white mt-1">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </h3>
            </div>

            {selectedDate === todayIso && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Today
              </span>
            )}
          </div>

          {/* Schedule Feed for Clicked Date */}
          <div className="space-y-4">
            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-10 space-y-3 bg-[#0E0E11] rounded-2xl border border-[#1E1E24] p-5">
                <Sparkles className="w-8 h-8 text-zinc-600 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-zinc-300">No Events Scheduled</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    There are no conferences or CMEs registered on this date.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToday}
                  className="rounded-xl border-[#2A2A33] bg-[#18181D] text-zinc-300 text-xs h-8"
                >
                  Jump to Today
                </Button>
              </div>
            ) : (
              selectedDateEvents.map((ev) => {
                const theme = CATEGORY_THEMES[ev.eventType] || DEFAULT_THEME;
                const isConcluded = ev.status === "completed" || (ev.endDate ? ev.endDate < todayIso : ev.startDate < todayIso);
                const googleCalUrl = getGoogleCalendarUrl(ev);

                return (
                  <div
                    key={ev.id}
                    className="p-4 rounded-2xl bg-[#16161B] border border-[#26262F] hover:border-zinc-600 transition-all space-y-3 shadow-lg"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${theme.bg} ${theme.text} ${theme.border}`}>
                        {theme.label}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">
                        {ev.timeFrom || "09:00 AM"} – {ev.timeTo || "05:00 PM"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white leading-snug">
                        {ev.title}
                      </h4>
                      {ev.shortDescription && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                          {ev.shortDescription}
                        </p>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 space-y-1 pt-1 border-t border-[#222229]">
                      <p className="truncate flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span>{ev.venue || "Sankara Eye Hospital"}, {ev.city || "Coimbatore"}</span>
                      </p>
                      <div className="flex items-center justify-between text-xs font-semibold pt-1">
                        <span className="text-zinc-300">
                          {ev.isPaid ? `₹${ev.registrationFee?.toLocaleString("en-IN")}` : "Free Admission"}
                        </span>
                        {isConcluded ? (
                          <span className="text-amber-400 font-bold">Event Concluded</span>
                        ) : ev.seatsLeft !== undefined ? (
                          <span className="text-emerald-400 font-bold">{ev.seatsLeft} seats left</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <a
                        href={googleCalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="h-8 rounded-xl border border-[#2B2B36] bg-[#1E1E24] hover:bg-[#282830] text-zinc-300 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-indigo-400" />
                        <span>Google Cal</span>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadIcsFile(ev)}
                        className="h-8 rounded-xl border-[#2B2B36] bg-[#1E1E24] hover:bg-[#282830] text-zinc-300 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3 h-3 text-emerald-400" />
                        <span>iCal (.ics)</span>
                      </Button>
                    </div>

                    <Button
                      asChild
                      className="w-full h-9 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs shadow cursor-pointer"
                    >
                      <Link href={`/events/${ev.slug || ev.id}`}>
                        {isConcluded ? "View Event Summary & Gallery" : "Register & View Details →"}
                      </Link>
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
