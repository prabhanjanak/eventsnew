import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Smartphone,
  Loader2,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Users,
  FileText,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function WhatsAppBroadcast() {
  const { token, user } = useAuth();
  const { activeEvent, activeEventId } = useActiveEvent();
  const { toast } = useToast();

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [templateType, setTemplateType] = useState<"welcome" | "agenda">("welcome");
  const [targetAudience, setTargetAudience] = useState<"all" | "delegates" | "onspot" | "faculty">("all");

  // Test states
  const [testNumber, setTestNumber] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  // Broadcast dispatch states
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load all events for switcher
  const { data: events = [] } = useQuery<any[]>({
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

  // Default to active event
  const currentEventId = selectedEventId || activeEventId || events[0]?.id;
  const currentEvent = events.find((e) => e.id === currentEventId) || activeEvent || events[0];

  // Count recipients in audience
  const { data: participantsData } = useQuery<any>({
    queryKey: ["/api/participants", currentEventId],
    queryFn: async () => {
      if (!currentEventId) return { participants: [], total: 0 };
      const res = await fetch(`${BASE_URL}/api/participants?eventId=${currentEventId}&limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { participants: [], total: 0 };
      return res.json();
    },
    enabled: !!token && !!currentEventId,
  });

  const allList: any[] = participantsData?.participants || [];
  const targetList = allList.filter((p) => {
    if (!p.mobile || p.mobile.startsWith("OS") || p.name === "Unassigned Pass") return false;
    if (targetAudience === "onspot") return p.isOnSpot;
    if (targetAudience === "delegates") return !p.isOnSpot;
    if (targetAudience === "faculty") return p.isFaculty;
    return true;
  });

  const recipientCount = targetList.length;

  // Generate Preview Message Text
  const getPreviewText = () => {
    const title = currentEvent?.title || "Sankara Medical Conference";
    const venue = currentEvent?.venue || "Sankara Eye Hospital Auditorium";
    const city = currentEvent?.city || "Coimbatore";
    const date = currentEvent?.startDate || "2026-07-10";
    const samplePassUrl = `${window.location.origin}/q/V2020-1001`;
    const sampleAgendaUrl = currentEvent?.agendaPdfUrl || `${window.location.origin}/agenda/V2020-1001`;

    if (templateType === "welcome") {
      return `Namaskaram Dr. Ramesh Sharma,

Welcome to *${title}*!

Your registration has been confirmed.
*Pass ID / Reg No:* V2020-1001
*Role Category:* Delegate

📱 *Your Verified Pass & QR Code:*
${samplePassUrl}

📍 *Venue:* ${venue}, ${city}
📅 *Date:* ${date}

Please present this pass at registration and dining desks.

Regards,
Sankara Eye Care Institutions`;
    }

    return `Namaskaram Dr. Ramesh Sharma,

The official scientific schedule and agenda for *${title}* is now available.

📅 *Event Dates:* ${date}
📍 *Venue:* ${venue}, ${city}

📄 *Download Event Agenda & PDF:*
${sampleAgendaUrl}

📱 *Your Personal Pass & Schedule:*
${samplePassUrl}

We look forward to welcoming you!

Regards,
Sankara Eye Care Institutions`;
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(getPreviewText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Send Test Message
  const handleSendTest = async () => {
    if (!testNumber || testNumber.trim().length < 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a 10-digit mobile number for test dispatch.",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      const res = await fetch(`${BASE_URL}/api/whatsapp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          numbers: testNumber.trim(),
          templateType,
          eventId: currentEventId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send test message");

      toast({
        title: "Test WhatsApp Dispatched ✓",
        description: `Sent "${templateType === "welcome" ? "Welcome Notification" : "Agenda Link"}" to +91 ${testNumber}`,
      });
    } catch (err: any) {
      toast({ title: "Send Failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  // Send Official Broadcast
  const handleSendBroadcast = async () => {
    if (recipientCount === 0) {
      toast({
        title: "No Recipients",
        description: "No delegates found matching the selected audience criteria.",
        variant: "destructive",
      });
      return;
    }

    const confirmMsg = `Are you sure you want to send the "${
      templateType === "welcome" ? "Welcome Notification" : "Agenda & Schedule Link"
    }" WhatsApp broadcast to ${recipientCount} recipients for "${currentEvent?.title}"?`;

    if (!window.confirm(confirmMsg)) return;

    setSendingBroadcast(true);
    try {
      const res = await fetch(`${BASE_URL}/api/whatsapp/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventId: currentEventId,
          templateType,
          target: targetAudience,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch broadcast");

      toast({
        title: "Broadcast Dispatched ✓",
        description: `Queued to ${data.count} attendees in the background.`,
      });
    } catch (err: any) {
      toast({ title: "Broadcast Failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="space-y-6 text-zinc-100 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242428]/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              WhatsApp Broadcast Console
            </h1>
            {currentEvent && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#202028] text-zinc-300 border border-[#2F2F38]">
                {currentEvent.title}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Standardized notifications: 1. Welcome &amp; QR Badge Pass | 2. Event Agenda &amp; Schedule PDF Link.
          </p>
        </div>

        {/* Event Switcher */}
        {events.length > 1 && (
          <Select
            value={String(currentEventId || "")}
            onValueChange={(val) => setSelectedEventId(Number(val))}
          >
            <SelectTrigger className="h-10 w-52 rounded-2xl bg-[#141417] border-[#2B2B32] text-xs text-zinc-200">
              <SelectValue placeholder="Select Event" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
              {events.map((ev) => (
                <SelectItem key={ev.id} value={String(ev.id)}>
                  {ev.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── TEMPLATE SELECTION ROW ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Template 1: Welcome Pass */}
        <div
          onClick={() => setTemplateType("welcome")}
          className={`p-5 rounded-3xl border-2 transition-all cursor-pointer space-y-2.5 ${
            templateType === "welcome"
              ? "bg-[#16161A] border-white text-white shadow-xl"
              : "bg-[#121215] border-[#242429] text-zinc-400 hover:border-[#383842]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-white">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Template 1
            </span>
            {templateType === "welcome" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-zinc-950">
                Selected ✓
              </span>
            )}
          </div>
          <h3 className="text-base font-black text-white">Welcome &amp; Verified Badge Notification</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Sends registration confirmation, Pass ID, and direct personalized QR badge link (<code className="text-zinc-200">/q/:regNumber</code>) with event venue and dates.
          </p>
        </div>

        {/* Template 2: Agenda & PDF Link */}
        <div
          onClick={() => setTemplateType("agenda")}
          className={`p-5 rounded-3xl border-2 transition-all cursor-pointer space-y-2.5 ${
            templateType === "agenda"
              ? "bg-[#16161A] border-white text-white shadow-xl"
              : "bg-[#121215] border-[#242429] text-zinc-400 hover:border-[#383842]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-white">
              <CalendarDays className="w-4 h-4 text-blue-400" /> Template 2
            </span>
            {templateType === "agenda" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-zinc-950">
                Selected ✓
              </span>
            )}
          </div>
          <h3 className="text-base font-black text-white">Event Agenda &amp; PDF Brochure Hyperlink</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Sends the official scientific timetable, direct Agenda PDF download link, and personalized schedule portal link to all attendees.
          </p>
        </div>
      </div>

      {/* ── BROADCAST CONTROLLER & LIVE PREVIEW ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Target & Dispatch Controls */}
        <div className="lg:col-span-6 space-y-5">
          <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-300" /> 1. Select Target Audience
            </h2>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Recipient Filter</Label>
              <Select value={targetAudience} onValueChange={(val: any) => setTargetAudience(val)}>
                <SelectTrigger className="h-11 bg-[#0F0F12] border-[#2B2B32] text-zinc-100 rounded-2xl text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181C] border-[#2B2B32] text-zinc-200">
                  <SelectItem value="all">All Registered Delegates &amp; Crew ({allList.length})</SelectItem>
                  <SelectItem value="delegates">Online Registrations Only</SelectItem>
                  <SelectItem value="onspot">On-Spot Desk Badges Only</SelectItem>
                  <SelectItem value="faculty">Faculty &amp; Speakers Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 rounded-2xl bg-[#0F0F12] border border-[#222228] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Ready Recipients</span>
                <span className="text-[11px] text-zinc-500">With valid 10-digit mobile numbers</span>
              </div>
              <div className="text-2xl font-black text-white">{recipientCount}</div>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSendBroadcast}
                disabled={sendingBroadcast || recipientCount === 0}
                className="w-full h-12 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-sm rounded-2xl border-none cursor-pointer shadow-xl flex items-center justify-center gap-2"
              >
                {sendingBroadcast ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {sendingBroadcast
                    ? "Dispatching WhatsApp..."
                    : `Send Broadcast to ${recipientCount} Attendees`}
                </span>
              </Button>
            </div>
          </div>

          {/* Test Message Box */}
          <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-3.5">
            <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-zinc-300" /> 2. Send Instant Test Message
            </h2>
            <p className="text-[11px] text-zinc-400">
              Dispatches this exact WhatsApp template to your personal number for live verification.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="10-digit mobile number"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                className="h-11 bg-[#0F0F12] border-[#2B2B32] text-white placeholder:text-zinc-500 rounded-2xl text-xs font-mono"
              />
              <Button
                onClick={handleSendTest}
                disabled={sendingTest || !testNumber}
                variant="outline"
                className="h-11 px-4 border-[#2B2B32] bg-[#1A1A1F] hover:bg-zinc-800 text-zinc-200 text-xs font-bold rounded-2xl shrink-0 cursor-pointer"
              >
                {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send Test"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Col: Live WhatsApp Preview */}
        <div className="lg:col-span-6 space-y-3">
          <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#242429] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Live Message Preview
                </h2>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyPreview}
                className="h-7 px-2.5 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                {copied ? <Check className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                <span>{copied ? "Copied" : "Copy Text"}</span>
              </Button>
            </div>

            {/* WhatsApp Phone Mockup Bubble */}
            <div className="p-5 rounded-3xl bg-[#0B0E14] border border-[#1F2430] space-y-3 shadow-inner">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-[11px] text-zinc-400">
                <span className="font-bold text-white">Sankara Eye Care</span>
                <span>• Official WhatsApp Business</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#121B22] border border-[#1E2C38] text-xs text-zinc-100 font-sans whitespace-pre-wrap leading-relaxed shadow-md">
                {getPreviewText()}
              </div>

              <div className="text-right text-[10px] text-zinc-500 font-mono">
                Delivered with dynamic links &amp; personalized attendee names
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
