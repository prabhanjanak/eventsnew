import React, { useRef, useState, useEffect, useCallback } from "react";
import type { IdCardDesignData, PlaceholderConfig, CardAttendee, CardSide } from "./types";
import { getCardPixelDimensions } from "./card-renderer";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  AlignCenterHorizontal,
  AlignCenterVertical,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Sparkles,
  QrCode as QrIcon,
  Type,
  Building,
  Hash,
  RotateCw,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface IdCardCanvasProps {
  design: IdCardDesignData;
  onChange: (updated: IdCardDesignData) => void;
  selectedPlaceholderId: string | null;
  onSelectPlaceholder: (id: string | null) => void;
  sampleAttendee?: Partial<CardAttendee>;
  activeSide: CardSide;
  onSideChange: (side: CardSide) => void;
}

export function IdCardCanvas({
  design,
  onChange,
  selectedPlaceholderId,
  onSelectPlaceholder,
  sampleAttendee,
  activeSide,
  onSideChange,
}: IdCardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  const widthInches = parseFloat(design.widthInches) || 3.46;
  const heightInches = parseFloat(design.heightInches) || 5.51;
  const { widthPx, heightPx, aspectRatio } = getCardPixelDimensions(widthInches, heightInches, design.dpi || 300);

  const isPortrait = heightInches >= widthInches;
  // Dynamic Canvas Display Box
  const canvasDisplayWidth = isPortrait ? 420 : 680;
  const canvasDisplayHeight = isPortrait ? 420 / aspectRatio : 680 / aspectRatio;

  const currentPlaceholders = activeSide === "back" ? (design.backPlaceholders || []) : (design.placeholders || []);
  const currentTemplateImg = activeSide === "back" ? design.backTemplateImageUrl : design.templateImageUrl;

  // Dragging / Resizing State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; phX: number; phY: number; phW: number; phH: number }>({
    x: 0,
    y: 0,
    phX: 0,
    phY: 0,
    phW: 0,
    phH: 0,
  });

  const selectedPlaceholder = currentPlaceholders.find((p) => p.id === selectedPlaceholderId) || null;

  // Auto-fit zoom on mount or container resize
  const handleFitZoom = useCallback(() => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth - 80;
    const containerH = containerRef.current.clientHeight - 80;
    if (containerW <= 0 || containerH <= 0) return;

    const scaleW = containerW / canvasDisplayWidth;
    const scaleH = containerH / canvasDisplayHeight;
    const fitScale = Math.min(scaleW, scaleH, 1.15);
    setZoom(Math.round(fitScale * 100));
  }, [canvasDisplayWidth, canvasDisplayHeight]);

  useEffect(() => {
    handleFitZoom();
  }, [handleFitZoom]);

  const snap = (val: number, step: number = 0.5) => {
    return snapToGrid ? Math.round(val / step) * step : val;
  };

  // Move / Update Placeholder helper
  const updatePlaceholder = (id: string, updates: Partial<PlaceholderConfig>) => {
    if (activeSide === "back") {
      const updated = (design.backPlaceholders || []).map((p) => (p.id === id ? { ...p, ...updates } : p));
      onChange({ ...design, backPlaceholders: updated });
    } else {
      const updated = (design.placeholders || []).map((p) => (p.id === id ? { ...p, ...updates } : p));
      onChange({ ...design, placeholders: updated });
    }
  };

  // Keyboard Delete & Deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedPlaceholderId && selectedPlaceholder && !selectedPlaceholder.isLocked) {
          e.preventDefault();
          if (activeSide === "back") {
            const filtered = (design.backPlaceholders || []).filter((p) => p.id !== selectedPlaceholderId);
            onChange({ ...design, backPlaceholders: filtered });
          } else {
            const filtered = (design.placeholders || []).filter((p) => p.id !== selectedPlaceholderId);
            onChange({ ...design, placeholders: filtered });
          }
          onSelectPlaceholder(null);
        }
      }
      if (e.key === "Escape") {
        onSelectPlaceholder(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlaceholderId, selectedPlaceholder, design, onChange, onSelectPlaceholder, activeSide]);

  // Mouse Move for Drag / Resize
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedPlaceholderId || selectedPlaceholder?.isLocked) return;
    if (!isDragging && !isResizing) return;

    const cardElement = containerRef.current?.querySelector("#id-card-canvas-element");
    if (!cardElement) return;
    const rect = cardElement.getBoundingClientRect();

    const currentX = e.clientX;
    const currentY = e.clientY;

    const deltaXPx = currentX - dragStart.x;
    const deltaYPx = currentY - dragStart.y;

    const deltaXPercent = (deltaXPx / rect.width) * 100;
    const deltaYPercent = (deltaYPx / rect.height) * 100;

    if (isDragging) {
      let newX = snap(dragStart.phX + deltaXPercent);
      let newY = snap(dragStart.phY + deltaYPercent);

      newX = Math.max(0, Math.min(100 - dragStart.phW, newX));
      newY = Math.max(0, Math.min(100 - dragStart.phH, newY));

      updatePlaceholder(selectedPlaceholderId, { xPercent: newX, yPercent: newY });
    } else if (isResizing) {
      let newW = dragStart.phW;
      let newH = dragStart.phH;
      let newX = dragStart.phX;
      let newY = dragStart.phY;

      if (isResizing.includes("e")) {
        newW = snap(Math.max(5, Math.min(100 - dragStart.phX, dragStart.phW + deltaXPercent)));
      }
      if (isResizing.includes("s")) {
        newH = snap(Math.max(3, Math.min(100 - dragStart.phY, dragStart.phH + deltaYPercent)));
      }
      if (isResizing.includes("w")) {
        const potentialW = snap(dragStart.phW - deltaXPercent);
        if (potentialW >= 5 && dragStart.phX + deltaXPercent >= 0) {
          newW = potentialW;
          newX = snap(dragStart.phX + deltaXPercent);
        }
      }
      if (isResizing.includes("n")) {
        const potentialH = snap(dragStart.phH - deltaYPercent);
        if (potentialH >= 3 && dragStart.phY + deltaYPercent >= 0) {
          newH = potentialH;
          newY = snap(dragStart.phY + deltaYPercent);
        }
      }

      updatePlaceholder(selectedPlaceholderId, {
        xPercent: newX,
        yPercent: newY,
        widthPercent: newW,
        heightPercent: newH,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(null);
  };

  const handleCenterHorizontal = () => {
    if (!selectedPlaceholder) return;
    const newX = snap((100 - selectedPlaceholder.widthPercent) / 2);
    updatePlaceholder(selectedPlaceholder.id, { xPercent: newX });
  };

  const handleCenterVertical = () => {
    if (!selectedPlaceholder) return;
    const newY = snap((100 - selectedPlaceholder.heightPercent) / 2);
    updatePlaceholder(selectedPlaceholder.id, { yPercent: newY });
  };

  const handleDuplicate = () => {
    if (!selectedPlaceholder) return;
    const dup: PlaceholderConfig = {
      ...selectedPlaceholder,
      id: `ph_${Date.now()}`,
      label: `${selectedPlaceholder.label} (Copy)`,
      xPercent: Math.min(80, selectedPlaceholder.xPercent + 3),
      yPercent: Math.min(80, selectedPlaceholder.yPercent + 3),
    };
    if (activeSide === "back") {
      onChange({ ...design, backPlaceholders: [...(design.backPlaceholders || []), dup] });
    } else {
      onChange({ ...design, placeholders: [...design.placeholders, dup] });
    }
    onSelectPlaceholder(dup.id);
  };

  const handleDelete = () => {
    if (!selectedPlaceholderId) return;
    if (activeSide === "back") {
      const filtered = (design.backPlaceholders || []).filter((p) => p.id !== selectedPlaceholderId);
      onChange({ ...design, backPlaceholders: filtered });
    } else {
      const filtered = design.placeholders.filter((p) => p.id !== selectedPlaceholderId);
      onChange({ ...design, placeholders: filtered });
    }
    onSelectPlaceholder(null);
  };

  const handleToggleLock = () => {
    if (!selectedPlaceholder) return;
    updatePlaceholder(selectedPlaceholder.id, { isLocked: !selectedPlaceholder.isLocked });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0C0C0E] select-none overflow-hidden relative">
      {/* ── TOP CANVAS TOOLBAR ────────────────────────────────────────────── */}
      <div className="h-13 bg-[#141418] border-b border-[#24242A] px-4 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left Toolbar: Side Switcher (Front / Back) & Selected Placeholder Controls */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {/* One-Sided vs 2-Sided Switcher */}
          {design.isDoubleSided && (
            <div className="flex items-center p-0.5 bg-[#1A1A22] border border-[#2B2B36] rounded-xl mr-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSideChange("front");
                  onSelectPlaceholder(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSide === "front" ? "bg-amber-400 text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
                }`}
              >
                Front Side
              </button>
              <button
                type="button"
                onClick={() => {
                  onSideChange("back");
                  onSelectPlaceholder(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSide === "back" ? "bg-amber-400 text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
                }`}
              >
                Back Side
              </button>
            </div>
          )}

          {selectedPlaceholder ? (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-200">
                {selectedPlaceholder.type === "qr_code" ? (
                  <QrIcon className="w-3.5 h-3.5 text-amber-400" />
                ) : selectedPlaceholder.type === "name" ? (
                  <Type className="w-3.5 h-3.5 text-cyan-400" />
                ) : selectedPlaceholder.type === "organization" ? (
                  <Building className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Hash className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span className="font-bold">{selectedPlaceholder.label}</span>
              </div>

              <div className="h-4 w-px bg-zinc-700 mx-0.5" />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCenterHorizontal}
                title="Center Horizontally"
                className="h-8 px-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 text-xs"
              >
                <AlignCenterHorizontal className="w-4 h-4 mr-1 text-zinc-400" />
                Center X
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCenterVertical}
                title="Center Vertically"
                className="h-8 px-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 text-xs"
              >
                <AlignCenterVertical className="w-4 h-4 mr-1 text-zinc-400" />
                Center Y
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDuplicate}
                title="Duplicate Element"
                className="h-8 px-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 text-xs"
              >
                <Copy className="w-3.5 h-3.5 mr-1 text-zinc-400" />
                Duplicate
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleLock}
                title={selectedPlaceholder.isLocked ? "Unlock Element" : "Lock Element"}
                className={`h-8 px-2 rounded-lg text-xs ${
                  selectedPlaceholder.isLocked ? "bg-amber-500/20 text-amber-300" : "text-zinc-300 hover:text-white hover:bg-white/10"
                }`}
              >
                {selectedPlaceholder.isLocked ? <Lock className="w-3.5 h-3.5 mr-1" /> : <Unlock className="w-3.5 h-3.5 mr-1" />}
                {selectedPlaceholder.isLocked ? "Locked" : "Lock"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                title="Delete Element"
                className="h-8 px-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
            </>
          ) : (
            <div className="text-xs text-zinc-500 flex items-center gap-1.5 italic">
              <Sparkles className="w-3.5 h-3.5 text-zinc-600" />
              <span>Editing {activeSide === "front" ? "Front Side" : "Back Side"} • Click elements to edit</span>
            </div>
          )}
        </div>

        {/* Right Toolbar: Zoom, Snap & Aspect Dimensions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSnapToGrid(!snapToGrid)}
            title="Snap to Grid"
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              snapToGrid ? "bg-white/15 text-white border border-white/20" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Snap Grid</span>
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          <div className="flex items-center gap-1 bg-[#1A1A20] border border-[#2B2B32] rounded-xl p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.max(40, z - 10))}
              className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[11px] font-mono font-bold text-zinc-300 px-1.5 min-w-10 text-center">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.min(250, z + 10))}
              className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFitZoom}
              className="h-7 px-1.5 rounded-lg text-zinc-400 hover:text-white text-[11px]"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE CENTER CANVAS AREA ─────────────────────────────────── */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelectPlaceholder(null);
          }
        }}
        className="flex-1 overflow-auto flex items-center justify-center p-8 relative bg-[radial-gradient(#1e1e24_1px,transparent_1px)] [background-size:16px_16px]"
      >
        {/* Scale Container */}
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "center center",
            transition: isDragging || isResizing ? "none" : "transform 0.15s ease-out",
          }}
          className="relative shadow-2xl"
        >
          {/* Card Physical Outer Container */}
          <div
            id="id-card-canvas-element"
            onClick={(e) => {
              if (e.target === e.currentTarget) onSelectPlaceholder(null);
            }}
            style={{
              width: `${canvasDisplayWidth}px`,
              height: `${canvasDisplayHeight}px`,
              backgroundImage: currentTemplateImg ? `url(${currentTemplateImg})` : undefined,
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            className={`relative rounded-xl border-2 transition-all ${
              !currentTemplateImg ? "bg-gradient-to-br from-[#18181C] to-[#0A0A0C] border-dashed border-[#3A3A45]" : "border-white/20 shadow-2xl"
            } overflow-hidden`}
          >
            {/* Empty Template Guide when no PNG uploaded for this side */}
            {!currentTemplateImg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none text-zinc-500">
                <Sparkles className="w-8 h-8 text-zinc-600 mb-2 animate-pulse" />
                <p className="font-bold text-sm text-zinc-400">
                  {activeSide === "front" ? "Front Side Canvas" : "Back Side Canvas"}
                </p>
                <p className="text-xs max-w-xs mt-1 text-zinc-600">
                  Upload {activeSide === "front" ? "front" : "back"} PNG template from Template Settings or place placeholders directly.
                </p>
              </div>
            )}

            {/* Placeholders Render Overlay */}
            {currentPlaceholders.map((ph) => {
              const isSelected = ph.id === selectedPlaceholderId;
              let displaySample = "";
              if (ph.type === "name") {
                displaySample = sampleAttendee?.name || ph.customSampleText || "{{Participant Name}}";
              } else if (ph.type === "organization") {
                displaySample = sampleAttendee?.institution || ph.customSampleText || "{{Institution / Hospital}}";
              } else if (ph.type === "id_number") {
                displaySample = sampleAttendee?.registrationNumber || ph.customSampleText || "{{REG-00000}}";
              } else if (ph.type === "qr_code") {
                displaySample = "";
              } else {
                displaySample = ph.customSampleText || ph.label;
              }

              if (ph.textTransform === "uppercase") displaySample = displaySample.toUpperCase();
              else if (ph.textTransform === "lowercase") displaySample = displaySample.toLowerCase();
              else if (ph.textTransform === "capitalize") displaySample = displaySample.replace(/\b\w/g, (c) => c.toUpperCase());

              return (
                <div
                  key={ph.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlaceholder(ph.id);
                  }}
                  onMouseDown={(e) => {
                    if (ph.isLocked) return;
                    e.stopPropagation();
                    onSelectPlaceholder(ph.id);
                    setIsDragging(true);
                    setDragStart({
                      x: e.clientX,
                      y: e.clientY,
                      phX: ph.xPercent,
                      phY: ph.yPercent,
                      phW: ph.widthPercent,
                      phH: ph.heightPercent,
                    });
                  }}
                  style={{
                    left: `${ph.xPercent}%`,
                    top: `${ph.yPercent}%`,
                    width: `${ph.widthPercent}%`,
                    height: `${ph.heightPercent}%`,
                    cursor: ph.isLocked ? "not-allowed" : "move",
                  }}
                  className={`absolute group flex items-center ${
                    ph.align === "center" ? "justify-center text-center" : ph.align === "right" ? "justify-end text-right" : "justify-start text-left"
                  } ${
                    isSelected
                      ? "ring-2 ring-amber-400 bg-amber-400/10 z-30"
                      : "hover:ring-1 hover:ring-white/40 hover:bg-white/5 z-10"
                  } rounded transition-all`}
                >
                  {/* Element Content */}
                  {ph.type === "qr_code" ? (
                    <div className="w-full h-full p-1 flex items-center justify-center">
                      <div className="w-full h-full bg-white rounded flex flex-col items-center justify-center p-1 shadow">
                        <QrIcon className="w-full h-full text-black" />
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontFamily: ph.fontFamily || "Inter, sans-serif",
                        fontSize: `${(ph.fontSizePt || 16) * (canvasDisplayWidth / 350) * 0.75}px`,
                        fontWeight: ph.fontWeight === "bold" ? 700 : ph.fontWeight === "black" ? 900 : ph.fontWeight === "semibold" ? 600 : 500,
                        color: ph.color || (currentTemplateImg ? "#000000" : "#FFFFFF"),
                        letterSpacing: `${ph.letterSpacing || 0}px`,
                        width: "100%",
                      }}
                      className="truncate px-1 leading-tight select-none"
                    >
                      {displaySample}
                    </div>
                  )}

                  {/* Selection Label Badge */}
                  {isSelected && (
                    <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider shadow">
                      {ph.label} {ph.isLocked ? "🔒" : ""}
                    </div>
                  )}

                  {/* Resize Handles */}
                  {isSelected && !ph.isLocked && (
                    <>
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setIsResizing("e");
                          setDragStart({
                            x: e.clientX,
                            y: e.clientY,
                            phX: ph.xPercent,
                            phY: ph.yPercent,
                            phW: ph.widthPercent,
                            phH: ph.heightPercent,
                          });
                        }}
                        className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-400 border-2 border-black rounded-full cursor-ew-resize z-40"
                      />
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setIsResizing("s");
                          setDragStart({
                            x: e.clientX,
                            y: e.clientY,
                            phX: ph.xPercent,
                            phY: ph.yPercent,
                            phW: ph.widthPercent,
                            phH: ph.heightPercent,
                          });
                        }}
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-400 border-2 border-black rounded-full cursor-ns-resize z-40"
                      />
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setIsResizing("se");
                          setDragStart({
                            x: e.clientX,
                            y: e.clientY,
                            phX: ph.xPercent,
                            phY: ph.yPercent,
                            phW: ph.widthPercent,
                            phH: ph.heightPercent,
                          });
                        }}
                        className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-amber-400 border-2 border-black rounded-full cursor-nwse-resize z-40"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Physical Spec Legend Badge */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 px-2 font-mono">
            <span>
              Size: <strong>{widthInches} × {heightInches} in</strong> ({isPortrait ? "Vertical" : "Horizontal"} • {activeSide === "front" ? "Front" : "Back"})
            </span>
            <span>
              Res: <strong>{widthPx} × {heightPx} px</strong> @ {design.dpi} DPI
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
