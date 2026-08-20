import React from "react";
import type { IdCardDesignData, PlaceholderConfig, CardType, PlaceholderType } from "./types";
import { Button } from "@/components/ui/button";
import {
  Type,
  Building,
  Hash,
  QrCode as QrIcon,
  Plus,
  Layers,
  Lock,
  Unlock,
  Trash2,
  Sparkles,
  Check,
} from "lucide-react";

interface PlaceholdersSidebarProps {
  cardType: CardType;
  design: IdCardDesignData;
  onChange: (updated: IdCardDesignData) => void;
  selectedPlaceholderId: string | null;
  onSelectPlaceholder: (id: string | null) => void;
}

export function PlaceholdersSidebar({
  cardType,
  design,
  onChange,
  selectedPlaceholderId,
  onSelectPlaceholder,
}: PlaceholdersSidebarProps) {
  // Pre-registered supports Name, Org, ID, QR, Custom
  // On-Spot strictly supports ID Number & QR Code
  const availablePlaceholders: {
    type: PlaceholderType;
    label: string;
    description: string;
    icon: any;
    color: string;
    defaultProps: Partial<PlaceholderConfig>;
  }[] =
    cardType === "onspot"
      ? [
          {
            type: "id_number",
            label: "Card ID Number",
            description: "Dynamic On-Spot Card Number (e.g. OS-1001)",
            icon: Hash,
            color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
            defaultProps: {
              fontSizePt: 22,
              fontWeight: "bold",
              color: "#FFFFFF",
              align: "center",
              widthPercent: 50,
              heightPercent: 12,
            },
          },
          {
            type: "qr_code",
            label: "Dynamic QR Code",
            description: "Scannable QR linked to card registration",
            icon: QrIcon,
            color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
            defaultProps: {
              widthPercent: 30,
              heightPercent: 40,
              qrErrorCorrection: "M",
              qrMargin: 1,
            },
          },
        ]
      : [
          {
            type: "name",
            label: "Delegate Name",
            description: "Dynamic attendee name from database",
            icon: Type,
            color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
            defaultProps: {
              fontSizePt: 20,
              fontWeight: "bold",
              color: "#FFFFFF",
              align: "left",
              textTransform: "capitalize",
              widthPercent: 60,
              heightPercent: 14,
            },
          },
          {
            type: "organization",
            label: "Organization / Hospital",
            description: "Dynamic institution or hospital name",
            icon: Building,
            color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            defaultProps: {
              fontSizePt: 14,
              fontWeight: "medium",
              color: "#D1D5DB",
              align: "left",
              widthPercent: 60,
              heightPercent: 10,
            },
          },
          {
            type: "id_number",
            label: "Registration ID",
            description: "Dynamic ID Number (e.g. VISION26-00482)",
            icon: Hash,
            color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
            defaultProps: {
              fontSizePt: 15,
              fontWeight: "bold",
              color: "#F59E0B",
              align: "left",
              widthPercent: 40,
              heightPercent: 10,
            },
          },
          {
            type: "qr_code",
            label: "Dynamic QR Code",
            description: "Cryptographic QR pass for scanner apps",
            icon: QrIcon,
            color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
            defaultProps: {
              widthPercent: 25,
              heightPercent: 35,
              qrErrorCorrection: "M",
              qrMargin: 1,
            },
          },
          {
            type: "custom_text",
            label: "Static / Badge Subtitle",
            description: "Custom label (e.g. 'DELEGATE PASS' or 'FACULTY')",
            icon: Sparkles,
            color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
            defaultProps: {
              fontSizePt: 12,
              fontWeight: "bold",
              color: "#E2E8F0",
              align: "center",
              textTransform: "uppercase",
              customSampleText: "DELEGATE PASS",
              widthPercent: 40,
              heightPercent: 8,
            },
          },
        ];

  const handleAddPlaceholder = (item: (typeof availablePlaceholders)[0]) => {
    // Generate new unique ID
    const newId = `ph_${Date.now()}`;
    const newPh: PlaceholderConfig = {
      id: newId,
      type: item.type,
      label: item.label,
      xPercent: 15,
      yPercent: 20 + design.placeholders.length * 10,
      widthPercent: item.defaultProps.widthPercent || 40,
      heightPercent: item.defaultProps.heightPercent || 10,
      isLocked: false,
      fontFamily: "Inter, sans-serif",
      fontSizePt: item.defaultProps.fontSizePt || 16,
      fontWeight: item.defaultProps.fontWeight || "bold",
      color: item.defaultProps.color || "#FFFFFF",
      align: item.defaultProps.align || "left",
      textTransform: item.defaultProps.textTransform || "none",
      truncate: true,
      customSampleText: item.defaultProps.customSampleText,
      qrErrorCorrection: item.defaultProps.qrErrorCorrection || "M",
      qrMargin: item.defaultProps.qrMargin || 1,
    };

    onChange({
      ...design,
      placeholders: [...design.placeholders, newPh],
    });
    onSelectPlaceholder(newId);
  };

  return (
    <div className="w-72 bg-[#121216] border-r border-[#24242A] flex flex-col h-full overflow-y-auto text-xs text-zinc-300">
      {/* ── SECTION 1: ADD PLACEHOLDERS ──────────────────────────────────── */}
      <div className="p-4 border-b border-[#24242A] space-y-3 bg-[#16161B]">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-amber-400" />
            Add Placeholders
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">
            {cardType === "onspot" ? "On-Spot Mode" : "Pre-Reg Mode"}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Click any dynamic field below to place it onto the ID card canvas.
        </p>

        <div className="space-y-1.5 pt-1">
          {availablePlaceholders.map((item) => {
            const Icon = item.icon;
            const alreadyAdded = design.placeholders.some((p) => p.type === item.type);

            return (
              <button
                key={item.type}
                type="button"
                onClick={() => handleAddPlaceholder(item)}
                className="w-full p-2.5 rounded-2xl bg-[#1A1A22] hover:bg-[#22222E] border border-[#2B2B36] text-left flex items-start gap-2.5 transition-all cursor-pointer group shadow-sm hover:border-white/20 active:scale-98"
              >
                <div className={`p-2 rounded-xl border shrink-0 ${item.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white group-hover:text-amber-300 transition-colors">
                      {item.label}
                    </span>
                    {alreadyAdded && (
                      <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Added
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 2: ACTIVE LAYERS ON CANVAS ────────────────────────────── */}
      <div className="p-4 flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            Active Layers ({design.placeholders.length})
          </h3>
        </div>

        {design.placeholders.length === 0 ? (
          <div className="p-6 text-center rounded-2xl border border-dashed border-[#2B2B36] text-zinc-500 space-y-1">
            <p className="font-bold text-xs">No elements on canvas</p>
            <p className="text-[10px]">Add placeholders from above to begin designing.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {design.placeholders.map((ph, idx) => {
              const isSelected = ph.id === selectedPlaceholderId;
              return (
                <div
                  key={ph.id}
                  onClick={() => onSelectPlaceholder(ph.id)}
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-500/15 border-amber-500/40 text-white"
                      : "bg-[#18181F] border-[#262630] text-zinc-300 hover:bg-[#20202A]"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-zinc-500 w-4">#{idx + 1}</span>
                    <span className="font-bold text-xs truncate">{ph.label}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = design.placeholders.map((p) =>
                          p.id === ph.id ? { ...p, isLocked: !p.isLocked } : p
                        );
                        onChange({ ...design, placeholders: updated });
                      }}
                      className="p-1 rounded text-zinc-400 hover:text-white"
                      title={ph.isLocked ? "Unlock" : "Lock"}
                    >
                      {ph.isLocked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const filtered = design.placeholders.filter((p) => p.id !== ph.id);
                        onChange({ ...design, placeholders: filtered });
                        if (selectedPlaceholderId === ph.id) onSelectPlaceholder(null);
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
