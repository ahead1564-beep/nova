import { motion } from "motion/react";
import { PREBUILT_VOICES, VoiceOption } from "../types";
import { Check, Info, Sparkles, User } from "lucide-react";

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voiceName: string) => void;
  disabled?: boolean;
}

export default function VoiceSelector({
  selectedVoice,
  onVoiceChange,
  disabled = false,
}: VoiceSelectorProps) {
  return (
    <div id="voice-selector" className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-display">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Select Nova's Voice
        </h3>
        <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest font-semibold">
          Gemini Live Voices
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {PREBUILT_VOICES.map((voice) => {
          if (voice.name === "Charon" || voice.name === "Fenrir") {
            return null;
          }

          const isSelected = voice.name === selectedVoice;
          const isPuck = voice.name === "Puck";

          return (
            <motion.button
              key={voice.name}
              type="button"
              disabled={disabled}
              onClick={() => onVoiceChange(voice.name)}
              whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
              whileTap={disabled ? {} : { scale: 0.98 }}
              className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-300 ${
                isSelected
                  ? "bg-indigo-600/10 border-indigo-500/50 shadow-[0_4px_15px_rgba(99,102,241,0.1)] text-white"
                  : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10 text-slate-400 hover:text-slate-200"
              } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {/* Highlight background glow */}
              {isSelected && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
              )}

              {!isPuck && (
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-mono text-slate-500 flex items-center gap-1 uppercase tracking-wider">
                    <User className="w-3 h-3" />
                    {voice.gender}
                  </span>
                  {isSelected && (
                    <motion.div
                      layoutId="selected-check"
                      className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </motion.div>
                  )}
                </div>
              )}

              <span className="text-sm font-semibold tracking-wide block mb-0.5">
                {voice.label}
              </span>
              
              <p className="text-[11px] leading-relaxed text-slate-400/95 font-sans font-normal line-clamp-2">
                {voice.description}
              </p>
            </motion.button>
          );
        })}
      </div>

      {disabled && (
        <p className="text-[10px] text-amber-400/80 flex items-center gap-1 mt-1 justify-center sm:justify-start">
          <Info className="w-3.5 h-3.5" />
          Disconnect session to change Nova's voice
        </p>
      )}
    </div>
  );
}
