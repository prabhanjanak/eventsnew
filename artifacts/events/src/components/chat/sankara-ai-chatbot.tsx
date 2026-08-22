import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  ChevronDown,
  ExternalLink,
  Calendar,
  Camera,
  Building,
  Ticket,
  Loader2,
  RefreshCw,
  MapPin,
  Check,
  CheckCircle2,
  Mail,
  Phone,
  HelpCircle,
  Clock,
  Layers,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatTime24h } from "@/lib/date-utils";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  model?: string;
}

export const SANKARA_UNITS = [
  { id: "bangalore", name: "Bengaluru (Varthur)", query: "Show complete details for Sankara Eye Hospital Bangalore unit (timings, doctors, contact, maps)" },
  { id: "coimbatore", name: "Coimbatore (HQ)", query: "Show complete details for Sankara Eye Hospital Coimbatore HQ (timings, doctors, contact, maps)" },
  { id: "coimbatore_city", name: "Coimbatore (RS Puram)", query: "Show complete details for Sankara Eye Hospital RS Puram Coimbatore (timings, doctors, contact, maps)" },
  { id: "guntur", name: "Guntur (Andhra)", query: "Show complete details for Sankara Eye Hospital Guntur unit (timings, doctors, contact, maps)" },
  { id: "jaipur", name: "Jaipur (Rajasthan)", query: "Show complete details for Sankara Eye Hospital Jaipur unit (timings, doctors, contact, maps)" },
  { id: "kanpur", name: "Kanpur (UP)", query: "Show complete details for Sankara Eye Hospital Kanpur unit (timings, doctors, contact, maps)" },
  { id: "ludhiana", name: "Ludhiana (Punjab)", query: "Show complete details for Sankara Eye Hospital Ludhiana unit (timings, doctors, contact, maps)" },
  { id: "shimoga", name: "Shivamogga (Karnataka)", query: "Show complete details for Sankara Eye Hospital Shimoga unit (timings, doctors, contact, maps)" },
  { id: "anand", name: "Anand (Gujarat)", query: "Show complete details for Sankara Eye Hospital Anand Gujarat unit (timings, doctors, contact, maps)" },
  { id: "indore", name: "Indore (MP)", query: "Show complete details for Sankara Eye Hospital Indore unit (timings, doctors, contact, maps)" },
  { id: "panvel", name: "Panvel (Navi Mumbai)", query: "Show complete details for RJ Sankara Eye Hospital Panvel unit (timings, doctors, contact, maps)" },
  { id: "hyderabad", name: "Hyderabad (Telangana)", query: "Show complete details for Sankara Eye Hospital Hyderabad unit (timings, doctors, contact, maps)" },
  { id: "varanasi", name: "Varanasi (UP)", query: "Show complete details for Sankara Eye Hospital Varanasi unit (timings, doctors, contact, maps)" },
  { id: "krishnankoil", name: "Krishnankoil (TN)", query: "Show complete details for Sankara Eye Hospital Krishnankoil unit (timings, doctors, contact, maps)" },
  { id: "patna", name: "Patna (Upcoming)", query: "Tell me about upcoming Sankara Eye Hospital Patna Bihar project" },
];

export const INQUIRY_CATEGORIES = [
  "Conference Registration & Passes",
  "CME Academic Credits & Certificates",
  "Hospital OPD & Doctor Appointments",
  "Scientific Paper / Poster Submissions",
  "Accommodation & Hospitality Support",
  "General / Other Inquiries",
];

