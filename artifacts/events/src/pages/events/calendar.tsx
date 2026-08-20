import React, { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  Sparkles,
  Award,
  Grid,
  MapPin,
  CheckCircle2,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LumaCalendar, type LumaEvent } from "@/components/events/luma-calendar";

export default function EventsCalendarPage() {
  useEffect(() => {
    document.title = "Events Schedule & Academic Calendar | Sankara Eye Foundation India";
  }, []);

  const { data: eventsData, isLoading } = useQuery<{ events: LumaEvent[] }>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const events = eventsData?.events || [];

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-zinc-100 selection:bg-indigo-500 selection:text-white pb-20">
      {/* ── TOP HERO HEADER (Obsidian Lu.ma Style) ── */}
      <div className="border-b border-[#1E1E24] bg-gradient-to-b from-[#141418] via-[#0E0E12] to-[#0A0A0C] pt-8 pb-10 sm:pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Breadcrumbs & Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Event Directory
            </Link>

            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-[#2B2B36] bg-[#16161B] hover:bg-[#202027] text-zinc-300 text-xs font-bold px-3.5"
              >
                <Link href="/events">
                  <Grid className="w-3.5 h-3.5 mr-1.5" />
                  List / Grid View
                </Link>
              </Button>

              <Button
                asChild
                size="sm"
                className="h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 shadow-lg shadow-indigo-600/30"
              >
                <Link href="/my-registrations">
                  <Ticket className="w-3.5 h-3.5 mr-1.5" />
                  My Passes
                </Link>
              </Button>
            </div>
          </div>

          {/* Hero Title & Subtext */}
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Sankara National Academic Schedule</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-none">
              Events &amp; CME Calendar
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
              Explore upcoming ophthalmic conferences, accredited clinical CMEs, surgical workshops, and academic symposia across Sankara Eye Care network hospitals nationwide.
            </p>
          </div>
        </div>
      </div>

      {/* ── CALENDAR CORE CONTAINER ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <LumaCalendar events={events} isLoading={isLoading} defaultView="month" />
      </div>
    </div>
  );
}
