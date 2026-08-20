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
  ShieldCheck,
} from "lucide-react";
import { ThreeAmbientScene } from "@/components/3d/three-ambient-scene";

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
    <div className="relative min-h-screen bg-[#09090C] text-zinc-100 flex flex-col font-sans overflow-x-hidden selection:bg-white/20 selection:text-white">
      {/* ── 3D Ambient Mesh Particle Scene (Subtle, Deep Darkness) ──────────── */}
      <ThreeAmbientScene particleCount={60} className="fixed inset-0 pointer-events-none z-0 opacity-40" />

      {/* ── Soft Deep Atmospheric Lighting (Subtle Indigo/Slate, Zero Muddy Orange) ── */}
      <div className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-950/20 blur-[130px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[350px] bg-slate-900/30 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-[#0C0D12]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Events Directory</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-[11px] font-mono text-zinc-400 tracking-wider">
              Staff Portal
            </span>
          </div>
        </div>
      </header>

      {/* ── Centered Login Main Card ────────────────────────────────────────── */}
      <main className="relative z-10 max-w-md mx-auto px-4 py-8 sm:py-12 w-full flex-1 flex flex-col justify-center items-center">
        
        {/* ── Official Sankara Eye Foundation & 50-Year Emblem Header ── */}
        <div className="text-center space-y-4 flex flex-col items-center mb-6">
          
          {/* Dual Emblem Banner: Sankara Eye + 50 Year Jubilee */}
          <div className="flex items-center justify-center gap-4">
            {/* Sankara Eye Emblem in Frosted Circle */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#141622]/90 border border-white/15 p-3 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl group hover:border-white/30 transition-all">
              <img
                src={`${BASE_URL}/sankara-eye-logo.png`}
                alt="Sankara Eye Foundation Icon"
                className="w-full h-full object-contain filter brightness-110 drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
              />
            </div>

            {/* 50 Years Coin Emblem */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)] border border-amber-400/40 bg-[#001D4A] p-0 flex items-center justify-center">
              <img
                src={`${BASE_URL}/sankara-50th-logo.png`}
                alt="50 Years Social Impact"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Institutional Title & Subtitle */}
          <div className="space-y-1">
            <div className="text-xs font-bold tracking-widest text-indigo-400 uppercase font-mono">
              Sankara Eye Foundation
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Coordinator & Staff Access
            </h1>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Enter your official credentials to access the event management system.
            </p>
          </div>
        </div>

        {/* ── Clean Obsidian Glassmorphic Container ── */}
        <div className="w-full rounded-2xl bg-[#121319]/90 border border-white/10 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.7)] space-y-5">
          
          <form onSubmit={handleStaffLogin} autoComplete="off" autoCorrect="off" spellCheck={false} className="space-y-4">
            
            {/* Employee ID */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">Employee ID / Username</Label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="e.g. 010177 or username"
                  value={staffIdentifier}
                  onChange={(e) => setStaffIdentifier(e.target.value)}
                  className="pl-10 pr-4 h-11 bg-black/40 border border-white/10 focus:border-white/40 focus:ring-1 focus:ring-white/20 text-white placeholder:text-zinc-600 rounded-xl text-sm font-mono transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-zinc-300">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="••••••••••••"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-black/40 border border-white/10 focus:border-white/40 focus:ring-1 focus:ring-white/20 text-white placeholder:text-zinc-600 rounded-xl text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 border-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In to Workspace</span>
                )}
              </Button>
            </div>
          </form>

          {/* Micro Footer Inside Card */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Encrypted Session</span>
            </span>
            <span>Sankara v3.0</span>
          </div>
        </div>

        {/* Bottom Footer */}
        <p className="mt-8 text-[11px] text-zinc-500 text-center font-mono">
          Sri Kanchi Kamakoti Medical Trust • Developed by Team IS – MHQ
        </p>
      </main>
    </div>
  );
}
