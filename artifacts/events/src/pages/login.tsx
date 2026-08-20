import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ThreeAmbientScene } from "@/components/3d/three-ambient-scene";
import { PerspectiveCard } from "@/components/3d/perspective-card";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function Login() {
  const [staffIdentifier, setStaffIdentifier] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login: setAuthContext } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffIdentifier.trim() || !staffPassword) {
      toast({ title: "Please enter Staff ID and Password", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: staffIdentifier.trim(),
          password: staffPassword,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        toast({
          title: "Authentication Failed",
          description: data.message ?? data.error ?? "Invalid employee ID or password.",
          variant: "destructive",
        });
        return;
      }

      const mustChange = data.mustChangePassword ?? false;
      setAuthContext(data.token, data.user, mustChange);
      if (!mustChange) {
        toast({ title: `Welcome, ${data.user.name}! ✓` });
        setLocation("/admin/dashboard");
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#070709] text-zinc-100 flex flex-col font-sans overflow-x-hidden selection:bg-orange-500/30 selection:text-orange-200">
      {/* ── 3D AMBIENT PARTICLE CANVAS (THREE.JS) ───────────────────────────── */}
      <ThreeAmbientScene particleCount={85} className="fixed inset-0 pointer-events-none z-0 opacity-60" />

      {/* ── RADIANT ORANGE & SUNSET NEON BACKDROP GLOWS ────────────────────── */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[900px] h-[550px] bg-gradient-to-tr from-orange-600/25 via-amber-500/20 to-orange-500/10 blur-[130px] rounded-full pointer-events-none z-0 animate-pulse duration-1000" />
      <div className="fixed top-[15%] left-[20%] w-[450px] h-[350px] bg-orange-500/15 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[10%] right-[20%] w-[500px] h-[400px] bg-amber-600/15 blur-[140px] rounded-full pointer-events-none z-0" />

      {/* ── TOP MINIMAL HEADER ──────────────────────────────────────────────── */}
      <header className="border-b border-orange-500/10 bg-[#0A0A0E]/80 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-all cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 text-orange-400" />
            <span>Back to Events Directory</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span className="text-[10px] font-mono font-bold text-orange-300 uppercase tracking-widest">
              Staff Gateway
            </span>
          </div>
        </div>
      </header>

      {/* ── MAIN 3D LOGIN STAGE ────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-lg mx-auto px-4 py-8 sm:py-12 w-full flex-1 flex flex-col justify-center items-center space-y-6">
        
        {/* ── 50 YEARS JUBILEE EMBLEM HEADER ───────────────────────────────── */}
        <div className="text-center space-y-3 flex flex-col items-center">
          <div className="relative group">
            {/* Ambient Orange Glow behind Logo */}
            <div className="absolute -inset-3 bg-gradient-to-r from-orange-500/40 via-amber-400/40 to-orange-600/40 rounded-full blur-xl opacity-75 group-hover:opacity-100 transition-all duration-700 pointer-events-none" />
            
            {/* 50 Year Official Logo Container */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1.5 bg-gradient-to-b from-orange-400/50 via-amber-500/30 to-black/80 border border-orange-400/40 shadow-[0_0_35px_rgba(255,122,0,0.35)] flex items-center justify-center backdrop-blur-md">
              <img
                src={`${BASE_URL}/sankara-50th-logo.png`}
                alt="Sankara 50 Years Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-mono font-semibold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Celebrating 50 Glorious Years • 1977–2027</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Coordinator & Staff Access
            </h1>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Enter your official employee credentials to access the administrative control center.
            </p>
          </div>
        </div>

        {/* ── 3D PERSPECTIVE CARD WITH ORANGE NEON GLOW ─────────────────────── */}
        <PerspectiveCard
          depth={14}
          elevateOnHover={true}
          glareEffect={true}
          className="w-full rounded-3xl bg-[#0F0F14]/90 border border-orange-500/25 backdrop-blur-3xl p-6 sm:p-8 shadow-[0_0_70px_rgba(255,107,0,0.18),0_30px_90px_rgba(0,0,0,0.9)] space-y-6 relative overflow-hidden"
        >
          {/* Top Neon Laser Accent Bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-orange-500 via-amber-400 to-transparent shadow-[0_0_15px_#FF7A00]" />

          {/* Form */}
          <form onSubmit={handleStaffLogin} autoComplete="off" autoCorrect="off" spellCheck={false} className="space-y-5">
            
            {/* Employee ID / Username Input Box */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-zinc-200 tracking-wide flex items-center justify-between">
                <span>Employee ID / Username</span>
                <span className="text-orange-400 text-[10px] font-mono font-normal">* Required</span>
              </Label>
              <div className="relative group/field">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-zinc-500 group-focus-within/field:text-orange-400 transition-colors">
                  <User className="w-4 h-4" />
                </div>
                <Input
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  placeholder="e.g. 010177 or username"
                  value={staffIdentifier}
                  onChange={(e) => setStaffIdentifier(e.target.value)}
                  className="pl-11 pr-4 h-12 bg-black/60 border border-white/10 hover:border-orange-500/40 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white placeholder:text-zinc-600 rounded-2xl text-xs sm:text-sm font-mono tracking-wide shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] transition-all duration-300"
                />
              </div>
            </div>

            {/* Password Input Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-zinc-200 tracking-wide">
                  <span>Password</span>
                  <span className="text-orange-400 text-[10px] font-mono font-normal ml-1.5">* Required</span>
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-medium text-orange-400/90 hover:text-orange-300 transition-colors hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative group/field">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-zinc-500 group-focus-within/field:text-orange-400 transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  placeholder="••••••••••••"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="pl-11 pr-11 h-12 bg-black/60 border border-white/10 hover:border-orange-500/40 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white placeholder:text-zinc-600 rounded-2xl text-xs sm:text-sm shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] transition-all duration-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-orange-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Neon Gradient Action Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-400 hover:via-amber-400 hover:to-orange-400 text-zinc-950 font-black text-xs sm:text-sm shadow-[0_6px_30px_rgba(255,107,0,0.45)] cursor-pointer border-none transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span className="text-zinc-950 font-black">Authenticating Credentials...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-zinc-950" />
                    <span className="text-zinc-950 font-black">Sign In to Dashboard</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Card Footer Security Micro-badge */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
              <span>TLS 1.3 Protected Gateway</span>
            </span>
            <span className="text-zinc-400">v3.0.4 • 50th Edition</span>
          </div>
        </PerspectiveCard>

        {/* Bottom Hospital Copyright */}
        <p className="text-[11px] text-zinc-400 text-center font-mono">
          Sri Kanchi Kamakoti Medical Trust • Developed by Team IS – MHQ
        </p>
      </main>
    </div>
  );
}
