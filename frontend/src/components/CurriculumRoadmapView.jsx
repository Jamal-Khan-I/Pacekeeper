import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Layers, Code, Copy, Check, Sparkles, BookOpen, Clock, AlertCircle
} from 'lucide-react';
import mermaid from 'mermaid';

// Initialize mermaid once with dark mode theme tailored for Pacekeeper
let mermaidInitialized = false;
function initMermaid() {
  if (!mermaidInitialized) {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        gantt: {
          titleTopMargin: 20,
          barHeight: 24,
          barGap: 8,
          topPadding: 45,
          sidePadding: 40,
          fontSize: 12,
          sectionFontSize: 13,
          numberSectionStyles: 3,
          useWidth: 700
        },
        themeVariables: {
          darkMode: true,
          background: '#030712',
          mainBkg: '#1e1b4b',
          primaryColor: '#4338ca',
          primaryTextColor: '#f8fafc',
          primaryBorderColor: '#6366f1',
          lineColor: '#06b6d4',
          secondaryColor: '#6d28d9',
          tertiaryColor: '#d97706',
          critBkgColor: '#b45309',
          critBorderColor: '#f59e0b',
          activeTaskBkgColor: '#312e81',
          activeTaskBorderColor: '#818cf8',
          sectionBkgColor: '#0f172a',
          sectionBkgColor2: '#0b0f19',
          altSectionBkgColor: '#0f172a',
          gridColor: 'rgba(148, 163, 184, 0.15)',
          todayLineColor: '#ec4899',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }
      });
      mermaidInitialized = true;
    } catch (e) {
      console.warn('Mermaid init warning:', e);
    }
  }
}

