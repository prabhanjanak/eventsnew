import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Layers, Clock, MapPin, User, Search, ChevronDown, ChevronUp,
  Calendar, Loader2, CheckCheck, AlertCircle, Mail, Mic2, X,
  Gavel, Shield, MessageSquare, Users, Filter, Award, Image
} from "lucide-react";
import sankaraLogo from "/sankara-logo.png";

// ─── Types ────────────────────────────────────────────────────────────────────
type Speaker = { name: string; role: string; title: string | null; time?: string };
type TimetableItem = { sessionName: string; sessionCode?: string; hall: string | null; speakers: Speaker[] };
type TimetableSlot = { time: string; sessions: Array<{ track: string; items: TimetableItem[] }> };
type TimetableDay = { date: string; dayKey: string; timeSlots: TimetableSlot[] };
type PosterItem = { title: string; presenter: string; time: string; date: string };
type TimetableData = { tracks: string[]; days: TimetableDay[]; posters: PosterItem[] };

// ─── Constants ────────────────────────────────────────────────────────────────
export function normalizeTrackName(t: string): string {
  if (!t) return "";
  const trim = t.trim();
  if (trim === "Track 1" || trim === "Track 01") return "Track 01";
  if (trim === "Track 2" || trim === "Track 02") return "Track 02";
  if (trim === "Track 3" || trim === "Track 03") return "Track 03";
  if (trim === "Track 4" || trim === "Track 04") return "Track 04";
  if (trim === "Track 5 Hall A" || trim === "Track 5.1") return "Track 5.1";
  if (trim === "Track 5 Hall B" || trim === "Track 5.2") return "Track 5.2";
  if (trim === "Poster Exhibition" || trim === "e-Posters Hall-A" || trim === "Poster Hall A" || trim === "e-Posters Hall A" || trim.includes("Poster Hall A") || trim.includes("Posters Hall-A")) return "e-Posters Hall-A";
  if (trim === "e-Posters Hall-B" || trim === "Poster Hall B" || trim === "e-Posters Hall B" || trim.includes("Poster Hall B") || trim.includes("Posters Hall-B")) return "e-Posters Hall-B";
  return trim;
}

const VALID_TRACKS = ["Track 01", "Track 02", "Track 03", "Track 04", "Track 5.1", "Track 5.2", "e-Posters Hall-A", "e-Posters Hall-B"];

const TRACK_META: Record<string, { name: string; location: string; color: string; bg: string; border: string; badge: string; short: string; theme: string }> = {
  "Track 01": { name: "Track 01 - Netravathi Hall", location: "3rd Floor", color: "#F4C14B", bg: "bg-[#F4C14B]/10", border: "border-[#F4C14B]/30", badge: "bg-[#F4C14B] text-slate-900", short: "T1", theme: "Innovations and Technological Solutions in Eye Care" },
  "Track 02": { name: "Track 02 - Hemavathi Hall", location: "2nd Floor", color: "#2D294F", bg: "bg-[#2D294F]/5", border: "border-[#2D294F]/20", badge: "bg-[#2D294F] text-white", short: "T2", theme: "Collaboration for Universal Eye Health" },
  "Track 03": { name: "Track 03 - Arkavathi Hall", location: "2nd Floor", color: "#62C1CF", bg: "bg-[#62C1CF]/10", border: "border-[#62C1CF]/30", badge: "bg-[#62C1CF] text-slate-900", short: "T3", theme: "Impact, Equity, Sustainability and Quality in Eye Care" },
  "Track 04": { name: "Track 04 - Vedavathi Hall", location: "2nd Floor", color: "#E45F76", bg: "bg-[#E45F76]/10", border: "border-[#E45F76]/30", badge: "bg-[#E45F76] text-white", short: "T4", theme: "Excellence in Optometry and Allied Ophthalmic Personnel" },
  "Track 5.1": { name: "Track 5.1 - Tunga Hall", location: "2nd Floor", color: "#F06422", bg: "bg-[#F06422]/10", border: "border-[#F06422]/30", badge: "bg-[#F06422] text-white", short: "5.1", theme: "Sharing Knowledge Repository: Towards Organization's Excellence & Growth" },
  "Track 5.2": { name: "Track 5.2 - Bhadra Hall", location: "2nd Floor", color: "#F06422", bg: "bg-[#F06422]/10", border: "border-[#F06422]/30", badge: "bg-[#F06422] text-white", short: "5.2", theme: "Sharing Knowledge Repository: Towards Organization's Excellence & Growth" },
  "e-Posters Hall-A": { name: "e-Posters Hall-A - Ghataprabha Hall", location: "2nd Floor", color: "#62B99C", bg: "bg-[#62B99C]/10", border: "border-[#62B99C]/30", badge: "bg-[#62B99C] text-white", short: "EPA", theme: "e-Posters" },
  "e-Posters Hall-B": { name: "e-Posters Hall-B - Malaprabha Hall", location: "2nd Floor", color: "#62B99C", bg: "bg-[#62B99C]/10", border: "border-[#62B99C]/30", badge: "bg-[#62B99C] text-white", short: "EPB", theme: "e-Posters" },
};

