import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Play, 
  MapPin, Database, HelpCircle, Loader2, ArrowRight
} from "lucide-react";

type FieldMappingKeys = "name" | "email" | "mobile" | "institution" | "regNum" | "role" | "sessionName" | "date" | "track" | "time" | "title" | "hall" | "isPaid";

interface SyncSession {
  id: number;
  name: string;
  googleSheetId: string;
  sheetName: string;
  locationName: string;
  isActive: boolean;
  fieldMappings: Record<FieldMappingKeys, string>;
  createdAt: string;
  updatedAt: string;
}

const FIELD_LABELS: Record<FieldMappingKeys, { label: string; placeholder: string; desc: string }> = {
  name: { label: "Attendee Name", placeholder: "Name", desc: "Name of the attendee" },
  email: { label: "Email Address", placeholder: "EMAIL", desc: "Email ID of the attendee" },
  mobile: { label: "Mobile / Phone", placeholder: "Phone No", desc: "Mobile number of the attendee" },
  institution: { label: "Institution / Org", placeholder: "Organisation", desc: "Hospital or company name" },
  regNum: { label: "Registration ID / Code", placeholder: "Poster ID / Code", desc: "Registration number or poster number" },
  role: { label: "Role", placeholder: "Role", desc: "Chair, Speaker, Poster, etc. (falls back to sheet role)" },
  sessionName: { label: "Session Name", placeholder: "Session Toppic", desc: "Event session/slot topic" },
  date: { label: "Date / Day", placeholder: "Date", desc: "Day/Date of session slot" },
  track: { label: "Track Number", placeholder: "Track", desc: "Track name or track number (e.g. Track 1)" },
  time: { label: "Time Slot / Timing", placeholder: "Timing", desc: "Timing slot (e.g. 9:00-9:08)" },
  title: { label: "Presentation Title", placeholder: "Topic", desc: "Title of paper or poster presentation" },
  hall: { label: "Poster Hall / Location (PH1/PH2)", placeholder: "Poster Hall", desc: "Poster Hall designation or location number (e.g. PH1-002)" },
  isPaid: { label: "Payment / Registration Status", placeholder: "paid", desc: "Paid/Unpaid or Registered/Unregistered column" },
};

const DEFAULT_MAPPINGS: Record<FieldMappingKeys, string> = {
  name: "Name",
  email: "EMAIL",
  mobile: "Phone No",
  institution: "Organisation",
  regNum: "Poster ID / Code",
  role: "Role",
  sessionName: "Session Toppic",
  date: "Date",
  track: "Track",
  time: "Timing",
  title: "Topic",
  hall: "Poster Hall",
  isPaid: "paid",
};

