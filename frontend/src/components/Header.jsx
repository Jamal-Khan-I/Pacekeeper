import React, { useState, useRef, useEffect } from 'react';
import { Zap, Bot, Cloud, ChevronDown, X, Check } from 'lucide-react';

const TIER_DETAILS = {
  free: {
    id: 'free',
    name: 'Free Mode (Deterministic)',
    shortName: 'Free (Deterministic)',
    badge: 'Offline / Zero Latency',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: Zap,
    iconColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/40',
    accentGrad: 'from-indigo-600 to-purple-600',
    description: 'Pure deterministic mathematical priority engine. All syllabus scoring, spaced revision scheduling, calendar constraints, and test-score auto-replanning operate locally in real-time with zero external LLMs and zero API keys.',
    highlights: [
      '100% Offline & deterministic mathematical scheduling',
      'Class roster & gradebook CSV imports (30–60+ students)',
      'Automated spacing curve & decay formula recalculations'
    ]
  },
  local: {
    id: 'local',
    name: 'Local Agent (Ollama)',
    shortName: 'Local Agent',
    badge: 'Private / Local AI',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    icon: Bot,
    iconColor: 'text-purple-400',
    borderColor: 'border-purple-500/40',
    accentGrad: 'from-purple-600 to-pink-600',
    description: 'Private multimodal Teacher Copilot running on your local machine using Ollama (Llama 3 / Gemma). Supports teacher voice speech, exam sheet vision diagnosis, and automated calendar rescheduling with complete data privacy.',
    highlights: [
      'Private on-device inference via Ollama',
      'Multimodal Teacher Copilot with voice & vision',
      'Zero student score data leaves your computer'
    ]
  },
  cloud: {
    id: 'cloud',
    name: 'Cloud Agent (Gemini & Groq)',
    shortName: 'Cloud Agent',
    badge: 'High Performance / Cloud AI',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: Cloud,
    iconColor: 'text-blue-400',
    borderColor: 'border-blue-500/40',
    accentGrad: 'from-blue-600 to-indigo-600',
    description: 'Ultra-fast multimodal Teacher Copilot powered by Google Gemini and Groq. Provides instant vision exam sheet diagnosis, autonomous tool execution for schedule restructuring, and speech synthesis.',
    highlights: [
      'Google Gemini 1.5 & Groq Llama 3 inference',
      'Autonomous timetable rescheduling tool execution',
      'Bring Your Own API Key (BYOK) stored in browser'
    ]
  }
};

export default function Header({ activeTier, setActiveTier, onOpenSettings }) {
  const [activeInfoTier, setActiveInfoTier] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setActiveInfoTier(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCloud = () => {
    setActiveTier('cloud');
    if (onOpenSettings) {
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

        {/* Three-Tier Mode Switcher with Per-Tab Info Arrows */}
        <div ref={containerRef} className="relative flex items-center p-1 bg-slate-900/80 rounded-xl border border-slate-800 gap-1">
          {Object.entries(TIER_DETAILS).map(([tierKey, info]) => {
            const Icon = info.icon;
            const isActive = activeTier === tierKey;
            const isInfoOpen = activeInfoTier === tierKey;

            return (
              <div key={tierKey} className="relative">
                {/* Mode Tab Button */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none cursor-pointer ${
                    isActive
                      ? `bg-gradient-to-r ${info.accentGrad} text-white shadow-md shadow-indigo-500/25`
                      : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/50'
                  }`}
                  onClick={() => {
                    if (tierKey === 'cloud') handleSelectCloud();
                    else setActiveTier(tierKey);
                  }}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{info.shortName}</span>

                  {tierKey === 'free' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}

                  {tierKey === 'cloud' && (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {isActive ? '⚙' : 'AI'}
                    </span>
                  )}

                  {tierKey === 'local' && (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      AI
                    </span>
                  )}

                  {/* Small down arrow inside each name to open info about that tier */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveInfoTier(prev => (prev === tierKey ? null : tierKey));
                    }}
                    className={`p-0.5 rounded transition-all ml-0.5 ${
                      isInfoOpen
                        ? 'bg-white/25 text-white rotate-180'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={`Click to read info about ${info.name}`}
                    aria-label={`Toggle info for ${info.name}`}
                  >
                    <ChevronDown className="w-3 h-3 transition-transform duration-200" />
                  </button>
                </div>

                {/* Per-Tab Info Popover */}
                {isInfoOpen && (
                  <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2.5 w-80 sm:w-88 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl shadow-black/90 z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl bg-slate-800/90 border ${info.borderColor}`}>
                          <Icon className={`w-4 h-4 ${info.iconColor}`} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-100 flex items-center gap-1.5 flex-wrap">
                            <span>{info.name}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${info.badgeColor}`}>
                              {info.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400">
                            {isActive ? '● Currently Active Mode' : 'Click tab to activate'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveInfoTier(null)}
                        className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-slate-800 transition"
                        title="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-xs text-gray-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800/90 mb-3">
                      {info.description}
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
                        Key Capabilities
                      </span>
                      {info.highlights.map((h, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[11px] text-gray-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          if (tierKey === 'cloud') handleSelectCloud();
                          else setActiveTier(tierKey);
                          setActiveInfoTier(null);
                        }}
                        className={`mt-3 w-full py-1.5 px-3 rounded-xl text-xs font-bold bg-gradient-to-r ${info.accentGrad} text-white shadow-md transition hover:opacity-90`}
                      >
                        Switch to {info.shortName}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </header>
  );
}
