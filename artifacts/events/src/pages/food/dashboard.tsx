import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useScanFoodQR, useListFoodSessions, FoodScanResult } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QrCode, CheckCircle2, XCircle, AlertCircle, Loader2, Utensils, Camera, Keyboard, Wifi, LogOut, UserCheck } from "lucide-react";
import { CameraQRScanner } from "@/components/camera-qr-scanner";

// Extract registration number from scanned barcode/QR
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

export default function FoodCoordinatorDashboard() {
  const { logout } = useAuth();
  const [sessionId, setSessionId] = useState<string>("");
  const [scanResult, setScanResult] = useState<FoodScanResult | null>(null);
  const [lastId, setLastId] = useState<string>("");
  const [mode, setMode] = useState<"gun" | "camera">("gun");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: sessions, isLoading: sessionsLoading } = useListFoodSessions();
  const activeSessions = sessions?.filter(s => s.enabled) || [];
  const scanMutation = useScanFoodQR();

  useEffect(() => {
    if (mode === "gun" && !scanMutation.isPending && sessionId) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    return;
  }, [mode, scanMutation.isPending, scanResult, sessionId]);

  useEffect(() => {
    if (scanResult) {
      const p = scanResult.participant;
      const isPaidState = p?.isPaid ?? false;
      const isSponsored = p?.isSponsored ?? false;
      const needsAttention = p && !isPaidState && !isSponsored;
      const shouldAutoCloseQuickly = (scanResult.success || scanResult.message?.toLowerCase().includes("already")) && !needsAttention;

      const delay = shouldAutoCloseQuickly ? 2000 : 60000;
      const t = setTimeout(() => setScanResult(null), delay);
      return () => clearTimeout(t);
    }
    return;
  }, [scanResult]);

  const doScan = useCallback((raw: string) => {
    if (!sessionId) { toast({ title: "Select a meal session first", variant: "destructive" }); return; }
    const regNum = extractRegNumber(raw);
    if (!regNum) return;
    setLastId(regNum);
    scanMutation.mutate(
      { data: { registrationNumber: regNum, foodSessionId: parseInt(sessionId, 10) } },
      {
        onSuccess: (data) => setScanResult(data),
        onError: (err: unknown) => {
          toast({ title: "Scan failed", description: (err as Error).message, variant: "destructive" });
        },
      }
    );
  }, [scanMutation, sessionId, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = e.currentTarget.value;
      e.currentTarget.value = "";
      if (!scanMutation.isPending) doScan(val);
    }
  };

  const handleCameraScan = (value: string) => {
    if (!scanMutation.isPending) doScan(value);
  };

  const selectedSession = activeSessions.find(s => s.id.toString() === sessionId);

  const statusColor = scanResult
    ? scanResult.success ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"
    : "bg-white border-slate-200 text-slate-800";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 animate-in fade-in duration-500">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 py-3 text-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F58220] to-[#6F42C1] flex items-center justify-center shrink-0 shadow-md border border-white/20">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-base sm:text-lg text-slate-900 leading-tight truncate">Food Scanner</div>
              <div className="text-slate-400 text-[10px] sm:text-xs truncate font-bold">Sankara Dining Portal</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {selectedSession && (
              <div className="text-right text-xs text-slate-600 hidden sm:block">
                <div className="font-bold text-slate-800 truncate max-w-40">{selectedSession.name}</div>
                <div className="text-[10px] text-slate-400 font-bold">{selectedSession.startTime} – {selectedSession.endTime}</div>
              </div>
            )}
            <button
              onClick={() => logout()}
              className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 text-slate-500 hover:text-slate-800 border border-slate-200 transition-colors shadow-sm"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-5 gap-4 z-10 relative">
        {/* Session Selector */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-4">
          <div className="text-sm font-bold text-slate-700 mb-3">Select Meal Session</div>
          {sessionsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-1 font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-[#F58220]" /> Loading…
            </div>
          ) : activeSessions.length > 0 ? (
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger className="h-11 bg-white border-slate-200 text-slate-850 focus:border-[#F58220] focus:ring-[#F58220]/20">
                <SelectValue placeholder="Select meal session" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-800">
                {activeSessions.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()} className="hover:bg-slate-50 focus:bg-slate-50 text-slate-800 font-semibold">
                    {s.name} ({s.startTime} – {s.endTime})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-start gap-2 text-red-800 bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-550" />
              <span className="font-bold">No active sessions. Ask an admin to enable one.</span>
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className={`flex rounded-xl border border-slate-200 overflow-hidden shadow-sm ${!sessionId ? "opacity-40 pointer-events-none" : ""}`}>
          <button
            onClick={() => setMode("gun")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all ${mode === "gun" ? "bg-[#F58220] text-white shadow-inner" : "bg-white text-slate-650 hover:bg-slate-50 hover:text-slate-800"}`}
          >
            <Keyboard className="w-4 h-4" /> Scan Gun
          </button>
          <button
            onClick={() => setMode("camera")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all ${mode === "camera" ? "bg-[#F58220] text-white shadow-inner" : "bg-white text-slate-650 hover:bg-slate-50 hover:text-slate-800"}`}
          >
            <Camera className="w-4 h-4" /> Camera
          </button>
        </div>

        {/* Camera mode */}
        {mode === "camera" && sessionId && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-4 space-y-4">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <CameraQRScanner
                onScan={handleCameraScan}
                active={mode === "camera"}
                paused={scanMutation.isPending || !!scanResult}
              />
              {(scanMutation.isPending || scanResult) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-5 overflow-y-auto text-white z-10">
                  <div className="text-center w-full flex flex-col items-center justify-center">
                    {scanMutation.isPending ? (
                      <>
                        <Loader2 className="w-12 h-12 text-[#F58220] animate-spin mb-2" />
                        <p className="text-orange-400 font-black text-lg">Issuing coupon…</p>
                        <p className="font-mono text-xs text-slate-400 mt-0.5 font-bold">{lastId}</p>
                      </>
                    ) : scanResult ? (
                      <>
                        <div className="flex flex-col items-center">
                          {scanResult.success ? (
                            <CheckCircle2 className="w-14 h-14 text-emerald-400 mb-2 animate-bounce" />
                          ) : (
                            <XCircle className="w-14 h-14 text-red-500 mb-2" />
                          )}
                          <p className={`font-black text-xl ${scanResult.success ? "text-emerald-400" : "text-red-400"}`}>
                            {scanResult.success
                              ? "Coupon Issued ✓"
                              : scanResult.status === "not_linked"
                              ? "Invalid Card"
                              : scanResult.status === "not_onboarded"
                              ? "Registration Pending"
                              : scanResult.message?.toLowerCase().includes("already")
                              ? "Already Issued"
                              : "Denied"}
                          </p>
                          <p className={`text-xs mt-1 font-semibold ${scanResult.success ? "text-emerald-300" : "text-red-300"}`}>
                            {scanResult.message}
                          </p>
                        </div>

                        {scanResult.participant && (
                          <div className="mt-3 text-center text-white/90 space-y-2 border-t border-white/10 pt-3 w-full max-w-xs">
                            <p className="font-black text-white text-lg leading-tight">{scanResult.participant.name}</p>
                            <p className="text-xs text-slate-350 font-bold">{scanResult.participant.institution || "—"}</p>
                            <p className="font-mono text-[11px] text-slate-400 font-bold">{scanResult.participant.registrationNumber}</p>
                            
                            {/* Payment status highlight */}
                            <div className="mt-2.5 flex justify-center">
                              {scanResult.participant.isPaid ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded-full border border-green-500/30">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified Paid ✓
                                </span>
                              ) : scanResult.participant.isSponsored ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-bold rounded-full border border-purple-500/30 uppercase">
                                  <UserCheck className="w-3.5 h-3.5" /> Sponsored: {scanResult.participant.sponsorType === "sefi" ? "SEFI" : "Vision2020"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/25 text-red-300 text-xs font-black rounded-full border border-red-500/40 animate-pulse">
                                  <AlertCircle className="w-3.5 h-3.5 text-red-455 shrink-0" /> ⚠️ Payment Pending!
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scan gun mode */}
        {mode === "gun" && (
          <div className={`rounded-2xl border-2 shadow-md transition-all duration-300 p-5 space-y-4 ${!sessionId ? "opacity-40 pointer-events-none bg-white border-slate-200" : statusColor}`}>
            {/* Result / ready state */}
            <div className="text-center min-h-[100px] flex flex-col items-center justify-center">
              {scanMutation.isPending ? (
                <>
                  <Loader2 className="w-12 h-12 text-[#F58220] animate-spin mb-2" />
                  <p className="text-orange-600 font-black text-lg">Issuing coupon…</p>
                  <p className="font-mono text-xs text-slate-400 mt-0.5 font-bold">{lastId}</p>
                </>
              ) : scanResult ? (
                <>
                  <div className="flex flex-col items-center">
                    {scanResult.success ? (
                      <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-2 animate-bounce" />
                    ) : (
                      <XCircle className="w-14 h-14 text-red-550 mb-2" />
                    )}
                    <p className={`font-black text-xl ${scanResult.success ? "text-emerald-700" : "text-red-700"}`}>
                      {scanResult.success
                        ? "Coupon Issued ✓"
                        : scanResult.status === "not_linked"
                        ? "Invalid Card"
                        : scanResult.status === "not_onboarded"
                        ? "Registration Pending"
                        : scanResult.message?.toLowerCase().includes("already")
                        ? "Already Issued"
                        : "Denied"}
                    </p>
                    <p className={`text-xs mt-1 font-bold ${scanResult.success ? "text-emerald-600" : "text-red-500"}`}>
                      {scanResult.message}
                    </p>
                  </div>

                  {scanResult.participant && (
                    <div className="mt-3 text-center space-y-2 border-t border-slate-200/60 pt-3 w-full max-w-xs mx-auto">
                      <p className="font-black text-slate-900 text-lg leading-tight">{scanResult.participant.name}</p>
                      <p className="text-xs text-slate-500 font-bold">{scanResult.participant.institution || "—"}</p>
                      <p className="font-mono text-[11px] text-slate-400 font-bold">{scanResult.participant.registrationNumber}</p>
                      
                      {/* Payment status highlight */}
                      <div className="mt-2.5 flex justify-center">
                        {scanResult.participant.isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified Paid ✓
                          </span>
                        ) : scanResult.participant.isSponsored ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-800 text-xs font-black rounded-full border border-purple-200 uppercase">
                            <UserCheck className="w-3.5 h-3.5" /> Sponsored: {scanResult.participant.sponsorType === "sefi" ? "SEFI" : "Vision2020"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 text-xs font-black rounded-full border border-red-200 animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" /> ⚠️ Payment Pending!
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full border border-dashed border-[#F58220]/45 flex items-center justify-center mb-2 bg-orange-50/50">
                    <QrCode className="w-7 h-7 text-[#F58220]" />
                  </div>
                  <p className="text-orange-600 font-black">Ready to scan</p>
                  <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1 font-bold">
                    <Wifi className="w-3 h-3 text-emerald-500" /> Coupon issued instantly on scan
                  </p>
                </>
              )}
            </div>

            {/* Input */}
            <div className="relative">
              <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                ref={inputRef}
                placeholder="Scan QR code here…"
                className="pl-9 font-mono text-sm h-11 bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#F58220] focus:ring-[#F58220]/20"
                onKeyDown={handleKeyDown}
                disabled={scanMutation.isPending || !sessionId}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <Button
              onClick={() => {
                const val = inputRef.current?.value ?? "";
                if (inputRef.current) inputRef.current.value = "";
                if (!scanMutation.isPending) doScan(val);
              }}
              className="w-full h-11 bg-[#F58220] hover:bg-[#e07010] text-white font-bold hover:-translate-y-0.5 transition-transform shadow-md shadow-orange-100"
              disabled={scanMutation.isPending || !sessionId}
            >
              {scanMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
                : "Issue Coupon (or press Enter)"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
