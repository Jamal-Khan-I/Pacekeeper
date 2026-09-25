import React from 'react';
import { X, Award, Sliders, Target, Calculator, Clock, HelpCircle } from 'lucide-react';

export default function PriorityReasoningModal({ topicId, topics, scheduleData, onClose }) {
  if (!topicId || !scheduleData) return null;

  const topic = topics.find(t => t.id === topicId);
  if (!topic) return null;

  const { topic_scores = {}, allocated_hours_per_topic = {}, weights_used = {} } = scheduleData;
  const pScore = topic_scores[topicId] ?? 0.0;
  const allocatedHrs = allocated_hours_per_topic[topicId] ?? 0.0;

  const maxExamWeightage = Math.max(...topics.map(t => t.exam_weightage), 1.0);
  const maxDifficulty = Math.max(...topics.map(t => t.difficulty), 1.0);

  const normWeightage = topic.exam_weightage / maxExamWeightage;
  const normDiff = topic.difficulty / maxDifficulty;
  const gap = topic.performance_gap;

  const targetPct = Math.round((topic.target_score ?? 0.85) * 100);
  const assumedPct = Math.max(5, targetPct - 20);

  const wWeight = weights_used.weightage_weight ?? 1.0;
  const wDiff = weights_used.difficulty_weight ?? 1.0;
  const wGap = weights_used.gap_weight ?? 1.2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-banner">
      <div className="glass-panel border-purple-500/40 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {topic.name}
              <span className="text-xs font-normal px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {topic.subject}
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              Deterministic Priority Score Breakdown & Allocation Reasoning
            </p>
          </div>
        </div>

        {/* Score & Allocation Highlight Cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
            <div className="text-[11px] text-gray-400 mb-1 flex items-center justify-center gap-1">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              Raw Priority
            </div>
            <div className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">
              {pScore.toFixed(4)}
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
            <div className="text-[11px] text-gray-400 mb-1 flex items-center justify-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Priority Share
            </div>
            <div className="text-xl font-extrabold text-indigo-300">
              {(() => {
                const tot = Object.values(topic_scores).reduce((a, b) => a + b, 0);
                return tot > 0 ? `${((pScore / tot) * 100).toFixed(1)}%` : '0.0%';
              })()}
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
            <div className="text-[11px] text-gray-400 mb-1 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Allocated Hours
            </div>
            <div className="text-xl font-extrabold text-emerald-300">
              {allocatedHrs} hrs
            </div>
          </div>
        </div>

        {/* Traceable Mathematical Chain */}
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-2.5 mb-4">
          <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Traceable Allocation Pipeline
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              Proportional Share Allocation
            </span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-center text-indigo-200 leading-relaxed">
            ({wWeight.toFixed(2)} × {normWeightage.toFixed(2)}) × ({wDiff.toFixed(2)} × {normDiff.toFixed(2)}) × ({wGap.toFixed(2)} × {gap.toFixed(2)})
            <span className="text-purple-400 font-bold"> = {pScore.toFixed(4)}</span>
            <span className="text-gray-400"> → </span>
            <span className="text-indigo-400 font-bold">
              {(() => {
                const tot = Object.values(topic_scores).reduce((a, b) => a + b, 0);
                return tot > 0 ? `${((pScore / tot) * 100).toFixed(1)}% share` : '';
              })()}
            </span>
            <span className="text-gray-400"> → </span>
            <span className="text-emerald-400 font-bold">{allocatedHrs} hrs</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
              <div className="text-[10px] text-gray-400 font-semibold">Exam Weightage</div>
              <div className="text-white font-bold mt-0.5">{topic.exam_weightage}%</div>
              <div className="text-[10px] text-indigo-300 mt-1">Norm: {normWeightage.toFixed(2)} (w={wWeight.toFixed(2)}x)</div>
            </div>

            <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
              <div className="text-[10px] text-gray-400 font-semibold">Difficulty</div>
              <div className="text-white font-bold mt-0.5">{topic.difficulty} / 5.0</div>
              <div className="text-[10px] text-purple-300 mt-1">Norm: {normDiff.toFixed(2)} (w={wDiff.toFixed(2)}x)</div>
            </div>

            <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
              <div className="text-[10px] text-gray-400 font-semibold">Performance Gap</div>
              <div className="text-white font-bold mt-0.5">
                {topic.performance_score !== null ? `${Math.round(topic.performance_score * 100)}% score` : `Untested (Target: ${targetPct}%)`}
              </div>
              <div className="text-[10px] text-pink-300 mt-1">
                {topic.performance_score === null 
                  ? `Assumed ${assumedPct}% → Gap: ${gap.toFixed(3)}` 
                  : `Gap: ${gap.toFixed(3)}`} (w={wGap.toFixed(2)}x)
              </div>
            </div>
          </div>
        </div>

        {/* Plain language rationale */}
        <div className="text-xs text-gray-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
          <strong>Allocation Rationale:</strong>
          {topic.performance_score === null ? (
            <span className="text-amber-200/90 font-medium">
              {' '}This topic is untested. The engine dynamically sets assumed mastery to target − 20% ({targetPct}% − 20% = {assumedPct}% assumed mastery → {gap.toFixed(3)} gap) so it receives reasonable priority ({allocatedHrs}h allocated) without unfairly outranking topics with confirmed poor test scores.
            </span>
          ) : gap >= 0.4 ? (
            <span className="text-rose-300 font-medium">
              {' '}Confirmed weak score ({Math.round(topic.performance_score * 100)}%, Gap: {gap.toFixed(3)}) boosted priority to {pScore.toFixed(3)}. Its {(() => {
                const tot = Object.values(topic_scores).reduce((a, b) => a + b, 0);
                return tot > 0 ? `${((pScore / tot) * 100).toFixed(1)}%` : '0%';
              })()} share directly translates to {allocatedHrs} teaching hours with guaranteed non-zero floor enforcement.
            </span>
          ) : (
            <span className="text-emerald-300 font-medium">
              {' '}Demonstrated high student mastery ({Math.round((1 - gap) * 100)}%). Lower priority share ({(() => {
                const tot = Object.values(topic_scores).reduce((a, b) => a + b, 0);
                return tot > 0 ? `${((pScore / tot) * 100).toFixed(1)}%` : '0%';
              })()}) ensures remaining class hours are focused where students need remediation, receiving {allocatedHrs}h.
            </span>
          )}
        </div>

        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Close Breakdown
          </button>
        </div>

      </div>
    </div>
  );
}
