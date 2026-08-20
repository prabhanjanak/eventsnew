import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Phone, User, Lock, Building, CheckCircle2, AlertCircle } from "lucide-react";

interface UserProfileDialogProps {
  open: boolean;
  onClose: () => void;
  user: any;
  token: string | null;
}

export function UserProfileDialog({ open, onClose, user, token }: UserProfileDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Profile details state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [institution, setInstitution] = useState("");
  const [saving, setSaving] = useState(false);

  // Password Reset state
  const [resetEmail, setResetEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Sync details from prop when opened
  useEffect(() => {
    if (open && user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setMobile(user.mobile || "");
      setInstitution(user.institution || "");
      setResetEmail(user.email || "");
      // Reset verification state
      setOtpSent(false);
      setOtp("");
      setNewPassword("");
    }
  }, [open, user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, mobile, institution }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update profile");
      }

      toast({
        title: "Profile Updated",
        description: "Your basic details have been updated successfully.",
      });
      
      // Invalidate the auth session queries to load new profile details
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendOtp = async () => {
    if (!resetEmail.trim()) {
      toast({ title: "Please enter your email address", variant: "destructive" });
      return;
    }

    setSendingOtp(true);
    try {
      const resp = await fetch("/api/auth/profile/reset-password-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send verification code");
      }

      const res = await resp.json();
      setOtpSent(true);
      toast({
        title: "Code Sent",
        description: res.message || "Check your email for the verification code.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to send code",
        description: err.message || "Make sure SMTP settings are configured.",
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast({ title: "Please enter the verification code", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setVerifyingOtp(true);
    try {
      const resp = await fetch("/api/auth/profile/reset-password-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp, newPassword }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Verification failed");
      }

      toast({
        title: "Password Updated ✓",
        description: "Your password has been successfully updated.",
      });
      setOtpSent(false);
      setOtp("");
      setNewPassword("");
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message || "Invalid or expired code.",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const isParticipant = user?.userType === "participant";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="bg-gradient-to-r from-[#6F42C1] to-[#F58220] px-6 py-5 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-sm shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg font-bold">My Profile</DialogTitle>
              <DialogDescription className="text-white/85 text-xs mt-0.5">
                Update your account details and manage security settings
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Form 1: Edit profile details */}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-1.5">
              Personal Information
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="text-xs font-semibold text-gray-700">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 text-sm focus-visible:ring-[#F58220]"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-mobile" className="text-xs font-semibold text-gray-700">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    id="profile-mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="pl-9 text-sm focus-visible:ring-[#F58220]"
                    placeholder="Enter mobile number"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-email" className="text-xs font-semibold text-gray-700">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-sm focus-visible:ring-[#F58220]"
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              {isParticipant && (
                <div className="space-y-1.5">
                  <Label htmlFor="profile-inst" className="text-xs font-semibold text-gray-700">Institution</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <Input
                      id="profile-inst"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      className="pl-9 text-sm focus-visible:ring-[#F58220]"
                      placeholder="Enter hospital/institution"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#F58220] hover:bg-[#e07010] text-white text-xs font-bold px-4 h-9 shadow-sm"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>

          {/* Form 2: Password Reset flow with OTP */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-1.5">
              Change Security Password
            </h3>

            {!otpSent ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  To reset your password, verify your email address. We will send a 6-digit OTP code to the email address below.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="reset-email" className="text-xs font-semibold text-gray-700">Verification Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-9 text-sm focus-visible:ring-[#6F42C1]"
                        placeholder="test@sankaraeye.com"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                    className="bg-[#6F42C1] hover:bg-[#5a35a0] text-white text-xs font-bold h-10 shadow-sm gap-1.5"
                  >
                    {sendingOtp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    Send OTP Code
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-[#f8f5ff] border border-[#6F42C1]/20 rounded-xl p-4 space-y-4">
                <div className="flex items-start gap-2.5 text-xs text-[#6F42C1]">
                  <CheckCircle2 className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Verification code sent!</span> Check your inbox at <span className="font-mono">{resetEmail}</span>.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-otp" className="text-xs font-semibold text-[#6F42C1]">Enter 6-Digit OTP</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input
                        id="reset-otp"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        maxLength={6}
                        className="pl-9 text-sm font-mono tracking-wider focus-visible:ring-[#6F42C1]"
                        placeholder="123456"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reset-password" className="text-xs font-semibold text-[#6F42C1]">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input
                        id="reset-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-9 text-sm focus-visible:ring-[#6F42C1]"
                        placeholder="Min 6 characters"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOtpSent(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Change Email
                  </Button>
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp}
                    className="bg-[#6F42C1] hover:bg-[#5a35a0] text-white text-xs font-bold px-4 h-9 shadow-sm"
                  >
                    {verifyingOtp && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    Verify &amp; Update Password
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
