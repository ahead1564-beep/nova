import { motion } from "motion/react";
import { ConnectionStatus } from "../types";
import { Mic, MicOff, Sparkles, Volume2 } from "lucide-react";

interface VocalOrbProps {
  status: ConnectionStatus;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  volume: number; // 0.0 to 1.0 representing live audio amplitude
}

export default function VocalOrb({
  status,
  isListening,
  isSpeaking,
  isThinking,
  volume,
}: VocalOrbProps) {
  // Determine gradient colors based on state
  const getOrbGradient = () => {
    if (status === "disconnected") {
      return "from-slate-600 to-slate-800 shadow-[0_0_30px_rgba(71,85,105,0.4)]";
    }
    if (status === "connecting") {
      return "from-amber-400 via-indigo-500 to-cyan-500 animate-gradient-xy shadow-[0_0_40px_rgba(99,102,241,0.5)]";
    }
    if (isThinking) {
      return "from-indigo-500 via-purple-600 to-pink-500 shadow-[0_0_50px_rgba(168,85,247,0.6)]";
    }
    if (isSpeaking) {
      // Warm, vibrant voice colors
      return "from-violet-500 via-fuchsia-500 to-pink-500 shadow-[0_0_60px_rgba(236,72,153,0.7)]";
    }
    if (isListening) {
      // Calm, receptive, responsive colors
      return "from-emerald-400 via-teal-500 to-cyan-500 shadow-[0_0_60px_rgba(16,185,129,0.7)]";
    }
    // Idle/Connected
    return "from-indigo-600 via-indigo-500 to-purple-500 shadow-[0_0_30px_rgba(99,102,241,0.5)]";
  };

  // Base scale calculation with audio amplitude padding
  const baseScale = 1.0;
  const audioMultiplier = status === "connected" && (isSpeaking || isListening) ? 1 + volume * 0.75 : 1.0;

  return (
    <div id="vocal-orb-container" className="relative flex flex-col items-center justify-center w-full h-[320px]">
      {/* Glow Ring 3 (Outer most - only visible when active speaking/listening) */}
      <motion.div
        animate={{
          scale: baseScale * audioMultiplier * 1.4,
          opacity: isSpeaking || isListening ? [0.15, 0.25, 0.15] : 0.05,
        }}
        transition={{
          duration: isSpeaking || isListening ? 0.1 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-72 h-72 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-xl"
      />

      {/* Glow Ring 2 (Middle ring) */}
      <motion.div
        animate={{
          scale: baseScale * audioMultiplier * 1.2,
          opacity: isSpeaking || isListening ? [0.25, 0.45, 0.25] : [0.1, 0.18, 0.1],
        }}
        transition={{
          duration: isSpeaking || isListening ? 0.08 : 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`absolute w-56 h-56 rounded-full bg-gradient-to-r ${
          isListening
            ? "from-emerald-500/20 to-teal-500/20"
            : isSpeaking
            ? "from-fuchsia-500/20 to-pink-500/20"
            : "from-indigo-500/20 to-purple-500/20"
        } blur-lg`}
      />

      {/* Glow Ring 1 (Inner ring) */}
      <motion.div
        animate={{
          scale: baseScale * audioMultiplier * 1.05,
          rotate: status === "connecting" || isThinking ? 360 : 0,
        }}
        transition={{
          scale: { duration: 0.05 },
          rotate: { duration: 4, repeat: Infinity, ease: "linear" },
        }}
        className={`absolute w-44 h-44 rounded-full border border-dashed ${
          isListening
            ? "border-emerald-400/40"
            : isSpeaking
            ? "border-pink-400/40"
            : "border-indigo-400/40"
        }`}
      />

      {/* Main Core Orb */}
      <motion.div
        animate={{
          scale: baseScale * audioMultiplier,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 15,
        }}
        className={`relative z-10 w-36 h-36 rounded-full bg-gradient-to-tr ${getOrbGradient()} flex items-center justify-center cursor-pointer overflow-hidden`}
      >
        {/* Subtle glass overlay texture */}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] rounded-full mix-blend-overlay" />

        {/* Dynamic inner waves (using CSS animations/motion) */}
        {(isSpeaking || isListening || isThinking) && (
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.15, 1],
            }}
            transition={{
              rotate: { duration: 8, repeat: Infinity, ease: "linear" },
              scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute inset-2 rounded-full bg-gradient-to-bl from-white/10 via-transparent to-black/15 mix-blend-screen"
          />
        )}

        {/* Status Indicator Icon inside Orb */}
        <div className="relative z-20 flex flex-col items-center justify-center text-white">
          {status === "disconnected" && (
            <MicOff className="w-8 h-8 text-slate-300 drop-shadow-md" />
          )}
          {status === "connecting" && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            >
              <Sparkles className="w-8 h-8 text-white drop-shadow-md" />
            </motion.div>
          )}
          {status === "connected" && (
            <>
              {isThinking && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Sparkles className="w-8 h-8 text-indigo-100 drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]" />
                </motion.div>
              )}
              {isSpeaking && (
                <motion.div
                  animate={{ y: [0, -3, 3, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <Volume2 className="w-9 h-9 text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]" />
                </motion.div>
              )}
              {isListening && !isThinking && !isSpeaking && (
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <Mic className="w-9 h-9 text-white drop-shadow-[0_2px_10px_rgba(16,185,129,0.5)]" />
                </motion.div>
              )}
              {!isListening && !isThinking && !isSpeaking && (
                <Mic className="w-8 h-8 text-indigo-100 opacity-90 drop-shadow-md" />
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Mini status badge text beneath the orb */}
      <div className="mt-8 text-center">
        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/40 border border-white/10 text-slate-300 gap-2.5 backdrop-blur-md shadow-inner">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "connected"
                ? isListening
                  ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : isSpeaking
                  ? "bg-fuchsia-400 animate-pulse shadow-[0_0_8px_rgba(232,121,249,0.8)]"
                  : isThinking
                  ? "bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]"
                  : "bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]"
                : status === "connecting"
                ? "bg-amber-400 animate-pulse"
                : "bg-slate-600"
            }`}
          />
          {status === "disconnected" && "Nova is offline"}
          {status === "connecting" && "Initializing Nova..."}
          {status === "connected" && (
            <>
              {isThinking && "Nova is thinking"}
              {isSpeaking && "Nova is speaking"}
              {isListening && !isThinking && !isSpeaking && "Nova is listening"}
              {!isListening && !isThinking && !isSpeaking && "Nova is ready"}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
