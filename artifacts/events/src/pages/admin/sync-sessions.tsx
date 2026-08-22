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
    <div className="space-y-8 max-w-7xl mx-auto text-zinc-100 animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222228] pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase font-mono tracking-wider">
              Google Sheets Live Sync Engine
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400 font-medium">Bidirectional Cloud Integration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <RefreshCw className="w-7 h-7 text-emerald-400" />
            <span>Session Sync Manager</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-3xl">
            Configure Google Sheet IDs, location mappings, and column schemas for automated delegate, faculty, and session synchronizations.
          </p>
        </div>

        <Button
          onClick={openCreateDialog}
          className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider h-11 px-5 rounded-2xl gap-2 shadow-lg shadow-white/5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-zinc-950" />
          <span>New Session Config</span>
        </Button>
      </div>

      {/* ── CONFIGURED SESSIONS TABLE ───────────────────────────────────────── */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-violet-400" />
              Configured Event Sessions
            </h2>
            <p className="text-xs text-zinc-400">
              Active sessions automatically drive the background sync scheduler and venue location parameters.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#23232A] bg-[#0C0C0F] overflow-hidden">
          <Table>
            <TableHeader className="bg-[#101013]/90 border-b border-[#23232A]">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-zinc-400 py-3.5 pl-5">Status</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-zinc-400 py-3.5">Session Name</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-zinc-400 py-3.5">Google Sheet ID</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-zinc-400 py-3.5">Location</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-zinc-400 py-3.5">Fields Mapped</TableHead>
                <TableHead className="text-right font-bold text-[11px] uppercase tracking-wider text-zinc-400 py-3.5 pr-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#1D1D24]">
              {sessions?.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-36 text-center text-zinc-500 text-xs italic">
                    No session configurations found. Click "New Session Config" above to add one.
                  </TableCell>
                </TableRow>
              ) : (
                sessions?.map((session) => {
                  const mappedCount = Object.values(session.fieldMappings || {}).filter(Boolean).length;
                  return (
                    <TableRow key={session.id} className="hover:bg-[#15151B] transition-colors border-none">
                      <TableCell className="pl-5 py-4">
                        {session.isActive ? (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold gap-1 text-[10px] px-2.5 py-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-400 hover:text-white border-zinc-700 font-medium cursor-pointer text-[10px] px-2.5 py-0.5 transition-all"
                            onClick={() => handleActivate(session.id)}
                          >
                            Activate
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-white text-sm py-4">{session.name}</TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400 max-w-xs truncate py-4">
                        {session.googleSheetId}
                      </TableCell>
                      <TableCell className="text-zinc-300 text-xs py-4">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" /> {session.locationName}
                        </span>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs py-4">
                        <span className="font-bold text-amber-400">{mappedCount}</span> / 13 fields
                      </TableCell>
                      <TableCell className="text-right pr-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-[#2E2E38] bg-[#14141A] hover:bg-[#1E1E26] text-zinc-300 text-xs font-bold rounded-xl"
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
                            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm gap-1 cursor-pointer"
                            onClick={() => handleSync(session.id)}
                            disabled={validatingId !== null || syncingId !== null}
                          >
                            {syncingId === session.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 fill-current" />
                            )}
                            Sync
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-cyan-400 border-cyan-800/40 bg-cyan-950/20 hover:bg-cyan-900/40 rounded-xl"
                            onClick={() => openEditDialog(session)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-rose-400 border-rose-800/40 bg-rose-950/20 hover:bg-rose-900/40 rounded-xl"
                            onClick={() => handleDelete(session.id, session.name)}
                            disabled={session.isActive}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── GOOGLE CREDENTIALS CARD ─────────────────────────────────────────── */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#141417] border border-[#26262D] shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#23232A] pb-5">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              Google Service Account Credentials
            </h2>
            <p className="text-xs text-zinc-400">
              Configure Google Service Account credentials to enable real-time bidirectional syncing and live auto-fetches.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {credsData?.configured ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold px-3 py-1 text-xs">
                🟢 Connected
              </Badge>
            ) : (
              <Badge className="bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold px-3 py-1 text-xs">
                🔴 Not Configured
              </Badge>
            )}

            {credsData?.configured && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="h-9 rounded-xl border-[#2E2E38] bg-[#14141A] hover:bg-[#1E1E26] text-zinc-200 text-xs font-bold"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Testing Connection...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-5">
          <div className="border border-dashed border-[#2E2E38] rounded-2xl p-5 bg-[#0C0C0F] space-y-2">
            <Label className="text-xs font-bold text-white block">Upload Credentials JSON Key File</Label>
            <Input
              type="file"
              accept=".json"
              onChange={handleJsonFileUpload}
              className="cursor-pointer bg-[#141418] border-[#2E2E38] text-zinc-300 text-xs h-10 file:mr-4 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
            />
            <p className="text-[11px] text-zinc-500">
              Select your Google Cloud Service Account JSON file to automatically populate Email and Private Key.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="google-email" className="text-xs font-bold text-zinc-300">Service Account Email</Label>
              <Input
                id="google-email"
                type="email"
                placeholder="project@appspot.gserviceaccount.com"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                className="font-mono text-xs bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11"
              />
              {credsData?.email && (
                <p className="text-[11px] text-zinc-400">Currently active: <code className="text-amber-300 font-mono">{credsData.email}</code></p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="google-key" className="text-xs font-bold text-zinc-300">Private Key (PEM format)</Label>
              <textarea
                id="google-key"
                rows={3}
                placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC..."
                value={googlePrivateKey}
                onChange={(e) => setGooglePrivateKey(e.target.value)}
                className="w-full font-mono text-xs p-3 rounded-xl border border-[#2B2B35] bg-[#09090C] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-[#23232A]">
            <Button
              type="submit"
              disabled={savingCredentials}
              className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl h-11 px-6 gap-2 cursor-pointer shadow-md"
            >
              {savingCredentials ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  Saving Credentials...
                </>
              ) : (
                "Save Credentials"
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* ── DIALOG FOR EDIT / CREATE ────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#121215] border-[#2A2A33] text-white p-6 sm:p-8 rounded-3xl shadow-2xl">
          <DialogHeader className="space-y-1 pb-4 border-b border-[#23232A]">
            <DialogTitle className="text-xl font-black text-white">
              {editingSession ? "Edit Session Configuration" : "Create Session Configuration"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Provide event details, Google Sheet link, and custom field mappings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6 pt-2">
            {/* Basic Settings */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-violet-400" /> Basic Session Settings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="session-name" className="text-xs font-bold text-zinc-300">Session / Event Name</Label>
                  <Input
                    id="session-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Sankara National Conference"
                    required
                    className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="session-location" className="text-xs font-bold text-zinc-300">Location / Venue</Label>
                  <Input
                    id="session-location"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Main Auditorium"
                    required
                    className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs"
                  />
                </div>
              </div>

              {fetchedSpreadsheets.length > 0 && (
                <div className="space-y-1.5 border border-amber-900/40 rounded-2xl p-4 bg-amber-950/20">
                  <Label className="text-xs font-bold text-amber-300 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-amber-400" /> Auto-Fetch Shared Spreadsheet
                  </Label>
                  <select
                    className="flex h-11 w-full rounded-xl border border-[#2B2B35] bg-[#09090C] text-white px-3 text-xs outline-none focus:border-amber-400 transition-colors cursor-pointer"
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
                    <option value="">-- Select from shared Google Spreadsheets --</option>
                    {fetchedSpreadsheets.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.tabs.length} tabs)</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="session-sheet-id" className="text-xs font-bold text-zinc-300">Google Sheet ID or URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="session-sheet-id"
                      value={formSheetId}
                      onChange={(e) => handleSheetIdChange(e.target.value)}
                      placeholder="Paste link or enter raw Sheet ID"
                      required
                      className="flex-1 bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={fetchSheets}
                      disabled={fetchingSheets || !formSheetId.trim()}
                      className="flex items-center gap-1.5 h-11 px-4 rounded-xl bg-[#1C1C24] hover:bg-[#252530] text-white border border-[#2E2E38] text-xs font-bold shrink-0"
                    >
                      {fetchingSheets ? (
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-zinc-300" />
                      )}
                      <span>Load Tabs</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center h-5">
                    <Label htmlFor="session-tab-name" className="text-xs font-bold text-zinc-300">Tab / Sheet Name</Label>
                    {sheetsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsCustomTab(!isCustomTab)}
                        className="text-[10px] text-violet-400 hover:underline font-bold"
                      >
                        {isCustomTab ? "Choose list" : "Enter custom"}
                      </button>
                    )}
                  </div>
                  {sheetsList.length > 0 && !isCustomTab ? (
                    <Select value={formTabName} onValueChange={setFormTabName}>
                      <SelectTrigger className="w-full h-11 bg-[#09090C] border-[#2B2B35] text-white rounded-xl text-xs">
                        <SelectValue placeholder="Select tab" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141418] border-[#2B2B35] text-white">
                        {sheetsList.map((sheet) => (
                          <SelectItem key={sheet} value={sheet} className="text-xs">
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
                      className="bg-[#09090C] border-[#2B2B35] text-white rounded-xl h-11 text-xs"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Field Mappings */}
            <div className="space-y-4 pt-4 border-t border-[#23232A]">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-emerald-400" /> Field Mappings (App to Sheet Columns)
                </h3>
                <p className="text-xs text-zinc-400">
                  Specify the column header name from the Google Sheet for each application field. Multiple alternates can be defined separated by commas (e.g. <code className="bg-[#1C1C24] px-1.5 py-0.5 rounded text-amber-300 font-mono text-[10px]">Mobile, Phone, Phone No</code>).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                {(Object.keys(FIELD_LABELS) as FieldMappingKeys[]).map((key) => {
                  const labelInfo = FIELD_LABELS[key];
                  return (
                    <div key={key} className="space-y-1.5 bg-[#0A0A0D] p-3.5 rounded-2xl border border-[#23232A] flex flex-col justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor={`map-${key}`} className="font-bold text-white text-xs">{labelInfo.label}</Label>
                        <p className="text-[10px] text-zinc-500">{labelInfo.desc}</p>
                      </div>
                      <Input
                        id={`map-${key}`}
                        value={formMappings[key] || ""}
                        onChange={(e) => handleMappingChange(key, e.target.value)}
                        placeholder={`e.g. ${labelInfo.placeholder}`}
                        className="mt-1.5 h-9 bg-[#101014] border-[#262630] text-zinc-200 text-xs rounded-xl"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="border-t border-[#23232A] pt-5 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="h-11 px-5 border-[#2A2A35] bg-[#141418] hover:bg-[#1D1D24] text-zinc-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider h-11 px-6 rounded-xl gap-2 cursor-pointer shadow-md"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

