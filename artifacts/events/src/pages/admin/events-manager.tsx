import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent, EventItem } from "@/hooks/use-active-event";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Users,
  Eye,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  IndianRupee,
  ShieldAlert,
  Clock,
  MapPin,
  Tag,
  Gift,
  Utensils,
  QrCode,
  KeyRound,
  Ticket,
  Coffee,
  Mic,
  Sparkles,
  Layers,
  ArrowRight,
  Search,
  Filter,
  Check,
  TrendingUp,
  FileText,
} from "lucide-react";
import { formatDateDDMMYYYY, formatDateRange24h, formatTime24h } from "@/lib/date-utils";

export interface PricingTier {
  id: string;
  name: string;
  role: string;
  price: number;
  earlyBirdPrice?: number;
  earlyBirdDeadline?: string;
  description?: string;
  inclusions?: string[];
  badgeLabel?: string;
  popular?: boolean;
}

export const ROLE_OPTIONS = [
  { id: "delegate", label: "Official CME Delegate" },
  { id: "student", label: "PG Resident / Fellow / Student" },
  { id: "member", label: "Sankara / AIOS Member" },
  { id: "non_member", label: "Non-Member Physician" },
  { id: "faculty", label: "Faculty / Speaker" },
  { id: "attendee", label: "General Attendee / Observer" },
  { id: "international", label: "International / Overseas Delegate" },
  { id: "accompanying", label: "Accompanying Person" },
  { id: "vip", label: "VIP / Dignitary" },
  { id: "sponsor", label: "Exhibitor / Sponsor Representative" },
];

export const PRESET_PRICING_CME_5_TIERS: PricingTier[] = [
  {
    id: "attendee",
    name: "General Attendee",
    role: "attendee",
    price: 1500,
    earlyBirdPrice: 1200,
    description: "Ideal for observers, hospital visitors, and general delegates.",
    inclusions: ["Access to Keynote & Main Stage", "Digital QR Pass", "E-Certificate of Attendance", "Conference Lunch & Refreshments"],
    badgeLabel: "Early Bird 20% OFF",
    popular: false,
  },
  {
    id: "delegate",
    name: "Official CME Delegate",
    role: "delegate",
    price: 3000,
    earlyBirdPrice: 2400,
    description: "Full clinical conference delegation with accredited CME points.",
    inclusions: ["Priority Seating in Auditorium", "Accredited CME Credits", "Hands-on Workshops", "Delegate Goodie Bag", "Lunch & Dining"],
    badgeLabel: "Most Popular",
    popular: true,
  },
  {
    id: "member",
    name: "Sankara / AIOS Member",
    role: "member",
    price: 2000,
    earlyBirdPrice: 1600,
    description: "Exclusive subsidized tariff for active institutional and society members.",
    inclusions: ["Subsidized Member Tariff", "Member Lounge Access", "All CME Tracks", "Member Badge & Certificate"],
    badgeLabel: "Member Tariff",
    popular: false,
  },
  {
    id: "non_member",
    name: "Non-Member Physician",
    role: "non_member",
    price: 2800,
    earlyBirdPrice: 2200,
    description: "Standard registration for non-member practicing clinicians and surgeons.",
    inclusions: ["Full Scientific Conference Access", "CME Credit Certificate", "Delegate Welcome Kit", "All-Days Refreshments & Lunch"],
    badgeLabel: "Standard",
    popular: false,
  },
  {
    id: "student_pg",
    name: "PG Resident / Fellow",
    role: "student",
    price: 999,
    earlyBirdPrice: 799,
    description: "Special subsidized rate for post-graduate students, residents, and research fellows.",
    inclusions: ["Heavy Subsidized Student Fee", "Poster & Paper Presentation Eligibility", "Resident Masterclass Access", "Student Lunch"],
    badgeLabel: "Student Rate",
    popular: false,
  },
];

export const PRESET_PRICING_WORKSHOP_3_TIERS: PricingTier[] = [
  {
    id: "hands_on_trainee",
    name: "Hands-on Wet Lab Trainee",
    role: "delegate",
    price: 5000,
    earlyBirdPrice: 4000,
    description: "Full hands-on wet-lab workstation and 1-on-1 surgical mentoring.",
    inclusions: ["Dedicated Surgical Simulator/Station", "Mentorship from Chief Surgeons", "Certificate of Competence", "Full Workshop Catering"],
    badgeLabel: "Hands-on",
    popular: true,
  },
  {
    id: "observer",
    name: "Workshop Observer",
    role: "attendee",
    price: 2500,
    earlyBirdPrice: 2000,
    description: "Access to observation gallery, video relay, and interactive Q&A.",
    inclusions: ["Observation Suite Access", "Video Relays & Discussion", "Participant Certificate", "Workshop Lunch"],
    badgeLabel: "Observer",
    popular: false,
  },
  {
    id: "faculty_mentor",
    name: "Faculty / Instructor",
    role: "faculty",
    price: 0,
    earlyBirdPrice: 0,
    description: "Complimentary masterclass instructor badge.",
    inclusions: ["Faculty Lounge", "Instructor Honors", "All Sessions & VIP Hospitality"],
    popular: false,
  },
];

export const PRESET_PRICING_FREE: PricingTier[] = [
  {
    id: "attendee",
    name: "General Attendee",
    role: "attendee",
    price: 0,
    earlyBirdPrice: 0,
    description: "Complimentary general admission pass for registered attendees.",
    inclusions: ["Access to General Sessions", "Digital QR Pass", "E-Certificate of Participation"],
    popular: false,
  },
  {
    id: "delegate",
    name: "Official Delegate",
    role: "delegate",
    price: 0,
    earlyBirdPrice: 0,
    description: "Full clinical delegation pass for doctors, optometrists and hospital staff.",
    inclusions: ["Priority Hall Seating", "All Academic Tracks & CME", "Delegate Goodie Bag", "Catering & Lunch"],
    popular: true,
  },
];

export interface AgendaSlot {
  id: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  title: string;
  type: "session" | "keynote" | "break_tea" | "break_lunch" | "workshop" | "panel";
  speaker?: string;
  speakerDesignation?: string;
  speakerInstitution?: string;
  moderator?: string;
  trackHall?: string;
  description?: string;
}

