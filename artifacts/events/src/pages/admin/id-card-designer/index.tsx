import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { IdCardDesignData, CardAttendee, CardType, PlaceholderConfig } from "./types";
import { IdCardCanvas } from "./id-card-canvas";
import { PlaceholdersSidebar } from "./placeholders-sidebar";
import { PropertiesPanel } from "./properties-panel";
import { BatchPrintDialog } from "./batch-print-dialog";
import {
  renderCardToCanvas,
  downloadSingleCardPdf,
  downloadSingleCardPng,
  getCardPixelDimensions,
} from "./card-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sparkles,
  LayoutDashboard,
  Printer,
  Upload,
  Eye,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Download,
  FileImage,
  RefreshCw,
  Layers,
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Calendar,
  MapPin,
  QrCode,
  Settings,
  Check,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function IdCardDesignerPage() {
  const { user, token } = useAuth();
  const { activeEvent, activeEventId } = useActiveEvent();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Active tab inside ID Card Designer module
  const [activeTab, setActiveTab] = useState<"overview" | "preregistered" | "onspot" | "preview" | "settings">("overview");

  // Selection & Upload modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedPlaceholderId, setSelectedPlaceholderId] = useState<string | null>(null);

  // Sample Attendee for Preview Mode
  const [sampleAttendeeId, setSampleAttendeeId] = useState<number | null>(null);

  // File upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Check event administrator permissions
  const isAuthorized =
    (user?.userType as string) === "super_admin" ||
    (user?.userType as string) === "admin" ||
    (user?.userType as string) === "event_coordinator";

  // 1. Fetch Event ID Card Design Data for Pre-Registered
  const {
    data: preRegData,
    isLoading: isPreRegLoading,
    refetch: refetchPreReg,
  } = useQuery({
    queryKey: ["/api/events/id-card-design/preregistered", activeEventId],
    queryFn: async () => {
      if (!activeEventId) return null;
      const res = await fetch(`${BASE_URL}/api/events/${activeEventId}/id-card-design?cardType=preregistered`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch pre-registered ID card design");
      return res.json();
    },
    enabled: !!activeEventId && !!token && isAuthorized,
  });

  // 2. Fetch Event ID Card Design Data for On-Spot
  const {
    data: onSpotData,
    isLoading: isOnSpotLoading,
    refetch: refetchOnSpot,
  } = useQuery({
    queryKey: ["/api/events/id-card-design/onspot", activeEventId],
    queryFn: async () => {
      if (!activeEventId) return null;
      const res = await fetch(`${BASE_URL}/api/events/${activeEventId}/id-card-design?cardType=onspot`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch on-spot ID card design");
      return res.json();
    },
    enabled: !!activeEventId && !!token && isAuthorized,
  });

  // 3. Fetch Event Attendees for validation & batch printing
  const {
    data: attendees = [],
    isLoading: isAttendeesLoading,
  } = useQuery<CardAttendee[]>({
    queryKey: ["/api/events/id-card-design/attendees", activeEventId],
    queryFn: async () => {
      if (!activeEventId) return [];
      const res = await fetch(`${BASE_URL}/api/events/${activeEventId}/id-card-design/attendees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeEventId && !!token && isAuthorized,
  });

  // Local Editable Design State for Active Mode
  const [preRegDesign, setPreRegDesign] = useState<IdCardDesignData | null>(null);
  const [onSpotDesign, setOnSpotDesign] = useState<IdCardDesignData | null>(null);

  // Sync loaded designs into editable state
  useEffect(() => {
    if (preRegData?.design) {
      const d = preRegData.design;
      let placeholders: PlaceholderConfig[] = [];
      try {
        placeholders = typeof d.placeholdersJson === "string" ? JSON.parse(d.placeholdersJson) : d.placeholdersJson || [];
      } catch {
        placeholders = [];
      }
      let sheetConfig = {
        paperSize: "A4" as const,
        paperWidthMm: 210,
        paperHeightMm: 297,
        cardsPerRow: 2,
        cardsPerCol: 3,
        marginTopMm: 10,
        marginLeftMm: 10,
        gapXmm: 5,
        gapYmm: 5,
        showCutMarks: true,
        pageOrientation: "portrait" as const,
      };
      try {
        if (d.sheetConfigJson) sheetConfig = JSON.parse(d.sheetConfigJson);
      } catch {}

      setPreRegDesign({
        id: d.id,
        eventId: activeEventId || 1,
        cardType: "preregistered",
        templateImageUrl: d.templateImageUrl,
        widthInches: d.widthInches || "5.51",
        heightInches: d.heightInches || "3.46",
        dpi: d.dpi || 300,
        orientation: d.orientation || "landscape",
        placeholders,
        sheetConfig,
        status: d.status || "draft",
        version: d.version || 1,
        publishedVersion: d.publishedVersion,
      });
    }
  }, [preRegData, activeEventId]);

  useEffect(() => {
    if (onSpotData?.design) {
      const d = onSpotData.design;
      let placeholders: PlaceholderConfig[] = [];
      try {
        placeholders = typeof d.placeholdersJson === "string" ? JSON.parse(d.placeholdersJson) : d.placeholdersJson || [];
      } catch {
        placeholders = [];
      }
      let sheetConfig = {
        paperSize: "A4" as const,
        paperWidthMm: 210,
        paperHeightMm: 297,
        cardsPerRow: 2,
        cardsPerCol: 3,
        marginTopMm: 10,
        marginLeftMm: 10,
        gapXmm: 5,
        gapYmm: 5,
        showCutMarks: true,
        pageOrientation: "portrait" as const,
      };
      try {
        if (d.sheetConfigJson) sheetConfig = JSON.parse(d.sheetConfigJson);
      } catch {}

      setOnSpotDesign({
        id: d.id,
        eventId: activeEventId || 1,
        cardType: "onspot",
        templateImageUrl: d.templateImageUrl,
        widthInches: d.widthInches || "5.51",
        heightInches: d.heightInches || "3.46",
        dpi: d.dpi || 300,
        orientation: d.orientation || "landscape",
        placeholders,
        sheetConfig,
        status: d.status || "draft",
        version: d.version || 1,
        publishedVersion: d.publishedVersion,
      });
    }
  }, [onSpotData, activeEventId]);

  // Current active working design
  const currentDesign = activeTab === "onspot" ? onSpotDesign : preRegDesign;
  const setCurrentDesign = activeTab === "onspot" ? setOnSpotDesign : setPreRegDesign;

  // Selected sample attendee for live preview
  const sampleAttendee = useMemo(() => {
    if (sampleAttendeeId) {
      const found = attendees.find((a) => a.id === sampleAttendeeId);
      if (found) return found;
    }
    return (
      attendees[0] || {
        id: 999,
        registrationNumber: "VISION26-00101",
        name: "Dr. Rahul Sharma, MS (Ophthal)",
        institution: "Sankara Eye Hospital, Bangalore",
        email: "rahul.sharma@sankaraeye.com",
        mobile: "9876543210",
        delegateType: "delegate",
        isOnSpot: false,
        hasName: true,
        hasOrg: true,
        hasId: true,
        hasQr: true,
        isReady: true,
      }
    );
  }, [attendees, sampleAttendeeId]);

  // Canvas preview ref for Live Preview tab
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render live preview on tab change or design change
  useEffect(() => {
    if (activeTab === "preview" && currentDesign && previewCanvasRef.current) {
      renderCardToCanvas(currentDesign, sampleAttendee, previewCanvasRef.current, 300).catch(console.error);
    }
  }, [activeTab, currentDesign, sampleAttendee]);

  // 4. Save Design Mutation (Draft or Published)
  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: "draft" | "published" }) => {
      if (!currentDesign || !activeEventId) return;

      const payload = {
        cardType: currentDesign.cardType,
        templateImageUrl: currentDesign.templateImageUrl,
        widthInches: currentDesign.widthInches,
        heightInches: currentDesign.heightInches,
        dpi: currentDesign.dpi,
        orientation: currentDesign.orientation,
        placeholders: currentDesign.placeholders,
        sheetConfig: currentDesign.sheetConfig,
        status,
      };

      const res = await fetch(`${BASE_URL}/api/events/${activeEventId}/id-card-design`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save design");
      return data;
    },
    onSuccess: (data, vars) => {
      toast({
        title: vars.status === "published" ? "Design Published ✓" : "Draft Saved ✓",
        description: data.message || `ID Card design updated successfully.`,
      });
      refetchPreReg();
      refetchOnSpot();
    },
    onError: (err: any) => {
      toast({ title: "Error Saving Design", description: err.message, variant: "destructive" });
    },
  });

  // 5. Upload Template PNG
  const handleUploadPng = async () => {
    if (!selectedFile || !activeEventId) {
      toast({ title: "Select File", description: "Please select a PNG template file.", variant: "destructive" });
      return;
    }

    if (!selectedFile.type.includes("png") && !selectedFile.name.toLowerCase().endsWith(".png")) {
      toast({ title: "Invalid File", description: "Only PNG format images are allowed.", variant: "destructive" });
      return;
    }

    setUploadingFile(true);
    const formData = new FormData();
    formData.append("template", selectedFile);

    try {
      const res = await fetch(`${BASE_URL}/api/events/${activeEventId}/id-card-design/upload-template`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      if (currentDesign && setCurrentDesign) {
        setCurrentDesign({
          ...currentDesign,
          templateImageUrl: data.url,
        });
      }

      toast({
        title: "Template Uploaded ✓",
        description: "Background PNG template applied to ID card canvas.",
      });
      setUploadModalOpen(false);
      setSelectedFile(null);
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-12 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Access Restricted</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          ID Card Designing is only accessible to Super Administrators and authorized Event Admins.
        </p>
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">No Event Selected</h2>
        <p className="text-xs text-zinc-400">
          Please select an event from the Events Directory to access its ID card designing workspace.
        </p>
        <Button onClick={() => setLocation("/admin/events")} className="rounded-xl bg-white text-zinc-950 font-bold text-xs">
          Go to Events Directory
        </Button>
      </div>
    );
  }

  const activeStats = preRegData?.stats || {
    totalPreRegistered: 0,
    totalOnSpot: 0,
    totalCards: 0,
    readyForPrinting: 0,
  };

  const currentWInches = parseFloat(currentDesign?.widthInches || "5.51");
  const currentHInches = parseFloat(currentDesign?.heightInches || "3.46");
  const currentPixelDims = getCardPixelDimensions(currentWInches, currentHInches, currentDesign?.dpi || 300);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#0C0C0E] overflow-hidden text-zinc-100">
      {/* ── TOP EVENT SUB-HEADER ───────────────────────────────────────────── */}
      <div className="h-16 bg-[#121216] border-b border-[#24242A] px-6 flex items-center justify-between gap-4 shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/admin/dashboard?eventId=${activeEvent.id}`)}
            className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10"
            title="Back to Event Overview"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 font-bold uppercase tracking-wider">
                Event Module
              </span>
              <h1 className="text-base font-black text-white truncate flex items-center gap-1.5">
                <span>{activeEvent.title}</span>
                <span className="text-zinc-500 font-normal">/</span>
                <span className="text-amber-400">ID Card Designing</span>
              </h1>
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              {activeEvent.venue} • {activeEvent.city} • {activeEvent.startDate}
            </p>
          </div>
        </div>

        {/* Global Save & Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1A22] border border-[#2B2B36] text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                currentDesign?.status === "published" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span className="font-bold text-zinc-200 capitalize">
              {currentDesign?.status === "published" ? `Published (v${currentDesign.publishedVersion || currentDesign.version})` : `Draft (v${currentDesign?.version || 1})`}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => saveMutation.mutate({ status: "draft" })}
            disabled={saveMutation.isPending}
            className="h-9 rounded-xl border-[#2A2A35] bg-[#18181F] text-zinc-200 hover:text-white text-xs font-bold px-3.5 cursor-pointer"
          >
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            Save Draft
          </Button>

          <Button
            size="sm"
            onClick={() => saveMutation.mutate({ status: "published" })}
            disabled={saveMutation.isPending}
            className="h-9 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-black px-4 shadow-md cursor-pointer"
          >
            Publish Design ✓
          </Button>

          <Button
            size="sm"
            onClick={() => setBatchModalOpen(true)}
            className="h-9 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black px-4 shadow-lg cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Batch Print ({activeStats.readyForPrinting})</span>
          </Button>
        </div>
      </div>

      {/* ── SUB-NAVIGATION TABS BAR ────────────────────────────────────────── */}
      <div className="h-11 bg-[#0F0F13] border-b border-[#202026] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "overview" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Overview &amp; Telemetry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preregistered")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "preregistered" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pre-Registered Designer</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-800 text-zinc-300 font-mono">
              {preRegDesign?.placeholders.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("onspot")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "onspot" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>On-Spot Designer</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-800 text-zinc-300 font-mono">
              {onSpotDesign?.placeholders.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "preview" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Data Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "settings" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Template &amp; Dimensions</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-zinc-500">
          <span>Card: {currentWInches} × {currentHInches} in</span>
          <span>•</span>
          <span>{currentPixelDims.widthPx} × {currentPixelDims.heightPx} px @ {currentDesign?.dpi || 300} DPI</span>
        </div>
      </div>

      {/* ── TAB CONTENT WORKSPACE ─────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 1. OVERVIEW DASHBOARD */}
        {activeTab === "overview" && (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 max-w-6xl mx-auto w-full">
            {/* Telemetry Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-[#141418] border border-[#26262F] shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Template Status</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white capitalize">
                    {currentDesign?.status === "published" ? "Published" : "Draft Mode"}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">v{currentDesign?.version || 1}</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {currentDesign?.templateImageUrl ? "Custom PNG background loaded" : "Default canvas active"}
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-[#141418] border border-[#26262F] shadow-xl space-y-2">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Physical Dimensions</span>
                <p className="text-2xl font-black text-white">
                  {currentWInches} × {currentHInches} in
                </p>
                <p className="text-[11px] text-zinc-500 font-mono">
                  {currentPixelDims.widthPx} × {currentPixelDims.heightPx} px @ {currentDesign?.dpi || 300} DPI
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-[#141418] border border-[#26262F] shadow-xl space-y-2">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Configured Fields</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{preRegDesign?.placeholders.length || 0}</span>
                  <span className="text-xs text-zinc-500">Pre-Reg / {onSpotDesign?.placeholders.length || 0} On-Spot</span>
                </div>
                <p className="text-[11px] text-zinc-500">Dynamic bindings active</p>
              </div>

              <div className="p-5 rounded-3xl bg-emerald-950/30 border border-emerald-800/40 shadow-xl space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Ready for Batch Print</span>
                <p className="text-2xl font-black text-emerald-300">{activeStats.readyForPrinting} Cards</p>
                <p className="text-[11px] text-emerald-400/70 font-mono">
                  {activeStats.totalCards} total registered attendees
                </p>
              </div>
            </div>

            {/* Quick Action Navigation Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                onClick={() => setActiveTab("preregistered")}
                className="p-6 rounded-3xl bg-[#15151A] hover:bg-[#1C1C24] border border-[#282832] transition-all cursor-pointer group shadow-xl space-y-3"
              >
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                    Design Pre-Registered ID Card
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Visual Canvas Editor with Delegate Name, Hospital, ID Number, and QR pass.
                  </p>
                </div>
                <div className="text-[11px] text-zinc-500 font-bold flex items-center gap-1">
                  <span>Open Designer</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              <div
                onClick={() => setActiveTab("onspot")}
                className="p-6 rounded-3xl bg-[#15151A] hover:bg-[#1C1C24] border border-[#282832] transition-all cursor-pointer group shadow-xl space-y-3"
              >
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                    Design On-Spot Physical Card
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Lightweight physical cards with pre-printed Card ID Number and Scan Gun QR Code.
                  </p>
                </div>
                <div className="text-[11px] text-zinc-500 font-bold flex items-center gap-1">
                  <span>Open On-Spot Designer</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              <div
                onClick={() => setBatchModalOpen(true)}
                className="p-6 rounded-3xl bg-[#15151A] hover:bg-[#1C1C24] border border-[#282832] transition-all cursor-pointer group shadow-xl space-y-3"
              >
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                    Batch Print Ready PDF Sheets
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Multi-card A4/A3 sheet compiler with cut marks and 300 DPI high-resolution export.
                  </p>
                </div>
                <div className="text-[11px] text-zinc-500 font-bold flex items-center gap-1">
                  <span>Launch Batch Printing</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Template Summary Card */}
            <div className="p-6 rounded-3xl bg-[#141418] border border-[#26262F] shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileImage className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Current ID Card Template Image
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
                  Recommended: High-resolution PNG, 300 DPI equivalent. Card measurements are strictly preserved across both single card downloads and multi-page batch sheets.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setUploadModalOpen(true)}
                  className="rounded-xl border-[#2A2A35] bg-[#18181F] text-zinc-200 text-xs font-bold h-10 px-4 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Replace PNG Template
                </Button>
                <Button
                  onClick={() => setActiveTab("preview")}
                  className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-black h-10 px-4 cursor-pointer shadow"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Preview with Live Attendee
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 2. PRE-REGISTERED DESIGNER & 3. ON-SPOT DESIGNER */}
        {(activeTab === "preregistered" || activeTab === "onspot") && currentDesign && setCurrentDesign && (
          <div className="flex-1 flex overflow-hidden">
            <PlaceholdersSidebar
              cardType={activeTab}
              design={currentDesign}
              onChange={setCurrentDesign}
              selectedPlaceholderId={selectedPlaceholderId}
              onSelectPlaceholder={setSelectedPlaceholderId}
            />

            <IdCardCanvas
              design={currentDesign}
              onChange={setCurrentDesign}
              selectedPlaceholderId={selectedPlaceholderId}
              onSelectPlaceholder={setSelectedPlaceholderId}
              sampleAttendee={sampleAttendee}
            />

            <PropertiesPanel
              design={currentDesign}
              onChange={setCurrentDesign}
              selectedPlaceholderId={selectedPlaceholderId}
              onSelectPlaceholder={setSelectedPlaceholderId}
              onOpenUploadModal={() => setUploadModalOpen(true)}
            />
          </div>
        )}

        {/* 4. LIVE PREVIEW & INDIVIDUAL DOWNLOAD */}
        {activeTab === "preview" && currentDesign && (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 max-w-4xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#24242A] pb-4">
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  Live ID Card Preview
                </h2>
                <p className="text-xs text-zinc-400">
                  Renders the active template using real database attendee records at 300 DPI print quality.
                </p>
              </div>

              {/* Sample Attendee Switcher */}
              <div className="flex items-center gap-2 w-full sm:w-80">
                <Select
                  value={sampleAttendeeId ? String(sampleAttendeeId) : ""}
                  onValueChange={(val) => setSampleAttendeeId(Number(val))}
                >
                  <SelectTrigger className="h-10 bg-[#141418] border-[#2A2A35] text-zinc-200 text-xs rounded-2xl">
                    <SelectValue placeholder="Select Attendee to Preview" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181F] border-[#2A2A35] text-zinc-200 max-h-64">
                    {attendees.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.registrationNumber} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rendered Live Card */}
            <div className="flex flex-col items-center justify-center p-8 bg-[#121216] border border-[#24242A] rounded-3xl shadow-2xl space-y-6">
              <div className="max-w-md w-full shadow-2xl rounded-2xl overflow-hidden border border-white/20">
                <canvas ref={previewCanvasRef} className="w-full h-auto block rounded-2xl" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-white">{sampleAttendee.name}</h3>
                <p className="text-xs text-zinc-400">
                  {sampleAttendee.institution} • Registration #{sampleAttendee.registrationNumber}
                </p>
              </div>

              {/* Individual Card Download Actions */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={() => downloadSingleCardPdf(currentDesign, sampleAttendee)}
                  className="rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs h-11 px-6 shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Print-Ready PDF (300 DPI)</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => downloadSingleCardPng(currentDesign, sampleAttendee)}
                  className="rounded-2xl border-[#2A2A35] bg-[#18181F] text-zinc-200 hover:text-white font-bold text-xs h-11 px-5 cursor-pointer flex items-center gap-2"
                >
                  <FileImage className="w-4 h-4" />
                  <span>Download High-Res PNG</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 5. TEMPLATE SETTINGS TAB */}
        {activeTab === "settings" && currentDesign && setCurrentDesign && (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 max-w-2xl mx-auto w-full">
            <div className="border-b border-[#24242A] pb-4">
              <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                Physical Dimensions &amp; Template Configuration
              </h2>
              <p className="text-xs text-zinc-400">
                Set physical card size in inches, target DPI, and upload background template PNGs.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#141418] border border-[#24242A] space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Physical Width (Inches) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentDesign.widthInches}
                    onChange={(e) => setCurrentDesign({ ...currentDesign, widthInches: e.target.value })}
                    className="h-10 bg-[#0E0E11] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                  />
                  <span className="text-[10px] text-zinc-500">e.g. 5.51 in</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Physical Height (Inches) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentDesign.heightInches}
                    onChange={(e) => setCurrentDesign({ ...currentDesign, heightInches: e.target.value })}
                    className="h-10 bg-[#0E0E11] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                  />
                  <span className="text-[10px] text-zinc-500">e.g. 3.46 in</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Resolution (DPI)</Label>
                  <Select
                    value={String(currentDesign.dpi || 300)}
                    onValueChange={(val) => setCurrentDesign({ ...currentDesign, dpi: parseInt(val) || 300 })}
                  >
                    <SelectTrigger className="h-10 bg-[#0E0E11] border-[#2A2A35] text-zinc-200 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#18181F] border-[#2A2A35] text-zinc-200">
                      <SelectItem value="300">300 DPI (Recommended Print Quality)</SelectItem>
                      <SelectItem value="150">150 DPI (Draft / Low-Res)</SelectItem>
                      <SelectItem value="600">600 DPI (Ultra-Fine Printing)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Orientation</Label>
                  <Select
                    value={currentDesign.orientation}
                    onValueChange={(val: any) => setCurrentDesign({ ...currentDesign, orientation: val })}
                  >
                    <SelectTrigger className="h-10 bg-[#0E0E11] border-[#2A2A35] text-zinc-200 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#18181F] border-[#2A2A35] text-zinc-200">
                      <SelectItem value="landscape">Landscape (Horizontal)</SelectItem>
                      <SelectItem value="portrait">Portrait (Vertical)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Calculated Pixel Resolution Notice */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1 text-amber-200">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Calculated Render Dimensions</span>
                </div>
                <p className="font-mono text-white text-sm">
                  {currentWInches} × {currentHInches} in @ {currentDesign.dpi || 300} DPI → approximately{" "}
                  <strong>{currentPixelDims.widthPx} × {currentPixelDims.heightPx} px</strong>
                </p>
              </div>

              {/* Upload PNG Template */}
              <div className="pt-2 border-t border-[#24242A] space-y-3">
                <Label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Background Template PNG
                </Label>

                {currentDesign.templateImageUrl ? (
                  <div className="p-4 rounded-2xl bg-[#0E0E11] border border-[#2A2A35] space-y-3">
                    <img
                      src={currentDesign.templateImageUrl}
                      alt="Template Preview"
                      className="w-full h-32 object-contain bg-black/50 rounded-xl border border-white/10"
                    />
                    <Button
                      onClick={() => setUploadModalOpen(true)}
                      className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold h-9 cursor-pointer"
                    >
                      Replace PNG Template
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setUploadModalOpen(true)}
                    className="w-full rounded-2xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold h-11 cursor-pointer shadow"
                  >
                    + Upload PNG Template
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── UPLOAD PNG TEMPLATE MODAL ─────────────────────────────────────── */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-md bg-[#141418] border border-[#2B2B32] text-zinc-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white">Upload ID Card Template PNG</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Upload a high-resolution PNG image without person text or QR code. The system will dynamically overlay attendee placeholders on top.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-6 border-2 border-dashed border-[#2F2F3D] hover:border-amber-400/60 rounded-2xl bg-[#0D0D10] text-center space-y-3 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept="image/png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-amber-400 mx-auto" />
              <div>
                <p className="text-xs font-bold text-white">
                  {selectedFile ? selectedFile.name : "Click or drag & drop PNG file here"}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">Recommended: 300 DPI high-resolution PNG (Max 30MB)</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-[#242429]">
            <Button
              variant="outline"
              onClick={() => setUploadModalOpen(false)}
              className="rounded-xl border-[#2A2A35] bg-[#18181F] text-zinc-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadPng}
              disabled={!selectedFile || uploadingFile}
              className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs px-5 shadow"
            >
              {uploadingFile ? "Uploading..." : "Apply Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BATCH PRINTING MODAL ──────────────────────────────────────────── */}
      {currentDesign && (
        <BatchPrintDialog
          open={batchModalOpen}
          onOpenChange={setBatchModalOpen}
          design={currentDesign}
          attendees={attendees}
        />
      )}
    </div>
  );
}
