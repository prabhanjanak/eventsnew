import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Loader2, User, KeyRound } from "lucide-react";
import bannerImg from "@assets/headerwebfinal.png";
import sankaraLogo from "/sankara-logo.png";

const MILESTONES = [
  { value: "3M+", label: "Free Eye Surgeries" },
  { value: "50", label: "Years of Social Impact" },
  { value: "1977", label: "Founded Since" },
];

export default function ForgotPassword() {
  const [mobile, setMobile] = useState("");
  const [success, setSuccess] = useState(false);
  const [visible, setVisible] = useState(false);
  
  const { toast } = useToast();
  const forgotPasswordMutation = useForgotPassword();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    forgotPasswordMutation.mutate({
      data: { mobile }
    }, {
      onSuccess: () => {
        setSuccess(true);
        toast({ title: "Reset link sent" });
      },
      onError: (err: any) => {
        toast({ 
          title: "Request failed", 
          description: err.message || "Please check your mobile number",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0d1b3e] via-[#1a2f5a] to-[#0d1b3e] relative overflow-hidden">
      {/* Decorative background circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F58220]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#6F42C1]/15 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Banner */}
      <div className="w-full bg-white border-b border-white/5 flex justify-center py-4">
        <img
          src={bannerImg}
          alt="Vision 2020 Conference Banner"
          className="max-h-20 md:max-h-24 object-contain px-4"
        />
      </div>

      {/* Info strip */}
      <div className="relative bg-gradient-to-r from-[#F58220] via-[#d4620e] to-[#6F42C1] py-2.5 px-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-4 text-white text-sm font-medium">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 opacity-90" />
            <span>10 – 12 July 2026</span>
          </div>
          <div className="w-px h-3.5 bg-white/40 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 opacity-90" />
            <span>Sankara Eye Hospital, Bangalore</span>
          </div>
          <div className="w-px h-3.5 bg-white/40 hidden sm:block" />
          <span className="opacity-90 font-semibold tracking-wide">Sankara Eye Foundation India</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center py-8 px-4">
        <div
          className={`w-full max-w-4xl transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left — branding panel */}
            <div className="text-white space-y-7 text-center lg:text-left px-2">
              <div className="flex justify-center lg:justify-start items-center gap-6">
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-white/20 blur-xl scale-110 group-hover:scale-125 transition-transform duration-500" />
                  <img
                    src={sankaraLogo}
                    alt="Sankara Eye Foundation India"
                    className="relative w-24 h-24 object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-white/20 blur-xl scale-110 group-hover:scale-125 transition-transform duration-500" />
                  <img
                    src="/sankara-50th-logo.png"
                    alt="Sankara 50 Years Logo"
                    className="relative w-24 h-24 object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>

              <div>
                <p className="text-[#F58220] font-semibold text-sm tracking-widest uppercase mb-1">Vision 2020 · India Annual Conference</p>
                <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                  Sankara Eye<br />Foundation
                </h1>
                <p className="text-white/60 mt-2 text-sm leading-relaxed">
                  Caring for sight across India — from clinical excellence to community outreach.
                </p>
              </div>

              {/* Milestones */}
              <div className="grid grid-cols-3 gap-3">
                {MILESTONES.map((m) => (
                  <div
                    key={m.value}
                    className="bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 hover:border-white/20 rounded-xl p-3 text-center transition-all duration-300 group cursor-default"
                  >
                    <div className="text-xl font-extrabold text-[#F58220] group-hover:scale-110 transition-transform duration-300 inline-block">
                      {m.value}
                    </div>
                    <div className="text-white/70 text-[10px] mt-0.5 leading-tight font-medium">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — forgot password card */}
            <div
              className="bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_8px_60px_rgba(245,130,32,0.15)]"
            >
              {/* Card top accent */}
              <div className="h-1.5 bg-gradient-to-r from-[#F58220] via-[#e88a40] to-[#6F42C1]" />

              <div className="px-8 pt-7 pb-2">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F58220] to-[#e07010] flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <KeyRound className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg leading-none">Forgot Password</h2>
                    <p className="text-white/50 text-xs mt-0.5">Recover Your Account Access</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6">
                  <div className="text-center py-4 space-y-4">
                    <p className="text-white/80 text-sm leading-relaxed">
                      If you forgot your password, please contact <strong className="text-white font-bold">prabhanjan@sankaraeye.com</strong> for assistance and password resets.
                    </p>
                    <div className="pt-4 border-t border-white/10">
                      <Link href="/login" className="text-sm text-[#a78bfa] hover:text-[#c4b5fd] font-semibold transition-colors duration-200">
                        Return to Login
                      </Link>
                    </div>
                  </div>
              </div>
            </div>
          </div>

          <p className="text-center text-white/25 text-xs mt-8">
            Vision 2020 Annual Conference 2026 · Sankara Eye Foundation India
          </p>
        </div>
      </div>
    </div>
  );
}
