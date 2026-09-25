import React, { useState } from 'react';
import { Calendar, BookOpen, Repeat, Info, ChevronRight, Award, Flame, AlertCircle, Download, Bell, CheckCircle2, X, Clock, Sparkles } from 'lucide-react';
import { api } from '../services/api';

// Web Audio API chime for immediate feedback
const playNotificationChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now); // D6
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.12); // A6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } catch (err) {
    // Ignore audio autoplay restrictions
  }
};

export default function ScheduleVisualizer({ scheduleData, onSelectTopicForReasoning }) {
  const [filterType, setFilterType] = useState('all'); // 'all', 'teaching', 'revision'
  const [notifyMsg, setNotifyMsg] = useState(null);
  const [toasts, setToasts] = useState([]);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleNotifyOS = async () => {
    try {
      // 1. Play alert chime
      playNotificationChime();

      // 2. Request backend revision sessions
      const res = await api.triggerOSNotification();
      const list = res.notifications || [];

      // 3. Trigger Native Windows OS Notifications via Browser Web Notification API
      if ('Notification' in window) {
        let perm = Notification.permission;
        if (perm === 'default') {
          perm = await Notification.requestPermission();
        }
        if (perm === 'granted') {
          list.forEach((n, idx) => {
            setTimeout(() => {
              try {
                new Notification(n.title, {
                  body: n.message,
                  tag: `pacekeeper-rev-${n.session_id || idx}`,
                  silent: false,
                });
              } catch (e) {
                console.warn('Native notification trigger failed:', e);
              }
            }, idx * 300);
          });
        }
      }

      // 4. In-App Floating Toast Stack (Guaranteed visible popups on screen)
      const newToasts = list.map((n, i) => ({
        id: `${Date.now()}-${i}`,
        title: n.title,
        message: n.message,
        topicName: n.topic_name || 'Revision Topic',
        date: n.date || 'Upcoming',
        sessionId: n.session_id,
      }));
      setToasts(newToasts);

      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => !newToasts.some((nt) => nt.id === t.id)));
      }, 8000);

      setNotifyMsg(`Fired ${res.notifications_count || 0} revision notifications!`);
      setTimeout(() => setNotifyMsg(null), 4000);
    } catch (err) {
      alert(`Error sending notification: ${err.message}`);
    }
  };

  if (!scheduleData) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-gray-400">
        <Calendar className="w-10 h-10 mx-auto mb-3 text-indigo-400 opacity-50" />
        <p>No schedule generated yet. Add topics and calendar days, then click Generate Schedule.</p>
      </div>
    );
  }

  const { teaching_sessions = [], revision_sessions = [], topic_scores = {}, allocated_hours_per_topic = {} } = scheduleData;

  // Combine and group sessions by date
  const allSessions = [
    ...teaching_sessions.map(s => ({ ...s, isRevision: false })),
    ...revision_sessions.map(s => ({ ...s, isRevision: true }))
  ];

  const filteredSessions = allSessions.filter(s => {
    if (filterType === 'teaching') return !s.isRevision;
    if (filterType === 'revision') return s.isRevision;
    return true;
  });

  // Group by date string YYYY-MM-DD
  const sessionsByDate = filteredSessions.reduce((acc, s) => {
    const d = s.scheduled_date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});

  const sortedDates = Object.keys(sessionsByDate).sort();

  return (
    <div className="glass-panel rounded-2xl p-6 mb-6">
      {/* Visualizer Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Hour-by-Hour Lesson & Spaced-Revision Schedule
          </h3>
          <p className="text-xs text-gray-400">
            Click any session or topic to inspect its priority scoring math and hour allocation rationale.
          </p>
        </div>

        {/* Action Controls: Export iCal & Notify OS */}
        <div className="flex flex-wrap items-center gap-2">
          
          <button
            onClick={() => api.exportScheduleICS()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition shadow-md"
            title="Download standard RFC 5545 .ics calendar file for Google Calendar, Outlook, Apple Calendar"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export .ics Calendar</span>
          </button>

          <button
            onClick={handleNotifyOS}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 transition shadow-md"
            title="Fire native Windows Action Center OS Desktop Notification for revision sessions"
          >
            <Bell className="w-3.5 h-3.5 text-purple-400" />
            <span>Fire OS Notification</span>
          </button>

          {/* Filter buttons */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'all' ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              All ({allSessions.length})
            </button>
            <button
              onClick={() => setFilterType('teaching')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'teaching' ? 'bg-blue-600 text-white font-semibold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Teaching ({teaching_sessions.length})
            </button>
            <button
              onClick={() => setFilterType('revision')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'revision' ? 'bg-purple-600 text-white font-semibold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Revision ({revision_sessions.length})
            </button>
          </div>
        </div>
      </div>

      {notifyMsg && (
        <div className="mb-4 p-2.5 rounded-xl bg-purple-950/50 border border-purple-500/40 text-xs text-purple-200 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{notifyMsg}</span>
        </div>
      )}

      {/* Timeline Grid */}
      {sortedDates.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          No sessions match the selected filter.
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const sessions = sessionsByDate[dateStr];
            const dateObj = new Date(dateStr);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <div key={dateStr} className="border-l-2 border-indigo-500/40 pl-4 py-1">
                <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  {formattedDate}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sessions.map((session) => {
                    const pScore = topic_scores[session.topic_id] ?? 0.0;
                    const totalHrsAllocated = allocated_hours_per_topic[session.topic_id] ?? 0.0;

                    return (
                      <div
                        key={session.session_id}
                        onClick={() => onSelectTopicForReasoning(session.topic_id)}
                        className={`group relative rounded-xl p-4 transition-all duration-200 cursor-pointer border hover:scale-[1.01] shadow-lg ${
                          session.isRevision
                            ? 'bg-purple-950/30 border-purple-500/30 hover:border-purple-400/60 hover:shadow-purple-500/10'
                            : 'bg-indigo-950/30 border-indigo-500/30 hover:border-indigo-400/60 hover:shadow-indigo-500/10'
                        }`}
                      >
                        {/* Type & Hours Header */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                              session.isRevision
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            }`}
                          >
                            {session.isRevision ? (
                              <>
                                <Repeat className="w-3 h-3" />
                                Revision (Stage {session.revision_stage})
                              </>
                            ) : (
                              <>
                                <BookOpen className="w-3 h-3" />
                                Teaching
                              </>
                            )}
                          </span>

                          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {session.allocated_hours} hrs
                          </span>
                        </div>

                        {/* Topic Name */}
                        <h4 className="font-bold text-white text-sm group-hover:text-indigo-200 transition-colors mb-1">
                          {session.topic_name}
                        </h4>
                        
                        <div className="text-xs text-gray-400 mb-3">{session.subject}</div>

                        {/* Explainability Footer Badge */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-gray-400">
                          <span className="flex items-center gap-1 text-purple-300 font-medium">
                            <Award className="w-3.5 h-3.5 text-purple-400" />
                            Priority: {pScore.toFixed(2)}
                          </span>

                          <span className="flex items-center gap-0.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform text-[11px] font-semibold">
                            Reasoning <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating In-App Toast Notification Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-auto">
          {toasts.map((toast, idx) => (
            <div
              key={toast.id}
              className="bg-slate-900/95 backdrop-blur-xl border border-purple-500/40 shadow-2xl shadow-purple-950/60 rounded-2xl p-4 text-white animate-slide-up transition-all duration-300 relative overflow-hidden group"
            >
              {/* Top gradient accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500" />

              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-purple-300 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                      Revision Alert #{idx + 1}
                    </span>
                    <h5 className="text-xs font-bold text-white mt-1 leading-snug">{toast.title}</h5>
                  </div>
                </div>

                <button
                  onClick={() => dismissToast(toast.id)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                  title="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 mb-2.5">
                {toast.message}
              </p>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                <span className="text-purple-300/80 flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3 text-purple-400" /> {toast.date}
                </span>

                <button
                  onClick={() => {
                    dismissToast(toast.id);
                    if (toast.sessionId) onSelectTopicForReasoning(toast.sessionId);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-bold text-[11px] flex items-center gap-1 transition-colors"
                >
                  Inspect Math <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
