import React from 'react';
import { Calendar as CalendarIcon, Sun, AlertTriangle, Save, Clock } from 'lucide-react';

export default function CalendarControl({ calendarDays, onSaveCalendar, onTriggerReplan }) {
  if (!calendarDays || calendarDays.length === 0) {
    return null;
  }

  const handleToggleHoliday = (dateVal) => {
    const updated = calendarDays.map(d => {
      if (d.date_val === dateVal) {
        const isH = !d.is_holiday;
        return {
          ...d,
          is_holiday: isH,
          available_teaching_hours: isH ? 0.0 : 3.0,
          available_revision_hours: isH ? 0.0 : 1.5,
          note: isH ? 'Holiday / Disruption' : null
        };
      }
      return d;
    });
    onSaveCalendar(updated);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-400" />
            Calendar & Disruption Controls
          </h3>
          <p className="text-xs text-gray-400">
            Click any day to toggle a holiday or cancelled period — watch the algorithm instantly re-allocate remaining teaching hours.
          </p>
        </div>

        <button
          onClick={onTriggerReplan}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          Re-calculate Schedule
        </button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {calendarDays.map((d) => {
          const dateObj = new Date(d.date_val);
          const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

          return (
            <div
              key={d.date_val}
              onClick={() => handleToggleHoliday(d.date_val)}
              className={`calendar-day-card p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                d.is_holiday
                  ? 'calendar-day-holiday bg-rose-950/40 border-rose-500/50 hover:bg-rose-900/50'
                  : 'calendar-day-active bg-slate-900/60 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-200">{dateStr}</span>
                {d.is_holiday ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                    <AlertTriangle className="w-3 h-3" /> Holiday
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                    Active
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-400" />
                  Teaching:
                </span>
                <span className={`font-bold ${d.is_holiday ? 'text-gray-500 line-through' : 'text-indigo-300'}`}>
                  {d.available_teaching_hours}h
                </span>
              </div>

              <div className="text-xs text-gray-400 flex items-center justify-between mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-purple-400" />
                  Revision:
                </span>
                <span className={`font-bold ${d.is_holiday ? 'text-gray-500 line-through' : 'text-purple-300'}`}>
                  {d.available_revision_hours}h
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
