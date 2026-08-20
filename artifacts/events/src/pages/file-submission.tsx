import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  MapPin,
  Upload,
  User,
  Lock,
  Check,
  ArrowRight,
  Search,
  FileText,
  Image,
  AlertTriangle,
  Loader2,
  Trash2,
  CheckCircle,
  HelpCircle,
  Home,
  MessageSquare,
  Smartphone,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  Edit2,
  Save,
  X,
  Download,
  Layers
} from "lucide-react";
import bannerImg from "@assets/headerwebfinal.png";
import sankaraLogo from "/sankara-logo.png";
import { getCache, setCache } from "@/lib/indexeddb-cache";
import { OtpInput } from "@/components/ui/otp-input";

type LookupItem = {
  id: number;
  name: string;
  registrationNumber: string;
  institution: string;
  maskedEmail: string;
  maskedMobile: string;
  roles: string[];
  needsPPT: boolean;
  needsPoster: boolean;
  hasPassword?: boolean;
};

type AssignmentWithFile = {
  id: number;
  participantId: number;
  role: string;
  track: string;
  sessionName: string | null;
  hall: string | null;
  date: string | null;
  time: string | null;
  presentationTitle: string | null;
  fileId: number | null;
  uploadedFile: {
    id: number;
    filename: string;
    originalName: string;
    fileType: string;
    size: number | null;
    version: number;
    uploadedAt: string;
  } | null;
};

