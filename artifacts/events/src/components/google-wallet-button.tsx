import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GoogleWalletButtonProps {
  registrationNumber: string;
  className?: string;
  variant?: "default" | "compact";
  showHint?: boolean;
}

export function GoogleWalletButton({
  registrationNumber,
  className = "",
  variant = "default",
  showHint = false,
}: GoogleWalletButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  async function handleAddToWallet(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const token = localStorage.getItem("vision2020_token");

    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${BASE_URL}/api/wallet/google/${encodeURIComponent(registrationNumber)}`, {
        headers,
      });

      let data: any = {};
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error("Unable to connect to Google Wallet service. Please try again.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Unable to generate Google Wallet pass.");
      }

      if (data.saveUrl) {
        // Open Google Wallet Save URL in new tab / app
        window.open(data.saveUrl, "_blank", "noopener,noreferrer");
        toast({
          title: "Opening Google Wallet",
          description: "Choose the Google account you'd like to save this event pass to on the Google Pay page.",
        });
      } else {
        throw new Error("Invalid response from Google Wallet service.");
      }
    } catch (err: any) {
      toast({
        title: "Google Wallet Pass",
        description:
          err.message ||
          "Google Wallet pass is currently unavailable. Please present your digital QR pass at check-in.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (variant === "compact") {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={handleAddToWallet}
          disabled={loading}
          title="Add Event Pass to Google Wallet"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111114] hover:bg-[#1E1E24] border border-[#2B2B34] hover:border-[#4E4E5C] text-white text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 ${className}`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
          ) : (
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
              {/* Google "G" standard 4-color icon */}
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
          )}
          <span>Google Wallet</span>
        </button>
        {showHint && (
          <span className="text-[10px] text-zinc-500 pl-1">You can select which Google account to use</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleAddToWallet}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2.5 px-4 py-2 rounded-2xl bg-[#0F0F12] hover:bg-[#1A1A22] border border-[#2B2B34] hover:border-zinc-500 text-white text-xs font-bold shadow-md transition-all duration-200 cursor-pointer active:scale-98 disabled:opacity-50 group ${className}`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : (
          <div className="w-5 h-5 flex items-center justify-center">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
          </div>
        )}
        <span className="tracking-tight">
          {loading ? "Generating Pass..." : "Add to Google Wallet"}
        </span>
      </button>
      {showHint && (
        <span className="text-[10px] text-zinc-500 pl-1">Select your Google account on the next page to save this pass</span>
      )}
    </div>
  );
}

