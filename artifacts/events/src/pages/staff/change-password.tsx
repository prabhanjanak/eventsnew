import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ShieldCheck, Calendar, MapPin, Loader2, Eye, EyeOff, Lock, User } from "lucide-react";
import bannerImg from "@assets/headerwebfinal.png";
import sankaraLogo from "/sankara-logo.png";
import { PasscodeInput } from "@/components/ui/passcode-input";

const MILESTONES = [
  { value: "3M+", label: "Free Eye Surgeries" },
  { value: "50", label: "Years of Social Impact" },
  { value: "1977", label: "Founded Since" },
];

export default function StaffChangePassword() {
  const { user, token, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (currentPassword.length < 6) {
      toast({ title: "Incorrect Length", description: "Current password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    const pinRegex = /^\d{6}$/;
    if (!pinRegex.test(newPassword)) {
      toast({ title: "Invalid PIN", description: "New PIN must be exactly 6 numeric digits.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "PINs do not match", variant: "destructive" });
      return;
    }
    if (newPassword === "111111" || newPassword === "222222" || newPassword === "333333" || newPassword === "123456") {
      toast({ title: "Choose a stronger PIN", description: "Please set a unique PIN instead of a common sequential/repeated one.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch("/api/auth/staff/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to change password");
      }

      toast({ title: "Password changed", description: "Your new password is active. Please log in again." });

      // Force re-login for security
      setTimeout(() => {
        logout();
      }, 1500);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const roleLabel = user
    ? user.userType === "admin"
      ? "Admin"
      : user.userType === "track_coordinator"
      ? "Track Coordinator"
      : user.userType === "food_coordinator"
      ? "Food Coordinator"
      : user.userType === "scientific_committee"
      ? "Scientific Committee"
      : "User"
    : "Staff";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0d1b3e] via-[#1a2f5a] to-[#0d1b3e] relative overflow-hidden">
      {/* Decorative background circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F58220]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#6F42C1]/15 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Banner */}
      <div className="w-full bg-white border-b border-white/5 flex justify-center py-4">
        <img
          src={bannerImg}
          alt="Vision 2020 Conference Banner"
          className="max-h-20 md:max-h-24 object-contain px-4"
        />
      </div>

      {/* Info strip */}
      <div className="relative bg-gradient-to-r from-[#F58220] via-[#d4620e] to-[#6F42C1] py-2.5 px-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-4 text-white text-sm font-medium">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 opacity-90" />
            <span>10 – 12 July 2026</span>
          </div>
          <div className="w-px h-3.5 bg-white/40 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 opacity-90" />
            <span>Sankara Eye Hospital, Bangalore</span>
          </div>
          <div className="w-px h-3.5 bg-white/40 hidden sm:block" />
          <span className="opacity-90 font-semibold tracking-wide">Sankara Eye Foundation India</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center py-8 px-4">
        <div
          className={`w-full max-w-4xl transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left — branding panel */}
            <div className="text-white space-y-7 text-center lg:text-left px-2">
              <div className="flex justify-center lg:justify-start items-center gap-6">
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-white/20 blur-xl scale-110 group-hover:scale-125 transition-transform duration-500" />
                  <img
                    src={sankaraLogo}
                    alt="Sankara Eye Foundation India"
                    className="relative w-24 h-24 object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-white/20 blur-xl scale-110 group-hover:scale-125 transition-transform duration-500" />
                  <img
                    src="/sankara-50th-logo.png"
                    alt="Sankara 50 Years Logo"
                    className="relative w-24 h-24 object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>

              <div>
                <p className="text-[#F58220] font-semibold text-sm tracking-widest uppercase mb-1">Sankara Healthcare Events</p>
                <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                  Sankara Eye<br />Foundation
                </h1>
                <p className="text-white/60 mt-2 text-sm leading-relaxed">
                  Caring for sight across India — from clinical excellence to community outreach.
                </p>
              </div>

              {/* Milestones */}
              <div className="grid grid-cols-3 gap-3">
                {MILESTONES.map((m) => (
                  <div
                    key={m.value}
                    className="bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 hover:border-white/20 rounded-xl p-3 text-center transition-all duration-300 group cursor-default"
                  >
                    <div className="text-xl font-extrabold text-[#F58220] group-hover:scale-110 transition-transform duration-300 inline-block">
                      {m.value}
                    </div>
                    <div className="text-white/70 text-[10px] mt-0.5 leading-tight font-medium">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — form card */}
            <div
              className="bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_8px_60px_rgba(245,130,32,0.15)] animate-in fade-in duration-300"
            >
              {/* Card top accent */}
              <div className="h-1.5 bg-gradient-to-r from-[#F58220] via-[#e88a40] to-[#6F42C1]" />

              <div className="px-8 pt-7 pb-2">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F58220] to-[#e07010] flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <KeyRound className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg leading-none">Security Setup</h2>
                    <p className="text-white/50 text-xs mt-0.5">Change Your Password</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 space-y-4">
                {user && (
                  <p className="text-white/70 text-xs leading-relaxed">
                    Welcome, <strong className="text-[#F58220]">{user.name}</strong> ({roleLabel}). Your account requires a new password before you can continue.
                  </p>
                )}

                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-3 flex gap-2 text-xs leading-relaxed">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>Your temporary password must be changed to access the conference portal.</span>
                </div>

                 <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#F58220]" />
                      Current / Temporary Password
                    </Label>
                    <div className="relative">
                      <Input
                        type={showCurrent ? "text" : "password"}
                        placeholder="Enter current temporary password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder-white/30 rounded-xl pr-10 focus:border-[#F58220] focus:ring-1 focus:ring-[#F58220]"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                        onClick={() => setShowCurrent(!showCurrent)}
                      >
                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-white/10">
                    <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#F58220]" />
                      Set New 6-Digit PIN
                    </Label>
                    <PasscodeInput value={newPassword} onChange={setNewPassword} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#F58220]" />
                      Confirm New 6-Digit PIN
                    </Label>
                    <PasscodeInput value={confirmPassword} onChange={setConfirmPassword} />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-[#F58220] to-[#e07010] hover:from-[#ff9235] hover:to-[#F58220] text-white font-semibold rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] mt-2"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Changing…
                      </>
                    ) : (
                      "Change Password"
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>

          <p className="text-center text-white/25 text-xs mt-8">
            Sankara Eye Foundation India · Events Management Portal
          </p>
        </div>
      </div>
    </div>
  );
}
