import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Mail,
  ShieldCheck,
  Building2,
  Copy,
  Check,
  Send,
  Loader2,
  ExternalLink,
  User,
  Phone,
  CheckCircle2,
} from "lucide-react";
import GlitterWrap from "@/components/originkit/ui/glitter-wrap";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const ADMIN_EMAIL = "prabhanjan@sankaraeye.com";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ADMIN_EMAIL);
    setCopied(true);
    toast({ title: "Email Copied to Clipboard!", description: ADMIN_EMAIL });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendAdminRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() && !email.trim()) {
      toast({ title: "Please enter your Employee ID or Email", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/auth/request-admin-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          name: name.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
        }),
      });

      const data = await resp.json();
      if (resp.ok) {
        setSubmitted(true);
        toast({ title: "Reset Request Sent Successfully ✓" });
      } else {
        toast({
          title: "Request Failed",
          description: data.error || "Could not log reset ticket.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", description: "Please use the direct email button below.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const mailtoUrl = `mailto:${ADMIN_EMAIL}?subject=Staff%20Password%20Reset%20Request&body=Hello%20Prabhanjan,%0D%0A%0D%0APlease%20assist%20with%20resetting%20my%20Sankara%20Events%20password.%0D%0A%0D%0AEmployee%20ID:%20${encodeURIComponent(identifier)}%0D%0AName:%20${encodeURIComponent(name)}%0D%0AMobile:%20${encodeURIComponent(mobile)}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${ADMIN_EMAIL}&su=Staff+Password+Reset+Request&body=Hello+Prabhanjan,%0A%0APlease+assist+with+resetting+my+Sankara+Events+password.%0A%0AEmployee+ID:+${encodeURIComponent(identifier)}%0AName:+${encodeURIComponent(name)}`;
  const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${ADMIN_EMAIL}&subject=Staff%20Password%20Reset%20Request&body=Hello%20Prabhanjan,%0D%0A%0D%0APlease%20assist%20with%20resetting%20my%20Sankara%20Events%20password.%0D%0A%0D%0AEmployee%20ID:%20${encodeURIComponent(identifier)}%0D%0AName:%20${encodeURIComponent(name)}`;

  return (
    <div className="relative min-h-screen bg-[#09090C] text-zinc-100 flex flex-col font-sans overflow-x-hidden selection:bg-white/20 selection:text-white">
      {/* ── GlitterWrap Ambient Background ──────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <GlitterWrap
          particleCount={350}
          color1="#ffffff"
          color2="#38BDF8"
          color3="#818CF8"
          speed={3.5}
          density={70}
          starSize={14}
          focalDepth={12}
          glitterIntensity={2}
          trailAmount={85}
          brightness={80}
        />
      </div>

      {/* ── Backdrop Shadow Layer ──────────────────────────────────────────── */}
      <div className="fixed inset-0 bg-black/50 pointer-events-none z-0" />

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-[#0C0D12]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Staff Login</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-[11px] font-mono text-zinc-400 tracking-wider">
              Security Helpdesk
            </span>
          </div>
        </div>
      </header>

      {/* ── Centered Main Content ────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-lg mx-auto px-4 py-8 sm:py-12 w-full flex-1 flex flex-col justify-center items-center">
        
        {/* ── Dual Emblem Header ── */}
        <div className="text-center space-y-3 flex flex-col items-center mb-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[#141622]/90 border border-white/15 p-2.5 flex items-center justify-center shadow-lg backdrop-blur-xl">
              <img
                src={`${BASE_URL}/sankara-eye-logo.png`}
                alt="Sankara Eye Foundation"
                className="w-full h-full object-contain filter brightness-110 drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
              />
            </div>
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-amber-400/40 bg-[#001D4A] p-0 flex items-center justify-center">
              <img
                src={`${BASE_URL}/sankara-50th-logo.png`}
                alt="50 Years Celebration"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-bold tracking-widest text-indigo-400 uppercase font-mono">
              Sankara Eye Foundation
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Password Reset Assistance
            </h1>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Staff credentials and access permissions are managed directly by the central system administrator.
            </p>
          </div>
        </div>

        {/* ── Administrator Contact & Request Card ── */}
        <div className="w-full rounded-2xl bg-[#121319]/90 border border-white/10 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.7)] space-y-6">
          
          {/* Administrator Profile Card */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold text-white">Prabhanjan</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span>MHQ IS Department</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono">
                System Administrator
              </span>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                <span>{ADMIN_EMAIL}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-300 hover:text-white transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Form or Submitted State */}
          {submitted ? (
            <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-emerald-200">Reset Request Dispatched</h3>
                <p className="text-xs text-zinc-300 max-w-xs mx-auto leading-relaxed">
                  Your request has been logged and sent to <strong>Prabhanjan (prabhanjan@sankaraeye.com)</strong>. You will be notified once reset.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSubmitted(false)}
                className="text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
              >
                Submit another request
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSendAdminRequest} className="space-y-3.5">
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-indigo-400" />
                <span>Submit Instant Reset Ticket</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-medium">Employee ID / Username *</Label>
                <Input
                  required
                  placeholder="e.g. 010177"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="h-10 bg-black/40 border-white/10 text-white text-xs font-mono rounded-xl focus:border-white/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-medium">Full Name</Label>
                  <Input
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 bg-black/40 border-white/10 text-white text-xs rounded-xl focus:border-white/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-medium">Contact Mobile / Email</Label>
                  <Input
                    placeholder="Mobile or email"
                    value={mobile || email}
                    onChange={(e) => {
                      setMobile(e.target.value);
                      setEmail(e.target.value);
                    }}
                    className="h-10 bg-black/40 border-white/10 text-white text-xs rounded-xl focus:border-white/40"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 border-none cursor-pointer active:scale-99"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Submitting to Administrator...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-zinc-950" />
                    <span>Send Reset Request to Administrator</span>
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Direct Email Client Launcher Buttons */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider text-center">
              Or compose via your preferred email client:
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <a
                href={mailtoUrl}
                className="h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
              >
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                <span>Default App</span>
              </a>

              <a
                href={gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
              >
                <ExternalLink className="w-3 h-3 text-red-400" />
                <span>Gmail</span>
              </a>

              <a
                href={outlookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
              >
                <ExternalLink className="w-3 h-3 text-blue-400" />
                <span>Outlook</span>
              </a>
            </div>
          </div>

          {/* Card Micro Footer */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verified Security Desk</span>
            </span>
            <span>Sankara Events</span>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-[11px] text-zinc-500 text-center font-mono">
          Sri Kanchi Kamakoti Medical Trust • Developed by Team IS – MHQ
        </p>
      </main>
    </div>
  );
}
