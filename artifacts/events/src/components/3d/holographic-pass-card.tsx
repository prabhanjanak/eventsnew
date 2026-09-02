import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PerspectiveCard } from "./perspective-card";
import QRCode from "qrcode";
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
  Download,
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
  const [localQrUrl, setLocalQrUrl] = useState<string>("");
  const qrValue = `https://events.sankaraeye.in/q/${registrationNumber}`;

  useEffect(() => {
    QRCode.toDataURL(qrValue, { width: 400, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then(url => setLocalQrUrl(url))
      .catch(() => setLocalQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrValue)}`));
  }, [qrValue]);

  return (
    <div className={`relative [perspective:1400px] w-full max-w-md mx-auto ${className}`}>
      {/* 3D Flip Card Container */}
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        className="w-full relative [transform-style:preserve-3d]"
      >
        {/* ── FRONT OF PASS ── */}
        <PerspectiveCard
          className="[backface-visibility:hidden] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#121218]/95 via-[#0D0D12]/95 to-[#08080C]/95 p-6 shadow-2xl backdrop-blur-xl relative"
        >
          {/* Subtle Dynamic Laser Edge */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />

          {/* Top Header: Brand & Flip Trigger */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white text-xs shadow-md shrink-0">
                SEH
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white uppercase tracking-wider truncate">
                  {eventName}
                </div>
                <div className="text-[10px] text-zinc-400 font-medium">
                  Official Admission Pass
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsFlipped(!isFlipped)}
              className="h-7 px-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Flip Card"
            >
              <RotateCw className="w-3 h-3" />
              <span>Flip</span>
            </button>
          </div>

          {/* Delegate Main Content */}
          <div className="pt-5 flex items-center justify-between gap-4 relative z-10">
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
                src={localQrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrValue)}`}
                alt="Pass QR Code"
                className="w-16 h-16 rounded-md"
              />
            </div>
          </div>

          {/* Action Buttons: Download QR & Details */}
          <div className="relative z-10 pt-5 space-y-2.5">
            {localQrUrl && (
              <a
                href={localQrUrl}
                download={`${registrationNumber}_QR_Pass.png`}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-zinc-950" />
                <span>Download QR Code (PNG)</span>
              </a>
            )}

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
