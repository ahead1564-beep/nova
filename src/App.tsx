import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage, ConnectionStatus, PREBUILT_VOICES } from "./types";
import VocalOrb from "./components/VocalOrb";
import VoiceSelector from "./components/VoiceSelector";
import ChatHistory from "./components/ChatHistory";
import { 
  AudioLines, 
  Mic, 
  MicOff, 
  Play, 
  Send, 
  Square, 
  Wifi, 
  WifiOff, 
  Volume2, 
  Sparkles, 
  BookOpen, 
  Info,
  HelpCircle,
  Terminal,
  BrainCircuit,
  Compass,
  Activity
} from "lucide-react";

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [selectedVoice, setSelectedVoice] = useState<string>("Zephyr");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Web API / Media refs
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Audio Playback refs
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeAnimRef = useRef<number | null>(null);

  // Handle auto-mute or local mute state
  const isMutedRef = useRef<boolean>(false);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      disconnectSession();
      if (volumeAnimRef.current) {
        cancelAnimationFrame(volumeAnimRef.current);
      }
    };
  }, []);

  // Update volume visualization for output playback (Nova speaking)
  const startVolumeAnalysis = () => {
    const analyser = outputAnalyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const analyze = () => {
      if (isSpeaking && !isMutedRef.current) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Map average frequency density (0-255) to 0.0-1.0 scale with smooth decay
        const targetVol = Math.min(1.0, avg / 100);
        setVolume((prev) => prev * 0.4 + targetVol * 0.6); // Smooth out jitter
      }
      volumeAnimRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  // 16-bit float PCM conversion
  const floatTo16BitPCM = (floatSamples: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(floatSamples.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < floatSamples.length; i++) {
      let s = Math.max(-1, Math.min(1, floatSamples[i]));
      const intSample = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(i * 2, intSample, true); // little-endian
    }
    return buffer;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const pcm16ToFloat32 = (pcmData: Uint8Array): Float32Array => {
    const int16Array = new Int16Array(
      pcmData.buffer,
      pcmData.byteOffset,
      pcmData.byteLength / 2
    );
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
  };

  // Play output pcm chunk safely
  const playAudioChunk = (base64Audio: string) => {
    if (isMutedRef.current) return;

    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
        
        // Setup output analyser for pulsing orb
        const analyser = outputAudioCtxRef.current.createAnalyser();
        analyser.fftSize = 128;
        outputAnalyserRef.current = analyser;
        startVolumeAnalysis();
      }

      const audioCtx = outputAudioCtxRef.current;
      
      // Resume context if suspended (browser security autoplays)
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      // Convert base64 to pcm float32 samples
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const floatSamples = pcm16ToFloat32(bytes);
      if (floatSamples.length === 0) return;

      const audioBuffer = audioCtx.createBuffer(1, floatSamples.length, 24000);
      audioBuffer.getChannelData(0).set(floatSamples);

      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      // Connect source -> analyser -> destination
      if (outputAnalyserRef.current) {
        sourceNode.connect(outputAnalyserRef.current);
        outputAnalyserRef.current.connect(audioCtx.destination);
      } else {
        sourceNode.connect(audioCtx.destination);
      }

      // Track active speaking state
      setIsSpeaking(true);
      setIsThinking(false);

      sourceNode.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== sourceNode);
        if (activeSourcesRef.current.length === 0) {
          setIsSpeaking(false);
          setVolume(0);
        }
      };

      activeSourcesRef.current.push(sourceNode);

      // Precise gapless scheduling
      const currentTime = audioCtx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.05; // tiny buffer to cover network jitter
      }

      sourceNode.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;

    } catch (err) {
      console.error("Audio playback error:", err);
    }
  };

  // Stop output audio queue immediately
  const stopAllAudio = () => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {
        // Source already completed or not started
      }
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
    setVolume(0);
  };

  // Append transcription chunk from Nova
  const appendNovaMessage = (textChunk: string) => {
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.sender === "nova" && lastMsg.mode === "voice") {
        return [
          ...prev.slice(0, -1),
          { ...lastMsg, text: lastMsg.text + textChunk },
        ];
      } else {
        return [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            sender: "nova",
            text: textChunk,
            mode: "voice",
            timestamp: new Date(),
          },
        ];
      }
    });
  };

  // Append user transcription chunk from mic
  const appendUserMessage = (textChunk: string) => {
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.sender === "user" && lastMsg.mode === "voice") {
        return [
          ...prev.slice(0, -1),
          { ...lastMsg, text: lastMsg.text + textChunk, isTranscribing: false },
        ];
      } else {
        return [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            sender: "user",
            text: textChunk,
            mode: "voice",
            timestamp: new Date(),
          },
        ];
      }
    });
  };

  // Add system notifications
  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        sender: "system",
        text,
        mode: "system",
        timestamp: new Date(),
      },
    ]);
  };

  // Connect to websocket session
  const connectSession = async () => {
    if (status !== "disconnected") return;

    setStatus("connecting");
    setMessages([]);
    addSystemMessage(`Connecting to Nova using voice "${selectedVoice}"...`);

    try {
      // 1. Check microphone permissions first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // 2. Establish WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/live-ws?voice=${selectedVoice}`;
      
      console.log(`[WS] Connecting to ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected to full-stack server");
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === "status") {
            if (payload.status === "ready") {
              setStatus("connected");
              addSystemMessage("Nova is online. Start speaking now!");
              
              // Start streaming microhpone input
              startMicrophoneCapture();
            }
          } else if (payload.type === "error") {
            addSystemMessage(`Session error: ${payload.message}`);
            disconnectSession();
          } else if (payload.type === "gemini_message") {
            const message = payload.data;
            
            // Handle raw audio data
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              playAudioChunk(audioData);
            }

            // Handle Nova transcription
            const modelParts = message.serverContent?.modelTurn?.parts;
            if (modelParts) {
              for (const part of modelParts) {
                if (part.text) {
                  appendNovaMessage(part.text);
                }
              }
            }

            // Handle user transcription
            const userParts = message.serverContent?.userTurn?.parts;
            if (userParts) {
              for (const part of userParts) {
                if (part.text) {
                  appendUserMessage(part.text);
                }
              }
            }

            // Handle server content start or thinking
            if (message.serverContent?.modelTurn && !audioData) {
              setIsThinking(true);
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              console.log("[WS] Nova was interrupted by user speech input");
              stopAllAudio();
              addSystemMessage("Nova was interrupted");
            }
          }
        } catch (err) {
          console.error("Error parsing server websocket message:", err);
        }
      };

      ws.onclose = () => {
        console.log("[WS] Connection closed");
        addSystemMessage("Nova disconnected");
        disconnectSession();
      };

      ws.onerror = (err) => {
        console.error("[WS] WebSocket error:", err);
        addSystemMessage("Connection error occurred.");
        disconnectSession();
      };

    } catch (err: any) {
      console.error("Failed to connect voice session:", err);
      addSystemMessage(`Microphone access blocked or failed: ${err.message || err}`);
      setStatus("error");
      disconnectSession();
    }
  };

  // Capture user microphone input
  const startMicrophoneCapture = () => {
    if (!micStreamRef.current) return;

    try {
      inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Forces the browser to capture and downsample to 16kHz
      });

      const audioCtx = inputAudioCtxRef.current;
      const source = audioCtx.createMediaStreamSource(micStreamRef.current);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      sourceRef.current = source;
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsListening(true);

      processor.onaudioprocess = (e) => {
        // If the websocket is closed or session is not active, skip
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const channelData = e.inputBuffer.getChannelData(0);

        // Analyze user speaking amplitude for the visual orb pulsing
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        
        // If Nova is not currently speaking, animate orb with mic amplitude
        if (!isSpeaking) {
          setVolume(Math.min(1.0, rms * 4.5)); // Boost microphone visual sensitivity slightly
        }

        // Convert PCM samples from Float32 to Int16 Base64 and send to backend
        const pcmBuffer = floatTo16BitPCM(channelData);
        const base64Audio = arrayBufferToBase64(pcmBuffer);
        
        wsRef.current.send(JSON.stringify({ audio: base64Audio }));
      };

    } catch (err) {
      console.error("Failed to initialize microhpone processor:", err);
      addSystemMessage("Audio processing error. Please try again.");
    }
  };

  // Disconnect websocket session
  const disconnectSession = () => {
    stopAllAudio();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    setStatus("disconnected");
    setIsListening(false);
    setIsSpeaking(false);
    setIsThinking(false);
    setVolume(0);
  };

  const getLastNovaMessage = () => {
    const novaMsgs = messages.filter((m) => m.sender === "nova" && m.text.trim() !== "");
    if (novaMsgs.length > 0) {
      return novaMsgs[novaMsgs.length - 1].text;
    }
    return "";
  };

  const lastNovaMessage = getLastNovaMessage();

  const handleSeedTopic = (topic: string, text: string) => {
    // 1. Append user's text message to history
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        sender: "user",
        text,
        mode: "text",
        timestamp: new Date(),
      },
    ]);

    // 2. Clear any active speaking/output audio to prevent overlapping speech
    stopAllAudio();

    // 3. Send text command to Live API session if connected, otherwise notify
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsThinking(true);
      wsRef.current.send(JSON.stringify({ text }));
    } else {
      addSystemMessage("Nova is offline. Click 'Connect Session' to talk to her.");
    }
  };

  return (
    <div className="min-h-screen bg-[#08080A] text-slate-200 font-sans select-none antialiased flex flex-col overflow-hidden relative">
      {/* Voice Visualizer Ambient Background Glows */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-0">
        <div className="w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px] absolute ambient-glow-1" />
        <div className="w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[100px] absolute ambient-glow-2" />
      </div>

      {/* Header Navigation */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#08080A]/65 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.85)] animate-pulse"></div>
          <span className="text-lg font-medium tracking-widest font-display text-white">NOVA</span>
        </div>
        
        <nav className="hidden md:flex gap-8 text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold">
          <span className="text-indigo-400 cursor-pointer transition-colors hover:text-indigo-300">Conversation</span>
          <span className="hover:text-white cursor-pointer transition-colors">Memory</span>
          <span className="hover:text-white cursor-pointer transition-colors">Knowledge Base</span>
          <span className="hover:text-white cursor-pointer transition-colors">Settings</span>
        </nav>

        <div className="flex items-center gap-4">
          <div className="px-3 py-1 rounded-full border border-white/10 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-white/5">
            Gen Z Beta / Voice Active
          </div>
        </div>
      </header>

      {/* Main Interaction Area */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Left Sidebar: Interaction History & Context Seeds */}
        <aside className="w-64 border-r border-white/5 p-6 hidden xl:flex flex-col gap-6 bg-[#0C0C12]/40 backdrop-blur-sm justify-between">
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-4 font-bold font-display">Recent Context</h3>
              <ul className="space-y-4">
                <li 
                  onClick={() => handleSeedTopic("Rocket Science", "Can you explain the basic principles of rocket thrusters?")}
                  className="group cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-all duration-200"
                >
                  <p className="text-xs font-bold text-slate-300 group-hover:text-indigo-300 transition-colors">Rocket Science 101</p>
                  <p className="text-[11px] text-slate-500 italic font-serif mt-1">"Thinking about those thrusters..."</p>
                </li>
                <li 
                  onClick={() => handleSeedTopic("Ethics", "What are the core ethics surrounding experimental pharmacology?")}
                  className="group cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-all duration-200"
                >
                  <p className="text-xs font-bold text-slate-300 group-hover:text-indigo-300 transition-colors">Pharmacology Ethics</p>
                  <p className="text-[11px] text-slate-500 italic font-serif mt-1">"Checking those drug interactions."</p>
                </li>
                <li 
                  onClick={() => handleSeedTopic("Mechanics", "How do I fix a high pressure leak in a secondary mechanical pump?")}
                  className="group cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-all duration-200"
                >
                  <p className="text-xs font-bold text-slate-300 group-hover:text-indigo-300 transition-colors">Mechanical Pump Fix</p>
                  <p className="text-[11px] text-slate-500 italic font-serif mt-1">"DIY solution for the leak..."</p>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20">
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1.5 font-display">Nova's Memory</p>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                I'm remembering that you prefer deep, clear explanations with quick, conceptual summaries. Should I stick to that style?
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold font-display">System State</h4>
            <div className="flex flex-col gap-2 bg-black/20 rounded-xl p-3 border border-white/5 font-mono text-[10px] text-slate-400">
              <div className="flex justify-between">
                <span>API Status:</span>
                <span className="text-emerald-400 font-bold">Online</span>
              </div>
              <div className="flex justify-between">
                <span>Format:</span>
                <span>Int16 PCM</span>
              </div>
              <div className="flex justify-between">
                <span>Mic Stream:</span>
                <span className={isListening ? "text-emerald-400" : "text-slate-500"}>
                  {isListening ? "Streaming" : "Idle"}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Central Stage Area */}
        <section className="flex-1 flex flex-col items-center justify-between p-6 md:p-8 lg:p-12 relative overflow-y-auto">
          {/* Subtle status node at top */}
          <div className="flex justify-center w-full">
            <div className="flex items-center gap-3">
              {status === "connected" ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold text-[9px] uppercase tracking-wider">
                  <Wifi className="w-3 h-3 text-indigo-400 animate-pulse" />
                  Live Stream Active
                </span>
              ) : status === "connecting" ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[9px] uppercase tracking-wider animate-pulse">
                  <Wifi className="w-3 h-3 text-amber-400" />
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-slate-500 text-[9px] font-bold uppercase tracking-wider">
                  <WifiOff className="w-3 h-3 text-slate-600" />
                  Companion Offline
                </span>
              )}
            </div>
          </div>

          {/* Large Editorial Quotation */}
          <div className="max-w-xl text-center space-y-4 my-auto relative z-10">
            <h2 className="text-xl md:text-3xl font-serif italic text-white leading-relaxed tracking-wide">
              {lastNovaMessage ? (
                `"${lastNovaMessage}"`
              ) : (
                `"Oh, that's actually a great question. Connect our session, and we can speak directly or type your thoughts below!"`
              )}
            </h2>
            <p className="text-xs md:text-sm text-slate-400 font-sans font-light tracking-wide max-w-md mx-auto">
              {isThinking ? "Nova is formulating a response..." : isSpeaking ? "Nova is responding in real-time" : isListening ? "Listening closely to your voice..." : "Connect the voice pipeline to have a natural real-time chat with Nova."}
            </p>
          </div>

          {/* Interactive Core: Orbital Waveforms & Voice Settings */}
          <div className="w-full max-w-2xl flex flex-col items-center gap-6 mt-auto">
            {/* Main Glowing Orb */}
            <div className="w-full flex justify-center -my-4 scale-95 md:scale-100">
              <VocalOrb
                status={status}
                isListening={isListening}
                isSpeaking={isSpeaking}
                isThinking={isThinking}
                volume={volume}
              />
            </div>

            {/* Quick action buttons & settings */}
            <div className="w-full flex flex-col gap-4">
              <div className="flex gap-3 justify-center">
                {status === "disconnected" ? (
                  <button
                    type="button"
                    onClick={connectSession}
                    className="flex-1 max-w-xs cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.3)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-indigo-400/20 font-display"
                  >
                    <Play className="w-4 h-4 fill-current text-indigo-100" />
                    Connect Session
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={disconnectSession}
                    className="flex-1 max-w-xs cursor-pointer bg-white/5 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold py-3 px-6 rounded-xl active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 text-xs uppercase tracking-wider hover:bg-red-500/5 shadow-inner font-display"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-red-400" />
                    Disconnect Session
                  </button>
                )}

                {status === "connected" && (
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    title={isMuted ? "Unmute voice" : "Mute voice"}
                    className={`cursor-pointer w-12 rounded-xl flex items-center justify-center border active:scale-[0.98] transition-all duration-200 ${
                      isMuted
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10"
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Voice selectors */}
              <div className="p-4 rounded-xl border border-white/5 bg-[#0C0C12]/30 backdrop-blur-md">
                <VoiceSelector
                  selectedVoice={selectedVoice}
                  onVoiceChange={setSelectedVoice}
                  disabled={status !== "disconnected"}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Dialogue Transcripts, Reasoning trace, Knowledge tags */}
        <aside className="w-80 border-l border-white/5 p-6 flex flex-col gap-6 bg-[#0C0C12]/40 backdrop-blur-sm justify-between hidden lg:flex">
          
          {/* Custom Transcripts element */}
          <div className="flex-1 flex flex-col min-h-0">
            <ChatHistory messages={messages} />
          </div>

          {/* Reasoning Path Indicators */}
          <div className="border-t border-white/5 pt-5">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-4 font-bold font-display">Reasoning Path</h3>
            <div className="space-y-4">
              <div className={`relative pl-5 border-l transition-all duration-300 ${isListening || isThinking ? "border-indigo-500/40" : "border-white/5"}`}>
                <div className={`absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full transition-all duration-300 ${isListening || isThinking ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" : "bg-slate-700"}`} />
                <p className={`text-[11px] font-bold transition-all duration-300 ${isListening || isThinking ? "text-white" : "text-slate-500"}`}>01. Domain Mapping</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Categorizing incoming live acoustic tokens.</p>
              </div>

              <div className={`relative pl-5 border-l transition-all duration-300 ${isThinking ? "border-indigo-500/40" : "border-white/5"}`}>
                <div className={`absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full transition-all duration-300 ${isThinking ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" : "bg-slate-700"}`} />
                <p className={`text-[11px] font-bold transition-all duration-300 ${isThinking ? "text-white" : "text-slate-500"}`}>02. Variable Synthesis</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Formulating highly personalized Gen-Z dialect responses.</p>
              </div>

              <div className={`relative pl-5 transition-all duration-300`}>
                <div className={`absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full transition-all duration-300 ${isSpeaking ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" : "bg-slate-700"}`} />
                <p className={`text-[11px] font-bold transition-all duration-300 ${isSpeaking ? "text-white" : "text-slate-500"}`}>03. Vocal Output</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Streaming audio packets via low-latency Live API.</p>
              </div>
            </div>
          </div>

          {/* Knowledge Graph Tags */}
          <div className="border-t border-white/5 pt-5">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3 font-display">Knowledge Graph</h4>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-1 bg-white/5 border border-white/5 rounded text-[9px] font-bold text-indigo-300 uppercase tracking-wide">Physics</span>
              <span className="px-2 py-1 bg-white/5 border border-white/5 rounded text-[9px] font-bold text-slate-400 uppercase tracking-wide">Ethics</span>
              <span className="px-2 py-1 bg-white/5 border border-white/5 rounded text-[9px] font-bold text-slate-400 uppercase tracking-wide">Science</span>
              <span className="px-2 py-1 bg-white/5 border border-white/5 rounded text-[9px] font-bold text-indigo-300 uppercase tracking-wide">Hardware</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-white/5 bg-white/5">
            <p className="text-[10px] text-slate-300 italic mb-1.5 leading-relaxed font-serif">
              "By the way, I remember your recent topic preferences. Click any topic on the left if you'd like to seed a conversation!"
            </p>
            <p className="text-[9px] text-indigo-400 uppercase font-bold tracking-wider font-display">— Nova</p>
          </div>
        </aside>
      </main>

      {/* Bottom Status Bar */}
      <footer className="px-8 py-3 bg-[#050507] border-t border-white/5 flex justify-between items-center text-[9px] tracking-widest text-slate-500 font-bold uppercase z-20">
        <div className="flex gap-6 font-mono">
          <span>Voice: {PREBUILT_VOICES.find(v => v.name === selectedVoice)?.description.split(",")[0] || "Zephyr"}</span>
          <span className="hidden sm:inline">Latency: 24ms</span>
          <span className="hidden sm:inline">Confidence: 99.8%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]"></div>
          <span className="font-mono">Systems Nominal</span>
        </div>
      </footer>
    </div>
  );
}