export function getTrackMeta(t: string) {
  const norm = normalizeTrackName(t);
  return TRACK_META[norm] || { name: norm, location: "", color: "#64748b", bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-600 text-white", short: "?", theme: "" };
}

type RoleCfg = { label: string; icon: any; cls: string };
const ROLE_CONFIG: Record<string, RoleCfg> = {
  Chair:      { label: "Chair",      icon: Shield,        cls: "bg-purple-100 text-purple-700 border-purple-200" },
  CoChair:    { label: "Co-Chair",   icon: Shield,        cls: "bg-violet-100 text-violet-700 border-violet-200" },
  Moderator:  { label: "Moderator",  icon: MessageSquare, cls: "bg-blue-100 text-blue-700 border-blue-200" },
  Judge:      { label: "Judge",      icon: Gavel,         cls: "bg-amber-100 text-amber-700 border-amber-200" },
  Panelist:   { label: "Panelist",   icon: Users,         cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  Speaker:    { label: "Speaker",    icon: Mic2,          cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  Presenter:  { label: "Presenter",  icon: Mic2,          cls: "bg-teal-100 text-teal-700 border-teal-200" },
  Discussion: { label: "Discussant", icon: MessageSquare, cls: "bg-sky-100 text-sky-700 border-sky-200" },
  Award:      { label: "Award",      icon: Award,         cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
};
function getRoleCfg(role: string): RoleCfg {
  return ROLE_CONFIG[role] || { label: role, icon: User, cls: "bg-slate-100 text-slate-600 border-slate-200" };
}
const ROLE_ORDER = ["Chair","CoChair","Moderator","Judge","Speaker","Presenter","Panelist","Discussion","Award"];
function sortSpeakers(speakers: Speaker[]) {
  return [...speakers].sort((a,b)=>{
    const ai=ROLE_ORDER.indexOf(a.role), bi=ROLE_ORDER.indexOf(b.role);
    return (ai===-1?99:ai)-(bi===-1?99:bi);
  });
}
const ROLE_FILTERS = ["All","Chair","CoChair","Moderator","Judge","Speaker","Presenter","Panelist"];

// ─── RSVP Modal ───────────────────────────────────────────────────────────────
function WishToAttendModal({ open, onClose, session, defaultEmail }: {
  open: boolean; onClose: () => void;
  session: { sessionName: string; track: string; date: string; time: string } | null;
  defaultEmail: string;
}) {
  const [identifier, setIdentifier] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"already"|"error">("idle");
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) setIdentifier(defaultEmail || localStorage.getItem("vision2020_rsvp_identifier") || "");
  }, [open, defaultEmail]);

  function reset() { setStatus("idle"); setName(""); setErrorMsg(""); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !session) return;
    setStatus("loading");
    try {
      const resp = await fetch("/api/rsvp/email", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ identifier: identifier.trim(), trackName: session.track, sessionName: session.sessionName, sessionDate: session.date, sessionTime: session.time }),
      });
      const data = await resp.json();
      if (!resp.ok) { setErrorMsg(data.error||"Something went wrong."); setStatus("error"); }
      else { setName(data.name||""); localStorage.setItem("vision2020_rsvp_identifier", identifier.trim()); setStatus(data.alreadyRsvpd?"already":"success"); }
    } catch { setErrorMsg("Network error."); setStatus("error"); }
  }

  const meta = session ? getTrackMeta(session.track) : getTrackMeta("Track 1");
  return (
    <Dialog open={open} onOpenChange={(v)=>{if(!v){reset();onClose();}}}>
      <DialogContent className="bg-white border border-slate-200 text-slate-800 rounded-2xl max-w-md shadow-2xl p-0 overflow-hidden">
        <div className="h-1.5 w-full bg-[#F58220]" />
        <div className="p-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-xl font-bold text-slate-900">Wish to Attend</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm mt-1">Confirm your interest in this session.</DialogDescription>
          </DialogHeader>
          {session && (
            <div className={`rounded-xl border ${meta.border} ${meta.bg} p-4 mb-5 space-y-1.5`}>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md ${meta.badge}`}>{session.track}</span>
              <p className="text-slate-900 font-extrabold text-sm leading-snug mt-1.5">{session.sessionName}</p>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold pt-1">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-[#F58220]"/>{session.date}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#F58220]"/>{session.time}</span>
              </div>
            </div>
          )}
          {status==="success" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCheck className="w-8 h-8 text-emerald-600"/></div>
              <p className="text-lg font-bold">Thank you, {name}!</p>
              <Button onClick={()=>{reset();onClose();}} className="mt-3 bg-[#F58220] hover:bg-[#e07010] text-white rounded-xl font-bold w-full h-11">Done</Button>
            </div>
          )}
          {status==="already" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center"><CheckCheck className="w-8 h-8 text-orange-600"/></div>
              <p className="text-lg font-bold">Already registered, {name}!</p>
              <Button onClick={()=>{reset();onClose();}} className="mt-3 bg-[#F58220] hover:bg-[#e07010] text-white rounded-xl font-bold w-full h-11">Close</Button>
            </div>
          )}
          {(status==="idle"||status==="loading"||status==="error") && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rsvp-id" className="text-sm font-semibold text-slate-700">Registered Email or Mobile Number</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                  <Input id="rsvp-id" type="text" placeholder="email@example.com or 10-digit mobile" value={identifier}
                    onChange={e=>{setIdentifier(e.target.value);setStatus("idle");setErrorMsg("");}}
                    className="pl-9 bg-slate-50 border-slate-200 rounded-xl h-11 focus:ring-2 focus:ring-[#F58220] focus:border-transparent font-medium"
                    required disabled={status==="loading" || !!defaultEmail}/>
                </div>
                {status==="error" && (
                  <div className="flex items-start gap-2 text-red-600 text-xs mt-1.5 bg-red-50 border border-red-100 rounded-lg p-2.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/><span>{errorMsg}</span>
                  </div>
                )}
                <p className="text-xs text-slate-400">Must match your registered email or mobile.</p>
              </div>
              <Button type="submit" disabled={status==="loading"||!identifier.trim()}
                className="w-full h-11 font-bold rounded-xl text-white bg-[#F58220] hover:bg-[#e07010] gap-2">
                {status==="loading"?<><Loader2 className="w-4 h-4 animate-spin"/>Verifying…</>:<><CheckCheck className="w-4 h-4"/>Wish to Attend</>}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cfg = getRoleCfg(role);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <Icon className="w-2.5 h-2.5"/>{cfg.label}
    </span>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ item, track, time, date, onWishToAttend, roleFilter }: {
  item: TimetableItem; track: string; time: string; date: string;
  onWishToAttend?: (presentation: { title: string, time: string, presenter: string }) => void; roleFilter: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = getTrackMeta(track);
  const sorted = useMemo(()=>sortSpeakers(item.speakers),[item.speakers]);

  // Leadership: Chair, CoChair, Moderator, Judge
  const leadership = sorted.filter(s=>["Chair","CoChair","Moderator","Judge"].includes(s.role));
  // Presenters: everyone else
  const presenters = sorted.filter(s=>!["Chair","CoChair","Moderator","Judge"].includes(s.role));

  const showLeadership = roleFilter==="All" ? leadership : leadership.filter(s=>s.role===roleFilter);
  const showPresenters = roleFilter==="All" ? presenters : presenters.filter(s=>s.role===roleFilter);

  if (roleFilter!=="All" && showLeadership.length===0 && showPresenters.length===0) return null;

  const roles = [...new Set(sorted.map(s=>s.role))];
  const LIMIT = 4;

  return (
    <div className={`rounded-2xl border ${meta.border} bg-white hover:shadow-md transition-all duration-200 overflow-hidden mb-4`}>
      <div className="h-1 w-full" style={{backgroundColor:meta.color}}/>
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3.5">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${meta.badge}`}>{track}</span>
              {item.sessionCode && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {item.sessionCode}
                </span>
              )}
              {item.hall && <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold"><MapPin className="w-2.5 h-2.5 text-slate-400"/>{item.hall}</span>}
            </div>
            <h3 className="text-slate-900 font-bold text-sm sm:text-base leading-snug">{item.sessionName}</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
              <Clock className="w-3 h-3 text-[#F58220]"/>{time}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 shrink-0 sm:max-w-[160px] sm:justify-end">
            {roles.slice(0,3).map(r=><RoleBadge key={r} role={r}/>)}
            {roles.length>3 && <span className="text-[9px] text-slate-400 font-bold self-center">+{roles.length-3}</span>}
          </div>
        </div>

        {/* Leadership Panel (Chair / CoChair / Moderator / Judge) */}
        {showLeadership.length>0 && (
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 mb-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Shield className="w-3 h-3"/>Session Leadership
            </p>
            <div className="space-y-1.5">
              {showLeadership.map((s,i)=>(
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <RoleBadge role={s.role}/>
                  <span className="text-xs font-medium text-slate-600">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Speakers / Presenters list */}
        {showPresenters.length>0 && (
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Mic2 className="w-3 h-3"/>
              {showPresenters.some(s=>s.role==="Presenter")?"Presenters":"Speakers"} ({showPresenters.length})
            </p>
            <div className="divide-y divide-slate-50">
              {showPresenters.slice(0,expanded?showPresenters.length:LIMIT).map((s,i)=>(
                <div key={i} className="flex items-start gap-2.5 py-2.5 first:pt-0">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black text-slate-500">
                    {String(i+1).padStart(2,"0")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-medium text-slate-500">{s.name}</span>
                        <RoleBadge role={s.role}/>
                      </div>
                      {s.time && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold sm:ml-auto shrink-0">
                          <Clock className="w-2.5 h-2.5 text-[#F58220]" /> {s.time}
                        </span>
                      )}
                    </div>
                    {s.title && <p className="text-xs text-slate-900 font-extrabold leading-snug mb-2">{s.title}</p>}
                    {onWishToAttend && (
                      <button onClick={() => onWishToAttend({ title: s.title || item.sessionName, time: s.time || time, presenter: s.name })}
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-md bg-[#F58220] hover:bg-[#e07010] text-white transition-all shadow-sm cursor-pointer mt-1">
                        <CheckCheck className="w-3 h-3"/>Wish to Attend
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {showPresenters.length>LIMIT && (
              <button onClick={()=>setExpanded(e=>!e)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#6F42C1] hover:text-[#5a32a3] mt-2 transition-colors">
                {expanded?<><ChevronUp className="w-3.5 h-3.5"/>Show less</>:<><ChevronDown className="w-3.5 h-3.5"/>Show {showPresenters.length-LIMIT} more</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TracksPage({
  embedded = false,
  participantName = "",
  participantEmail = ""
}: {
  embedded?: boolean;
  participantName?: string;
  participantEmail?: string;
  [key: string]: any;
}) {
  const params = useParams<{ registrationNumber?: string }>();
  const regNumber = params.registrationNumber?.toUpperCase() ?? "";

  const [timetable, setTimetable] = useState<TimetableData|null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<string>("Track 1");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [prefilledEmail, setPrefilledEmail] = useState(participantEmail);
  const [prefilledName, setPrefilledName] = useState(participantName);

  useEffect(() => {
    if (participantEmail) setPrefilledEmail(participantEmail);
    if (participantName) setPrefilledName(participantName);
  }, [participantEmail, participantName]);
  const [rsvpModal, setRsvpModal] = useState<{
    open: boolean;
    session: { sessionName: string; track: string; date: string; time: string }|null;
  }>({open:false,session:null});

  useEffect(()=>{
    if(regNumber) {
      fetch(`/api/participants/public-lookup/${regNumber}`)
        .then(r=>r.json()).then(d=>{if(d.email){setPrefilledEmail(d.email);setPrefilledName(d.name);}}).catch(()=>{});
    }
  },[regNumber]);

  useEffect(()=>{
    fetch("/api/timetable")
      .then(r=>r.json())
      .then((d:TimetableData)=>{
        setTimetable(d);
        const sp=new URLSearchParams(window.location.search);
        const tp=sp.get("track");
        if(tp&&VALID_TRACKS.includes(tp)) setSelectedTrack(tp);
        else if(d.tracks.length>0) setSelectedTrack(d.tracks[0]);
      })
      .catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const currentDay = timetable?.days[selectedDayIdx];
  const isTrack5 = selectedTrack.startsWith("Track 5");
  const isPosterTab = selectedTrack === "Poster Exhibition";

  // Filter regular sessions
  const sessions = useMemo(()=>{
    if(isPosterTab||!currentDay||!selectedTrack) return [];
    const result:Array<{time:string;item:TimetableItem}>=[];
    for(const slot of currentDay.timeSlots){
      const match=slot.sessions.find(s=>s.track===selectedTrack);
      if(match) for(const item of match.items) result.push({time:slot.time,item});
    }
    return result;
  },[currentDay,selectedTrack,isPosterTab]);

  const filteredSessions = useMemo(()=>{
    if(!search.trim()) return sessions;
    const q=search.toLowerCase();
    return sessions.filter(({item})=>
      item.sessionName.toLowerCase().includes(q)||
      item.speakers.some(s=>s.name.toLowerCase().includes(q)||(s.title||"").toLowerCase().includes(q))
    );
  },[sessions,search]);

  const byTime = useMemo(()=>{
    const map:Record<string,typeof filteredSessions>={};
    for(const s of filteredSessions){if(!map[s.time])map[s.time]=[];map[s.time].push(s);}
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b));
  },[filteredSessions]);

  // Filter posters
  const filteredPosters = useMemo(()=>{
    if (!timetable?.posters) return [];
    const raw = timetable.posters;
    if (!search.trim()) return raw;
    const q = search.toLowerCase();
    return raw.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.presenter.toLowerCase().includes(q)
    );
  }, [timetable?.posters, search]);

  const trackCounts = useMemo(()=>{
    if(!currentDay) return {} as Record<string,number>;
    const c:Record<string,number>={};
    for(const track of VALID_TRACKS){
      if (track === "Poster Exhibition") {
        c[track] = timetable?.posters?.length || 0;
        continue;
      }
      let n=0;
      for(const slot of currentDay.timeSlots){const m=slot.sessions.find(s=>s.track===track);if(m)n+=m.items.length;}
      c[track]=n;
    }
    return c;
  },[currentDay, timetable?.posters]);

  const roleCounts = useMemo(()=>{
    if (isPosterTab) return { All: filteredPosters.length };
    const c:Record<string,number>={All:filteredSessions.reduce((a,s)=>a+s.item.speakers.length,0)};
    for(const {item} of filteredSessions) for(const sp of item.speakers){c[sp.role]=(c[sp.role]||0)+1;}
    return c;
  },[filteredSessions, isPosterTab, filteredPosters]);

  const currentMeta = getTrackMeta(selectedTrack);

  const totalVisible = useMemo(()=>{
    if (isPosterTab) return filteredPosters.length;
    if (roleFilter==="All") return filteredSessions.length;
    return filteredSessions.filter(({item})=>item.speakers.some(s=>s.role===roleFilter)).length;
  },[filteredSessions, roleFilter, isPosterTab, filteredPosters]);

  return (
    <div className={embedded ? "text-slate-800 flex flex-col font-sans" : "min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans"}>
      {!embedded && (
        <>
          <title>Scientific Programme | Vision 2020 India</title>
          <header className="sticky top-0 bg-white border-b border-slate-200 z-30 shadow-sm shrink-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={sankaraLogo} alt="Sankara Logo" className="h-9 w-auto"/>
                <div className="w-px h-7 bg-slate-200 hidden sm:block"/>
                <div>
                  <p className="text-[9px] font-black text-[#F58220] uppercase tracking-widest leading-none mb-0.5">Vision 2020 India · Annual Conference 2026</p>
                  <h1 className="text-base sm:text-lg font-black text-slate-900 leading-none">Scientific Programme</h1>
                </div>
              </div>
              {prefilledName && (
                <Badge className="bg-[#6F42C1] text-white py-1 px-3 rounded-lg flex items-center gap-1.5 shrink-0 text-xs font-bold">
                  <User className="w-3.5 h-3.5"/>Welcome, {prefilledName}
                </Badge>
              )}
            </div>
          </header>
        </>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 py-32 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#F58220]"/>
          <p className="text-slate-500 font-semibold text-sm">Loading conference schedule…</p>
        </div>
      ) : !timetable||timetable.days.length===0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-32 gap-3 text-slate-400">
          <Mic2 className="w-12 h-12 opacity-30"/>
          <p className="font-semibold">No schedule data available yet.</p>
        </div>
      ) : (
        <>
          {/* Day Tabs */}
          <div className={`bg-white border-b border-slate-200/80 sticky z-20 shadow-sm ${embedded ? "top-0" : "top-[61px]"}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex space-x-6 overflow-x-auto no-scrollbar py-2.5">
                {timetable.days.map((day,idx)=>(
                  <button key={day.dayKey} onClick={()=>{setSelectedDayIdx(idx);setSearch("");setRoleFilter("All");}}
                    className={`pb-1 text-xs sm:text-sm font-black whitespace-nowrap transition-all border-b-2 cursor-pointer ${selectedDayIdx===idx?"border-[#F58220] text-[#F58220]":"border-transparent text-slate-500 hover:text-slate-900"}`}>
                    {day.date}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={embedded ? "w-full py-4 flex-1" : "max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1"}>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

              {/* Main Area */}
              <div className="space-y-5">

                {/* Track Selector + Search */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#F58220]"/>Select Programme Track / Exhibition
                    </p>
                    <div className="relative w-full sm:w-64 shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                      <Input placeholder={isPosterTab ? "Search poster title/presenter..." : "Search topic or speaker…"} value={search} onChange={e=>setSearch(e.target.value)}
                        className="pl-8 bg-slate-50 border-slate-200 rounded-xl h-9 text-xs focus:border-[#F58220] focus:ring-[#F58220]/20"/>
                      {search && <button onClick={()=>setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5"/></button>}
                    </div>
                  </div>

                  {/* Track Pills */}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1.5 flex-nowrap -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                    {VALID_TRACKS.filter(t => {
                      if (selectedDayIdx === 0) {
                        return ["Track 01", "Track 02", "Track 03", "Track 04", "Track 5.1"].includes(t);
                      }
                      return true;
                    }).map(track=>{
                      const isActive=selectedTrack===track;
                      const count=trackCounts[track]??0;
                      const m=getTrackMeta(track);
                      const isPreConf=selectedDayIdx===0;
                      const preConfNames: Record<string, string> = {
                        "Track 01": "20/20 AI Workshop",
                        "Track 02": "Quality Beyond Accreditation",
                        "Track 03": "Optics & Dispensing",
                        "Track 04": "CSR & Partnerships",
                        "Track 5.1": "Infection Prevention",
                      };
                      const displayTitle = isPreConf ? (preConfNames[track] || m.name) : m.name;
                      const displayShort = isPreConf ? {
                        "Track 01": "AI",
                        "Track 02": "Accreditation",
                        "Track 03": "Optics",
                        "Track 04": "CSR",
                        "Track 5.1": "Infection Control",
                      }[track] || m.short : m.short;
                      const isHall=track.startsWith("Track 5") || isPreConf;
                      const isPoster=track === "Poster Exhibition";
                      return (
                        <button key={track} onClick={()=>{setSelectedTrack(track);setSearch("");setRoleFilter("All");}}
                          className={`px-3 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 ${isActive?"text-white shadow-sm border-transparent":"bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                          style={isActive?{backgroundColor:m.color,borderColor:m.color}:{}}>
                          {isHall && (
                            <>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isActive?"bg-white/25":"bg-slate-200 text-slate-500"}`}>{displayShort}</span>
                            </>
                          )}
                          {isPoster && (
                            <Image className="w-3.5 h-3.5"/>
                          )}
                          <span>{displayTitle}</span>
                          {count>0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive?"bg-white/25 text-white":"bg-slate-200 text-slate-500"}`}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Track 5 Hall info strip */}
                  {isTrack5 && (
                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                        <span className="w-4 h-4 rounded bg-orange-600 flex items-center justify-center text-white text-[8px] font-black">A</span>
                        Hall A = Tunga Hall (2nd Floor)
                      </div>
                      <div className="w-px h-3 bg-slate-200"/>
                      <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                        <span className="w-4 h-4 rounded bg-orange-600 flex items-center justify-center text-white text-[8px] font-black">B</span>
                        Hall B = Bhadra Hall (2nd Floor)
                      </div>
                      <div className="flex-1"/>
                      <span className="text-[9px] text-slate-400 font-medium italic">Both halls color-coded orange</span>
                    </div>
                  )}
                </div>

                {/* Main Content Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${currentMeta.badge}`}>
                          {selectedDayIdx === 0 ? ({
                            "Track 01": "20/20 AI Workshop",
                            "Track 02": "Quality Beyond Accreditation",
                            "Track 03": "Optics & Dispensing",
                            "Track 04": "CSR & Partnerships",
                            "Track 5.1": "Infection Prevention",
                          }[selectedTrack] || currentMeta.name) : currentMeta.name}
                        </span>
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-650 border border-slate-200">
                          {selectedDayIdx === 0 ? ({
                            "Track 01": "3rd Floor",
                            "Track 02": "2nd Floor",
                            "Track 03": "2nd Floor",
                            "Track 04": "2nd Floor",
                            "Track 5.1": "2nd Floor",
                          }[selectedTrack] || currentMeta.location) : currentMeta.location}
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                          {isPosterTab ? "Poster Catalogue (Exhibition)" : "Session Details"}
                        </h2>
                      </div>
                      <p className="text-slate-400 text-[11px] font-semibold">
                        {isPosterTab ? `${totalVisible} poster presentations` : `${currentDay?.date} · ${totalVisible} session${totalVisible!==1?"s":""}`}
                      </p>
                    </div>
                    {roleFilter!=="All" && !isPosterTab && (
                      <button onClick={()=>setRoleFilter("All")} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1 hover:bg-slate-50">
                        <X className="w-3 h-3"/>Clear filter
                      </button>
                    )}
                  </div>

                  {isPosterTab ? (
                    // Poster Exhibition View
                    filteredPosters.length === 0 ? (
                      <div className="text-center py-20 text-slate-400">
                        <Image className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                        <p className="font-semibold">No posters match your query.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredPosters.map((poster, idx) => (
                          <div key={idx} className="border border-pink-100 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                            <div className="space-y-2">
                              <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 border border-pink-200 text-[10px] font-black rounded-lg">Poster Presentation</Badge>
                              <h3 className="text-slate-900 font-bold text-sm leading-snug line-clamp-3">{poster.title}</h3>
                            </div>
                            <div className="border-t border-slate-50 pt-3 mt-3 space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                                <User className="w-3.5 h-3.5 text-pink-500 shrink-0"/>
                                <span>{poster.presenter}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold pt-1">
                                {poster.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{poster.date}</span>}
                                {poster.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{poster.time}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    // Regular Sessions View
                    byTime.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center"><Mic2 className="w-7 h-7 text-slate-300"/></div>
                        <div>
                          <p className="text-slate-700 font-bold">{search?"No matches found":`No sessions for ${selectedTrack}`}</p>
                          {search && <button onClick={()=>setSearch("")} className="text-[#F58220] text-xs font-bold mt-1.5">Reset search</button>}
                        </div>
                      </div>
                    ) : (
                      <div>
                        {byTime.map(([time,items])=>{
                          const visibleItems=roleFilter==="All"?items:items.filter(({item})=>item.speakers.some(s=>s.role===roleFilter));
                          if(visibleItems.length===0) return null;
                          return (
                            <div key={time} className="mb-7">
                              {/* Time divider */}
                              <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl text-white shadow-sm" style={{backgroundColor:currentMeta.color}}>
                                  <Clock className="w-3.5 h-3.5"/>{time}
                                </div>
                                <div className="flex-1 h-px bg-slate-100"/>
                                <span className="text-[10px] text-slate-400 font-bold">{visibleItems.length} session{visibleItems.length!==1?"s":""}</span>
                              </div>
                              {visibleItems.map(({item},idx)=>(
                                <SessionCard key={idx} item={item} track={selectedTrack} time={time}
                                  date={currentDay?.date||""} roleFilter={roleFilter}
                                  onWishToAttend={(presentation)=>setRsvpModal({
                                    open:true,
                                    session:{
                                      sessionName: presentation.title,
                                      track: selectedTrack,
                                      date: currentDay?.date||"",
                                      time: presentation.time
                                    }
                                  })}/>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">

                {/* Filter by Role — hidden for posters */}
                {!isPosterTab && (
                  <Card className="border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-[#F58220]"/>Filter by Role
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1 space-y-0.5">
                      {ROLE_FILTERS.map(role=>{
                        const isActive=roleFilter===role;
                        const count=roleCounts[role]??0;
                        const cfg=role==="All"?null:getRoleCfg(role);
                        const Icon=cfg?.icon||Users;
                        return (
                          <button key={role} onClick={()=>setRoleFilter(role)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${isActive?"bg-[#6F42C1] text-white shadow-sm":"hover:bg-slate-50 text-slate-600"}`}>
                            <span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5"/>{role==="All"?"All Roles":getRoleCfg(role).label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${isActive?"bg-white/25 text-white":"bg-slate-100 text-slate-500"}`}>{count}</span>
                          </button>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Posters Info Card */}
                {isPosterTab && (
                  <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl shadow-sm">
                    <CardContent className="p-4 space-y-2.5">
                      <p className="text-[10px] font-black text-pink-700 uppercase tracking-wider flex items-center gap-1"><Image className="w-3.5 h-3.5"/>Posters Exhibition</p>
                      <p className="text-xs font-semibold text-slate-600 leading-normal">
                        Posters are listed as part of the conference exhibition catalog. Tap search to find specific scientific posters by topic or presenter name.
                      </p>
                      <div className="text-[11px] font-bold text-pink-600 bg-white/70 border border-pink-100 rounded-xl p-2.5">
                        Exhibition runs on both conference days.
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Track 5 Hall Guide — only shown for Track 5 */}
                {isTrack5 && (
                  <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl shadow-sm">
                    <CardContent className="p-4 space-y-2.5">
                      <p className="text-[10px] font-black text-teal-700 uppercase tracking-wider">Track 5 Hall Guide</p>
                      <div className="space-y-2">
                        <button onClick={()=>{setSelectedTrack("Track 5 Hall A");setRoleFilter("All");}}
                          className={`w-full flex items-start gap-2.5 rounded-xl p-2.5 border transition-all text-left ${selectedTrack==="Track 5 Hall A"?"bg-teal-600 border-teal-600 text-white":"bg-white/70 border-teal-100 hover:bg-teal-50 text-slate-700"}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${selectedTrack==="Track 5 Hall A"?"bg-white/30 text-white":"bg-teal-600 text-white"}`}>A</div>
                          <div>
                            <p className="text-xs font-bold">Hall A — Screen 5.1</p>
                            <p className={`text-[10px] ${selectedTrack==="Track 5 Hall A"?"text-teal-100 text-white":"text-teal-600"}`}>{trackCounts["Track 5 Hall A"]||0} sessions · Both days</p>
                          </div>
                        </button>
                        <button onClick={()=>{setSelectedTrack("Track 5 Hall B");setRoleFilter("All");}}
                          className={`w-full flex items-start gap-2.5 rounded-xl p-2.5 border transition-all text-left ${selectedTrack==="Track 5 Hall B"?"bg-emerald-600 border-emerald-600 text-white":"bg-white/70 border-emerald-100 hover:bg-emerald-50 text-slate-700"}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${selectedTrack==="Track 5 Hall B"?"bg-white/30 text-white":"bg-emerald-600 text-white"}`}>B</div>
                          <div>
                            <p className="text-xs font-bold">Hall B — Screen 5.2</p>
                            <p className={`text-[10px] ${selectedTrack==="Track 5 Hall B"?"text-emerald-100 text-white":"text-emerald-600"}`}>{trackCounts["Track 5 Hall B"]||0} sessions · Both days</p>
                          </div>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* RSVP Instructions — hidden for posters */}
                {!isPosterTab && (
                  <Card className="border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCheck className="w-3.5 h-3.5 text-[#F58220]"/>How to RSVP
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-3 text-xs font-semibold text-slate-600">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-orange-100 text-[#F58220] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                        <p className="leading-tight">Tap <strong className="text-slate-800">"Wish to Attend"</strong> on any session.</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-orange-100 text-[#F58220] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                        <p className="leading-tight">Enter your registered email or mobile number.</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-[#6F42C1] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                        <p className="leading-tight">Email is saved — future RSVPs are <strong className="text-purple-600">one-click!</strong></p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

            </div>
          </div>
        </>
      )}

      <WishToAttendModal
        open={rsvpModal.open}
        onClose={()=>setRsvpModal({open:false,session:null})}
        session={rsvpModal.session}
        defaultEmail={prefilledEmail}
      />
    </div>
  );
}
