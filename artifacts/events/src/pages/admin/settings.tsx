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
  Tv
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
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);

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
      setSessionTimeoutMinutes((settings as any).sessionTimeoutMinutes ?? 30);
      setGoogleSheetUrl((settings as any).googleSheetUrl || "");
      setConferenceMapUrl((settings as any).conferenceMapUrl || "");
      setLiveTvUrl((settings as any).liveTvUrl || "");
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
          sessionTimeoutMinutes: Number(sessionTimeoutMinutes),
          googleSheetUrl,
          conferenceMapUrl,
          liveTvUrl,
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500 mt-1">Configure OTP modes, API credentials, and sync attendee databases</p>
      </div>

      <Tabs defaultValue="submissions" className="w-full">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-xl h-auto flex flex-wrap sm:inline-flex mb-6">
          <TabsTrigger value="submissions" className="rounded-lg py-2.5 px-4 font-medium text-sm gap-2">
            <Settings className="w-4 h-4" /> Submissions &amp; OTP
          </TabsTrigger>
          <TabsTrigger value="apis" className="rounded-lg py-2.5 px-4 font-medium text-sm gap-2">
            <MessageSquare className="w-4 h-4" /> APIs &amp; Integrations
          </TabsTrigger>
          {(user?.userType as string) === "super_admin" && (
            <TabsTrigger value="sync" className="rounded-lg py-2.5 px-4 font-medium text-sm gap-2">
              <Upload className="w-4 h-4" /> Master Excel Import
            </TabsTrigger>
          )}
          <TabsTrigger value="idcard" className="rounded-lg py-2.5 px-4 font-medium text-sm gap-2">
            <QrCode className="w-4 h-4" /> ID Card &amp; Scanner QR Codes
          </TabsTrigger>

          <TabsTrigger value="export" className="rounded-lg py-2.5 px-4 font-medium text-sm gap-2 text-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <FileSpreadsheet className="w-4 h-4" /> Export Data
          </TabsTrigger>

          {(user?.userType as string) === "super_admin" && (
            <TabsTrigger value="danger" className="rounded-lg py-2.5 px-4 font-bold text-sm gap-2 text-red-600 hover:text-red-700 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <AlertTriangle className="w-4 h-4" /> Danger Zone
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Submissions & OTP */}
        <TabsContent value="submissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Secure Upload Portal Settings</CardTitle>
              <CardDescription>Configure file submission windows and verification methods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="space-y-0.5">
                  <Label htmlFor="submissions-open" className="text-base font-semibold text-gray-800">
                    File Submissions Open
                  </Label>
                  <p className="text-sm text-gray-400">Allows speakers and presenters to submit presentation files.</p>
                </div>
                <Switch
                  id="submissions-open"
                  checked={submissionsOpen}
                  onCheckedChange={setSubmissionsOpen}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="otp-mode" className="font-semibold text-gray-800">
                    OTP Verification Mode
                  </Label>
                  <Select value={otpMode} onValueChange={setOtpMode}>
                    <SelectTrigger id="otp-mode">
                      <SelectValue placeholder="Select OTP Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Static (Test OTPs only)</SelectItem>
                      <SelectItem value="dynamic">Dynamic (Generate real-time codes)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400">
                    {otpMode === "static"
                      ? "Allows users to verify identity by entering any of the test OTPs."
                      : "Generates unique random codes (logged to server console/WhatsApp/Email)."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-otps" className="font-semibold text-gray-800">
                    Static Test OTPs
                  </Label>
                  <Input
                    id="test-otps"
                    value={testOtps}
                    onChange={(e) => setTestOtps(e.target.value)}
                    placeholder="111111,222222,333333"
                  />
                  <p className="text-xs text-gray-400">Comma-separated list of valid OTP codes when Static mode is selected.</p>
                </div>
              </div>

              {/* Route Map Upload Section — Super Admin Only */}
              <div className="pt-6 border-t border-gray-100 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#F58220]" /> Route Map PDF (Public Link)
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="font-semibold text-gray-800 block">Conference Route Map</Label>
                      <p className="text-xs text-gray-500 leading-normal">
                        Upload the venue route/layout map PDF. Once uploaded, it will be publicly accessible at the link below — no login required.
                      </p>
                    </div>
                  </div>

                  {/* Fixed Public URL display */}
                  <div className="bg-white border border-amber-300 rounded-lg p-3 space-y-2">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">📎 Public URL (shareable)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-200 break-all select-all">
                        https://events.sankaraeye.in/api/routemap.pdf
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("https://events.sankaraeye.in/api/routemap.pdf");
                          toast({ title: "Link copied!", description: "Route map URL copied to clipboard." });
                        }}
                        className="shrink-0 h-8 px-3 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold text-xs transition-all border border-indigo-200"
                      >
                        Copy
                      </button>
                      {conferenceMapUrl && (
                        <a
                          href="/api/routemap.pdf"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 h-8 px-3 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-bold text-xs transition-all border border-green-200 flex items-center gap-1"
                        >
                          View PDF
                        </a>
                      )}
                    </div>
                    {conferenceMapUrl ? (
                      <p className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
                        ✅ Route map is live — currently uploaded
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                        ⚠️ No route map uploaded yet — this URL will return 404 until you upload
                      </p>
                    )}
                  </div>

                  {/* Upload button */}
                  <div className="flex items-center gap-3 pt-1">
                    <label className={`h-10 px-5 rounded-xl border border-slate-300 bg-white hover:bg-orange-50 hover:border-orange-400 text-slate-700 font-bold transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm ${mapUploading ? "opacity-50 pointer-events-none" : ""}`}>
                      <Upload className="w-4 h-4" />
                      {mapUploading ? "Uploading..." : conferenceMapUrl ? "Replace Route Map PDF" : "Upload Route Map PDF"}
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleMapUpload}
                        className="hidden"
                        disabled={mapUploading}
                      />
                    </label>
                    <p className="text-[10px] text-gray-400">Only PDF files • Replaces the current map immediately</p>
                  </div>
                </div>
              </div>

              {/* Live TV / Webcast URL Section */}
              <div className="pt-6 border-t border-gray-100 space-y-4 text-left">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Tv className="w-4 h-4 text-[#F58220]" /> Live TV / Webcast URL
                </h3>
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <Label htmlFor="live-tv-url" className="font-semibold text-gray-800 block text-left">Live Stream Link</Label>
                  <p className="text-xs text-gray-500 leading-normal mb-2 text-left">
                    Enter the URL to the live TV webcast (e.g. YouTube stream, Zoom webcast, or custom webcast platform URL) to be broadcasted on the Live Dashboard.
                  </p>
                  <Input
                    id="live-tv-url"
                    type="url"
                    placeholder="https://www.youtube.com/embed/live_stream_id or custom webcast URL"
                    value={liveTvUrl}
                    onChange={(e) => setLiveTvUrl(e.target.value)}
                    className="h-10 bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                  className="bg-[#F58220] hover:bg-[#e07010] text-white shadow-sm font-semibold"
                >
                  {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Configurations
                </Button>
              </div>

              {/* Session Timeout — super_admin only */}
              {(user as any)?.userType === "super_admin" && (
                <div className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-red-700">⭐ Super Admin: Session Timeout Control</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      id="session-timeout"
                      type="number"
                      min={1}
                      max={480}
                      value={sessionTimeoutMinutes}
                      onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                      className="w-28 h-9 font-mono"
                    />
                    <Label htmlFor="session-timeout" className="text-sm text-red-700 font-medium">
                      minutes (1–480). Currently {sessionTimeoutMinutes} min ≈ {Math.round(sessionTimeoutMinutes / 60 * 10) / 10}h.
                    </Label>
                  </div>
                  <p className="text-xs text-red-500">Controls how long all user sessions stay active. Click "Save Configurations" above to apply.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: APIs & Integrations */}
        <TabsContent value="apis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API &amp; SMTP Credentials</CardTitle>
              <CardDescription>Setup messaging server tokens and email client details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* WhatsApp Config */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-600" /> WhatsApp Integration Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wa-key">API Token / Key</Label>
                    <Input
                      id="wa-key"
                      type="password"
                      placeholder="Enter API Key"
                      value={whatsappApiKey}
                      onChange={(e) => setWhatsappApiKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-instance">Instance ID / Sender Number</Label>
                    <Input
                      id="wa-instance"
                      placeholder="e.g. 123456"
                      value={whatsappInstanceId}
                      onChange={(e) => setWhatsappInstanceId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-6 pt-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
                    <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#F58220]" /> WhatsApp Template Configurations
                    </div>
                    <p className="leading-relaxed font-semibold">
                      Configure how each message is dispatched. Choose <strong>Meta Template</strong> to trigger pre-registered templates on your WhatsApp Business Account. Choose <strong>Custom Text</strong> to draft plain text messages with custom copy and emojis.
                    </p>
                  </div>

                  {/* 1. OTP LOGIN TEMPLATE */}
                  <div className="space-y-3 p-4 border border-slate-150 rounded-2xl bg-white shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <Label htmlFor="wa-otp-template" className="font-bold text-xs text-slate-800">
                        1st Key: OTP Login Template
                      </Label>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setWaOtpMode("template");
                            if (waOtpTemplate.includes(" ")) setWaOtpTemplate("vision2020_otp");
                          }}
                          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${waOtpMode === "template" ? "bg-white text-slate-850 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Approved Meta Template Name
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWaOtpMode("text");
                            if (waOtpTemplate === "vision2020_otp") setWaOtpTemplate("Your verification code (OTP) for the Vision 2020 Conference login is {{otp}}. For security, please do not share this passcode with anyone. This code is valid for 10 minutes.");
                          }}
                          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${waOtpMode === "text" ? "bg-white text-slate-850 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
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
                        className="font-mono text-xs rounded-xl bg-white border-slate-300"
                      />
                    ) : (
                      <Textarea
                        id="wa-otp-template"
                        placeholder="Enter template message (use {{otp}} code variable)..."
                        value={waOtpTemplate}
                        onChange={(e) => setWaOtpTemplate(e.target.value)}
                        rows={2}
                        className="font-mono text-xs rounded-xl bg-white border-slate-300"
                      />
                    )}
                    <p className="text-[10px] text-gray-400">
                      {waOtpMode === "template"
                        ? "Register template on WhatsApp Dashboard. Default name: vision2020_otp"
                        : "Required placeholder: {{otp}} is replaced with the 6-digit login verification pin."}
                    </p>
                  </div>

                  {/* 2. ATTENDANCE SCANNED TEMPLATE */}
                  <div className="space-y-3 p-4 border border-slate-150 rounded-2xl bg-white shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <Label htmlFor="wa-att-template" className="font-bold text-xs text-slate-800">
                        2nd Key: Attendance Scanned Check-in Notification
                      </Label>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setWaAttendanceMode("template");
                            if (waAttendanceTemplate.includes(" ")) setWaAttendanceTemplate("vision2020_attendance_scanned");
                          }}
                          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${waAttendanceMode === "template" ? "bg-white text-slate-850 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Approved Meta Template Name
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWaAttendanceMode("text");
                            if (waAttendanceTemplate === "vision2020_attendance_scanned") setWaAttendanceTemplate("Hello {{1}}! 👋 Welcome to the {{2}}! 🌟 Your check-in has been successfully marked at {{3}} on {{4}}.");
                          }}
                          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${waAttendanceMode === "text" ? "bg-white text-slate-850 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
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
                        className="font-mono text-xs rounded-xl bg-white border-slate-300"
                      />
                    ) : (
                      <Textarea
                        id="wa-att-template"
                        placeholder="Enter custom template (use {{1}}, {{2}}, {{3}}, {{4}})..."
                        value={waAttendanceTemplate}
                        onChange={(e) => setWaAttendanceTemplate(e.target.value)}
                        rows={3}
                        className="font-mono text-xs rounded-xl bg-white border-slate-300"
                      />
                    )}
                    <p className="text-[10px] text-gray-400">
                      {waAttendanceMode === "template"
                        ? "Register template on WhatsApp Dashboard. Default name: vision2020_attendance_scanned"
                        : "Required placeholders: {{1}} = Name, {{2}} = Event title, {{3}} = Scan Time, {{4}} = Scan Date."}
                    </p>
                  </div>

                  {/* 3. FOOD TOKEN SCANNED TEMPLATE */}
                  <div className="space-y-3 p-4 border border-slate-150 rounded-2xl bg-white shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <Label htmlFor="wa-food-template" className="font-bold text-xs text-slate-800">
                        3rd Key: Food Token Scanned Notification
                      </Label>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setWaFoodMode("template");
                            if (waFoodTemplate.includes(" ")) setWaFoodTemplate("vision2020_food_scanned");
                          }}
                          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${waFoodMode === "template" ? "bg-white text-slate-850 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Approved Meta Template Name
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWaFoodMode("text");
                            if (waFoodTemplate === "vision2020_food_scanned") setWaFoodTemplate("Hello {{1}}! 👋 Hope you are having an insightful day! 🌟 Your food token for {{2}} has been successfully scanned at {{3}} on {{4}}. Enjoy your meal! 🍽️");
                          }}
                          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${waFoodMode === "text" ? "bg-white text-slate-850 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
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
                        className="font-mono text-xs rounded-xl bg-white border-slate-300"
                      />
                    ) : (
                      <Textarea
                        id="wa-food-template"
                        placeholder="Enter custom template (use {{1}}, {{2}}, {{3}}, {{4}})..."
                        value={waFoodTemplate}
                        onChange={(e) => setWaFoodTemplate(e.target.value)}
                        rows={3}
                        className="font-mono text-xs rounded-xl bg-white border-slate-300"
                      />
                    )}
                    <p className="text-[10px] text-gray-400">
                      {waFoodMode === "template"
                        ? "Register template on WhatsApp Dashboard. Default name: vision2020_food_scanned"
                        : "Required placeholders: {{1}} = Name, {{2}} = Meal Type (e.g. Lunch), {{3}} = Scan Time, {{4}} = Scan Date."}
                    </p>
                  </div>
                </div>

                {/* Test WhatsApp Block */}
                <div className="mt-6 pt-4 border-t border-gray-100 space-y-4 bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Test WhatsApp Templates</h4>
                  <div className="space-y-3">
                    <div className="max-w-md">
                      <Label htmlFor="test-mobile">Recipient Mobile Number</Label>
                      <Input
                        id="test-mobile"
                        placeholder="Enter mobile (e.g. 9876543210)"
                        value={testMobile}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTestMobile(val);
                        }}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Enter a 10-digit mobile number (India country code 91 is appended automatically) or a full international number with country code.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        onClick={() => handleSendTestWhatsapp("otp")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-green-200 text-green-700 hover:bg-green-50 font-semibold gap-1.5"
                      >
                        {testingWaType === "otp" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        OTP Template
                      </Button>
                      <Button
                        onClick={() => handleSendTestWhatsapp("welcome")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-green-200 text-green-700 hover:bg-green-50 font-semibold gap-1.5"
                      >
                        {testingWaType === "welcome" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Welcome Template
                      </Button>
                      <Button
                        onClick={() => handleSendTestWhatsapp("rsvp")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-green-200 text-green-700 hover:bg-green-50 font-semibold gap-1.5"
                      >
                        {testingWaType === "rsvp" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        RSVP Template
                      </Button>
                      <Button
                        onClick={() => handleSendTestWhatsapp("food")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-green-200 text-green-700 hover:bg-green-50 font-semibold gap-1.5"
                      >
                        {testingWaType === "food" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Food Scan Template
                      </Button>
                      <Button
                        onClick={() => handleSendTestWhatsapp("attendance")}
                        disabled={!!testingWaType || !testMobile}
                        variant="outline"
                        size="sm"
                        className="border-green-200 text-green-700 hover:bg-green-50 font-semibold gap-1.5"
                      >
                        {testingWaType === "attendance" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Attendance Scan Template
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" /> Email SMTP Credentials
                </h3>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">📧 Using Zoho Mail SMTP?</p>
                  <p>Host: <code className="bg-white px-1 rounded text-xs">smtp.zoho.com</code> &nbsp; Port: <code className="bg-white px-1 rounded text-xs">465 (SSL)</code> or <code className="bg-white px-1 rounded text-xs">587 (TLS)</code></p>
                  <p>For secure connection, use Zoho App-Specific Password (Zoho Account → Security → App Passwords).</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">SMTP Host</Label>
                    <Input
                      id="smtp-host"
                      placeholder="smtp.zoho.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">SMTP Port</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="smtp-port"
                        type="number"
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(Number(e.target.value))}
                        className="w-24"
                      />
                      <div className="flex items-center space-x-2 ml-2">
                        <Switch id="smtp-secure" checked={smtpSecure} onCheckedChange={setSmtpSecure} />
                        <Label htmlFor="smtp-secure" className="text-sm font-normal text-gray-600">Secure (SSL)</Label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-user">Email / Username</Label>
                    <Input
                      id="smtp-user"
                      placeholder="vision2020@sankaraeye.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-pass">Password / App Password</Label>
                    <Input
                      id="smtp-pass"
                      type="password"
                      placeholder="Email password or App Password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from">From Email Address</Label>
                    <Input
                      id="smtp-from"
                      placeholder="vision2020@sankaraeye.com"
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-name">From Name</Label>
                    <Input
                      id="smtp-name"
                      placeholder="Vision 2020 Conference"
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Test SMTP Block */}
                <div className="mt-6 pt-4 border-t border-gray-100 space-y-4 bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Test SMTP Connection</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="test-email">Receiver Email ID</Label>
                      <Input
                        id="test-email"
                        placeholder="test@example.com"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="test-message">Custom Test Message (Optional)</Label>
                      <Input
                        id="test-message"
                        placeholder="e.g. Greetings from Zoho SMTP!"
                        value={testEmailMessage}
                        onChange={(e) => setTestEmailMessage(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      onClick={handleSendTestEmail}
                      disabled={sendingTestEmail || !testEmailAddress}
                      variant="outline"
                      className="border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      {sendingTestEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                      Send Test Email
                    </Button>
                  </div>
                </div>
              </div>


              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                  className="bg-[#F58220] hover:bg-[#e07010] text-white shadow-sm font-semibold"
                >
                  {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Settings &amp; APIs
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Master Excel Database Import */}
        <TabsContent value="sync" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Local Template Upload */}
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Upload className="w-5 h-5 text-zinc-400" />
                  Local Excel File Import
                </CardTitle>
                <CardDescription>
                  Upload a local Excel spreadsheet file directly to run a one-time synchronization update of the portal database.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-orange-100 bg-orange-50/30 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-orange-800 flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5" />
                        Excel Format Template
                      </div>
                      <p className="text-[11px] text-gray-500 leading-normal">
                        Download the structured multi-sheet template containing tabs for each role.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-orange-200 text-orange-700 hover:bg-orange-100/50 w-full font-semibold gap-1.5 text-xs cursor-pointer"
                      onClick={() => {
                        window.location.href = "/vision2020_attendees_template.xlsx";
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </Button>
                  </div>

                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center flex flex-col items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-xs font-semibold text-gray-700 mb-0.5">
                      Upload Excel file (.xlsx, .xls)
                    </span>
                    <span className="text-[10px] text-gray-400 mb-3 max-w-xs">
                      Contains Chair, Co-Chair, Moderator, Panelist, Speaker, and Poster sheets.
                    </span>

                    <div className="flex items-center gap-2">
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
                        className="bg-white hover:bg-gray-50 font-semibold text-xs"
                      >
                        Select File
                      </Button>
                      {syncFile && (
                        <span className="text-xs text-gray-600 font-medium truncate max-w-[150px]">{syncFile.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100 mt-auto">
                  <Button
                    onClick={handleSyncSubmit}
                    disabled={syncing || !syncFile}
                    className="bg-[#F58220] hover:bg-[#e07010] text-white shadow-sm font-semibold gap-2 w-full sm:w-auto"
                  >
                    {syncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {syncing ? "Uploading & Importing…" : "Import Local Excel"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Paid List Sync Card */}
            <Card className="h-full flex flex-col border-emerald-100">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  Sync Paid Participant List
                </CardTitle>
                <CardDescription>
                  Upload the management's paid list Excel file to automatically mark participants as paid and import new ones.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 text-[11px] text-emerald-700 leading-relaxed font-semibold space-y-1">
                    <p>✅ Matches by mobile, email, or name</p>
                    <p>✅ Marks unverified participants as <strong>Paid</strong></p>
                    <p>✅ Imports completely new attendees</p>
                    <p>✅ Skips participants already marked paid</p>
                  </div>
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 rounded-xl p-5 text-center gap-2 bg-emerald-50/40">
                    <Upload className="w-7 h-7 text-emerald-400 mb-1" />
                    <span className="text-xs font-semibold text-gray-700">Upload paid list Excel (.xlsx)</span>
                    <span className="text-[10px] text-gray-400 max-w-xs">Same format as the management's registration export</span>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="file"
                        id="paid-list-input"
                        accept=".xlsx,.xls"
                        onChange={(e) => { if (e.target.files?.[0]) { setPaidListFile(e.target.files[0]); setPaidListResult(null); } }}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => document.getElementById("paid-list-input")?.click()}
                        className="bg-white hover:bg-emerald-50 font-semibold text-xs border-emerald-200">
                        Select File
                      </Button>
                      {paidListFile && (
                        <span className="text-xs text-gray-600 font-medium truncate max-w-[150px]">{paidListFile.name}</span>
                      )}
                    </div>
                  </div>
                  {paidListResult && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-1 font-semibold text-emerald-800">
                      <p>✅ Sync Complete — {paidListResult.total} rows processed</p>
                      <p>• <strong>{paidListResult.matched}</strong> newly marked as paid</p>
                      <p>• <strong>{paidListResult.newlyImported}</strong> new participants imported</p>
                      <p>• <strong>{paidListResult.alreadyPaid}</strong> already paid (skipped)</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-100 mt-auto">
                  <Button
                    onClick={handlePaidListSync}
                    disabled={paidListSyncing || !paidListFile}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold gap-2 w-full sm:w-auto"
                  >
                    {paidListSyncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : <><RefreshCw className="w-4 h-4" /> Sync Paid List</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Google Sheets Live Sync */}

            <Card className="h-full flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-500" />
                  Google Sheets Live Sync
                </CardTitle>
                <CardDescription>
                  Google Sheets integration is now configuration-driven. Manage sessions and mappings in the Sync Manager.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  {activeSession ? (
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-semibold text-slate-500">Active Sync Session</span>
                        <Badge className="bg-emerald-100 hover:bg-emerald-150 text-emerald-700 border-emerald-200 text-[10px]">Active</Badge>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Name:</span>
                          <span className="font-bold text-slate-800">{activeSession.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Location:</span>
                          <span className="font-semibold text-slate-700">{activeSession.locationName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Sheet ID:</span>
                          <span className="font-mono text-gray-500 max-w-[150px] truncate">{activeSession.googleSheetId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Tab / Sheet Name:</span>
                          <span className="text-slate-700 font-medium">{activeSession.sheetName || "(default)"}</span>
                        </div>
                      </div>
                      <div className="pt-2 flex justify-start">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation("/admin/sync-sessions")}
                          className="h-8 border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                        >
                          Modify Config &amp; Mappings
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-center">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                      <div className="text-xs font-semibold text-amber-800">No Active Sync Configuration</div>
                      <p className="text-[10px] text-amber-600 leading-normal">
                        You need to configure at least one event session and set it as active to use the Google Sheet synchronization features.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setLocation("/admin/sync-sessions")}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs mt-1 w-full"
                      >
                        Create Config Now
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100 mt-auto">
                  <Button
                    onClick={handleGoogleSheetsSync}
                    disabled={googleSyncing || !activeSession}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold gap-2 w-full sm:w-auto"
                  >
                    {googleSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {googleSyncing ? "Syncing with Sheets…" : "Sync Active Session"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Combined Sync Results View */}
          {syncResult && (
            <Card className="mt-6 border-gray-200">
              <CardContent className="pt-6 space-y-4">
                <div className="p-4 rounded-xl border bg-gray-50 border-gray-200 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-gray-800 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Sync / Import Summary Result
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-gray-100 text-center shadow-xs">
                      <div className="text-2xl font-extrabold text-green-600">{syncResult.imported}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Imported</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-100 text-center shadow-xs">
                      <div className="text-2xl font-extrabold text-amber-500">{syncResult.skipped}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Skipped</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-100 text-center shadow-xs">
                      <div className="text-2xl font-extrabold text-red-500">{syncResult.errors.length}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Errors</div>
                    </div>
                  </div>
                </div>

                {syncResult.errors.length > 0 && (
                  <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-red-800 text-sm">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      Reconciliation Sync Details / Warnings ({syncResult.errors.length})
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 bg-white p-3 rounded-lg border border-red-100 font-mono text-[11px] leading-relaxed text-red-700">
                      {syncResult.errors.map((err, idx) => (
                        <div key={idx} className="border-b border-red-50 pb-1 last:border-0 last:pb-0">
                          • {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 4: ID Card & Scanner QR Codes */}
        <TabsContent value="idcard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* System Scanners & Links */}
            <Card className="border-slate-200/80 shadow-md">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <QrCode className="w-5 h-5 text-purple-600" />
                  System Scanner Access & QR Codes
                </CardTitle>
                <CardDescription className="text-xs">
                  Scan or click these links to access the specific scanner tools and portals on mobile devices.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {[
                  {
                    name: "Gate Attendance Scanner",
                    desc: "Used by check-in staff at the main entrance.",
                    url: `${window.location.origin}/admin/attendance-scanner`,
                    icon: Smartphone,
                    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
                  },
                  {
                    name: "Food Claim Scanner",
                    desc: "Used by canteen staff at the dining counter.",
                    url: `${window.location.origin}/admin/food-scanner`,
                    icon: Smartphone,
                    color: "text-blue-600 bg-blue-50 border-blue-100",
                  },
                  {
                    name: "Tracks & Flyer RSVP Page",
                    desc: "Delegate self-service track selection & RSVPs.",
                    url: `${window.location.origin}/flyer`,
                    icon: FileText,
                    color: "text-purple-600 bg-purple-50 border-purple-100",
                  },
                  {
                    name: "Presenter Slide Uploader",
                    desc: "Standalone portal for presenter slide uploads.",
                    url: `${window.location.origin}/file-submission`,
                    icon: Upload,
                    color: "text-orange-600 bg-orange-50 border-orange-100",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-slate-150 bg-slate-50/50">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg border ${item.color}`}>
                          <item.icon className="w-4 h-4" />
                        </span>
                        <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                      </div>
                      <p className="text-xs text-gray-500 leading-normal">{item.desc}</p>
                      <code className="text-[10px] text-gray-400 font-mono block break-all pt-1 select-all bg-white py-0.5 px-1.5 rounded border">{item.url}</code>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(item.url)}`}
                        alt={`${item.name} QR`}
                        className="w-20 h-20 object-contain"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(item.url, "_blank")}
                        className="h-7 text-[10px] font-semibold flex items-center gap-1 border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        Open <ExternalLink className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Trifold Instruction Manual */}
            <Card className="border-slate-200/80 shadow-md">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <FileText className="w-5 h-5 text-[#F58220]" />
                  Trifold Flyer Content & Guide
                </CardTitle>
                <CardDescription className="text-xs">
                  Copy-paste this text configuration to print the trifold manual given to every delegate.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="p-4 rounded-xl bg-orange-50/25 border border-orange-100 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide border-b pb-1.5 flex items-center justify-between">
                    <span>Trifold Section 1: Welcome & Setup</span>
                    <Badge className="bg-[#F58220] hover:bg-[#F58220] text-white text-[9px] font-bold">Card Backside QR</Badge>
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <strong>1. Welcome to Vision2020 Conference!</strong><br />
                    Scan the QR code printed on the backside of your badge to access the Conference Portal.
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <strong>2. Initialize Passcode (No OTP required first time):</strong><br />
                    Enter your registered email address, then set your new 6-digit numeric login passcode.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-purple-50/25 border border-purple-100 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide border-b pb-1.5 flex items-center justify-between">
                    <span>Trifold Section 2: Tracks & RSVP Flyer</span>
                    <Badge className="bg-[#6F42C1] hover:bg-[#6F42C1] text-white text-[9px] font-bold">Flyer QR</Badge>
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    <strong>3. Personal Agenda & RSVPs:</strong><br />
                    Select your desired Track (Track 1 to 5.2). Use the 30-minute time filter or session index selector to find topics. Click <em>"Wish to Attend"</em> to RSVP.
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <strong>4. PowerPoint Slide Uploads:</strong><br />
                    If you are a speaker, proceed to the <em>"My Assignments"</em> tab to upload your slides (.pptx). It will auto-label and link directly to your hall projection desk.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-150 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide border-b pb-1.5 flex items-center justify-between">
                    <span>Trifold Section 3: Check-in & Coupons</span>
                    <Badge className="bg-slate-700 hover:bg-slate-700 text-white text-[9px] font-bold">Card Frontside QR</Badge>
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <strong>5. Keep Your Badge Handy:</strong><br />
                    Show the Frontside QR code at the registration gate, food counters, and gift kit counters. Staff will scan it to verify and record check-ins instantly.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tracks QR Code Generator */}
            <Card className="border-slate-200/80 shadow-md col-span-1 lg:col-span-2">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <QrCode className="w-5 h-5 text-[#F58220]" />
                  Track-Specific RSVP QR Code Generator
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate customized QR codes for specific track sessions so delegates can scan them in hall entrances to RSVP instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Select Track</Label>
                    <select
                      value={qrSelectedTrack}
                      onChange={(e) => setQrSelectedTrack(e.target.value)}
                      className="w-full h-10 text-xs rounded-xl border border-slate-250 bg-white px-3 outline-none focus:border-[#F58220] transition-colors cursor-pointer"
                    >
                      <option value="All Tracks">All Tracks (Main Page)</option>
                      <option value="Track 1">Track 1</option>
                      <option value="Track 2">Track 2</option>
                      <option value="Track 3">Track 3</option>
                      <option value="Track 4">Track 4</option>
                      <option value="Track 5 Hall A">Track 5 Hall A</option>
                      <option value="Track 5 Hall B">Track 5 Hall B</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs font-bold text-slate-700 font-mono">Target URL</Label>
                    <code className="text-[10px] text-gray-400 font-mono block break-all pt-2.5 select-all bg-white py-1.5 px-2 rounded border">
                      {qrSelectedTrack === "All Tracks"
                        ? `${window.location.origin}/tracks`
                        : `${window.location.origin}/tracks?track=${encodeURIComponent(qrSelectedTrack)}`
                      }
                    </code>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border border-slate-150 bg-slate-50/50 justify-center">
                  <div className="flex flex-col items-center gap-2 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        qrSelectedTrack === "All Tracks"
                          ? `${window.location.origin}/tracks`
                          : `${window.location.origin}/tracks?track=${encodeURIComponent(qrSelectedTrack)}`
                      )}`}
                      alt="Selected Track QR"
                      className="w-32 h-32 object-contain"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(
                        qrSelectedTrack === "All Tracks"
                          ? `${window.location.origin}/tracks`
                          : `${window.location.origin}/tracks?track=${encodeURIComponent(qrSelectedTrack)}`,
                        "_blank"
                      )}
                      className="h-8 text-[11px] font-bold flex items-center gap-1 border-slate-200 text-slate-750 hover:bg-slate-100 cursor-pointer"
                    >
                      Test Link <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex-1 space-y-2 text-xs font-semibold text-slate-650">
                    <p className="font-bold text-slate-800 text-sm">Download Instructions:</p>
                    <ul className="list-disc list-inside space-y-1 leading-relaxed text-[11px] text-slate-500">
                      <li>Choose the target track from the dropdown above.</li>
                      <li>Right-click on the QR code image and select <strong className="text-slate-800">"Save Image As..."</strong>.</li>
                      <li>Print the QR Code banner and place it outside the respective Session Hall.</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {(user?.userType as string) === "super_admin" && (
          <TabsContent value="danger" className="space-y-4">
            <Card className="border-red-200 shadow-sm">
              <CardHeader className="bg-red-50/50 border-b border-red-100">
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Erase All Conference Data
                </CardTitle>
                <CardDescription className="text-red-600 font-medium">
                  This action is permanent and cannot be undone. It is designed to prepare the portal for a new conference sheet.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Performing this action will:</p>
                  <ul className="list-disc list-inside space-y-1 font-medium text-gray-700">
                    <li>Delete all <strong>participants</strong> and their profile details</li>
                    <li>Delete all <strong>speaker/presenter assignments</strong> and timetables</li>
                    <li>Delete all <strong>uploaded presentation files and posters</strong> (both physically and in database)</li>
                    <li>Delete all <strong>RSVP preference entries</strong></li>
                    <li>Delete all check-in logs, goodies logs, and food coupon logs</li>
                    <li>Delete all recent activity logs</li>
                  </ul>
                  <p className="pt-2 italic text-xs text-amber-600 font-semibold">
                    Note: Your coordinator/admin accounts, mailer settings, and API configurations will remain intact.
                  </p>
                </div>

                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <Label htmlFor="purge-confirm" className="font-bold text-gray-800">
                    Type <span className="font-mono text-red-600">PURGE</span> to confirm reset:
                  </Label>
                  <Input
                    id="purge-confirm"
                    value={purgeConfirm}
                    onChange={(e) => setPurgeConfirm(e.target.value)}
                    placeholder="PURGE"
                    className="font-mono max-w-xs focus:ring-red-200 focus:border-red-500"
                  />
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <Button
                    onClick={handlePurgeAllData}
                    disabled={purging || purgeConfirm !== "PURGE"}
                    className="bg-red-600 hover:bg-red-700 text-white shadow-sm font-bold gap-2"
                  >
                    {purging ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    {purging ? "Purging all data..." : "Permanently Reset Portal Data"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab: Export Data */}
        <TabsContent value="export" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Delegates Export */}
            <Card className="border-emerald-100">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  Delegates Excel Export
                </CardTitle>
                <CardDescription>
                  Download all registered delegates with their full data and QR code links for ID card variable printing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 text-[12px] text-emerald-800 space-y-1.5 font-semibold">
                  <p>✅ Registration Number, Name, Institution</p>
                  <p>✅ Mobile, Email, Payment Status, UTR</p>
                  <p>✅ Role(s), Track(s), Session(s)</p>
                  <p>✅ Delegate Type, Sponsor Info</p>
                  <p>✅ On-spot flags &amp; Registration Date</p>
                  <p className="text-emerald-900 font-bold mt-2">🔗 QR Code URL column (for ID card mail-merge / variable printing)</p>
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer"
                  onClick={() => {
                    window.location.href = `/api/participants/export?token=${encodeURIComponent(token || "")}`;
                  }}
                >
                  <Download className="w-4 h-4" /> Download Delegates Excel
                </Button>
              </CardContent>
            </Card>

            {/* Full System Export */}
            {(user?.userType === "super_admin") && (
              <Card className="border-blue-100">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    Full System Export
                  </CardTitle>
                  <CardDescription>
                    Complete data dump in a multi-sheet Excel workbook — for backup, audit, and reporting.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-[12px] text-blue-800 space-y-1.5 font-semibold">
                    <p>📋 Sheet 1: All Participants (complete data + QR URLs)</p>
                    <p>📋 Sheet 2: All Assignments (role, track, session, time, hall)</p>
                    <p>📋 Sheet 3: Attendance Logs (who scanned when &amp; where)</p>
                    <p>📋 Sheet 4: Food Logs</p>
                    <p>📋 Sheet 5: Goodies Logs</p>
                    <p>📋 Sheet 6: Activity Logs (complete audit trail)</p>
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 cursor-pointer"
                    onClick={() => {
                      window.location.href = `/api/participants/export/full?token=${encodeURIComponent(token || "")}`;
                    }}
                  >
                    <Download className="w-4 h-4" /> Download Full System Export
                  </Button>
                </CardContent>
              </Card>
            )}

          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
