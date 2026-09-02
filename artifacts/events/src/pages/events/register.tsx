import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  CreditCard,
  QrCode,
  CalendarPlus,
  Compass,
  Building,
  User,
  Mail,
  Phone,
  Briefcase,
  Loader2,
  Tag,
  Sparkles,
  Check,
  X,
  Award,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { GoogleWalletButton } from "@/components/google-wallet-button";
import confetti from "canvas-confetti";
import { ThreeAmbientScene } from "@/components/3d/three-ambient-scene";
import { PerspectiveCard } from "@/components/3d/perspective-card";
import { TactileButton } from "@/components/3d/tactile-button";
import { HolographicPassCard } from "@/components/3d/holographic-pass-card";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function EventRegisterPage() {
  const [, params] = useRoute("/events/:slug/register");
  const slug = params?.slug;
  const { toast } = useToast();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [institution, setInstitution] = useState("");
  const [designation, setDesignation] = useState("");
  const [medicalCouncilRegNumber, setMedicalCouncilRegNumber] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [foodPreference, setFoodPreference] = useState<"veg" | "non_veg">("veg");

  // Initial mode from URL query param (?mode=group)
  const searchParams = new URLSearchParams(window.location.search);
  const initialMode = searchParams.get("mode") === "group" ? "group" : "single";
  const [regMode, setRegMode] = useState<"single" | "group">(initialMode);

  // Group Registration state
  const [orgName, setOrgName] = useState("");
  const [coordName, setCoordName] = useState("");
  const [coordEmail, setCoordEmail] = useState("");
  const [coordPhone, setCoordPhone] = useState("");
  const [groupDelegates, setGroupDelegates] = useState<Array<{ id: string; name: string; email: string; mobile: string; designation: string; categoryTierName: string }>>([
    { id: "del-1", name: "", email: "", mobile: "", designation: "Delegate", categoryTierName: "Official Delegate" },
  ]);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [groupRegisteredData, setGroupRegisteredData] = useState<any>(null);

  // Initial role tier from URL query param (?tier=xxx)
  const initialTier = searchParams.get("tier") || "delegate";
  const [selectedTierId, setSelectedTierId] = useState<string>(initialTier);

  // Auto-fill logged in user's profile information (Google OAuth or OTP session)
  useEffect(() => {
    if (user) {
      if (user.name && user.name !== "Delegate" && !name) {
        setName(user.name);
      }
      if ((user as any).email && !email) {
        setEmail((user as any).email);
      }
      if (user.mobile && !mobile) {
        setMobile(user.mobile);
      }
      if ((user as any).institution && !institution) {
        setInstitution((user as any).institution);
      }
    }
  }, [user]);

  // Coupon / Discount states
  const [couponInput, setCouponInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);

  // Pre-payment validation & error state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mobileWarning, setMobileWarning] = useState<string | null>(null);
  const [checkingMobile, setCheckingMobile] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [registeredData, setRegisteredData] = useState<any>(null);

  const { data: event, isLoading, error } = useQuery<any>({
    queryKey: ["/api/events", slug],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/events/${slug}`);
      if (!res.ok) throw new Error("Event not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const pricingTiers: any[] = event?.pricingTiers && event.pricingTiers.length > 0
    ? event.pricingTiers
    : [
        {
          id: "attendee",
          name: "General Attendee",
          role: "attendee",
          price: 1500,
          earlyBirdPrice: 1200,
          earlyBirdDeadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          description: "General admission pass for clinical observers & hospital staff.",
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
          description: "Subsidized tariff for active institutional and society members.",
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
          badgeLabel: "Standard",
        },
        {
          id: "student_pg",
          name: "PG Resident / Fellow",
          role: "student",
          price: 999,
          earlyBirdPrice: 799,
          earlyBirdDeadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          description: "Subsidized rate for post-graduate students & residents.",
          badgeLabel: "Student Rate",
        },
      ];

  const activeTier = pricingTiers.find((t) => t.id === selectedTierId || t.role === selectedTierId) || pricingTiers[0];
  const isEarlyBirdActive = event?.isPaid && activeTier?.earlyBirdPrice !== undefined && (activeTier.earlyBirdDeadline ? new Date(activeTier.earlyBirdDeadline) >= new Date() : true);
  const baseTierPrice = event?.isPaid ? (isEarlyBirdActive ? activeTier.earlyBirdPrice : activeTier.price) : 0;
  const isPaidEvent = event?.isPaid && baseTierPrice > 0;

  // Calculate dynamic price after coupon discount
  let finalFee = baseTierPrice;
  let discountAmount = 0;

  if (appliedCoupon && isPaidEvent) {
    if (appliedCoupon.discountType === "percentage") {
      discountAmount = Math.round((baseTierPrice * appliedCoupon.discountValue) / 100);
      finalFee = Math.max(0, baseTierPrice - discountAmount);
    } else if (appliedCoupon.discountType === "fixed") {
      discountAmount = Math.min(baseTierPrice, appliedCoupon.discountValue);
      finalFee = Math.max(0, baseTierPrice - discountAmount);
    } else if (appliedCoupon.discountType === "sponsor_free") {
      discountAmount = baseTierPrice;
      finalFee = 0;
    }
  }

  const isFreeAfterDiscount = !isPaidEvent || finalFee === 0;

  // Coupon validation trigger
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    try {
      const res = await fetch(`${BASE_URL}/api/events/${slug}/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        toast({
          title: "Invalid Coupon",
          description: data.error || "The coupon code you entered is invalid or expired.",
          variant: "destructive",
        });
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon(data);
      toast({
        title: "Coupon Applied! 🎉",
        description: data.discountType === "sponsor_free"
          ? `100% Free Sponsored Pass by ${data.sponsorName || "Sponsor"}`
          : `Saved ₹${data.discountAmount} on registration!`,
      });
    } catch {
      toast({ title: "Validation Error", description: "Could not validate coupon.", variant: "destructive" });
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    toast({ title: "Coupon Removed" });
  };

  const checkMobileAvailability = async (mobValue: string) => {
    const cleanMob = mobValue.replace(/[^0-9]/g, "").slice(-10);
    if (cleanMob.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMob)) {
      setMobileWarning("Please enter a valid 10-digit Indian mobile number starting with 6-9.");
      return;
    }
    setCheckingMobile(true);
    try {
      const res = await fetch(`${BASE_URL}/api/events/${slug}/validate-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Delegate",
          email: email.trim() || "delegate@example.com",
          mobile: cleanMob,
          institution: institution.trim() || "Hospital",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        if (data.field === "mobile") {
          setMobileWarning(data.error);
        } else {
          setValidationError(data.error);
        }
      } else {
        setMobileWarning(null);
        setValidationError(null);
      }
    } catch {
      // ignore network hiccup on blur
    } finally {
      setCheckingMobile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError("Full Name is required.");
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!mobile.trim()) {
      setValidationError("Mobile number is required.");
      toast({ title: "Mobile number is required", variant: "destructive" });
      return;
    }
    const cleanMob = mobile.replace(/[^0-9]/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMob)) {
      setValidationError("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).",
        variant: "destructive",
      });
      return;
    }
    if (!institution.trim()) {
      setValidationError("Institution / Organization is required.");
      toast({ title: "Institution / Organization is required", variant: "destructive" });
      return;
    }

    if (event.eventType === "internal_staff") {
      const cleanEm = email.trim().toLowerCase();
      if (!cleanEm || (!cleanEm.endsWith("@sankaraeye.com") && !cleanEm.endsWith("@sankaraeye.in"))) {
        const staffErr = "This internal event is restricted strictly to Sankara staff. Please use your official @sankaraeye.com email.";
        setValidationError(staffErr);
        toast({
          title: "Internal Event Restricted",
          description: staffErr,
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      // ═════════════════════════════════════════════════════════════════════════
      // CRITICAL PRE-FLIGHT VALIDATION: Check server constraints BEFORE payment!
      // (Verifies duplicate mobile, capacity, email domain, event status)
      // ═════════════════════════════════════════════════════════════════════════
      const valRes = await fetch(`${BASE_URL}/api/events/${slug}/validate-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          mobile: cleanMob,
          institution: institution.trim(),
          couponCode: appliedCoupon?.code || couponInput.trim() || undefined,
          tierId: activeTier?.id,
          role: activeTier?.role,
        }),
      });

      const valData = await valRes.json();
      if (!valRes.ok || !valData.valid) {
        const errorMsg = valData.error || "Registration validation failed. Please check your details and try again.";
        setValidationError(errorMsg);
        toast({
          title: "Application Validation Issue",
          description: errorMsg,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (!isFreeAfterDiscount) {
        // Paid Event -> Step 1: Create Razorpay Order (Only AFTER Pre-Validation Passes!)
        const orderRes = await fetch(`${BASE_URL}/api/payments/razorpay/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            amount: finalFee,
            currency: event.currency || "INR",
          }),
        });

        if (!orderRes.ok) {
          throw new Error("Failed to initialize payment gateway");
        }

        const orderData = await orderRes.json();
        setPaymentProcessing(true);

        // Open Razorpay Modal or Simulate in Sandbox
        if (typeof (window as any).Razorpay !== "undefined" && orderData.keyId && orderData.keyId !== "rzp_test_mock") {
          const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency || "INR",
            name: "Sankara Events",
            description: `Registration for ${event.title}`,
            order_id: orderData.orderId,
            modal: {
              ondismiss: () => {
                setPaymentProcessing(false);
                setSubmitting(false);
                toast({ title: "Payment Cancelled", description: "You can retry registration when ready." });
              },
            },
            handler: async (response: any) => {
              await completeRegistration({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                amount: finalFee,
              });
            },
            prefill: {
              name,
              email,
              contact: mobile,
            },
            theme: {
              color: "#18181B",
            },
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        } else {
          // Test/Sandbox Simulated payment
          setTimeout(async () => {
            await completeRegistration({
              paymentId: `pay_sim_${Date.now()}`,
              orderId: orderData.orderId,
              signature: "sig_simulated_valid",
              amount: finalFee,
            });
          }, 1000);
        }
      } else {
        // Free or 100% Discounted Event -> Direct Registration
        await completeRegistration({
          paymentId: null,
          orderId: null,
          signature: null,
          amount: 0,
        });
      }
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.message || "An error occurred while processing your registration.",
        variant: "destructive",
      });
      setSubmitting(false);
      setPaymentProcessing(false);
    }
  };

  const handleDocUpload = async (file: File) => {
    if (!file) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE_URL}/api/events/upload-pdf`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload document");
      }
      const data = await res.json();
      setDocumentUrl(data.url);
      toast({ title: "Document Uploaded ✓", description: data.originalName });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleAddGroupDelegate = () => {
    const nextNum = groupDelegates.length + 1;
    setGroupDelegates((prev) => [
      ...prev,
      {
        id: `del-${Date.now()}-${nextNum}`,
        name: "",
        email: "",
        mobile: "",
        designation: "Delegate",
        categoryTierName: activeTier?.name || "Official Delegate",
      },
    ]);
  };

  const handleUpdateGroupDelegate = (index: number, field: string, val: string) => {
    setGroupDelegates((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveGroupDelegate = (index: number) => {
    if (groupDelegates.length <= 1) return;
    setGroupDelegates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !coordName.trim() || !coordEmail.trim() || !coordPhone.trim()) {
      toast({ title: "Missing Contact Details", description: "Organization & coordinator contact details are required.", variant: "destructive" });
      return;
    }
    const cleanPhone = coordPhone.replace(/[^0-9]/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      toast({ title: "Invalid Mobile Number", description: "Please enter a valid 10-digit Indian mobile number for coordinator.", variant: "destructive" });
      return;
    }
    if (groupDelegates.some((d) => !d.name.trim())) {
      toast({ title: "Incomplete Delegates", description: "Please enter the full name for each delegate in the group.", variant: "destructive" });
      return;
    }

    setSubmittingGroup(true);
    try {
      const res = await fetch(`${BASE_URL}/api/events/${event.id}/group-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: orgName.trim(),
          coordinatorName: coordName.trim(),
          coordinatorEmail: coordEmail.trim().toLowerCase(),
          coordinatorPhone: cleanPhone,
          delegates: groupDelegates,
          paymentMethod: isPaidEvent ? "online" : "complimentary",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit group registration");
      }

      const data = await res.json();
      setGroupRegisteredData(data);
      try {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      } catch {}
      toast({ title: "Group Registration Confirmed! 🎉", description: `Booking Code: ${data.groupCode}` });
    } catch (err: any) {
      toast({ title: "Group Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingGroup(false);
    }
  };

  const completeRegistration = async (paymentDetails: any) => {
    try {
      const res = await fetch(`${BASE_URL}/api/events/${event.slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          mobile,
          institution,
          designation,
          medicalCouncilRegNumber: medicalCouncilRegNumber.trim() || undefined,
          documentUrl: documentUrl || undefined,
          documentType: documentUrl ? "medical_council_cert" : undefined,
          foodPreference,
          tierId: activeTier.id,
          role: activeTier.role,
          delegateType: activeTier.role,
          couponCode: appliedCoupon?.code || null,
          payment: paymentDetails,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to complete registration");
      }

      const result = await res.json();
      setRegisteredData(result);
      setSubmitting(false);
      setPaymentProcessing(false);

      try {
        confetti({
          particleCount: 120,
          spread: 75,
          origin: { y: 0.6 },
          colors: ["#3B82F6", "#A855F7", "#10B981", "#F59E0B", "#EC4899"],
        });
      } catch {}

      toast({
        title: "Registration Confirmed! 🎉",
        description: event.requiresApproval
          ? "Your registration is under review by the event coordinator."
          : "Your holographic admission pass is ready.",
      });
    } catch (err: any) {
      toast({
        title: "Error Completing Registration",
        description: err.message || "Please contact the event administrator.",
        variant: "destructive",
      });
      setSubmitting(false);
      setPaymentProcessing(false);
    }
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
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex flex-col justify-center max-w-md mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-full bg-zinc-800" />
        <Skeleton className="h-64 w-full rounded-2xl bg-zinc-800" />
      </div>
    );
  }

  // ─── Group Registration Confirmation Screen ──────────────────────────────
  if (groupRegisteredData) {
    return (
      <div className="relative min-h-screen bg-transparent text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white overflow-hidden">
        <ThreeAmbientScene particleCount={60} className="z-0 opacity-80" />

        <header className="border-b border-zinc-800/80 bg-[#09090B]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/events" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Events</span>
            </Link>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Group Confirmed ✓</span>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-10 w-full flex-1 flex flex-col justify-center space-y-6 relative z-10">
          <div className="p-6 sm:p-8 rounded-3xl bg-[#141417] border border-[#2B2B32] shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Group Booking Successful!</h2>
              <p className="text-xs text-zinc-400">Institutional registration for <strong>{orgName}</strong> has been registered.</p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-left space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Group Booking Code:</span>
                <span className="text-emerald-300 font-bold">{groupRegisteredData.groupCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Delegates:</span>
                <span className="text-white font-bold">{groupRegisteredData.totalDelegates} Delegates</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Coordinator:</span>
                <span className="text-zinc-300">{coordName} ({coordPhone})</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Individual confirmation emails with digital QR passes have been dispatched to registered delegate email addresses.
            </p>

            <Button asChild className="w-full rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs h-11">
              <Link href="/events">Explore Other Events</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center p-6 text-center">
        <Compass className="w-12 h-12 text-zinc-600 mb-3" />
        <h2 className="text-lg font-bold text-white">Event not found</h2>
        <Button asChild className="mt-5 rounded-full bg-white text-zinc-950 text-xs font-bold">
          <Link href="/events">Explore All Events</Link>
        </Button>
      </div>
    );
  }

  // ─── 3D Holographic Pass View (Post-Registration) ─────────────────────────
  if (registeredData) {
    const participant = registeredData.participant;
    const isApproved = participant?.approvalStatus === "approved";

    return (
      <div className="relative min-h-screen bg-transparent text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white overflow-hidden">
        {/* 3D Interactive GPU-accelerated Particle Cosmos */}
        <ThreeAmbientScene particleCount={60} className="z-0 opacity-80" />

        <header className="border-b border-zinc-800/80 bg-[#09090B]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/events" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Events</span>
            </Link>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Confirmed Pass</span>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-10 w-full flex-1 flex flex-col justify-center space-y-6 relative z-10">
          {/* Confetti & 3D Holographic Pass */}
          <HolographicPassCard
            registrationNumber={participant?.registrationNumber || "STAF-2026-0001"}
            eventName={event.title}
            delegateName={participant?.name || name}
            delegateType={participant?.delegateType?.toUpperCase() || "DELEGATE PASS"}
            institution={participant?.institution || institution}
            startDate={event.startDate}
            endDate={event.endDate}
            venue={event.venue}
            city={event.city}
            isPaid={event.isPaid}
            approvalStatus={participant?.approvalStatus || "approved"}
          />

          <div className="flex items-center gap-3">
            <TactileButton
              variant="glass"
              size="md"
              onClick={handleDownloadIcs}
              className="flex-1"
              icon={<CalendarPlus className="w-4 h-4" />}
            >
              Add to Calendar
            </TactileButton>

            <TactileButton
              variant="primary"
              size="md"
              onClick={() => {
                window.location.href = "/events?tab=registrations";
              }}
              className="flex-1"
            >
              My Passes
            </TactileButton>
          </div>
        </main>
      </div>
    );
  }

  // ─── 3D Registration Form Layout ──────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-transparent text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white overflow-hidden">
      {/* 3D Interactive GPU-accelerated Particle Cosmos */}
      <ThreeAmbientScene particleCount={50} className="z-0 opacity-75" />

      {/* Navigation Header */}
      <header className="border-b border-zinc-800/80 bg-[#09090B]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href={`/events/${event.slug}`} className="inline-flex items-center gap-3 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer group">
            <ArrowLeft className="w-4 h-4 text-zinc-400 group-hover:text-white" />
            <img
              src="/sankara-eye-logo.png"
              alt="Sankara Eye Care"
              className="h-8 sm:h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-bold text-sm text-white hidden sm:inline-block">Event Details</span>
          </Link>
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Registration</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 sm:py-12 w-full flex-1 flex flex-col justify-center space-y-6 relative z-10">
        {/* Event Thumbnail Preview Card (3D Perspective) */}
        <PerspectiveCard depth={6} className="bg-[#141417]/90 border border-[#2B2B32] rounded-2xl p-4 shadow-md flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 border border-white/20 shadow-md"
            style={{
              background: `linear-gradient(135deg, ${event.themeColor || "#18181B"} 0%, ${event.accentColor || "#312E81"} 100%)`,
            }}
          >
            {event.eventType ? event.eventType.charAt(0).toUpperCase() : "E"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-white truncate">{event.title}</h3>
            <p className="text-xs text-zinc-400">{event.startDate} • {event.venue}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-bold text-white block">
              {isPaidEvent ? `₹${finalFee.toLocaleString("en-IN")}` : "Free"}
            </span>
            {appliedCoupon && (
              <span className="text-[10px] text-emerald-400 line-through block">
                ₹{baseTierPrice}
              </span>
            )}
          </div>
        </PerspectiveCard>

        {/* ── Mode Switcher: Single vs Group Registration ── */}
        {event.groupRegistrationEnabled !== false && (
          <div className="grid grid-cols-2 gap-2 bg-[#141417] p-1.5 rounded-2xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setRegMode("single")}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                regMode === "single"
                  ? "bg-white text-zinc-950 shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Individual Delegate
            </button>
            <button
              type="button"
              onClick={() => setRegMode("group")}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                regMode === "group"
                  ? "bg-white text-zinc-950 shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Group / Institutional
            </button>
          </div>
        )}

        {/* ── GROUP REGISTRATION FORM ── */}
        {regMode === "group" ? (
          <PerspectiveCard depth={8} className="bg-[#141417]/90 border border-[#2B2B32] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Institutional / Group Booking</h2>
              <p className="text-xs text-zinc-400 mt-1">Register multiple delegates under your hospital or college.</p>
            </div>

            <form onSubmit={handleGroupSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300">Organization / Hospital Name *</Label>
                <Input
                  required
                  placeholder="e.g. Sankara Eye Hospital / Aravind Eye Hospital"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="h-10 bg-zinc-950 border-zinc-800 text-white rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-zinc-300">SPOC / Coordinator Name *</Label>
                  <Input
                    required
                    placeholder="Coordinator Name"
                    value={coordName}
                    onChange={(e) => setCoordName(e.target.value)}
                    className="h-10 bg-zinc-950 border-zinc-800 text-white rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-zinc-300">Coordinator Email *</Label>
                  <Input
                    required
                    type="email"
                    placeholder="coord@org.com"
                    value={coordEmail}
                    onChange={(e) => setCoordEmail(e.target.value)}
                    className="h-10 bg-zinc-950 border-zinc-800 text-white rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-zinc-300">Coordinator Mobile *</Label>
                  <Input
                    required
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={coordPhone}
                    onChange={(e) => setCoordPhone(e.target.value)}
                    className="h-10 bg-zinc-950 border-zinc-800 text-white rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Delegates List */}
              <div className="space-y-3 pt-3 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Delegates List ({groupDelegates.length})</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddGroupDelegate}
                    className="h-7 text-[11px] rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer"
                  >
                    + Add Delegate
                  </Button>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {groupDelegates.map((del, idx) => (
                    <div key={del.id} className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Delegate #{idx + 1}</span>
                        {groupDelegates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGroupDelegate(idx)}
                            className="text-[10px] text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          required
                          placeholder="Full Name *"
                          value={del.name}
                          onChange={(e) => handleUpdateGroupDelegate(idx, "name", e.target.value)}
                          className="h-8 text-xs bg-[#141417] border-zinc-800 text-white rounded-lg"
                        />
                        <Input
                          placeholder="Designation (e.g. PG Resident)"
                          value={del.designation}
                          onChange={(e) => handleUpdateGroupDelegate(idx, "designation", e.target.value)}
                          className="h-8 text-xs bg-[#141417] border-zinc-800 text-white rounded-lg"
                        />
                        <Input
                          placeholder="Email (for direct pass delivery)"
                          value={del.email}
                          onChange={(e) => handleUpdateGroupDelegate(idx, "email", e.target.value)}
                          className="h-8 text-xs bg-[#141417] border-zinc-800 text-white rounded-lg"
                        />
                        <Input
                          placeholder="10-Digit Mobile"
                          maxLength={10}
                          value={del.mobile}
                          onChange={(e) => handleUpdateGroupDelegate(idx, "mobile", e.target.value)}
                          className="h-8 text-xs bg-[#141417] border-zinc-800 text-white rounded-lg font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group Fee Summary */}
              {isPaidEvent && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Total Group Tariff ({groupDelegates.length} delegates):</span>
                  <span className="text-lg font-black text-white font-mono">
                    ₹{((event.registrationFee || 0) * groupDelegates.length).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submittingGroup}
                className="w-full h-12 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                {submittingGroup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                <span>Submit Group Registration ({groupDelegates.length} Delegates)</span>
              </Button>
            </form>
          </PerspectiveCard>
        ) : (
          /* ── INDIVIDUAL REGISTRATION FORM ── */
          <PerspectiveCard depth={8} className="bg-[#141417]/90 border border-[#2B2B32] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Delegate Information</h2>
              <p className="text-xs text-zinc-400 mt-1">Please enter your credentials for badge printing and access.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* ── Role / Category Tier Selector ── */}
              <div className="space-y-2 pb-1 border-b border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-zinc-300">
                    Select Delegate Category / Role *
                  </Label>
                  {activeTier.badgeLabel && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {activeTier.badgeLabel}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pricingTiers.map((tier) => {
                    const isSelected = tier.id === activeTier.id;
                    const isTierEarlyBird = event?.isPaid && tier.earlyBirdPrice !== undefined && (tier.earlyBirdDeadline ? new Date(tier.earlyBirdDeadline) >= new Date() : true);
                    const priceToDisplay = event?.isPaid ? (isTierEarlyBird ? tier.earlyBirdPrice : tier.price) : 0;

                    return (
                      <button
                        type="button"
                        key={tier.id}
                        onClick={() => setSelectedTierId(tier.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                          isSelected
                            ? "bg-zinc-900 border-white/40 shadow-lg ring-1 ring-white/30"
                            : "bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700 text-zinc-400"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 w-full">
                          <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-zinc-300"}`}>
                            {tier.name}
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-white text-zinc-950 flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        <div className="flex items-baseline justify-between w-full pt-1">
                          <span className="text-sm font-black text-white font-mono">
                            {event?.isPaid ? `₹${priceToDisplay.toLocaleString("en-IN")}` : "Free"}
                          </span>
                          {isTierEarlyBird && tier.price > priceToDisplay && (
                            <span className="text-[10px] text-zinc-500 line-through font-mono">
                              ₹{tier.price.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300">Full Name *</Label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    placeholder="Dr. / Mr. / Ms. Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9.5 h-11 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-zinc-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-zinc-300">Mobile Number (10-Digits) *</Label>
                    {mobile && mobile.length === 10 && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ 10 Digits</span>
                    )}
                  </div>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      required
                      type="tel"
                      maxLength={10}
                      autoComplete="new-password"
                      autoCorrect="off"
                      spellCheck={false}
                      data-lpignore="true"
                      placeholder="9876543210"
                      value={mobile}
                      onChange={(e) => {
                        setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 10));
                        setMobileWarning(null);
                        setValidationError(null);
                      }}
                      onBlur={() => {
                        if (mobile) checkMobileAvailability(mobile);
                      }}
                      className={`pl-9.5 h-11 bg-zinc-950 border text-white placeholder:text-zinc-500 rounded-xl text-xs sm:text-sm focus-visible:ring-1 font-mono transition-colors ${
                        mobileWarning
                          ? "border-rose-500/80 focus-visible:ring-rose-500"
                          : "border-zinc-800 focus-visible:ring-zinc-600"
                      }`}
                    />
                    {checkingMobile && (
                      <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {mobileWarning && (
                    <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1 pt-0.5 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{mobileWarning}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Email Address</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      type="email"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      data-lpignore="true"
                      placeholder="name@hospital.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setValidationError(null);
                      }}
                      className="pl-9.5 h-11 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-zinc-600"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Institution / Hospital *</Label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      required
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      data-lpignore="true"
                      placeholder="e.g. Sankara Eye Hospital"
                      value={institution}
                      onChange={(e) => {
                        setInstitution(e.target.value);
                        setValidationError(null);
                      }}
                      className="pl-9.5 h-11 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-zinc-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">Medical Council Reg. No.</Label>
                  <Input
                    placeholder="e.g. TNMC-89421"
                    value={medicalCouncilRegNumber}
                    onChange={(e) => setMedicalCouncilRegNumber(e.target.value)}
                    className="h-11 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300">Designation / Speciality</Label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="e.g. Consultant / Resident / Post Graduate"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="pl-9.5 h-11 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-zinc-600"
                  />
                </div>
              </div>

              {/* Configurable Document Upload Field (Medical Council Cert / Student ID) */}
              {event.requireDocumentUpload && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-zinc-200">
                      {event.documentUploadLabel || "Upload Medical Council Certificate / Student ID"}
                      {event.documentUploadRequired && <span className="text-rose-400 ml-1">*</span>}
                    </Label>
                    {documentUrl && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                        Uploaded ✓
                      </span>
                    )}
                  </div>

                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required={event.documentUploadRequired && !documentUrl}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleDocUpload(f);
                    }}
                    disabled={uploadingDoc}
                    className="h-10 text-xs bg-[#141417] border-zinc-800 text-zinc-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-zinc-950 hover:file:bg-zinc-200 cursor-pointer"
                  />
                  {uploadingDoc && (
                    <p className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                      <span>Uploading document...</span>
                    </p>
                  )}
                </div>
              )}

              {/* ── Dietary & Culinary Philosophy (Pure Vegetarian) ── */}
              {event.enableFood && (
                <div className="pt-1">
                  <div className="p-4 rounded-2xl bg-[#0F1410] border border-emerald-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                        <span className="text-xs font-bold text-emerald-300 tracking-tight">
                          Culinary Philosophy: Pure Vegetarian
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 uppercase tracking-wider">
                        Included
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      In alignment with the institutional traditions and ethos of Sankara Eye Care Institutions, all culinary arrangements, catering, and refreshments across conference days are exclusively pure vegetarian.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Coupon / Promo Code Input Section ── */}
              {isPaidEvent && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <Label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Promo Code / Sponsored Pass</span>
                  </Label>

                  {appliedCoupon ? (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-emerald-300 uppercase">
                            {appliedCoupon.code}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-200">
                            {appliedCoupon.discountType === "sponsor_free"
                              ? "100% SPONSORED PASS"
                              : `${appliedCoupon.discountValue}% OFF`}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {appliedCoupon.description || `Discount Applied: -₹${discountAmount}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. SANKARA20 or SPONSORED100"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        className="h-10 bg-zinc-950 border-zinc-800 text-white uppercase placeholder:normal-case placeholder:text-zinc-500 rounded-xl text-xs font-mono"
                      />
                      <Button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={validatingCoupon || !couponInput.trim()}
                        className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer"
                      >
                        {validatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Price Summary Breakdown */}
              {isPaidEvent && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Base Tier Tariff ({activeTier.name}):</span>
                    <span className="font-mono">₹{baseTierPrice.toLocaleString("en-IN")}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Discount ({appliedCoupon?.code}):</span>
                      <span className="font-mono">-₹{discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-zinc-800 flex justify-between font-bold text-white text-sm">
                    <span>Final Payable Amount:</span>
                    <span className="text-base font-mono">₹{finalFee.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}

              {validationError && (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Registration Issue</span>
                  </div>
                  <p className="leading-relaxed">{validationError}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || paymentProcessing}
                className="w-full h-12 text-sm font-bold shadow-xl rounded-full bg-white hover:bg-zinc-200 text-zinc-950 cursor-pointer"
              >
                {submitting || paymentProcessing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Registration...</span>
                  </span>
                ) : !isFreeAfterDiscount ? (
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Pay ₹{finalFee.toLocaleString("en-IN")} &amp; Complete Pass</span>
                  </span>
                ) : (
                  <span>{event.requiresApproval ? "Submit Request to Join" : "Complete Free Registration"}</span>
                )}
              </Button>
            </form>
          </PerspectiveCard>
        )}

        {/* SPOC & Cancellation Note */}
        {(event.spocName || event.cancellationPolicy) && (
          <div className="p-4 rounded-2xl bg-[#141417]/70 border border-zinc-800/80 text-xs space-y-1.5 text-zinc-400">
            {event.spocName && (
              <p className="flex items-center gap-1.5 text-zinc-300">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                <span>Questions? Contact Event SPOC: <strong>{event.spocName}</strong> ({event.spocPhone || event.spocEmail || ""})</span>
              </p>
            )}
            {event.cancellationPolicy && (
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Policy: {event.cancellationPolicy}
              </p>
            )}
          </div>
        )}
      </main>

      {/* Lu.ma Minimal Dark Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#09090B] py-6 text-xs text-zinc-500 mt-auto">
        <div className="max-w-xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-zinc-500 font-normal">
            © {new Date().getFullYear()} Sankara Eye Foundation India
          </p>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 font-medium transition-colors hover:underline cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Coordinator Login</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
