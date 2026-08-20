import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useActiveEvent } from "@/hooks/use-active-event";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Plus,
  Trash2,
  FileText,
  Upload,
  ExternalLink,
  Clock,
  MapPin,
  User,
  Coffee,
  Utensils,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Layers,
  ChevronDown,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type AgendaSlot = {
  id: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  title: string;
  type: "session" | "break_tea" | "break_lunch" | "keynote" | "panel" | "workshop";
  speaker?: string;
  trackHall?: string;
  description?: string;
};

const DEFAULT_SAMPLE_AGENDA: AgendaSlot[] = [
  {
    id: "slot-1",
    date: new Date().toISOString().slice(0, 10),
    timeFrom: "08:30 AM",
    timeTo: "09:30 AM",
    title: "Delegate Registration & Breakfast Kit Collection",
    type: "session",
    trackHall: "Main Lobby & Registration Counters",
    speaker: "On-Spot Coordinator Desk",
    description: "Badge verification and entry barcode scanning",
  },
  {
    id: "slot-2",
    date: new Date().toISOString().slice(0, 10),
    timeFrom: "09:30 AM",
    timeTo: "10:30 AM",
    title: "Inaugural Ceremony & Presidential Keynote",
    type: "keynote",
    trackHall: "Main Auditorium Hall A",
    speaker: "Chief Medical Director & Guest of Honor",
    description: "Welcome address and ceremonial inauguration",
  },
  {
    id: "slot-3",
    date: new Date().toISOString().slice(0, 10),
    timeFrom: "11:00 AM",
    timeTo: "11:30 AM",
    title: "Morning High Tea & Scientific Poster Exhibition",
    type: "break_tea",
    trackHall: "Exhibition Dining Foyer",
    speaker: "All Delegates",
    description: "Networking coffee and visit to partner stalls",
  },
  {
    id: "slot-4",
    date: new Date().toISOString().slice(0, 10),
    timeFrom: "01:00 PM",
    timeTo: "02:00 PM",
    title: "Grand Buffet Lunch & Delegate Networking",
    type: "break_lunch",
    trackHall: "Main Dining Hall",
    speaker: "Catering Team",
    description: "Digital food coupon scanning at lunch counters",
  },
];

