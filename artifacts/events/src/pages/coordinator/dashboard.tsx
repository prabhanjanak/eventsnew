import { useState } from "react";
import { useListTrackParticipants, getListTrackParticipantsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Download, CheckCircle2, AlertCircle, Users, FileCheck, FileClock, MapPin } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

const ROLE_COLOR: Record<string, string> = {
  Speaker: "bg-blue-50 text-blue-700 border-blue-200",
  Presenter: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Poster: "bg-cyan-50 text-cyan-700 border-cyan-200",
  Panelist: "bg-violet-50 text-violet-700 border-violet-200",
  Moderator: "bg-purple-50 text-purple-700 border-purple-200",
  Judge: "bg-amber-50 text-amber-700 border-amber-200",
  Chair: "bg-orange-50 text-orange-700 border-orange-200",
  CoChair: "bg-rose-50 text-rose-700 border-rose-200",
};

const NEEDS_FILE = ["Speaker", "Presenter", "Poster"];

export default function CoordinatorDashboard() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const trackName = user?.assignedTrack || "";

  const { data: participants, isLoading } = useListTrackParticipants(
    { trackName, search: debouncedSearch },
    { query: { enabled: !!trackName, queryKey: getListTrackParticipantsQueryKey({ trackName, search: debouncedSearch }) } }
  );

  const total = participants?.length || 0;
  const submitted = participants?.filter(p => p.hasFile).length || 0;
  const pending = participants?.filter(p => NEEDS_FILE.includes(p.role) && !p.hasFile).length || 0;

  return (
    <div className="space-y-6 text-slate-800 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#F58220] to-[#e07010] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xs text-white/70 font-semibold uppercase tracking-wider">Track Coordinator</div>
            <h1 className="text-2xl font-black mt-0.5">
              {trackName || "No Track Assigned"}
            </h1>
            <p className="text-white/85 text-sm mt-0.5 font-semibold">Manage your track participants and file submissions</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 relative z-10 text-slate-800">
        <Card className="bg-[#6F42C1]/5 border border-purple-200 text-[#6F42C1] shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-purple-400 transition-all duration-300">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 border border-purple-200">
                <Users className="w-4 h-4 sm:w-5 h-5 text-[#6F42C1]" />
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-black text-slate-800 leading-none">{total}</div>
                <div className="text-[10px] sm:text-xs text-purple-600/70 font-bold uppercase tracking-wide mt-1">Total Assigned</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-400 transition-all duration-300">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-200">
                <FileCheck className="w-4 h-4 sm:w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-black text-emerald-800 leading-none">{submitted}</div>
                <div className="text-[10px] sm:text-xs text-emerald-600/70 font-bold uppercase tracking-wide mt-1">Files Submitted</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border border-amber-200 text-amber-800 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-400 transition-all duration-300">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
                <FileClock className="w-4 h-4 sm:w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-black text-amber-800 leading-none">{pending}</div>
                <div className="text-[10px] sm:text-xs text-amber-600/70 font-bold uppercase tracking-wide mt-1">Pending Files</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Participants Table */}
      <Card className="bg-white border border-slate-200 shadow-md hover:shadow-xl hover:border-orange-500/15 transition-all duration-300 relative z-10 text-slate-800">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-black text-slate-800">Track Participants</CardTitle>
            <div className="relative max-w-xs w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search name, session..."
                className="pl-9 h-9 text-sm bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#F58220] focus:ring-[#F58220]/20"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile view: list of cards */}
          <div className="block md:hidden divide-y divide-slate-100 bg-slate-50/45 rounded-b-2xl">
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="p-4 space-y-3 bg-white">
                  <div className="flex justify-between"><Skeleton className="h-5 w-20 bg-slate-100" /><Skeleton className="h-5 w-20 bg-slate-100" /></div>
                  <Skeleton className="h-6 w-3/4 bg-slate-100" />
                  <Skeleton className="h-4 w-1/2 bg-slate-100" />
                </div>
              ))
            ) : participants && participants.length > 0 ? (
              participants.map((p, i) => (
                <div
                  key={`${p.participantId}-${i}`}
                  className="p-4 space-y-3 bg-white hover:bg-slate-50 transition-colors duration-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${ROLE_COLOR[p.role] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                    >
                      {p.role}
                    </Badge>
                    <div>
                      {p.hasFile && p.fileId ? (
                        <a href={`/api/files/${p.fileId}/download?token=${encodeURIComponent(localStorage.getItem("vision2020_token") || "")}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 h-7 text-[10px] px-2 gap-1 transition-all">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Download
                          </Button>
                        </a>
                      ) : NEEDS_FILE.includes(p.role) ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-bold px-2 py-0.5 bg-amber-50 rounded-md border border-amber-200">
                          <AlertCircle className="w-3 h-3 text-amber-500" /> Pending
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">N/A</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 font-semibold">{p.institution}</div>
                  </div>

                  {(p.presentationTitle || p.sessionName) && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 space-y-1">
                      {p.presentationTitle && (
                        <div className="font-bold text-slate-800 text-xs line-clamp-2">
                          "{p.presentationTitle}"
                        </div>
                      )}
                      {p.sessionName && (
                        <div className="text-[10px] text-slate-400 font-bold">{p.sessionName}</div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400 font-bold">
                    {p.date && <span>📅 {p.date}</span>}
                    {p.time && <span>⏰ {p.time}</span>}
                    {p.hall && <span>📍 {p.hall}</span>}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <Users className="w-8 h-8 text-slate-200" />
                <span className="text-sm font-semibold">{trackName ? "No participants found for this track." : "No track assigned to your account."}</span>
              </div>
            )}
          </div>

          {/* Desktop view: Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50/50">
                  <TableHead className="text-xs font-bold text-slate-500">Role</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500">Participant</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500">Session & Title</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500">Schedule</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500 text-right">Files</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <TableRow key={i} className="border-b border-slate-100">
                      {[1,2,3,4,5].map(j => (
                        <TableCell key={j}><Skeleton className="h-8 w-full bg-slate-100" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : participants && participants.length > 0 ? (
                  participants.map((p, i) => (
                    <TableRow key={`${p.participantId}-${i}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-bold ${ROLE_COLOR[p.role] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                        >
                          {p.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                        <div className="text-xs text-slate-400 font-bold mt-0.5">{p.institution}</div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {p.presentationTitle && (
                          <div className="font-bold text-slate-900 text-sm truncate" title={p.presentationTitle}>
                            {p.presentationTitle}
                          </div>
                        )}
                        {p.sessionName && (
                          <div className="text-xs text-slate-400 font-semibold mt-0.5 truncate">{p.sessionName}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-600 space-y-0.5">
                          {p.date && <div className="font-bold text-slate-800">{p.date}</div>}
                          {p.time && <div className="font-semibold text-slate-500">{p.time}</div>}
                          {p.hall && <div className="text-slate-400 font-bold">{p.hall}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.hasFile && p.fileId ? (
                          <a href={`/api/files/${p.fileId}/download?token=${encodeURIComponent(localStorage.getItem("vision2020_token") || "")}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-250 bg-emerald-50 hover:bg-emerald-100 h-7 text-xs gap-1.5 transition-all shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Download
                            </Button>
                          </a>
                        ) : NEEDS_FILE.includes(p.role) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-bold px-2 py-1 bg-amber-50 border border-amber-200 rounded-md">
                            <AlertCircle className="w-3 h-3 text-amber-500" /> Pending
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-bold">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Users className="w-8 h-8 text-slate-200" />
                        <span className="text-sm font-semibold">{trackName ? "No participants found for this track." : "No track assigned to your account."}</span>
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
