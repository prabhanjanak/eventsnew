import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveEvent } from "@/hooks/use-active-event";
import {
  QrCode,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Camera,
  Keyboard,
  Utensils,
  X,
  Building2,
  Hash,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import { CameraQRScanner } from "@/components/camera-qr-scanner";
import { playScanSound } from "@/lib/play-sound";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface FoodScanResult {
  success: boolean;
  message: string;
  status?: string;
  participant?: {
    id: number;
    name: string;
    registrationNumber: string;
    email?: string | null;
    mobile?: string | null;
    institution?: string | null;
    isPaid?: boolean;
    isSponsored?: boolean;
  } | null;
}

function extractRegNumber(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    const withoutQueryParams = trimmed.split("?")[0].split("#")[0];
    const cleanPath = withoutQueryParams.replace(/\/+$/, "").replace(/\\+$/, "");
    const segments = cleanPath.split(/[/\\]/);
    const lastSegment = segments[segments.length - 1];
    return lastSegment ? lastSegment.toUpperCase() : trimmed.toUpperCase();
  }
  return trimmed.toUpperCase();
}

// ── Food ID Card Modal ────────────────────────────────────────────────────────
function FoodIDCardModal({
  result,
  sessionName,
  onClose,
}: {
  result: FoodScanResult;
  sessionName: string;
  onClose: () => void;
}) {
  const p = result.participant;
  const isNew = result.success;
  const alreadyIssued = !result.success && result.message?.toLowerCase().includes("already");

  useEffect(() => {
    const delay = isNew || alreadyIssued ? 2500 : 60000;
    const t = setTimeout(onClose, delay);
    return () => clearTimeout(t);
  }, [onClose, isNew, alreadyIssued]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-[#151518] border border-[#2B2B34] rounded-3xl overflow-hidden shadow-2xl p-6 text-zinc-100 animate-in zoom-in-95 duration-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[#202026] border border-[#30303A] flex items-center justify-center text-zinc-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-3 pt-2">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-[#202028] border border-[#30303C]">
            {isNew ? (
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            ) : alreadyIssued ? (
              <ShieldAlert className="w-9 h-9 text-amber-400" />
            ) : (
              <XCircle className="w-9 h-9 text-rose-400" />
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-0.5 rounded-full bg-[#1E1E24] border border-[#2B2B34] inline-block">
              {sessionName}
            </span>
            <h3 className="text-xl font-black text-white mt-2">
              {isNew ? "Meal Token Issued ✓" : alreadyIssued ? "Token Already Redeemed" : "Verification Failed"}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">{result.message}</p>
          </div>
        </div>

        {p && (
          <div className="p-4 rounded-2xl bg-[#0D0D10] border border-[#222228] space-y-2 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-[#1E1E24]">
              <span className="text-zinc-500 font-medium">Participant Name</span>
              <span className="font-bold text-white text-sm">{p.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Card / Pass ID</span>
              <span className="font-mono font-bold text-zinc-200">{p.registrationNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Organization</span>
              <span className="text-zinc-300 truncate max-w-44">{p.institution || "—"}</span>
            </div>
          </div>
        )}

        <Button
          onClick={onClose}
          className="w-full h-11 bg-white hover:bg-zinc-200 text-zinc-950 font-black rounded-2xl border-none cursor-pointer"
        >
          Scan Next Attendee
        </Button>
      </div>
    </div>
  );
}

// ── Main Scanner ──────────────────────────────────────────────────────────────
export default function FoodScanner() {
  const { token } = useAuth();
  const { activeEvent, activeEventId } = useActiveEvent();
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState<string>("");
  const [scanResult, setScanResult] = useState<FoodScanResult | null>(null);
  const [lastId, setLastId] = useState<string>("");
  const [mode, setMode] = useState<"gun" | "camera">("gun");
  const [isScanning, setIsScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch food sessions for active event
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: ["/api/food-sessions", activeEventId],
    queryFn: async () => {
      const url = activeEventId
        ? `${BASE_URL}/api/food-sessions?eventId=${activeEventId}`
        : `${BASE_URL}/api/food-sessions`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const activeSessions = sessions.filter((s: any) => s.enabled);

  // Auto-select first active session
  useEffect(() => {
    if (!sessionId && activeSessions.length > 0) {
      setSessionId(activeSessions[0].id.toString());
    }
  }, [activeSessions, sessionId]);

  const selectedSession = activeSessions.find((s: any) => s.id.toString() === sessionId);

  useEffect(() => {
    if (mode === "gun" && !isScanning && sessionId && !scanResult) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [mode, isScanning, scanResult, sessionId]);

  const doScan = useCallback(
    async (raw: string) => {
      if (!sessionId) {
        toast({ title: "Select a meal session first", variant: "destructive" });
        return;
      }
      const regNum = extractRegNumber(raw);
      if (!regNum) return;
      setLastId(regNum);
      setIsScanning(true);

      try {
        const resp = await fetch(`${BASE_URL}/api/food/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            registrationNumber: regNum,
            foodSessionId: parseInt(sessionId, 10),
          }),
        });

        const data: FoodScanResult = await resp.json();
        setScanResult(data);

        if (data.success) {
          playScanSound("success");
        } else if (data.status?.includes("already") || data.message?.includes("already")) {
          playScanSound("warning");
        } else {
          playScanSound("error");
        }
      } catch (err: any) {
        playScanSound("error");
        toast({ title: "Scan error", description: err.message, variant: "destructive" });
      } finally {
        setIsScanning(false);
      }
    },
    [sessionId, token, toast]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = e.currentTarget.value;
      e.currentTarget.value = "";
      if (!isScanning) doScan(val);
    }
  };

  const handleCameraScan = (value: string) => {
    if (!isScanning && !scanResult) doScan(value);
  };

  const handleClose = () => {
    setScanResult(null);
    if (mode === "gun") setTimeout(() => inputRef.current?.focus(), 80);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto text-zinc-100 animate-in fade-in duration-300">
      {/* Modal */}
      {scanResult && !isScanning && (
        <FoodIDCardModal
          result={scanResult}
          sessionName={selectedSession?.name ?? "Meal Session"}
          onClose={handleClose}
        />
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Meal Token Scanner</h1>
        <p className="text-xs text-zinc-400">
          Scan attendee badge QR code to issue and verify meal coupon redemption
        </p>
      </div>

      {/* ── SESSION SELECTOR ────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white block">Active Meal Session</span>
          <span className="text-[11px] text-zinc-400">
            {activeSessions.length} active session{activeSessions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {sessionsLoading ? (
          <div className="flex items-center text-zinc-400 text-xs gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading meal sessions…
          </div>
        ) : activeSessions.length > 0 ? (
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="h-11 rounded-2xl bg-[#0D0D10] border-[#2B2B34] text-xs text-zinc-200">
              <SelectValue placeholder="Select active meal session" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181C] border-[#2B2B34] text-zinc-200">
              {activeSessions.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name} ({s.startTime} – {s.endTime})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="p-4 rounded-2xl bg-[#1A1A20] border border-[#2B2B32] text-xs text-amber-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>No active meal sessions found. Please enable a session in Food Sessions first.</span>
          </div>
        )}
      </div>

      {/* ── MODE TOGGLE (HIGH CONTRAST B&W) ─────────────────────────────────── */}
      <div
        className={`flex rounded-2xl border border-[#2B2B32] bg-[#121215] p-1 shadow-sm ${
          !sessionId ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <button
          onClick={() => setMode("gun")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-colors ${
            mode === "gun" ? "bg-white text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Keyboard className="w-4 h-4" /> Scan Gun / Keyboard
        </button>
        <button
          onClick={() => setMode("camera")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-colors ${
            mode === "camera" ? "bg-white text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Camera className="w-4 h-4" /> Device Camera
        </button>
      </div>

      {/* ── SCANNER WORKSPACE ───────────────────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl">
        {mode === "gun" ? (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-3xl bg-[#1E1E24] border border-[#2D2D38] flex items-center justify-center mx-auto text-zinc-300">
              <QrCode className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Scanner Gun Ready</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Point barcode/QR reader or type registration number and press Enter
              </p>
            </div>

            <div className="pt-2">
              <Input
                ref={inputRef}
                placeholder="Scan QR or type Reg No (e.g. SEH-V2020-0012) + Enter"
                onKeyDown={handleKeyDown}
                disabled={!sessionId || isScanning}
                className="h-12 bg-[#0D0D10] border-[#2B2B34] text-white text-center font-mono text-sm placeholder:text-zinc-600 rounded-2xl focus-visible:ring-1 focus-visible:ring-zinc-400"
              />
            </div>

            {lastId && (
              <p className="text-[11px] font-mono text-zinc-500">
                Last Scanned: <span className="text-zinc-300 font-bold">{lastId}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden border border-[#2A2A32] bg-black">
              <CameraQRScanner onScan={handleCameraScan} />
            </div>
            <p className="text-[11px] text-center text-zinc-400">
              Align attendee QR code inside camera viewfinder
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
