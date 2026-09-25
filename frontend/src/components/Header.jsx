import React from 'react';
import { Cpu, Zap, Bot, Cloud, CheckCircle2, Sparkles, Settings } from 'lucide-react';

export default function Header({ activeTier, setActiveTier, hardwareInfo, onOpenSettings }) {
  const handleSelectCloud = () => {
    setActiveTier('cloud');
    const hasKey = localStorage.getItem('pk_gemini_key') || localStorage.getItem('pk_groq_key');
    if (!hasKey && onOpenSettings) {
      onOpenSettings();
    }
  };

  return (
    <header className="glass-panel border-b border-gray-800 sticky top-0 z-40 px-6 py-4 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/20">
            <Zap className="w-6 h-6 animate-pulse-glow" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              Pacekeeper
            </h1>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <span>Adaptive Lesson & Spaced-Revision Planner</span>
            </p>
          </div>
        </div>

        {/* Hardware Auto-Detection Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-gray-400">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span>{hardwareInfo.cpuCores} Cores • {hardwareInfo.ramGB}GB RAM</span>
          <span className="text-slate-600">•</span>
          <span className="text-indigo-300 font-medium">Rec: {hardwareInfo.recommendedTier.toUpperCase()}</span>
        </div>

        {/* Three-Tier Mode Switcher Toggle + Settings */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-900/80 rounded-xl border border-slate-800">
            
            {/* Free Tier */}
            <button
              onClick={() => setActiveTier('free')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTier === 'free'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Free (Deterministic)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>

            {/* Local Agent */}
            <button
              onClick={() => setActiveTier('local')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTier === 'local'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/50'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Local Agent</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Phase 4</span>
            </button>

            {/* Cloud Agent */}
            <button
              onClick={handleSelectCloud}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTier === 'cloud'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/50'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloud Agent</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Phase 5 Active</span>
            </button>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Configure API Keys & Cloud Models"
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-gray-300 hover:text-white transition-all shadow-md"
          >
            <Settings className="w-4 h-4 text-blue-400" />
          </button>
        </div>

      </div>

      {/* Active Tier Banner */}
      {activeTier === 'free' && (
        <div className="max-w-7xl mx-auto mt-3 p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between animate-banner">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
            <span>
              <strong>Free Mode Active:</strong> Pure deterministic, zero-latency spaced revision & lesson planner engine. All core mathematical scoring, calendar constraint handling, and auto-replanning operate locally without external LLMs.
            </span>
          </div>
        </div>
      )}

      {activeTier === 'local' && (
        <div className="max-w-7xl mx-auto mt-3 p-2.5 rounded-lg bg-purple-950/40 border border-purple-500/40 text-xs text-purple-200 flex items-center justify-between animate-banner">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 animate-pulse" />
            <span>
              <strong>Local Agent Active (Phase 4 - Gemma 4 & LangGraph):</strong> Multimodal vision diagnosis for student answer sheet scans, automated syllabus document ingestion, and offline Voice TTS explanations fully active.
            </span>
          </div>
        </div>
      )}

      {activeTier === 'cloud' && (
        <div className="max-w-7xl mx-auto mt-3 p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/40 text-xs text-blue-200 flex items-center justify-between animate-banner">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Cloud Agent Active (Phase 5 - Gemini 1.5 & Groq Swapped):</strong> Swappable cloud LLM provider active. All answer sheet diagnoses, document ingestion, and LangGraph reasoning dynamically route through your selected Cloud API.
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            className="text-[11px] font-bold text-blue-300 hover:text-white underline ml-3 shrink-0"
          >
            Configure Keys & Models →
          </button>
        </div>
      )}
    </header>
  );
}
