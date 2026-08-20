import { useState } from "react";
import { useListSubmissions, getListSubmissionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, FileText, Image as ImageIcon, FlaskConical, Filter, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";

const ALL_ROLES = ["Speaker", "Presenter", "Poster"];

export default function ScientificSubmissions() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const debouncedSearch = useDebounce(search, 300);

  const { data: submissions, isLoading } = useListSubmissions(
    { search: debouncedSearch },
    { query: { queryKey: getListSubmissionsQueryKey({ search: debouncedSearch }) } }
  );

  const filtered = (submissions || []).filter(s => {
    if (roleFilter !== "all" && s.role !== roleFilter) return false;
    if (typeFilter !== "all" && s.fileType !== typeFilter) return false;
    return true;
  });

  const pptCount = (submissions || []).filter(s => s.fileType === "pptx").length;
  const jpgCount = (submissions || []).filter(s => s.fileType !== "pptx").length;

  const { toast } = useToast();
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleBulkDownload = async () => {
    if (filtered.length === 0) return;
    
    setDownloadingZip(true);
    try {
      const fileIds = filtered.map(s => s.fileId);
      const res = await fetch("/api/files/download-zip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("vision2020_token") || ""}`
        },
        body: JSON.stringify({ fileIds })
      });
      
      if (!res.ok) {
        throw new Error("Failed to generate zip");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vision2020_filtered_submissions_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      toast({ title: "Download Failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#6F42C1] to-[#5a35a0] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-white/70 font-medium uppercase tracking-wide">Scientific Committee</div>
            <h1 className="text-2xl font-bold mt-0.5">Submissions Review</h1>
            <p className="text-white/80 text-sm mt-0.5">Read-only access · View and download uploaded presentations</p>
          </div>
          <div className="flex gap-4 sm:text-right">
            <div>
              <div className="text-2xl font-bold">{pptCount}</div>
              <div className="text-xs text-white/70">PPT Files</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <div className="text-2xl font-bold">{jpgCount}</div>
              <div className="text-xs text-white/70">Posters</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-gray-100 shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" /> Filter Submissions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by participant, title, registration number…"
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ALL_ROLES.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pptx">PPTX / PDF</SelectItem>
                <SelectItem value="jpg">Images (Poster)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between items-center mt-3">
            {filtered.length !== (submissions || []).length && (
              <div className="text-xs text-gray-500">
                Showing {filtered.length} of {(submissions || []).length} submissions
              </div>
            )}
            <div className="ml-auto">
              <Button
                onClick={handleBulkDownload}
                disabled={downloadingZip || filtered.length === 0}
                className="h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
              >
                {downloadingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Download Filtered as ZIP
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-100 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs font-semibold text-gray-600">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Track & Role</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Participant</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Presentation Title</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Uploaded</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [1,2,3,4,5].map(i => (
                    <TableRow key={i}>
                      {[1,2,3,4,5,6].map(j => (
                        <TableCell key={j}><Skeleton className="h-8 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length > 0 ? (
                  filtered.map(sub => (
                    <TableRow key={sub.fileId} className="hover:bg-gray-50/50">
                      <TableCell>
                        {sub.fileType === "pptx" ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border border-blue-200 gap-1 text-xs">
                            <FileText className="w-3 h-3" /> PPT
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 gap-1 text-xs">
                            <ImageIcon className="w-3 h-3" /> Poster
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900 text-sm">{sub.track}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{sub.role}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-gray-900">{sub.name}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{sub.registrationNumber}</div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="font-medium text-sm text-gray-900 truncate" title={sub.presentationTitle || ""}>
                          {sub.presentationTitle || <span className="text-gray-400 italic">No title</span>}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">{sub.filename}</div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(sub.uploadedAt).toLocaleString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <a href={`/api/files/${sub.fileId}/download?token=${encodeURIComponent(localStorage.getItem("vision2020_token") || "")}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-[#6F42C1] border-[#6F42C1]/30 hover:bg-purple-50">
                            <Download className="w-3.5 h-3.5" /> Download
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <FileText className="w-8 h-8" />
                        <span className="text-sm">{search || roleFilter !== "all" || typeFilter !== "all" ? "No submissions match your filters." : "No submissions yet."}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
