import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Utensils,
  QrCode,
  Activity,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Building2,
  CalendarDays,
  Clock,
  MapPin,
  Sparkles,
  ExternalLink,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Layers,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";

import { KPIMetricCard } from "@/components/3d/kpi-metric-card";
import { PerspectiveCard } from "@/components/3d/perspective-card";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function AdminDashboard() {
  const { token, user: currentUser } = useAuth();
  const { activeEvent, activeEventId, events, isLoadingEvents, selectEvent, clearActiveEvent } = useActiveEvent();
  const [, setLocation] = useLocation();

  // Resolve current event: activeEvent -> match by activeEventId -> first event
  const currentEvent = activeEvent || (events && events.length > 0 ? (events.find((e) => e.id === activeEventId) || events[0]) : null);
  const currentEventId = activeEventId || currentEvent?.id;

  // Query event-specific dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats", currentEventId],
    queryFn: async () => {
      const url = currentEventId
        ? `${BASE_URL}/api/dashboard/stats?eventId=${currentEventId}`
        : `${BASE_URL}/api/dashboard/stats`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load dashboard stats");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 15000,
  });

  // Query recent activity
  const { data: activity, isLoading: activityLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/recent-activity"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/dashboard/recent-activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  if (isLoadingEvents || (!currentEvent && statsLoading)) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
        <Skeleton className="h-44 bg-[#18181C] rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 bg-[#18181C] rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!currentEvent && !statsLoading && !isLoadingEvents) {
    return (
      <div className="p-12 text-center text-zinc-400 bg-[#151518] rounded-3xl border border-[#26262B] space-y-4 max-w-xl mx-auto my-12">
        <Layers className="w-12 h-12 mx-auto text-zinc-600" />
        <h2 className="text-xl font-bold text-white">No Event Selected</h2>
        <p className="text-xs text-zinc-400">
          Please select an event from the Events Directory to inspect its telemetry and operations.
        </p>
        <Button asChild className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs border-none">
          <Link href="/admin/events">Go to Events Management →</Link>
        </Button>
      </div>
    );
  }

  // Query pending wrapup alerts for concluded events
  const { data: wrapupAlertsData } = useQuery<{
    hasPendingAlerts: boolean;
    pendingEvents: any[];
  }>({
    queryKey: ["/api/events/alerts/pending-wrapup"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/events/alerts/pending-wrapup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { hasPendingAlerts: false, pendingEvents: [] };
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10000,
  });

  const totalRegs = stats?.totalRegistrations ?? (currentEvent?.totalParticipants || 0);
  const totalAtt = stats?.totalAttendance ?? 0;
  const attendancePct = totalRegs > 0 ? Math.min(100, Math.round((totalAtt / totalRegs) * 100)) : 0;
  const paidCount = stats?.paidCount ?? 0;

  return (
    <div className="space-y-6 text-zinc-100 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* ── ACTION REQUIRED: PENDING POST-EVENT WRAPUP ALERT BANNER ──────── */}
      {wrapupAlertsData?.hasPendingAlerts && wrapupAlertsData.pendingEvents.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-950/40 border-2 border-amber-500/50 shadow-2xl space-y-3 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-amber-300">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Action Required: Post-Event Wrapup &amp; Photos Pending
                </h2>
                <p className="text-xs text-amber-200/80">
                  {wrapupAlertsData.pendingEvents.length} event(s) have ended. Please upload the minimum 10 photos, summary, and visitor count to complete them.
                </p>
              </div>
            </div>

            <Button asChild className="rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs border-none shrink-0 shadow">
              <Link href="/admin/events">Upload Photos in Events Directory →</Link>
            </Button>
          </div>
        </div>
      )}

      {/* ── ACTIVE EVENT OVERVIEW BANNER (LU.MA OBSIDIAN AESTHETIC) ────────── */}
      {currentEvent && (
        <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#202026] text-zinc-300 border border-[#2F2F38] uppercase font-bold tracking-wider">
                  {currentEvent.eventType}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  currentEvent.status === "published" || currentEvent.status === "ongoing"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}>
                  {currentEvent.status === "published" ? "Live & Published" : currentEvent.status}
                </span>
                {currentEvent.isPaid ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono">
                    ₹{currentEvent.registrationFee} Registration Fee
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60 font-mono">
                    Free Admission Pass
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {currentEvent.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <CalendarDays className="w-3.5 h-3.5 text-zinc-500" />
                  {currentEvent.startDate} {currentEvent.endDate && currentEvent.endDate !== currentEvent.startDate ? `to ${currentEvent.endDate}` : ""}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  {currentEvent.timeFrom || "09:00 AM"} – {currentEvent.timeTo || "05:00 PM"}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  {currentEvent.venue}, {currentEvent.city}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 px-4 rounded-xl border-[#2B2B32] bg-[#101013] hover:bg-[#1C1C22] text-zinc-300 hover:text-white text-xs font-bold"
              >
                <Link href={`/events/${currentEvent.slug}`} target="_blank">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  <span>Public Page</span>
                </Link>
              </Button>

              <Button
                asChild
                size="sm"
                className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold shadow-md cursor-pointer border-none"
              >
                <Link href={`/admin/participants?eventId=${currentEvent.id}`}>
                  <span>View Delegates →</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4 EVENT-SPECIFIC KPI TELEMETRY CARDS ──────────────────────────── */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 bg-[#18181C] rounded-3xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Registered */}
          <div
            onClick={() => setLocation(`/admin/participants?eventId=${currentEventId}`)}
            className="cursor-pointer"
          >
            <KPIMetricCard
              title="Total Registrations"
              value={totalRegs}
              subtitle={`Prior: ${stats.priorRegistrations ?? 0} | On-Spot: ${stats.onSpotRegistrations ?? 0}`}
              icon={Users}
              color="amber"
            />
          </div>

          {/* 2. Attendance Check-ins */}
          <div
            onClick={() => setLocation(`/admin/attendance-logs?eventId=${currentEventId}`)}
            className="cursor-pointer"
          >
            <KPIMetricCard
              title="Attendance Scans"
              value={totalAtt}
              subtitle={`${attendancePct}% of registered attendees`}
              icon={QrCode}
              color="emerald"
            />
          </div>

          {/* 3. Food Telemetry */}
          <div
            onClick={() => setLocation(`/admin/food-logs?eventId=${currentEventId}`)}
            className="cursor-pointer"
          >
            <KPIMetricCard
              title="Meals Served"
              value={
                stats.foodStats?.reduce((acc: number, item: any) => acc + (item.servedCount || 0), 0) ?? 0
              }
              subtitle={`${stats.foodStats?.length || 0} active meal sessions`}
              icon={Utensils}
              color="blue"
            />
          </div>

          {/* 4. Payment / Admissions */}
          <div
            onClick={() => setLocation(`/admin/participants?eventId=${currentEventId}`)}
            className="cursor-pointer"
          >
            <KPIMetricCard
              title={currentEvent?.isPaid ? "Paid Registrations" : "Approved Passes"}
              value={currentEvent?.isPaid ? paidCount : totalRegs}
              subtitle={
                currentEvent?.isPaid
                  ? `₹${(paidCount * (currentEvent?.registrationFee || 0)).toLocaleString("en-IN")} collected`
                  : "Digital badges verified"
              }
              icon={CreditCard}
              color="purple"
            />
          </div>
        </div>
      ) : null}

      {/* ── LIVE FOOD TELEMETRY & RECENT AUDIT STREAM ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Food Section */}
        <div className="lg:col-span-2 space-y-6">
          <PerspectiveCard depth={6} className="bg-[#151518] border border-[#26262B] rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#26262B]">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm text-white">Event Meal Collection Telemetry</h3>
              </div>
              <Link
                href={`/admin/food-logs?eventId=${currentEventId}`}
                className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <span>View Food Logs</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {statsLoading ? (
              <Skeleton className="h-40 bg-[#1D1D22] rounded-2xl" />
            ) : stats?.foodStats && stats.foodStats.length > 0 ? (
              <div className="space-y-3">
                {stats.foodStats.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-[#111114] border border-[#26262B] flex items-center justify-between shadow-inner"
                  >
                    <div>
                      <span className="font-bold text-xs text-white block">{item.sessionName}</span>
                      <span className="text-[11px] text-zinc-500 font-medium">{item.mealType} • Active Today</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-white">{item.servedCount || 0}</span>
                      <span className="text-[11px] text-zinc-500 block">Served</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
                <Utensils className="w-8 h-8 mx-auto text-zinc-600" />
                <p>No meal collection sessions logged for this event today.</p>
                <Button asChild size="sm" variant="outline" className="rounded-xl border-[#2B2B32] text-xs mt-2">
                  <Link href={`/admin/food-sessions?eventId=${currentEventId}`}>Configure Food Sessions →</Link>
                </Button>
              </div>
            )}
          </PerspectiveCard>
        </div>

        {/* Live Activity Feed */}
        <div className="space-y-6">
          <PerspectiveCard depth={6} className="bg-[#151518] border border-[#26262B] rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#26262B]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Live Activity Stream</h3>
              </div>
              <Link
                href="/admin/logs"
                className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <span>Audit Logs</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {activityLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 bg-[#1D1D22] rounded-xl" />
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {activity.map((log: any, i: number) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl bg-[#111114] border border-[#26262B] text-xs space-y-1 shadow-sm"
                  >
                    <p className="text-zinc-200 font-medium leading-snug">{log.message}</p>
                    <span className="text-[10px] text-zinc-500 font-mono block">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "Just now"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-zinc-500 space-y-1">
                <Activity className="w-6 h-6 mx-auto text-zinc-600 mb-2" />
                <p>No activity records logged yet today.</p>
              </div>
            )}
          </PerspectiveCard>
        </div>
      </div>
    </div>
  );
}
