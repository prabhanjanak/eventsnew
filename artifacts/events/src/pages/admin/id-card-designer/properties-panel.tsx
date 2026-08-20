import React from "react";
import type { IdCardDesignData, PlaceholderConfig, CardSide } from "./types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  Upload,
} from "lucide-react";

interface PropertiesPanelProps {
  design: IdCardDesignData;
  onChange: (updated: IdCardDesignData) => void;
  selectedPlaceholderId: string | null;
  onSelectPlaceholder: (id: string | null) => void;
  onOpenUploadModal: (side: CardSide) => void;
  activeSide: CardSide;
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
  "#000000",
  "#FFFFFF",
  "#F59E0B", // Gold / Amber
  "#3B82F6", // Royal Blue
  "#10B981", // Emerald
  "#EF4444", // Crimson
  "#8B5CF6", // Purple
  "#1E293B", // Slate Dark
];

export function PropertiesPanel({
  design,
  onChange,
  selectedPlaceholderId,
  onSelectPlaceholder,
  onOpenUploadModal,
  activeSide,
}: PropertiesPanelProps) {
  const isBack = activeSide === "back";
  const currentList = isBack ? (design.backPlaceholders || []) : (design.placeholders || []);
  const selected = currentList.find((p) => p.id === selectedPlaceholderId) || null;

  const updateSelected = (updates: Partial<PlaceholderConfig>) => {
    if (!selected) return;
    if (isBack) {
      const updated = (design.backPlaceholders || []).map((p) => (p.id === selected.id ? { ...p, ...updates } : p));
      onChange({ ...design, backPlaceholders: updated });
    } else {
      const updated = (design.placeholders || []).map((p) => (p.id === selected.id ? { ...p, ...updates } : p));
      onChange({ ...design, placeholders: updated });
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    if (isBack) {
      const filtered = (design.backPlaceholders || []).filter((p) => p.id !== selected.id);
      onChange({ ...design, backPlaceholders: filtered });
    } else {
      const filtered = design.placeholders.filter((p) => p.id !== selected.id);
      onChange({ ...design, placeholders: filtered });
    }
    onSelectPlaceholder(null);
  };

  // Dimension presets
  const applyPreset = (w: string, h: string, orientation: "portrait" | "landscape") => {
    onChange({
      ...design,
      widthInches: w,
      heightInches: h,
      orientation,
    });
  };

  return (
    <div className="w-80 bg-[#121216] border-l border-[#24242A] flex flex-col h-full overflow-y-auto text-xs text-zinc-300">
      {/* ── PANEL HEADER ──────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-[#24242A] flex items-center justify-between gap-2 shrink-0 bg-[#16161B]">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-white uppercase tracking-wider text-xs">
            {selected ? `${selected.label}` : "Card Specifications"}
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

          {/* Typography Controls */}
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
                      selected.align === "left" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelected({ align: "center" })}
                    className={`py-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      selected.align === "center" || !selected.align ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
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

              {/* Color Swatches */}
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-zinc-400" /> Text Color
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selected.color || "#000000"}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-[#2A2A35] bg-transparent cursor-pointer"
                  />
                  <Input
                    value={selected.color || "#000000"}
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
          {/* One-Sided vs 2-Sided Toggle */}
          <div className="p-3.5 rounded-2xl bg-[#1A1A22] border border-[#2B2B36] space-y-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="two-sided-switch" className="font-bold text-xs text-white cursor-pointer">
                Card Sides Configuration
              </Label>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                {design.isDoubleSided ? "2-Sided (Front & Back)" : "1-Sided (Front Only)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="two-sided-switch"
                checked={design.isDoubleSided}
                onCheckedChange={(checked) => onChange({ ...design, isDoubleSided: Boolean(checked) })}
              />
              <Label htmlFor="two-sided-switch" className="text-xs text-zinc-300 cursor-pointer">
                Enable Double-Sided (Front &amp; Back) ID Card Printing
              </Label>
            </div>
          </div>

          {/* Quick Orientation & Dimension Presets */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Dimension Presets
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset("3.46", "5.51", "portrait")}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  design.widthInches === "3.46" && design.heightInches === "5.51"
                    ? "bg-amber-400/10 border-amber-400 text-white"
                    : "bg-[#18181F] border-[#2A2A35] text-zinc-400 hover:text-white"
                }`}
              >
                <div className="font-bold text-xs">Vertical Standard</div>
                <div className="text-[10px] font-mono text-zinc-500">3.46 × 5.51 in</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset("4.00", "6.00", "portrait")}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  design.widthInches === "4.00" && design.heightInches === "6.00"
                    ? "bg-amber-400/10 border-amber-400 text-white"
                    : "bg-[#18181F] border-[#2A2A35] text-zinc-400 hover:text-white"
                }`}
              >
                <div className="font-bold text-xs">Vertical Lanyard</div>
                <div className="text-[10px] font-mono text-zinc-500">4.00 × 6.00 in</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset("5.51", "3.46", "landscape")}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  design.widthInches === "5.51" && design.heightInches === "3.46"
                    ? "bg-amber-400/10 border-amber-400 text-white"
                    : "bg-[#18181F] border-[#2A2A35] text-zinc-400 hover:text-white"
                }`}
              >
                <div className="font-bold text-xs">Horizontal Badge</div>
                <div className="text-[10px] font-mono text-zinc-500">5.51 × 3.46 in</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset("2.125", "3.375", "portrait")}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  design.widthInches === "2.125" && design.heightInches === "3.375"
                    ? "bg-amber-400/10 border-amber-400 text-white"
                    : "bg-[#18181F] border-[#2A2A35] text-zinc-400 hover:text-white"
                }`}
              >
                <div className="font-bold text-xs">PVC Card (CR80)</div>
                <div className="text-[10px] font-mono text-zinc-500">2.125 × 3.375 in</div>
              </button>
            </div>
          </div>

          {/* Custom Size Spinners */}
          <div className="space-y-3 pt-2 border-t border-[#24242A]">
            <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Custom Physical Dimensions
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
              <span className="text-[10px] text-zinc-500">Resolution (DPI)</span>
              <Select
                value={String(design.dpi || 300)}
                onValueChange={(val) => onChange({ ...design, dpi: parseInt(val) || 300 })}
              >
                <SelectTrigger className="h-8 bg-[#18181F] border-[#2A2A35] text-zinc-200 text-xs rounded-xl font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181F] border-[#2A2A35] text-zinc-200">
                  <SelectItem value="300">300 DPI (High-Resolution Print Quality)</SelectItem>
                  <SelectItem value="150">150 DPI (Draft Preview)</SelectItem>
                  <SelectItem value="600">600 DPI (Ultra-Fine Printing)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Background Templates (Front & Back) */}
          <div className="space-y-3 pt-2 border-t border-[#24242A]">
            <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Template Backgrounds
            </Label>

            {/* Front Template */}
            <div className="p-3 rounded-2xl bg-[#1A1A22] border border-[#2B2B36] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">Front Side Template</span>
                {design.templateImageUrl && <span className="text-[10px] text-emerald-400 font-mono">✓ Active</span>}
              </div>
              {design.templateImageUrl ? (
                <div className="space-y-2">
                  <img
                    src={design.templateImageUrl}
                    alt="Front Template"
                    className="w-full h-20 object-contain rounded-lg bg-black/40 border border-white/10"
                  />
                  <Button
                    onClick={() => onOpenUploadModal("front")}
                    className="w-full h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Replace Front Template
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => onOpenUploadModal("front")}
                  className="w-full h-8 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs cursor-pointer shadow"
                >
                  + Upload Front PNG
                </Button>
              )}
            </div>

            {/* Back Template (if double-sided) */}
            {design.isDoubleSided && (
              <div className="p-3 rounded-2xl bg-[#1A1A22] border border-[#2B2B36] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">Back Side Template</span>
                  {design.backTemplateImageUrl && (
                    <span className="text-[10px] text-emerald-400 font-mono">✓ Active</span>
                  )}
                </div>
                {design.backTemplateImageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={design.backTemplateImageUrl}
                      alt="Back Template"
                      className="w-full h-20 object-contain rounded-lg bg-black/40 border border-white/10"
                    />
                    <Button
                      onClick={() => onOpenUploadModal("back")}
                      className="w-full h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Replace Back Template
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => onOpenUploadModal("back")}
                    className="w-full h-8 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs cursor-pointer shadow"
                  >
                    + Upload Back PNG
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