export default function AdminAgendaEditor() {
  const { token, user } = useAuth();
  const { activeEvent, activeEventId } = useActiveEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isCoordinatorViewOnly = user?.userType === "coordinator_view_only";

  // Event Details State
  const [targetEventId, setTargetEventId] = useState<number | null>(null);
  const [agendaSlots, setAgendaSlots] = useState<AgendaSlot[]>([]);
  const [agendaPdfUrl, setAgendaPdfUrl] = useState("");
  const [agendaPdfButtonText, setAgendaPdfButtonText] = useState("Download Event Agenda (PDF)");
  const [customPdfUrl, setCustomPdfUrl] = useState("");
  const [customPdfButtonText, setCustomPdfButtonText] = useState("View Floor Map & Stalls (PDF)");

  const [uploadingAgenda, setUploadingAgenda] = useState(false);
  const [uploadingCustom, setUploadingCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch all events for the event switcher
  const { data: allEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/events/admin-list"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  // Sync selected event ID
  useEffect(() => {
    if (activeEventId) {
      setTargetEventId(activeEventId);
    } else if (allEvents.length > 0 && !targetEventId) {
      setTargetEventId(allEvents[0].id);
    }
  }, [activeEventId, allEvents]);

  // Fetch target event full details
  const { data: currentEvent, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/events/detail", targetEventId],
    queryFn: async () => {
      if (!targetEventId) return null;
      const res = await fetch(`${BASE_URL}/api/events/${targetEventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load event");
      return res.json();
    },
    enabled: !!token && !!targetEventId,
  });

  // Populate local form states when current event changes
  useEffect(() => {
    if (!currentEvent) return;

    setAgendaPdfUrl(currentEvent.agendaPdfUrl || "");
    setAgendaPdfButtonText(currentEvent.agendaPdfButtonText || "Download Event Agenda (PDF)");
    setCustomPdfUrl(currentEvent.customPdfUrl || "");
    setCustomPdfButtonText(currentEvent.customPdfButtonText || "View Floor Map & Stalls (PDF)");

    try {
      const parsed = currentEvent.agendaJson ? JSON.parse(currentEvent.agendaJson) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setAgendaSlots(parsed);
      } else {
        setAgendaSlots(
          DEFAULT_SAMPLE_AGENDA.map((s) => ({
            ...s,
            date: currentEvent.startDate || new Date().toISOString().slice(0, 10),
          }))
        );
      }
    } catch {
      setAgendaSlots(DEFAULT_SAMPLE_AGENDA);
    }
  }, [currentEvent]);

  // Add a new agenda slot
  const addSlot = (preset?: Partial<AgendaSlot>) => {
    const newSlot: AgendaSlot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: preset?.date || currentEvent?.startDate || new Date().toISOString().slice(0, 10),
      timeFrom: preset?.timeFrom || "09:00 AM",
      timeTo: preset?.timeTo || "10:00 AM",
      title: preset?.title || "New Scientific Session",
      type: preset?.type || "session",
      speaker: preset?.speaker || "",
      trackHall: preset?.trackHall || "Main Hall A",
      description: preset?.description || "",
    };
    setAgendaSlots((prev) => [...prev, newSlot]);
  };

  // Update a specific slot
  const updateSlot = (id: string, updates: Partial<AgendaSlot>) => {
    setAgendaSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Remove a slot
  const removeSlot = (id: string) => {
    setAgendaSlots((prev) => prev.filter((s) => s.id !== id));
  };

  // Handle PDF Upload
  const handlePdfUpload = async (file: File, target: "agenda" | "custom") => {
    if (!file) return;
    const isAgenda = target === "agenda";
    if (isAgenda) setUploadingAgenda(true);
    else setUploadingCustom(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${BASE_URL}/api/events/upload-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload PDF");
      }

      const data = await res.json();
      if (isAgenda) {
        setAgendaPdfUrl(data.url);
        toast({ title: "Agenda PDF Uploaded ✓", description: data.originalName });
      } else {
        setCustomPdfUrl(data.url);
        toast({ title: "Secondary PDF Uploaded ✓", description: data.originalName });
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      if (isAgenda) setUploadingAgenda(false);
      else setUploadingCustom(false);
    }
  };

  // Save All Changes (PDFs + Agenda Schedule)
  const handleSaveAll = async () => {
    if (!targetEventId || !currentEvent) return;
    setSaving(true);

    try {
      const payload = {
        ...currentEvent,
        agendaPdfUrl: agendaPdfUrl.trim() || null,
        agendaPdfButtonText: agendaPdfButtonText.trim() || "Download Event Agenda (PDF)",
        customPdfUrl: customPdfUrl.trim() || null,
        customPdfButtonText: customPdfButtonText.trim() || "View Floor Map & Stalls (PDF)",
        agendaJson: JSON.stringify(agendaSlots),
      };

      const res = await fetch(`${BASE_URL}/api/events/${targetEventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save agenda");
      }

      toast({
        title: "Agenda & PDFs Saved Successfully ✓",
        description: `Updated schedule (${agendaSlots.length} slots) and PDF buttons for "${currentEvent.title}".`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/events/detail", targetEventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/admin-list"] });
    } catch (err: any) {
      toast({ title: "Error Saving", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-zinc-100 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Agenda &amp; PDF Editor
            </h1>
            {currentEvent && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#202028] text-zinc-300 border border-[#2F2F38]">
                {currentEvent.title}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure event scientific timetable and upload official PDF brochures with custom buttons for attendee QR scans.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Event Switcher */}
          {allEvents.length > 1 && (
            <Select
              value={String(targetEventId || "")}
              onValueChange={(val) => setTargetEventId(Number(val))}
            >
              <SelectTrigger className="h-10 w-48 rounded-2xl bg-[#141417] border-[#2B2B32] text-xs text-zinc-200">
                <SelectValue placeholder="Select Event" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
                {allEvents.map((ev) => (
                  <SelectItem key={ev.id} value={String(ev.id)}>
                    {ev.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!isCoordinatorViewOnly && (
            <Button
              onClick={handleSaveAll}
              disabled={saving}
              className="h-10 px-5 gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs rounded-2xl border-none cursor-pointer shadow-lg shadow-white/5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Agenda &amp; PDFs</span>
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

      {/* ── SECTION 1: PDF ATTACHMENTS & CUSTOM BUTTON LABELS ───────────────── */}
      <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#242429] pb-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-zinc-300" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Official PDF Documents &amp; QR Action Buttons
              </h2>
              <p className="text-[11px] text-zinc-400">
                Uploaded PDFs will appear as direct interactive action buttons on the delegate pass page upon QR scan.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Main Event Agenda PDF */}
          <div className="p-4 rounded-2xl bg-[#0F0F12] border border-[#242429] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-zinc-400" /> 1. Main Agenda PDF
              </span>
              {agendaPdfUrl && (
                <a
                  href={agendaPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> View Uploaded PDF
                </a>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-zinc-400">Button Display Name on Scanned QR Page</Label>
              <Input
                value={agendaPdfButtonText}
                onChange={(e) => setAgendaPdfButtonText(e.target.value)}
                placeholder="e.g. Download Event Agenda (PDF)"
                className="h-9 bg-[#16161A] border-[#2A2A30] text-white rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-zinc-400">Upload PDF File</Label>
              <Input
                type="file"
                accept=".pdf,application/pdf"
                disabled={uploadingAgenda}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePdfUpload(f, "agenda");
                }}
                className="h-9 bg-[#16161A] border-[#2A2A30] text-zinc-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-zinc-950 hover:file:bg-zinc-200 cursor-pointer text-xs"
              />
            </div>
          </div>

          {/* Card 2: Secondary PDF Document (Floor Map, Stalls, Guidelines) */}
          <div className="p-4 rounded-2xl bg-[#0F0F12] border border-[#242429] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-zinc-400" /> 2. Secondary Document (Floor Map / Stalls)
              </span>
              {customPdfUrl && (
                <a
                  href={customPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> View Uploaded PDF
                </a>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-zinc-400">Button Display Name on Scanned QR Page</Label>
              <Input
                value={customPdfButtonText}
                onChange={(e) => setCustomPdfButtonText(e.target.value)}
                placeholder="e.g. View Floor Map & Stalls (PDF)"
                className="h-9 bg-[#16161A] border-[#2A2A30] text-white rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-zinc-400">Upload PDF File</Label>
              <Input
                type="file"
                accept=".pdf,application/pdf"
                disabled={uploadingCustom}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePdfUpload(f, "custom");
                }}
                className="h-9 bg-[#16161A] border-[#2A2A30] text-zinc-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-zinc-950 hover:file:bg-zinc-200 cursor-pointer text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: INTERACTIVE SCHEDULE & AGENDA BUILDER ───────────────── */}
      <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242429] pb-3">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="w-5 h-5 text-zinc-300" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Scientific Schedule &amp; Timeline Slots ({agendaSlots.length})
              </h2>
              <p className="text-[11px] text-zinc-400">
                Add and customize sessions, keynote lectures, track halls, and meal breaks.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                addSlot({
                  title: "Keynote Lecture",
                  type: "keynote",
                  timeFrom: "09:30 AM",
                  timeTo: "10:30 AM",
                })
              }
              className="h-8 text-xs rounded-xl border-[#2A2A32] bg-[#101013] text-zinc-300 hover:text-white"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-400" /> + Keynote
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                addSlot({
                  title: "Morning Tea & Networking",
                  type: "break_tea",
                  timeFrom: "11:00 AM",
                  timeTo: "11:30 AM",
                  trackHall: "Dining Foyer",
                })
              }
              className="h-8 text-xs rounded-xl border-[#2A2A32] bg-[#101013] text-zinc-300 hover:text-white"
            >
              <Coffee className="w-3.5 h-3.5 mr-1 text-amber-400" /> + Tea Break
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                addSlot({
                  title: "Buffet Lunch & Delegate Networking",
                  type: "break_lunch",
                  timeFrom: "01:00 PM",
                  timeTo: "02:00 PM",
                  trackHall: "Main Dining Hall",
                })
              }
              className="h-8 text-xs rounded-xl border-[#2A2A32] bg-[#101013] text-zinc-300 hover:text-white"
            >
              <Utensils className="w-3.5 h-3.5 mr-1 text-blue-400" /> + Lunch
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => addSlot()}
              className="h-8 text-xs rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black border-none"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> + Add Session
            </Button>
          </div>
        </div>

        {agendaSlots.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 border border-dashed border-[#282830] rounded-2xl space-y-2">
            <CalendarDays className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="font-bold text-sm text-zinc-400">No agenda slots created yet</p>
            <p className="text-xs text-zinc-500">Click the buttons above to add keynote lectures, sessions, or breaks.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
            {agendaSlots.map((slot, index) => (
              <div
                key={slot.id}
                className="p-4 rounded-2xl bg-[#0F0F12] border border-[#242429] hover:border-[#303038] transition-all space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#1E1E24] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#1B1B22] text-zinc-400 border border-[#2B2B35]">
                      Slot #{index + 1}
                    </span>
                    <span className="text-xs font-bold text-zinc-300">
                      {slot.type === "keynote"
                        ? "Keynote Session"
                        : slot.type === "break_tea"
                        ? "Tea / Refreshment Break"
                        : slot.type === "break_lunch"
                        ? "Lunch Buffet"
                        : slot.type === "panel"
                        ? "Panel Discussion"
                        : "Scientific Session"}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSlot(slot.id)}
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[10px] text-zinc-400">Date</Label>
                    <Input
                      type="date"
                      value={slot.date}
                      onChange={(e) => updateSlot(slot.id, { date: e.target.value })}
                      className="h-8 text-xs bg-[#16161A] border-[#2A2A30] text-white rounded-xl font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[10px] text-zinc-400">Start Time</Label>
                    <Input
                      value={slot.timeFrom}
                      onChange={(e) => updateSlot(slot.id, { timeFrom: e.target.value })}
                      placeholder="09:00 AM"
                      className="h-8 text-xs bg-[#16161A] border-[#2A2A30] text-white rounded-xl font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[10px] text-zinc-400">End Time</Label>
                    <Input
                      value={slot.timeTo}
                      onChange={(e) => updateSlot(slot.id, { timeTo: e.target.value })}
                      placeholder="10:00 AM"
                      className="h-8 text-xs bg-[#16161A] border-[#2A2A30] text-white rounded-xl font-mono"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-[10px] text-zinc-400">Track / Hall Name</Label>
                    <Input
                      value={slot.trackHall || ""}
                      onChange={(e) => updateSlot(slot.id, { trackHall: e.target.value })}
                      placeholder="Main Auditorium Hall A"
                      className="h-8 text-xs bg-[#16161A] border-[#2A2A30] text-white rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-[10px] text-zinc-400">Speaker / Faculty</Label>
                    <Input
                      value={slot.speaker || ""}
                      onChange={(e) => updateSlot(slot.id, { speaker: e.target.value })}
                      placeholder="Dr. Speaker Name"
                      className="h-8 text-xs bg-[#16161A] border-[#2A2A30] text-white rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-6 space-y-1">
                    <Label className="text-[10px] text-zinc-400">Session Title *</Label>
                    <Input
                      value={slot.title}
                      onChange={(e) => updateSlot(slot.id, { title: e.target.value })}
                      placeholder="Title of Session or Scientific Talk"
                      className="h-8 text-xs bg-[#16161A] border-[#2A2A30] text-white rounded-xl font-semibold"
                    />
                  </div>

                  <div className="sm:col-span-6 space-y-1">
                    <Label className="text-[10px] text-zinc-400">Session Description / Notes</Label>
                    <Input
                      value={slot.description || ""}
                      onChange={(e) => updateSlot(slot.id, { description: e.target.value })}
                      placeholder="Overview, topics covered, or instructions"
                      className="h-8 text-xs bg-[#16161A] border-[#2A2A30] text-white rounded-xl"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
