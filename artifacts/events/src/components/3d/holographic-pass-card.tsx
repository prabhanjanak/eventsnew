import React, { useState } from "react";
import { motion } from "framer-motion";
import { PerspectiveCard } from "./perspective-card";
import { GoogleWalletButton } from "@/components/google-wallet-button";
import {
  Calendar,
  MapPin,
  User,
  Building,
  RotateCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Utensils,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HolographicPassCardProps {
  registrationNumber?: string;
  eventName?: string;
  eventTitle?: string;
  eventSubtitle?: string;
  delegateName?: string;
  delegateType?: string;
  institution?: string | null;
  startDate?: string;
  endDate?: string;
  venue?: string;
  city?: string;
  isPaid?: boolean;
  approvalStatus?: string;
  onViewDetails?: () => void;
  className?: string;
  participant?: any;
}

export function HolographicPassCard(props: HolographicPassCardProps) {
  const p = props.participant;
  const registrationNumber = props.registrationNumber || p?.registrationNumber || "REG-00000";
  const eventName = props.eventName || props.eventTitle || p?.event?.title || "Sankara Medical Conference";
  const delegateName = props.delegateName || p?.name || "Delegate";
  const delegateType = props.delegateType || p?.delegateType || "DELEGATE PASS";
  const institution = props.institution ?? p?.institution;
  const startDate = props.startDate || p?.event?.startDate || "2026-07-10";
  const endDate = props.endDate || p?.event?.endDate;
  const venue = props.venue || p?.event?.venue || "Sankara Hospital";
  const city = props.city || p?.event?.city || "Bangalore";
  const isPaid = props.isPaid ?? p?.isPaid ?? true;
  const onViewDetails = props.onViewDetails;
  const className = props.className || "";

  const [isFlipped, setIsFlipped] = useState(false);
  const qrValue = `https://events.sankaraeye.in/q/${registrationNumber}`;

  return (
    <div className={`relative [perspective:1400px] w-full max-w-md mx-auto ${className}`}>
      {/* 3D Flip Card Container */}
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 200, damping: 25 }}
        style={{ transformStyle: "preserve-3d" }}
        className="w-full"
      >
        {/* ── FRONT OF PASS ── */}
        <PerspectiveCard
          depth={14}
          style={{ backfaceVisibility: "hidden" }}
          className="relative bg-gradient-to-br from-[#18181C] via-[#121215] to-[#0A0A0D] border border-white/15 p-6 sm:p-7 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(59,130,246,0.15)]"
        >
          {/* Holographic Iridescent Sheen Layer */}
          <div
            className="pointer-events-none absolute inset-0 opacity-15 mix-blend-color-dodge bg-gradient-to-tr from-pink-500 via-cyan-400 to-amber-300 animate-pulse"
            aria-hidden="true"
          />

          {/* Top Pass Header: Institution Emblem & Pass Type */}
          <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center p-1 shadow-md">
                <img
                  src="/sankara-eye-logo.png"
                  alt="Sankara Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-[11px] font-black tracking-wider uppercase text-white block">
                  Sankara Eye Care
                </span>
                <span className="text-[9px] font-semibold tracking-widest text-zinc-400 uppercase">
                  Official Admission Pass
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/40">
                {delegateType}
              </span>
              <button
                onClick={() => setIsFlipped(true)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Flip to view pass details & coupons"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Event Title & Date */}
          <div className="relative z-10 py-4 space-y-1.5">
            <h3 className="text-lg sm:text-xl font-black text-white leading-snug tracking-tight">
              {eventName}
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                {startDate} {endDate && endDate !== startDate ? `– ${endDate}` : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                {venue}, {city}
              </span>
            </div>
          </div>

          {/* Delegate Name & 3D QR Code Barcode */}
          <div className="relative z-10 bg-[#09090B]/90 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-inner">
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">
                Delegate Name
              </span>
              <div className="text-base font-black text-white truncate">{delegateName}</div>
              {institution && (
                <div className="text-xs text-zinc-400 truncate flex items-center gap-1">
                  <Building className="w-3 h-3 text-zinc-500" />
                  {institution}
                </div>
              )}
              <div className="text-xs font-mono font-bold text-blue-400 pt-1">
                #{registrationNumber}
              </div>
            </div>

            {/* High-Contrast QR Code */}
            <div className="bg-white p-1.5 rounded-xl shadow-lg shrink-0">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrValue)}`}
                alt="Pass QR Code"
                className="w-16 h-16 rounded-md"
              />
            </div>
          </div>

          {/* Action Buttons: Google Wallet & Details */}
          <div className="relative z-10 pt-5 space-y-2.5">
            <GoogleWalletButton registrationNumber={registrationNumber} className="w-full shadow-lg" />

            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Delegate
              </span>

              {onViewDetails && (
                <button
                  onClick={onViewDetails}
                  className="text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Event Agenda</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </PerspectiveCard>

        {/* ── BACK OF PASS (Rotated 180deg) ── */}
        <div
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
          className="absolute inset-0 bg-[#141418] border border-white/15 p-6 sm:p-7 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Pass Entitlements
              </span>
            </div>
            <button
              onClick={() => setIsFlipped(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
              title="Flip to front"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Entitlements Info */}
          <div className="space-y-3 py-3 text-xs">
            <div className="bg-[#1C1C22] border border-white/5 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Main Scientific Sessions Entry
              </div>
              <p className="text-[11px] text-zinc-400 pl-5">
                Full access to all keynote halls, scientific workshops, and panel tracks.
              </p>
            </div>

            <div className="bg-[#1C1C22] border border-white/5 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                Pure Vegetarian Dining &amp; High Tea
              </div>
              <p className="text-[11px] text-zinc-400 pl-5">
                Complimentary traditional pure vegetarian breakfast, buffet lunch, and refreshments.
              </p>
            </div>

            <div className="bg-[#1C1C22] border border-white/5 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                Digital Smart QR Attendance
              </div>
              <p className="text-[11px] text-zinc-400 pl-5 font-mono">
                Pass ID: {registrationNumber}
              </p>
            </div>
          </div>

          {/* Flip Back Button */}
          <Button
            onClick={() => setIsFlipped(false)}
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs cursor-pointer"
          >
            Flip Back to Barcode Pass
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