export default function AdminSyncSessions() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SyncSession | null>(null);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formSheetId, setFormSheetId] = useState("");
  const [formTabName, setFormTabName] = useState("");
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  const [fetchingSheets, setFetchingSheets] = useState(false);
  const [isCustomTab, setIsCustomTab] = useState(false);
  const [formLocation, setFormLocation] = useState("");
  const [formMappings, setFormMappings] = useState<Record<FieldMappingKeys, string>>(DEFAULT_MAPPINGS);

  // Syncing states
  const [validatingId, setValidatingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Google Service Account credentials states
  const [googleEmail, setGoogleEmail] = useState("");
  const [googlePrivateKey, setGooglePrivateKey] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  const [fetchedSpreadsheets, setFetchedSpreadsheets] = useState<{ id: string; name: string; tabs: string[] }[]>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);

  const fetchSharedSpreadsheets = async (emailVal?: string, keyVal?: string) => {
    setLoadingSpreadsheets(true);
    try {
      const body: any = {};
      if (emailVal && keyVal) {
        body.email = emailVal;
        body.privateKey = keyVal;
      }
      const resp = await fetch("/api/settings/google-credentials/fetch-sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (resp.ok) {
        const data = await resp.json();
        setFetchedSpreadsheets(data.spreadsheets || []);
      }
    } catch (err) {
      console.error("Failed to fetch shared spreadsheets:", err);
    } finally {
      setLoadingSpreadsheets(false);
    }
  };

  const { data: credsData, refetch: refetchCreds } = useQuery({
    queryKey: ["/settings/google-credentials"],
    queryFn: async () => {
      const resp = await fetch("/api/settings/google-credentials", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error("Failed to load Google credentials");
      return resp.json();
    }
  });

  useEffect(() => {
    if (credsData?.configured) {
      fetchSharedSpreadsheets();
    }
  }, [credsData]);

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.client_email || !parsed.private_key) {
          toast({
            variant: "destructive",
            title: "Invalid JSON File",
            description: "The uploaded JSON file does not appear to be a Google service account key. It must contain 'client_email' and 'private_key'.",
          });
          return;
        }

        setGoogleEmail(parsed.client_email);
        setGooglePrivateKey(parsed.private_key);

        toast({
          title: "JSON Parsed Successfully ✓",
          description: "Populated Service Account Email and Private Key fields. Listing shared sheets...",
        });

        fetchSharedSpreadsheets(parsed.client_email, parsed.private_key);
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "File Read Error",
          description: "Failed to parse the file as JSON. Please ensure it is a valid service account JSON file.",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim() || !googlePrivateKey.trim()) {
      toast({ title: "Email and Private Key are required", variant: "destructive" });
      return;
    }
    setSavingCredentials(true);
    try {
      const resp = await fetch("/api/settings/google-credentials", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: googleEmail.trim(),
          privateKey: googlePrivateKey.trim()
        })
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to save Google credentials.");
      }
      toast({ title: "Credentials Saved", description: "Google Service Account credentials saved successfully." });
      setGooglePrivateKey("");
      refetchCreds();
      fetchSharedSpreadsheets();
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const resp = await fetch("/api/settings/google-credentials/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Connection test failed.");
      toast({ title: "Connection Test Successful ✓", description: data.details });
    } catch (err: any) {
      toast({ title: "Connection test failed", description: err.message, variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };


  // Fetch sync sessions
  const { data: sessions, isLoading, refetch } = useQuery<SyncSession[]>({
    queryKey: ["/api/sync-sessions"],
    queryFn: async () => {
      const resp = await fetch("/api/sync-sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to load sync sessions");
      return resp.json();
    },
  });

  const openCreateDialog = () => {
    setEditingSession(null);
    setFormName("");
    setFormSheetId("");
    setFormTabName("Summary");
    setSheetsList([]);
    setIsCustomTab(false);
    setFormLocation("Sankara Eye Hospital");
    setFormMappings(DEFAULT_MAPPINGS);
    setModalOpen(true);
  };

  const openEditDialog = (session: SyncSession) => {
    setEditingSession(session);
    setFormName(session.name);
    setFormSheetId(session.googleSheetId);
    setFormTabName(session.sheetName || "");
    setSheetsList(session.sheetName ? [session.sheetName] : []);
    setIsCustomTab(false);
    setFormLocation(session.locationName);
    setFormMappings({
      ...DEFAULT_MAPPINGS,
      ...(session.fieldMappings || {}),
    });
    setModalOpen(true);
  };

  const handleSheetIdChange = (val: string) => {
    let extracted = val.trim();
    const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/);
    if (match) {
      extracted = match[1];
    }
    setFormSheetId(extracted);
  };

  const fetchSheets = async () => {
    if (!formSheetId.trim()) {
      toast({ title: "Please enter a Google Sheet ID first", variant: "destructive" });
      return;
    }
    setFetchingSheets(true);
    try {
      const resp = await fetch(`/api/sync-sessions/sheets?sheetId=${formSheetId.trim()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load sheet list.");
      }
      const data = await resp.json();
      setSheetsList(data.sheets || []);
      if (data.sheets && data.sheets.length > 0) {
        if (!formTabName || !data.sheets.includes(formTabName)) {
          setFormTabName(data.sheets[0]);
        }
        setIsCustomTab(false);
        toast({ title: "Sheets Loaded", description: `Found ${data.sheets.length} tabs in spreadsheet.` });
      } else {
        toast({ title: "No Tabs Found", description: "No sheets/tabs were detected in this workbook." });
      }
    } catch (err: any) {
      toast({ title: "Failed to load tabs", description: err.message, variant: "destructive" });
    } finally {
      setFetchingSheets(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSheetId.trim()) {
      toast({ title: "Name and Sheet ID are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const url = editingSession
        ? `/api/sync-sessions/${editingSession.id}`
        : "/api/sync-sessions";
      const method = editingSession ? "PATCH" : "POST";

      const resp = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName.trim(),
          googleSheetId: formSheetId.trim(),
          sheetName: formTabName.trim(),
          locationName: formLocation.trim(),
          fieldMappings: formMappings,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save sync session.");
      }

      toast({
        title: editingSession ? "Session Updated" : "Session Created",
        description: `Successfully saved ${formName}`,
      });
      setModalOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/settings/submissions"] });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      const resp = await fetch(`/api/sync-sessions/${id}/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to activate session");
      }
      toast({ title: "Session Activated", description: "Successfully activated the configuration." });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/settings/submissions"] });
    } catch (err: any) {
      toast({ title: "Activation error", description: err.message, variant: "destructive" });
    }
  };

  const handleValidate = async (id: number) => {
    setValidatingId(id);
    try {
      const resp = await fetch(`/api/sync-sessions/${id}/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.error || "Failed validation");
      }
      toast({ title: "Connection Successful ✓", description: result.message });
    } catch (err: any) {
      toast({ title: "Validation Failed", description: err.message, variant: "destructive" });
    } finally {
      setValidatingId(null);
    }
  };

  const handleSync = async (id: number) => {
    setSyncingId(id);
    try {
      const resp = await fetch("/api/participants/sync-google-sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: id }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.error || "Sync execution failed.");
      }
      toast({
        title: "Synchronization Complete",
        description: `Successfully loaded ${result.imported} slot assignments. ${result.errors?.length || 0} warnings.`,
      });
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete session config "${name}"?`)) return;

    try {
      const resp = await fetch(`/api/sync-sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to delete config.");
      }
      toast({ title: "Session Deleted", description: "Successfully deleted session configuration." });
      refetch();
    } catch (err: any) {
      toast({ title: "Delete error", description: err.message, variant: "destructive" });
    }
  };

  const handleMappingChange = (key: FieldMappingKeys, value: string) => {
    setFormMappings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Session Sync Manager</h1>
          <p className="text-gray-500 mt-1">Configure raw Google Sheet IDs, location details, and field mappings per session</p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-[#F58220] hover:bg-[#e07010] text-white shadow-sm font-semibold gap-2"
        >
          <Plus className="w-4 h-4" /> New Session Config
        </Button>
      </div>

      <Card className="border border-slate-100 shadow-sm overflow-hidden bg-white/70 backdrop-blur-md">
        <CardHeader className="pb-2">
          <CardTitle>Configured Event Sessions</CardTitle>
          <CardDescription>
            Activate a session configuration to automatically route the sync scheduler and location parameters across the portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-semibold text-slate-800">Status</TableHead>
                <TableHead className="font-semibold text-slate-800">Session Name</TableHead>
                <TableHead className="font-semibold text-slate-800">Google Sheet ID</TableHead>
                <TableHead className="font-semibold text-slate-800">Location Name</TableHead>
                <TableHead className="font-semibold text-slate-800">Fields Mapped</TableHead>
                <TableHead className="text-right font-semibold text-slate-800">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-gray-400 italic">
                    No session configurations found. Click "New Session Config" to add one.
                  </TableCell>
                </TableRow>
              ) : (
                sessions?.map((session) => {
                  const mappedCount = Object.values(session.fieldMappings || {}).filter(Boolean).length;
                  return (
                    <TableRow key={session.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell>
                        {session.isActive ? (
                          <Badge className="bg-green-100 hover:bg-green-150 text-green-700 border border-green-200 font-bold gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 font-medium cursor-pointer"
                            onClick={() => handleActivate(session.id)}
                          >
                            Activate
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">{session.name}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-500 max-w-xs truncate">
                        {session.googleSheetId}
                      </TableCell>
                      <TableCell className="text-slate-700 gap-1.5 flex items-center pt-4">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {session.locationName}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <span className="font-semibold text-orange-600">{mappedCount}</span> / 11 fields
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-slate-200 hover:bg-slate-50"
                          onClick={() => handleValidate(session.id)}
                          disabled={validatingId !== null || syncingId !== null}
                        >
                          {validatingId === session.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Test ID"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-lg cursor-pointer border-none"
                          onClick={() => handleSync(session.id)}
                          disabled={validatingId !== null || syncingId !== null}
                        >
                          {syncingId === session.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 mr-1" />
                          )}
                          Sync
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => openEditDialog(session)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleDelete(session.id, session.name)}
                          disabled={session.isActive}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border border-slate-100 shadow-sm overflow-hidden bg-white/70 backdrop-blur-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-orange-500" />
            Google API Credentials for Direct Write-back & Sync
          </CardTitle>
          <CardDescription>
            Configure Google Service Account credentials to enable real-time bidirectional syncing. Edits in the app will update the sheet, and sync will use the official API.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              {credsData?.configured ? (
                <Badge className="bg-green-100 text-green-700 border border-green-200 font-bold">
                  🟢 Configured
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 border border-red-200 font-bold">
                  🔴 Not configured (Public fallback active)
                </Badge>
              )}
            </div>
            {credsData?.configured && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            )}
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <div className="space-y-2 border border-dashed border-[#F58220]/35 rounded-xl p-4 bg-orange-50/20">
              <Label className="text-sm font-bold text-gray-700 block">Upload Credentials JSON File</Label>
              <Input
                type="file"
                accept=".json"
                onChange={handleJsonFileUpload}
                className="cursor-pointer bg-white border-[#F58220]/25"
              />
              <p className="text-[11px] text-gray-500">
                Tip: Select your downloaded Google Cloud service account JSON file to automatically fetch the Service Email and Private Key!
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="google-email">Service Account Email</Label>
              <Input
                id="google-email"
                type="email"
                placeholder="e.g. project-name@appspot.gserviceaccount.com"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                className="font-mono text-sm"
              />
              {credsData?.email && (
                <p className="text-xs text-gray-500">Currently configured: <code className="font-semibold">{credsData.email}</code></p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="google-key">Private Key (JSON private_key value)</Label>
              <textarea
                id="google-key"
                rows={4}
                placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC..."
                value={googlePrivateKey}
                onChange={(e) => setGooglePrivateKey(e.target.value)}
                className="w-full min-h-[100px] font-mono text-xs p-3 rounded-md border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-[11px] text-gray-400">Pasted private key will show masked for security when saved. Ensure Google Sheets API is enabled on your Google Cloud Console.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="submit"
                disabled={savingCredentials}
                className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-xl border-none cursor-pointer"
              >
                {savingCredentials ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Credentials"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Dialog for Edit / Create */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session Configuration" : "Create Session Configuration"}</DialogTitle>
            <DialogDescription>
              Provide event details, Google Sheet access, and configure custom field mappings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-1.5 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-orange-500" /> Basic Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="session-name">Session / Event Name</Label>
                  <Input
                    id="session-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Vision 2020 Annual Conference"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="session-location">Location Name</Label>
                  <Input
                    id="session-location"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Sankara Eye Hospital"
                    required
                  />
                </div>
              </div>

              {fetchedSpreadsheets.length > 0 && (
                <div className="space-y-1.5 border border-[#F58220]/25 rounded-xl p-3.5 bg-orange-50/10 mb-2">
                  <Label className="text-xs font-bold text-[#F58220] flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" /> Auto-Fetch Shared Spreadsheet
                  </Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    value={formSheetId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setFormSheetId(selectedId);
                      const matched = fetchedSpreadsheets.find(s => s.id === selectedId);
                      if (matched) {
                        setSheetsList(matched.tabs);
                        if (matched.tabs.length > 0) {
                          setFormTabName(matched.tabs[0]);
                        }
                        setIsCustomTab(false);
                      }
                    }}
                  >
                    <option value="">-- Select from spreadsheets shared with service account --</option>
                    {fetchedSpreadsheets.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.tabs.length} tabs)</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 font-medium">Selecting a sheet auto-fills the Sheet ID and populates all available tabs.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="session-sheet-id">Google Sheet ID / URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="session-sheet-id"
                      value={formSheetId}
                      onChange={(e) => handleSheetIdChange(e.target.value)}
                      placeholder="Paste link or enter raw Sheet ID"
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={fetchSheets}
                      disabled={fetchingSheets || !formSheetId.trim()}
                      className="flex items-center gap-1.5 h-10 px-3 whitespace-nowrap bg-slate-100 hover:bg-slate-200 border-0"
                    >
                      {fetchingSheets ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-slate-600" />
                      )}
                      <span className="text-xs font-semibold text-slate-700">Load Tabs</span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-400">Pasting spreadsheet link automatically extracts the ID.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center h-5">
                    <Label htmlFor="session-tab-name">Sheet / Tab Name</Label>
                    {sheetsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsCustomTab(!isCustomTab)}
                        className="text-[10px] text-purple-600 hover:underline font-semibold"
                      >
                        {isCustomTab ? "Select list" : "Enter custom"}
                      </button>
                    )}
                  </div>
                  {sheetsList.length > 0 && !isCustomTab ? (
                    <Select value={formTabName} onValueChange={setFormTabName}>
                      <SelectTrigger className="w-full h-10 bg-white">
                        <SelectValue placeholder="Select tab" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetsList.map((sheet) => (
                          <SelectItem key={sheet} value={sheet}>
                            {sheet}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="session-tab-name"
                      value={formTabName}
                      onChange={(e) => setFormTabName(e.target.value)}
                      placeholder="Summary"
                      required
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-1.5 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-purple-500" /> Field Mappings (App to Sheet Columns)
              </h3>
              <p className="text-xs text-gray-500 leading-normal">
                Specify the exact column header name from the Google Sheet for each application field. Multiple alternates can be defined separated by commas or pipes (e.g. <code className="bg-gray-150 px-1 rounded text-slate-800 font-mono text-[10px]">Mobile, Phone, Phone No</code>).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {(Object.keys(FIELD_LABELS) as FieldMappingKeys[]).map((key) => {
                  const labelInfo = FIELD_LABELS[key];
                  return (
                    <div key={key} className="space-y-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor={`map-${key}`} className="font-semibold text-slate-800">{labelInfo.label}</Label>
                        <p className="text-[10px] text-gray-400 leading-tight">{labelInfo.desc}</p>
                      </div>
                      <Input
                        id={`map-${key}`}
                        value={formMappings[key] || ""}
                        onChange={(e) => handleMappingChange(key, e.target.value)}
                        placeholder={`e.g. ${labelInfo.placeholder}`}
                        className="mt-2 h-9 bg-white"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold h-10 gap-1 rounded-xl border-none cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
