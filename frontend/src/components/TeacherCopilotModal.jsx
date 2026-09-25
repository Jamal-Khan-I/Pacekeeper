import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Bot, Mic, MicOff, Volume2, VolumeX, Send, Paperclip, X,
  Maximize2, Minimize2, RefreshCw, Bell, Calendar, Award, CheckCircle2,
  AlertCircle, ChevronRight, Image as ImageIcon, Flame, ArrowUpRight, Lock
} from 'lucide-react';
import { api } from '../services/api';

export default function TeacherCopilotModal({
  isOpen,
  onClose,
  activeClassId,
  activeTier,
  onScheduleUpdated,
  onOpenSettings
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello Teacher! I am your **Pacekeeper Copilot**.\n\nI can help you:\n- **Analyze student test sheets** & diagnose errors\n- **Auto-reschedule curriculum** & add revision blocks\n- **Draw visual schedule diagrams**\n- **Dispatch revision alerts** to your desktop\n\nSpeak with the **Mic** or type below to begin.`,
      spokenText: "Hello Teacher! I am your Pacekeeper Copilot. Speak or type below to plan or reschedule your classes.",
      actionsTaken: []
    }
  ]);

  const [inputVal, setInputVal] = useState('');
  const [attachedImage, setAttachedImage] = useState(null); // base64
  const [attachedImageName, setAttachedImageName] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const chatBottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize Speech Recognition & Synthesis
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(r => r[0].transcript)
          .join('');
        setInputVal(transcript);
      };

      recognizer.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognizer.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognizer;
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Voice Text-to-Speech function
  const speakText = (text) => {
    if (isVoiceMuted || !text || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS playback error:', e);
    }
  };

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Mic start failed:', err);
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedImageName(file.name);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setAttachedImage(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  const loadSampleImage = async (demoFilename, label) => {
    try {
      const resp = await fetch(`/demo/${demoFilename}`);
      if (!resp.ok) throw new Error('Demo file not found');
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result);
        setAttachedImageName(label || demoFilename);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      alert(`Could not load sample image: ${err.message}`);
    }
  };

  const handleSendMessage = async (textToSend = null) => {
    const message = (textToSend !== null ? textToSend : inputVal).trim();
    if (!message && !attachedImage) return;

    const userMsgId = `user-${Date.now()}`;
    const newMsg = {
      id: userMsgId,
      role: 'user',
      text: message || 'Please analyze this student answer sheet.',
      image: attachedImage,
      imageName: attachedImageName
    };

    setMessages(prev => [...prev, newMsg]);
    setInputVal('');
    const curImg = attachedImage;
    setAttachedImage(null);
    setAttachedImageName('');
    setLoading(true);

    try {
      const res = await api.copilotChat({
        message: newMsg.text,
        image_base64: curImg,
        class_id: activeClassId,
        history: messages.slice(-4).map(m => ({ role: m.role, content: m.text }))
      });

      const assistantMsg = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        spokenText: res.spoken_text,
        actionsTaken: res.actions_taken || [],
        diagramCode: res.diagram_code,
        diagnosis: res.diagnosis,
        updatedSchedule: res.updated_schedule
      };

      setMessages(prev => [...prev, assistantMsg]);

      // If voice enabled, speak the answer
      if (res.spoken_text && !isVoiceMuted) {
        speakText(res.spoken_text);
      }

      // If schedule recomputed, trigger app refresh!
      if (res.updated_schedule && onScheduleUpdated) {
        onScheduleUpdated();
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `**Error**: Failed to communicate with Copilot service (${err.message}).`,
          actionsTaken: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed z-50 transition-all duration-300 ${
      isExpanded
        ? 'inset-4 md:inset-10 flex flex-col'
        : 'bottom-4 right-4 md:right-8 w-[95vw] md:w-[500px] h-[640px] max-h-[85vh] flex flex-col'
    }`}>
      <div className="flex-1 flex flex-col rounded-3xl bg-slate-950/95 backdrop-blur-2xl border border-indigo-500/30 shadow-2xl shadow-purple-950/60 overflow-hidden text-gray-100">

        {/* Top Header */}
        <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  Teacher Copilot
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                  activeTier === 'free'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : activeTier === 'local'
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                }`}>
                  {activeTier === 'free' ? 'Rule-Based' : activeTier === 'local' ? 'Local Ollama' : 'Cloud AI'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Multimodal Assistant for Classroom Pacing</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Voice Mute/Unmute */}
            <button
              onClick={() => setIsVoiceMuted(!isVoiceMuted)}
              className={`p-2 rounded-xl transition ${
                isVoiceMuted ? 'text-gray-400 hover:text-gray-200 hover:bg-slate-800' : 'text-cyan-400 bg-cyan-950/40 border border-cyan-500/30'
              }`}
              title={isVoiceMuted ? 'Unmute voice output' : 'Mute voice output'}
            >
              {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Expand / Minimize */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-slate-800 transition"
              title={isExpanded ? 'Restore window size' : 'Expand window'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-slate-800 transition"
              title="Close Copilot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* If Free Tier: Show Gated Screen */}
        {activeTier === 'free' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950/90">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 shadow-xl shadow-amber-500/10">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mb-3">
              Feature Gated to Local & Cloud AI
            </span>
            <h4 className="text-base font-extrabold text-white mb-2">Teacher Copilot AI is Not Available in Free Tier</h4>
            <p className="text-xs text-gray-400 max-w-sm mb-6 leading-relaxed">
              The <strong>Free Tier</strong> runs exclusively on deterministic mathematical algorithms (Ebbinghaus forgetting curve & knapsack planner).
              <br /><br />
              To chat with the multimodal AI, dictate voice commands, analyze student test sheets, and auto-reschedule timetables, switch to <strong>Local LLM (Ollama)</strong> or <strong>Cloud Tier (Gemini/OpenAI)</strong>.
            </p>
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-purple-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-purple-950/60 transition transform hover:scale-[1.02]"
            >
              <span>Configure Local LLM or Cloud API in Settings</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 leading-relaxed shadow-lg ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                {/* Attached Image Thumbnail */}
                {m.image && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-white/20 max-h-48 bg-black/40">
                    <img src={m.image} alt="Student paper" className="w-full h-auto object-cover" />
                    {m.imageName && (
                      <div className="px-2 py-1 text-[10px] text-slate-300 bg-slate-950/80 truncate">
                        📄 {m.imageName}
                      </div>
                    )}
                  </div>
                )}

                {/* Message Text with simple formatting */}
                <div className="whitespace-pre-wrap font-sans">
                  {m.text}
                </div>

                {/* Tool Action Badges */}
                {m.actionsTaken && m.actionsTaken.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                    {m.actionsTaken.map((act, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                      >
                        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                        {act === 'reschedule_curriculum' ? 'Timetable Rescheduled'
                          : act === 'send_notifications' ? 'Revision Alerts Fired'
                          : act === 'generate_diagram' ? 'Diagram Generated'
                          : act === 'diagnose_answer_sheet' ? 'Exam Sheet Analyzed'
                          : act}
                      </span>
                    ))}
                  </div>
                )}

                {/* Mermaid Schedule Diagram Preview Card */}
                {m.diagramCode && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-indigo-500/30 font-mono text-[11px] text-indigo-300 overflow-x-auto">
                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center justify-between">
                      <span>Curriculum Roadmap Diagram</span>
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <pre className="text-[10px] text-slate-300 whitespace-pre">{m.diagramCode}</pre>
                  </div>
                )}

                {/* Voice Re-play Button */}
                {m.spokenText && (
                  <div className="mt-2 pt-1.5 flex justify-end">
                    <button
                      onClick={() => speakText(m.spokenText)}
                      className="text-gray-400 hover:text-cyan-400 text-[10px] flex items-center gap-1 transition"
                      title="Read aloud"
                    >
                      <Volume2 className="w-3 h-3" /> Speak
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-indigo-400 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 w-fit animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Copilot is thinking & executing tools...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => handleSendMessage('Please reschedule the curriculum to add an extra revision block for weak topics.')}
            className="text-[11px] whitespace-nowrap px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 text-indigo-300 border border-slate-700/60 transition"
          >
            🔄 Auto-Reschedule
          </button>
          <button
            onClick={() => handleSendMessage('Draw a schedule diagram for our class lessons.')}
            className="text-[11px] whitespace-nowrap px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-purple-600/30 text-purple-300 border border-slate-700/60 transition"
          >
            📊 Draw Schedule Diagram
          </button>
          <button
            onClick={() => handleSendMessage('Fire classroom revision notifications to desktop now.')}
            className="text-[11px] whitespace-nowrap px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-cyan-600/30 text-cyan-300 border border-slate-700/60 transition"
          >
            🔔 Send Revision Alerts
          </button>
          <button
            onClick={() => loadSampleImage('class_a_math_calculus_chain_rule_error.jpg', 'Alex Mercer (Chain Rule Error)')}
            className="text-[11px] whitespace-nowrap px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-pink-600/30 text-pink-300 border border-slate-700/60 transition"
          >
            📎 Sample: Alex (Chain Rule)
          </button>
        </div>

        {/* Image Attachment Preview Bar */}
        {attachedImage && (
          <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-200 font-medium truncate max-w-xs">{attachedImageName || 'Exam Sheet Ready'}</span>
            </div>
            <button
              onClick={() => { setAttachedImage(null); setAttachedImageName(''); }}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="flex items-center gap-2"
          >
            {/* File Upload Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 transition"
              title="Attach student answer sheet photo"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Voice Mic Input */}
            <button
              type="button"
              onClick={toggleMic}
              className={`p-2.5 rounded-xl transition-all ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-gray-300'
              }`}
              title={isListening ? 'Stop listening' : 'Speak via microphone'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={isListening ? "Listening... speak now" : "Ask Copilot or dictate classroom command..."}
              className="flex-1 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading || (!inputVal.trim() && !attachedImage)}
              className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white transition shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
          </>
        )}

      </div>
    </div>
  );
}