export default function FileSubmissionPortal() {
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [emailAddress, setEmailAddress] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<LookupItem | null>(null);

  // Portal Status
  const [portalStatus, setPortalStatus] = useState<{ open: boolean; deadlineStr: string; submissionsOpen: boolean; isPastDeadline: boolean } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // OTP State
  const [sendTo, setSendTo] = useState<"email" | "whatsapp" | "sms">("whatsapp");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Password / Login State
  const [passwordValue, setPasswordValue] = useState("");
  const [loggingInWithPassword, setLoggingInWithPassword] = useState(false);
  const [showOtpFallback, setShowOtpFallback] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  // Participant Data from DB (after OTP verification)
  const [participantData, setParticipantData] = useState<{
    id: number;
    name: string;
    registrationNumber: string;
    institution: string;
    assignments: AssignmentWithFile[];
  } | null>(null);

  // Upload States
  const [pptFile, setPptFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMode, setSuccessMode] = useState(false);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  // Editing state
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  const handleSaveTitle = async (assignmentId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ presentationTitle: editTitleValue })
      });
      if (res.ok) {
        const updated = await res.json();
        setParticipantData((prev: any) => prev ? {
          ...prev,
          assignments: prev.assignments.map((a: any) => a.id === assignmentId ? { ...a, presentationTitle: updated.presentationTitle } : a)
        } : prev);
        toast({ title: "Updated", description: "Presentation title saved." });
        setEditingTitleId(null);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Portal status check on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const cacheKey = "portal_status";
        let data = await getCache<{ open: boolean; deadlineStr: string; submissionsOpen: boolean; isPastDeadline: boolean }>(cacheKey);

        if (!data) {
          const resp = await fetch("/api/submissions/status");
          if (resp.ok) {
            data = await resp.json();
            if (data) {
              await setCache(cacheKey, data, 5 * 60 * 1000); // cache 5 min
            }
          }
        }

        if (data) {
          setPortalStatus(data);
        }
      } catch (err) {
        console.error("Failed to check portal status:", err);
      } finally {
        setLoadingStatus(false);
      }
    }
    checkStatus();
  }, []);

  const handleEmailLookup = async () => {
    const identifier = emailAddress.trim();
    if (!identifier) {
      toast({
        title: "Validation Error",
        description: "Please enter your registered Email, Mobile, or Reg No.",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      const resp = await fetch(`/api/submissions/lookup?identifier=${encodeURIComponent(identifier)}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Lookup failed. Please check your registered details.");
      }
      const data = await resp.json();
      if (data.length === 0) {
        toast({
          title: "Not Found",
          description: "No participant with presentation assignments found for this identifier. Please check or contact support.",
          variant: "destructive",
        });
      } else {
        const p = data[0];
        setSelectedUser(p);
        setSendTo(p.mobile ? "whatsapp" : "email");
        setOtpSent(false);
        setOtpCode("");
        setPasswordValue("");
        setShowOtpFallback(false);
        setShowPasswordSetup(false);
        setNewPassword("");
        setConfirmNewPassword("");
      }
    } catch (err: any) {
      toast({
        title: "Search Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!selectedUser || !passwordValue.trim()) return;

    setLoggingInWithPassword(true);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: selectedUser.registrationNumber,
          password: passwordValue.trim(),
          userType: "participant",
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Incorrect password. Please try again.");
      }

      setToken(data.token);
      localStorage.setItem("vision2020_token", data.token);

      // Fetch complete participant assignments and previous files
      const partResp = await fetch(`/api/participants/${selectedUser.id}`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (partResp.ok) {
        const partData = await partResp.json();
        setParticipantData(partData);
        toast({ title: "Logged In Successfully", description: `Welcome back, ${partData.name ?? "Faculty"}.` });
        setStep(2);
      } else {
        throw new Error("Failed to load details");
      }
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoggingInWithPassword(false);
    }
  };

  const handleSetPassword = async () => {
    const cleanPw = newPassword.trim();
    if (cleanPw.length !== 6 || !/^\d{6}$/.test(cleanPw)) {
      toast({ title: "Validation Error", description: "Passcode must be exactly 6 digits", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Validation Error", description: "Passcodes do not match", variant: "destructive" });
      return;
    }

    setSettingPassword(true);
    try {
      const url = token ? "/api/auth/set-password" : "/api/auth/initialize-passcode";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          participantId: selectedUser?.id,
          password: cleanPw,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to set passcode");
      }
      if (data.token) {
        setToken(data.token);
        localStorage.setItem("vision2020_token", data.token);

        // Fetch participant details/schedule using the new token
        if (selectedUser) {
          const partResp = await fetch(`/api/participants/${selectedUser.id}`, {
            headers: { Authorization: `Bearer ${data.token}` },
          });
          if (partResp.ok) {
            const partData = await partResp.json();
            setParticipantData(partData);
          } else {
            throw new Error("Failed to load details");
          }
        }
      }
      toast({ title: "Passcode Set", description: "Your login passcode has been configured successfully." });
      setShowPasswordSetup(false);
      if (selectedUser) {
        setSelectedUser({
          ...selectedUser,
          hasPassword: true,
        });
      }
      setStep(2);
    } catch (err: any) {
      toast({
        title: "Save Password Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSettingPassword(false);
    }
  };

  const handleSendOTP = async () => {
    if (!selectedUser) return;

    setSendingOtp(true);
    try {
      const resp = await fetch("/api/submissions/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: selectedUser.id,
          sendTo: sendTo,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setOtpSent(true);
      toast({ title: "OTP Sent", description: data.message });
    } catch (err: any) {
      toast({
        title: "Send OTP Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!selectedUser || !otpCode.trim()) return;

    setVerifyingOtp(true);
    try {
      const resp = await fetch("/api/submissions/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: selectedUser.id,
          otp: otpCode.trim(),
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setToken(data.token);
      localStorage.setItem("vision2020_token", data.token);

      // Fetch complete participant assignments and previous files
      const partResp = await fetch(`/api/participants/${selectedUser.id}`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (partResp.ok) {
        const partData = await partResp.json();
        setParticipantData(partData);
        toast({ title: "Identity Verified", description: `Welcome back, ${partData.name}.` });
        
        if (selectedUser.hasPassword && !showOtpFallback) {
          setShowPasswordSetup(false);
          setStep(2);
        } else {
          setShowPasswordSetup(true);
        }
      } else {
        throw new Error("Failed to load details");
      }
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message || "Incorrect code, please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleFileChange = (type: "ppt" | "poster", file: File | null) => {
    if (!file) {
      if (type === "ppt") setPptFile(null);
      else setPosterFile(null);
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (type === "ppt") {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "pptx") {
        toast({ title: "Invalid File Format", description: "Presenters must upload .pptx presentation slides only.", variant: "destructive" });
        return;
      }
      if (sizeMB > 15) {
        toast({ title: "File Too Large", description: "Presentation slides must be under 15 MB.", variant: "destructive" });
        return;
      }
      setPptFile(file);
    } else {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "jpg" && ext !== "jpeg") {
        toast({ title: "Invalid File Format", description: "Poster presenters must upload .jpg or .jpeg images only.", variant: "destructive" });
        return;
      }
      if (sizeMB > 20) {
        toast({ title: "File Too Large", description: "Poster JPG images must be under 20 MB.", variant: "destructive" });
        return;
      }
      setPosterFile(file);
    }
  };

  const handleSubmissionsSubmit = async () => {
    if (!participantData || !token) return;

    setSubmitting(true);
    try {
      // Find assignment IDs
      const pptAssignment = participantData.assignments.find((a) => a.role !== "Poster");
      const posterAssignment = participantData.assignments.find((a) => a.role === "Poster");

      if (selectedUser?.needsPPT && !pptFile && !pptAssignment?.uploadedFile) {
        throw new Error("Please select your presentation PPTX file.");
      }
      if (selectedUser?.needsPoster && !posterFile && !posterAssignment?.uploadedFile) {
        throw new Error("Please select your poster JPG file.");
      }

      // Perform PPT Upload
      if (pptFile && pptAssignment) {
        const formData = new FormData();
        formData.append("file", pptFile);
        const res = await fetch(`/api/assignments/${pptAssignment.id}/file`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to upload PPTX slides.");
        }
      }

      // Perform Poster Upload
      if (posterFile && posterAssignment) {
        const formData = new FormData();
        formData.append("file", posterFile);
        const res = await fetch(`/api/assignments/${posterAssignment.id}/file`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to upload Poster JPG.");
        }
      }

      // Generate Reference Code
      const code = `V2020-${Math.floor(100000 + Math.random() * 900000)}`;
      setSuccessRef(code);

      toast({ title: "Submission Received!", description: "Files uploaded successfully." });
      setStep(5);

      // Clear authentication cookie/session token
      localStorage.removeItem("vision2020_token");
      setToken(null);
    } catch (err: any) {
      toast({
        title: "Submission Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1b3e]">
        <Loader2 className="w-12 h-12 animate-spin text-[#F58220]" />
      </div>
    );
  }

  if (portalStatus && !portalStatus.open) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0d1b3e] via-[#1a2f5a] to-[#0d1b3e] relative overflow-hidden font-sans">
        <div className="w-full bg-white border-b border-white/5 flex justify-center py-4 shrink-0">
          <img src={bannerImg} alt="Vision 2020 Conference Banner" className="max-h-16 md:max-h-20 object-contain px-4" />
        </div>
        <div className="flex-1 flex items-center justify-center py-10 px-4">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-4 sm:p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100 mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900">Submissions Closed</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                The file submission portal closed on <strong className="text-gray-800">{portalStatus.deadlineStr}</strong>.
              </p>
            </div>
            <p className="text-xs text-gray-400 leading-normal max-w-sm mx-auto">
              If you have formatting modifications, need to overwrite your files, or missed the deadline, please reach out to the conference secretariat directly at <a href="mailto:events@sankaraeye.com" className="text-orange-500 underline font-semibold">events@sankaraeye.com</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0d1b3e] via-[#1a2f5a] to-[#0d1b3e] relative overflow-hidden font-sans">
      {/* Decorative BG circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F58220]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#6F42C1]/15 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

      {/* Banner */}
      <div className="w-full bg-white border-b border-white/5 flex justify-between items-center py-4 px-6 shrink-0">
        <img
          src={bannerImg}
          alt="Vision 2020 Conference Banner"
          className="max-h-16 md:max-h-20 object-contain"
        />
        <div className="flex gap-2">
          <Link href="/tracks" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F58220] hover:text-[#e07010] transition-colors border border-orange-100 px-3.5 py-1.5 rounded-xl shadow-sm bg-white font-Outfit">
            <Layers className="w-3.5 h-3.5" />
            <span>Track Agenda</span>
          </Link>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0d1b3e] hover:text-[#F58220] transition-colors border border-gray-200 px-3 py-1.5 rounded-xl shadow-sm bg-white">
            <Home className="w-3.5 h-3.5" />
            <span>Home Portal</span>
          </Link>
        </div>
      </div>

      {/* Info Strip */}
      <div className="relative bg-gradient-to-r from-[#F58220] via-[#d4620e] to-[#6F42C1] py-2.5 px-4 shadow-lg shrink-0">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-4 text-white text-xs font-semibold">
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
          <span className="opacity-95 tracking-wide">Secure File Submission Portal</span>
        </div>
      </div>

      {/* Step Progress Bar */}
      {step < 5 && (
        <div className="w-full bg-white/5 border-b border-white/5 py-4 shrink-0">
          <div className="max-w-xl mx-auto px-6 flex items-center justify-between text-xs text-white/50 font-medium">
            <div className={`flex items-center gap-2 ${step >= 1 ? "text-[#F58220]" : ""}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? "bg-[#F58220] text-white" : "bg-white/10"}`}>1</span>
              <span>Verify</span>
            </div>
            <div className="flex-1 h-px bg-white/10 mx-3" />
            <div className={`flex items-center gap-2 ${step >= 2 ? "text-[#F58220]" : ""}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? "bg-[#F58220] text-white" : "bg-white/10"}`}>2</span>
              <span>Schedule</span>
            </div>
            <div className="flex-1 h-px bg-white/10 mx-3" />
            <div className={`flex items-center gap-2 ${step >= 3 ? "text-[#F58220]" : ""}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? "bg-[#F58220] text-white" : "bg-white/10"}`}>3</span>
              <span>Upload</span>
            </div>
            <div className="flex-1 h-px bg-white/10 mx-3" />
            <div className={`flex items-center gap-2 ${step >= 4 ? "text-[#F58220]" : ""}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 4 ? "bg-[#F58220] text-white" : "bg-white/10"}`}>4</span>
              <span>Review</span>
            </div>
          </div>
        </div>
      )}

      {/* Content wrapper */}
      <div className="flex-1 flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col justify-between min-h-[460px]">
          {/* Card Accent */}
          <div className="h-1.5 bg-gradient-to-r from-[#F58220] via-[#e88a40] to-[#6F42C1] shrink-0" />
          
          {/* STEP 1: VERIFICATION */}
          {step === 1 && (
            <div className="p-4 sm:p-8 flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <img src={sankaraLogo} alt="Sankara Logo" className="w-12 h-12 object-contain" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 leading-tight">Presenter Upload Portal</h2>
                    <p className="text-gray-400 text-xs mt-0.5">Enter your registered email address to view your schedule &amp; upload PPT / Poster</p>
                  </div>
                </div>

                {showPasswordSetup ? (
                  <div className="space-y-4">
                    <div className="space-y-1 text-center pb-2">
                      <h3 className="text-sm font-bold text-gray-800">Set your 6-digit Login Passcode</h3>
                      <p className="text-xs text-gray-400">
                        Create a 6-digit numeric passcode to access the portal directly next time.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-750 block text-center">Choose 6-Digit Passcode</Label>
                      <OtpInput
                        value={newPassword}
                        onChange={setNewPassword}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-750 block text-center">Confirm 6-Digit Passcode</Label>
                      <OtpInput
                        value={confirmNewPassword}
                        onChange={setConfirmNewPassword}
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => {
                          setShowPasswordSetup(false);
                          setSelectedUser(null);
                        }}
                        className="flex-1 h-12 rounded-xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSetPassword}
                        disabled={settingPassword || newPassword.length !== 6 || confirmNewPassword.length !== 6}
                        className="flex-[2] bg-[#F58220] hover:bg-[#e07010] text-white font-bold h-12 rounded-xl transition-all"
                      >
                        {settingPassword ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : null}
                        Save Passcode
                      </Button>
                    </div>
                  </div>
                ) : !selectedUser ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email-input" className="text-gray-700 font-semibold text-sm">
                        Registered Email Address / Mobile / Reg No
                      </Label>
                      <div className="relative">
                        <Input
                          id="email-input"
                          type="text"
                          placeholder="Enter registered email, mobile or Reg No"
                          value={emailAddress}
                          onChange={(e) => setEmailAddress(e.target.value)}
                          className="h-12 rounded-xl border-gray-200 font-semibold text-sm text-gray-800"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Enter the registered email, mobile number, or registration number associated with your presentation.
                      </p>
                    </div>

                    <Button
                      onClick={handleEmailLookup}
                      disabled={searching}
                      className="w-full bg-[#F58220] hover:bg-[#e07010] text-white font-bold h-12 rounded-xl transition-all gap-2"
                    >
                      {searching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      Proceed →
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* User profile details */}
                    <div className="p-4 rounded-xl bg-orange-50/40 border border-orange-100/50 flex flex-col gap-2 relative">
                      <button
                        onClick={() => setSelectedUser(null)}
                        className="absolute right-3.5 top-3.5 text-xs font-semibold text-orange-600 hover:text-orange-800 underline"
                      >
                        Change Email
                      </button>
                      <span className="text-sm font-bold text-gray-900">Welcome Back!</span>
                      <span className="text-xs text-gray-500">Email: {selectedUser.maskedEmail}</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {selectedUser.roles.map((r) => (
                          <span key={r} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Password Login or OTP Fallback */}
                    {selectedUser.hasPassword && !showOtpFallback ? (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="space-y-2 text-center">
                          <Label className="text-gray-755 font-bold text-sm">
                            Enter your 6-digit Login Passcode
                          </Label>
                          <p className="text-xs text-gray-400">
                            Enter the passcode you set during your first login.
                          </p>
                        </div>
                        <div className="py-2">
                          <OtpInput
                            value={passwordValue}
                            onChange={setPasswordValue}
                          />
                        </div>

                        <Button
                          onClick={handlePasswordLogin}
                          disabled={loggingInWithPassword || passwordValue.length !== 6}
                          className="w-full bg-[#F58220] hover:bg-[#e07010] text-white font-bold h-11 rounded-xl transition-all shadow-md shadow-orange-500/10"
                        >
                          {loggingInWithPassword ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Sign In &amp; Proceed
                        </Button>

                        <div className="text-center pt-2">
                          <button
                            type="button"
                            onClick={() => setShowOtpFallback(true)}
                            className="text-xs font-semibold text-[#6F42C1] hover:text-[#5a35a0] hover:underline"
                          >
                            Forgot passcode? Send verification code (OTP) instead
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Send OTP Form (OTP/Fallback flow)
                      !otpSent ? (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <div className="space-y-2 text-center">
                            <h3 className="text-sm font-bold text-gray-800">Verify Your Identity</h3>
                            <p className="text-xs text-gray-400">
                              Choose how you would like to receive your 6-digit verification code.
                            </p>
                          </div>
                          
                          <div className="flex gap-2 p-1 bg-gray-50 border border-gray-200 rounded-2xl">
                            {selectedUser.maskedMobile && (
                              <button
                                onClick={() => setSendTo("whatsapp")}
                                className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-200 ${sendTo === "whatsapp" ? "bg-white shadow-sm border border-gray-100 text-[#25D366]" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                              >
                                <MessageSquare className="w-4 h-4 mb-1" />
                                <span className="text-[10px] font-bold">WhatsApp</span>
                              </button>
                            )}
                            {selectedUser.maskedMobile && (
                              <button
                                onClick={() => setSendTo("sms")}
                                className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-200 ${sendTo === "sms" ? "bg-white shadow-sm border border-gray-100 text-blue-500" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                              >
                                <Smartphone className="w-4 h-4 mb-1" />
                                <span className="text-[10px] font-bold">SMS</span>
                              </button>
                            )}
                            <button
                              onClick={() => setSendTo("email")}
                              className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-200 ${sendTo === "email" ? "bg-white shadow-sm border border-gray-100 text-[#F58220]" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                            >
                              <div className="font-serif italic font-bold text-lg leading-none mb-1">@</div>
                              <span className="text-[10px] font-bold">Email</span>
                            </button>
                          </div>

                          <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 text-center">
                            <span className="text-xs text-gray-600">Sending OTP to: </span>
                            <span className="text-xs font-bold text-gray-900">
                              {sendTo === "email" ? selectedUser.maskedEmail : selectedUser.maskedMobile}
                            </span>
                          </div>

                          <Button
                            onClick={handleSendOTP}
                            disabled={sendingOtp}
                            className="w-full bg-[#F58220] hover:bg-[#e07010] text-white font-bold h-12 rounded-xl transition-all shadow-md shadow-orange-500/10"
                          >
                            {sendingOtp ? (
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : null}
                            Send OTP code
                          </Button>

                          {selectedUser.hasPassword && (
                            <div className="text-center pt-2">
                              <button
                                type="button"
                                onClick={() => setShowOtpFallback(false)}
                                className="text-xs font-semibold text-gray-500 hover:text-gray-700 hover:underline"
                              >
                                Back to Password Login
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Enter OTP Form
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <div className="space-y-2 text-center">
                            <Label htmlFor="otp-input" className="text-gray-750 font-bold text-sm">
                              Enter Verification OTP
                            </Label>
                            <p className="text-xs text-gray-400">
                              A one-time passcode has been generated. Enter it below to proceed.
                            </p>
                          </div>
                          <div className="py-2">
                            <OtpInput value={otpCode} onChange={setOtpCode} />
                          </div>
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              onClick={() => setOtpSent(false)}
                              className="flex-1 h-12 rounded-xl"
                            >
                              Resend OTP
                            </Button>
                            <Button
                              onClick={handleVerifyOTP}
                              disabled={verifyingOtp}
                              className="flex-[2] bg-[#F58220] hover:bg-[#e07010] text-white font-bold h-12 rounded-xl transition-all shadow-md shadow-orange-500/10"
                            >
                              {verifyingOtp ? (
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                              ) : null}
                              Verify &amp; Enter Portal
                            </Button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: SCHEDULE */}
          {step === 2 && participantData && (
            <div className="p-4 sm:p-8 flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Your Conference Schedule</h2>
                    <p className="text-gray-400 text-xs mt-0.5">Please review your role details and speaking schedule</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-purple-200 bg-purple-50/30 hover:bg-purple-50 text-[#6F42C1] font-bold text-xs gap-1.5 cursor-pointer rounded-xl shrink-0"
                    onClick={() => window.open("/tracks", "_blank")}
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#6F42C1]" />
                    View Full Agenda &amp; RSVP
                  </Button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {participantData.assignments.map((a) => {
                    const isPoster = a.role === "Poster";
                    return (
                      <div key={a.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPoster ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {isPoster ? "Poster Presentation" : a.role}
                          </span>
                          {!["Speaker", "Presenter", "Poster"].includes(a.role) ? (
                            <span className="text-[10px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-md">
                              No Upload Required
                            </span>
                          ) : a.uploadedFile ? (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-1 sm:mt-0">
                              <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> File Submitted (V{a.uploadedFile.version})
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                                className="h-6 px-2 text-[10px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-700"
                                title="View File"
                              >
                                <a href={`/api/assignments/${a.id}/file/view?token=${encodeURIComponent(token || "")}`} target="_blank" rel="noreferrer">
                                  <Search className="w-3 h-3 mr-1" /> View
                                </a>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                                className="h-6 px-2 text-[10px] font-bold bg-green-50 hover:bg-green-100 text-green-700"
                                title="Download File"
                              >
                                <a href={`/api/assignments/${a.id}/file/download?token=${encodeURIComponent(token || "")}`} download>
                                  <Download className="w-3 h-3 mr-1" /> Download
                                </a>
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-orange-600 font-semibold italic">Pending Upload</span>
                          )}
                        </div>
                        {a.sessionName && (
                          <div className="text-xs font-semibold text-gray-800">{a.sessionName}</div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                          <div>📅 {a.date || "Day Info Pending"}</div>
                          <div>📍 {a.track || "General"} · {a.time || "Time Info Pending"}</div>
                        </div>
                        <div className="border-t border-gray-100 pt-2 mt-1">
                            <div className="flex items-start justify-between">
                              <div className="text-xs italic text-gray-600">
                                📌 {a.presentationTitle ? `"${a.presentationTitle}"` : <span className="text-gray-400">Title not specified</span>}
                              </div>
                            </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl bg-orange-50 border border-orange-100/50 flex gap-3 items-start">
                  <HelpCircle className="w-5 h-5 text-[#F58220] shrink-0 mt-0.5" />
                  <div className="text-xs text-orange-800 leading-relaxed">
                    <strong>Submission Rule:</strong> Presenters must upload `.pptx` slides strictly under 15 MB. Poster presenters must upload `.jpg` or `.jpeg` images strictly under 20 MB.
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-end">
                <Button
                  onClick={() => setStep(3)}
                  className="bg-[#F58220] hover:bg-[#e07010] text-white font-bold h-12 px-6 rounded-xl transition-all gap-2"
                >
                  Proceed to Upload <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: UPLOAD */}
          {step === 3 && participantData && (
            <div className="p-4 sm:p-8 flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Upload Your PPT / Poster</h2>
                  <p className="text-gray-400 text-xs mt-0.5">Drag and drop or select your PPTX or image file below</p>
                </div>

                {/* Presentation Upload Section */}
                {selectedUser?.needsPPT && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-700">Upload Presentation Slides (.pptx, max 15MB)</Label>
                    <div className="relative group border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-blue-500 hover:bg-blue-50/10 cursor-pointer transition-all">
                      <input
                        type="file"
                        accept=".pptx"
                        onChange={(e) => handleFileChange("ppt", e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <div className="text-sm font-semibold text-gray-700">
                        {pptFile ? pptFile.name : "Select PPTX slides"}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {pptFile ? `${(pptFile.size / (1024 * 1024)).toFixed(2)} MB` : "Widescreen 16:9 format suggested"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Poster Upload Section */}
                {selectedUser?.needsPoster && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-700">Upload Poster Image (.jpg / .jpeg, max 20MB)</Label>
                    <div className="relative group border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-amber-500 hover:bg-amber-50/10 cursor-pointer transition-all">
                      <input
                        type="file"
                        accept=".jpg,.jpeg"
                        onChange={(e) => handleFileChange("poster", e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Image className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <div className="text-sm font-semibold text-gray-700">
                        {posterFile ? posterFile.name : "Select Poster JPG"}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {posterFile ? `${(posterFile.size / (1024 * 1024)).toFixed(2)} MB` : "High resolution image"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="sub-notes" className="text-xs font-bold text-gray-700">Message / Notes for Secretariat</Label>
                  <Textarea
                    id="sub-notes"
                    placeholder="Provide any formatting requests or specifications..."
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    rows={2.5}
                    className="rounded-xl border-gray-200 text-sm"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1 h-12 rounded-xl font-bold"
                >
                  ← Back to Schedule
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={(selectedUser?.needsPPT && !pptFile) && (selectedUser?.needsPoster && !posterFile)}
                  className="flex-[2] bg-[#F58220] hover:bg-[#e07010] text-white font-bold h-12 rounded-xl transition-all"
                >
                  Review Submission →
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW */}
          {step === 4 && participantData && (
            <div className="p-4 sm:p-8 flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Review and Confirm</h2>
                  <p className="text-gray-400 text-xs mt-0.5">Please check everything before locking in your files</p>
                </div>

                <div className="space-y-3 rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100 bg-gray-50/30 text-xs">
                  <div className="px-4 py-3 flex justify-between">
                    <span className="font-semibold text-gray-500">Name</span>
                    <span className="font-bold text-gray-900">{participantData.name}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="font-semibold text-gray-500">Institution</span>
                    <span className="font-medium text-gray-700">{participantData.institution}</span>
                  </div>
                  {pptFile && (
                    <div className="px-4 py-3 flex justify-between">
                      <span className="font-semibold text-gray-500">Presentation File</span>
                      <span className="font-mono text-[#6F42C1] font-bold">{pptFile.name} ({(pptFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </div>
                  )}
                  {posterFile && (
                    <div className="px-4 py-3 flex justify-between">
                      <span className="font-semibold text-gray-500">Poster Image File</span>
                      <span className="font-mono text-[#6F42C1] font-bold">{posterFile.name} ({(posterFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </div>
                  )}
                  {additionalNotes && (
                    <div className="px-4 py-3 flex flex-col gap-1.5">
                      <span className="font-semibold text-gray-500">Special Notes</span>
                      <p className="text-gray-700 bg-white p-2.5 rounded-lg border border-gray-100 leading-relaxed italic">"{additionalNotes}"</p>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-gray-400 leading-normal text-center bg-gray-50 p-3 rounded-xl">
                  By clicking Submit, these materials will be logged and renamed to conference guidelines standards in the database storage.
                </p>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  disabled={submitting}
                  className="flex-1 h-12 rounded-xl font-bold"
                >
                  ← Edit Files
                </Button>
                <Button
                  onClick={handleSubmissionsSubmit}
                  disabled={submitting}
                  className="flex-[2] bg-[#F58220] hover:bg-[#e07010] text-white font-bold h-12 rounded-xl transition-all"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  Submit files ✓
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESS */}
          {step === 5 && selectedUser && (
            <div className="p-4 sm:p-8 flex-grow flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-500 border border-green-200 shadow-lg shadow-green-100/50 animate-bounce">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Submission Received!</h2>
                <p className="text-sm text-gray-400 max-w-sm">
                  Your presentations and/or posters have been locked in successfully for the Vision 2020 Conference.
                </p>
              </div>

              <div className="px-5 py-2.5 bg-orange-50 text-[#F58220] rounded-xl border border-orange-100 font-extrabold text-sm tracking-wider uppercase">
                {successRef}
              </div>

              <p className="text-xs text-gray-400 leading-normal max-w-sm">
                A confirmation has been logged. If you need to overwrite these files or have questions, contact the secretariat at <a href="mailto:events@sankaraeye.com" className="text-orange-500 underline font-semibold">events@sankaraeye.com</a>.
              </p>

              <div className="pt-4 w-full">
                <Button
                  asChild
                  className="w-full bg-[#0d1b3e] hover:bg-[#1a2f5a] text-white h-12 rounded-xl font-bold transition-all"
                >
                  <Link href="/login">Return to login portal</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