export default function CurriculumRoadmapView({ diagramCode, title = "Curriculum Roadmap" }) {
  const [viewMode, setViewMode] = useState('diagram'); // 'diagram' | 'timeline' | 'code'
  const [svgHtml, setSvgHtml] = useState('');
  const [renderError, setRenderError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [parsedSections, setParsedSections] = useState([]);
  const containerRef = useRef(null);

  // Parse mermaid text into structured timeline data as guaranteed fallback/interactive view
  useEffect(() => {
    if (!diagramCode) return;

    try {
      const lines = diagramCode.split('\n');
      const sections = [];
      let currentSection = { name: 'Curriculum Plan', items: [] };

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('section ')) {
          if (currentSection.items.length > 0) {
            sections.push(currentSection);
          }
          currentSection = {
            name: trimmed.replace('section ', '').trim(),
            items: []
          };
        } else if (trimmed.includes(':') && !trimmed.startsWith('title ') && !trimmed.startsWith('dateFormat ') && !trimmed.startsWith('axisFormat ') && trimmed !== 'gantt') {
          // Format: Task Name :[tags,] [start_date,] duration
          const colonIdx = trimmed.lastIndexOf(':');
          const taskName = trimmed.substring(0, colonIdx).trim();
          const metaStr = trimmed.substring(colonIdx + 1).trim();
          const parts = metaStr.split(',').map(p => p.trim());

          let date = '';
          let duration = '1d';
          for (const p of parts) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
              date = p;
            } else if (/^\d+d$/.test(p) || /^\d+h$/.test(p)) {
              duration = p;
            }
          }

          const isRevision = currentSection.name.toLowerCase().includes('revision') || taskName.toLowerCase().includes('rev');

          currentSection.items.push({
            name: taskName,
            date: date || 'Scheduled',
            duration: duration,
            isRevision: isRevision
          });
        }
      }

      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      setParsedSections(sections);
    } catch (err) {
      console.warn('Error parsing roadmap timeline:', err);
    }
  }, [diagramCode]);

  // Render SVG with Mermaid
  useEffect(() => {
    if (!diagramCode) return;
    initMermaid();

    let isMounted = true;
    const renderDiagram = async () => {
      try {
        setRenderError(null);
        // Clean diagram code: ensure no illegal syntax
        let cleanCode = diagramCode.trim();
        if (!cleanCode.startsWith('gantt')) {
          cleanCode = `gantt\n${cleanCode}`;
        }

        const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(uniqueId, cleanCode);
        if (isMounted) {
          setSvgHtml(svg);
        }
      } catch (err) {
        console.warn('Mermaid render error:', err);
        if (isMounted) {
          setRenderError(err.message || 'Could not render SVG directly');
          // Automatically show timeline view if SVG render fails
          setViewMode('timeline');
        }
      }
    };

    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [diagramCode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(diagramCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 rounded-2xl bg-slate-950/95 border border-indigo-500/30 shadow-xl overflow-hidden text-slate-200">
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white tracking-wide">{title}</span>
            <span className="ml-2 text-[10px] text-indigo-400 font-mono bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-800/60">
              Interactive
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 border border-slate-800 text-[11px]">
          <button
            onClick={() => setViewMode('diagram')}
            className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              viewMode === 'diagram'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Mermaid Visual Gantt Chart"
          >
            <Layers className="w-3 h-3" /> Chart
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              viewMode === 'timeline'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Interactive Visual Timeline"
          >
            <Calendar className="w-3 h-3" /> Timeline
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`px-2 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              viewMode === 'code'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Raw Mermaid Syntax"
          >
            <Code className="w-3 h-3" /> Code
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-3">
        {/* VIEW 1: MERMAID SVG DIAGRAM */}
        {viewMode === 'diagram' && (
          <div>
            {svgHtml ? (
              <div
                ref={containerRef}
                className="w-full overflow-x-auto py-2 px-1 flex justify-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:rounded-xl"
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            ) : renderError ? (
              <div className="py-4 text-center text-xs text-amber-300">
                <AlertCircle className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                <span>Could not render SVG directly ({renderError}). Showing Timeline view:</span>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-indigo-400 animate-pulse flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                <span>Rendering high-resolution roadmap diagram...</span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: VISUAL TIMELINE CARDS */}
        {viewMode === 'timeline' && (
          <div className="space-y-3 py-1">
            {parsedSections.map((sec, sIdx) => {
              const isRevisionSec = sec.name.toLowerCase().includes('revision');
              return (
                <div key={sIdx} className="rounded-xl bg-slate-900/70 border border-slate-800/80 p-3">
                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800/60">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isRevisionSec ? 'text-amber-400' : 'text-cyan-400'
                    }`}>
                      {sec.name}
                    </span>
                    <span className="text-[10px] text-gray-500">({sec.items.length} blocks)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sec.items.map((item, iIdx) => (
                      <div
                        key={iIdx}
                        className={`p-2 rounded-lg border text-left transition hover:border-slate-600 flex items-center justify-between ${
                          item.isRevision
                            ? 'bg-amber-950/20 border-amber-500/30 hover:bg-amber-950/30'
                            : 'bg-indigo-950/20 border-indigo-500/30 hover:bg-indigo-950/30'
                        }`}
                      >
                        <div className="flex items-start gap-2 overflow-hidden">
                          <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                            item.isRevision ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300'
                          }`}>
                            {item.isRevision ? <Clock className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-xs font-medium text-slate-100 truncate" title={item.name}>
                              {item.name}
                            </div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                              <Calendar className="w-2.5 h-2.5 text-gray-400" />
                              <span>{item.date}</span>
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 font-medium ${
                          item.isRevision
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {item.duration}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 3: RAW MERMAID SYNTAX */}
        {viewMode === 'code' && (
          <div className="relative">
            <button
              onClick={handleCopyCode}
              className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-indigo-600 text-gray-300 hover:text-white text-[10px] flex items-center gap-1 border border-slate-700 transition z-10"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy Mermaid'}
            </button>
            <pre className="p-3 rounded-xl bg-black/60 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto whitespace-pre leading-relaxed">
              {diagramCode}
            </pre>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-slate-900/60 border-t border-slate-800/70 flex items-center justify-between text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Synchronized with Pacekeeper adaptive engine
        </span>
        <button
          onClick={handleCopyCode}
          className="text-gray-400 hover:text-indigo-300 flex items-center gap-1 transition"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          Copy Code
        </button>
      </div>
    </div>
  );
}