export function SankaraAIChatbot() {
  let user: any = null;
  try {
    const auth = useAuth();
    user = auth?.user;
  } catch {
    user = null;
  }
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dedicated External Secretariat Inquiries Dialog Modal State (Rendered OUTSIDE Chatbot)
  const [isSecretariatModalOpen, setIsSecretariatModalOpen] = useState(false);
  const [secName, setSecName] = useState("");
  const [secEmail, setSecEmail] = useState("");
  const [secPhone, setSecPhone] = useState("");
  const [secUnit, setSecUnit] = useState("Bengaluru (Varthur)");
  const [secCategory, setSecCategory] = useState(INQUIRY_CATEGORIES[0]);
  const [secMessage, setSecMessage] = useState("");
  const [isSubmittingSec, setIsSubmittingSec] = useState(false);

  // Initialize session
  useEffect(() => {
    const storedSession = sessionStorage.getItem("sankara_chat_session");
    if (storedSession) {
      setSessionId(storedSession);
    } else {
      const newSession = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem("sankara_chat_session", newSession);
      setSessionId(newSession);
    }

    if (user?.name) setSecName(user.name);
    if (user?.email) setSecEmail(user.email);
    if (user?.mobile) setSecPhone(user.mobile);

    // Default welcoming message
    setMessages([
      {
        id: "welcome-1",
        sender: "bot",
        text: `Namaste! 🙏 I am **Drishti AI** (दृष्टि), the official AI assistant for Sankara Eye Foundation India.\n\nYou can ask me **anything** — whether about our **Medical Conferences & CMEs**, delegate registrations, **Hospital OPD timings & Doctors**, **Google Maps locations across all 15 units**, or general eye health.\n\n👇 **Tip**: Use the **Unit Selector** chips below to get targeted information for any specific Sankara Eye Hospital branch!`,
        timestamp: formatTime24h(new Date()),
        model: "Google Gemini 2.0 Flash",
      },
    ]);
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const handleOpenSecretariatModal = (prefilledQuery?: string) => {
    if (prefilledQuery) {
      setSecMessage(prefilledQuery);
    } else {
      const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user")?.text || "";
      if (lastUserMsg && !secMessage) {
        setSecMessage(lastUserMsg);
      }
    }
    setIsSecretariatModalOpen(true);
  };

  const handleSecretariatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secEmail.trim() || !secMessage.trim() || isSubmittingSec) return;

    setIsSubmittingSec(true);
    try {
      const res = await fetch("/api/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: secName.trim() || "Anonymous Delegate",
          userEmail: secEmail.trim(),
          userPhone: secPhone.trim(),
          unit: secUnit,
          category: secCategory,
          userMessage: secMessage.trim(),
          userIdentifier: secName.trim() || user?.name || "Anonymous Delegate",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit inquiry");

      setIsSecretariatModalOpen(false);
      const querySubmitted = secMessage;
      setSecMessage("");

      toast({
        title: "Inquiry Dispatched to Secretariat ✓",
        description: `Ticket #${data.ticketNumber} logged. An email receipt has been sent to ${secEmail}.`,
      });

      // Append bot confirmation message in chat
      const botConfirm: ChatMessage = {
        id: `bot-ticket-${Date.now()}`,
        sender: "bot",
        text: `✅ **Secretariat Support Ticket Logged: #${data.ticketNumber}**\n\n- 👤 **Delegate / Inquirer**: ${secName || "Delegate"}\n- 🏥 **Hospital / Unit**: ${secUnit}\n- 🏷️ **Category**: ${secCategory}\n- 📝 **Query**: "${querySubmitted}"\n\nYour question has been forwarded directly to our **Event Operations & Secretariat Team**. An instant email notification has been dispatched to our administrators. We will review your inquiry and email an official verified response to **${secEmail}** shortly!`,
        timestamp: formatTime24h(new Date()),
        model: "Sankara-Secretariat-Notifier",
      };

      setMessages((prev) => [...prev, botConfirm]);
    } catch (err: any) {
      toast({
        title: "Submission Error",
        description: err.message || "Could not reach secretariat.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSec(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: formatTime24h(new Date()),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const currentUrl = typeof window !== "undefined" ? window.location.href : "";
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
      const pageTitle = typeof document !== "undefined" ? document.title : "";

      let visiblePageContext = "";
      if (typeof document !== "undefined") {
        const mainContent = document.querySelector("main") || document.body;
        if (mainContent) {
          visiblePageContext = (mainContent.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 500);
        }
      }

      let activeEventSlug: string | undefined;
      const eventSlugMatch = currentPath.match(/\/events\/([a-zA-Z0-9_-]+)/);
      if (eventSlugMatch && eventSlugMatch[1] && eventSlugMatch[1] !== "register") {
        activeEventSlug = eventSlugMatch[1];
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          sessionId,
          userIdentifier: user?.name ? `${user.name} (${user.email || ""})` : "Anonymous Delegate",
          currentPath,
          currentUrl,
          pageTitle,
          visiblePageContext,
          activeEventSlug,
          history: messages.slice(-4),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to get AI response");
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.response || "Namaste! I am here to help you with Sankara events and hospital details.",
        timestamp: formatTime24h(new Date()),
        model: data.modelUsed,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "bot",
        text: `Sorry, I experienced a connection glitch. Please try again or explore our [Event Directory](/events) directly.`,
        timestamp: formatTime24h(new Date()),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Unit tick option selection handler
  const handleSelectUnit = (unit: typeof SANKARA_UNITS[0]) => {
    setSelectedUnit(unit.id);
    handleSendMessage(unit.query);
  };

  // Basic Markdown Renderer for links, bold, and linebreaks
  const renderFormattedText = (content: string) => {
    const parts = content.split(/(\[[^\]]+\]\([^)]+\))/g);

    return parts.map((part, idx) => {
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, rawHref] = linkMatch;
        const href = rawHref.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):[0-9]+/, "");
        const isExternal = href.startsWith("http");
        if (isExternal) {
          return (
            <a
              key={idx}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 break-all"
            >
              <span>{label}</span>
              <ExternalLink className="w-3 h-3 shrink-0 inline" />
            </a>
          );
        }
        return (
          <Link
            key={idx}
            href={href}
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
          >
            <span>{label}</span>
          </Link>
        );
      }

      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        const boldMatch = bPart.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return <strong key={`${idx}-${bIdx}`} className="font-bold text-white">{boldMatch[1]}</strong>;
        }
        return bPart;
      });
    });
  };

  return (
    <>
      {/* ── 1. COMPACT CIRCULAR FLOATING CHAT BUTTON (Bottom Right) ─────────── */}
      <div className="fixed bottom-5 right-5 z-50 flex items-center select-none">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Open Drishti AI"
          className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-gradient-to-tr from-[#0B0F19] via-[#1A2234] to-[#0B0F19] border-2 border-cyan-400/80 hover:border-cyan-300 text-white shadow-[0_10px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center cursor-pointer transition-all group"
        >
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden flex items-center justify-center">
            <img
              src="/sankara-eye-logo.png"
              alt="Drishti AI"
              className="w-full h-full object-contain filter drop-shadow group-hover:scale-110 transition-transform"
            />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0F19] animate-pulse" />
        </motion.button>
      </div>

      {/* ── 2. EXPANDABLE CHAT DRAWER MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[540px] h-[740px] max-h-[calc(100vh-105px)] flex flex-col rounded-3xl bg-[#121216]/98 backdrop-blur-2xl border border-[#2B2B38] shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.25)] overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#252530] bg-[#16161D] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black/80 border border-cyan-400/50 flex items-center justify-center shadow-inner">
                  <img
                    src="/sankara-eye-logo.png"
                    alt="Drishti Logo"
                    className="w-6 h-6 object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white tracking-tight flex items-center gap-1">
                      <span>Drishti AI</span>
                      <span className="text-xs text-cyan-400 font-serif font-bold">(दृष्टि)</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase font-mono">
                      Gemini 2.0
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Official 15 Hospital Branches &amp; Events Intelligence</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Ask Secretariat Button -> Opens dedicated OUTSIDE modal form */}
                <button
                  type="button"
                  onClick={() => handleOpenSecretariatModal()}
                  title="Open Secretariat Inquiries & Support Form"
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Secretariat Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `reset-${Date.now()}`,
                        sender: "bot",
                        text: "Conversation refreshed. How else can I assist you with Sankara Eye Hospital branches or conferences?",
                        timestamp: formatTime24h(new Date()),
                      },
                    ]);
                  }}
                  title="Reset conversation"
                  className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Hospital Unit Selector Toggle Header Bar */}
            <div className="px-4 py-2 bg-[#17171F] border-b border-[#23232D] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-zinc-300">Select Specific Hospital Unit:</span>
              </div>
              <button
                type="button"
                onClick={() => setShowUnitSelector(!showUnitSelector)}
                className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <span>{showUnitSelector ? "Hide Units" : "Show 15 Units"}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showUnitSelector ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Collapsible Interactive Unit Tick Option Pills */}
            <AnimatePresence>
              {showUnitSelector && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-[#14141B] border-b border-[#262633] p-3 overflow-hidden"
                >
                  <p className="text-[10px] text-zinc-400 mb-2 font-medium">
                    Click/Tick any unit below to instantly retrieve its specific doctors, OPD working hours, helpline, and Google Maps:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto scrollbar-thin">
                    {SANKARA_UNITS.map((u) => {
                      const isSelected = selectedUnit === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectUnit(u)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-cyan-500 text-zinc-950 font-black shadow-sm"
                              : "bg-[#1E1E28] hover:bg-[#282836] text-zinc-300 border border-[#2F2F3D]"
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                              isSelected ? "bg-zinc-950 text-cyan-400 font-bold" : "border border-zinc-500 text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span>{u.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 relative">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.sender === "bot" && (
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-cyan-400" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl px-4.5 py-3 text-sm sm:text-[14.5px] leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-indigo-600 text-white rounded-br-xs shadow-md font-medium"
                        : "bg-[#1A1A24] text-zinc-100 border border-[#2B2B38] rounded-bl-xs shadow-inner space-y-2"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-normal text-zinc-100 leading-relaxed">{renderFormattedText(msg.text)}</div>
                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-zinc-400 font-mono">
                      <span>{msg.timestamp}</span>
                      {msg.model && (
                        <span className="truncate max-w-[150px] text-[10px] text-zinc-500 font-medium">
                          {msg.model.split("/").pop()}
                        </span>
                      )}
                    </div>
                  </div>

                  {msg.sender === "user" && (
                    <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-600/50 flex items-center justify-center shrink-0 mt-0.5 text-indigo-300">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#1A1A24] border border-[#2B2B38] text-xs sm:text-sm text-zinc-300 flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span>Searching official Sankara database &amp; hospital network...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Suggestion Chips with Tick Selection */}
            <div className="px-3.5 py-2.5 bg-[#141419] border-t border-[#22222A] overflow-x-auto flex items-center gap-2 scrollbar-none">
              <button
                type="button"
                onClick={() => handleOpenSecretariatModal()}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold text-amber-300 transition-all cursor-pointer active:scale-95"
              >
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>📩 Open Secretariat Form</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage("Show full details for Sankara Eye Hospital Bangalore unit (timings, doctors, contact, maps)")}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1C24] hover:bg-[#282834] border border-[#2F2F3D] text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <Building className="w-3.5 h-3.5 text-cyan-400" />
                <span>Bangalore Unit</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage("Show me the locations and Google Maps links of Sankara Eye Hospitals across India.")}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1C24] hover:bg-[#282834] border border-[#2F2F3D] text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Google Maps</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage("What are the upcoming medical conferences and CMEs?")}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1C24] hover:bg-[#282834] border border-[#2F2F3D] text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Upcoming CMEs</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage("Where can I access and download event photos?")}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1C24] hover:bg-[#282834] border border-[#2F2F3D] text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Event Photos</span>
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3.5 bg-[#16161C] border-t border-[#252530] flex items-center gap-2.5"
            >
              <input
                type="text"
                placeholder="Ask about Bangalore, Coimbatore, CMEs, Doctors, OPD, Maps..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 h-11 px-4 rounded-xl bg-[#0E0E12] border border-[#2A2A36] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || isLoading}
                className="h-11 w-11 p-0 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow-md shadow-cyan-900/40 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. DEDICATED FULL-SIZE SECRETARIAT INQUIRY FORM MODAL (OUTSIDE CHATBOT) ── */}
      <Dialog open={isSecretariatModalOpen} onOpenChange={setIsSecretariatModalOpen}>
        <DialogContent className="max-w-xl w-full bg-[#111116] border border-[#2C2C38] text-white p-6 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="space-y-1.5 text-left border-b border-[#22222C] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                  <span>Contact Event Secretariat &amp; Hospital Desk</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Submit your query directly to Mr. Saravanan D &amp; the Central Secretariat team.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSecretariatSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Your Full Name</label>
                <input
                  type="text"
                  required
                  value={secName}
                  onChange={(e) => setSecName(e.target.value)}
                  placeholder="Dr. / Mr. / Ms. Full Name"
                  className="w-full h-9.5 px-3.5 rounded-xl bg-[#0B0B0E] border border-[#2B2B38] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Email Address (for official reply) *</label>
                <input
                  type="email"
                  required
                  value={secEmail}
                  onChange={(e) => setSecEmail(e.target.value)}
                  placeholder="delegate@hospital.org"
                  className="w-full h-9.5 px-3.5 rounded-xl bg-[#0B0B0E] border border-[#2B2B38] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Mobile / WhatsApp Number</label>
                <input
                  type="tel"
                  value={secPhone}
                  onChange={(e) => setSecPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full h-9.5 px-3.5 rounded-xl bg-[#0B0B0E] border border-[#2B2B38] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Specific Hospital Unit</label>
                <select
                  value={secUnit}
                  onChange={(e) => setSecUnit(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl bg-[#0B0B0E] border border-[#2B2B38] text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="All / Central Secretariat">All / Central Event Secretariat</option>
                  {SANKARA_UNITS.map((u) => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Inquiry Category</label>
              <select
                value={secCategory}
                onChange={(e) => setSecCategory(e.target.value)}
                className="w-full h-9.5 px-3 rounded-xl bg-[#0B0B0E] border border-[#2B2B38] text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {INQUIRY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Detailed Message / Question *</label>
              <textarea
                required
                rows={4}
                value={secMessage}
                onChange={(e) => setSecMessage(e.target.value)}
                placeholder="Please describe what you need assistance with (e.g. registration verification, CME credits, accommodation, specific hospital doctor consultation)..."
                className="w-full p-3 rounded-xl bg-[#0B0B0E] border border-[#2B2B38] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
              />
            </div>

            {/* Quick Contact Cards */}
            <div className="p-3 rounded-2xl bg-[#0A0A0E] border border-[#22222C] flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Helpline: <strong className="text-white">+91 89515 68286</strong></span>
              </div>
              <div>
                <span>Email: <strong className="text-white">events@sankaraeye.com</strong></span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#22222C]">
              <button
                type="button"
                onClick={() => setIsSecretariatModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={isSubmittingSec || !secEmail.trim() || !secMessage.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 px-5 gap-1.5 rounded-xl cursor-pointer shadow-lg shadow-amber-950/40"
              >
                {isSubmittingSec ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isSubmittingSec ? "Dispatching..." : "Submit Inquiry Ticket"}</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

