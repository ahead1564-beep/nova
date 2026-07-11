import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage } from "../types";
import { AudioLines, MessageSquare, Monitor, Sparkles, User } from "lucide-react";

interface ChatHistoryProps {
  messages: ChatMessage[];
}

export default function ChatHistory({ messages }: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat history
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div
      id="chat-history-container"
      className="flex-1 w-full bg-[#0C0C12]/50 border border-white/5 rounded-2xl flex flex-col h-[380px] overflow-hidden backdrop-blur-md"
    >
      {/* Thread Header */}
      <div className="px-5 py-3.5 border-b border-white/5 bg-black/40 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 font-display">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          Captions & Live Transcript
        </span>
        <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5 font-semibold">
          {messages.length} MSG{messages.length !== 1 ? "S" : ""}
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-indigo-400/80 animate-pulse" />
              </div>
              <h4 className="text-sm font-semibold text-slate-300 font-display uppercase tracking-wide">Nova is silent</h4>
              <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                Connect the live session to talk, or type a text query fallback.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender === "user";
              const isSystem = msg.sender === "system";

              if (isSystem) {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-center"
                  >
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-slate-400 font-mono flex items-center gap-1.5 shadow-sm">
                      <Monitor className="w-3 h-3 text-indigo-400" />
                      {msg.text}
                    </span>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex gap-2.5 max-w-[85%] sm:max-w-[75%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar circle */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border shadow-sm ${
                        isUser
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    </div>

                    {/* Chat Bubble Container */}
                    <div className="flex flex-col gap-1">
                      {/* Name + Mode indicator */}
                      <div className={`flex items-center gap-1.5 px-1 text-[10px] font-bold tracking-wide uppercase ${isUser ? "justify-end text-emerald-400/90" : "text-indigo-400/90"}`}>
                        <span>{isUser ? "You" : "Nova"}</span>
                        <span className="text-[9px] text-slate-500 font-mono flex items-center gap-0.5 normal-case font-normal">
                          {msg.mode === "voice" ? (
                            <AudioLines className="w-2.5 h-2.5 text-indigo-400/70" />
                          ) : (
                            <MessageSquare className="w-2.5 h-2.5 text-emerald-400/70" />
                          )}
                          {msg.mode}
                        </span>
                      </div>

                      {/* Content Bubble */}
                      <div
                        className={`p-3.5 rounded-2xl relative shadow-md ${
                          isUser
                            ? "bg-white/5 border border-white/5 text-slate-200 rounded-tr-none"
                            : "bg-white/5 border border-white/5 text-slate-200 rounded-tl-none"
                        }`}
                      >
                        {msg.isTranscribing ? (
                          <div className="flex items-center gap-1.5 py-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed font-sans font-normal whitespace-pre-wrap select-text">
                            {msg.text}
                          </p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <span className={`text-[9px] text-slate-600 px-1 font-mono ${isUser ? "text-right" : "text-left"}`}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
