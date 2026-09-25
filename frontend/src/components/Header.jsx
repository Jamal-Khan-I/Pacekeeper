import React, { useState, useRef, useEffect } from 'react';
import { Zap, Bot, Cloud, ChevronDown, X, Sparkles } from 'lucide-react';

const TIER_DETAILS = {
  free: {
    name: 'Free Mode (Deterministic)',
    badge: 'Offline / Zero Latency',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: Zap,
    iconColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/40',
    description: 'Pure deterministic, zero-latency spaced revision & lesson planner engine. All core mathematical scoring, calendar constraint handling, and auto-replanning operate locally without external LLMs.'
  },
  local: {
    name: 'Local Agent (Ollama)',
    badge: 'Private / Local AI',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    icon: Bot,
    iconColor: 'text-purple-400',
    borderColor: 'border-purple-500/40',
    description: 'Multimodal Teacher Copilot with voice speech, vision diagnosis for student exam sheets, and automated rescheduling.'
  },
  cloud: {
    name: 'Cloud Agent (Gemini & Groq)',
    badge: 'High Performance / Cloud AI',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: Cloud,
    iconColor: 'text-blue-400',
    borderColor: 'border-blue-500/40',
    description: 'Full Multimodal Teacher Copilot with cloud vision, speech synthesis, and autonomous timetable tool execution.'
  }
};

export default function Header({ activeTier, setActiveTier, onOpenSettings }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
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

  const current = TIER_DETAILS[activeTier] || TIER_DETAILS.free;
  const CurrentIcon = current.icon;

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

        {/* Three-Tier Mode Switcher Toggle + Down Arrow Info Dropdown */}
        <div className="flex items-center gap-1.5">
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
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Copilot AI</span>
            </button>

            {/* Cloud Agent (Clicking configures API Keys) */}
            <button
              onClick={handleSelectCloud}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTier === 'cloud'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/50'
              }`}
              title="Cloud Agent (Click to configure API Keys)"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloud Agent</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {activeTier === 'cloud' ? 'API Key ⚙' : 'Copilot AI'}
              </span>
            </button>
          </div>

          {/* Hover / Click Down Arrow for Mode Info */}
          <div
            className="relative"
            ref={dropdownRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <button
              onClick={() => setIsOpen(prev => !prev)}
              className={`p-2 rounded-xl border transition-all duration-200 ${
                isOpen || isHovered
                  ? 'bg-slate-800 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-500/20'
                  : 'bg-slate-900/80 border-slate-800 text-gray-400 hover:text-gray-200 hover:bg-slate-800/60'
              }`}
              title="Mode details & architecture (Hover or click to view)"
              aria-label="Toggle tier information"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isOpen || isHovered ? 'rotate-180 text-indigo-400' : ''
                }`}
              />
            </button>

            {/* Floating Popover Card */}
            {(isOpen || isHovered) && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl shadow-black/80 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl bg-slate-800/90 border ${current.borderColor}`}>
                      <CurrentIcon className={`w-4 h-4 ${current.iconColor}`} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-100 flex items-center gap-2">
                        <span>{current.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${current.badgeColor}`}>
                          Active
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400">Mode Overview & Capabilities</p>
                    </div>
                  </div>
                  {isOpen && (
                    <button
                      onClick={() => setIsOpen(false)}
                      className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-slate-800 transition"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-gray-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800/90">
                  {current.description}
                </div>

                {/* All Available Engines Quick View */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 block mb-1.5">
                    Switch Engine
                  </span>
                  <div className="space-y-1">
                    {Object.entries(TIER_DETAILS).map(([tierKey, info]) => {
                      const Icon = info.icon;
                      const isActive = activeTier === tierKey;
                      return (
                        <button
                          key={tierKey}
                          onClick={() => {
                            if (tierKey === 'cloud') handleSelectCloud();
                            else setActiveTier(tierKey);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition flex items-center justify-between ${
                            isActive
                              ? 'bg-slate-800/90 text-white font-medium border border-slate-700/80'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`w-3.5 h-3.5 ${info.iconColor}`} />
                            <span>{info.name}</span>
                          </div>
                          {isActive ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-500 hover:text-indigo-400 font-medium">Select →</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
