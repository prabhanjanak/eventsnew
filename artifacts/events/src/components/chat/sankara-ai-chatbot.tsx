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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  model?: string;
}

const QUICK_PROMPTS = [
  { label: "Ask Secretariat", text: "How can I contact the Event Secretariat?", icon: Sparkles },
  { label: "Hospital Maps", text: "Show me the locations and Google Maps links of Sankara Eye Hospitals across India.", icon: MapPin },
  { label: "Upcoming CMEs", text: "What are the upcoming medical conferences and CMEs?", icon: Calendar },
  { label: "Event Photos", text: "Where can I access and download event photos?", icon: Camera },
  { label: "Sankara Network", text: "Tell me about Sankara Eye Foundation hospitals and impact across India.", icon: Building },
  { label: "My Passes", text: "How do I access my registered admission pass and QR code?", icon: Ticket },
];

export function SankaraAIChatbot() {
  let user: any = null;
  try {
    const auth = useAuth();
    user = auth?.user;
  } catch {
    user = null;
  }
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Human Escalation state
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [escalateEmail, setEscalateEmail] = useState("");
  const [escalatePhone, setEscalatePhone] = useState("");
  const [escalateMessage, setEscalateMessage] = useState("");
  const [isEscalating, setIsEscalating] = useState(false);

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

    if (user?.email) {
      setEscalateEmail(user.email);
    }
    if (user?.mobile) {
      setEscalatePhone(user.mobile);
    }

    // Default welcoming message
    setMessages([
      {
        id: "welcome-1",
        sender: "bot",
        text: `Namaste! 🙏 I am **Drishti AI** (दृष्टि), the AI assistant for Sankara Eye Foundation India.\n\nYou can ask me **anything** — whether about our **Conferences & CMEs**, delegate registrations, event agendas, **Hospital Google Maps locations**, event photo galleries, or general eye care and medical topics.\n\nHow can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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

  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateEmail.trim() || !escalateMessage.trim() || isEscalating) return;

    setIsEscalating(true);
    try {
      const res = await fetch("/api/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: escalateEmail.trim(),
          userPhone: escalatePhone.trim(),
          userMessage: escalateMessage.trim(),
          userIdentifier: user?.name || "Anonymous Delegate",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit escalation");

      setIsEscalateOpen(false);
      setEscalateMessage("");

      // Append bot confirmation message
      const botConfirm: ChatMessage = {
        id: `bot-ticket-${Date.now()}`,
        sender: "bot",
        text: `✅ **Support Ticket Logged: #${data.ticketNumber}**\n\nYour question has been escalated to our **Event Operations & Secretariat Team**. An instant email notification has been dispatched to our administrators. We will review your inquiry and email an official verified response to **${escalateEmail}** shortly!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: "Sankara-Secretariat-Notifier",
      };

      setMessages((prev) => [...prev, botConfirm]);
    } catch (err: any) {
      alert(`Could not log ticket: ${err.message}`);
    } finally {
      setIsEscalating(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Collect live browser screen context
      const currentUrl = typeof window !== "undefined" ? window.location.href : "";
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
      const pageTitle = typeof document !== "undefined" ? document.title : "";

      // Extract high-level text context from active view
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

      // Check if current page is an event page
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
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: data.modelUsed,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "bot",
        text: `Sorry, I experienced a connection glitch. Please try again or explore our [Event Directory](/events) directly.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Basic Markdown Renderer for links, bold, and linebreaks
  const renderFormattedText = (content: string) => {
    // Convert markdown links [text](url) to clickable anchors
    const parts = content.split(/(\[[^\]]+\]\([^)]+\))/g);

    return parts.map((part, idx) => {
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, rawHref] = linkMatch;
        // Clean out any raw internal network IPs
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

      // Convert bold **text**
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
      {/* ── 1. FLOATING CHAT BUTTON (Bottom Right) ─────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center select-none">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="group relative flex items-center gap-3 px-6 py-4 rounded-full bg-gradient-to-r from-[#14141A] via-[#1E1E28] to-[#14141A] border border-cyan-500/50 hover:border-cyan-400 text-white shadow-[0_12px_40px_rgba(0,0,0,0.9),0_0_30px_rgba(6,182,212,0.35)] transition-all cursor-pointer"
        >
          {/* Glowing Aura Ring */}
          <div className="w-9 h-9 rounded-full bg-black/70 border border-cyan-400/60 flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.7)]">
            <img
              src="/sankara-eye-logo.png"
              alt="Drishti AI"
              className="w-5.5 h-5.5 object-contain filter drop-shadow"
            />
          </div>

          <div className="flex flex-col text-left">
            <span className="text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>Drishti AI</span>
              <span className="text-sm text-cyan-400 font-serif font-bold">दृष्टि</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
            <span className="text-xs text-zinc-300 font-semibold">Sankara Intelligence</span>
          </div>

          <div className="pl-1 text-cyan-400 group-hover:rotate-12 transition-transform">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
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
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[520px] h-[720px] max-h-[calc(100vh-100px)] flex flex-col rounded-3xl bg-[#121216]/98 backdrop-blur-2xl border border-[#2B2B38] shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.25)] overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4.5 border-b border-[#252530] bg-[#16161D] flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-black/80 border border-cyan-400/50 flex items-center justify-center shadow-inner">
                  <img
                    src="/sankara-eye-logo.png"
                    alt="Drishti Logo"
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                      <span>Drishti AI</span>
                      <span className="text-sm text-cyan-400 font-serif font-bold">(दृष्टि)</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase font-mono">
                      Google Gemini 2.0
                    </span>
                  </div>
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium pt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Vision &amp; Event Intelligence • Grounded DB</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user")?.text || "";
                    setEscalateMessage(lastUserMsg);
                    setIsEscalateOpen(true);
                  }}
                  title="Request Secretariat Callback / Email Reply"
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ask Secretariat</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `reset-${Date.now()}`,
                        sender: "bot",
                        text: "Conversation refreshed. How else can I assist you with Sankara events?",
                        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      },
                    ]);
                  }}
                  title="Reset conversation"
                  className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4.5 h-4.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5.5 h-5.5" />
                </button>
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4.5 scrollbar-thin scrollbar-thumb-zinc-800 relative">
              {/* Escalation Overlay Form */}
              <AnimatePresence>
                {isEscalateOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute inset-x-3 top-3 z-30 p-4 rounded-2xl bg-[#16161E] border border-amber-500/40 shadow-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                          <Sparkles className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-white">Escalate to Event Secretariat</h4>
                          <p className="text-[11px] text-zinc-400">Our administrators will review your inquiry and email you directly.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEscalateOpen(false)}
                        className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleEscalateSubmit} className="space-y-2.5 pt-1">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-300 block mb-1">Your Email Address (Required):</label>
                        <input
                          type="email"
                          required
                          value={escalateEmail}
                          onChange={(e) => setEscalateEmail(e.target.value)}
                          placeholder="doctor@hospital.org"
                          className="w-full h-8.5 px-3 rounded-lg bg-[#0E0E12] border border-[#2B2B38] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-300 block mb-1">Phone Number (Optional):</label>
                        <input
                          type="tel"
                          value={escalatePhone}
                          onChange={(e) => setEscalatePhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full h-8.5 px-3 rounded-lg bg-[#0E0E12] border border-[#2B2B38] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-300 block mb-1">Question / Inquiry Details:</label>
                        <textarea
                          required
                          rows={2}
                          value={escalateMessage}
                          onChange={(e) => setEscalateMessage(e.target.value)}
                          placeholder="What would you like our secretariat to assist with?"
                          className="w-full p-2.5 rounded-lg bg-[#0E0E12] border border-[#2B2B38] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEscalateOpen(false)}
                          className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <Button
                          type="submit"
                          disabled={isEscalating || !escalateEmail.trim() || !escalateMessage.trim()}
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-8 px-4 gap-1.5"
                        >
                          <Send className="w-3 h-3" />
                          <span>{isEscalating ? "Sending Alert..." : "Notify Secretariat via Email"}</span>
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.sender === "bot" && (
                    <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-5 h-5 text-cyan-400" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl px-5 py-3.5 text-base sm:text-[16.5px] leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-indigo-600 text-white rounded-br-xs shadow-md font-medium"
                        : "bg-[#1A1A24] text-zinc-100 border border-[#2B2B38] rounded-bl-xs shadow-inner space-y-2.5"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-normal text-zinc-100">{renderFormattedText(msg.text)}</div>
                    <div className="flex items-center justify-between gap-2 pt-1 text-xs text-zinc-400 font-mono">
                      <span>{msg.timestamp}</span>
                      {msg.model && (
                        <span className="truncate max-w-[150px] text-[11px] text-zinc-500 font-medium">
                          {msg.model.split("/").pop()}
                        </span>
                      )}
                    </div>
                  </div>

                  {msg.sender === "user" && (
                    <div className="w-9 h-9 rounded-full bg-indigo-950 border border-indigo-600/50 flex items-center justify-center shrink-0 mt-0.5 text-indigo-300">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3.5 justify-start">
                  <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="p-4 rounded-2xl bg-[#1A1A24] border border-[#2B2B38] text-base text-zinc-300 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    <span>Thinking &amp; analyzing database...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="px-4 py-3 bg-[#141419] border-t border-[#22222A] overflow-x-auto flex items-center gap-2.5 scrollbar-none">
              {QUICK_PROMPTS.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(p.text)}
                    disabled={isLoading}
                    className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1C1C24] hover:bg-[#282834] border border-[#2F2F3D] text-sm font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer active:scale-95"
                  >
                    <Icon className="w-4 h-4 text-cyan-400" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-4 bg-[#16161C] border-t border-[#252530] flex items-center gap-3"
            >
              <input
                type="text"
                placeholder="Ask Drishti anything (Events, CMEs, Agendas, Eye Care, Maps)..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 h-13 px-4.5 rounded-2xl bg-[#0E0E12] border border-[#2A2A36] text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || isLoading}
                className="h-13 w-13 p-0 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow-lg shadow-cyan-900/40 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

