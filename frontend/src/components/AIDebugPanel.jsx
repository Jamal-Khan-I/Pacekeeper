import React, { useState, useEffect, useRef } from 'react';
import { Terminal, CheckCircle2, AlertTriangle, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';

/**
 * AIDebugPanel — Live Ollama status + log viewer for Part A verification.
 * Shows: connection status, model list, last raw response preview.
 */
export default function AIDebugPanel({ diagnosisResult, lastProviderUsed }) {
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState([]);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const status = await api.getOllamaStatus();
      setOllamaStatus(status);
      addLog({
        type: status.available ? 'success' : 'warn',
        msg: status.available
          ? `Ollama CONNECTED | Models: ${status.models?.join(', ') || 'none'}`
          : `Ollama OFFLINE — ${status.message || 'not reachable'}`
      });
    } catch (e) {
      addLog({ type: 'error', msg: `Status check failed: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const addLog = (entry) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [{ ts, ...entry }, ...prev].slice(0, 50));
  };

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (diagnosisResult) {
      const isPipelineError = !!diagnosisResult.diagnostic_summary?.includes('AI pipeline') ||
        !!diagnosisResult.diagnostic_summary?.includes('Ollama') ||
        !!diagnosisResult.diagnostic_summary?.includes('pipeline failed');

      addLog({
        type: isPipelineError ? 'error' : 'success',
        msg: isPipelineError
          ? `[AI Pipeline] FALLBACK FIRED — pipeline error surfaced | ${diagnosisResult.diagnostic_summary?.slice(0, 120)}`
          : `[AI Pipeline] REAL RESPONSE | Provider: ${lastProviderUsed || 'local'} | Topic: "${diagnosisResult.detected_topic}" | Score: ${Math.round(diagnosisResult.overall_score * 100)}% | Fallback Fired: False`
      });
    }
  }, [diagnosisResult]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        id="ai-debug-panel-toggle"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-gray-400 hover:text-gray-200 transition-all"
      >
        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
        AI Pipeline Logs
        {ollamaStatus && (
          <span className={`w-2 h-2 rounded-full ${ollamaStatus.available ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
        )}
        <ChevronDown className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden text-xs font-mono mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-gray-200">AI Pipeline Debug Console</span>
          {ollamaStatus && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
              ollamaStatus.available
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${ollamaStatus.available ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
              {ollamaStatus.available ? 'Ollama Connected' : 'Ollama Offline'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkStatus}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-gray-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setIsExpanded(false)} className="p-1 rounded text-gray-500 hover:text-white">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ollama Model List */}
      {ollamaStatus?.models?.length > 0 && (
        <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/50 flex items-center gap-2 flex-wrap">
          <span className="text-gray-500">Installed models:</span>
          {ollamaStatus.models.map(m => (
            <span key={m} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">{m}</span>
          ))}
        </div>
      )}

      {/* Log Stream */}
      <div className="max-h-48 overflow-y-auto p-3 space-y-1">
        {logs.length === 0 ? (
          <p className="text-gray-600 text-center py-4">No log entries yet. Upload an answer sheet to see real-time AI pipeline output.</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-gray-600 shrink-0 w-20">{log.ts}</span>
              {log.type === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />}
              {log.type === 'error' && <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />}
              {log.type === 'warn' && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />}
              <span className={`${
                log.type === 'success' ? 'text-emerald-300' :
                log.type === 'error' ? 'text-rose-300' :
                'text-amber-300'
              } leading-relaxed break-all`}>{log.msg}</span>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-800/50 text-[10px] text-gray-600 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
        Backend logs print to terminal. This panel tracks diagnosis outcomes.
        Check the Pacekeeper server console for raw [AI Pipeline] log lines.
      </div>
    </div>
  );
}
