import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Loader2, FlipHorizontal, ShieldAlert, Copy, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraQRScannerProps {
  onScan: (value: string) => void;
  active?: boolean;
  paused?: boolean;
}

export function CameraQRScanner({ onScan, active = true, paused = false }: CameraQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [errorType, setErrorType] = useState<"insecure" | "denied" | "notfound" | "generic" | null>(null);
  const [activeTab, setActiveTab] = useState<"https" | "flags">("https");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  useEffect(() => {
    if (!paused) {
      lastScannedRef.current = "";
      lastScannedTimeRef.current = 0;
    }
  }, [paused]);

  const stopCamera = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(tick);
      return;
    }

    if (paused) {
      animRef.current = requestAnimationFrame(tick);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { animRef.current = requestAnimationFrame(tick); return; }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      const now = Date.now();
      // Debounce: same code within 2s → skip
      if (code.data !== lastScannedRef.current || now - lastScannedTimeRef.current > 2000) {
        lastScannedRef.current = code.data;
        lastScannedTimeRef.current = now;

        // Extract the registration number from the QR data
        // QR 1 encodes the raw registrationNumber
        // QR 3 encodes a URL like /agenda/VIS2026-00001 — extract the last segment
        let value = code.data;
        const urlMatch = value.match(/\/agenda\/([A-Z0-9-]+)$/i);
        if (urlMatch) value = urlMatch[1];

        onScan(value);
      }
    }

    animRef.current = requestAnimationFrame(tick);
  }, [onScan, paused]);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    stopCamera();
    setStatus("starting");
    setErrorMsg("");
    setErrorType(null);
    try {
      if (!window.isSecureContext) {
        setErrorType("insecure");
        throw new Error(
          "Camera access requires a secure connection (HTTPS)."
        );
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorType("insecure");
        throw new Error(
          "Camera APIs are not supported or are blocked on this browser."
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("running");
      animRef.current = requestAnimationFrame(tick);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      let type: "insecure" | "denied" | "notfound" | "generic" = "generic";

      if (!window.isSecureContext) {
        type = "insecure";
      } else if (
        msg.includes("Permission") || 
        msg.includes("denied") || 
        msg.includes("NotAllowedError") || 
        msg.toLowerCase().includes("permission")
      ) {
        type = "denied";
      } else if (
        msg.includes("Requested device not found") || 
        msg.includes("NotFound") || 
        msg.includes("DevicesNotFoundError")
      ) {
        type = "notfound";
      }

      setErrorType(type);
      setErrorMsg(
        type === "insecure"
          ? "Camera access is blocked because this page is loaded over insecure HTTP. Modern browsers require HTTPS (or localhost) to access the camera."
          : type === "denied"
          ? "Camera permission was denied. Please allow camera access in your browser or site settings."
          : type === "notfound"
          ? "No camera found on this device. Please check connections."
          : `Camera error: ${msg}`
      );
      setStatus("error");
    }
  }, [stopCamera, tick]);

  useEffect(() => {
    if (active) startCamera(facingMode);
    else stopCamera();
    return stopCamera;
  }, [active, facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFlip = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-[4/3]">
      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
        autoPlay
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay: scanning frame */}
      {status === "running" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-52 h-52">
            {/* Corners */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
            {/* Scanning line animation */}
            <div className="absolute inset-x-0 h-0.5 bg-[#F58220] shadow-lg shadow-orange-400 animate-scan-line" />
          </div>
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <span className="text-white/80 text-xs bg-black/40 px-3 py-1 rounded-full">
              Point camera at QR code
            </span>
          </div>
        </div>
      )}

      {/* Starting spinner */}
      {status === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <span className="text-white text-sm">Starting camera…</span>
        </div>
      )}

      {/* Idle state */}
      {status === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 gap-3">
          <Camera className="w-12 h-12 text-gray-500" />
          <span className="text-gray-400 text-sm">Camera inactive</span>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col bg-zinc-950 p-5 overflow-y-auto text-left gap-4 text-white">
          {errorType === "insecure" ? (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-500 animate-pulse" />
                <h3 className="font-semibold text-sm text-zinc-100">Secure Connection Required</h3>
              </div>
              
              <p className="text-zinc-400 text-xs leading-normal">
                Modern mobile browsers block camera access on plain HTTP connections. Choose one of the options below to enable it.
              </p>

              {/* Tabs */}
              <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("https")}
                  className={`flex-1 text-center py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === "https"
                      ? "bg-[#F58220] text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  HTTPS Mode (Vite)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("flags")}
                  className={`flex-1 text-center py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === "flags"
                      ? "bg-[#F58220] text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Chrome Flags (Android)
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 min-h-0 text-xs text-zinc-300 space-y-3 pt-1">
                {activeTab === "https" ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-zinc-400 font-medium">1. Run with HTTPS:</div>
                      <div className="flex items-center gap-1.5 bg-zinc-900 p-2 rounded-md font-mono border border-zinc-800 group relative">
                        <span className="truncate flex-1 text-zinc-200 select-all">pnpm run dev:https</span>
                        <button
                          type="button"
                          onClick={() => handleCopy("pnpm run dev:https", "cmd")}
                          className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors"
                          title="Copy command"
                        >
                          {copiedText === "cmd" ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-zinc-400 font-medium">2. Open HTTPS URL:</div>
                      <div className="flex items-center gap-1.5 bg-zinc-900 p-2 rounded-md font-mono border border-zinc-800 group relative">
                        <span className="truncate flex-1 text-zinc-200 select-all text-[11px]">
                          {`https://${window.location.host}${window.location.pathname}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`https://${window.location.host}${window.location.pathname}`, "url")}
                          className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors"
                          title="Copy URL"
                        >
                          {copiedText === "url" ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-amber-500/80 leading-normal italic pt-1">
                        Note: Bypass the "Connection not private" warning by tapping **Advanced** &rarr; **Proceed**.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-zinc-400 font-medium">1. Open Flags page in Chrome:</div>
                      <div className="flex items-center gap-1.5 bg-zinc-900 p-2 rounded-md font-mono border border-zinc-800 group relative">
                        <span className="truncate flex-1 text-zinc-200 select-all text-[11px]">
                          chrome://flags/#unsafely-treat-insecure-origin-as-secure
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy("chrome://flags/#unsafely-treat-insecure-origin-as-secure", "flagsUrl")
                          }
                          className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors"
                          title="Copy address"
                        >
                          {copiedText === "flagsUrl" ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-zinc-400 font-medium">2. Add this origin to the input box:</div>
                      <div className="flex items-center gap-1.5 bg-zinc-900 p-2 rounded-md font-mono border border-zinc-800 group relative">
                        <span className="truncate flex-1 text-zinc-200 select-all text-[11px]">
                          {`http://${window.location.host}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`http://${window.location.host}`, "originUrl")}
                          className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors"
                          title="Copy origin"
                        >
                          {copiedText === "originUrl" ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-400 leading-normal">
                      3. Select <strong className="text-zinc-200">Enabled</strong> from the dropdown and tap <strong className="text-zinc-200">Relaunch</strong>.
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 border-t border-zinc-900 pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1 text-zinc-300 border-zinc-800 hover:bg-zinc-900"
                  onClick={() => startCamera(facingMode)}
                >
                  Retry Connection
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              {errorType === "denied" ? (
                <Lock className="w-10 h-10 text-[#F58220]" />
              ) : (
                <CameraOff className="w-10 h-10 text-red-400" />
              )}
              <div className="space-y-1">
                <h3 className="font-semibold text-sm">
                  {errorType === "denied" ? "Camera Access Denied" : "Camera Access Error"}
                </h3>
                <p className="text-zinc-400 text-xs leading-normal max-w-xs px-2">
                  {errorMsg}
                </p>
              </div>
              {errorType === "denied" && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] text-zinc-400 text-left max-w-xs leading-relaxed space-y-1">
                  <span className="font-medium text-zinc-200">How to restore access:</span>
                  <p>1. Tap the lock/settings icon next to the URL bar.</p>
                  <p>2. Find "Camera" and toggle permission to **Allow**.</p>
                  <p>3. Reload this page to try again.</p>
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-white border-white/20 hover:bg-white/10 mt-2 min-w-28"
                onClick={() => startCamera(facingMode)}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Flip camera button */}
      {status === "running" && (
        <button
          onClick={handleFlip}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          title="Flip camera"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
