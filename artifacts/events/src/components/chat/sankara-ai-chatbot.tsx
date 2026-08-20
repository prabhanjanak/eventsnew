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

    // Default welcoming message
    setMessages([
      {
        id: "welcome-1",
        sender: "bot",
        text: `Namaste! 🙏 I am **Drishti AI** (दृष्टि), the AI assistant for Sankara Eye Foundation India.\n\nYou can ask me **anything** — whether about our **Conferences & CMEs**, delegate registrations, event agendas, **Hospital Google Maps locations**, **Samaro AI photo galleries**, or general eye care and medical topics.\n\nHow can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: "nvidia/llama-3.1-nemotron-70b-instruct",
      },
    ]);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

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
      // ── Capture Live Browser Screen Context ────────────────────────────────
      let visiblePageText = "";
      let activeEventSlug = "";
      try {
        const path = window.location.pathname;
        const slugMatch = path.match(/\/events\/([^/?#]+)/);
        if (slugMatch && slugMatch[1] && slugMatch[1] !== "calendar") {
          activeEventSlug = slugMatch[1];
        }

        const mainEl = document.querySelector("main") || document.body;
        const textElements = Array.from(mainEl.querySelectorAll("h1, h2, h3, h4, [data-event-title], p, .event-highlight"))
          .slice(0, 20)
          .map((el) => el.textContent?.trim())
          .filter((t) => t && t.length > 2 && !t.includes("Drishti AI"));
        visiblePageText = textElements.join(" | ").slice(0, 1500);
      } catch {}

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          sessionId,
          userIdentifier: user ? `${user.name} (${user.email || user.mobile || user.userType})` : "Anonymous Delegate",
          history: messages.slice(-6),
          currentPath: window.location.pathname,
          currentUrl: window.location.href,
          pageTitle: document.title,
          activeEventSlug,
          visiblePageContext: visiblePageText,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to reach AI assistant service");
      }

      const data = await res.json();

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.response || "I am processing your query. Please check back shortly.",
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
        const [, label, href] = linkMatch;
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
            className="inline-flex items-center gap-1 font-bold text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4.5 scrollbar-thin scrollbar-thumb-zinc-800">
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
