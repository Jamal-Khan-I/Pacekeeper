import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronDown, GraduationCap, Beaker, Calculator, Atom, Database, Sparkles } from 'lucide-react';
import { api } from '../services/api';

const SUBJECT_ICONS = {
  'Mathematics': Calculator,
  'Physics': Atom,
  'Chemistry': Beaker,
  'Biology': BookOpen,
};

const CLASS_GRADIENTS = {
  class_a: 'from-indigo-600 to-purple-600',
  class_b: 'from-emerald-600 to-teal-600',
  class_c: 'from-amber-500 to-orange-600',
};

const CLASS_ACTIVE_BORDERS = {
  class_a: 'border-indigo-500/60 shadow-indigo-500/20',
  class_b: 'border-emerald-500/60 shadow-emerald-500/20',
  class_c: 'border-amber-500/60 shadow-amber-500/20',
};

const CLASS_PILL_COLORS = {
  class_a: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  class_b: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  class_c: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const DEFAULT_CLASSES = [
  { class_id: 'class_a', label: 'Class 11-A', subject: 'Advanced Mathematics', description: 'Calculus, Algebra, Trigonometry & Vectors', color: '#6366f1' },
  { class_id: 'class_b', label: 'Class 12-B', subject: 'Physics', description: 'Thermodynamics, Electromagnetism, Quantum Mechanics & Optics', color: '#10b981' },
  { class_id: 'class_c', label: 'Class 10-C', subject: 'Chemistry', description: 'Organic Chemistry, Electrochemistry & Kinetics', color: '#f59e0b' },
];

export default function ClassSelector({ activeClassId, onClassChange, topicCounts = {} }) {
  const [classes, setClasses] = useState(DEFAULT_CLASSES);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    api.getClasses()
      .then(data => { if (data?.classes?.length) setClasses(data.classes); })
      .catch(() => {/* silently use defaults */});
  }, []);

  const activeClass = classes.find(c => c.class_id === activeClassId) || classes[0];
  const SubjectIcon = SUBJECT_ICONS[activeClass?.subject] || BookOpen;
  const gradient = CLASS_GRADIENTS[activeClassId] || CLASS_GRADIENTS.class_a;
  const activeBorder = CLASS_ACTIVE_BORDERS[activeClassId] || CLASS_ACTIVE_BORDERS.class_a;
  const pillColor = CLASS_PILL_COLORS[activeClassId] || CLASS_PILL_COLORS.class_a;

  return (
    <div className="mb-6 relative z-30">
      {/* Active Class Hero Banner */}
      <div className={`class-hero-card relative rounded-2xl border ${activeBorder} shadow-lg bg-slate-900/90 backdrop-blur-sm`}>
        
        {/* Gradient accent bar with matching rounded corners */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} rounded-t-2xl`} />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-4">
          
          {/* Class Info */}
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shrink-0`}>
              <SubjectIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="class-hero-title text-base font-extrabold text-white">{activeClass?.label}</h2>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${pillColor}`}>
                  {topicCounts[activeClassId] ?? 0} topics
                </span>
              </div>
              <p className={`text-sm font-semibold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                {activeClass?.subject}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{activeClass?.description}</p>
            </div>
          </div>

          {/* Class Selector Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsDropdownOpen(v => !v)}
              id="class-selector-btn"
              className={`class-selector-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border bg-slate-900 hover:bg-slate-800 transition-all shadow-md ${activeBorder}`}
            >
              <GraduationCap className="w-4 h-4 text-indigo-400" />
              <span className="font-extrabold">Switch Class</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <>
                {/* Full-screen click-outside Backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-black/20"
                  onClick={() => setIsDropdownOpen(false)}
                />
                
                {/* Floating Dropdown Menu (High Z-Index, Unclipped) */}
                <div className="class-dropdown-menu absolute right-0 top-full mt-2 z-50 w-80 bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden divide-y divide-slate-800/80 animate-banner">
                  <div className="px-4 py-3 bg-slate-950/80 flex items-center justify-between">
                    <p className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-wider">Select Class</p>
                    <span className="text-[10px] text-gray-500 font-semibold">3 classes available</span>
                  </div>
                  <div className="py-1">
                    {classes.map((cls) => {
                      const Icon = SUBJECT_ICONS[cls.subject] || BookOpen;
                      const isActive = cls.class_id === activeClassId;
                      const grad = CLASS_GRADIENTS[cls.class_id] || CLASS_GRADIENTS.class_a;
                      return (
                        <button
                          key={cls.class_id}
                          id={`class-option-${cls.class_id}`}
                          onClick={() => {
                            onClassChange(cls.class_id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 transition-all text-left hover:bg-slate-800/90 ${
                            isActive ? 'bg-indigo-950/40 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 shadow-md`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${isActive ? 'text-indigo-200' : 'text-white'}`}>
                                {cls.label}
                              </span>
                              {isActive && <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{cls.subject}</p>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 border ${
                            isActive
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                              : 'bg-slate-800 text-gray-400 border-slate-700'
                          }`}>
                            {topicCounts[cls.class_id] ?? 0} topics
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
