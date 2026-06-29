import React, { useState, useEffect, useRef } from "react";
import { User, ChatMessage, LiveStreamStatus, TalarBozorgParticipant } from "../types";
import { 
  ArrowLeft, Monitor, Play, Square, Tv, Users, Send, MessageCircle, 
  Settings, Volume2, VolumeX, Eye, Radio, Sparkles, RefreshCw, AlertCircle, Maximize2,
  Mic, MicOff, Video, VideoOff, PhoneOff, ScreenShare, PlusCircle, UserCheck, ShieldAlert, Copy, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MangaStreamProps {
  currentUser: User;
  onBack: () => void;
}

export default function MangaStream({ currentUser, onBack }: MangaStreamProps) {
  // Hall selection state: 'none', 'bozorg' (Discord voice), 'koochak'/'koochak2' (YouTube-like stream)
  const [selectedHall, setSelectedHall] = useState<'none' | 'bozorg' | 'koochak' | 'koochak2'>('none');

  const koochakMediaRecorderRef = useRef<any>(null);
  const playedKoochakAudioChunksRef = useRef<Set<string>>(new Set());
  const joinedKoochakTimeRef = useRef<number>(0);

  // --- TALAR KOOCHAK (YOUTUBE) STATE ---
  const [streamStatus, setStreamStatus] = useState<LiveStreamStatus & { quality?: string }>({
    isLive: false,
    streamer: "",
    title: "",
    streamType: "webcam",
  });
  const [koochakChat, setKoochakChat] = useState<ChatMessage[]>([]);
  const [koochakInput, setKoochakInput] = useState<string>("");
  const [koochakLoading, setKoochakLoading] = useState<boolean>(true);
  
  // Custom video streaming controls
  const [streamQuality, setStreamQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const streamQualityRef = useRef(streamQuality);
  useEffect(() => {
    streamQualityRef.current = streamQuality;
  }, [streamQuality]);

  const handleQualityChange = async (quality: 'low' | 'medium' | 'high') => {
    setStreamQuality(quality);
    if (isLocalSharing) {
      try {
        await fetch(selectedHall === 'koochak2' ? "/api/livestream2" : "/api/livestream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isLive: true,
            streamer: currentUser.username,
            title: streamTitleInput.trim() || (streamSource === "webcam" ? `پخش زنده وب‌کم ${currentUser.username}` : `پخش زنده صفحه نمایش ${currentUser.username}`),
            streamType: streamSource,
            quality: quality
          })
        });
      } catch (err) {
        console.warn("Could not update livestream quality on server:", err);
      }
    }
  };

  const [isLocalSharing, setIsLocalSharing] = useState<boolean>(false);
  const [streamTitleInput, setStreamTitleInput] = useState<string>("");
  const [streamSource, setStreamSource] = useState<'screen' | 'webcam'>('screen');
  const [localStreamObject, setLocalStreamObject] = useState<MediaStream | null>(null);
  const [localWebcamStreamObject, setLocalWebcamStreamObject] = useState<MediaStream | null>(null);
  const [localScreenStreamObject, setLocalScreenStreamObject] = useState<MediaStream | null>(null);
  const [showGoLiveModal, setShowGoLiveModal] = useState<boolean>(false);
  const [koochakError, setKoochakError] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Viewer frame loading & stats
  const [latestFrameSrc, setLatestFrameSrc] = useState<string | null>(null);
  const [fpsCounter, setFpsCounter] = useState<number>(0);
  const [viewerLatency, setViewerLatency] = useState<number>(0);

  // Media references
  const koochakVideoRef = useRef<HTMLVideoElement>(null);
  const koochakMediaStreamRef = useRef<MediaStream | null>(null);
  const koochakChatEndRef = useRef<HTMLDivElement>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const viewerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  // --- TALAR BOZORG (DISCORD) STATE ---
  const [bozorgParticipants, setBozorgParticipants] = useState<TalarBozorgParticipant[]>([]);
  const [bozorgMic, setBozorgMic] = useState<boolean>(true);
  const [bozorgWebcam, setBozorgWebcam] = useState<boolean>(false);
  const [bozorgScreen, setBozorgScreen] = useState<boolean>(false);
  
  const bozorgMicRef = useRef(bozorgMic);
  const bozorgWebcamRef = useRef(bozorgWebcam);
  const bozorgScreenRef = useRef(bozorgScreen);
  const bozorgUploadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    bozorgMicRef.current = bozorgMic;
  }, [bozorgMic]);

  useEffect(() => {
    bozorgWebcamRef.current = bozorgWebcam;
  }, [bozorgWebcam]);

  useEffect(() => {
    bozorgScreenRef.current = bozorgScreen;
  }, [bozorgScreen]);

  useEffect(() => {
    const applyBozorgConstraints = async () => {
      let videoConstraints: any = {};
      if (streamQuality === 'high') {
        videoConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } };
      } else if (streamQuality === 'low') {
        videoConstraints = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } };
      } else {
        videoConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
      }
      
      if (localWebcamStreamRef.current) {
        const track = localWebcamStreamRef.current.getVideoTracks()[0];
        if (track && typeof track.applyConstraints === 'function') {
          try {
            await track.applyConstraints(videoConstraints);
          } catch (e) {
            console.warn("Failed to apply dynamic constraints to webcam:", e);
          }
        }
      }
      if (localScreenStreamRef.current) {
        const track = localScreenStreamRef.current.getVideoTracks()[0];
        if (track && typeof track.applyConstraints === 'function') {
          try {
            await track.applyConstraints(videoConstraints);
          } catch (e) {
            console.warn("Failed to apply dynamic constraints to screen share:", e);
          }
        }
      }
    };
    applyBozorgConstraints();
  }, [streamQuality]);

  // --- TALAR BOZORG FRAME UPLOAD LOOP ---
  useEffect(() => {
    if (selectedHall !== 'bozorg') {
      if (bozorgUploadIntervalRef.current) {
        clearTimeout(bozorgUploadIntervalRef.current);
        bozorgUploadIntervalRef.current = null;
      }
      return;
    }

    if (!bozorgWebcam && !bozorgScreen) {
      if (bozorgUploadIntervalRef.current) {
        clearTimeout(bozorgUploadIntervalRef.current);
        bozorgUploadIntervalRef.current = null;
      }
      return;
    }

    // Clean up existing interval if any
    if (bozorgUploadIntervalRef.current) {
      clearTimeout(bozorgUploadIntervalRef.current);
    }

    const uploadBozorgFrames = async () => {
      // Create offscreen canvas for resizing and compression
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const currentQuality = streamQualityRef.current;
      let targetWidth = 480;
      let targetHeight = 360;
      let jpegQuality = 0.5;

      if (currentQuality === "high") {
        targetWidth = 800;
        targetHeight = 600;
        jpegQuality = 0.65;
      } else if (currentQuality === "low") {
        targetWidth = 320;
        targetHeight = 240;
        jpegQuality = 0.35;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      let webcamFrame: string | null = null;
      let screenFrame: string | null = null;

      // 1. Capture webcam frame if active
      if (bozorgWebcam && localWebcamVideoRef.current && localWebcamStreamObject) {
        const video = localWebcamVideoRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          
          const srcRatio = video.videoWidth / video.videoHeight;
          const targetRatio = targetWidth / targetHeight;
          let drawWidth = targetWidth;
          let drawHeight = targetHeight;
          let drawX = 0;
          let drawY = 0;

          if (srcRatio > targetRatio) {
            drawHeight = targetWidth / srcRatio;
            drawY = (targetHeight - drawHeight) / 2;
          } else {
            drawWidth = targetHeight * srcRatio;
            drawX = (targetWidth - drawWidth) / 2;
          }

          ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
          webcamFrame = canvas.toDataURL("image/jpeg", jpegQuality);
        }
      }

      // 2. Capture screen share frame if active
      if (bozorgScreen && localScreenVideoRef.current && localScreenStreamObject) {
        const video = localScreenVideoRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          
          const srcRatio = video.videoWidth / video.videoHeight;
          const targetRatio = targetWidth / targetHeight;
          let drawWidth = targetWidth;
          let drawHeight = targetHeight;
          let drawX = 0;
          let drawY = 0;

          if (srcRatio > targetRatio) {
            drawHeight = targetWidth / srcRatio;
            drawY = (targetHeight - drawHeight) / 2;
          } else {
            drawWidth = targetHeight * srcRatio;
            drawX = (targetWidth - drawWidth) / 2;
          }

          ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
          screenFrame = canvas.toDataURL("image/jpeg", jpegQuality);
        }
      }

      // 3. Upload frames to server
      if (webcamFrame !== null || screenFrame !== null) {
        try {
          await fetch("/api/talar-bozorg/upload-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: currentUser.username,
              webcamFrame,
              screenFrame
            })
          });
        } catch (e) {
          console.warn("Bozorg frame upload failed:", e);
        }
      }
    };

    // Run every intervalMs dynamically
    const runLoop = () => {
      uploadBozorgFrames().finally(() => {
        const currentQuality = streamQualityRef.current;
        let intervalMs = 500;
        if (currentQuality === "high") intervalMs = 300;
        else if (currentQuality === "low") intervalMs = 800;

        if (selectedHall === 'bozorg' && (bozorgWebcam || bozorgScreen)) {
          bozorgUploadIntervalRef.current = setTimeout(runLoop, intervalMs) as any;
        }
      });
    };

    bozorgUploadIntervalRef.current = setTimeout(runLoop, 500) as any;

    return () => {
      if (bozorgUploadIntervalRef.current) {
        clearTimeout(bozorgUploadIntervalRef.current);
        bozorgUploadIntervalRef.current = null;
      }
    };
  }, [selectedHall, bozorgWebcam, bozorgScreen, localWebcamStreamObject, localScreenStreamObject]);

  const [bozorgError, setBozorgError] = useState<string>("");
  
  // Real voice amplitude monitoring
  const [localVoiceVolume, setLocalVoiceVolume] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const joinedBozorgTimeRef = useRef<number>(0);
  const playedAudioChunksRef = useRef<Set<string>>(new Set());

  const localWebcamVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenVideoRef = useRef<HTMLVideoElement>(null);
  const localWebcamStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);

  // --- MAIN TALAR POLLERS & LOGIC ---

  // Talar Koochak (YouTube style) loading & polling
  const loadKoochakData = async () => {
    try {
      const streamRes = await fetch(selectedHall === 'koochak2' ? "/api/livestream2" : "/api/livestream");
      if (streamRes.ok) {
        const status = await streamRes.json();
        setStreamStatus(status);
      }
      
      const chatRes = await fetch(selectedHall === 'koochak2' ? "/api/chat?type=stream2" : "/api/chat?type=stream");
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setKoochakChat(chatData.chat || []);
      }
    } catch (err) {
      console.warn("Could not load stream status (offline or server starting):", err);
    } finally {
      setKoochakLoading(false);
    }
  };

  // View frame from server
  const fetchLatestFrame = async () => {
    if (isLocalSharing) return; // Streamer doesn't need to fetch their own frame
    const start = Date.now();
    try {
      const res = await fetch(selectedHall === 'koochak2' ? "/api/stream2/frame" : "/api/stream/frame");
      if (res.ok) {
        const data = await res.json();
        if (data.frame) {
          setLatestFrameSrc(data.frame);
          setViewerLatency(Date.now() - start);
        }
        
        // Play audio chunks for Koochak/Koochak2
        if (data.audioChunks && data.audioChunks.length > 0) {
          data.audioChunks.forEach((chunk: any) => {
            if (chunk.timestamp > joinedKoochakTimeRef.current - 1500 && !playedKoochakAudioChunksRef.current.has(chunk.id)) {
              playedKoochakAudioChunksRef.current.add(chunk.id);
              
              const audio = new Audio(chunk.data);
              audio.play().catch(e => {
                console.warn(`Could not play koochak audio chunk:`, e);
              });
            }
          });
        }
      } else {
        // No frame available or stream stopped
        setLatestFrameSrc(null);
      }
    } catch (err) {
      setLatestFrameSrc(null);
    }
  };

  // Talar Bozorg (Discord Stage) loading & polling
  const loadBozorgParticipants = async () => {
    try {
      const res = await fetch("/api/talar-bozorg/participants");
      if (res.ok) {
        const data = await res.json();
        const participants = data.participants || [];
        setBozorgParticipants(participants);

        // Non-P2P audio chunk playing engine
        participants.forEach((part: any) => {
          if (part.username !== currentUser.username && part.audioChunks && part.audioChunks.length > 0) {
            part.audioChunks.forEach((chunk: any) => {
              // Ensure we only play fresh chunks that were uploaded after we joined, and which haven't been played yet
              if (chunk.timestamp > joinedBozorgTimeRef.current - 1500 && !playedAudioChunksRef.current.has(chunk.id)) {
                playedAudioChunksRef.current.add(chunk.id);
                
                const audio = new Audio(chunk.data);
                audio.play().catch(e => {
                  console.warn(`Could not play voice chunk from ${part.username}:`, e);
                });
              }
            });
          }
        });
      }
    } catch (err) {
      console.warn("Could not load voice participants:", err);
    }
  };

  const joinBozorg = async () => {
    try {
      joinedBozorgTimeRef.current = Date.now();
      playedAudioChunksRef.current.clear();
      await fetch("/api/talar-bozorg/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          micActive: bozorgMic,
          webcamActive: bozorgWebcam,
          screenActive: bozorgScreen
        })
      });
      loadBozorgParticipants();
    } catch (err) {
      console.error(err);
    }
  };

  const leaveBozorg = async () => {
    try {
      await fetch("/api/talar-bozorg/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser.username })
      });
      stopBozorgMedia();
    } catch (err) {
      console.error(err);
    }
  };

  const updateBozorgStatusOnBackend = async (mic: boolean, cam: boolean, scr: boolean) => {
    try {
      await fetch("/api/talar-bozorg/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          micActive: mic,
          webcamActive: cam,
          screenActive: scr
        })
      });
      loadBozorgParticipants();
    } catch (err) {
      console.error(err);
    }
  };

  // Clean up Talar Bozorg audio & media tracks
  const stopBozorgMedia = () => {
    if (bozorgUploadIntervalRef.current) {
      clearTimeout(bozorgUploadIntervalRef.current);
      bozorgUploadIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
      mediaRecorderRef.current = null;
    }
    playedAudioChunksRef.current.clear();
    if (localWebcamStreamRef.current) {
      localWebcamStreamRef.current.getTracks().forEach(t => t.stop());
      localWebcamStreamRef.current = null;
    }
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach(t => t.stop());
      localScreenStreamRef.current = null;
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setBozorgWebcam(false);
    setBozorgScreen(false);
    setLocalWebcamStreamObject(null);
    setLocalScreenStreamObject(null);
    setLocalVoiceVolume(0);

    // Clear frames on server so they do not linger for other users
    fetch("/api/talar-bozorg/upload-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: currentUser.username,
        webcamFrame: null,
        screenFrame: null
      })
    }).catch((e) => console.warn("Failed to clear server-side frames:", e));
  };

  // Manage room switching
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let bozorgPollInterval: NodeJS.Timeout;
    
    if (selectedHall === 'koochak' || selectedHall === 'koochak2') {
      // Initialize small hall audio chunk tracking
      playedKoochakAudioChunksRef.current.clear();
      joinedKoochakTimeRef.current = Date.now();

      loadKoochakData();
      interval = setInterval(loadKoochakData, 3000);
      
      // Viewer polling for frames - optimized for 2-core / 2GB RAM environment to reduce thread blocking
      viewerIntervalRef.current = setInterval(fetchLatestFrame, 450);
    } else if (selectedHall === 'bozorg') {
      joinBozorg();
      
      // Throttled participant and voice sync polling to optimize server load
      bozorgPollInterval = setInterval(loadBozorgParticipants, 500);

      // Slower status heartbeat (3000ms)
      interval = setInterval(() => {
        updateBozorgStatusOnBackend(bozorgMicRef.current, bozorgWebcamRef.current, bozorgScreenRef.current);
      }, 3000);
      
      // Start microphone feedback
      startLocalAudioMonitoring();
    }

    return () => {
      if (interval) clearInterval(interval);
      if (bozorgPollInterval) clearInterval(bozorgPollInterval);
      if (viewerIntervalRef.current) clearInterval(viewerIntervalRef.current);
      if (selectedHall === 'bozorg') {
        leaveBozorg();
      }
    };
  }, [selectedHall]);

  // Clean up all streams and recording intervals on unmount
  useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) clearTimeout(uploadIntervalRef.current);
      if (viewerIntervalRef.current) clearInterval(viewerIntervalRef.current);
      stopBozorgMedia();
      if (koochakMediaStreamRef.current) {
        koochakMediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (koochakMediaRecorderRef.current) {
        try {
          koochakMediaRecorderRef.current.stop();
        } catch (e) {}
        koochakMediaRecorderRef.current = null;
      }
    };
  }, []);

  // Scroll chat
  useEffect(() => {
    koochakChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [koochakChat, selectedHall]);


  // --- REAL MIC VOLUME MONITORING (Web Audio API) WITH NOISE SUPPRESSION & DSP FILTERING ---
  const startLocalAudioMonitoring = async () => {
    try {
      if (audioContextRef.current) return;
      
      // Request microphone with native noise reduction, echo cancellation, and auto gain control
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true
        }
      }).catch(() => null);

      if (!stream) {
        console.warn("Microphone access denied or unavailable.");
        return;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      
      // 1. Highpass filter to eliminate low-frequency room noise, fan hums, and low-end background rumble
      const highpass = audioCtx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 150; // Cut off frequencies below 150Hz
      
      // 2. Dynamics Compressor to act as a noise gate/reduction and level-normalizer
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -45; // Suppress signals lower than -45dB (acts as noise gate)
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      
      // Build routing chain: Mic -> Highpass -> Compressor -> Analyser
      source.connect(highpass);
      highpass.connect(compressor);
      compressor.connect(analyser);

      // Create destination for fully filtered audio recording (P2P-free server-side audio)
      const destination = audioCtx.createMediaStreamDestination();
      compressor.connect(destination);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = audioCtx;
      audioAnalyserRef.current = analyser;

      audioIntervalRef.current = setInterval(() => {
        if (!bozorgMic) {
          setLocalVoiceVolume(0);
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        
        // Software-level noise gate: if volume level is below threshold, ignore as noise
        let volume = Math.min(100, Math.round(avg * 1.8));
        if (volume < 8) {
          volume = 0;
        }
        setLocalVoiceVolume(volume);
      }, 100);

      // Initialize MediaRecorder on the filtered audio destination stream
      let options = {};
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options = { mimeType: "audio/webm;codecs=opus" };
        } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          options = { mimeType: "audio/ogg;codecs=opus" };
        }
        
        try {
          const recorder = new MediaRecorder(destination.stream, options);
          recorder.ondataavailable = async (event) => {
            // Respect user mute status and verify valid data chunk
            if (!bozorgMicRef.current || !event.data || event.data.size === 0) return;

            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Data = reader.result as string;
              if (!base64Data) return;

              try {
                await fetch("/api/talar-bozorg/upload-audio", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: currentUser.username,
                    chunk: {
                      id: `${currentUser.username}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                      data: base64Data,
                      timestamp: Date.now()
                    }
                  })
                });
              } catch (err) {
                console.warn("Audio chunk upload failed:", err);
              }
            };
            reader.readAsDataURL(event.data);
          };

          // Record and upload in 750ms slices for optimal non-P2P audio performance
          recorder.start(750);
          mediaRecorderRef.current = recorder;
        } catch (recorderErr) {
          console.warn("Failed to start MediaRecorder on filtered audio stream:", recorderErr);
        }
      }

    } catch (e) {
      console.error("Error initializing audio context with noise reduction:", e);
    }
  };


  // --- TALAR KOOCHAK (YOUTUBE STREAM) ENGINE ---

  const startKoochakStream = async () => {
    setKoochakError("");
    const titleToUse = streamTitleInput.trim() || 
      (streamSource === "webcam" 
        ? `پخش زنده وب‌کم ${currentUser.username}` 
        : `پخش زنده صفحه نمایش ${currentUser.username}`);
    
    try {
      let stream: MediaStream;
      if (streamSource === "webcam") {
        // Capture Webcam with optimized HD capabilities and default fallbacks
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              width: { ideal: 1280, max: 1920 }, 
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 60 }
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (e) {
          console.warn("Retrying with fallback simpler constraints due to:", e);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch (e2) {
            console.warn("Retrying video-only fallback due to:", e2);
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }
      } else {
        // Capture Desktop screen
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: 30, max: 60 }
            },
            audio: true
          });
        } catch (e) {
          console.warn("Retrying with fallback simpler display constraints due to:", e);
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          } catch (e2) {
            throw e2;
          }
        }
      }
      
      koochakMediaStreamRef.current = stream;
      setLocalStreamObject(stream);

      // Handle user stopping screen share from browser overlay
      stream.getVideoTracks()[0].onended = () => {
        stopKoochakStream();
      };

      setIsLocalSharing(true);
      setShowGoLiveModal(false);

      // Register live stream on server
      await fetch(selectedHall === 'koochak2' ? "/api/livestream2" : "/api/livestream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isLive: true,
          streamer: currentUser.username,
          title: titleToUse,
          streamType: streamSource,
          streamUrl: "",
          quality: streamQuality
        })
      });

      // Send a system chat message to announce stream
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "system",
          username: "سیستم",
          text: `📢 ${currentUser.username} پخش زنده جدیدی را در ${
            selectedHall === 'koochak2' ? 'تالار کوچک ۲' : 'تالار کوچک ۱'
          } با کیفیت ${
            streamQuality === 'high' ? 'بالا (1080p)' : streamQuality === 'low' ? 'کاهش‌یافته (360p)' : 'متوسط (720p)'
          } با عنوان «${titleToUse}» آغاز کرد!`,
          type: selectedHall === 'koochak2' ? "stream2" : "stream"
        })
      });

      // Set up audio recording/uploading for livestream audio transmission
      if (stream.getAudioTracks().length > 0) {
        const audioOnlyStream = new MediaStream(stream.getAudioTracks());
        let options = {};
        if (typeof MediaRecorder !== "undefined") {
          if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            options = { mimeType: "audio/webm;codecs=opus" };
          } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
            options = { mimeType: "audio/ogg;codecs=opus" };
          }
          try {
            const recorder = new MediaRecorder(audioOnlyStream, options);
            recorder.ondataavailable = async (event) => {
              if (!event.data || event.data.size === 0) return;
              const reader = new FileReader();
              reader.onloadend = async () => {
                const base64Data = reader.result as string;
                if (!base64Data) return;
                try {
                  await fetch(selectedHall === 'koochak2' ? "/api/stream2/upload-audio" : "/api/stream/upload-audio", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      username: currentUser.username,
                      chunk: {
                        id: `${currentUser.username}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                        data: base64Data,
                        timestamp: Date.now()
                      }
                    })
                  });
                } catch (err) {
                  console.warn("Failed uploading audio chunk for koochak stream:", err);
                }
              };
              reader.readAsDataURL(event.data);
            };
            recorder.start(750); // Slice every 750ms for low latency
            koochakMediaRecorderRef.current = recorder;
          } catch (recErr) {
            console.warn("Could not start MediaRecorder for koochak audio:", recErr);
          }
        }
      }

      // Setup hidden canvas and frame capture loop
      const canvas = document.createElement("canvas");
      canvasRef.current = canvas;
      
      const videoElement = document.createElement("video");
      videoElement.srcObject = stream;
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.setAttribute("autoplay", "true");
      videoElement.setAttribute("playsinline", "true");
      
      // Hidden video element style hack so browsers never freeze/suspend background frame decoding
      videoElement.style.position = "fixed";
      videoElement.style.top = "0";
      videoElement.style.left = "0";
      videoElement.style.width = "400px"; // Larger than 1px to prevent browser-engine layout suspension
      videoElement.style.height = "300px";
      videoElement.style.opacity = "0.001";
      videoElement.style.pointerEvents = "none";
      videoElement.style.zIndex = "-9999";
      document.body.appendChild(videoElement);
      hiddenVideoRef.current = videoElement;
      
      videoElement.play().catch(e => console.warn("videoElement.play() failed/interrupted:", e));
 
      // Using willReadFrequently optimizes frequent readbacks (like calling toDataURL) in 2D canvas context
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
 
      let framesUploaded = 0;
      let lastFpsCheck = Date.now();
 
      const uploadFrame = async () => {
        // Stop if stream is closed or cleared
        if (!koochakMediaStreamRef.current) return;
 
        const activeSource = koochakVideoRef.current || videoElement;
        if (!ctx || !activeSource) {
          uploadIntervalRef.current = setTimeout(uploadFrame, 100) as any;
          return;
        }
 
        // Skip drawing if media is not fully loaded/ready (prevents black screen artifacts)
        if (activeSource.readyState < 2 || activeSource.videoWidth === 0) {
          uploadIntervalRef.current = setTimeout(uploadFrame, 100) as any;
          return;
        }
 
        if (activeSource.paused) {
          activeSource.play().catch(() => {});
        }
 
        // Configure resolution and delay dynamically based on live quality state
        const currentQuality = streamQualityRef.current;
        let targetWidth = 480;
        let targetHeight = 360;
        let jpegQuality = 0.5;
        let uploadIntervalMs = 400; // default medium (~2.5 FPS)
 
        if (currentQuality === "high") {
          targetWidth = 800;
          targetHeight = 600;
          jpegQuality = 0.65;
          uploadIntervalMs = 250; // ~4 FPS
        } else if (currentQuality === "low") {
          targetWidth = 320;
          targetHeight = 240;
          jpegQuality = 0.35;
          uploadIntervalMs = 650; // ~1.5 FPS
        }
 
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        }
 
        try {
          const videoWidth = activeSource.videoWidth;
          const videoHeight = activeSource.videoHeight;
 
          if (videoWidth > 0 && videoHeight > 0) {
            // Fill background with black to avoid canvas leftovers
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
 
            // Compute correct aspect ratio (fit style drawing)
            const srcRatio = videoWidth / videoHeight;
            const targetRatio = targetWidth / targetHeight;
 
            let drawWidth = targetWidth;
            let drawHeight = targetHeight;
            let drawX = 0;
            let drawY = 0;
 
            if (srcRatio > targetRatio) {
              drawHeight = targetWidth / srcRatio;
              drawY = (targetHeight - drawHeight) / 2;
            } else {
              drawWidth = targetHeight * srcRatio;
              drawX = (targetWidth - drawWidth) / 2;
            }
 
            ctx.drawImage(activeSource, drawX, drawY, drawWidth, drawHeight);
          } else {
            ctx.drawImage(activeSource, 0, 0, targetWidth, targetHeight);
          }
          
          // Compress as JPEG string
          const base64Frame = canvas.toDataURL("image/jpeg", jpegQuality);
 
          // Upload to server
          await fetch(selectedHall === 'koochak2' ? "/api/stream2/upload-frame" : "/api/stream/upload-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              frame: base64Frame,
              username: currentUser.username
            })
          });
          framesUploaded++;
          
          const now = Date.now();
          if (now - lastFpsCheck >= 1000) {
            setFpsCounter(framesUploaded);
            framesUploaded = 0;
            lastFpsCheck = now;
          }
        } catch (e) {
          console.warn("Frame upload failed:", e);
        }

        // Schedule the next frame only after this frame has finished (safeguard against overlapping connections)
        if (koochakMediaStreamRef.current) {
          uploadIntervalRef.current = setTimeout(uploadFrame, uploadIntervalMs) as any;
        }
      };

      // Start the dynamic sequential loop
      uploadIntervalRef.current = setTimeout(uploadFrame, 200) as any;

      loadKoochakData();

    } catch (err: any) {
      console.warn("Capture screen/webcam failed gracefully caught:", err);
      let friendlyError = "خطای ناشناخته در دسترسی به رسانه.";
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        if (streamSource === "screen") {
          friendlyError = "اجازه دسترسی به صفحه نمایش صادر نشد. به دلیل قوانین امنیتی شدید مرورگرها در بستر iframe (مثلاً در محیط توسعه AI Studio)، لطفاً حتماً روی دکمه باز کردن در تب جدید (کوچک بالا سمت راست) کلیک کنید تا برنامه در یک تب مستقل باز شود، سپس به راحتی استریم صفحه نمایش را شروع کنید.";
        } else {
          friendlyError = "مجوز دسترسی به دوربین یا میکروفون توسط کاربر یا سیستم‌عامل رد شده است. لطفاً آیکون قفل کنار آدرس‌بار مرورگر را باز کرده و مجوز دوربین/میکروفون را برای این سایت به Allow تغییر دهید.";
        }
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        friendlyError = streamSource === "screen" 
          ? "منبع معتبری برای اشتراک‌گذاری صفحه نمایش یافت نشد."
          : "هیچ دوربین، وب‌کم یا میکروفون فعالی روی سیستم شما پیدا نشد. لطفاً سخت‌افزار خود را بررسی کنید.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        friendlyError = "دوربین، وب‌کم یا میکروفون شما توسط برنامه دیگری (مانند تلگرام، دیسکورد یا زوم) قفل شده است. لطفاً آن برنامه‌ها را ببندید و مجدداً تلاش کنید.";
      } else if (err.name === "SecurityError") {
        friendlyError = "مرورگر به دلایل امنیتی دسترسی به صفحه نمایش درون یک فریم داخلی (iframe) را مسدود کرده است. حتماً روی دکمه باز کردن در تب جدید کلیک کنید و استریم را در تب مستقل آغاز نمایید.";
      } else {
        friendlyError = `خطا در دریافت جریان رسانه: ${err.message || err.name || "خطای ناشناخته"}`;
      }
      
      setKoochakError(friendlyError);
    }
  };

  const stopKoochakStream = async () => {
    if (uploadIntervalRef.current) {
      clearTimeout(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }
    if (koochakMediaStreamRef.current) {
      koochakMediaStreamRef.current.getTracks().forEach(t => t.stop());
      koochakMediaStreamRef.current = null;
    }
    if (koochakMediaRecorderRef.current) {
      try {
        koochakMediaRecorderRef.current.stop();
      } catch (e) {}
      koochakMediaRecorderRef.current = null;
    }
    setLocalStreamObject(null);
    if (koochakVideoRef.current) {
      koochakVideoRef.current.srcObject = null;
    }
    if (hiddenVideoRef.current) {
      if (hiddenVideoRef.current.parentNode) {
        hiddenVideoRef.current.parentNode.removeChild(hiddenVideoRef.current);
      }
      hiddenVideoRef.current = null;
    }
    setIsLocalSharing(false);
    setFpsCounter(0);

    try {
      await fetch(selectedHall === 'koochak2' ? "/api/livestream2" : "/api/livestream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLive: false })
      });

      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "system",
          username: "سیستم",
          text: `🛑 پخش زنده ${currentUser.username} به پایان رسید.`,
          type: selectedHall === 'koochak2' ? "stream2" : "stream"
        })
      });
      loadKoochakData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendKoochakChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!koochakInput.trim()) return;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          text: koochakInput.trim(),
          type: selectedHall === 'koochak2' ? "stream2" : "stream"
        })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setKoochakChat(prev => [...prev, newMsg]);
        setKoochakInput("");
      }
    } catch (err) {
      console.error(err);
    }
  };


  // --- TALAR BOZORG (DISCORD) ACTIONS ---

  const handleToggleBozorgMic = () => {
    const nextVal = !bozorgMic;
    setBozorgMic(nextVal);
    updateBozorgStatusOnBackend(nextVal, bozorgWebcam, bozorgScreen);
  };

  const handleToggleBozorgWebcam = async () => {
    if (bozorgWebcam) {
      if (localWebcamStreamRef.current) {
        localWebcamStreamRef.current.getTracks().forEach(t => t.stop());
        localWebcamStreamRef.current = null;
      }
      setLocalWebcamStreamObject(null);
      setBozorgWebcam(false);
      updateBozorgStatusOnBackend(bozorgMic, false, bozorgScreen);
    } else {
      try {
        setBozorgError("");
        
        // Define quality constraints
        let videoConstraints: any = { video: true, audio: false };
        if (streamQuality === "high") {
          videoConstraints = {
            video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
            audio: false
          };
        } else if (streamQuality === "low") {
          videoConstraints = {
            video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } },
            audio: false
          };
        } else {
          videoConstraints = {
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            audio: false
          };
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        } catch (e) {
          console.warn("Retrying with simple video constraints fallback:", e);
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        localWebcamStreamRef.current = stream;
        setLocalWebcamStreamObject(stream);
        setBozorgWebcam(true);
        updateBozorgStatusOnBackend(bozorgMic, true, bozorgScreen);
      } catch (err: any) {
        console.error(err);
        let friendlyError = "امکان دسترسی به وب‌کم وجود ندارد.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          friendlyError = "مجوز دسترسی به دوربین (وب‌کم) داده نشد. لطفاً از طریق آیکون قفل کنار آدرس‌بار مرورگر، دسترسی دوربین را فعال کنید.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          friendlyError = "سخت‌افزار دوربین یا وب‌کم روی سیستم شما یافت نشد.";
        } else if (err.name === "NotReadableError") {
          friendlyError = "وب‌کم شما هم‌اکنون توسط نرم‌افزار دیگری در حال استفاده است.";
        }
        setBozorgError(friendlyError);
      }
    }
  };

  const handleToggleBozorgScreen = async () => {
    if (bozorgScreen) {
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach(t => t.stop());
        localScreenStreamRef.current = null;
      }
      setLocalScreenStreamObject(null);
      setBozorgScreen(false);
      updateBozorgStatusOnBackend(bozorgMic, bozorgWebcam, false);
    } else {
      try {
        setBozorgError("");

        // Define quality constraints
        let screenConstraints: any = { video: true, audio: false };
        if (streamQuality === "high") {
          screenConstraints = {
            video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
            audio: false
          };
        } else if (streamQuality === "low") {
          screenConstraints = {
            video: { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
            audio: false
          };
        } else {
          screenConstraints = {
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            audio: false
          };
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia(screenConstraints);
        } catch (e) {
          console.warn("Retrying with simple display constraints fallback due to:", e);
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        }
        localScreenStreamRef.current = stream;
        setLocalScreenStreamObject(stream);
        setBozorgScreen(true);
        updateBozorgStatusOnBackend(bozorgMic, bozorgWebcam, true);

        stream.getVideoTracks()[0].onended = () => {
          setLocalScreenStreamObject(null);
          setBozorgScreen(false);
          updateBozorgStatusOnBackend(bozorgMic, bozorgWebcam, false);
        };
      } catch (err: any) {
        console.error(err);
        let friendlyError = "خطا در اشتراک‌گذاری صفحه دسکتاپ.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          friendlyError = "اشتراک‌گذاری صفحه نمایش لغو شد یا مجوز امنیتی آن رد شد. به دلیل محدودیت‌های امنیتی مرورگر درون iframe، لطفا برای اشتراک‌گذاری صفحه نمایش دسکتاپ، برنامه را در یک «تب جدید» (New Tab) باز کنید.";
        } else if (err.name === "SecurityError") {
          friendlyError = "مرورگر به دلایل امنیتی دسترسی به صفحه نمایش درون iframe را مسدود کرده است. برنامه را در تب جدید باز کنید.";
        }
        setBozorgError(friendlyError);
      }
    }
  };

  const handleLeaveBozorg = async () => {
    await leaveBozorg();
    setSelectedHall('none');
  };

  const getInitials = (name: string) => {
    return name ? name.substring(0, 2).toUpperCase() : "کاربر";
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // --- RENDERING VIEWS ---

  return (
    <div className="min-h-screen bg-black text-[#f3f4f6] font-sans flex flex-col h-[calc(100vh-32px)] overflow-hidden select-none">
      
      {/* Dynamic Navigation Header */}
      <div className="bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-900/60 sticky top-0 z-40 px-4 py-3 md:px-8 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={selectedHall !== 'none' ? () => setSelectedHall('none') : onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-zinc-900/40 border border-zinc-850 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{selectedHall !== 'none' ? "بازگشت به انتخاب تالار" : "بازگشت به هاب اصلی"}</span>
          </button>

          <div className="flex items-center gap-2">
            {selectedHall === 'bozorg' ? (
              <span className="text-xs bg-purple-950 text-purple-400 border border-purple-900/40 font-mono px-2 py-0.5 rounded font-bold uppercase">DISCORD STAGE</span>
            ) : selectedHall === 'koochak' || selectedHall === 'koochak2' ? (
              <span className="text-xs bg-rose-950 text-rose-400 border border-rose-900/40 font-mono px-2 py-0.5 rounded font-bold uppercase">SERVER RELAY LIVE</span>
            ) : (
              <span className="text-xs bg-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded border border-zinc-700/50 font-bold uppercase">TALAR ROOM</span>
            )}
            <h1 className="text-base md:text-lg font-black text-white tracking-tight flex items-center gap-1">
              {selectedHall === 'bozorg' ? (
                <>تالار <span className="text-purple-400">بزرگ (دیسکوردی)</span></>
              ) : selectedHall === 'koochak' ? (
                <>تالار <span className="text-red-400">کوچک ۱ (یوتیوبی)</span></>
              ) : selectedHall === 'koochak2' ? (
                <>تالار <span className="text-red-400">کوچک ۲ (یوتیوبی)</span></>
              ) : (
                <>تالار <span className="text-amber-500">نمایش</span></>
              )}
            </h1>
          </div>
        </div>
      </div>

      {/* VIEW: HALL CHOOSE MENU */}
      {selectedHall === 'none' && (
        <div className="flex-1 overflow-y-auto flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-b from-zinc-950 to-black">
          <div className="max-w-4xl w-full text-center space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-white">به تالار نمایش خوش آمدید</h2>
              <p className="text-xs md:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
                نوع تالار خود را انتخاب کنید. بدون نیاز به برنامه‌های جانبی (مانند OBS)، همه‌چیز مستقیم از طریق مرورگر شما روی سرور آپلود و پخش می‌شود:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              
              {/* Talar Bozorg Card */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className="bg-gradient-to-br from-zinc-950 to-purple-950/20 border border-purple-900/30 rounded-3xl p-6 text-right flex flex-col justify-between space-y-6 relative overflow-hidden group shadow-xl"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 rounded-full blur-2xl group-hover:bg-purple-600/20 transition-all duration-500"></div>

                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-950/50 border border-purple-800/40 flex items-center justify-center text-purple-400 shadow-inner">
                    <Users className="w-6 h-6 animate-pulse" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-extrabold text-white flex items-center justify-end gap-2">
                      <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-md border border-purple-800/30">اتصال صوتی همگانی</span>
                      <span>تالار بزرگ (دیسکوردی)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      یک فضای چندرسانه‌ای گروهی مانند دیسکورد. در این تالار هر کاربری که وارد شود می‌تواند میکروفون خود را باز کند، صدای خود را پخش کند و وب‌کم یا صفحه نمایش خود را به اشتراک بگذارد.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-1.5 pt-1">
                    <span className="text-[10px] bg-zinc-900 border border-purple-950/40 text-purple-300 px-2 py-1 rounded-lg">صوت آزاد همگانی</span>
                    <span className="text-[10px] bg-zinc-900 border border-purple-950/40 text-purple-300 px-2 py-1 rounded-lg">دوربین همزمان چندنفره</span>
                    <span className="text-[10px] bg-zinc-900 border border-purple-950/40 text-purple-300 px-2 py-1 rounded-lg">داده موقت (عدم ذخیره‌سازی)</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedHall('bozorg')}
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-purple-950/50"
                >
                  ورود به تالار بزرگ دیسکوردی
                </button>
              </motion.div>

              {/* Talar Koochak Card */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className="bg-gradient-to-br from-zinc-950 to-rose-950/20 border border-rose-900/30 rounded-3xl p-6 text-right flex flex-col justify-between space-y-6 relative overflow-hidden group shadow-xl"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-600/10 rounded-full blur-2xl group-hover:bg-rose-600/20 transition-all duration-500"></div>

                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-950/50 border border-rose-800/40 flex items-center justify-center text-rose-400 shadow-inner">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-extrabold text-white flex items-center justify-end gap-2">
                      <span className="text-xs bg-rose-900/40 text-rose-300 px-2 py-0.5 rounded-md border border-rose-800/30">آپلود سرور و پخش همزمان</span>
                      <span>تالار کوچک ۱ (یوتیوبی)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      لایو استریم سنتی مانند یوتیوب با سیستم صوتی همگام‌سازی شده. یک نفر پخش صفحه یا وب‌کم و صدای خود را با کیفیت دلخواه آغاز کرده و سرور آن را بین تماشاگران پخش می‌کند.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-1.5 pt-1">
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">تنظیم کیفیت (360p, 720p, 1080p)</span>
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">همگام‌سازی صوتی پیشرفته</span>
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">انتقال بدون P2P (رله کامل سروری)</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedHall('koochak')}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-rose-950/50"
                >
                  ورود به تالار کوچک ۱ استریمی
                </button>
              </motion.div>

              {/* Talar Koochak 2 Card */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className="bg-gradient-to-br from-zinc-950 to-rose-950/20 border border-rose-900/30 rounded-3xl p-6 text-right flex flex-col justify-between space-y-6 relative overflow-hidden group shadow-xl"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-600/10 rounded-full blur-2xl group-hover:bg-rose-600/20 transition-all duration-500"></div>

                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-950/50 border border-rose-800/40 flex items-center justify-center text-rose-400 shadow-inner">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-extrabold text-white flex items-center justify-end gap-2">
                      <span className="text-xs bg-rose-900/40 text-rose-300 px-2 py-0.5 rounded-md border border-rose-800/30">اتاق دوم پخش همزمان</span>
                      <span>تالار کوچک ۲ (یوتیوبی)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      دومین اتاق مستقل پخش سنتی با سیستم صوتی همگام‌سازی شده. مناسب برای پخش موازی دیگر یا زمانی که تالار کوچک اول در حال استفاده و شلوغ است.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-1.5 pt-1">
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">تنظیم کیفیت (360p, 720p, 1080p)</span>
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">کانال مستقل صوتی سروری</span>
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">انتقال بدون P2P (رله کامل سروری)</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedHall('koochak2')}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-rose-950/50"
                >
                  ورود به تالار کوچک ۲ استریمی
                </button>
              </motion.div>

            </div>
          </div>
        </div>
      )}


      {/* VIEW: TALAR BOZORG (DISCORD) */}
      {selectedHall === 'bozorg' && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#07050a]">
          
          {/* Main voice cells grid */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
            
            {bozorgError && (
              <div className="bg-rose-950/30 border border-rose-900/50 p-3 rounded-xl text-xs text-rose-400 text-right flex items-center justify-end gap-2 shrink-0">
                <span>{bozorgError}</span>
                <AlertCircle className="w-4 h-4 shrink-0" />
              </div>
            )}

            {/* Grid of real users */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[300px]">
              
              {/* ME - Voice Stage Card */}
              <div className={`relative rounded-2xl overflow-hidden bg-zinc-950 border transition-all duration-300 p-4 flex flex-col items-center justify-center min-h-[160px] shadow-lg ${
                localVoiceVolume > 15 ? "border-emerald-500 shadow-emerald-950/20" : "border-zinc-900"
              }`}>
                
                {/* Real Webcam Feedback */}
                {bozorgWebcam ? (
                  <video
                    ref={(el) => {
                      (localWebcamVideoRef as any).current = el;
                      if (el && localWebcamStreamObject && el.srcObject !== localWebcamStreamObject) {
                        el.srcObject = localWebcamStreamObject;
                        el.play().catch(e => console.warn("webcam playback failed:", e));
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  />
                ) : null}

                {/* Speaker indicator animations */}
                <div className="relative z-10 flex flex-col items-center space-y-3">
                  {!bozorgWebcam && (
                    <div className="relative">
                      {localVoiceVolume > 15 && (
                        <div 
                          className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"
                          style={{ transform: `scale(${1.2 + localVoiceVolume / 100})` }}
                        ></div>
                      )}
                      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-500/40 flex items-center justify-center text-white text-lg font-bold shadow-lg">
                        {getInitials(currentUser.username)}
                      </div>
                    </div>
                  )}

                  <div className="text-center bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <div className="text-xs font-black text-white flex items-center justify-center gap-1.5">
                      <span className="bg-purple-900/60 text-purple-300 text-[8px] px-1.5 py-0.5 rounded border border-purple-800/40">شما</span>
                      <span>{currentUser.username}</span>
                    </div>
                    {localVoiceVolume > 15 && (
                      <span className="text-[9px] text-emerald-400 mt-0.5 block font-mono">Volume: {localVoiceVolume}%</span>
                    )}
                  </div>
                </div>

                {/* Top corner media states */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1 z-20">
                  <span className={`p-1.5 rounded-lg ${bozorgMic ? "bg-emerald-950/80 text-emerald-400" : "bg-zinc-900/80 text-zinc-500"} text-[9px]`}>
                    {bozorgMic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-zinc-600" />}
                  </span>
                  <span className={`p-1.5 rounded-lg ${bozorgWebcam ? "bg-indigo-950/80 text-indigo-400" : "bg-zinc-900/80 text-zinc-500"} text-[9px]`}>
                    {bozorgWebcam ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5 text-zinc-600" />}
                  </span>
                </div>

                {/* Active user state tag */}
                <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-zinc-900/80 z-20">
                  <span className="text-[9px] text-zinc-300 font-mono">
                    {bozorgWebcam ? "Webcam Active" : bozorgMic ? "Speaking..." : "Muted"}
                  </span>
                </div>
              </div>

              {/* ME - Screen sharing output card */}
              {bozorgScreen && (
                <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-amber-600/30 p-2 flex flex-col items-center justify-center min-h-[160px] shadow-lg sm:col-span-2">
                  <video
                    ref={(el) => {
                      (localScreenVideoRef as any).current = el;
                      if (el && localScreenStreamObject && el.srcObject !== localScreenStreamObject) {
                        el.srcObject = localScreenStreamObject;
                        el.play().catch(e => console.warn("screen share playback failed:", e));
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain rounded-xl bg-black"
                  />
                  <div className="absolute top-4 right-4 bg-amber-600/90 text-black text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                    <Monitor className="w-3 h-3" />
                    <span>در حال اشتراک‌گذاری صفحه شما</span>
                  </div>
                </div>
              )}

              {/* OTHER REAL ACTIVE USERS */}
              {bozorgParticipants.filter(p => p.username !== currentUser.username).map(part => (
                <div key={part.username} className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-900 p-4 flex flex-col items-center justify-center min-h-[160px] shadow-lg">
                  
                  {/* Real Webcam Feedback from Server */}
                  {part.webcamActive && part.webcamFrame ? (
                    <img
                      src={part.webcamFrame}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                      alt={`${part.username} webcam`}
                    />
                  ) : null}

                  <div className="relative z-10 flex flex-col items-center space-y-3">
                    {!(part.webcamActive && part.webcamFrame) && (
                      <div className="relative">
                        {part.micActive && (
                          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></div>
                        )}
                        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 text-lg font-bold shadow-lg">
                          {getInitials(part.username)}
                        </div>
                      </div>
                    )}
                    <div className="text-center bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <h4 className="text-xs font-bold text-white">{part.username}</h4>
                      <p className="text-[9px] text-zinc-300 mt-1">
                        {part.webcamActive ? "دوربین فعال" : part.screenActive ? "اشتراک‌گذاری صفحه" : "صوت فعال"}
                      </p>
                    </div>
                  </div>

                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 z-20">
                    <span className={`p-1.5 rounded-lg ${part.micActive ? "bg-emerald-950/80 text-emerald-400" : "bg-zinc-900/80 text-zinc-500"} text-[9px]`}>
                      {part.micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-zinc-600" />}
                    </span>
                    <span className={`p-1.5 rounded-lg ${part.webcamActive ? "bg-indigo-950/80 text-indigo-400" : "bg-zinc-900/80 text-zinc-500"} text-[9px]`}>
                      {part.webcamActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5 text-zinc-600" />}
                    </span>
                  </div>
                </div>
              ))}

              {/* OTHER PARTICIPANTS' SCREEN SHARES */}
              {bozorgParticipants.filter(p => p.username !== currentUser.username && p.screenActive && p.screenFrame).map(part => (
                <div key={`${part.username}-screen`} className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-amber-600/30 p-2 flex flex-col items-center justify-center min-h-[160px] shadow-lg sm:col-span-2">
                  <img
                    src={part.screenFrame || undefined}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain rounded-xl bg-black"
                    alt={`${part.username} screen`}
                  />
                  <div className="absolute top-4 right-4 bg-amber-600/90 text-black text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                    <Monitor className="w-3 h-3" />
                    <span>صفحه نمایش اشتراک‌گذاری شده توسط {part.username}</span>
                  </div>
                </div>
              ))}

              {/* EMPTY STATE IF ALONE (Only real users exist!) */}
              {bozorgParticipants.filter(p => p.username !== currentUser.username).length === 0 && (
                <div className="sm:col-span-2 lg:col-span-2 border border-dashed border-zinc-800/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 bg-zinc-950/10">
                  <div className="w-12 h-12 bg-zinc-900/80 border border-zinc-800/80 rounded-full flex items-center justify-center text-purple-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300">شما تنها فرد حاضر در این تالار هستید</h4>
                    <p className="text-[10px] text-zinc-500 mt-1 max-w-xs leading-relaxed">
                      این بخش از نوع داده‌های موقتی است و اطلاعات دائمی ذخیره نمی‌شود. لینک را برای دوستان خود بفرستید تا ملحق شوند!
                    </p>
                  </div>
                  <button
                    onClick={copyRoomLink}
                    className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800/80 text-[10px] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>لینک کپی شد!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی لینک ورود</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>

            {/* Bottom Controls Panel */}
            <div className="bg-zinc-950/95 border border-zinc-900 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 z-10" dir="rtl">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLeaveBozorg}
                  className="px-4 py-2 bg-rose-650 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-rose-950/30 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>قطع اتصال</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Voice toggle */}
                <button
                  onClick={handleToggleBozorgMic}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    bozorgMic 
                      ? "bg-purple-950/40 border-purple-800 text-purple-400" 
                      : "bg-zinc-900 border-zinc-850 text-zinc-500"
                  }`}
                  title={bozorgMic ? "قطع میکروفون" : "وصل میکروفون"}
                >
                  {bozorgMic ? <Mic className="w-4.5 h-4.5" /> : <MicOff className="w-4.5 h-4.5" />}
                </button>

                {/* Webcam toggle */}
                <button
                  onClick={handleToggleBozorgWebcam}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    bozorgWebcam 
                      ? "bg-purple-950/40 border-purple-800 text-purple-400" 
                      : "bg-zinc-900 border-zinc-850 text-zinc-500"
                  }`}
                  title={bozorgWebcam ? "خاموش کردن دوربین" : "روشن کردن دوربین"}
                >
                  {bozorgWebcam ? <Video className="w-4.5 h-4.5" /> : <VideoOff className="w-4.5 h-4.5" />}
                </button>

                {/* Screen Share toggle */}
                <button
                  onClick={handleToggleBozorgScreen}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    bozorgScreen 
                      ? "bg-amber-950/40 border-amber-850 text-amber-400" 
                      : "bg-zinc-900 border-zinc-850 text-zinc-500"
                  }`}
                  title={bozorgScreen ? "توقف شیر اسکرین" : "شیر اسکرین دسکتاپ"}
                >
                  <ScreenShare className="w-4.5 h-4.5" />
                </button>

                {/* Quality selector */}
                <div className="flex items-center gap-1 bg-[#120f18] border border-zinc-900 p-1 rounded-xl mr-2">
                  <span className="text-[10px] text-zinc-400 px-1.5">کیفیت:</span>
                  <button
                    onClick={() => setStreamQuality('low')}
                    className={`text-[10px] px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      streamQuality === 'low'
                        ? 'bg-purple-950/60 text-purple-400 border border-purple-900/30 font-bold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    ۳۶۰p
                  </button>
                  <button
                    onClick={() => setStreamQuality('medium')}
                    className={`text-[10px] px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      streamQuality === 'medium'
                        ? 'bg-purple-950/60 text-purple-400 border border-purple-900/30 font-bold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    ۷۲۰p
                  </button>
                  <button
                    onClick={() => setStreamQuality('high')}
                    className={`text-[10px] px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      streamQuality === 'high'
                        ? 'bg-purple-950/60 text-purple-400 border border-purple-900/30 font-bold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    ۱۰۸۰p
                  </button>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-500 block font-bold">وضعیت تالار دیسکوردی:</span>
                <span className="text-xs text-purple-300 font-extrabold">صوت و وب‌کم فعال همگانی</span>
              </div>
            </div>

          </div>

          {/* Sidebar - Real Active Members List (No fake users!) */}
          <div className="w-full md:w-64 border-t md:border-t-0 md:border-r border-zinc-900 bg-zinc-950/80 flex flex-col shrink-0">
            <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between text-right shrink-0">
              <span className="text-[9px] bg-purple-950 text-purple-400 border border-purple-900/40 font-mono px-2 py-0.5 rounded-full font-bold">
                {bozorgParticipants.length} MEMBERS
              </span>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>اعضای صوتی آنلاین</span>
                <Users className="w-4 h-4 text-purple-400" />
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" dir="rtl">
              
              {/* Me List item */}
              <div className="flex items-center justify-between bg-purple-950/20 border border-purple-900/30 p-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow">
                      {getInitials(currentUser.username)}
                    </div>
                    {bozorgMic && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-zinc-950"></span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">{currentUser.username}</span>
                    <span className="text-[9px] text-zinc-500 block">شما</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  {bozorgMic ? <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <MicOff className="w-3.5 h-3.5 text-zinc-600" />}
                  {bozorgWebcam && <Video className="w-3.5 h-3.5 text-purple-400" />}
                </div>
              </div>

              {/* Other real participants */}
              {bozorgParticipants.filter(p => p.username !== currentUser.username).map(part => (
                <div key={part.username} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-900/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                        {getInitials(part.username)}
                      </div>
                      {part.micActive && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-zinc-950"></span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-zinc-300 block">{part.username}</span>
                      <span className="text-[9px] text-zinc-500 block">آنلاین</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    {part.micActive ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-zinc-600" />}
                    {part.webcamActive && <Video className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                </div>
              ))}

              {/* Informational guide */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-900 text-[10px] text-zinc-500 leading-relaxed text-center mt-4">
                با بستن این صفحه یا خروج از تالار، اکانت شما به‌طور خودکار در کمتر از ۱۰ ثانیه از لیست اعضا حذف و تالار بازنشانی می‌شود.
              </div>

            </div>
          </div>

        </div>
      )}


      {/* VIEW: TALAR KOOCHAK (YOUTUBE LIVE STREAM STYLE) */}
      {(selectedHall === 'koochak' || selectedHall === 'koochak2') && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative bg-[#060408]">
          
          {/* Stream & Player side (Left) */}
          <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4 overflow-y-auto">
            
            {/* Top stream state panel */}
            <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-right" dir="rtl">
              
              <div className="flex items-center gap-2">
                {isLocalSharing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={stopKoochakStream}
                      className="flex items-center gap-1.5 bg-red-650 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-red-950/30"
                    >
                      <Square className="w-4 h-4" />
                      <span>پایان پخش زنده</span>
                    </button>
                    
                    {/* Live stream dynamic quality settings */}
                    <div className="flex items-center gap-1 bg-[#120f18] border border-zinc-900 p-1 rounded-xl">
                      <span className="text-[10px] text-zinc-400 px-1.5">تغییر کیفیت زنده:</span>
                      <button
                        onClick={() => handleQualityChange('low')}
                        className={`text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          streamQuality === 'low'
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-900/30 font-bold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        ضعیف (360p)
                      </button>
                      <button
                        onClick={() => handleQualityChange('medium')}
                        className={`text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          streamQuality === 'medium'
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-900/30 font-bold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        متوسط (720p)
                      </button>
                      <button
                        onClick={() => handleQualityChange('high')}
                        className={`text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          streamQuality === 'high'
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-900/30 font-bold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        عالی (1080p)
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setKoochakError("");
                      setShowGoLiveModal(true);
                    }}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-red-950/25 cursor-pointer"
                  >
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>شروع پخش صفحه نمایش</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {streamStatus.isLive && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                    <h2 className="text-sm font-bold text-white">
                      {streamStatus.isLive ? streamStatus.title : "هیچ استریمی در جریان نیست"}
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {streamStatus.isLive 
                      ? `در حال پخش زنده توسط: ${streamStatus.streamer} (بدون نیاز به OBS)` 
                      : "تصویر دسکتاپ، یک پنجره یا بازی خود را انتخاب کنید تا با کیفیت دلخواه مستقیم روی سرور فرستاده شود."}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-500 shrink-0">
                  <Monitor className="w-5 h-5" />
                </div>
              </div>

            </div>

            {koochakError && (
              <div className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-xl text-xs text-rose-400 text-right flex items-center justify-end gap-1.5">
                <span>{koochakError}</span>
                <AlertCircle className="w-4 h-4 shrink-0" />
              </div>
            )}

            {/* Live Player Screen */}
            <div className="flex-1 min-h-[320px] bg-[#09070c] border border-zinc-900 rounded-3xl overflow-hidden relative flex flex-col justify-center items-center shadow-2xl">
              
              {/* IF LOCAL STREAMER (SHOWS WHAT IS STREAMING) */}
              {isLocalSharing ? (
                <div className="w-full h-full relative flex flex-col justify-center items-center bg-zinc-950">
                  <video
                    ref={(el) => {
                      (koochakVideoRef as any).current = el;
                      if (el && localStreamObject && el.srcObject !== localStreamObject) {
                        el.srcObject = localStreamObject;
                        el.play().catch(e => console.warn("local stream playback failed:", e));
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain max-h-[80vh] bg-black"
                  />
                  {/* Floating active stats for streamer */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none" dir="rtl">
                    <span className="bg-red-600/90 text-white text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                      <Radio className="w-3 h-3 animate-pulse" />
                      <span>درحال استریم روی سرور ({streamQuality.toUpperCase()})</span>
                    </span>

                    <div className="flex gap-2">
                      <span className="bg-black/85 text-zinc-300 text-[9px] font-mono px-2.5 py-1 rounded-full shadow border border-zinc-900">
                        FPS: {fpsCounter}
                      </span>
                    </div>
                  </div>
                </div>
              ) : streamStatus.isLive && latestFrameSrc ? (
                /* IF VIEWER & STREAM IS LIVE (SHOWS STREAM FROM SERVER) */
                <div className="w-full h-full relative flex flex-col justify-center items-center bg-zinc-950">
                  <img
                    src={latestFrameSrc}
                    alt="Live stream screen"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain max-h-[80vh] bg-black"
                  />
                  
                  {/* Stats overlay for viewers */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none" dir="rtl">
                    <span className="bg-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                      <span>پخش زنده مستقیم از سرور</span>
                    </span>

                    <div className="flex gap-2">
                      <span className="bg-black/85 text-zinc-400 text-[9px] font-mono px-2.5 py-1 rounded-full shadow border border-zinc-900">
                        کیفیت: {streamStatus.quality === 'high' ? '1080p' : streamStatus.quality === 'low' ? '360p' : '720p'}
                      </span>
                      <span className="bg-black/85 text-emerald-400 text-[9px] font-mono px-2.5 py-1 rounded-full shadow border border-zinc-900">
                        تاخیر سرور: {viewerLatency}ms
                      </span>
                    </div>
                  </div>
                </div>
              ) : streamStatus.isLive && !latestFrameSrc ? (
                /* IF STREAM LIVE BUT WAITING ON FIRST FRAME */
                <div className="text-center p-8 space-y-4">
                  <div className="w-12 h-12 bg-red-950/30 border border-red-900/30 rounded-full flex items-center justify-center text-red-400 mx-auto animate-spin">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">در حال دریافت فریم‌های ویدیو...</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      تصویر در حال فشرده‌سازی و بارگذاری روی سرور بدون نیاز به برنامه‌های جانبی است.
                    </p>
                  </div>
                </div>
              ) : (
                /* NO ACTIVE STREAM */
                <div className="text-center p-8 space-y-4 max-w-sm">
                  <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-500 mx-auto">
                    <Tv className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">هیچ پخشی در جریان نیست</h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      کاربری در حال حاضر پخش زنده ندارد. شما می‌توانید با کلیک بر روی دکمه شروع پخش، اولین استریمر باشید!
                    </p>
                  </div>
                </div>
              )}

              {/* Frame statistics or controls */}
              {streamStatus.isLive && (
                <div className="absolute bottom-4 left-4 right-4 bg-zinc-950/80 backdrop-blur-md border border-zinc-900 rounded-2xl p-3 flex items-center justify-between text-xs z-10" dir="rtl">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">LIVE</span>
                    <span className="text-zinc-400">فرستنده: <strong className="text-white">{streamStatus.streamer}</strong></span>
                  </div>

                  <div className="text-zinc-500 text-[10px] hidden sm:block">
                    روش: آپلود مستقیم فریم JPEG روی وب سرور
                  </div>

                  <div className="flex items-center gap-2 text-zinc-400">
                    <Eye className="w-4 h-4 text-red-500" />
                    <span className="font-mono text-[11px]">انتقال سروری غیر P2P</span>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Chat Panel for YouTube Livestream (Right side) */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-900 bg-zinc-950/70 flex flex-col justify-between overflow-hidden shrink-0">
            
            <div className="bg-zinc-950 border-b border-zinc-900 p-3.5 flex items-center justify-between text-right shrink-0">
              <span className="text-[10px] bg-red-950 text-red-400 border border-red-900/40 font-mono font-bold px-2 py-0.5 rounded-full">STREAM CHAT</span>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>گفتگوی متنی تالار کوچک</span>
                <MessageCircle className="w-4 h-4 text-red-500" />
              </h3>
            </div>

            {/* Message window */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[250px] lg:max-h-none">
              {koochakLoading ? (
                <p className="text-[10px] text-zinc-600 text-center py-8">در حال بارگذاری چت...</p>
              ) : koochakChat.length === 0 ? (
                <p className="text-[10px] text-zinc-600 text-center py-8">پیامی هنوز فرستاده نشده است.</p>
              ) : (
                koochakChat.map((msg) => {
                  const isMe = msg.username === currentUser.username;
                  const isSys = msg.username === "سیستم";
                  
                  if (isSys) {
                    return (
                      <div key={msg.id} className="bg-zinc-900/30 border border-zinc-900/60 p-2 rounded-xl text-center text-[9px] text-zinc-400">
                        {msg.text}
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="text-right space-y-1">
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-zinc-600 font-mono">
                          {new Date(msg.createdAt).toLocaleTimeString("fa-IR", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`font-bold ${isMe ? "text-red-400" : "text-zinc-300"}`}>{msg.username}</span>
                      </div>
                      <div className={`p-2 rounded-xl text-xs break-words inline-block max-w-[90%] ${
                        isMe ? "bg-red-950/20 text-red-100 border border-red-900/30 ml-auto block" : "bg-zinc-900 text-zinc-200"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={koochakChatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="bg-zinc-950 border-t border-zinc-900/80 p-3 shrink-0">
              <form onSubmit={handleSendKoochakChat} className="flex gap-2">
                <button
                  type="submit"
                  disabled={!koochakInput.trim()}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-white p-2 rounded-xl transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 scale-x-[-1]" />
                </button>
                <input
                  type="text"
                  placeholder="نوشتن پیام در چت استریم..."
                  value={koochakInput}
                  onChange={(e) => setKoochakInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white text-right focus:outline-none focus:border-red-600"
                />
              </form>
            </div>

          </div>

        </div>
      )}


      {/* Start Live Stream Dialog (YouTube-like mode setup) */}
      <AnimatePresence>
        {showGoLiveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans text-right"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-850 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <button
                  onClick={() => setShowGoLiveModal(false)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  انصراف
                </button>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-4 h-4 text-red-500 animate-pulse" />
                  <span>تنظیمات پخش صفحه (بدون OBS)</span>
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">عنوان پخش زنده</label>
                  <input
                    type="text"
                    placeholder="مثلا: تحلیل مانگا، ماراتن مطالعه، طراحی دیجیتال..."
                    value={streamTitleInput}
                    onChange={(e) => setStreamTitleInput(e.target.value)}
                    className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-red-600 text-right"
                  />
                </div>

                {/* Source selector */}
                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">منبع ورودی پخش زنده</label>
                  <div className="grid grid-cols-2 gap-2">
                    
                    <button
                      type="button"
                      onClick={() => setStreamSource('screen')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border flex flex-col items-center justify-center gap-1 ${
                        streamSource === 'screen' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      <div className="font-bold">اشتراک‌گذاری دسکتاپ</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">نیازمند باز کردن در تب جدید</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStreamSource('webcam')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border flex flex-col items-center justify-center gap-1 ${
                        streamSource === 'webcam' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <Video className="w-4 h-4" />
                      <div className="font-bold">دوربین / وب‌کم</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">سازگار کامل با پیش‌نمایش</div>
                    </button>

                  </div>
                </div>

                {/* Quality selector */}
                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">تنظیم کیفیت آپلود فریم</label>
                  <div className="grid grid-cols-3 gap-2">
                    
                    <button
                      type="button"
                      onClick={() => handleQualityChange('low')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border ${
                        streamQuality === 'low' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <div className="font-bold">Low (360p)</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">کمترین مصرف اینترنت</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQualityChange('medium')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border ${
                        streamQuality === 'medium' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <div className="font-bold">Medium (720p)</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">متعادل و پایدار</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQualityChange('high')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border ${
                        streamQuality === 'high' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <div className="font-bold">High (1080p)</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">تصویر فوق‌العاده شفاف</div>
                    </button>

                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-850 p-3 rounded-xl text-[10px] text-zinc-400 leading-relaxed text-right space-y-1">
                  <p className="font-bold text-zinc-300">💡 راهنمای پخش زنده تالار:</p>
                  {streamSource === 'screen' ? (
                    <p>به دلیل محدودیت‌های امنیتی مرورگر درون فریم پیش‌نمایش، برای شروع پخش صفحه نمایش دسکتاپ حتما دکمه «باز کردن در تب جدید» در بالای صفحه را بزنید؛ یا همین حالا از گزینه پخش دوربین استفاده کنید.</p>
                  ) : (
                    <p>پخش وب‌کم به طور مستقیم در همین پنجره پیش‌نمایش پشتیبانی می‌شود و با کیفیت انتخابی شما روی سرور توزیع خواهد شد.</p>
                  )}
                </div>

                <button
                  onClick={startKoochakStream}
                  className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg active:scale-[0.98] cursor-pointer"
                >
                  {streamSource === 'webcam' ? "روشن کردن وب‌کم و شروع پخش زنده" : "انتخاب صفحه دسکتاپ و شروع استریم"}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
