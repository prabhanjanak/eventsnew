import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  Shield,
} from "lucide-react";
import { ThreeAmbientScene } from "@/components/3d/three-ambient-scene";
import { PerspectiveCard } from "@/components/3d/perspective-card";
import { Sankara3DEmblem } from "@/components/3d/sankara-3d-emblem";

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
    <div className="relative min-h-screen bg-[#08080A] text-zinc-100 flex flex-col font-sans overflow-x-hidden selection:bg-white/20 selection:text-white">
      {/* ── 3D AMBIENT PARTICLE CANVAS (THREE.JS) ───────────────────────────── */}
      <ThreeAmbientScene particleCount={90} className="fixed inset-0 pointer-events-none z-0 opacity-70" />

      {/* Atmospheric Background Radial Lighting */}
      <div className="fixed top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[400px] bg-purple-600/10 blur-[140px] rounded-full pointer-events-none z-0" />

      {/* ── TOP MINIMAL HEADER ──────────────────────────────────────────────── */}
      <header className="border-b border-[#1F1F24]/80 bg-[#0C0C0E]/80 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-all cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Events</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
              Coordinator Gateway
            </span>
          </div>
        </div>
      </header>

      {/* ── MAIN 3D LOGIN STAGE ────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-md mx-auto px-4 py-8 sm:py-12 w-full flex-1 flex flex-col justify-center items-center space-y-6">
        
        {/* Floating 3D Emblem Header */}
        <div className="text-center space-y-2">
          <Sankara3DEmblem size="md" showTagline={false} />
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Coordinator Login
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Enter your official staff credentials to access administrative dashboard.
          </p>
        </div>

        {/* ── 3D PERSPECTIVE CARD WITH HOLOGRAPHIC TILT ─────────────────────── */}
        <PerspectiveCard
          depth={16}
          elevateOnHover={true}
          glareEffect={true}
          className="w-full rounded-xl bg-[#121216]/95 border border-[#26262D] backdrop-blur-2xl p-6 sm:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.85)] space-y-5 relative overflow-hidden"
        >
          {/* Top Holographic Laser Accent */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-white/80 to-transparent" />

          {/* Form */}
          <form onSubmit={handleStaffLogin} autoComplete="off" autoCorrect="off" spellCheck={false} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-300">Employee ID / Username *</Label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  placeholder="e.g. 010177 or username"
                  value={staffIdentifier}
                  onChange={(e) => setStaffIdentifier(e.target.value)}
                  className="pl-10 h-11 bg-[#09090C] border-[#26262D] focus:border-white text-white placeholder:text-zinc-600 rounded-lg text-xs sm:text-sm font-mono tracking-wide shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-zinc-300">Password *</Label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-zinc-400 hover:text-white transition-colors"
                >
                  Forgot?
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
                  data-lpignore="true"
                  placeholder="••••••••••••"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-[#09090C] border-[#26262D] focus:border-white text-white placeholder:text-zinc-600 rounded-lg text-xs sm:text-sm shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs sm:text-sm shadow-xl cursor-pointer border-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Sign In as Coordinator</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Card Footer Security Micro-badge */}
          <div className="pt-3 border-t border-[#1C1C22] flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-zinc-400" /> End-to-End Encrypted
            </span>
            <span>Sankara v2026.1</span>
          </div>
        </PerspectiveCard>

        {/* Bottom Hospital Copyright */}
        <p className="text-[11px] text-zinc-500 text-center font-mono">
          Sri Kanchi Kamakoti Medical Trust • Developed by Team IS - MHQ
        </p>
      </main>
    </div>
  );
}
