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
  const [foodPreference, setFoodPreference] = useState<"veg" | "non_veg">("veg");

  // Initial role tier from URL query param (?tier=xxx)
  const searchParams = new URLSearchParams(window.location.search);
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

        {/* 3D Perspective Form Card */}
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

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-300">Institution / Hospital / College *</Label>
              <div className="relative">
                <Building className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  placeholder="e.g. Sankara Eye Hospital / AIIMS"
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
                    In alignment with the institutional traditions and ethos of Sankara Eye Care Institutions, all culinary arrangements, catering, and refreshments across conference days are exclusively pure vegetarian, crafted to the highest standards of hygiene, nutrition, and hospitality.
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
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1.5">
                <div className="flex justify-between text-zinc-400">
                  <span>Registration Fee</span>
                  <span>₹{baseTierPrice.toLocaleString("en-IN")}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span>-₹{discountAmount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-white pt-1 border-t border-zinc-800 text-sm">
                  <span>Total Payable</span>
                  <span>{finalFee === 0 ? "Free (Waived)" : `₹${finalFee.toLocaleString("en-IN")}`}</span>
                </div>
              </div>
            )}

            {/* ── Pre-Payment Validation Error Callout Banner ── */}
            {validationError && (
              <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-600/50 shadow-xl shadow-rose-950/40 text-rose-200 text-xs space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Please Resolve Application Issue Before Payment</span>
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed pl-6">
                  {validationError}
                </p>
              </div>
            )}

            <div className="pt-2">
              <TactileButton
                variant="primary"
                type="submit"
                disabled={submitting || paymentProcessing}
                className="w-full h-12 text-sm font-bold shadow-xl"
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
              </TactileButton>
            </div>
          </form>
        </PerspectiveCard>
      </main>

      {/* Lu.ma Minimal Dark Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#09090B] py-6 text-xs text-zinc-500 mt-auto">
        <div className="max-w-xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-zinc-500 font-normal">
            © {new Date().getFullYear()} Sankara Eye Care Institutions
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
