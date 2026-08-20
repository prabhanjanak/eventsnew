import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import GlitterWrap from "@/components/originkit/ui/glitter-wrap";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const resetPasswordMutation = useResetPassword();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate(
      {
        data: { resetToken: token, newPassword: password },
      },
      {
        onSuccess: () => {
          toast({ title: "Password updated successfully! ✓" });
          setLocation("/login");
        },
        onError: (err: any) => {
          toast({
            title: "Reset Failed",
            description: err.message || "Invalid or expired reset token.",
            variant: "destructive",
          });
        },
      }
    );
  };

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
            <span>Back to Login</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-[11px] font-mono text-zinc-400 tracking-wider">
              Security Gateway
            </span>
          </div>
        </div>
      </header>

      {/* ── Centered Main Content ────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-md mx-auto px-4 py-10 sm:py-16 w-full flex-1 flex flex-col justify-center items-center">
        
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
              Create New Password
            </h1>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Enter your secure password below to regain full workspace access.
            </p>
          </div>
        </div>

        {/* ── Reset Form Card ── */}
        <div className="w-full rounded-2xl bg-[#121319]/90 border border-white/10 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.7)] space-y-5">
          
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            
            {/* New Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">New Password</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">Confirm New Password</Label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  required
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-black/40 border border-white/10 focus:border-white/40 focus:ring-1 focus:ring-white/20 text-white placeholder:text-zinc-600 rounded-xl text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors p-1"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={resetPasswordMutation.isPending}
                className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 border-none"
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Confirm New Password</span>
                )}
              </Button>
            </div>
          </form>

          {/* Micro Footer */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>TLS 1.3 Protected</span>
            </span>
            <span>Sankara Multi-Event Platform</span>
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
