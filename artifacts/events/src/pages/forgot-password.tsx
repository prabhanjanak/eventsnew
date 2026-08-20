import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Mail,
  ShieldCheck,
  Building2,
  ExternalLink,
  User,
} from "lucide-react";
import GlitterWrap from "@/components/originkit/ui/glitter-wrap";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function ForgotPassword() {
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
              Security Helpdesk
            </span>
          </div>
        </div>
      </header>

      {/* ── Centered Main Content ────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-lg mx-auto px-4 py-10 sm:py-16 w-full flex-1 flex flex-col justify-center items-center">
        
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

        {/* ── Administrator Contact Card ── */}
        <div className="w-full rounded-2xl bg-[#121319]/90 border border-white/10 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.7)] space-y-6">
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Contact System Administrator</span>
            </div>

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
                  Primary Admin
                </span>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  <span>prabhanjan@sankaraeye.com</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <Button
              asChild
              className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
            >
              <a href="mailto:prabhanjan@sankaraeye.com?subject=Staff%20Password%20Reset%20Request&body=Hello%20Prabhanjan,%0D%0A%0D%0APlease%20assist%20with%20resetting%20my%20Sankara%20Events%20account%20password.%0D%0A%0D%0AEmployee%20ID:%20%0D%0AName:%20%0D%0ADepartment:%20">
                <Mail className="w-4 h-4 text-zinc-950" />
                <span>Email Administrator for Reset</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-600" />
              </a>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full h-11 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10 font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Link href="/login">
                <ArrowLeft className="w-4 h-4 text-zinc-400" />
                <span>Return to Staff Login</span>
              </Link>
            </Button>
          </div>

          {/* Card Micro Footer */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>Security Protected Access</span>
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
