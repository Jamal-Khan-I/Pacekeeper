import React from 'react';
import { Sparkles, Sliders, Clock, Info } from 'lucide-react';

export default function ExplanationBanner({ scheduleData }) {
  if (!scheduleData) return null;

  const { explanation_summary, weights_used, unallocated_hours, teaching_sessions, revision_sessions } = scheduleData;

  return (
    <div className="explanation-banner-card glass-panel-accent rounded-2xl p-5 mb-6 animate-banner relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row items-start justify-between gap-4 relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </span>
            <h2 className="explanation-title text-sm font-bold uppercase tracking-wider text-indigo-300">
              Deterministic Schedule Explanation & Reasoning
            </h2>
          </div>
          
          <p className="explanation-summary-box text-sm text-slate-200 leading-relaxed whitespace-pre-line font-medium bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
            {explanation_summary || 'Schedule generated based on topic weightage, difficulty, and performance gaps.'}
          </p>
        </div>

        {/* Adaptive Weights & Allocation Stats */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
          <div className="explanation-stat-card bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs flex flex-col gap-1.5 min-w-[210px]">
            <div className="flex items-center justify-between text-gray-400 font-semibold border-b border-slate-800 pb-1">
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                Adaptive Weights
              </span>
              <span className="text-[10px] text-indigo-400">Self-Adjusted</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="explanation-weight-pill bg-slate-800/60 p-1.5 rounded">
                <div className="text-[10px] text-gray-400">Weightage</div>
                <div className="font-bold text-indigo-300">{weights_used?.weightage_weight ?? 1.0}x</div>
              </div>
              <div className="explanation-weight-pill bg-slate-800/60 p-1.5 rounded">
                <div className="text-[10px] text-gray-400">Difficulty</div>
                <div className="font-bold text-purple-300">{weights_used?.difficulty_weight ?? 1.0}x</div>
              </div>
              <div className="explanation-weight-pill bg-slate-800/60 p-1.5 rounded">
                <div className="text-[10px] text-gray-400">Gap</div>
                <div className="font-bold text-pink-300">{weights_used?.gap_weight ?? 1.2}x</div>
              </div>
            </div>
          </div>

          <div className="explanation-buffer-pill bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-xs flex items-center justify-between gap-3 text-gray-300">
            <span className="flex items-center gap-1.5 text-gray-400">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Buffer Hours:
            </span>
            <span className="font-bold text-emerald-300">{unallocated_hours || 0}h Available</span>
          </div>
        </div>
      </div>
    </div>
  );
}
