import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetSubmissionSettings, useUpdateSubmissionSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  MessageSquare,
  Mail,
  Upload,
  Lock,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  QrCode,
  FileText,
  Smartphone,
  ExternalLink,
  FileSpreadsheet,
  Database,
  MapPin,
  Tv,
  CreditCard,
  Wallet,
  Bot,
  Sparkles,
  Globe,
  Eye,
  EyeOff,
  Copy,
  ShieldCheck,
} from "lucide-react";

export default function AdminSettings() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: settings, isLoading } = useGetSubmissionSettings();
  const updateSettingsMutation = useUpdateSubmissionSettings();

  // Settings form states
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [otpMode, setOtpMode] = useState("static");
  const [testOtps, setTestOtps] = useState("111111,222222,333333");
  const [whatsappApiKey, setWhatsappApiKey] = useState("");
  const [whatsappInstanceId, setWhatsappInstanceId] = useState("");
  const [whatsappTemplate, setWhatsappTemplate] = useState("");
  const [waOtpTemplate, setWaOtpTemplate] = useState("");
  const [waAttendanceTemplate, setWaAttendanceTemplate] = useState("");
  const [waFoodTemplate, setWaFoodTemplate] = useState("");
  const [waOtpMode, setWaOtpMode] = useState<"template" | "text">("template");
  const [waAttendanceMode, setWaAttendanceMode] = useState<"template" | "text">("template");
  const [waFoodMode, setWaFoodMode] = useState<"template" | "text">("template");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [supportTicketCcEmails, setSupportTicketCcEmails] = useState("saurabhrai@sankaraeye.com, prabhanjan@sankaraeye.com");

  // Google OAuth SSO states
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleCallbackUrl, setGoogleCallbackUrl] = useState("");
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);

  // Google Wallet states
  const [googleWalletIssuerId, setGoogleWalletIssuerId] = useState("");
  const [googleWalletServiceAccountEmail, setGoogleWalletServiceAccountEmail] = useState("");
  const [googleWalletPrivateKey, setGoogleWalletPrivateKey] = useState("");
  const [showWalletKey, setShowWalletKey] = useState(false);

  // AI Chatbot states
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [hfToken, setHfToken] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showHfToken, setShowHfToken] = useState(false);

  // Test Email state
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testEmailMessage, setTestEmailMessage] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Test WhatsApp state
  const [testMobile, setTestMobile] = useState("");
  const [testingWaType, setTestingWaType] = useState<string | null>(null);

  // Tracks QR Code selected track
  const [qrSelectedTrack, setQrSelectedTrack] = useState("All Tracks");

  // Sync state
  const [syncFile, setSyncFile] = useState<File | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [conferenceMapUrl, setConferenceMapUrl] = useState("");
  const [liveTvUrl, setLiveTvUrl] = useState("");
  const [mapUploading, setMapUploading] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  // Paid List Excel Sync
  const [paidListFile, setPaidListFile] = useState<File | null>(null);
  const [paidListSyncing, setPaidListSyncing] = useState(false);
  const [paidListResult, setPaidListResult] = useState<{
    matched: number; alreadyPaid: number; newlyImported: number; total: number;
  } | null>(null);

  // Danger Zone states & handler
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purging, setPurging] = useState(false);

  const handlePurgeAllData = async () => {
    if (purgeConfirm !== "PURGE") return;
    if (!window.confirm("ARE YOU ABSOLUTELY SURE? This will permanently delete all participants, assignments, uploads, and logs. This cannot be undone.")) {
      return;
    }

    setPurging(true);
    try {
      const resp = await fetch("/api/settings/purge-all-data", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to purge portal data");
      }

      const result = await resp.json();
      toast({
        title: "Portal Reset Complete ✓",
        description: result.message,
      });
      setPurgeConfirm("");
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({
        title: "Purge Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setPurging(false);
    }
  };

  const handleMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Only PDF files are allowed for the conference map.",
        variant: "destructive"
      });
      return;
    }

    setMapUploading(true);
    const formData = new FormData();
    formData.append("mapFile", file);

    try {
      const resp = await fetch("/api/settings/upload-map", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to upload map");

      setConferenceMapUrl(data.url);
      toast({
        title: "Map uploaded successfully",
        description: "The conference map PDF has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/settings/submissions"] });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setMapUploading(false);
    }
  };

  // Sync state values when API loads
  useEffect(() => {
    if (settings) {
      setSubmissionsOpen(settings.submissionsOpen);
      setOtpMode(settings.otpMode || "static");
      setTestOtps(settings.testOtps || "111111,222222,333333");
      setWhatsappApiKey(settings.whatsappApiKey || "");
      setWhatsappInstanceId(settings.whatsappInstanceId || "");

      const rawTemplate = settings.whatsappTemplate || "";
      setWhatsappTemplate(rawTemplate);

      if (rawTemplate.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(rawTemplate);

          const otpVal = parsed.otp || "vision2020_otp";
          setWaOtpTemplate(otpVal);
          setWaOtpMode(otpVal.includes(" ") ? "text" : "template");

          const attVal = parsed.attendance || "vision2020_attendance_scanned";
          setWaAttendanceTemplate(attVal);
          setWaAttendanceMode(attVal.includes(" ") ? "text" : "template");

          const foodVal = parsed.food || "vision2020_food_scanned";
          setWaFoodTemplate(foodVal);
          setWaFoodMode(foodVal.includes(" ") ? "text" : "template");
        } catch {
          setWaOtpTemplate(rawTemplate || "vision2020_otp");
          setWaOtpMode((rawTemplate || "vision2020_otp").includes(" ") ? "text" : "template");
          setWaAttendanceTemplate("vision2020_attendance_scanned");
          setWaAttendanceMode("template");
          setWaFoodTemplate("vision2020_food_scanned");
          setWaFoodMode("template");
        }
      } else {
        const otpVal = rawTemplate || "vision2020_otp";
        setWaOtpTemplate(otpVal);
        setWaOtpMode(otpVal.includes(" ") ? "text" : "template");
        setWaAttendanceTemplate("vision2020_attendance_scanned");
        setWaAttendanceMode("template");
        setWaFoodTemplate("vision2020_food_scanned");
        setWaFoodMode("template");
      }

      setSmtpHost(settings.smtpHost || "");
      setSmtpPort(settings.smtpPort || 587);
      setSmtpSecure((settings as any).smtpSecure ?? false);
      setSmtpUser(settings.smtpUser || "");
      setSmtpPass(settings.smtpPass || "");
      setSmtpFromEmail(settings.smtpFromEmail || "");
      setSmtpFromName(settings.smtpFromName || "");
      setRazorpayKeyId((settings as any).razorpayKeyId || "");
      setRazorpayKeySecret((settings as any).razorpayKeySecret || "");
      setSessionTimeoutMinutes((settings as any).sessionTimeoutMinutes ?? 30);
      setSupportTicketCcEmails((settings as any).supportTicketCcEmails || "saurabhrai@sankaraeye.com, prabhanjan@sankaraeye.com");
      setGoogleSheetUrl((settings as any).googleSheetUrl || "");
      setConferenceMapUrl((settings as any).conferenceMapUrl || "");
      setLiveTvUrl((settings as any).liveTvUrl || "");
      // Google OAuth SSO
      setGoogleClientId((settings as any).googleClientId || "");
      setGoogleClientSecret((settings as any).googleClientSecret || "");
      setGoogleCallbackUrl((settings as any).googleCallbackUrl || "https://events.sankaraeye.in/api/auth/google/callback");
      // Google Wallet
      setGoogleWalletIssuerId((settings as any).googleWalletIssuerId || "3388000000023186695");
      setGoogleWalletServiceAccountEmail((settings as any).googleWalletServiceAccountEmail || "");
      setGoogleWalletPrivateKey((settings as any).googleWalletPrivateKey || "");
      // AI Keys
      setGeminiApiKey((settings as any).geminiApiKey || "");
      setHfToken((settings as any).hfToken || "");
    }
  }, [settings]);

  const handleSaveSettings = () => {
    const updatedTemplateString = JSON.stringify({
      otp: waOtpTemplate.trim(),
      attendance: waAttendanceTemplate.trim(),
      food: waFoodTemplate.trim()
    });

    updateSettingsMutation.mutate(
      {
        data: {
          submissionsOpen,
          otpMode,
          testOtps,
          whatsappApiKey,
          whatsappInstanceId,
          whatsappTemplate: updatedTemplateString,
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpSecure,
          smtpUser,
          smtpPass,
          smtpFromEmail,
          smtpFromName,
          razorpayKeyId: razorpayKeyId.trim() || undefined,
          razorpayKeySecret: razorpayKeySecret.trim() || undefined,
          sessionTimeoutMinutes: Number(sessionTimeoutMinutes),
          supportTicketCcEmails: supportTicketCcEmails.trim() || undefined,
          googleSheetUrl,
          conferenceMapUrl,
          liveTvUrl,
          ...( {
            googleClientId: googleClientId.trim() || undefined,
            googleClientSecret: googleClientSecret.trim() || undefined,
            googleCallbackUrl: googleCallbackUrl.trim() || undefined,
            googleWalletIssuerId: googleWalletIssuerId.trim() || undefined,
            googleWalletServiceAccountEmail: googleWalletServiceAccountEmail.trim() || undefined,
            googleWalletPrivateKey: googleWalletPrivateKey.trim() || undefined,
            geminiApiKey: geminiApiKey.trim() || undefined,
            hfToken: hfToken.trim() || undefined,
          } as any),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Settings saved successfully", description: "Submission and API configurations updated." });
          queryClient.invalidateQueries({ queryKey: ["/settings/submissions"] });
        },
        onError: (err: any) => {
          toast({
            title: "Failed to save settings",
            description: err.message || "An error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      toast({ title: "Please enter a test email address", variant: "destructive" });
      return;
    }

    setSendingTestEmail(true);
    try {
      const resp = await fetch("/api/settings/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: testEmailAddress, message: testEmailMessage }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send test email");
      }

      toast({ title: "Test Email Sent!", description: "Please check the inbox of " + testEmailAddress });
    } catch (err: any) {
      toast({
        title: "Test Email Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSendTestWhatsapp = async (templateType: "otp" | "welcome" | "rsvp" | "food" | "attendance") => {
    if (!testMobile) {
      toast({ title: "Please enter a test mobile number", variant: "destructive" });
      return;
    }

    setTestingWaType(templateType);
    try {
      const resp = await fetch("/api/settings/test-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mobile: testMobile, templateType }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Failed to send test ${templateType} message`);
      }

      toast({
        title: "Test Message Dispatched ✓",
        description: `Successfully sent test ${templateType} template to ${testMobile}`,
      });
    } catch (err: any) {
      toast({
        title: "WhatsApp Test Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setTestingWaType(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSyncFile(e.target.files[0]);
      setSyncResult(null);
    }
  };

  const handleSyncSubmit = async () => {
    if (!syncFile) {
      toast({ title: "Please select a file to import", variant: "destructive" });
      return;
    }

    setSyncing(true);
    setSyncResult(null);

    try {
      const formData = new FormData();
      formData.append("file", syncFile);

      const resp = await fetch("/api/participants/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload and import database");
      }

      const result = await resp.json();
      setSyncResult(result);
      toast({ title: "Excel Import Complete", description: `Successfully imported ${result.imported} assignments.` });
      setSyncFile(null);
      // Reset input element
      const fileInput = document.getElementById("csv-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      toast({
        title: "Import Error",
        description: err.message || "An error occurred during spreadsheet import",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const activeSession = (settings as any)?.activeSession;

  const handlePaidListSync = async () => {
    if (!paidListFile) {
      toast({ title: "Please select the paid list Excel file", variant: "destructive" });
      return;
    }
    setPaidListSyncing(true);
    setPaidListResult(null);
    try {
      const formData = new FormData();
      formData.append("file", paidListFile);
      const resp = await fetch("/api/participants/import-paid-list", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to process paid list");
      }
      const result = await resp.json();
      setPaidListResult(result);
      toast({ title: "Paid List Sync Complete", description: `${result.matched} marked paid, ${result.newlyImported} new imports, ${result.alreadyPaid} already paid.` });
      setPaidListFile(null);
      const inp = document.getElementById("paid-list-input") as HTMLInputElement;
      if (inp) inp.value = "";
    } catch (err: any) {
      toast({ title: "Sync Error", description: err.message, variant: "destructive" });
    } finally {
      setPaidListSyncing(false);
    }
  };

  const handleGoogleSheetsSync = async () => {
    if (!activeSession) {
      toast({ title: "No active session sync configuration found", variant: "destructive" });
      return;
    }
    setGoogleSyncing(true);
    setSyncResult(null);

    try {
      const resp = await fetch("/api/participants/sync-google-sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to sync with Google Sheets");
      }

      const result = await resp.json();
      setSyncResult(result);
      toast({ title: "Google Sheets Sync Complete", description: `Successfully synchronized ${result.imported} assignments.` });
      queryClient.invalidateQueries({ queryKey: ["/settings/submissions"] });
    } catch (err: any) {
      toast({
        title: "Sync Error",
        description: err.message || "An error occurred during Google Sheets sync",
        variant: "destructive",
      });
    } finally {
      setGoogleSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-zinc-100 animate-in fade-in duration-300 max-w-7xl mx-auto">
      <div className="p-6 sm:p-8 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            <Settings className="w-3.5 h-3.5" />
            Global Platform Configuration
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">System Settings</h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
          Configure submission windows, OTP verification modes, API credentials, conference route maps, and attendee databases across the platform.
        </p>
      </div>

      <Tabs defaultValue="submissions" className="w-full">
        <TabsList className="bg-[#141417] border border-[#26262D] p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 mb-6">
          <TabsTrigger value="submissions" className="rounded-xl py-2.5 px-4 font-semibold text-xs sm:text-sm text-zinc-400 data-[state=active]:bg-[#25252D] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all gap-2 cursor-pointer">
            <Settings className="w-4 h-4" /> Submissions &amp; OTP
          </TabsTrigger>
          <TabsTrigger value="apis" className="rounded-xl py-2.5 px-4 font-semibold text-xs sm:text-sm text-zinc-400 data-[state=active]:bg-[#25252D] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all gap-2 cursor-pointer">
            <MessageSquare className="w-4 h-4" /> APIs &amp; Integrations
          </TabsTrigger>
          {(user?.userType as string) === "super_admin" && (
            <TabsTrigger value="sync" className="rounded-xl py-2.5 px-4 font-semibold text-xs sm:text-sm text-zinc-400 data-[state=active]:bg-[#25252D] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> Master Excel Import
            </TabsTrigger>
          )}
          <TabsTrigger value="idcard" className="rounded-xl py-2.5 px-4 font-semibold text-xs sm:text-sm text-zinc-400 data-[state=active]:bg-[#25252D] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all gap-2 cursor-pointer">
            <QrCode className="w-4 h-4" /> ID Card &amp; Scanner QR Codes
          </TabsTrigger>

          <TabsTrigger value="export" className="rounded-xl py-2.5 px-4 font-semibold text-xs sm:text-sm text-emerald-400 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all gap-2 cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" /> Export Data
          </TabsTrigger>

          {(user?.userType as string) === "super_admin" && (
            <TabsTrigger value="danger" className="rounded-xl py-2.5 px-4 font-bold text-xs sm:text-sm text-red-400 hover:text-red-300 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all gap-2 cursor-pointer">
              <AlertTriangle className="w-4 h-4" /> Danger Zone
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Submissions & OTP */}
        <TabsContent value="submissions" className="space-y-4">
          <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-violet-400" />
                Secure Upload Portal Settings
              </h2>
              <p className="text-xs text-zinc-400">
                Configure file submission windows, presentation upload states, and verification OTP methods.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-[#23232A] bg-[#0C0C0F]">
                <div className="space-y-0.5">
                  <Label htmlFor="submissions-open" className="text-sm font-bold text-white">
                    File Submissions Open
                  </Label>
                  <p className="text-xs text-zinc-400">Allows speakers and presenters to submit presentation files.</p>
                </div>
                <Switch
                  id="submissions-open"
                  checked={submissionsOpen}
                  onCheckedChange={setSubmissionsOpen}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="otp-mode" className="text-xs font-bold text-zinc-300">
                    OTP Verification Mode
                  </Label>
                  <Select value={otpMode} onValueChange={setOtpMode}>
                    <SelectTrigger id="otp-mode" className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11">
                      <SelectValue placeholder="Select OTP Mode" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141418] border-[#2B2B35] text-white">
                      <SelectItem value="static">Static (Test OTPs only)</SelectItem>
                      <SelectItem value="dynamic">Dynamic (Generate real-time codes)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-zinc-500">
                    {otpMode === "static"
                      ? "Allows users to verify identity by entering any of the test OTPs."
                      : "Generates unique random codes (logged to server console/WhatsApp/Email)."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-otps" className="text-xs font-bold text-zinc-300">
                    Static Test OTPs
                  </Label>
                  <Input
                    id="test-otps"
                    value={testOtps}
                    onChange={(e) => setTestOtps(e.target.value)}
                    placeholder="111111,222222,333333"
                    className="bg-[#09090C] border-[#2B2B35] text-white placeholder:text-zinc-600 rounded-xl h-11 font-mono text-xs"
                  />
                  <p className="text-[11px] text-zinc-500">Comma-separated list of valid OTP codes when Static mode is selected.</p>
                </div>
              </div>

              {/* Route Map Upload Section — Super Admin Only */}
              <div className="pt-6 border-t border-[#23232A] space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" /> Route Map PDF (Public Link)
                </h3>
                <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-5 space-y-4">
                  <div className="space-y-1">
                    <Label className="font-bold text-amber-200 block text-sm">Conference Route Map</Label>
                    <p className="text-xs text-amber-300/70 leading-relaxed">
                      Upload the venue route and layout map PDF. Once uploaded, it will be publicly accessible at the link below with zero login requirements.
                    </p>
                  </div>

                  {/* Fixed Public URL display */}
                  <div className="bg-[#09090C] border border-amber-800/40 rounded-xl p-4 space-y-2.5 shadow-sm">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span>📎 Public Shareable URL</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <code className="flex-1 text-xs font-mono text-amber-300 bg-[#121218] px-3.5 py-2.5 rounded-xl border border-amber-800/30 break-all select-all">
                        https://events.sankaraeye.in/api/routemap.pdf
                      </code>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText("https://events.sankaraeye.in/api/routemap.pdf");
                            toast({ title: "Link copied!", description: "Route map URL copied to clipboard." });
                          }}
                          className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all border-none cursor-pointer"
                        >
                          Copy
                        </Button>
                        {conferenceMapUrl && (
                          <a
                            href="/api/routemap.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-10 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs transition-all border border-emerald-500/40 flex items-center gap-1.5"
                          >
                            <span>View PDF</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    {conferenceMapUrl ? (
                      <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 pt-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Route map is live and publicly accessible
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5 pt-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> No route map uploaded yet — URL returns 404 until a PDF is uploaded
                      </p>
                    )}
                  </div>

                  {/* Upload button */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <label className={`h-11 px-5 rounded-xl border border-[#3A3A45] bg-[#1A1A22] hover:bg-[#252530] text-white font-bold transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md ${mapUploading ? "opacity-50 pointer-events-none" : ""}`}>
                      <Upload className="w-4 h-4 text-amber-400" />
                      {mapUploading ? "Uploading..." : conferenceMapUrl ? "Replace Route Map PDF" : "Upload Route Map PDF"}
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleMapUpload}
                        className="hidden"
                        disabled={mapUploading}
                      />
                    </label>
                    <p className="text-xs text-zinc-400">PDF files only • Replaces current map instantly</p>
                  </div>
                </div>
              </div>

              {/* Live TV / Webcast URL Section */}
              <div className="pt-6 border-t border-[#23232A] space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tv className="w-4 h-4 text-violet-400" /> Live TV / Webcast URL
                </h3>
                <div className="space-y-3 bg-[#0C0C0F] p-5 rounded-2xl border border-[#23232A]">
                  <Label htmlFor="live-tv-url" className="font-bold text-white text-xs block">Live Stream Link</Label>
                  <p className="text-xs text-zinc-400 leading-normal">
                    Enter the URL to the live TV webcast (e.g. YouTube stream, Zoom webcast, or custom webcast platform URL) to broadcast on the Live Dashboard.
                  </p>
                  <Input
                    id="live-tv-url"
                    type="url"
                    placeholder="https://www.youtube.com/embed/live_stream_id or custom webcast URL"
                    value={liveTvUrl}
                    onChange={(e) => setLiveTvUrl(e.target.value)}
                    className="h-11 bg-[#09090C] border-[#2B2B35] text-white placeholder:text-zinc-600 rounded-xl font-medium text-xs"
                  />
                </div>
              </div>

              {/* Session Timeout — super_admin only */}
              {(user as any)?.userType === "super_admin" && (
                <div className="p-5 rounded-2xl border border-rose-900/40 bg-rose-950/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-black text-rose-300 uppercase tracking-wider">Super Admin: Session Timeout Policy</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      id="session-timeout"
                      type="number"
                      min={1}
                      max={480}
                      value={sessionTimeoutMinutes}
                      onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                      className="w-28 h-10 bg-[#09090C] border-rose-800/40 text-white font-mono rounded-xl text-xs"
                    />
                    <Label htmlFor="session-timeout" className="text-xs text-rose-200 font-medium">
                      minutes (1–480). Currently {sessionTimeoutMinutes} min ≈ {Math.round(sessionTimeoutMinutes / 60 * 10) / 10}h.
                    </Label>
                  </div>
                  <p className="text-[11px] text-rose-400/80">Inactivity limit after which idle coordinators/staff are signed out automatically.</p>
                </div>
              )}

              <div className="pt-4 border-t border-[#23232A] flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                  className="bg-white hover:bg-zinc-200 text-zinc-950 shadow-md font-bold text-xs uppercase tracking-wider rounded-xl h-11 px-6 flex items-center gap-2 cursor-pointer"
                >
                  {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />}
                  Save Configurations
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: APIs & Integrations */}
        <TabsContent value="apis" className="space-y-4">
          <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                API &amp; SMTP Credentials
              </h2>
              <p className="text-xs text-zinc-400">
                Setup messaging server tokens, SMTP email client details, and Razorpay gateway keys.
              </p>
            </div>

            <div className="space-y-6">
              {/* WhatsApp Config */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" /> WhatsApp Integration Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wa-key" className="text-xs font-bold text-zinc-300">API Token / Key</Label>
                    <Input
                      id="wa-key"
                      type="password"
                      placeholder="Enter API Key"
                      value={whatsappApiKey}
                      onChange={(e) => setWhatsappApiKey(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-instance" className="text-xs font-bold text-zinc-300">Instance ID / Sender Number</Label>
                    <Input
                      id="wa-instance"
                      placeholder="e.g. 123456"
                      value={whatsappInstanceId}
                      onChange={(e) => setWhatsappInstanceId(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="bg-[#0C0C0F] border border-[#23232A] rounded-2xl p-4 text-xs text-zinc-300 space-y-1.5">
                    <div className="font-extrabold text-white flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> WhatsApp Template Configurations
                    </div>
                    <p className="leading-relaxed text-zinc-400">
                      Configure how each message is dispatched. Choose <strong>Meta Template</strong> to trigger pre-registered templates on your WhatsApp Business Account. Choose <strong>Custom Text</strong> to draft plain text messages with custom copy and emojis.
                    </p>
                  </div>

                  {/* 1. OTP LOGIN TEMPLATE */}
                  <div className="space-y-3 p-4 border border-[#23232A] rounded-2xl bg-[#0C0C0F]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <Label htmlFor="wa-otp-template" className="font-bold text-xs text-white">
                        1st Key: OTP Login Template
                      </Label>
                      <div className="flex bg-[#181820] p-0.5 rounded-xl border border-[#2B2B35] text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setWaOtpMode("template");
                            if (waOtpTemplate.includes(" ")) setWaOtpTemplate("vision2020_otp");
                          }}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${waOtpMode === "template" ? "bg-[#2A2A35] text-white shadow-xs" : "text-zinc-400 hover:text-white"}`}
                        >
                          Meta Template
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWaOtpMode("text");
                            if (waOtpTemplate === "vision2020_otp") setWaOtpTemplate("Your verification code (OTP) for the Vision 2020 Conference login is {{otp}}. For security, please do not share this passcode with anyone. This code is valid for 10 minutes.");
                          }}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${waOtpMode === "text" ? "bg-[#2A2A35] text-white shadow-xs" : "text-zinc-400 hover:text-white"}`}
                        >
                          Custom Text / Emojis
                        </button>
                      </div>
                    </div>

                    {waOtpMode === "template" ? (
                      <Input
                        id="wa-otp-template"
                        placeholder="e.g. vision2020_otp"
                        value={waOtpTemplate}
                        onChange={(e) => setWaOtpTemplate(e.target.value)}
                        className="font-mono text-xs rounded-xl bg-[#09090C] border-[#2B2B35] text-white h-10"
                      />
                    ) : (
                      <Textarea
                        id="wa-otp-template"
                        placeholder="Enter template message (use {{otp}} code variable)..."
                        value={waOtpTemplate}
                        onChange={(e) => setWaOtpTemplate(e.target.value)}
                        rows={2}
                        className="font-mono text-xs rounded-xl bg-[#09090C] border-[#2B2B35] text-white"
                      />
                    )}
                    <p className="text-[10px] text-zinc-500">
                      {waOtpMode === "template"
                        ? "Register template on WhatsApp Dashboard. Default name: vision2020_otp"
                        : "Required placeholder: {{otp}} is replaced with the 6-digit login verification pin."}
                    </p>
                  </div>

                  {/* 2. ATTENDANCE SCANNED TEMPLATE */}
                  <div className="space-y-3 p-4 border border-[#23232A] rounded-2xl bg-[#0C0C0F]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <Label htmlFor="wa-att-template" className="font-bold text-xs text-white">
                        2nd Key: Attendance Scanned Check-in Notification
                      </Label>
                      <div className="flex bg-[#181820] p-0.5 rounded-xl border border-[#2B2B35] text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setWaAttendanceMode("template");
                            if (waAttendanceTemplate.includes(" ")) setWaAttendanceTemplate("vision2020_attendance_scanned");
                          }}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${waAttendanceMode === "template" ? "bg-[#2A2A35] text-white shadow-xs" : "text-zinc-400 hover:text-white"}`}
                        >
                          Meta Template
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWaAttendanceMode("text");
                            if (waAttendanceTemplate === "vision2020_attendance_scanned") setWaAttendanceTemplate("Hello {{1}}! 👋 Welcome to the {{2}}! 🌟 Your check-in has been successfully marked at {{3}} on {{4}}.");
                          }}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${waAttendanceMode === "text" ? "bg-[#2A2A35] text-white shadow-xs" : "text-zinc-400 hover:text-white"}`}
                        >
                          Custom Text / Emojis
                        </button>
                      </div>
                    </div>

                    {waAttendanceMode === "template" ? (
                      <Input
                        id="wa-att-template"
                        placeholder="e.g. vision2020_attendance_scanned"
                        value={waAttendanceTemplate}
                        onChange={(e) => setWaAttendanceTemplate(e.target.value)}
                        className="font-mono text-xs rounded-xl bg-[#09090C] border-[#2B2B35] text-white h-10"
                      />
                    ) : (
                      <Textarea
                        id="wa-att-template"
                        placeholder="Enter custom template (use {{1}}, {{2}}, {{3}}, {{4}})..."
                        value={waAttendanceTemplate}
                        onChange={(e) => setWaAttendanceTemplate(e.target.value)}
                        rows={3}
                        className="font-mono text-xs rounded-xl bg-[#09090C] border-[#2B2B35] text-white"
                      />
                    )}
                    <p className="text-[10px] text-zinc-500">
                      {waAttendanceMode === "template"
                        ? "Register template on WhatsApp Dashboard. Default name: vision2020_attendance_scanned"
                        : "Required placeholders: {{1}} = Name, {{2}} = Event title, {{3}} = Scan Time, {{4}} = Scan Date."}
                    </p>
                  </div>

                  {/* 3. FOOD TOKEN SCANNED TEMPLATE */}
                  <div className="space-y-3 p-4 border border-[#23232A] rounded-2xl bg-[#0C0C0F]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <Label htmlFor="wa-food-template" className="font-bold text-xs text-white">
                        3rd Key: Food Token Scanned Notification
                      </Label>
                      <div className="flex bg-[#181820] p-0.5 rounded-xl border border-[#2B2B35] text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setWaFoodMode("template");
                            if (waFoodTemplate.includes(" ")) setWaFoodTemplate("vision2020_food_scanned");
                          }}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${waFoodMode === "template" ? "bg-[#2A2A35] text-white shadow-xs" : "text-zinc-400 hover:text-white"}`}
                        >
                          Meta Template
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWaFoodMode("text");
                            if (waFoodTemplate === "vision2020_food_scanned") setWaFoodTemplate("Hello {{1}}! 👋 Hope you are having an insightful day! 🌟 Your food token for {{2}} has been successfully scanned at {{3}} on {{4}}. Enjoy your meal! 🍽️");
                          }}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${waFoodMode === "text" ? "bg-[#2A2A35] text-white shadow-xs" : "text-zinc-400 hover:text-white"}`}
                        >
                          Custom Text / Emojis
                        </button>
                      </div>
                    </div>

                    {waFoodMode === "template" ? (
                      <Input
                        id="wa-food-template"
                        placeholder="e.g. vision2020_food_scanned"
                        value={waFoodTemplate}
                        onChange={(e) => setWaFoodTemplate(e.target.value)}
                        className="font-mono text-xs rounded-xl bg-[#09090C] border-[#2B2B35] text-white h-10"
                      />
                    ) : (
                      <Textarea
                        id="wa-food-template"
                        placeholder="Enter custom template (use {{1}}, {{2}}, {{3}}, {{4}})..."
                        value={waFoodTemplate}
                        onChange={(e) => setWaFoodTemplate(e.target.value)}
                        rows={3}
                        className="font-mono text-xs rounded-xl bg-[#09090C] border-[#2B2B35] text-white"
                      />
                    )}
                    <p className="text-[10px] text-zinc-500">
                      {waFoodMode === "template"
                        ? "Register template on WhatsApp Dashboard. Default name: vision2020_food_scanned"
                        : "Required placeholders: {{1}} = Name, {{2}} = Meal Type (e.g. Lunch), {{3}} = Scan Time, {{4}} = Scan Date."}
                    </p>
                  </div>
                </div>

                {/* Test WhatsApp Block */}
                <div className="mt-6 pt-4 border-t border-[#23232A] space-y-4 bg-[#0C0C0F] p-5 rounded-2xl border border-dashed border-[#2B2B35]">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Test WhatsApp Dispatch</h4>
                  <div className="space-y-3">
                    <div className="max-w-md space-y-1.5">
                      <Label htmlFor="test-mobile" className="text-xs font-bold text-zinc-300">Recipient Mobile Number</Label>
                      <Input
                        id="test-mobile"
                        placeholder="Enter mobile (e.g. 9876543210)"
                        value={testMobile}
                        onChange={(e) => setTestMobile(e.target.value)}
                        className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 font-mono text-xs"
                      />
                      <p className="text-[10px] text-zinc-500">
                        10-digit Indian mobile or full international number with country code.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        onClick={() => handleSendTestWhatsapp("otp")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-[#2B2B35] bg-[#181820] text-emerald-400 hover:bg-[#20202A] font-bold text-xs rounded-xl"
                      >
                        {testingWaType === "otp" && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                        OTP Template
                      </Button>
                      <Button
                        onClick={() => handleSendTestWhatsapp("welcome")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-[#2B2B35] bg-[#181820] text-emerald-400 hover:bg-[#20202A] font-bold text-xs rounded-xl"
                      >
                        {testingWaType === "welcome" && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                        Welcome Template
                      </Button>
                      <Button
                        onClick={() => handleSendTestWhatsapp("rsvp")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-[#2B2B35] bg-[#181820] text-emerald-400 hover:bg-[#20202A] font-bold text-xs rounded-xl"
                      >
                        {testingWaType === "rsvp" && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                        RSVP Template
                      </Button>
                      <Button
                        onClick={() => handleSendTestWhatsapp("food")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-[#2B2B35] bg-[#181820] text-emerald-400 hover:bg-[#20202A] font-bold text-xs rounded-xl"
                      >
                        {testingWaType === "food" && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                        Food Scan Template
                      </Button>
                      <Button
                        onClick={() => handleSendTestWhatsapp("attendance")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-[#2B2B35] bg-[#181820] text-emerald-400 hover:bg-[#20202A] font-bold text-xs rounded-xl"
                      >
                        {testingWaType === "attendance" && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                        Attendance Scan Template
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-[#23232A]" />

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" /> Email SMTP Credentials
                </h3>
                <div className="rounded-2xl bg-blue-950/20 border border-blue-900/40 p-4 text-xs text-blue-200 space-y-1.5">
                  <p className="font-bold text-blue-300">📧 Using Zoho Mail SMTP?</p>
                  <p>Host: <code className="bg-[#09090C] px-2 py-0.5 rounded border border-blue-800/40 text-xs">smtp.zoho.com</code> &nbsp; Port: <code className="bg-[#09090C] px-2 py-0.5 rounded border border-blue-800/40 text-xs">465 (SSL)</code> or <code className="bg-[#09090C] px-2 py-0.5 rounded border border-blue-800/40 text-xs">587 (TLS)</code></p>
                  <p className="text-[11px] text-blue-400/80">Use Zoho App-Specific Password for authenticating mail transactions.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host" className="text-xs font-bold text-zinc-300">SMTP Host</Label>
                    <Input
                      id="smtp-host"
                      placeholder="smtp.zoho.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port" className="text-xs font-bold text-zinc-300">SMTP Port</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="smtp-port"
                        type="number"
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(Number(e.target.value))}
                        className="w-24 bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs"
                      />
                      <div className="flex items-center space-x-2 ml-2">
                        <Switch id="smtp-secure" checked={smtpSecure} onCheckedChange={setSmtpSecure} />
                        <Label htmlFor="smtp-secure" className="text-xs font-semibold text-zinc-400">SSL</Label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-user" className="text-xs font-bold text-zinc-300">Email / Username</Label>
                    <Input
                      id="smtp-user"
                      placeholder="vision2020@sankaraeye.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-pass" className="text-xs font-bold text-zinc-300">Password / App Password</Label>
                    <Input
                      id="smtp-pass"
                      type="password"
                      placeholder="Email password or App Password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from" className="text-xs font-bold text-zinc-300">From Email Address</Label>
                    <Input
                      id="smtp-from"
                      placeholder="vision2020@sankaraeye.com"
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-name" className="text-xs font-bold text-zinc-300">From Name</Label>
                    <Input
                      id="smtp-name"
                      placeholder="Vision 2020 Conference"
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs"
                    />
                  </div>
                </div>

                {/* Test SMTP Block */}
                <div className="mt-6 pt-4 border-t border-[#23232A] space-y-4 bg-[#0C0C0F] p-5 rounded-2xl border border-dashed border-[#2B2B35]">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Test SMTP Connection</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="test-email" className="text-xs font-bold text-zinc-300">Receiver Email ID</Label>
                      <Input
                        id="test-email"
                        placeholder="test@example.com"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="test-message" className="text-xs font-bold text-zinc-300">Custom Test Message (Optional)</Label>
                      <Input
                        id="test-message"
                        placeholder="e.g. Greetings from Zoho SMTP!"
                        value={testEmailMessage}
                        onChange={(e) => setTestEmailMessage(e.target.value)}
                        className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      onClick={handleSendTestEmail}
                      disabled={sendingTestEmail || !testEmailAddress}
                      variant="outline"
                      className="border-[#2B2B35] bg-[#181820] text-blue-400 hover:bg-[#20202A] font-bold text-xs rounded-xl h-10 px-5"
                    >
                      {sendingTestEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                      Send Test Email
                    </Button>
                  </div>
                </div>
              </div>

              {/* Razorpay Payment Gateway Section */}
              <div className="space-y-4 pt-4 border-t border-[#23232A]">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-white text-sm">Razorpay Payment Gateway (Global Fallback)</h3>
                </div>
                <div className="bg-amber-950/20 p-4 rounded-2xl border border-amber-900/40 text-xs text-amber-200 leading-relaxed">
                  <p className="font-bold mb-0.5">💳 Online Delegate Registration Payments</p>
                  <p className="text-amber-300/80">Configure default Razorpay credentials used for paid event registrations. You can also override keys on a per-event basis inside the Events Manager.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="razorpay-key-id" className="text-xs font-bold text-zinc-300">Razorpay Key ID</Label>
                    <Input
                      id="razorpay-key-id"
                      placeholder="rzp_live_xxxxxxxxxxxxxxxx"
                      value={razorpayKeyId}
                      onChange={(e) => setRazorpayKeyId(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="razorpay-key-secret" className="text-xs font-bold text-zinc-300">Razorpay Key Secret</Label>
                    <Input
                      id="razorpay-key-secret"
                      type="password"
                      placeholder="••••••••••••••••••••••••"
                      value={razorpayKeySecret}
                      onChange={(e) => setRazorpayKeySecret(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Google OAuth Single Sign-On Section */}
              <div className="space-y-4 pt-4 border-t border-[#23232A]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <h3 className="font-bold text-white text-sm">Google OAuth 2.0 (Single Sign-On Login)</h3>
                  </div>
                  {googleClientId ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/60">
                      <ShieldCheck className="w-3 h-3 text-blue-400" /> Configured
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-zinc-500">Not configured (optional)</span>
                  )}
                </div>
                <div className="bg-blue-950/20 p-4 rounded-2xl border border-blue-900/40 text-xs text-blue-200 leading-relaxed space-y-1.5">
                  <p className="font-bold text-blue-300">🔑 Instant 1-Click Attendee Login with Google</p>
                  <p className="text-blue-200/80">
                    Allows delegates and staff to sign in instantly using their official Google or Google Workspace email address. Obtain these credentials from the Google Cloud Console (<code className="text-blue-300 bg-[#09090C] px-1.5 py-0.5 rounded">console.cloud.google.com/apis/credentials</code>).
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="google-client-id" className="text-xs font-bold text-zinc-300">Google Client ID</Label>
                    <Input
                      id="google-client-id"
                      placeholder="xxxx-xxxxxxxx.apps.googleusercontent.com"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="google-client-secret" className="text-xs font-bold text-zinc-300">Google Client Secret</Label>
                    <div className="relative">
                      <Input
                        id="google-client-secret"
                        type={showGoogleSecret ? "text" : "password"}
                        placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                        value={googleClientSecret}
                        onChange={(e) => setGoogleClientSecret(e.target.value)}
                        className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGoogleSecret(!showGoogleSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                      >
                        {showGoogleSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google-callback-url" className="text-xs font-bold text-zinc-300">Authorized Redirect / Callback URI</Label>
                  <div className="flex gap-2">
                    <Input
                      id="google-callback-url"
                      placeholder="https://events.sankaraeye.in/api/auth/google/callback"
                      value={googleCallbackUrl}
                      onChange={(e) => setGoogleCallbackUrl(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(googleCallbackUrl || "https://events.sankaraeye.in/api/auth/google/callback");
                        toast({ title: "Copied Callback URL", description: "Paste this into Google Cloud Console Authorized Redirect URIs." });
                      }}
                      className="h-11 px-4 rounded-xl border-[#2B2B35] bg-[#181820] text-zinc-300 hover:text-white text-xs font-bold shrink-0 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy URI
                    </Button>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Add this exact URL under <strong>Authorized redirect URIs</strong> in your Google Cloud OAuth 2.0 Client ID settings.
                  </p>
                </div>
              </div>

              {/* Google Wallet Passes API Section */}
              <div className="space-y-4 pt-4 border-t border-[#23232A]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white text-sm">Google Wallet Passes API (Digital Event Tickets)</h3>
                  </div>
                  {googleWalletServiceAccountEmail ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                      <CheckCircle className="w-3 h-3 text-emerald-400" /> Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-zinc-500">Not configured (optional)</span>
                  )}
                </div>
                <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-900/40 text-xs text-emerald-200 leading-relaxed space-y-1.5">
                  <p className="font-bold text-emerald-300">📲 Native "Add to Google Wallet" Pass Provisioning</p>
                  <p className="text-emerald-200/80">
                    Enables attendees to save their QR conference passes and entry badges directly to Google Wallet on Android / iOS devices. Configured via the Google Pay &amp; Wallet Console (<code className="text-emerald-300 bg-[#09090C] px-1.5 py-0.5 rounded">pay.google.com/business/console</code>).
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wallet-issuer-id" className="text-xs font-bold text-zinc-300">Google Wallet Issuer ID</Label>
                    <Input
                      id="wallet-issuer-id"
                      placeholder="3388000000023186695"
                      value={googleWalletIssuerId}
                      onChange={(e) => setGoogleWalletIssuerId(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wallet-service-email" className="text-xs font-bold text-zinc-300">Service Account Email</Label>
                    <Input
                      id="wallet-service-email"
                      placeholder="wallet-service@project.iam.gserviceaccount.com"
                      value={googleWalletServiceAccountEmail}
                      onChange={(e) => setGoogleWalletServiceAccountEmail(e.target.value)}
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="wallet-private-key" className="text-xs font-bold text-zinc-300">
                      Service Account Private Key (RSA PEM Certificate)
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowWalletKey(!showWalletKey)}
                      className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {showWalletKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showWalletKey ? "Hide Key" : "Show Key"}</span>
                    </button>
                  </div>
                  <Textarea
                    id="wallet-private-key"
                    rows={showWalletKey ? 4 : 2}
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...&#10;-----END PRIVATE KEY-----"
                    value={googleWalletPrivateKey}
                    onChange={(e) => setGoogleWalletPrivateKey(e.target.value)}
                    className="font-mono text-xs rounded-xl bg-[#09090C] border-[#2B2B35] text-white"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Paste the private key from your Google Cloud Service Account JSON file (<code className="text-zinc-400">private_key</code> field).
                  </p>
                </div>
              </div>

              {/* AI Chatbot & LLM Engine Keys Section */}
              <div className="space-y-4 pt-4 border-t border-[#23232A]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <h3 className="font-bold text-white text-sm">AI Assistant &amp; Chatbot LLM Engines</h3>
                  </div>
                  {geminiApiKey || hfToken ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-950/80 text-violet-300 border border-violet-800/60">
                      <Bot className="w-3 h-3 text-violet-400" /> AI Enabled
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-zinc-500">Local grounded mode</span>
                  )}
                </div>
                <div className="bg-violet-950/20 p-4 rounded-2xl border border-violet-900/40 text-xs text-violet-200 leading-relaxed space-y-1.5">
                  <p className="font-bold text-violet-300">🤖 Intelligent Conference Delegate Support</p>
                  <p className="text-violet-200/80">
                    Powers the 24/7 AI chatbot with accurate hospital knowledge, event schedules, maps, and ticketing support. Uses Google Gemini 2.0 Flash as the primary high-speed model with Meta Llama 3.3 70B as an automatic fallback.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gemini-key" className="text-xs font-bold text-zinc-300">Google Gemini API Key (Primary)</Label>
                    <div className="relative">
                      <Input
                        id="gemini-key"
                        type={showGeminiKey ? "text" : "password"}
                        placeholder="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                      >
                        {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500">Obtain free API keys from <code className="text-zinc-400">aistudio.google.com</code></p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hf-token" className="text-xs font-bold text-zinc-300">Hugging Face API Token (Fallback)</Label>
                    <div className="relative">
                      <Input
                        id="hf-token"
                        type={showHfToken ? "text" : "password"}
                        placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={hfToken}
                        onChange={(e) => setHfToken(e.target.value)}
                        className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowHfToken(!showHfToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                      >
                        {showHfToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500">Obtain User Access Tokens from <code className="text-zinc-400">huggingface.co/settings/tokens</code></p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#23232A] flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                  className="bg-white hover:bg-zinc-200 text-zinc-950 shadow-md font-bold text-xs uppercase tracking-wider rounded-xl h-11 px-6 flex items-center gap-2 cursor-pointer"
                >
                  {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />}
                  Save Settings &amp; APIs
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Master Excel Database Import */}
        <TabsContent value="sync" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Local Template Upload */}
            <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <Upload className="w-5 h-5 text-violet-400" />
                    Local Excel File Import
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Upload an Excel file to run a one-time synchronization update of the portal database.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl border border-amber-900/40 bg-amber-950/20 gap-4">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      Excel Format Template
                    </div>
                    <p className="text-[11px] text-amber-200/70 leading-normal">
                      Multi-sheet template containing tabs for each role.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-700/50 text-amber-300 hover:bg-amber-950/60 font-bold gap-1.5 text-xs rounded-xl h-9"
                    onClick={() => {
                      window.location.href = "/vision2020_attendees_template.xlsx";
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                </div>

                <div className="rounded-2xl border border-dashed border-[#2B2B35] bg-[#0C0C0F] p-6 text-center flex flex-col items-center justify-center space-y-2">
                  <Upload className="w-8 h-8 text-zinc-500 mb-1" />
                  <span className="text-xs font-bold text-white">
                    Upload Excel file (.xlsx, .xls)
                  </span>
                  <span className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                    Chair, Co-Chair, Moderator, Panelist, Speaker, and Poster sheets.
                  </span>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="file"
                      id="csv-file-input"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("csv-file-input")?.click()}
                      className="bg-[#181820] hover:bg-[#22222C] border-[#30303D] text-white font-bold text-xs rounded-xl h-9"
                    >
                      Select File
                    </Button>
                    {syncFile && (
                      <span className="text-xs text-zinc-300 font-mono truncate max-w-[150px]">{syncFile.name}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-[#23232A]">
                <Button
                  onClick={handleSyncSubmit}
                  disabled={syncing || !syncFile}
                  className="bg-white hover:bg-zinc-200 text-zinc-950 shadow-md font-bold text-xs uppercase tracking-wider rounded-xl h-11 px-6 gap-2 w-full sm:w-auto"
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-zinc-950" />
                  )}
                  {syncing ? "Uploading & Importing…" : "Import Local Excel"}
                </Button>
              </div>
            </div>

            {/* Paid List Sync Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    Sync Paid Participant List
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Upload management paid export to mark participants as paid and import new delegates.
                  </p>
                </div>

                <div className="bg-emerald-950/20 rounded-2xl border border-emerald-900/40 p-4 text-xs text-emerald-200 leading-relaxed font-semibold space-y-1">
                  <p>✅ Matches by mobile, email, or registration number</p>
                  <p>✅ Automatically marks unverified attendees as <strong>Paid</strong></p>
                  <p>✅ Imports completely new attendees seamlessly</p>
                </div>

                <div className="flex flex-col items-center justify-center border border-dashed border-[#2B2B35] rounded-2xl p-6 text-center gap-2 bg-[#0C0C0F]">
                  <Upload className="w-8 h-8 text-emerald-400 mb-1" />
                  <span className="text-xs font-bold text-white">Upload paid list Excel (.xlsx)</span>
                  <span className="text-[11px] text-zinc-500 max-w-xs">Standard format from management registration exports</span>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="file"
                      id="paid-list-input"
                      accept=".xlsx,.xls"
                      onChange={(e) => { if (e.target.files?.[0]) { setPaidListFile(e.target.files[0]); setPaidListResult(null); } }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("paid-list-input")?.click()}
                      className="bg-[#181820] hover:bg-[#22222C] border-[#30303D] text-white font-bold text-xs rounded-xl h-9"
                    >
                      Select File
                    </Button>
                    {paidListFile && (
                      <span className="text-xs text-zinc-300 font-mono truncate max-w-[150px]">{paidListFile.name}</span>
                    )}
                  </div>
                </div>

                {paidListResult && (
                  <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-4 text-xs space-y-1 font-semibold text-emerald-200">
                    <p className="font-bold text-emerald-300">✅ Sync Complete — {paidListResult.total} rows processed</p>
                    <p>• <strong>{paidListResult.matched}</strong> newly marked as paid</p>
                    <p>• <strong>{paidListResult.newlyImported}</strong> new participants imported</p>
                    <p>• <strong>{paidListResult.alreadyPaid}</strong> already paid (skipped)</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-[#23232A]">
                <Button
                  onClick={handlePaidListSync}
                  disabled={paidListSyncing || !paidListFile}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-md font-bold text-xs uppercase tracking-wider rounded-xl h-11 px-6 gap-2 w-full sm:w-auto"
                >
                  {paidListSyncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : <><RefreshCw className="w-4 h-4" /> Sync Paid List</>}
                </Button>
              </div>
            </div>
          </div>

          {/* Combined Sync Results View */}
          {syncResult && (
            <div className="p-6 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-4">
              <div className="p-4 rounded-2xl border bg-[#0C0C0F] border-[#23232A] space-y-3">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Sync / Import Summary Result
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#14141A] p-4 rounded-xl border border-[#2B2B35] text-center">
                    <div className="text-3xl font-extrabold text-emerald-400 font-mono">{syncResult.imported}</div>
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Imported</div>
                  </div>
                  <div className="bg-[#14141A] p-4 rounded-xl border border-[#2B2B35] text-center">
                    <div className="text-3xl font-extrabold text-amber-400 font-mono">{syncResult.skipped}</div>
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Skipped</div>
                  </div>
                  <div className="bg-[#14141A] p-4 rounded-xl border border-[#2B2B35] text-center">
                    <div className="text-3xl font-extrabold text-rose-400 font-mono">{syncResult.errors.length}</div>
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Errors</div>
                  </div>
                </div>
              </div>

              {syncResult.errors.length > 0 && (
                <div className="p-4 rounded-2xl border border-rose-900/40 bg-rose-950/20 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    Reconciliation Sync Details / Warnings ({syncResult.errors.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-[#09090C] p-3 rounded-xl border border-rose-900/30 font-mono text-[11px] leading-relaxed text-rose-300">
                    {syncResult.errors.map((err, idx) => (
                      <div key={idx} className="border-b border-rose-950 pb-1 last:border-0 last:pb-0">
                        • {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab 4: ID Card & Scanner QR Codes */}
        <TabsContent value="idcard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Scanners & Links */}
            <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-4">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-violet-400" />
                  System Scanner Access &amp; QR Codes
                </h3>
                <p className="text-xs text-zinc-400">
                  Scan or launch direct terminals on mobile devices for attendance, food, or slide uploads.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  {
                    name: "Gate Attendance Scanner",
                    desc: "Check-in staff at the main hall and registration desk.",
                    url: `${window.location.origin}/admin/attendance-scanner`,
                    icon: Smartphone,
                    color: "text-emerald-400 bg-emerald-950/60 border-emerald-800/50",
                  },
                  {
                    name: "Food Claim Scanner",
                    desc: "Dining hall and catering scan counters.",
                    url: `${window.location.origin}/admin/food-scanner`,
                    icon: Smartphone,
                    color: "text-blue-400 bg-blue-950/60 border-blue-800/50",
                  },
                  {
                    name: "Tracks & Flyer RSVP Page",
                    desc: "Delegate self-service track selection & RSVPs.",
                    url: `${window.location.origin}/flyer`,
                    icon: FileText,
                    color: "text-purple-400 bg-purple-950/60 border-purple-800/50",
                  },
                  {
                    name: "Presenter Slide Uploader",
                    desc: "Standalone portal for speaker PPTX uploads.",
                    url: `${window.location.origin}/file-submission`,
                    icon: Upload,
                    color: "text-amber-400 bg-amber-950/60 border-amber-800/50",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border border-[#23232A] bg-[#0C0C0F]">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-xl border ${item.color}`}>
                          <item.icon className="w-4 h-4" />
                        </span>
                        <h4 className="font-bold text-white text-sm">{item.name}</h4>
                      </div>
                      <p className="text-xs text-zinc-400 leading-normal">{item.desc}</p>
                      <code className="text-[10px] text-zinc-400 font-mono block break-all pt-1 select-all bg-[#09090C] py-1 px-2 rounded-lg border border-[#252530]">{item.url}</code>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0 bg-white p-2.5 rounded-2xl shadow-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(item.url)}`}
                        alt={`${item.name} QR`}
                        className="w-20 h-20 object-contain"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(item.url, "_blank")}
                        className="h-7 text-[10px] font-bold flex items-center gap-1 border-zinc-300 text-zinc-800 hover:bg-zinc-100 rounded-lg cursor-pointer"
                      >
                        Open <ExternalLink className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trifold Flyer Content */}
            <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-4">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Trifold Flyer Content &amp; Guide
                </h3>
                <p className="text-xs text-zinc-400">
                  Instruction reference printed on badges and trifold brochures given to delegates.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-[#0C0C0F] border border-[#23232A] space-y-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wide border-b border-[#23232A] pb-1.5 flex items-center justify-between">
                    <span>Section 1: Badge QR Activation</span>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px] font-bold">Backside QR</Badge>
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    <strong>1. Welcome to Sankara Events!</strong> Scan the QR code printed on the backside of your badge to access the Conference Portal.
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    <strong>2. Passcode Initialization:</strong> Enter registered email and create your 6-digit access PIN.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#0C0C0F] border border-[#23232A] space-y-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wide border-b border-[#23232A] pb-1.5 flex items-center justify-between">
                    <span>Section 2: Tracks &amp; RSVPs</span>
                    <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[9px] font-bold">Flyer QR</Badge>
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                    <strong>3. Personal Agenda:</strong> Explore track sessions, use time filters, and mark <em>"Wish to Attend"</em> to save seats.
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    <strong>4. PPTX Slide Uploads:</strong> Speakers upload presentations directly to the hall projection queue.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#0C0C0F] border border-[#23232A] space-y-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wide border-b border-[#23232A] pb-1.5 flex items-center justify-between">
                    <span>Section 3: Fast Gate Scans</span>
                    <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[9px] font-bold">Frontside QR</Badge>
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    <strong>5. Keep Your Badge Handy:</strong> Present frontside QR at check-in gates, food sessions, and kit distribution points.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Export Data */}
        <TabsContent value="export" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Delegates Export */}
            <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    Delegates Excel Export
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Download full delegate registration workbook with active QR code links for ID card mail-merge printing.
                  </p>
                </div>

                <div className="bg-[#0C0C0F] rounded-2xl border border-[#23232A] p-4 text-xs text-zinc-300 space-y-1.5 font-semibold">
                  <p>✅ Registration Number, Name, Institution</p>
                  <p>✅ Mobile, Email, Payment Status, UTR</p>
                  <p>✅ Role(s), Track(s), Session Assignments</p>
                  <p>✅ Delegate Type, Sponsor Info &amp; On-Spot Flags</p>
                  <p className="text-emerald-400 font-bold pt-1">🔗 Direct QR Code Image URLs for variable ID printing</p>
                </div>
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-xl gap-2 cursor-pointer shadow-lg"
                onClick={() => {
                  window.location.href = `/api/participants/export?token=${encodeURIComponent(token || "")}`;
                }}
              >
                <Download className="w-4 h-4" /> Download Delegates Excel
              </Button>
            </div>

            {/* Full System Export */}
            {(user?.userType === "super_admin") && (
              <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-400" />
                      Full System Backup Export
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Complete multi-sheet workbook dump across all tables for audit, backup, and post-conference analysis.
                    </p>
                  </div>

                  <div className="bg-[#0C0C0F] rounded-2xl border border-[#23232A] p-4 text-xs text-zinc-300 space-y-1.5 font-semibold">
                    <p>📋 Sheet 1: All Participants &amp; Registrations</p>
                    <p>📋 Sheet 2: Agenda &amp; Speaker Timetable Mappings</p>
                    <p>📋 Sheet 3: Real-Time Attendance Verification Logs</p>
                    <p>📋 Sheet 4: Dining Hall &amp; Meal Redemption Logs</p>
                    <p>📋 Sheet 5: Comprehensive Security &amp; Activity Trail</p>
                  </div>
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-11 rounded-xl gap-2 cursor-pointer shadow-lg"
                  onClick={() => {
                    window.location.href = `/api/participants/export/full?token=${encodeURIComponent(token || "")}`;
                  }}
                >
                  <Download className="w-4 h-4" /> Download Full System Export
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 6: Danger Zone */}
        {(user?.userType as string) === "super_admin" && (
          <TabsContent value="danger" className="space-y-4">
            <div className="p-6 sm:p-7 rounded-3xl bg-rose-950/20 border border-rose-900/50 shadow-2xl space-y-6">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                  Erase All Conference Data (Reset Portal)
                </h3>
                <p className="text-xs text-rose-400/80 leading-relaxed">
                  Permanently deletes attendee registrations, timetable assignments, and uploaded files. Designed for preparing a clean portal instance for a fresh conference.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#0C0C0F] border border-rose-900/30 text-xs text-zinc-300 space-y-2">
                <p className="font-bold text-white">Performing this action permanently erases:</p>
                <ul className="list-disc list-inside space-y-1 text-zinc-400">
                  <li>All participant profile records &amp; delegate entries</li>
                  <li>All speaker assignments, lecture files, and uploaded presentations</li>
                  <li>All attendance check-in timestamps and food logs</li>
                  <li>All RSVP preferences and session tracking entries</li>
                </ul>
                <p className="text-[11px] text-amber-400 font-semibold pt-1">
                  Note: Super Admin/Staff user accounts, WhatsApp configurations, and SMTP keys will remain preserved.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purge-confirm" className="font-bold text-white text-xs">
                  Type <span className="font-mono text-rose-400">PURGE</span> to confirm reset:
                </Label>
                <Input
                  id="purge-confirm"
                  value={purgeConfirm}
                  onChange={(e) => setPurgeConfirm(e.target.value)}
                  placeholder="PURGE"
                  className="font-mono max-w-xs bg-[#09090C] border-rose-800/50 text-white rounded-xl h-11 text-xs"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-rose-900/30">
                <Button
                  onClick={handlePurgeAllData}
                  disabled={purging || purgeConfirm !== "PURGE"}
                  className="bg-rose-600 hover:bg-rose-500 text-white shadow-md font-bold text-xs uppercase tracking-wider rounded-xl h-11 px-6 flex items-center gap-2"
                >
                  {purging ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  {purging ? "Purging all data..." : "Permanently Reset Portal Data"}
                </Button>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