const DEFAULT_SAMPLE_AGENDA: AgendaSlot[] = [
  {
    id: "slot-1",
    date: "",
    timeFrom: "08:30 AM",
    timeTo: "09:30 AM",
    title: "Registration & Welcome Breakfast",
    type: "break_tea",
    speaker: "Reception Desk",
    trackHall: "Main Lobby & Dining Hall",
    description: "Badge collection and morning breakfast networking.",
  },
  {
    id: "slot-2",
    date: "",
    timeFrom: "09:30 AM",
    timeTo: "10:30 AM",
    title: "Inaugural Keynote Address",
    type: "keynote",
    speaker: "Dr. R.V. Ramani (Founder & Managing Trustee)",
    trackHall: "Main Auditorium - Hall A",
    description: "Inauguration ceremony, lighting of the lamp, and inaugural address.",
  },
  {
    id: "slot-3",
    date: "",
    timeFrom: "10:30 AM",
    timeTo: "01:00 PM",
    title: "Scientific Symposium: Next-Gen Ophthalmology & AI",
    type: "session",
    speaker: "Panel of Chief Surgeons",
    trackHall: "Auditorium Hall A & B",
    description: "In-depth scientific papers and surgical video presentations.",
  },
  {
    id: "slot-4",
    date: "",
    timeFrom: "01:00 PM",
    timeTo: "02:00 PM",
    title: "Lunch & Networking Break",
    type: "break_lunch",
    speaker: "All Delegates & Faculty",
    trackHall: "Dining Pavilion",
    description: "Buffet lunch and delegate discussions.",
  },
  {
    id: "slot-5",
    date: "",
    timeFrom: "02:00 PM",
    timeTo: "04:00 PM",
    title: "Hands-on Surgical Wet Lab Masterclass",
    type: "workshop",
    speaker: "Senior Faculty & Mentors",
    trackHall: "Wet Lab Suite",
    description: "Practical wet-lab simulation techniques.",
  },
  {
    id: "slot-6",
    date: "",
    timeFrom: "04:00 PM",
    timeTo: "04:30 PM",
    title: "Evening High Tea & Refreshments",
    type: "break_tea",
    speaker: "Catering Committee",
    trackHall: "Main Lobby",
    description: "Tea, coffee, and evening snacks.",
  },
  {
    id: "slot-7",
    date: "",
    timeFrom: "04:30 PM",
    timeTo: "05:30 PM",
    title: "Grand Panel Discussion & Q&A",
    type: "panel",
    speaker: "Scientific Committee & Chairs",
    trackHall: "Main Auditorium",
    description: "Interactive Q&A, valedictory remarks, and awards ceremony.",
  },
];

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function EventsManager() {
  const { token, user } = useAuth();
  const { selectEvent, activeEventId } = useActiveEvent();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("all");

  const { data: events = [], isLoading, refetch: refetchEvents } = useQuery<any[]>({
    queryKey: ["/api/events/admin-list"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load events");
      return res.json();
    },
  });

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Event Form states
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [eventType, setEventType] = useState("conference");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [venue, setVenue] = useState("Sankara Eye Hospital");
  const [city, setCity] = useState("Coimbatore");
  const [locationMapUrl, setLocationMapUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeFrom, setTimeFrom] = useState("09:00 AM");
  const [timeTo, setTimeTo] = useState("05:00 PM");
  
  // Payment & Razorpay & Multi-Role Pricing Tiers
  const [isPaid, setIsPaid] = useState(false);
  const [registrationFee, setRegistrationFee] = useState(0);
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(PRESET_PRICING_FREE);

  const addPricingTier = () => {
    const newTier: PricingTier = {
      id: `tier-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: "Special Role Delegate",
      role: "delegate",
      price: isPaid ? 2000 : 0,
      earlyBirdPrice: isPaid ? 1600 : 0,
      description: "Custom role-based delegation pass.",
      inclusions: ["Main Auditorium Seating", "E-Badge & Pass", "Event Dining"],
      badgeLabel: "",
      popular: false,
    };
    setPricingTiers((prev) => [...prev, newTier]);
  };

  const updatePricingTier = (index: number, updates: Partial<PricingTier>) => {
    setPricingTiers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const removePricingTier = (index: number) => {
    setPricingTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const applyPricingPreset = (preset: PricingTier[]) => {
    setPricingTiers(preset.map((t) => ({ ...t, id: `tier-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` })));
  };

  // Approvals & Limits
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [maxCapacity, setMaxCapacity] = useState("");

  // Logistics / Scanner Feature Toggles
  const [enableAttendance, setEnableAttendance] = useState(true);
  const [attendanceDaysCount, setAttendanceDaysCount] = useState(1);
  const [enableFood, setEnableFood] = useState(true);
  const [enableGoodies, setEnableGoodies] = useState(true);

  // Organizer details
  const [organizerName, setOrganizerName] = useState("Sankara Eye Care Institutions");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [organizerPhone, setOrganizerPhone] = useState("");
  const [status, setStatus] = useState("published");
  const [assignedCoordinators, setAssignedCoordinators] = useState<number[]>([]);

  // SPOC (Single Point of Contact) Details
  const [spocName, setSpocName] = useState("");
  const [spocDesignation, setSpocDesignation] = useState("");
  const [spocPhone, setSpocPhone] = useState("");
  const [spocEmail, setSpocEmail] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState("");

  // Document Uploads & Group Registration Toggles
  const [requireDocumentUpload, setRequireDocumentUpload] = useState(false);
  const [documentUploadLabel, setDocumentUploadLabel] = useState("Upload Medical Council Certificate / Student ID");
  const [documentUploadRequired, setDocumentUploadRequired] = useState(false);
  const [groupRegistrationEnabled, setGroupRegistrationEnabled] = useState(true);

  // Awards & External AI Photos
  const [awardsPdfUrl, setAwardsPdfUrl] = useState("");
  const [awardsPdfButtonText, setAwardsPdfButtonText] = useState("Download Awards & Winners List (PDF)");
  const [externalPhotosUrl, setExternalPhotosUrl] = useState("");
  const [externalPhotosButtonText, setExternalPhotosButtonText] = useState("View AI Event Photos (Samaro AI / Photomall)");

  // PDF Document Attachments & Button Labels
  const [agendaPdfUrl, setAgendaPdfUrl] = useState("");
  const [agendaPdfButtonText, setAgendaPdfButtonText] = useState("Download Event Agenda (PDF)");
  const [customPdfUrl, setCustomPdfUrl] = useState("");
  const [customPdfButtonText, setCustomPdfButtonText] = useState("View Schedule / Document (PDF)");
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Agenda slots state
  const [agendaSlots, setAgendaSlots] = useState<AgendaSlot[]>([]);

  const addAgendaSlot = (preset?: Partial<AgendaSlot>) => {
    const newSlot: AgendaSlot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: preset?.date || startDate || new Date().toISOString().slice(0, 10),
      timeFrom: preset?.timeFrom || "09:00 AM",
      timeTo: preset?.timeTo || "10:00 AM",
      title: preset?.title || "New Scientific Session",
      type: preset?.type || "session",
      speaker: preset?.speaker || "",
      trackHall: preset?.trackHall || "Main Auditorium Hall A",
      description: preset?.description || "",
    };
    setAgendaSlots((prev) => [...prev, newSlot]);
  };

  const updateAgendaSlot = (id: string, updates: Partial<AgendaSlot>) => {
    setAgendaSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const removeAgendaSlot = (id: string) => {
    setAgendaSlots((prev) => prev.filter((s) => s.id !== id));
  };

  // Coupon Manager Modal
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [selectedEventForCoupons, setSelectedEventForCoupons] = useState<any | null>(null);
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponType, setNewCouponType] = useState("percentage");
  const [newCouponValue, setNewCouponValue] = useState(20);
  const [newCouponSponsor, setNewCouponSponsor] = useState("");
  const [newCouponDesc, setNewCouponDesc] = useState("");
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  const { data: eventCoupons, refetch: refetchCoupons } = useQuery<any[]>({
    queryKey: ["/api/events/coupons", selectedEventForCoupons?.slug],
    queryFn: async () => {
      if (!selectedEventForCoupons?.slug) return [];
      const res = await fetch(`${BASE_URL}/api/events/${selectedEventForCoupons.slug}/coupons`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedEventForCoupons?.slug,
  });

  // Post-Event Wrapup & Gallery Modal States
  const [wrapupModalOpen, setWrapupModalOpen] = useState(false);
  const [selectedEventForWrapup, setSelectedEventForWrapup] = useState<any | null>(null);
  const [wrapupGallery, setWrapupGallery] = useState<string[]>([]);
  const [wrapupSummary, setWrapupSummary] = useState("");
  const [wrapupVisitorCount, setWrapupVisitorCount] = useState<number | string>("");
  const [wrapupDescription, setWrapupDescription] = useState("");
  const [wrapupEndingNotes, setWrapupEndingNotes] = useState("");
  const [wrapupExternalPhotosUrl, setWrapupExternalPhotosUrl] = useState("");
  const [wrapupExternalPhotosButtonText, setWrapupExternalPhotosButtonText] = useState("Find My Photos with AI (Samaro AI / Photomall)");
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [submittingWrapup, setSubmittingWrapup] = useState(false);

  // Query Pending Wrapup Alerts for Concluded Events
  const { data: wrapupAlertsData, refetch: refetchWrapupAlerts } = useQuery<{
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

  const openWrapupModal = (ev: any) => {
    setSelectedEventForWrapup(ev);
    setWrapupSummary(ev.postEventSummary || "");
    setWrapupVisitorCount(ev.postEventVisitorCount || ev.totalParticipants || "");
    setWrapupDescription(ev.postEventDescription || ev.description || "");
    setWrapupEndingNotes(ev.postEventEndingNotes || "");
    setWrapupExternalPhotosUrl(ev.externalPhotosUrl || "");
    setWrapupExternalPhotosButtonText(ev.externalPhotosButtonText || "Find My Photos with AI (Samaro AI / Photomall)");
    try {
      const parsed = ev.postEventGalleryJson ? JSON.parse(ev.postEventGalleryJson) : [];
      setWrapupGallery(Array.isArray(parsed) ? parsed : []);
    } catch {
      setWrapupGallery([]);
    }
    setWrapupModalOpen(true);
  };

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingGallery(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("images", files[i]);
      }
      const res = await fetch(`${BASE_URL}/api/events/upload-gallery`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Upload error (HTTP ${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || data.message || "Failed to upload images");
      const newUrls = (data.files || []).map((f: any) => f.url);
      setWrapupGallery((prev) => [...prev, ...newUrls]);
      toast({
        title: "Photos Uploaded ✓",
        description: `Added ${newUrls.length} photo(s). Total: ${wrapupGallery.length + newUrls.length} (Min 10 required)`,
      });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleRemoveGalleryImage = (idxToRemove: number) => {
    setWrapupGallery((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSaveWrapup = async () => {
    if (!selectedEventForWrapup) return;
    if (wrapupGallery.length < 10) {
      toast({
        title: "Minimum 10 Photos Required",
        description: `Please upload at least 10 event photos before completing wrapup. Currently uploaded: ${wrapupGallery.length}`,
        variant: "destructive",
      });
      return;
    }
    if (!wrapupSummary.trim()) {
      toast({ title: "Summary Required", description: "Please enter an event summary.", variant: "destructive" });
      return;
    }
    if (!wrapupVisitorCount || Number(wrapupVisitorCount) < 1) {
      toast({ title: "Visitor Count Required", description: "Please enter the official visitor count.", variant: "destructive" });
      return;
    }
    if (!wrapupDescription.trim()) {
      toast({ title: "Description Required", description: "Please enter event highlights.", variant: "destructive" });
      return;
    }
    if (!wrapupEndingNotes.trim()) {
      toast({ title: "Ending Notes Required", description: "Please enter concluding remarks.", variant: "destructive" });
      return;
    }

    setSubmittingWrapup(true);
    try {
      const res = await fetch(`${BASE_URL}/api/events/${selectedEventForWrapup.id}/post-event-wrapup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          postEventGallery: wrapupGallery,
          postEventSummary: wrapupSummary.trim(),
          postEventVisitorCount: Number(wrapupVisitorCount),
          postEventDescription: wrapupDescription.trim(),
          postEventEndingNotes: wrapupEndingNotes.trim(),
          externalPhotosUrl: wrapupExternalPhotosUrl.trim() || null,
          externalPhotosButtonText: wrapupExternalPhotosButtonText.trim() || null,
        }),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Wrapup error (HTTP ${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || "Failed to complete wrapup");

      toast({
        title: "Event Wrapup Completed ✓",
        description: `Archived with ${wrapupGallery.length} photos and visitor count ${wrapupVisitorCount}. Alert cleared!`,
      });

      setWrapupModalOpen(false);
      refetchEvents();
      refetchWrapupAlerts();
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingWrapup(false);
    }
  };

  // Delete confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreateModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setEditingEvent(null);
    setTitle("");
    setSlug("");
    setEventType("conference");
    setDescription("");
    setShortDescription("");
    setVenue("Sankara Eye Hospital");
    setCity("Coimbatore");
    setLocationMapUrl("");
    setStartDate(today);
    setEndDate(today);
    setTimeFrom("09:00 AM");
    setTimeTo("05:00 PM");
    setIsPaid(false);
    setRegistrationFee(0);
    setPricingTiers(PRESET_PRICING_FREE);
    setRazorpayKeyId("");
    setRazorpayKeySecret("");
    setRequiresApproval(false);
    setRegistrationOpen(true);
    setMaxCapacity("");
    setEnableAttendance(true);
    setAttendanceDaysCount(1);
    setEnableFood(true);
    setEnableGoodies(true);
    setOrganizerName("Sankara Eye Care Institutions");
    setOrganizerEmail("events@sankaraeye.in");
    setOrganizerPhone("");
    setSpocName("");
    setSpocDesignation("CME Coordinator");
    setSpocPhone("");
    setSpocEmail("");
    setCancellationPolicy("Cancellations requested 7 days prior to event will receive 100% refund. No refunds for cancellations within 48 hours. Contact Event SPOC for processing.");
    setRequireDocumentUpload(false);
    setDocumentUploadLabel("Upload Medical Council Certificate / Student ID");
    setDocumentUploadRequired(false);
    setGroupRegistrationEnabled(true);
    setStatus("published");
    setAssignedCoordinators([]);
    setAgendaPdfUrl("");
    setAgendaPdfButtonText("Download Event Agenda (PDF)");
    setCustomPdfUrl("");
    setCustomPdfButtonText("View Schedule / Document (PDF)");
    setAwardsPdfUrl("");
    setAwardsPdfButtonText("Download Awards & Winners List (PDF)");
    setExternalPhotosUrl("");
    setExternalPhotosButtonText("View AI Event Photos (Samaro AI / Photomall)");
    setAgendaSlots(DEFAULT_SAMPLE_AGENDA.map((s) => ({ ...s, date: today })));
    setModalOpen(true);
  };

  const openEditModal = (ev: any) => {
    setEditingEvent(ev);
    setTitle(ev.title || "");
    setSlug(ev.slug || "");
    setEventType(ev.eventType || "conference");
    setDescription(ev.description || "");
    setShortDescription(ev.shortDescription || "");
    setVenue(ev.venue || "Sankara Eye Hospital");
    setCity(ev.city || "Coimbatore");
    setLocationMapUrl(ev.locationMapUrl || "");
    setStartDate(ev.startDate || "");
    setEndDate(ev.endDate || "");
    setTimeFrom(ev.timeFrom || "09:00 AM");
    setTimeTo(ev.timeTo || "05:00 PM");
    setIsPaid(Boolean(ev.isPaid));
    setRegistrationFee(ev.registrationFee || 0);
    setRazorpayKeyId(ev.razorpayKeyId || "");
    setRazorpayKeySecret(ev.razorpayKeySecret || "");

    try {
      const parsedTiers = ev.pricingTiersJson ? JSON.parse(ev.pricingTiersJson) : (ev.pricingTiers || []);
      setPricingTiers(
        Array.isArray(parsedTiers) && parsedTiers.length > 0
          ? parsedTiers
          : (ev.isPaid ? PRESET_PRICING_CME_5_TIERS : PRESET_PRICING_FREE)
      );
    } catch {
      setPricingTiers(ev.isPaid ? PRESET_PRICING_CME_5_TIERS : PRESET_PRICING_FREE);
    }

    setRequiresApproval(Boolean(ev.requiresApproval));
    setRegistrationOpen(ev.registrationOpen !== false);
    setMaxCapacity(ev.maxCapacity ? String(ev.maxCapacity) : "");
    setEnableAttendance(ev.enableAttendance !== false);
    setAttendanceDaysCount(ev.attendanceDaysCount || 1);
    setEnableFood(ev.enableFood !== false);
    setEnableGoodies(ev.enableGoodies !== false);
    setOrganizerName(ev.organizerName || "Sankara Eye Care Institutions");
    setOrganizerEmail(ev.organizerEmail || "");
    setOrganizerPhone(ev.organizerPhone || "");
    setSpocName(ev.spocName || "");
    setSpocDesignation(ev.spocDesignation || "");
    setSpocPhone(ev.spocPhone || "");
    setSpocEmail(ev.spocEmail || "");
    setCancellationPolicy(ev.cancellationPolicy || "");
    setRequireDocumentUpload(Boolean(ev.requireDocumentUpload));
    setDocumentUploadLabel(ev.documentUploadLabel || "Upload Medical Council Certificate / Student ID");
    setDocumentUploadRequired(Boolean(ev.documentUploadRequired));
    setGroupRegistrationEnabled(ev.groupRegistrationEnabled !== false);
    setStatus(ev.status || "published");
    setAgendaPdfUrl(ev.agendaPdfUrl || "");
    setAgendaPdfButtonText(ev.agendaPdfButtonText || "Download Event Agenda (PDF)");
    setCustomPdfUrl(ev.customPdfUrl || "");
    setCustomPdfButtonText(ev.customPdfButtonText || "View Schedule / Document (PDF)");
    setAwardsPdfUrl(ev.awardsPdfUrl || "");
    setAwardsPdfButtonText(ev.awardsPdfButtonText || "Download Awards & Winners List (PDF)");
    setExternalPhotosUrl(ev.externalPhotosUrl || "");
    setExternalPhotosButtonText(ev.externalPhotosButtonText || "View AI Event Photos (Samaro AI / Photomall)");

    try {
      const parsed = ev.agendaJson ? JSON.parse(ev.agendaJson) : [];
      setAgendaSlots(
        Array.isArray(parsed) && parsed.length > 0
          ? parsed
          : DEFAULT_SAMPLE_AGENDA.map((s) => ({ ...s, date: ev.startDate || "" }))
      );
    } catch {
      setAgendaSlots([]);
    }

    setModalOpen(true);
  };

  const handlePdfUpload = async (file: File, target: "agenda" | "custom" | "awards") => {
    if (!file) return;
    setUploadingPdf(true);
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
      if (target === "agenda") {
        setAgendaPdfUrl(data.url);
        toast({ title: "Agenda PDF Uploaded ✓", description: data.originalName });
      } else if (target === "custom") {
        setCustomPdfUrl(data.url);
        toast({ title: "Custom Document PDF Uploaded ✓", description: data.originalName });
      } else {
        setAwardsPdfUrl(data.url);
        toast({ title: "Awards & Winners PDF Uploaded ✓", description: data.originalName });
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPdf(false);
    }
  };

  const openCouponManager = (ev: any) => {
    setSelectedEventForCoupons(ev);
    setNewCouponCode("");
    setNewCouponType("percentage");
    setNewCouponValue(20);
    setNewCouponSponsor("");
    setNewCouponDesc("");
    setCouponModalOpen(true);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    setCreatingCoupon(true);
    try {
      const res = await fetch(`${BASE_URL}/api/events/${selectedEventForCoupons.slug}/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          code: newCouponCode.trim(),
          discountType: newCouponType,
          discountValue: Number(newCouponValue),
          sponsorName: newCouponSponsor.trim() || null,
          description: newCouponDesc.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create coupon");
      toast({ title: "Coupon Created ✓", description: `Code ${newCouponCode.toUpperCase()} added.` });
      setNewCouponCode("");
      setNewCouponSponsor("");
      setNewCouponDesc("");
      refetchCoupons();
    } catch (err: any) {
      toast({ title: "Failed to Create Coupon", description: err.message, variant: "destructive" });
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (couponId: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/events/coupons/${couponId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete coupon");
      toast({ title: "Coupon Deleted" });
      refetchCoupons();
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) {
      toast({ title: "Validation Error", description: "Title, start date, and end date are required.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        eventType,
        description,
        shortDescription,
        venue,
        city,
        locationMapUrl,
        startDate,
        endDate,
        timeFrom,
        timeTo,
        isPaid,
        registrationFee: isPaid ? (pricingTiers[0]?.price || Number(registrationFee) || 0) : 0,
        pricingTiersJson: JSON.stringify(pricingTiers),
        razorpayKeyId: razorpayKeyId.trim() || null,
        razorpayKeySecret: razorpayKeySecret.trim() || null,
        requiresApproval,
        registrationOpen,
        maxCapacity: maxCapacity ? Number(maxCapacity) : null,
        enableAttendance,
        attendanceDaysCount: Number(attendanceDaysCount),
        enableFood,
        enableGoodies,
        organizerName,
        organizerEmail,
        organizerPhone,
        spocName: spocName.trim() || null,
        spocDesignation: spocDesignation.trim() || null,
        spocPhone: spocPhone.trim() || null,
        spocEmail: spocEmail.trim() || null,
        cancellationPolicy: cancellationPolicy.trim() || null,
        requireDocumentUpload,
        documentUploadLabel: documentUploadLabel.trim() || "Upload Medical Council Certificate / Student ID",
        documentUploadRequired,
        groupRegistrationEnabled,
        themeColor: "#18181B",
        accentColor: "#6366F1",
        agendaPdfUrl: agendaPdfUrl.trim() || null,
        agendaPdfButtonText: agendaPdfButtonText.trim() || "Download Event Agenda (PDF)",
        customPdfUrl: customPdfUrl.trim() || null,
        customPdfButtonText: customPdfButtonText.trim() || "View Document (PDF)",
        awardsPdfUrl: awardsPdfUrl.trim() || null,
        awardsPdfButtonText: awardsPdfButtonText.trim() || "Download Awards & Winners List (PDF)",
        externalPhotosUrl: externalPhotosUrl.trim() || null,
        externalPhotosButtonText: externalPhotosButtonText.trim() || "View AI Event Photos (Samaro AI / Photomall)",
        agendaJson: JSON.stringify(agendaSlots),
        status,
        assignedCoordinatorIds: assignedCoordinators,
      };

      const url = editingEvent ? `${BASE_URL}/api/events/${editingEvent.id}` : `${BASE_URL}/api/events`;
      const method = editingEvent ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save event");
      }

      toast({
        title: editingEvent ? "Event Updated" : "Event Created! 🎉",
        description: `"${title}" has been saved successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/events/admin-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/all-admin"] });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error Saving Event", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/events/${eventToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete event");
      toast({ title: "Event Deleted", description: `"${eventToDelete.title}" was removed.` });
      queryClient.invalidateQueries({ queryKey: ["/api/events/admin-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/all-admin"] });
      setDeleteConfirmOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // Filter events
  const safeEvents = Array.isArray(events) ? events : [];
  const filteredEvents = safeEvents.filter((ev) => {
    const matchesSearch =
      ev.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.venue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.slug?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedTypeFilter === "all" || ev.eventType === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  // Calculate totals
  const totalHosted = safeEvents.length;
  const totalDelegates = safeEvents.reduce((acc, curr) => acc + (curr.totalParticipants || 0), 0);
  const activeCount = safeEvents.filter((e) => e.status === "published" || e.status === "ongoing").length;

  const pendingEventsList = Array.isArray(wrapupAlertsData?.pendingEvents) ? wrapupAlertsData.pendingEvents : [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-zinc-100 animate-in fade-in duration-300">
      {/* ── LU.MA HERO COMMAND CENTER BANNER ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#242429]">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#18181C] border border-[#2B2B32] text-xs font-bold text-amber-300 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Master Operations Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Events Management
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
            Select an event to access its dedicated registrations, attendee QR passes, food token scanners, and real-time attendance telemetry.
          </p>
        </div>

        {user?.userType === "super_admin" && (
          <Button
            onClick={openCreateModal}
            className="rounded-2xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs h-11 px-6 shadow-xl cursor-pointer border-none transition-transform active:scale-98 shrink-0 flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create New Event</span>
          </Button>
        )}
      </div>

      {/* ── OVERVIEW TELEMETRY METRIC PILLS ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-3xl bg-[#151518]/90 border border-[#26262B] shadow-xl space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Hosted Events</span>
            <Layers className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{totalHosted}</div>
          <p className="text-[11px] text-zinc-500 font-medium">Independent event environments</p>
        </div>

        <div className="p-4 rounded-3xl bg-[#151518]/90 border border-[#26262B] shadow-xl space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Attendees</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{totalDelegates}</div>
          <p className="text-[11px] text-zinc-500 font-medium">Delegates registered across all events</p>
        </div>

        <div className="p-4 rounded-3xl bg-[#151518]/90 border border-[#26262B] shadow-xl space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Active &amp; Published</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{activeCount}</div>
          <p className="text-[11px] text-zinc-500 font-medium">Accepting public admissions</p>
        </div>
      </div>

      {/* ── ACTION REQUIRED: PENDING POST-EVENT WRAPUP ALERT BANNER ──────── */}
      {wrapupAlertsData?.hasPendingAlerts && pendingEventsList.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-950/40 border-2 border-amber-500/50 shadow-2xl space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 text-amber-300">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Action Required: Concluded Events Awaiting Post-Event Wrapup &amp; Photos
              </h2>
              <p className="text-xs text-amber-200/80">
                The following event(s) have ended. Please upload the minimum 10 post-event photos, manual visitor count, summary, and ending notes to complete them.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {pendingEventsList.map((pev: any) => {
              const fullEv = safeEvents.find((e) => e.id === pev.id) || pev;
              return (
                <div
                  key={pev.id}
                  className="p-3.5 rounded-2xl bg-[#141418] border border-amber-500/30 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">{pev.title}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">Ended: {pev.endDate || pev.startDate}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openWrapupModal(fullEv)}
                    className="h-8 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-[11px] shrink-0 border-none cursor-pointer shadow"
                  >
                    Upload Photos (10+)
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SEARCH & FILTER CONTROLS ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
          <Input
            placeholder="Search events by title, venue, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-2xl bg-[#151518] border-[#26262B] text-white text-xs placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* Event Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Types" },
            { id: "conference", label: "Conferences" },
            { id: "cme", label: "CMEs" },
            { id: "workshop", label: "Workshops" },
            { id: "internal_staff", label: "Staff Meets" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedTypeFilter === tab.id
                  ? "bg-white text-zinc-950 shadow-md"
                  : "bg-[#16161A] text-zinc-400 hover:text-white hover:bg-[#202026] border border-[#25252B]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── EVENTS LIST: LU.MA OBSIDIAN DARK CARDS ──────────────────────────── */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400 mb-2" />
          <span>Loading hosted events...</span>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-16 text-center text-xs text-zinc-500 bg-[#151518] border border-[#242429] rounded-3xl space-y-3">
          <CalendarDays className="w-10 h-10 mx-auto text-zinc-600" />
          <p className="text-sm font-bold text-zinc-300">No events found</p>
          <p className="text-zinc-500 max-w-sm mx-auto">
            {searchQuery ? "No events match your search criteria." : "Create your first event to start managing registrations and QR admission badges."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((ev) => {
            const isCurrentlySelected = activeEventId === ev.id;
            return (
              <div
                key={ev.id}
                className={`p-5 sm:p-6 rounded-3xl bg-[#151518] border transition-all duration-200 shadow-xl relative overflow-hidden group ${
                  isCurrentlySelected
                    ? "border-emerald-500/60 ring-1 ring-emerald-500/30"
                    : "border-[#242429] hover:border-[#3E3E48]"
                }`}
              >
                {/* Subtle top indicator if active */}
                {isCurrentlySelected && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Left Column: Event Core Info */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#202026] text-zinc-300 border border-[#2F2F38] uppercase font-bold tracking-wider">
                        {ev.eventType}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ev.status === "published" || ev.status === "ongoing"
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      }`}>
                        {ev.status === "published" ? "Live & Published" : ev.status}
                      </span>
                      {ev.isPaid ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono">
                          ₹{ev.registrationFee} Registration Fee
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60 font-mono">
                          Free Admission
                        </span>
                      )}
                      <span className="text-xs text-zinc-500 font-mono">/{ev.slug}</span>
                    </div>

                    <div>
                      <h2
                        onClick={() => selectEvent(ev)}
                        className="text-lg sm:text-xl font-black text-white hover:text-amber-200 transition-colors cursor-pointer leading-snug"
                      >
                        {ev.title}
                      </h2>
                      {ev.shortDescription && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                          {ev.shortDescription}
                        </p>
                      )}
                    </div>

                    {/* Meta Row: Dates, Venue, Toggles */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400 pt-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <CalendarDays className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{ev.startDate} {ev.endDate && ev.endDate !== ev.startDate ? `to ${ev.endDate}` : ""}</span>
                      </div>

                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{ev.timeFrom || "09:00 AM"} – {ev.timeTo || "05:00 PM"}</span>
                      </div>

                      <div className="flex items-center gap-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{ev.venue}, {ev.city}</span>
                      </div>

                      {/* Logistics Toggles Pills */}
                      <div className="flex items-center gap-1.5">
                        {ev.enableAttendance && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1D1D22] text-zinc-300 border border-[#2B2B33]">
                            ATT({ev.attendanceDaysCount || 1}d)
                          </span>
                        )}
                        {ev.enableFood && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-900/50">
                            MEAL
                          </span>
                        )}
                        {ev.enableGoodies && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-900/50">
                            KIT
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Delegate Stats & Action CTAs */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#242429]">
                    {/* Registrations Count Badge */}
                    <div className="text-left sm:text-right">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-white">{ev.totalParticipants || 0}</span>
                        <span className="text-xs text-zinc-500 font-medium">Registered</span>
                      </div>
                      {(() => {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        const isPast = (ev.endDate ? ev.endDate < todayStr : ev.startDate < todayStr) || ev.status === "completed" || ev.status === "archived";
                        const footfall = ev.postEventVisitorCount || ev.totalParticipants || (ev as any).attendanceCount || 0;
                        if (isPast) {
                          return (
                            <div className="text-[10px] text-amber-400 font-semibold">
                              Footfall: {footfall > 0 ? `${footfall.toLocaleString()} Attendees` : "Concluded"}
                            </div>
                          );
                        }
                        return ev.maxCapacity ? (
                          <div className="text-[10px] text-zinc-500">
                            {ev.seatsLeft ?? Math.max(0, ev.maxCapacity - (ev.totalParticipants || 0))} seats left of {ev.maxCapacity}
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Post-Event Wrapup & Gallery Button (for concluded events) */}
                      {(ev.endDate || ev.startDate) < new Date().toISOString().slice(0, 10) && (
                        <Button
                          variant={ev.postEventCompleted ? "outline" : "default"}
                          size="sm"
                          onClick={() => openWrapupModal(ev)}
                          className={`h-9 px-3 rounded-xl text-xs font-bold ${
                            ev.postEventCompleted
                              ? "border-emerald-800/50 bg-emerald-950/40 text-emerald-300 hover:text-white"
                              : "bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black border-none animate-pulse shadow-lg"
                          }`}
                          title="Post-Event Wrapup & Gallery (Min 10 Photos)"
                        >
                          {ev.postEventCompleted ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                              <span>Wrapup Done</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5 mr-1" />
                              <span>Wrapup &amp; 10+ Photos</span>
                            </>
                          )}
                        </Button>
                      )}

                      {/* Open Dedicated Event Workspace */}
                      <Button
                        onClick={() => selectEvent(ev)}
                        className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs shadow-md transition-transform active:scale-98 cursor-pointer flex items-center gap-1.5 border-none"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                      </Button>

                      {/* Promo Coupons */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCouponManager(ev)}
                        className="h-9 px-3 rounded-xl text-xs font-bold border-[#2B2B33] bg-[#16161A] hover:bg-[#222228] text-indigo-300 hover:text-white"
                        title="Manage Promo & Sponsor Codes"
                      >
                        <Tag className="w-3.5 h-3.5 mr-1" />
                        <span>Coupons</span>
                      </Button>

                      {/* Edit Event */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(ev)}
                        className="h-9 w-9 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-[#24242B]"
                        title="Edit Event Configuration"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>

                      {/* Public Link */}
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-9 w-9 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-[#24242B]"
                        title="Open Public Event Portal"
                      >
                        <Link href={`/events/${ev.slug}`} target="_blank">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </Button>

                      {/* Delete Event */}
                      {user?.userType === "super_admin" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEventToDelete(ev);
                            setDeleteConfirmOpen(true);
                          }}
                          className="h-9 w-9 p-0 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-950/40"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT EVENT MODAL (OBSIDIAN DARK THEME) ────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-[#141417] border border-[#2B2B32] text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">
              {editingEvent ? "Edit Event Configuration" : "Create New Event"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Configure event dates, timings, Razorpay pricing, attendance, and meal scan features.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEvent} className="space-y-6 pt-2">
            {/* 1. Basic Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">1. Basic Information</h3>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300">Event Title *</Label>
                <Input
                  required
                  placeholder="e.g. Annual Ophthalmology Conference 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl bg-[#09090B] border-[#2B2B32] text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Event Type</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger className="rounded-xl bg-[#09090B] border-[#2B2B32] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#18181C] border-[#2B2B32] text-white">
                      <SelectItem value="conference">Conference</SelectItem>
                      <SelectItem value="cme">Medical CME</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="internal_staff">Internal Staff Meet</SelectItem>
                      <SelectItem value="symposium">Symposium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Custom URL Slug</Label>
                  <Input
                    placeholder="annual-ophthalmology-2026"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="rounded-xl font-mono text-xs bg-[#09090B] border-[#2B2B32] text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300">Event Narrative / Description</Label>
                <Textarea
                  placeholder="Detailed scientific agenda and event summary..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl min-h-[80px] bg-[#09090B] border-[#2B2B32] text-white"
                />
              </div>
            </div>

            {/* 2. Date, Time & Location */}
            <div className="space-y-4 pt-2 border-t border-[#242429]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">2. Dates, Timing &amp; Location</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Date From *</Label>
                  <Input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-xl text-xs bg-[#09090B] border-[#2B2B32] text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Date To *</Label>
                  <Input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-xl text-xs bg-[#09090B] border-[#2B2B32] text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Time From</Label>
                  <Input
                    placeholder="09:00 AM"
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                    className="rounded-xl text-xs bg-[#09090B] border-[#2B2B32] text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Time To</Label>
                  <Input
                    placeholder="05:00 PM"
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                    className="rounded-xl text-xs bg-[#09090B] border-[#2B2B32] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Venue Name</Label>
                  <Input
                    placeholder="Sankara Eye Hospital Auditorium"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="rounded-xl bg-[#09090B] border-[#2B2B32] text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">City / Location</Label>
                  <Input
                    placeholder="Coimbatore, Tamil Nadu"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-xl bg-[#09090B] border-[#2B2B32] text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300">Google Maps Direction URL</Label>
                <Input
                  placeholder="https://maps.google.com/?q=..."
                  value={locationMapUrl}
                  onChange={(e) => setLocationMapUrl(e.target.value)}
                  className="rounded-xl text-xs bg-[#09090B] border-[#2B2B32] text-white"
                />
              </div>
            </div>

            {/* 3. Multi-Role Pricing & Razorpay Gateway */}
            <div className="space-y-4 pt-2 border-t border-[#242429]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">3. Multi-Role Pricing &amp; Registration Tiers</h3>
                  <p className="text-[11px] text-zinc-500">Configure role-specific registration fees (e.g. PG Students, Delegates, Faculty, Members)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-300">Paid Event:</span>
                  <Switch
                    checked={isPaid}
                    onCheckedChange={(checked) => {
                      setIsPaid(checked);
                      if (checked && pricingTiers.every((t) => t.price === 0)) {
                        setPricingTiers(PRESET_PRICING_CME_5_TIERS);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Tiers Management Controls */}
              <div className="p-4 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#202026] pb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-zinc-400">Apply Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyPricingPreset(PRESET_PRICING_CME_5_TIERS)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#14141A] hover:bg-[#1E1E28] text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                    >
                      5-Tier CME Conference
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPricingPreset(PRESET_PRICING_WORKSHOP_3_TIERS)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#14141A] hover:bg-[#1E1E28] text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
                    >
                      3-Tier Workshop
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPricingPreset(PRESET_PRICING_FREE)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#14141A] hover:bg-[#1E1E28] text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                    >
                      Complimentary Free
                    </button>
                  </div>

                  <Button
                    type="button"
                    onClick={addPricingTier}
                    size="sm"
                    className="h-7 px-2.5 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Tier</span>
                  </Button>
                </div>

                {/* Tiers List */}
                <div className="space-y-3">
                  {pricingTiers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No pricing tiers configured. Click "Add Tier" or choose a preset above.
                    </div>
                  ) : (
                    pricingTiers.map((tier, idx) => (
                      <div
                        key={tier.id || idx}
                        className="p-3.5 rounded-xl bg-[#121217] border border-[#23232C] space-y-3 relative group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-[10px] font-bold font-mono">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-black text-white">{tier.name}</span>
                            {tier.popular && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold uppercase">
                                Popular
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updatePricingTier(idx, { popular: !tier.popular })}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                                tier.popular
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : "bg-[#1A1A22] text-zinc-400 hover:text-zinc-200 border border-[#2B2B38]"
                              }`}
                            >
                              ★ {tier.popular ? "Highlighted" : "Highlight"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removePricingTier(idx)}
                              className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete Tier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          <div className="sm:col-span-2 space-y-1">
                            <Label className="text-[10px] font-bold text-zinc-400">Tier Display Name</Label>
                            <Input
                              value={tier.name}
                              onChange={(e) => updatePricingTier(idx, { name: e.target.value })}
                              placeholder="e.g. PG Resident / Fellow"
                              className="h-8 rounded-lg text-xs bg-[#09090C] border-[#2B2B35] text-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-zinc-400">Target Role / Category</Label>
                            <Select
                              value={tier.role || "delegate"}
                              onValueChange={(val) => updatePricingTier(idx, { role: val })}
                            >
                              <SelectTrigger className="h-8 rounded-lg text-xs bg-[#09090C] border-[#2B2B35] text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#18181F] border-[#2A2A35] text-white">
                                {ROLE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.id} value={opt.id} className="text-xs">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-zinc-400">Standard Price (₹)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={tier.price}
                              onChange={(e) => updatePricingTier(idx, { price: Number(e.target.value) })}
                              placeholder="₹ 2000"
                              className="h-8 rounded-lg text-xs bg-[#09090C] border-[#2B2B35] text-white font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-zinc-400">Early Bird Price (₹ Optional)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={tier.earlyBirdPrice !== undefined ? tier.earlyBirdPrice : ""}
                              onChange={(e) => updatePricingTier(idx, { earlyBirdPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                              placeholder="e.g. 1600"
                              className="h-8 rounded-lg text-xs bg-[#09090C] border-[#2B2B35] text-white font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-zinc-400">Short Description</Label>
                            <Input
                              value={tier.description || ""}
                              onChange={(e) => updatePricingTier(idx, { description: e.target.value })}
                              placeholder="e.g. Subsidized rate for clinical residents"
                              className="h-8 rounded-lg text-xs bg-[#09090C] border-[#2B2B35] text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {isPaid && (
                  <div className="pt-3 border-t border-[#202026] space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-zinc-300">Razorpay Key ID (Optional override)</Label>
                        <Input
                          placeholder="rzp_live_..."
                          value={razorpayKeyId}
                          onChange={(e) => setRazorpayKeyId(e.target.value)}
                          className="rounded-xl bg-[#141417] border-[#2B2B32] font-mono text-xs text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-zinc-300">Razorpay Key Secret</Label>
                        <Input
                          type="password"
                          placeholder="••••••••••••"
                          value={razorpayKeySecret}
                          onChange={(e) => setRazorpayKeySecret(e.target.value)}
                          className="rounded-xl bg-[#141417] border-[#2B2B32] font-mono text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Feature Toggles & Scanner Logistics */}
            <div className="space-y-4 pt-2 border-t border-[#242429]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">4. Check-in &amp; Scanner Toggles</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-white">Attendance Scan</span>
                    </div>
                    <Switch checked={enableAttendance} onCheckedChange={setEnableAttendance} />
                  </div>
                  {enableAttendance && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-zinc-400">Days to track:</span>
                      <Select value={String(attendanceDaysCount)} onValueChange={(v) => setAttendanceDaysCount(Number(v))}>
                        <SelectTrigger className="h-8 w-24 rounded-lg text-xs bg-[#141417] border-[#2B2B32] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#18181C] border-[#2B2B32] text-white">
                          <SelectItem value="1">1 Day</SelectItem>
                          <SelectItem value="2">2 Days</SelectItem>
                          <SelectItem value="3">3 Days</SelectItem>
                          <SelectItem value="4">4 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl bg-[#09090B] border border-[#2B2B32] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-blue-400" />
                    <div>
                      <span className="font-bold text-xs text-white block">Food / Meal Scans</span>
                      <span className="text-[10px] text-zinc-500">Digital meal validation</span>
                    </div>
                  </div>
                  <Switch checked={enableFood} onCheckedChange={setEnableFood} />
                </div>

                <div className="p-3.5 rounded-2xl bg-[#09090B] border border-[#2B2B32] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="font-bold text-xs text-white block">Kit Bag / Goodies Scan</span>
                      <span className="text-[10px] text-zinc-500">Kit QR collection toggle</span>
                    </div>
                  </div>
                  <Switch checked={enableGoodies} onCheckedChange={setEnableGoodies} />
                </div>

                <div className="p-3.5 rounded-2xl bg-[#09090B] border border-[#2B2B32] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="font-bold text-xs text-white block">Require Approval</span>
                      <span className="text-[10px] text-zinc-500">Coordinator review gate</span>
                    </div>
                  </div>
                  <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
                </div>
              </div>
            </div>

            {/* 5. Date & Time-wise Event Agenda Builder */}
            <div className="space-y-4 pt-2 border-t border-[#242429]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">5. Event Agenda &amp; Schedule</h3>
                  <p className="text-[11px] text-zinc-500">Configure schedule from start to end time with breaks, keynotes, and sessions.</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addAgendaSlot({ title: "Morning Tea & Networking", type: "break_tea", timeFrom: "11:00 AM", timeTo: "11:30 AM" })}
                    className="h-7 text-[11px] rounded-lg border-[#2B2B32] bg-[#09090B] hover:bg-[#1A1A1E] text-zinc-300 cursor-pointer"
                  >
                    <Coffee className="w-3 h-3 text-amber-400 mr-1" /> + Tea Break
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addAgendaSlot({ title: "Buffet Lunch & Delegate Networking", type: "break_lunch", timeFrom: "01:00 PM", timeTo: "02:00 PM" })}
                    className="h-7 text-[11px] rounded-lg border-[#2B2B32] bg-[#09090B] hover:bg-[#1A1A1E] text-zinc-300 cursor-pointer"
                  >
                    <Utensils className="w-3 h-3 text-blue-400 mr-1" /> + Lunch
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => addAgendaSlot()}
                    className="h-7 text-[11px] rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer"
                  >
                    <Plus className="w-3 h-3 mr-1" /> + Session
                  </Button>
                </div>
              </div>

              {agendaSlots.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-[#2B2B32] rounded-2xl">
                  No agenda slots configured yet. Click buttons above to add sessions.
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {agendaSlots.map((slot, idx) => (
                    <div key={slot.id} className="p-3.5 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                          Slot #{idx + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAgendaSlot(slot.id)}
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-3">
                          <Label className="text-[10px] text-zinc-400">Time From</Label>
                          <Input
                            placeholder="09:00 AM"
                            value={slot.timeFrom}
                            onChange={(e) => updateAgendaSlot(slot.id, { timeFrom: e.target.value })}
                            className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <Label className="text-[10px] text-zinc-400">Time To</Label>
                          <Input
                            placeholder="10:00 AM"
                            value={slot.timeTo}
                            onChange={(e) => updateAgendaSlot(slot.id, { timeTo: e.target.value })}
                            className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-6">
                          <Label className="text-[10px] text-zinc-400">Topic / Session Title</Label>
                          <Input
                            placeholder="Session / Lecture Topic Title"
                            value={slot.title}
                            onChange={(e) => updateAgendaSlot(slot.id, { title: e.target.value })}
                            className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-lg font-semibold"
                          />
                        </div>
                      </div>

                      {/* Speaker / Faculty Mapping Against Topic */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div>
                          <Label className="text-[10px] text-zinc-400">Faculty / Speaker Name(s)</Label>
                          <Input
                            placeholder="e.g. Dr. A. Sharma, Dr. Priya S"
                            value={slot.speaker || ""}
                            onChange={(e) => updateAgendaSlot(slot.id, { speaker: e.target.value })}
                            className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-amber-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-zinc-400">Speaker Designation &amp; Institute</Label>
                          <Input
                            placeholder="e.g. Head of Cornea, Sankara Eye Hospital"
                            value={slot.speakerDesignation || ""}
                            onChange={(e) => updateAgendaSlot(slot.id, { speakerDesignation: e.target.value })}
                            className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-zinc-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-zinc-400">Track / Hall / Moderator</Label>
                          <Input
                            placeholder="e.g. Hall A | Mod: Dr. R. Verma"
                            value={slot.trackHall || ""}
                            onChange={(e) => updateAgendaSlot(slot.id, { trackHall: e.target.value })}
                            className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-cyan-200 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Event PDF Documents, Awards & AI Photos */}
            <div className="space-y-4 pt-2 border-t border-[#242429]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  6. Event PDF Documents, Awards List &amp; AI Photos Platform
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Upload PDF documents and link external AI photo detection services (Samaro AI / Photomall).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Main Agenda PDF */}
                <div className="p-4 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-zinc-300" /> Agenda PDF Document
                    </span>
                    {agendaPdfUrl && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                        Uploaded ✓
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">Button Display Name</Label>
                    <Input
                      placeholder="e.g. Download Event Agenda (PDF)"
                      value={agendaPdfButtonText}
                      onChange={(e) => setAgendaPdfButtonText(e.target.value)}
                      className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">PDF File</Label>
                    <Input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePdfUpload(f, "agenda");
                      }}
                      disabled={uploadingPdf}
                      className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-zinc-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-zinc-950 hover:file:bg-zinc-200 cursor-pointer"
                    />
                    {agendaPdfUrl && (
                      <p className="text-[10px] text-zinc-500 font-mono truncate" title={agendaPdfUrl}>
                        URL: {agendaPdfUrl}
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Awards & Winners PDF Document */}
                <div className="p-4 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-amber-400" /> Awards &amp; Winners List (PDF)
                    </span>
                    {awardsPdfUrl && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40">
                        Uploaded ✓
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">Button Display Name</Label>
                    <Input
                      placeholder="e.g. Download Awards & Winners List (PDF)"
                      value={awardsPdfButtonText}
                      onChange={(e) => setAwardsPdfButtonText(e.target.value)}
                      className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">PDF File</Label>
                    <Input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePdfUpload(f, "awards");
                      }}
                      disabled={uploadingPdf}
                      className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-zinc-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-zinc-950 hover:file:bg-zinc-200 cursor-pointer"
                    />
                    {awardsPdfUrl && (
                      <p className="text-[10px] text-zinc-500 font-mono truncate" title={awardsPdfUrl}>
                        URL: {awardsPdfUrl}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. AI Photo Identification Platform Link */}
                <div className="sm:col-span-2 p-4 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> AI-Enabled Event Photo Detection Platform (Samaro AI / Photomall)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-400">Platform URL Link</Label>
                      <Input
                        placeholder="https://samaro.ai/event/... or https://photomall.in/..."
                        value={externalPhotosUrl}
                        onChange={(e) => setExternalPhotosUrl(e.target.value)}
                        className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-400">Button Display Text</Label>
                      <Input
                        placeholder="e.g. Find Your Photos with AI (Samaro AI)"
                        value={externalPhotosButtonText}
                        onChange={(e) => setExternalPhotosButtonText(e.target.value)}
                        className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. CME SPOC Helpdesk, Document Uploads & Cancellation Policy */}
            <div className="space-y-4 pt-2 border-t border-[#242429]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  7. CME SPOC Contact &amp; Registration Document Rules
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Configure Single Point of Contact (SPOC), Document uploads (Medical Council Certificate), and Cancellation Policy.
                </p>
              </div>

              {/* SPOC Contact Details */}
              <div className="p-4 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-3">
                <h4 className="text-xs font-bold text-zinc-200">Event SPOC (Single Point of Contact)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">SPOC Name</Label>
                    <Input
                      placeholder="e.g. Dr. Anand Sharma"
                      value={spocName}
                      onChange={(e) => setSpocName(e.target.value)}
                      className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">SPOC Designation</Label>
                    <Input
                      placeholder="e.g. CME Coordinator"
                      value={spocDesignation}
                      onChange={(e) => setSpocDesignation(e.target.value)}
                      className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">Phone / WhatsApp</Label>
                    <Input
                      placeholder="e.g. +91 9876543210"
                      value={spocPhone}
                      onChange={(e) => setSpocPhone(e.target.value)}
                      className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">SPOC Email</Label>
                    <Input
                      placeholder="e.g. cme.coimbatore@sankaraeye.com"
                      value={spocEmail}
                      onChange={(e) => setSpocEmail(e.target.value)}
                      className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Document Upload & Group Reg Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white">Require Document Upload</span>
                      <p className="text-[10px] text-zinc-500">E.g. Medical Council Certificate / Student ID</p>
                    </div>
                    <Switch
                      checked={requireDocumentUpload}
                      onCheckedChange={setRequireDocumentUpload}
                    />
                  </div>
                  {requireDocumentUpload && (
                    <div className="space-y-2 pt-2 border-t border-[#202026]">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-zinc-400">Upload Field Label</Label>
                        <Input
                          placeholder="Upload Medical Council Certificate / Student ID"
                          value={documentUploadLabel}
                          onChange={(e) => setDocumentUploadLabel(e.target.value)}
                          className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-xl"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="docReqCheck"
                          checked={documentUploadRequired}
                          onChange={(e) => setDocumentUploadRequired(e.target.checked)}
                          className="rounded border-[#2B2B32] text-blue-600 focus:ring-0"
                        />
                        <label htmlFor="docReqCheck" className="text-xs text-zinc-300 cursor-pointer">
                          Mandatory (Delegates cannot submit without file)
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white">Enable Group Registration</span>
                      <p className="text-[10px] text-zinc-500">Allow institutions to register multiple delegates in bulk</p>
                    </div>
                    <Switch
                      checked={groupRegistrationEnabled}
                      onCheckedChange={setGroupRegistrationEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300">Cancellation &amp; Refund Policy</Label>
                <Textarea
                  placeholder="State the cancellation deadlines, refund percentage, and SPOC contact routing..."
                  value={cancellationPolicy}
                  onChange={(e) => setCancellationPolicy(e.target.value)}
                  className="rounded-xl min-h-[70px] bg-[#09090B] border-[#2B2B32] text-white text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-[#242429]">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} className="rounded-xl border-[#2B2B32] text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-6 cursor-pointer border-none">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                <span>{editingEvent ? "Save Changes" : "Create Event"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── COUPONS & SPONSORED PASSES MODAL (OBSIDIAN DARK) ────────────────── */}
      <Dialog open={couponModalOpen} onOpenChange={setCouponModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 bg-[#141417] border border-[#2B2B32] text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
              <Tag className="w-5 h-5 text-indigo-400" />
              <span>Coupons &amp; Sponsored Passes</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Manage discount codes and 100% sponsored passes for <strong>{selectedEventForCoupons?.title}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Create Coupon Form */}
            <form onSubmit={handleCreateCoupon} className="p-4 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-3">
              <h4 className="text-xs font-bold text-zinc-300">Add New Promo / Sponsor Code</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-zinc-400">Code *</Label>
                  <Input
                    required
                    placeholder="e.g. SANKARA20"
                    value={newCouponCode}
                    onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                    className="h-9 rounded-lg font-mono uppercase text-xs bg-[#141417] border-[#2B2B32] text-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-zinc-400">Discount Type</Label>
                  <Select value={newCouponType} onValueChange={setNewCouponType}>
                    <SelectTrigger className="h-9 rounded-lg text-xs bg-[#141417] border-[#2B2B32] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#18181C] border-[#2B2B32] text-white">
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Flat Amount (₹)</SelectItem>
                      <SelectItem value="sponsor_free">100% Sponsored Pass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-zinc-400">Value ({newCouponType === "percentage" ? "%" : "₹"})</Label>
                  <Input
                    type="number"
                    required
                    disabled={newCouponType === "sponsor_free"}
                    value={newCouponType === "sponsor_free" ? 100 : newCouponValue}
                    onChange={(e) => setNewCouponValue(Number(e.target.value))}
                    className="h-9 rounded-lg text-xs bg-[#141417] border-[#2B2B32] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-zinc-400">Sponsor Name (Optional)</Label>
                  <Input
                    placeholder="e.g. Alcon / Zeiss Platinum"
                    value={newCouponSponsor}
                    onChange={(e) => setNewCouponSponsor(e.target.value)}
                    className="h-9 rounded-lg text-xs bg-[#141417] border-[#2B2B32] text-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-zinc-400">Description (Optional)</Label>
                  <Input
                    placeholder="e.g. 20% Special Institutional Offer"
                    value={newCouponDesc}
                    onChange={(e) => setNewCouponDesc(e.target.value)}
                    className="h-9 rounded-lg text-xs bg-[#141417] border-[#2B2B32] text-white"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={creatingCoupon || !newCouponCode.trim()}
                className="w-full h-9 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-sm cursor-pointer border-none"
              >
                {creatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                <span>Create &amp; Activate Coupon</span>
              </Button>
            </form>

            {/* Coupons List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-300">Active Coupons ({eventCoupons?.length || 0})</h4>
              {(eventCoupons || []).length === 0 ? (
                <p className="text-xs text-zinc-500 p-4 text-center">No coupons created yet.</p>
              ) : (
                <div className="space-y-2">
                  {eventCoupons?.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl bg-[#09090B] border border-[#2B2B32] flex items-center justify-between gap-3 shadow-sm">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-white uppercase">{c.code}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                            {c.discountType === "sponsor_free" ? "100% FREE PASS" : (c.discountType === "percentage" ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`)}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {c.sponsorName ? `Sponsor: ${c.sponsorName}` : (c.description || "General Discount")} • Used {c.usedCount} times
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCoupon(c.id)}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DELETE EVENT CONFIRMATION MODAL ─────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-[#141417] border border-[#2B2B32] text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              <span>Delete Event?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 pt-1">
              Are you sure you want to delete <strong>{eventToDelete?.title}</strong>? All registered participants and scanner logs associated with this event will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="rounded-xl border-[#2B2B32] text-zinc-300">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEvent} disabled={deleting} className="rounded-xl font-bold">
              {deleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── POST-EVENT WRAPUP & GALLERY MODAL (MIN 10 PHOTOS) ─────────────── */}
      <Dialog open={wrapupModalOpen} onOpenChange={setWrapupModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-[#141417] border border-[#2B2B32] text-white shadow-2xl space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  📸
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-white">
                    Post-Event Wrapup &amp; Photo Gallery
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-400">
                    {selectedEventForWrapup?.title} (Concluded on {selectedEventForWrapup?.endDate || selectedEventForWrapup?.startDate})
                  </DialogDescription>
                </div>
              </div>

              <span
                className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                  wrapupGallery.length >= 10
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                    : "bg-amber-950/80 text-amber-300 border-amber-800"
                }`}
              >
                Photos: {wrapupGallery.length} / 10 Min Required
              </span>
            </div>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            {/* Step 1: Upload Photos */}
            <div className="p-4 rounded-2xl bg-[#0C0C0E] border border-[#242429] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-white uppercase tracking-wider block">
                    1. Upload Event Photos (Minimum 10 Required) *
                  </Label>
                  <p className="text-[11px] text-zinc-400">
                    Upload high-resolution event photographs, session captures, and delegate moments.
                  </p>
                </div>

                <div className="relative">
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    disabled={uploadingGallery}
                    onChange={(e) => handleGalleryUpload(e.target.files)}
                    className="h-9 bg-[#1A1A1F] border-[#2A2A30] text-zinc-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-zinc-950 hover:file:bg-zinc-200 cursor-pointer text-xs"
                  />
                </div>
              </div>

              {uploadingGallery && (
                <div className="p-3 text-center text-xs text-zinc-400 bg-[#16161A] rounded-xl flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Uploading images to server...</span>
                </div>
              )}

              {/* Photo Thumbnails Grid */}
              {wrapupGallery.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-[#242429] rounded-xl">
                  No photos uploaded yet. Please select at least 10 images.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 max-h-48 overflow-y-auto p-1 bg-[#121215] rounded-xl">
                  {wrapupGallery.map((imgUrl, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-[#2B2B32] aspect-video bg-black">
                      <img src={imgUrl} alt={`Event ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveGalleryImage(idx)}
                        className="absolute top-1 right-1 p-1 rounded-md bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 text-[9px] font-mono font-bold px-1 rounded bg-black/70 text-white">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Manually Enter Visitor Count */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-white">
                2. Official Attendee / Visitor Footfall Count (Manual Entry) *
              </Label>
              <Input
                type="number"
                min="1"
                value={wrapupVisitorCount}
                onChange={(e) => setWrapupVisitorCount(e.target.value)}
                placeholder="e.g. 850"
                className="h-10 bg-[#0C0C0E] border-[#2B2B32] text-white font-mono font-bold text-sm rounded-xl"
              />
            </div>

            {/* Step 3: Event Summary */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-white">
                3. Event Summary / About How the Event Unfolded *
              </Label>
              <Textarea
                rows={3}
                value={wrapupSummary}
                onChange={(e) => setWrapupSummary(e.target.value)}
                placeholder="Provide a comprehensive summary of the event highlights, key scientific sessions, and overall attendance experience..."
                className="bg-[#0C0C0E] border-[#2B2B32] text-white rounded-xl text-xs"
              />
            </div>

            {/* Step 4: Event Highlights & Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-white">
                4. Key Highlights, Scientific Tracks &amp; Milestones *
              </Label>
              <Textarea
                rows={3}
                value={wrapupDescription}
                onChange={(e) => setWrapupDescription(e.target.value)}
                placeholder="Notable surgical demonstrations, paper presentations, guest speaker remarks, and awards presented..."
                className="bg-[#0C0C0E] border-[#2B2B32] text-white rounded-xl text-xs"
              />
            </div>

            {/* Step 5: Ending Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-white">
                5. Ending Notes &amp; Acknowledgments *
              </Label>
              <Textarea
                rows={2}
                value={wrapupEndingNotes}
                onChange={(e) => setWrapupEndingNotes(e.target.value)}
                placeholder="Acknowledgments to organizing committee, faculties, catering team, vendors, and concluding statements..."
                className="bg-[#0C0C0E] border-[#2B2B32] text-white rounded-xl text-xs"
              />
            </div>

            {/* Step 6: AI Event Photos Platform URL (Samaro AI / Photomall) */}
            <div className="p-3.5 rounded-2xl bg-[#09090B] border border-[#2B2B32] space-y-2.5">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> 6. AI Photo Recognition Platform Link (Samaro AI / Photomall / Premagic)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-400">Platform Link</Label>
                  <Input
                    placeholder="https://app.samaro.ai/e/... or https://photomall.in/..."
                    value={wrapupExternalPhotosUrl}
                    onChange={(e) => setWrapupExternalPhotosUrl(e.target.value)}
                    className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-400">Button Display Text</Label>
                  <Input
                    placeholder="Find My Photos with AI"
                    value={wrapupExternalPhotosButtonText}
                    onChange={(e) => setWrapupExternalPhotosButtonText(e.target.value)}
                    className="h-8 text-xs bg-[#141417] border-[#2B2B32] text-white rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-[#242429]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWrapupModalOpen(false)}
              className="rounded-xl border-[#2B2B32] text-zinc-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveWrapup}
              disabled={submittingWrapup || wrapupGallery.length < 10}
              className="rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs border-none cursor-pointer shadow-lg px-6"
            >
              {submittingWrapup ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  <span>Saving Wrapup...</span>
                </>
              ) : (
                <span>Complete &amp; Archive Event ✓</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

