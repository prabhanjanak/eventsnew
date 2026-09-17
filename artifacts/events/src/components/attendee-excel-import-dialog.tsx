import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  X,
  FileCheck,
  Building2,
  Briefcase,
  MapPin,
  Phone,
  UserCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface AttendeeExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEventId?: string | number;
  events?: { id: number; title: string; slug?: string }[];
  onImportSuccess?: () => void;
}

interface PreviewData {
  preview: boolean;
  totalRows: number;
  detectedHeaders: string[];
  mappedFields: {
    name: boolean;
    mobile: boolean;
    organization: boolean;
    designation: boolean;
    address: boolean;
    email: boolean;
  };
  sampleRows: {
    name: string;
    mobile: string | null;
    email: string | null;
    institution: string;
    designation: string | null;
    address: string | null;
    gender: string | null;
    regNoProvided: string | null;
    isPaid: boolean;
    utrNumber: string | null;
  }[];
}

interface ImportResult {
  success: boolean;
  totalProcessed: number;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}

export function AttendeeExcelImportDialog({
  open,
  onOpenChange,
  defaultEventId,
  events = [],
  onImportSuccess,
}: AttendeeExcelImportDialogProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string>(() =>
    defaultEventId && defaultEventId !== "all" ? String(defaultEventId) : "all"
  );

  useEffect(() => {
    if (defaultEventId && defaultEventId !== "all") {
      setSelectedEventId(String(defaultEventId));
    } else {
      setSelectedEventId("all");
    }
  }, [defaultEventId, open]);
  const [file, setFile] = useState<File | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<"update" | "skip">("update");
  const [defaultPayment, setDefaultPayment] = useState<"auto" | "paid" | "unpaid">("auto");
  const [delegateType, setDelegateType] = useState<string>("delegate");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const resetState = () => {
    setFile(null);
    setPreviewData(null);
    setPreviewError(null);
    setImportResult(null);
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (!isImporting) {
      resetState();
      onOpenChange(false);
    }
  };

  // Pre-flight file upload for instant preview
  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      setPreviewData(null);
      return;
    }

    setFile(selectedFile);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (selectedEventId && selectedEventId !== "all") formData.append("eventId", selectedEventId);
      formData.append("duplicateAction", duplicateAction);
      formData.append("defaultPayment", defaultPayment);
      formData.append("dryRun", "true");

      const res = await fetch(`${BASE_URL}/api/participants/import-attendees`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to analyze Excel file");
      }

      setPreviewData(json);
    } catch (err: any) {
      setPreviewError(err.message || "Failed to parse file");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Perform the actual database import
  const handleImportSubmit = async () => {
    if (!file) {
      toast({ title: "Please select an Excel file to upload", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    setPreviewError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedEventId && selectedEventId !== "all") formData.append("eventId", selectedEventId);
      formData.append("duplicateAction", duplicateAction);
      formData.append("defaultPayment", defaultPayment);
      formData.append("defaultDelegateType", delegateType);
      formData.append("dryRun", "false");

      const res = await fetch(`${BASE_URL}/api/participants/import-attendees`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to import attendees");
      }

      setImportResult(json);
      toast({
        title: "Excel Import Complete! 🎉",
        description: `${json.addedCount} new added, ${json.updatedCount} updated, ${json.skippedCount} skipped.`,
      });

      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err: any) {
      setPreviewError(err.message || "An error occurred during import");
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = `${BASE_URL}/api/participants/template?token=${encodeURIComponent(token || "")}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col bg-[#141418] border-[#282832] text-zinc-100 p-0 overflow-hidden shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-[#24242D] bg-[#18181F]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Upload Attendee List via Excel
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Bulk import delegates with smart mapping for Name, Address, Organization / Unit, Designation &amp; Mobile.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="h-8 px-2.5 gap-1.5 bg-[#1F1F26] border-[#31313D] hover:bg-[#2A2A35] text-zinc-300 hover:text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download Template</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {importResult ? (
            /* ── IMPORT SUCCESS VIEW ────────────────────────────────────── */
            <div className="space-y-5 py-2">
              <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-emerald-300">Import Completed Successfully</h3>
                  <p className="text-xs text-zinc-300 mt-1">
                    Your Excel attendee spreadsheet has been processed and saved into the attendee registry.
                  </p>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38] text-center">
                  <span className="text-[11px] font-bold text-zinc-400 block uppercase tracking-wider">Total Rows</span>
                  <span className="text-2xl font-black text-white mt-1 block">{importResult.totalProcessed}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-emerald-500/30 text-center">
                  <span className="text-[11px] font-bold text-emerald-400 block uppercase tracking-wider">New Added</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">{importResult.addedCount}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-blue-500/30 text-center">
                  <span className="text-[11px] font-bold text-blue-400 block uppercase tracking-wider">Updated</span>
                  <span className="text-2xl font-black text-blue-400 mt-1 block">{importResult.updatedCount}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38] text-center">
                  <span className="text-[11px] font-bold text-zinc-400 block uppercase tracking-wider">Skipped</span>
                  <span className="text-2xl font-black text-zinc-400 mt-1 block">{importResult.skippedCount}</span>
                </div>
              </div>

              {/* Error / Warning Notice if any */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>Warnings ({importResult.errors.length}):</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-0.5 text-[11px] text-zinc-400">
                    {importResult.errors.map((e, idx) => (
                      <p key={idx}>• {e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── UPLOAD & PREVIEW VIEW ──────────────────────────────────── */
            <>
              {/* Event & Settings Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider mb-1.5 block">
                    Target Event
                  </Label>
                  <Select
                    value={selectedEventId}
                    onValueChange={(val) => {
                      setSelectedEventId(val);
                      if (file) handleFileChange(file);
                    }}
                  >
                    <SelectTrigger className="h-9 bg-[#1A1A22] border-[#2C2C38] text-xs font-semibold text-zinc-200">
                      <SelectValue placeholder="Select event..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A22] border-[#2C2C38] text-zinc-200 text-xs">
                      <SelectItem value="all">All / Unassigned Event</SelectItem>
                      {events.map((evt) => (
                        <SelectItem key={evt.id} value={String(evt.id)}>
                          {evt.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider mb-1.5 block">
                    Duplicates Action
                  </Label>
                  <Select
                    value={duplicateAction}
                    onValueChange={(val: "update" | "skip") => setDuplicateAction(val)}
                  >
                    <SelectTrigger className="h-9 bg-[#1A1A22] border-[#2C2C38] text-xs font-semibold text-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A22] border-[#2C2C38] text-zinc-200 text-xs">
                      <SelectItem value="update">Update Existing Attendee</SelectItem>
                      <SelectItem value="skip">Skip Existing Attendee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider mb-1.5 block">
                    Payment Status
                  </Label>
                  <Select
                    value={defaultPayment}
                    onValueChange={(val: "auto" | "paid" | "unpaid") => setDefaultPayment(val)}
                  >
                    <SelectTrigger className="h-9 bg-[#1A1A22] border-[#2C2C38] text-xs font-semibold text-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A22] border-[#2C2C38] text-zinc-200 text-xs">
                      <SelectItem value="auto">Auto (Read from Excel)</SelectItem>
                      <SelectItem value="paid">Mark All as Paid</SelectItem>
                      <SelectItem value="unpaid">Mark All as Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  file
                    ? "border-emerald-500/50 bg-emerald-950/10 hover:border-emerald-400"
                    : "border-[#2D2D38] bg-[#16161C] hover:border-zinc-500 hover:bg-[#1A1A22]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />

                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-sm text-white">{file.name}</div>
                    <div className="text-xs text-zinc-400">
                      {(file.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#22222B] text-zinc-400 flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-sm text-zinc-200">
                      Click to choose Excel sheet or drag &amp; drop
                    </div>
                    <p className="text-xs text-zinc-400">
                      Supports <span className="text-zinc-200 font-semibold">.xlsx, .xls, or .csv</span> format
                    </p>
                  </div>
                )}
              </div>

              {/* Loading Indicator */}
              {previewLoading && (
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Analyzing Excel structure &amp; detecting columns…</span>
                </div>
              )}

              {/* Error Notice */}
              {previewError && (
                <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{previewError}</span>
                </div>
              )}

              {/* Preview & Detected Fields */}
              {previewData && (
                <div className="space-y-4 pt-1">
                  {/* Column Mapping Badges */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Detected Column Mapping ({previewData.totalRows} Attendees Found)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5 ${
                          previewData.mappedFields.name
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Name {previewData.mappedFields.name ? "✓" : "(Missing)"}</span>
                      </Badge>

                      <Badge
                        variant="outline"
                        className={`text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5 ${
                          previewData.mappedFields.mobile
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Mobile {previewData.mappedFields.mobile ? "✓" : "(Optional)"}</span>
                      </Badge>

                      <Badge
                        variant="outline"
                        className={`text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5 ${
                          previewData.mappedFields.organization
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Org / Unit {previewData.mappedFields.organization ? "✓" : "(Optional)"}</span>
                      </Badge>

                      <Badge
                        variant="outline"
                        className={`text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5 ${
                          previewData.mappedFields.designation
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                        }`}
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Designation {previewData.mappedFields.designation ? "✓" : "(Optional)"}</span>
                      </Badge>

                      <Badge
                        variant="outline"
                        className={`text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5 ${
                          previewData.mappedFields.address
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Address {previewData.mappedFields.address ? "✓" : "(Optional)"}</span>
                      </Badge>

                      <Badge
                        variant="outline"
                        className={`text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5 ${
                          previewData.mappedFields.email
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                        }`}
                      >
                        <span>Email {previewData.mappedFields.email ? "✓" : "(Optional)"}</span>
                      </Badge>
                    </div>
                  </div>

                  {/* Sample Rows Preview Table */}
                  <div className="border border-[#292936] rounded-xl overflow-hidden bg-[#131317]">
                    <div className="px-3.5 py-2 bg-[#1B1B24] border-b border-[#292936] text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Preview First {previewData.sampleRows.length} Rows</span>
                      <span className="text-zinc-400">Total: {previewData.totalRows} attendees</span>
                    </div>
                    <div className="overflow-x-auto max-h-48">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#252530] text-zinc-400 text-[11px]">
                            <th className="py-2 px-3 font-semibold">Name</th>
                            <th className="py-2 px-3 font-semibold">Mobile</th>
                            <th className="py-2 px-3 font-semibold">Org / Unit</th>
                            <th className="py-2 px-3 font-semibold">Designation</th>
                            <th className="py-2 px-3 font-semibold">Address</th>
                            <th className="py-2 px-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#22222D]">
                          {previewData.sampleRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.02]">
                              <td className="py-2 px-3 font-bold text-white whitespace-nowrap">{row.name}</td>
                              <td className="py-2 px-3 text-zinc-300 whitespace-nowrap">
                                {row.mobile ? `+91 ${row.mobile}` : "—"}
                              </td>
                              <td className="py-2 px-3 text-zinc-300 truncate max-w-[160px]">
                                {row.institution || "—"}
                              </td>
                              <td className="py-2 px-3 text-zinc-400 truncate max-w-[130px]">
                                {row.designation || "—"}
                              </td>
                              <td className="py-2 px-3 text-zinc-400 truncate max-w-[180px]">
                                {row.address || "—"}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    row.isPaid
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : "bg-zinc-800 text-zinc-400"
                                  }`}
                                >
                                  {row.isPaid ? "Paid" : "Unpaid"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-4 px-6 border-t border-[#24242D] bg-[#18181F] flex items-center justify-between">
          {importResult ? (
            <div className="w-full flex justify-end">
              <Button
                onClick={handleClose}
                className="h-9 px-5 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isImporting}
                className="h-9 text-xs text-zinc-400 hover:text-white rounded-xl"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleImportSubmit}
                disabled={!file || !previewData || previewLoading || isImporting}
                className="h-9 px-5 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing Attendees…</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>
                      {previewData ? `Import ${previewData.totalRows} Attendees` : "Upload & Import"}
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
