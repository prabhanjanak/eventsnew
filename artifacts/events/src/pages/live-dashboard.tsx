import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  Users, 
  Utensils, 
  Clock, 
  RefreshCw, 
  Radio,
  Search,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FoodSession = {
  id: number;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  scansCount: number;
};

type SessionStat = {
  track: string;
  sessionName: string;
  date: string;
  time: string;
  hall: string;
  capacity: number;
  rsvpCount: number;
  availableSeats: number;
};

type LiveStats = {
  totalAttendance: number;
  totalFoodScans: number;
  foodSessions: FoodSession[];
  liveTvUrl: string | null;
  sessionStats: SessionStat[];
};

export default function LiveDashboard() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<string>("");
  const [rsvpSearch, setRsvpSearch] = useState("");

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/dashboard/public-live-stats");
      if (!response.ok) throw new Error("Failed to fetch statistics");
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(formatTimeWithSeconds24h(new Date()));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const filteredSessionStats = stats?.sessionStats
    ? stats.sessionStats.filter((s) =>
        s.sessionName.toLowerCase().includes(rsvpSearch.toLowerCase()) ||
        s.hall.toLowerCase().includes(rsvpSearch.toLowerCase()) ||
        s.track.toLowerCase().includes(rsvpSearch.toLowerCase())
      )
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-[#F58220]/20 relative overflow-x-hidden">
      {/* Ambient background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#F58220]/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#6F42C1]/5 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/login">
            <img src="/headerwebfinal.png" alt="Sankara Logo" className="h-10 md:h-12 object-contain cursor-pointer" />
          </Link>
          <div className="w-px h-6 bg-slate-200 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] uppercase font-black tracking-widest text-slate-500">Live Statistics & RSVPs</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right font-mono text-sm tracking-widest text-[#F58220] font-black bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-inner">
            {currentTime}
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm" className="h-9 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs cursor-pointer shadow-sm">
              Login Portal
            </Button>
          </Link>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 p-6 md:p-8 flex flex-col lg:flex-row gap-6 relative z-10 max-w-7xl mx-auto w-full">
        {/* Left Side: Highlighted SAHAI & Real-time RSVPs */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          
          {/* SAHAI PROMINENTLY HIGHLIGHTED BANNER */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-2 border-emerald-400 rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col md:flex-row items-center gap-6 animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex-shrink-0 w-16 h-16 bg-white p-2.5 rounded-2xl shadow-md border border-emerald-100 flex items-center justify-center">
              <img src="/sahailogo.png" alt="SAHAI Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1.5">
                <h4 className="text-lg font-black text-emerald-800 tracking-tight">SAHAI Voice Feedback Portal</h4>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-extrabold text-[10px] uppercase tracking-wider animate-pulse px-2 py-0.5 rounded-md">
                  Active Feedback
                </Badge>
              </div>
              <p className="text-xs text-slate-650 font-bold leading-relaxed">
                Sankara Health through Artificial Intelligence. Speak and give your valuable feedback in 
                <span className="text-[#6F42C1] font-extrabold"> any regional or local language</span>. Visit the portal below to record!
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => window.open("https://avi-live.pradhi.ai/sefi/af2e7849-2a14-446c-b486-42065ded3945/public/forms/30413d33-0065-427f-baf6-ab93767ed8aa/submissions", "_blank")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl h-11 px-6 shadow-lg shadow-emerald-600/15 shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 mr-2" /> Give Feedback
            </Button>
          </div>

          {/* Hall Capacity & RSVP Table Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 md:p-6 shadow-md flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#F58220]" />
                  Real-time Hall Capacity & RSVP Tracker
                </h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Live reservations, seat limitations, and seat vacancy per session
                </p>
              </div>
              
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search sessions, halls..."
                  value={rsvpSearch}
                  onChange={(e) => setRsvpSearch(e.target.value)}
                  className="h-9 w-full pl-9 pr-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold placeholder:text-slate-450 focus:outline-none focus:ring-1 focus:ring-slate-300 shadow-inner"
                />
              </div>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-x-auto bg-slate-50/50">
              <table className="w-full text-left border-collapse text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-150 font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3.5">Session Date / Time</th>
                    <th className="px-4 py-3.5">Track</th>
                    <th className="px-4 py-3.5">Session Topic</th>
                    <th className="px-4 py-3.5">Hall Location</th>
                    <th className="px-4 py-3.5 text-center">Capacity</th>
                    <th className="px-4 py-3.5 text-center">RSVP</th>
                    <th className="px-4 py-3.5 text-center">Available Seats</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSessionStats.length > 0 ? (
                    filteredSessionStats.map((item, idx) => {
                      const isFull = item.availableSeats === 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors font-semibold text-slate-700">
                          <td className="px-4 py-3.5 text-slate-550">{item.date} · {item.time}</td>
                          <td className="px-4 py-3.5 font-black text-slate-900">{item.track}</td>
                          <td className="px-4 py-3.5 text-slate-800 truncate max-w-xs">{item.sessionName}</td>
                          <td className="px-4 py-3.5 text-slate-650">{item.hall}</td>
                          <td className="px-4 py-3.5 text-center text-slate-500 font-mono">{item.capacity}</td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-[#6F42C1]">{item.rsvpCount}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-lg font-mono font-bold text-[10px] border ${
                              isFull 
                                ? "bg-red-50 text-red-700 border-red-200" 
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}>
                              {isFull ? "FULL 🚫" : `${item.availableSeats} Seats`}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-bold bg-white">
                        No active sessions matching filters found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Stats and Food Scans */}
        <div className="w-full lg:w-96 shrink-0 flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-black tracking-widest text-slate-500 flex items-center gap-2 uppercase">
              <RefreshCw className={`w-4 h-4 text-[#F58220] ${loading ? "animate-spin" : ""}`} />
              Conference Stats Monitor
            </h2>
            <div className="text-[10px] text-slate-455 font-bold uppercase tracking-wider mt-1">
              Last updated {formatTimeWithSeconds24h(lastUpdated)}
            </div>
          </div>

          {/* Core Counters */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            {/* Attendance Counter */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-xl text-[#F58220]">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attendance Scans</span>
              </div>
              <div className="mt-4 font-mono text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {loading ? "..." : stats?.totalAttendance.toLocaleString()}
              </div>
            </div>

            {/* Food Scans Counter */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-600">
                  <Utensils className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Food Scans</span>
              </div>
              <div className="mt-4 font-mono text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {loading ? "..." : stats?.totalFoodScans.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Food Sessions List */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-purple-600" />
              Food Session Scan Logs
            </h3>
            
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-6 text-xs text-slate-400 font-bold">Loading food logs...</div>
              ) : stats?.foodSessions.length ? (
                stats.foodSessions.map((session) => (
                  <div key={session.id} className="space-y-1 bg-slate-50/80 border border-slate-150 p-3 rounded-xl">
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <span className="block text-xs font-black text-slate-800 truncate leading-tight">{session.name}</span>
                        <span className="block text-[9px] text-slate-500 font-bold mt-0.5">{session.date} · {session.startTime} - {session.endTime}</span>
                      </div>
                      <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-50 font-extrabold text-[10px] py-1 border border-purple-200 rounded-lg shrink-0">
                        {session.scansCount} Scans
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 font-bold">No active food sessions configured</div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 font-bold shrink-0 shadow-inner">
        Sankara Eye Foundation India · Conference Live Telemetry
      </footer>
    </div>
  );
}
