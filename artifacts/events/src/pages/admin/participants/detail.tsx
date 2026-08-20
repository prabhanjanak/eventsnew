import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Utensils,
  User,
  QrCode,
  Building2,
  Mail,
  Phone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Award,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { HolographicPassCard } from "@/components/3d/holographic-pass-card";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function AdminParticipantDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const { token } = useAuth();

  const { data: participant, isLoading } = useQuery<any>({
    queryKey: ["/api/participants", id],
    queryFn: async () => {
      const resp = await fetch(`${BASE_URL}/api/participants/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to load delegate details");
      return resp.json();
    },
    enabled: !!id && !!token,
  });

  const assignments = participant?.assignments || [];

  return (
    <div className="space-y-6 text-zinc-100 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#242428]/80">
        <Link href="/admin/participants">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-2xl bg-[#18181C] border-[#2A2A32] text-zinc-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Delegate Profile</h1>
          <p className="text-xs text-zinc-400">View registration details, payments, QR credentials, and session tasks</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 bg-[#18181C] rounded-3xl w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-64 bg-[#18181C] rounded-3xl md:col-span-2" />
            <Skeleton className="h-64 bg-[#18181C] rounded-3xl" />
          </div>
        </div>
      ) : participant ? (
        <div className="space-y-6">
          {/* ── PROFILE BANNER ──────────────────────────────────────────────── */}
          <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#202028] border border-[#2E2E38] flex items-center justify-center text-white shrink-0">
                <User className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">{participant.name}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#24242E] text-zinc-200 border border-[#30303C]">
                    {participant.registrationNumber}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {participant.institution || "Independent"} {participant.designation ? `• ${participant.designation}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                  participant.isPaid
                    ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/40"
                    : "bg-rose-950/70 text-rose-300 border-rose-800/40"
                }`}
              >
                {participant.isPaid ? "Payment Verified ✓" : "Payment Pending"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ── LEFT DETAILS (2 COLS) ────────────────────────────────────── */}
            <div className="md:col-span-2 space-y-6">
              {/* Contact & Registration Information */}
              <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-zinc-400" />
                  <span>Contact &amp; Account Details</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-[#0D0D10] border border-[#222228] space-y-1">
                    <span className="text-zinc-500 font-medium block">Registered Email</span>
                    <span className="font-mono text-zinc-200 font-bold block">{participant.email || "No email registered"}</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#0D0D10] border border-[#222228] space-y-1">
                    <span className="text-zinc-500 font-medium block">Mobile Phone</span>
                    <span className="font-mono text-zinc-200 font-bold block">
                      {participant.mobile ? `+91 ${participant.mobile}` : "No phone provided"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#0D0D10] border border-[#222228] space-y-1">
                    <span className="text-zinc-500 font-medium block">Institution / Hospital</span>
                    <span className="text-zinc-200 font-bold block">{participant.institution || "—"}</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#0D0D10] border border-[#222228] space-y-1">
                    <span className="text-zinc-500 font-medium block">Registration Date</span>
                    <span className="font-mono text-zinc-200 font-bold block">
                      {participant.createdAt
                        ? new Date(participant.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment & Transaction Audit */}
              <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-zinc-400" />
                  <span>Financial &amp; Transaction Audit</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-[#0D0D10] border border-[#222228] space-y-1">
                    <span className="text-zinc-500 font-medium block">Status</span>
                    <span className="text-zinc-200 font-bold block">
                      {participant.isPaid ? "Paid & Verified" : "Unpaid"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#0D0D10] border border-[#222228] space-y-1">
                    <span className="text-zinc-500 font-medium block">Fee Amount</span>
                    <span className="text-zinc-200 font-bold block">
                      {participant.paymentAmount ? `₹${participant.paymentAmount}` : "Complimentary / Free"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#0D0D10] border border-[#222228] space-y-1">
                    <span className="text-zinc-500 font-medium block">Payment ID</span>
                    <span className="font-mono text-zinc-200 font-bold block truncate" title={participant.paymentId || ""}>
                      {participant.paymentId || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Presentation & Session Roles */}
              {assignments.length > 0 && (
                <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-zinc-400" />
                    <span>Faculty &amp; Presentation Schedule</span>
                  </h3>

                  <div className="space-y-3">
                    {assignments.map((a: any) => (
                      <div key={a.id} className="p-4 rounded-2xl bg-[#0D0D10] border border-[#222228] space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#1F1F26] text-zinc-200 border border-[#2C2C38]">
                            {a.role}
                          </span>
                          <span className="font-mono text-zinc-400">{a.date} • {a.time}</span>
                        </div>
                        <div className="font-bold text-white text-sm">{a.presentationTitle || a.sessionName || "Session Duty"}</div>
                        <div className="text-zinc-400 text-[11px]">{a.track} • {a.hall || "Hall TBA"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT 3D CREDENTIAL CARD (1 COL) ────────────────────────── */}
            <div className="space-y-4">
              <div className="p-6 rounded-3xl bg-[#151518] border border-[#26262B] shadow-xl flex flex-col items-center text-center space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-zinc-400" />
                  <span>3D Digital Credential</span>
                </h3>

                <div className="w-full flex justify-center py-2">
                  <HolographicPassCard
                    participant={participant}
                    eventTitle={participant.event?.title || "Sankara Medical Trust"}
                    eventSubtitle={participant.event?.city ? `${participant.event.city} • Annual Meet` : "Delegate Badge"}
                  />
                </div>

                <p className="text-[11px] text-zinc-400">
                  Unique cryptographic pass linked to registration #{participant.registrationNumber}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-3xl bg-[#151518] border border-[#26262B] text-center text-zinc-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
          <p className="font-bold">Delegate not found.</p>
        </div>
      )}
    </div>
  );
}
