import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Minus,
  Loader2, 
  User, 
  QrCode,
  Compass, 
  Filter,
  CheckCheck
} from "lucide-react";
import bannerImg from "@assets/headerwebfinal.png";

type TimetableItem = {
  sessionName: string;
  hall: string | null;
  speakers: Array<{ name: string; role: string; title: string | null }>;
  evaluationTime?: string;
};

type TimetableSlot = {
  time: string;
  sessions: Array<{
    track: string;
    items: TimetableItem[];
  }>;
};

type TimetableDay = {
  date: string;
  timeSlots: TimetableSlot[];
};

type TimetableData = {
  tracks: string[];
  days: TimetableDay[];
};

export default function FlyerPage() {
  const { toast } = useToast();

  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem("vision2020_token"));
  const [email, setEmail] = useState("");
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [participantName, setParticipantName] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);

  // Timetable State
  const [timetable, setTimetable] = useState<TimetableData | null>(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState("Track 1");

  // Filter States
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("all");

  // User RSVPs
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpToggling, setRsvpToggling] = useState<number | string | null>(null);

  // Fetch participant info on token change
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid session");
        return res.json();
      })
      .then((data) => {
        if (data.user && data.user.userType === "participant") {
          setParticipantName(data.user.name);
          setParticipantId(data.user.id);
          fetchRSVPs(data.user.id);
        } else {
          // staff/admin can view but not RSVP as participant
          setParticipantName(data.user.name || "Administrator");
        }
      })
      .catch(() => {
        localStorage.removeItem("vision2020_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Fetch Timetable Data
  useEffect(() => {
    setTimetableLoading(true);
    fetch("/api/timetable")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load agenda");
        return res.json();
      })
      .then((data) => setTimetable(data))
      .catch((err) => console.error("Agenda error:", err))
      .finally(() => setTimetableLoading(false));
  }, []);

  const fetchRSVPs = (id: number) => {
    fetch(`/api/rsvp/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setRsvps(data);
      })
      .catch((err) => console.error("RSVP fetch error:", err));
  };

  // Auth: Request OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address.",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/participant/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      setParticipantId(data.participantId);
      setOtpSent(true);
      toast({
        title: "Verification Sent",
        description: "A one-time security OTP code has been sent to your email and WhatsApp.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Auth: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: "Please enter the 6-digit code.",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/participant/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, otp: otpCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid verification code");

      localStorage.setItem("vision2020_token", data.token);
      setToken(data.token);
      toast({
        title: "Access Verified",
        description: `Welcome to the dashboard, ${data.user.name}!`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // RSVP: Add or Remove
  const handleRsvpToggle = async (
    trackName: string,
    sessionName: string,
    sessionDate: string,
    sessionTime: string
  ) => {
    if (!token || !participantId) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to RSVP.",
      });
      return;
    }

    const matched = rsvps.find(
      (r) =>
        r.trackName === trackName &&
        r.sessionName === sessionName &&
        r.sessionDate === sessionDate
    );

    const toggleKey = `${trackName}-${sessionName}`;
    setRsvpToggling(toggleKey);

    try {
      if (matched) {
        // Delete RSVP
        const res = await fetch(`/api/rsvp/${matched.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to cancel RSVP");
        toast({
          title: "Removed from Schedule",
          description: "This session has been removed from your agenda.",
        });
      } else {
        // Add RSVP
        const res = await fetch("/api/rsvp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ trackName, sessionName, sessionDate, sessionTime })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to add RSVP");

        toast({
          title: "Wishlist Confirmed! 🌟",
          description: "Session added! Confirmation sent via WhatsApp & Email.",
        });
      }
      fetchRSVPs(participantId);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "RSVP Update Failed",
        description: err.message,
      });
    } finally {
      setRsvpToggling(null);
    }
  };

  // Process sessions under selected day and selected track
  const sessionsList = useMemo(() => {
    if (!timetable || !timetable.days[selectedDayIdx]) return [];
    
    const day = timetable.days[selectedDayIdx];
    const items: Array<{
      time: string;
      sessionName: string;
      hall: string | null;
      speakers: Array<{ name: string; role: string; title: string | null }>;
      date: string;
      evaluationTime?: string;
    }> = [];

    for (const slot of day.timeSlots) {
      const match = slot.sessions.find((s: any) => s.track === selectedTrack);
      if (match) {
        for (const item of match.items) {
          items.push({
            time: slot.time,
            sessionName: item.sessionName,
            hall: item.hall,
            speakers: item.speakers,
            date: day.date,
            evaluationTime: item.evaluationTime,
          });
        }
      }
    }
    return items;
  }, [timetable, selectedDayIdx, selectedTrack]);

  // Unique time slots for current track sessions (for filter)
  const timeSlotsOptions = useMemo(() => {
    const slots = sessionsList.map((s) => s.time);
    return ["all", ...Array.from(new Set(slots)).sort()];
  }, [sessionsList]);

  // Filtered Sessions — only by time
  const filteredSessions = useMemo(() => {
    return sessionsList.filter((s) => {
      return selectedTimeSlot === "all" || s.time === selectedTimeSlot;
    });
  }, [sessionsList, selectedTimeSlot]);

  const handleLogout = () => {
    localStorage.removeItem("vision2020_token");
    setToken(null);
    setParticipantId(null);
    setParticipantName("");
    setRsvps([]);
    setOtpSent(false);
    setOtpCode("");
  };

  // Render Login page if not verified
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl backdrop-blur-md shadow-inner">
              <QrCode className="w-16 h-16 text-indigo-400 animate-pulse" />
            </div>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mb-2 lg:text-5xl font-Outfit">
            Flyer RSVP Portal
          </h2>
          <p className="text-xl text-slate-300 font-medium">
            Scan &amp; Wish to Attend
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <Card className="border-indigo-500/20 bg-slate-900/80 backdrop-blur-lg shadow-2xl p-8 rounded-2xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-2xl font-bold text-white">Attendee Verification</CardTitle>
              <CardDescription className="text-slate-400 text-lg">
                Verify your identity to plan and build your personalized event schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-6">
                  <div>
                    <Label htmlFor="email" className="text-slate-300 text-lg font-semibold block mb-2">Registered Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="name@institution.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-lg h-14 rounded-xl focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-14 text-lg font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating verification code...
                      </>
                    ) : (
                      "Send OTP Verification Code"
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div>
                    <Label htmlFor="otp" className="text-slate-300 text-lg font-semibold block mb-2">Enter 6-Digit Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      maxLength={6}
                      required
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-2xl tracking-widest text-center h-16 rounded-xl focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={() => setOtpSent(false)} className="w-1/3 h-14 text-lg font-semibold border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl">
                      Back
                    </Button>
                    <Button type="submit" disabled={loading} className="w-2/3 h-14 text-lg font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify & Login"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Loaded Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Premium Banner */}
      <div className="relative overflow-hidden bg-slate-900 border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/80 via-slate-950/90 to-blue-950/80 z-10" />
        <img
          src={bannerImg}
          alt="Vision 2020 Conference"
          className="w-full h-48 object-cover opacity-35 object-center"
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-center px-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="bg-indigo-500/20 text-indigo-400 text-md font-bold px-3 py-1 rounded-full border border-indigo-500/30">
                Interactive Schedule Flyer
              </span>
              <h1 className="text-4xl lg:text-5xl font-black mt-2 font-Outfit tracking-tight">
                Tracks &amp; RSVP Planner
              </h1>
            </div>
            <div className="flex items-center gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 backdrop-blur-md">
              <div className="text-right">
                <p className="text-xs text-slate-400">Authenticated as</p>
                <p className="text-lg font-bold text-slate-200">{participantName}</p>
              </div>
              <Button onClick={handleLogout} variant="destructive" className="h-10 text-md font-semibold px-4 rounded-lg">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 py-10 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Track selection & filters panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Day selection — labels come from the API */}
          <div className="space-y-3">
            <Label className="text-lg font-bold text-slate-300">Select Day</Label>
            <div className="grid grid-cols-1 gap-2">
              {timetable?.days.map((day: any, idx: number) => (
                <Button
                  key={day.dayKey || day.date}
                  variant={selectedDayIdx === idx ? "default" : "outline"}
                  onClick={() => { setSelectedDayIdx(idx); setSelectedTimeSlot("all"); }}
                  className={`h-12 text-sm font-bold rounded-xl transition-all ${
                    selectedDayIdx === idx 
                      ? "bg-indigo-600 text-white hover:bg-indigo-500" 
                      : "border-slate-800 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  {day.date}
                </Button>
              )) ?? ["Day 0", "Day 1", "Day 2"].map((d, idx) => (
                <Button key={d} variant={selectedDayIdx === idx ? "default" : "outline"}
                  onClick={() => { setSelectedDayIdx(idx); setSelectedTimeSlot("all"); }}
                  className="h-12 text-sm font-bold rounded-xl border-slate-800 text-slate-300">
                  {d}
                </Button>
              ))}
            </div>
          </div>

          {/* Track Selection Buttons */}
          <div className="space-y-3">
            <Label className="text-lg font-bold text-slate-300 block">Select Track</Label>
            <div className="flex flex-col gap-2">
              {(timetable?.tracks || ["Track 1", "Track 2", "Track 3", "Track 4", "Track 5 Hall A", "Track 5 Hall B", "Poster"]).map((track: string) => {
                const isPreConf = selectedDayIdx === 0;
                const displayTitle = isPreConf ? {
                  "Track 1": "20/20 AI Workshop",
                  "Track 2": "Quality Beyond Accreditation",
                  "Track 3": "Optics & Dispensing",
                  "Track 4": "CSR & Partnerships",
                  "Track 5 Hall A": "Infection Prevention",
                }[track] || "" : track;

                if (isPreConf && !displayTitle) return null;

                return (
                  <Button
                    key={track}
                    variant={selectedTrack === track ? "default" : "outline"}
                    onClick={() => {
                      setSelectedTrack(track);
                      setSelectedTimeSlot("all");
                    }}
                    className={`h-14 justify-start text-lg font-bold px-5 rounded-xl transition-all ${
                      selectedTrack === track 
                        ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20" 
                        : "border-slate-800 text-slate-300 hover:bg-slate-900"
                    }`}
                  >
                    <Compass className="mr-3 w-5 h-5 text-slate-400" />
                    {displayTitle}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Agenda filter — time only */}
          <Card className="bg-slate-900/60 border-slate-800/80 rounded-2xl shadow-xl">
            <CardHeader className="pb-3 border-b border-slate-850">
              <CardTitle className="text-lg font-bold flex items-center text-slate-300">
                <Filter className="w-5 h-5 mr-2 text-indigo-400" />
                Filter by Time
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-400">Session Time Slot</Label>
                <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-slate-200 text-md h-12 rounded-xl">
                    <SelectValue placeholder="All times" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="all">All Times</SelectItem>
                    {timeSlotsOptions.filter((t) => t !== "all").map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions list */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-3xl font-black font-Outfit text-slate-100">
              {selectedTrack} Sessions
            </h2>
            <Badge variant="outline" className="text-md border-slate-800 text-slate-400 py-1.5 px-3 rounded-lg bg-slate-900/40">
              {filteredSessions.length} Matching
            </Badge>
          </div>

          {timetableLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
              <p className="text-slate-400 text-lg">Loading track agenda details...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
              <p className="text-slate-400 text-xl font-medium">No sessions match the selected filters.</p>
              <Button
                variant="link"
                onClick={() => {
                  setSelectedTimeSlot("all");
                }}
                className="mt-2 text-indigo-400 text-lg"
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((session, idx) => {
                // Unique key = track + sessionName + time to prevent double-matching
                const uniqueKey = `${selectedTrack}|${session.sessionName}|${session.time}`;
                const isRsvped = rsvps.some(
                  (r: any) =>
                    r.trackName === selectedTrack &&
                    r.sessionName === session.sessionName &&
                    r.sessionDate === session.date &&
                    r.sessionTime === session.time
                );
                const togglingKey = uniqueKey;
                const isToggling = rsvpToggling === togglingKey;
                const isPoster = selectedTrack === "Poster";

                return (
                  <Card key={idx} className="border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 hover:border-slate-700/80 transition-all rounded-2xl shadow-lg">
                    <CardContent className="p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="bg-indigo-950 text-indigo-400 border border-indigo-900/50 text-md font-bold px-3 py-1 rounded-lg">
                            {session.sessionName}
                          </span>
                          {session.hall && (
                            <span className="flex items-center text-slate-400 text-md font-semibold">
                              <MapPin className="w-4.5 h-4.5 mr-1 text-slate-500" />
                              {session.hall}
                            </span>
                          )}
                        </div>

                        {session.speakers.map((s, sidx) => (
                          <div key={sidx} className="space-y-1">
                            <h3 className="text-2xl font-bold text-slate-200 font-Outfit">
                              {s.title || "Untitled Presentation"}
                            </h3>
                            <div className="flex items-center gap-2 text-md text-slate-400">
                              <User className="w-4.5 h-4.5 text-slate-500" />
                              <span className="font-semibold text-slate-300">{s.name}</span>
                              <span>•</span>
                              <span>{s.role}</span>
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center gap-2 text-md text-slate-400 font-semibold pt-1">
                          <Clock className="w-4.5 h-4.5 text-indigo-400" />
                          <span>{isPoster ? "Evaluation Time: " : ""}{session.time}</span>
                        </div>
                      </div>

                      <div className="w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-slate-800 flex justify-end">
                        {isRsvped ? (
                          <div className="flex flex-col items-stretch md:items-end gap-2 w-full">
                            <span className="flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-md font-bold px-4 py-2.5 rounded-xl gap-2">
                              <CheckCheck className="w-5 h-5 text-emerald-400" />
                              Attending
                            </span>
                            <Button
                              disabled={isToggling}
                              onClick={() => handleRsvpToggle(selectedTrack, session.sessionName, session.date, session.time)}
                              variant="destructive"
                              className="h-12 text-md font-bold rounded-xl gap-2 w-full md:w-auto"
                            >
                              {isToggling ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Minus className="w-5 h-5" />
                              )}
                              Cancel RSVP
                            </Button>
                          </div>
                        ) : (
                          <Button
                            disabled={isToggling}
                            onClick={() => handleRsvpToggle(selectedTrack, session.sessionName, session.date, session.time)}
                            className="h-14 text-lg font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/10 rounded-xl gap-2 w-full md:w-auto px-6"
                          >
                            {isToggling ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Plus className="w-5 h-5" />
                            )}
                            Wish to Attend (RSVP)
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
