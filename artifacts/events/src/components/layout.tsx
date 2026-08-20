import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";
import { Button } from "@/components/ui/button";
import {
  LogOut, LayoutDashboard, Users, Utensils, QrCode,
  ClipboardList, Database, CalendarDays, Activity, ChevronDown, User2, Settings, Shield,
  ShieldAlert, ShieldCheck,
  Menu, X, BarChart2, RefreshCw, Layers, Sparkles, Building2,
  ArrowLeft, Check, Radio, MessageSquare, Tag, Bot,
} from "lucide-react";
import { UserProfileDialog } from "./user-profile-dialog";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface LayoutProps {
  children: ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  super_admin: "Super Admin",
  participant: "Faculty / Delegate",
  event_coordinator: "Event Coordinator",
  track_coordinator: "Track Coordinator",
  food_coordinator: "Food Coordinator",
  scientific_committee: "Scientific Committee",
  pr_member: "AV / Preview Room",
  coordinator_view_only: "Coordinator (View Only)",
};

export function AppLayout({ children }: LayoutProps) {
  const { user, token, logout } = useAuth();
  const { activeEvent, activeEventId, events, selectEvent, clearActiveEvent, setActiveEventId } = useActiveEvent();
  const [location, setLocation] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);

  if (!user) return <>{children}</>;

  const isStaff = (user.userType as string) === "super_admin" || (user.userType as string) === "admin" || (user.userType as string) === "event_coordinator";
  const isGlobalRoute = location === "/admin/events" || location === "/admin/system-users" || location === "/admin/traffic" || location === "/admin/logs" || location === "/admin/settings" || location === "/admin/sessions" || location === "/admin/chat-logs";

  // Determine if we should show Event-specific Workspace navigation or Global Event Directory navigation
  const inEventWorkspace = isStaff && !!activeEvent && !isGlobalRoute;

  const getNavItems = () => {
    switch (user.userType as string) {
      case "super_admin":
      case "admin":
      case "event_coordinator":
        if (inEventWorkspace && activeEvent) {
          const eid = activeEvent.id;
          const items = [
            { label: "Overview & Telemetry", href: `/admin/dashboard?eventId=${eid}`, icon: LayoutDashboard },
            { label: "Delegates & Registrations", href: `/admin/participants?eventId=${eid}`, icon: Users },
            { label: "ID Card Designing", href: `/admin/id-card-designer?eventId=${eid}`, icon: Sparkles },
            { label: "Exhibitors & Crew", href: `/admin/crew-vendors?eventId=${eid}`, icon: QrCode },
            { label: "On-Spot Registration Desk", href: `/admin/on-spot?eventId=${eid}`, icon: ClipboardList },
            { label: "Coordinators & Staff", href: `/admin/event-staff?eventId=${eid}`, icon: ShieldAlert },
          ];

          if (activeEvent.enableFood !== false) {
            items.push(
              { label: "Food Sessions", href: `/admin/food-sessions?eventId=${eid}`, icon: Utensils },
              { label: "Food Scanner", href: `/admin/food-scanner?eventId=${eid}`, icon: QrCode },
              { label: "Food Collection Logs", href: `/admin/food-logs?eventId=${eid}`, icon: ClipboardList }
            );
          }

          if (activeEvent.enableAttendance !== false) {
            items.push(
              { label: "Attendance Scanner", href: `/admin/attendance-scanner?eventId=${eid}`, icon: Activity },
              { label: "Attendance Logs", href: `/admin/attendance-logs?eventId=${eid}`, icon: CalendarDays }
            );
          }

          items.push(
            { label: "Agenda & PDF Editor", href: `/admin/event-sessions?eventId=${eid}`, icon: CalendarDays },
            { label: "WhatsApp Broadcast", href: `/admin/whatsapp?eventId=${eid}`, icon: MessageSquare },
            { label: "AI Chatbot Logs", href: `/admin/chat-logs`, icon: Bot }
          );

          return items;
        }

        // Global Navigation (when in Events Directory or Global settings)
        return [
          { label: "Events Directory", href: "/admin/events", icon: Layers },
          { label: "Staff & Coordinators", href: "/admin/system-users", icon: Database },
          { label: "Staff Active Sessions", href: "/admin/sessions", icon: Shield },
          { label: "Session Sync Engine", href: "/admin/sync-sessions", icon: RefreshCw },
          { label: "Traffic Telemetry", href: "/admin/traffic", icon: BarChart2 },
          { label: "AI Chatbot Logs", href: "/admin/chat-logs", icon: MessageSquare },
          { label: "Audit & System Logs", href: "/admin/logs", icon: ClipboardList },
          { label: "Global Settings", href: "/admin/settings", icon: Settings },
        ];

      case "participant":
        return [
          { label: "My Dashboard", href: "/participant/dashboard", icon: LayoutDashboard },
        ];
      case "track_coordinator":
        return [
          { label: "Track Dashboard", href: "/track/dashboard", icon: LayoutDashboard },
          { label: "Attendance Scanner", href: "/admin/attendance-scanner", icon: Activity },
        ];
      case "food_coordinator":
        return [
          { label: "Food Scanner", href: "/admin/food-scanner", icon: QrCode },
          { label: "Food Logs", href: "/admin/food-logs", icon: ClipboardList },
        ];
      case "scientific_committee":
      case "pr_member":
        return [
          { label: "Agenda & PDF Editor", href: "/admin/event-sessions", icon: CalendarDays },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const roleLabel = ROLE_LABELS[user.userType as string] || (user.userType as string).replace(/_/g, " ");

  const initials = user.name
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="h-screen bg-[#101012] text-[#ECECED] flex flex-col overflow-hidden font-sans selection:bg-amber-500/20 selection:text-white">
      {/* Lu.ma Dark Header */}
      <header className="bg-[#151518]/95 backdrop-blur-xl border-b border-[#242429] sticky top-0 z-40 text-zinc-100 shrink-0">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {navItems.length > 0 && (
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:bg-[#25252B] hover:text-white transition-colors mr-1 shrink-0"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Platform Brand */}
            <Link href={isStaff ? "/admin/events" : "/"} className="flex items-center gap-2.5 shrink-0 group cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-[#202025] border border-[#2D2D35] flex items-center justify-center p-1 shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
                <img
                  src="/sankara-eye-logo.png"
                  alt="Sankara Eye Care"
                  className="w-full h-full object-contain filter brightness-110 drop-shadow"
                />
              </div>
              <span className="font-black text-sm text-white tracking-tight hidden sm:inline-block">
                Sankara <span className="text-zinc-500 font-semibold">Events</span>
              </span>
            </Link>

            {/* Event Switcher or Breadcrumb for Staff */}
            {isStaff && inEventWorkspace && activeEvent ? (
              <div className="flex items-center gap-2 min-w-0 relative">
                <span className="text-zinc-700 hidden sm:inline">/</span>
                
                {/* Event Selector Dropdown Pill */}
                <div className="relative">
                  <button
                    onClick={() => setEventDropdownOpen(!eventDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#1D1D22] hover:bg-[#26262D] border border-[#2D2D35] text-xs font-bold text-white transition-all shadow-sm max-w-[220px] sm:max-w-[320px] truncate"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                    <span className="truncate">{activeEvent.title}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-0.5" />
                  </button>

                  {eventDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-72 bg-[#18181C] border border-[#2B2B32] rounded-2xl shadow-2xl z-50 p-1.5 text-zinc-200 animate-in fade-in-50 zoom-in-95">
                      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-[#242429]">
                        Switch Hosted Event
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
                        {events.map((ev) => (
                          <button
                            key={ev.id}
                            onClick={() => {
                              selectEvent(ev);
                              setEventDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors ${
                              ev.id === activeEvent.id
                                ? "bg-[#25252D] text-white font-bold"
                                : "text-zinc-300 hover:bg-[#1E1E24] hover:text-white"
                            }`}
                          >
                            <span className="truncate">{ev.title}</span>
                            {ev.id === activeEvent.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                      <div className="pt-1 border-t border-[#242429]">
                        <Link
                          href="/admin/events"
                          onClick={() => {
                            clearActiveEvent();
                            setEventDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-[#1E1E24] transition-colors"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>All Hosted Events</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#1F1F24] text-amber-200/90 border border-[#2D2D35] shrink-0 hidden md:inline-block">
              {roleLabel}
            </span>

            {/* Public Catalog Link */}
            <Link href="/events" className="hidden xl:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white font-medium transition-colors ml-2">
              <Building2 className="w-3.5 h-3.5" /> Public Feed
            </Link>
          </div>
          
          {/* User profile / details */}
          <div className="flex items-center gap-3 shrink-0">
            {isStaff && inEventWorkspace && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 text-xs font-semibold rounded-xl border-[#2D2D35] bg-[#1A1A1E] hover:bg-[#25252C] text-zinc-300 hover:text-white hidden sm:inline-flex items-center gap-1.5"
              >
                <Link href="/admin/events" onClick={() => clearActiveEvent()}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All Events</span>
                </Link>
              </Button>
            )}

            <div className="text-right hidden sm:block shrink-0">
              <div className="text-xs font-bold text-white truncate max-w-40">{user.name}</div>
              <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">{roleLabel}</div>
            </div>
            
            {/* Mobile Profile Trigger */}
            <div className="md:hidden">
              <button
                onClick={() => setEditProfileModalOpen(true)}
                className="w-7 h-7 rounded-full bg-[#2A2A31] border border-[#3A3A45] flex items-center justify-center text-white text-xs font-bold shadow-sm"
                title="My Profile"
              >
                {initials}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Lu.ma Dark Sidebar */}
        {navItems.length > 0 && (
          <aside className="w-64 bg-[#141417] border-r border-[#242429] hidden md:flex flex-col">
            {/* Event Workspace Header Banner (if in active event) */}
            {isStaff && inEventWorkspace && activeEvent && (
              <div className="p-3 pb-2 border-b border-[#242429] bg-[#16161A]/80">
                <Link
                  href="/admin/events"
                  onClick={() => clearActiveEvent()}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors mb-2 group cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                  <span>All Hosted Events</span>
                </Link>
                <div className="p-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2B2B33] space-y-1">
                  <div className="text-xs font-black text-white truncate">{activeEvent.title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase font-bold text-[9px]">
                      {activeEvent.eventType}
                    </span>
                    <span>{activeEvent.totalParticipants || 0} Regs</span>
                  </div>
                </div>
              </div>
            )}

            <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {inEventWorkspace ? "Event Workspace" : "Command Center"}
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                const currentClean = location.split("?")[0];
                const itemClean = item.href.split("?")[0];
                const isActive = currentClean === itemClean;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all duration-150 text-xs font-semibold group cursor-pointer ${
                      isActive
                        ? "bg-[#25252D] text-white shadow-sm font-bold border border-[#34343F]"
                        : "text-zinc-400 hover:bg-[#1C1C22] hover:text-zinc-200"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform duration-150 ${isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"}`}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Profile button — bottom left */}
            <div className="border-t border-[#242429] p-2.5 relative bg-[#131316]">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#1E1E23] transition-all duration-150 group text-left text-zinc-300 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#27272D] border border-[#383842] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{user.name}</div>
                  <div className="text-[10px] text-zinc-500 font-semibold truncate">{roleLabel}</div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#1A1A1E] rounded-2xl border border-[#2D2D35] shadow-2xl overflow-hidden z-50 text-zinc-200 animate-in slide-in-from-bottom-2 duration-150">
                  <div className="px-4 py-3 border-b border-[#26262B] bg-[#141417]">
                    <div className="text-xs font-bold text-white">{user.name}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 font-semibold">{(user as any).empId} · {roleLabel}</div>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); setEditProfileModalOpen(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-[#25252C] hover:text-white transition-colors border-b border-[#26262B] cursor-pointer"
                  >
                    <User2 className="w-4 h-4 text-zinc-400" />
                    My Profile
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto min-w-0 bg-[#101012]">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Overlay */}
      {navItems.length > 0 && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside className="relative flex w-64 max-w-xs flex-col bg-[#141417] p-4 shadow-2xl animate-in slide-in-from-left duration-300 z-50 text-zinc-100 border-r border-[#26262B]">
            <div className="flex items-center justify-between pb-4 border-b border-[#26262B] mb-2">
              <span className="text-sm font-bold text-white">
                {inEventWorkspace ? "Event Workspace" : "Navigation"}
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-[#25252B] text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isStaff && inEventWorkspace && activeEvent && (
              <div className="pb-3 mb-2 border-b border-[#26262B]">
                <Link
                  href="/admin/events"
                  onClick={() => {
                    clearActiveEvent();
                    setMobileMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All Events</span>
                </Link>
                <div className="text-xs font-bold text-white truncate mt-1">{activeEvent.title}</div>
              </div>
            )}

            <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const currentClean = location.split("?")[0];
                const itemClean = item.href.split("?")[0];
                const isActive = currentClean === itemClean;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-xs font-semibold ${
                      isActive
                        ? "bg-[#25252D] text-white shadow-sm font-bold border border-[#34343F]"
                        : "text-zinc-400 hover:bg-[#1E1E23] hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-[#26262B] pt-4 mt-auto">
              <div className="flex items-center gap-3 px-2 pb-3">
                <div className="w-8 h-8 rounded-full bg-[#27272D] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{user.name}</div>
                  <div className="text-[10px] text-zinc-500 font-semibold truncate">{roleLabel}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setEditProfileModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-[#25252C] rounded-xl transition-colors mb-1 text-left cursor-pointer"
              >
                <User2 className="w-4 h-4 text-zinc-400" />
                My Profile
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 rounded-xl transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}
      
      <UserProfileDialog
        open={editProfileModalOpen}
        onClose={() => setEditProfileModalOpen(false)}
        user={user}
        token={token}
      />
    </div>
  );
}

