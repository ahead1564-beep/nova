export type SenderType = "user" | "nova" | "system";

export interface ChatMessage {
  id: string;
  sender: SenderType;
  text: string;
  timestamp: Date;
  mode: "voice" | "text" | "system";
  isTranscribing?: boolean;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface VoiceOption {
  name: string;
  gender: "female" | "male";
  label: string;
  description: string;
}

export const PREBUILT_VOICES: VoiceOption[] = [
  {
    name: "Zephyr",
    gender: "female",
    label: "Zephyr",
    description: "Warm, natural, and expressive female voice.",
  },
  {
    name: "Kore",
    gender: "female",
    label: "Kore",
    description: "Clear, bright, and cheerful female voice.",
  },
  {
    name: "Puck",
    gender: "male",
    label: "Puck",
    description: "Energetic, friendly, and outgoing male voice.",
  },
  {
    name: "Charon",
    gender: "male",
    label: "Charon",
    description: "Calm, deep, and reassuring male voice.",
  },
  {
    name: "Fenrir",
    gender: "male",
    label: "Fenrir",
    description: "Rich, confident, and professional male voice.",
  },
];
