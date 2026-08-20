import React from "react";
import type { IdCardDesignData, PlaceholderConfig } from "./types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Lock,
  Unlock,
  Trash2,
  Settings2,
  Type,
  QrCode,
  Palette,
  Layers,
  Sparkles,
} from "lucide-react";

interface PropertiesPanelProps {
  design: IdCardDesignData;
  onChange: (updated: IdCardDesignData) => void;
  selectedPlaceholderId: string | null;
  onSelectPlaceholder: (id: string | null) => void;
  onOpenUploadModal: () => void;
}

const FONT_FAMILIES = [
  { label: "Inter (Modern Sans)", value: "Inter, sans-serif" },
  { label: "Outfit (Geometric Premium)", value: "Outfit, sans-serif" },
  { label: "Roboto (Clean Standard)", value: "Roboto, sans-serif" },
  { label: "Playfair Display (Serif Elegance)", value: "'Playfair Display', serif" },
  { label: "Montserrat (Bold Architectural)", value: "Montserrat, sans-serif" },
  { label: "Poppins (Rounded Tech)", value: "Poppins, sans-serif" },
  { label: "Monospace / Code", value: "monospace" },
];

const COLOR_SWATCHES = [
  "#FFFFFF",
  "#000000",
  "#F59E0B", // Gold / Amber
  "#3B82F6", // Royal Blue
  "#10B981", // Emerald
  "#EF4444", // Crimson
  "#8B5CF6", // Purple
  "#E2E8F0", // Slate Light
];

