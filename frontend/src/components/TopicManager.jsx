import React, { useState } from 'react';
import { Plus, Trash2, Edit3, BookOpen, AlertCircle, CheckCircle, BarChart3, HelpCircle } from 'lucide-react';

export default function TopicManager({ topics, onCreateTopic, onUpdateTopic, onDeleteTopic, onSelectTopicForReasoning }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subject: 'Mathematics',
    exam_weightage: 20,
    difficulty: 3.0,
    estimated_hours: 6.0,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    onCreateTopic({
      name: formData.name,
      subject: formData.subject,
      exam_weightage: parseFloat(formData.exam_weightage),
      difficulty: parseFloat(formData.difficulty),
      estimated_hours: parseFloat(formData.estimated_hours),
      tags: [formData.subject.toLowerCase()]
    });

    setFormData({
      name: '',
      subject: 'Mathematics',
      exam_weightage: 20,
      difficulty: 3.0,
      estimated_hours: 6.0,
    });
    setShowForm(false);
  };

  const [formMode, setFormMode] = useState('single'); // 'single' or 'bulk'
  const [bulkTopicsText, setBulkTopicsText] = useState('');
  const [bulkSubject, setBulkSubject] = useState('Mathematics');
  const [bulkWeightage, setBulkWeightage] = useState(20);
  const [bulkDifficulty, setBulkDifficulty] = useState(3.0);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    const lines = bulkTopicsText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    setBulkSubmitting(true);
    try {
      for (const line of lines) {
        await onCreateTopic({
          name: line,
          subject: bulkSubject,
          exam_weightage: parseFloat(bulkWeightage) || 20,
          difficulty: parseFloat(bulkDifficulty) || 3.0,
          estimated_hours: 6.0,
          tags: [bulkSubject.toLowerCase()]
        });
      }
      setBulkTopicsText('');
      setShowForm(false);
    } catch (err) {
      alert(`Error creating topics: ${err.message}`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const parsedBulkTopicCount = bulkTopicsText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).length;

  return (
    <div className="glass-panel rounded-2xl p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            Syllabus Topics ({topics.length})
          </h3>
          <p className="text-xs text-gray-400">
            Define syllabus topics, exam weightages, and difficulty ratings manually or paste entire syllabus lists.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Close Form' : 'Add Topic'}
        </button>
      </div>

      {/* Add Topic Drawer / Form */}
      {showForm && (
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-4 mb-6 animate-banner space-y-4">
          
          {/* Mode Switcher */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-indigo-300">Choose Creation Method:</span>
            <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setFormMode('single')}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  formMode === 'single' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Single Topic
              </button>
              <button
                type="button"
                onClick={() => setFormMode('bulk')}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  formMode === 'bulk' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Paste Multiple Topics (Syllabus Drop)
              </button>
            </div>
          </div>

          {formMode === 'single' ? (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-300 mb-1">Topic Name</label>
                <input
                  type="text"
                  placeholder="e.g. Calculus Derivatives"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                >
                  <option value="Mathematics" className="bg-slate-900">Mathematics</option>
                  <option value="Physics" className="bg-slate-900">Physics</option>
                  <option value="Chemistry" className="bg-slate-900">Chemistry</option>
                  <option value="Biology" className="bg-slate-900">Biology</option>
                  <option value="Computer Science" className="bg-slate-900">Computer Science</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Exam Weightage (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.exam_weightage}
                  onChange={(e) => setFormData({ ...formData, exam_weightage: e.target.value })}
                  className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Difficulty (1 - 5)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="5"
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="lg:col-span-5 flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Save Topic
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Paste Topic Titles (one per line):
                </label>
                <textarea
                  rows={4}
                  value={bulkTopicsText}
                  onChange={(e) => setBulkTopicsText(e.target.value)}
                  placeholder={`Trigonometry & Trigonometric Identities\nCalculus Derivatives & Chain Rule\nLimits & Continuity\nLinear Algebra & Matrices`}
                  className="w-full glass-input px-3 py-2 rounded-lg text-xs font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Default Subject</label>
                  <select
                    value={bulkSubject}
                    onChange={(e) => setBulkSubject(e.target.value)}
                    className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                  >
                    <option value="Mathematics" className="bg-slate-900">Mathematics</option>
                    <option value="Physics" className="bg-slate-900">Physics</option>
                    <option value="Chemistry" className="bg-slate-900">Chemistry</option>
                    <option value="Biology" className="bg-slate-900">Biology</option>
                    <option value="Computer Science" className="bg-slate-900">Computer Science</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Default Weightage (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={bulkWeightage}
                    onChange={(e) => setBulkWeightage(e.target.value)}
                    className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Default Difficulty (1 - 5)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="5"
                    value={bulkDifficulty}
                    onChange={(e) => setBulkDifficulty(e.target.value)}
                    className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-xs text-gray-400">
                  {parsedBulkTopicCount > 0 ? `${parsedBulkTopicCount} topics ready to add` : 'Enter topic names above'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bulkSubmitting || parsedBulkTopicCount === 0}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white disabled:opacity-50"
                  >
                    {bulkSubmitting ? 'Adding Topics...' : `Add ${parsedBulkTopicCount || ''} Topics`}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Topics List Table */}
      {topics.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">
          No topics added yet. Click "Add Topic" above to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 uppercase font-semibold">
                <th className="py-3 px-3">Topic & Subject</th>
                <th className="py-3 px-3">Exam Weightage</th>
                <th className="py-3 px-3">Difficulty</th>
                <th className="py-3 px-3">Perf Score</th>
                <th className="py-3 px-3">Est / Rem Hours</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {topics.map((t) => {
                const perfPct = t.performance_score !== null ? Math.round(t.performance_score * 100) : null;

                return (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectTopicForReasoning(t.id)}
                          className="hover:text-indigo-300 font-bold"
                        >
                          {t.name}
                        </button>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-gray-400 border border-slate-700">
                          {t.subject}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-indigo-300 font-bold">
                      {t.exam_weightage}%
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
                        {t.difficulty} / 5.0
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {perfPct !== null ? (
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          perfPct >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          perfPct < 50 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {perfPct}%
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">Untested</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-gray-300">
                      {t.estimated_hours}h est • <strong className="text-indigo-400">{t.remaining_hours}h rem</strong>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`capitalize text-[11px] font-semibold px-2 py-0.5 rounded ${
                        t.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        t.status === 'needs_revision' ? 'bg-rose-500/20 text-rose-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectTopicForReasoning(t.id)}
                          className="p-1 rounded hover:bg-slate-700 text-indigo-400"
                          title="View Priority Reasoning"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteTopic(t.id)}
                          className="p-1 rounded hover:bg-slate-700 text-rose-400"
                          title="Delete Topic"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