export function PropertiesPanel({
  design,
  onChange,
  selectedPlaceholderId,
  onSelectPlaceholder,
  onOpenUploadModal,
}: PropertiesPanelProps) {
  const selected = design.placeholders.find((p) => p.id === selectedPlaceholderId) || null;

  const updateSelected = (updates: Partial<PlaceholderConfig>) => {
    if (!selected) return;
    const updated = design.placeholders.map((p) => (p.id === selected.id ? { ...p, ...updates } : p));
    onChange({ ...design, placeholders: updated });
  };

  const handleDelete = () => {
    if (!selected) return;
    const filtered = design.placeholders.filter((p) => p.id !== selected.id);
    onChange({ ...design, placeholders: filtered });
    onSelectPlaceholder(null);
  };

  return (
    <div className="w-80 bg-[#121216] border-l border-[#24242A] flex flex-col h-full overflow-y-auto text-xs text-zinc-300">
      {/* ── PANEL HEADER ──────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-[#24242A] flex items-center justify-between gap-2 shrink-0 bg-[#16161B]">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-white uppercase tracking-wider text-xs">
            {selected ? selected.label : "Card Configuration"}
          </h3>
        </div>

        {selected && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateSelected({ isLocked: !selected.isLocked })}
              title={selected.isLocked ? "Unlock" : "Lock"}
              className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-white"
            >
              {selected.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              title="Delete"
              className="h-7 w-7 p-0 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* ── SELECTED ELEMENT PROPERTIES ────────────────────────────────────── */}
      {selected ? (
        <div className="p-4 space-y-5">
          {/* Element Type Badge */}
          <div className="p-2.5 rounded-2xl bg-[#1A1A22] border border-[#2B2B36] flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Placeholder Field:</span>
            <span className="font-mono font-bold text-white px-2 py-0.5 rounded-md bg-white/10 text-[10px] uppercase">
              {selected.type.replace("_", " ")}
            </span>
          </div>

          {/* Position & Sizing (%) */}
          <div className="space-y-3">
            <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Position &amp; Dimensions (%)
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">X Position (%)</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={selected.xPercent}
                  onChange={(e) => updateSelected({ xPercent: parseFloat(e.target.value) || 0 })}
                  className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Y Position (%)</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={selected.yPercent}
                  onChange={(e) => updateSelected({ yPercent: parseFloat(e.target.value) || 0 })}
                  className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Width (%)</span>
                <Input
                  type="number"
                  min={5}
                  max={100}
                  step={0.5}
                  value={selected.widthPercent}
                  onChange={(e) => updateSelected({ widthPercent: parseFloat(e.target.value) || 10 })}
                  className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Height (%)</span>
                <Input
                  type="number"
                  min={3}
                  max={100}
                  step={0.5}
                  value={selected.heightPercent}
                  onChange={(e) => updateSelected({ heightPercent: parseFloat(e.target.value) || 5 })}
                  className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          {/* Typography Controls (for text placeholders) */}
          {selected.type !== "qr_code" && (
            <div className="space-y-3 pt-2 border-t border-[#24242A]">
              <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-cyan-400" />
                Typography &amp; Styling
              </Label>

              {/* Font Family */}
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Font Family</span>
                <Select
                  value={selected.fontFamily || "Inter, sans-serif"}
                  onValueChange={(val) => updateSelected({ fontFamily: val })}
                >
                  <SelectTrigger className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181F] border-[#2A2A35] text-zinc-200">
                    {FONT_FAMILIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size & Weight */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Font Size (Pt)</span>
                  <Input
                    type="number"
                    min={6}
                    max={72}
                    value={selected.fontSizePt || 16}
                    onChange={(e) => updateSelected({ fontSizePt: parseInt(e.target.value) || 12 })}
                    className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Weight</span>
                  <Select
                    value={selected.fontWeight || "bold"}
                    onValueChange={(val: any) => updateSelected({ fontWeight: val })}
                  >
                    <SelectTrigger className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#18181F] border-[#2A2A35] text-zinc-200">
                      <SelectItem value="normal">Normal (400)</SelectItem>
                      <SelectItem value="medium">Medium (500)</SelectItem>
                      <SelectItem value="semibold">SemiBold (600)</SelectItem>
                      <SelectItem value="bold">Bold (700)</SelectItem>
                      <SelectItem value="black">Black (900)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Text Alignment & Transform */}
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Text Alignment</span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#18181F] border border-[#2A2A35] rounded-xl">
                  <button
                    type="button"
                    onClick={() => updateSelected({ align: "left" })}
                    className={`py-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      selected.align === "left" || !selected.align ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelected({ align: "center" })}
                    className={`py-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      selected.align === "center" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelected({ align: "right" })}
                    className={`py-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      selected.align === "right" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Text Transformation */}
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Case Transformation</span>
                <Select
                  value={selected.textTransform || "none"}
                  onValueChange={(val: any) => updateSelected({ textTransform: val })}
                >
                  <SelectTrigger className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181F] border-[#2A2A35] text-zinc-200">
                    <SelectItem value="none">As Entered (Standard)</SelectItem>
                    <SelectItem value="uppercase">ALL UPPERCASE</SelectItem>
                    <SelectItem value="capitalize">Capitalize Words</SelectItem>
                    <SelectItem value="lowercase">all lowercase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Text Color Swatches & Custom Hex */}
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-zinc-400" /> Text Color
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selected.color || "#FFFFFF"}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-[#2A2A35] bg-transparent cursor-pointer"
                  />
                  <Input
                    value={selected.color || "#FFFFFF"}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono flex-1"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => updateSelected({ color: swatch })}
                      style={{ backgroundColor: swatch }}
                      className={`w-5 h-5 rounded-full border cursor-pointer transition-transform hover:scale-110 ${
                        selected.color === swatch ? "border-amber-400 ring-2 ring-amber-400/50" : "border-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* QR Code Options */}
          {selected.type === "qr_code" && (
            <div className="space-y-3 pt-2 border-t border-[#24242A]">
              <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                QR Code Settings
              </Label>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Error Correction Level</span>
                <Select
                  value={selected.qrErrorCorrection || "M"}
                  onValueChange={(val: any) => updateSelected({ qrErrorCorrection: val })}
                >
                  <SelectTrigger className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181F] border-[#2A2A35] text-zinc-200">
                    <SelectItem value="L">L - Low (7% recovery)</SelectItem>
                    <SelectItem value="M">M - Medium (15% recovery, Recommended)</SelectItem>
                    <SelectItem value="Q">Q - Quartile (25% recovery)</SelectItem>
                    <SelectItem value="H">H - High (30% recovery)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Quiet Zone / Margin</span>
                <Input
                  type="number"
                  min={0}
                  max={4}
                  value={selected.qrMargin ?? 1}
                  onChange={(e) => updateSelected({ qrMargin: parseInt(e.target.value) || 0 })}
                  className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── CARD GLOBAL SETTINGS (NO ELEMENT SELECTED) ───────────────────── */
        <div className="p-4 space-y-5">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs leading-relaxed">
            <strong>ID Card Canvas Properties</strong>
            <p className="text-[11px] text-amber-300/80 mt-0.5">
              Select any placeholder to modify its fonts and coordinates, or adjust the physical print dimensions below.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Physical Card Dimensions
            </Label>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Width (Inches)</span>
                <Input
                  type="number"
                  step="0.01"
                  value={design.widthInches}
                  onChange={(e) => onChange({ ...design, widthInches: e.target.value })}
                  className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500">Height (Inches)</span>
                <Input
                  type="number"
                  step="0.01"
                  value={design.heightInches}
                  onChange={(e) => onChange({ ...design, heightInches: e.target.value })}
                  className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500">Print DPI (Resolution)</span>
              <Select
                value={String(design.dpi || 300)}
                onValueChange={(val) => onChange({ ...design, dpi: parseInt(val) || 300 })}
              >
                <SelectTrigger className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181F] border-[#2A2A35] text-zinc-200">
                  <SelectItem value="300">300 DPI (High-Resolution Print Quality)</SelectItem>
                  <SelectItem value="150">150 DPI (Draft / Screen Preview)</SelectItem>
                  <SelectItem value="600">600 DPI (Ultra-Fine Printing)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Background Template */}
          <div className="space-y-2 pt-2 border-t border-[#24242A]">
            <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Background Template</span>
              {design.templateImageUrl && (
                <span className="text-[10px] text-emerald-400 font-mono">✓ PNG Active</span>
              )}
            </Label>

            {design.templateImageUrl ? (
              <div className="p-2 rounded-2xl bg-[#1A1A22] border border-[#2B2B36] space-y-2">
                <img
                  src={design.templateImageUrl}
                  alt="Template Preview"
                  className="w-full h-24 object-contain rounded-lg bg-black/40 border border-white/10"
                />
                <Button
                  onClick={onOpenUploadModal}
                  className="w-full h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
                >
                  Replace PNG Template
                </Button>
              </div>
            ) : (
              <Button
                onClick={onOpenUploadModal}
                className="w-full h-9 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs cursor-pointer shadow"
              >
                + Upload PNG Template
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
