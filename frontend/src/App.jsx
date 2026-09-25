import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { useHardwareTier } from './hooks/useHardwareTier';
import Header from './components/Header';
import ExplanationBanner from './components/ExplanationBanner';
import ScheduleVisualizer from './components/ScheduleVisualizer';
import TopicManager from './components/TopicManager';
import CalendarControl from './components/CalendarControl';
import PerformanceModal from './components/PerformanceModal';
import PriorityReasoningModal from './components/PriorityReasoningModal';
import SettingsModal from './components/SettingsModal';
import ClassSelector from './components/ClassSelector';
import { Award, Sparkles, RefreshCw, Database, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function App() {
  const [activeTier, setActiveTier] = useState('free');
  const hardwareInfo = useHardwareTier();

  // Multi-class state (Part B)
  const [activeClassId, setActiveClassId] = useState('class_a');
  const [allTopics, setAllTopics] = useState({}); // { class_id: [topics] }

  const [calendarDays, setCalendarDays] = useState([]);
  const [scheduleData, setScheduleData] = useState(null);

  const [isPerfModalOpen, setIsPerfModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [reasoningTopicId, setReasoningTopicId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replanning, setReplanning] = useState(false);

  // Demo data seed state (Part C)
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  // Currently visible topics = topics for the active class
  const topics = allTopics[activeClassId] || [];

  const handleTierChange = (newTier) => {
    setActiveTier(newTier);
    api.updateSystemSettings({ active_tier: newTier }).catch(err => console.error(err));
  };

  // Load topics for ALL classes
  const loadAllTopics = async () => {
    const classIds = ['class_a', 'class_b', 'class_c'];
    const results = {};
    await Promise.all(classIds.map(async (cid) => {
      try {
        const t = await api.getTopics(cid);
        results[cid] = t;
      } catch {
        results[cid] = [];
      }
    }));
    setAllTopics(results);
    return results;
  };

  // Seed initial demo data if all classes are empty
  const maybeSeedInitialData = async (allTopicsMap) => {
    const totalTopics = Object.values(allTopicsMap).reduce((acc, arr) => acc + arr.length, 0);
    if (totalTopics === 0) {
      try {
        await api.seedDemoData();
        return await loadAllTopics();
      } catch {
        // Fall through to legacy single-class seed
        const demoTopics = [
          { name: 'Calculus Integration', subject: 'Mathematics', class_id: 'class_a', exam_weightage: 25.0, difficulty: 4.5, estimated_hours: 8.0, tags: ['math'] },
          { name: 'Quantum Physics', subject: 'Physics', class_id: 'class_b', exam_weightage: 20.0, difficulty: 5.0, estimated_hours: 6.0, tags: ['physics'] },
          { name: 'Organic Chemistry', subject: 'Chemistry', class_id: 'class_c', exam_weightage: 15.0, difficulty: 3.5, estimated_hours: 5.0, tags: ['chemistry'] },
        ];
        for (const t of demoTopics) {
          await api.createTopic(t);
        }
        return await loadAllTopics();
      }
    }
    return allTopicsMap;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let topicsMap = await loadAllTopics();
      topicsMap = await maybeSeedInitialData(topicsMap);
      setAllTopics(topicsMap);

      let currentCalendar = await api.getCalendar();
      if (currentCalendar.length === 0) {
        const today = new Date();
        const demoDays = Array.from({ length: 5 }, (_, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const dateVal = d.toISOString().split('T')[0];
          return {
            date_val: dateVal,
            is_holiday: i === 2,
            available_teaching_hours: i === 2 ? 0.0 : 3.0,
            available_revision_hours: i === 2 ? 0.0 : 1.5,
            note: i === 2 ? 'Mid-term Holiday' : null
          };
        });
        await api.saveCalendarBulk(demoDays);
        currentCalendar = await api.getCalendar();
      }
      setCalendarDays(currentCalendar);

      const schedule = await api.getCurrentSchedule(activeClassId);
      setScheduleData(schedule);
    } catch (err) {
      console.error('Error initializing app:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When class changes, ensure topics and schedule for that class are loaded
  const handleClassChange = useCallback(async (newClassId) => {
    setActiveClassId(newClassId);
    if (!allTopics[newClassId] || allTopics[newClassId].length === 0) {
      try {
        const t = await api.getTopics(newClassId);
        setAllTopics(prev => ({ ...prev, [newClassId]: t }));
      } catch { /* ignore */ }
    }
    try {
      const schedule = await api.getCurrentSchedule(newClassId);
      setScheduleData(schedule);
    } catch { /* ignore */ }
  }, [allTopics]);

  const handleSeedDemoData = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await api.seedDemoData();
      setSeedResult({ success: true, msg: `✓ Seeded ${result.topics_created} topics across ${result.classes_seeded?.length} classes.` });
      const newTopics = await loadAllTopics();
      setAllTopics(newTopics);
      const schedule = await api.generateSchedule(activeClassId);
      setScheduleData(schedule);
    } catch (err) {
      setSeedResult({ success: false, msg: `Seed failed: ${err.message}` });
    } finally {
      setSeeding(false);
      setTimeout(() => setSeedResult(null), 5000);
    }
  };

  const handleCreateTopic = async (topicData) => {
    try {
      await api.createTopic({ ...topicData, class_id: activeClassId });
      const t = await api.getTopics(activeClassId);
      setAllTopics(prev => ({ ...prev, [activeClassId]: t }));
    } catch (err) {
      alert(`Error creating topic: ${err.message}`);
    }
  };

  const handleUpdateTopic = async (id, topicData) => {
    try {
      await api.updateTopic(id, topicData);
      const t = await api.getTopics(activeClassId);
      setAllTopics(prev => ({ ...prev, [activeClassId]: t }));
    } catch (err) {
      alert(`Error updating topic: ${err.message}`);
    }
  };

  const handleDeleteTopic = async (id) => {
    try {
      await api.deleteTopic(id);
      const t = await api.getTopics(activeClassId);
      setAllTopics(prev => ({ ...prev, [activeClassId]: t }));
    } catch (err) {
      alert(`Error deleting topic: ${err.message}`);
    }
  };

  const handleSaveCalendar = async (days) => {
    try {
      await api.saveCalendarBulk(days);
      setCalendarDays(days);
      const updatedSchedule = await api.generateSchedule(activeClassId);
      setScheduleData(updatedSchedule);
    } catch (err) {
      alert(`Error saving calendar: ${err.message}`);
    }
  };

  const handleTriggerReplan = async () => {
    setReplanning(true);
    try {
      const schedule = await api.generateSchedule(activeClassId);
      setScheduleData(schedule);
    } catch (err) {
      alert(`Error regenerating schedule: ${err.message}`);
    } finally {
      setReplanning(false);
    }
  };

  const handleSubmitPerformance = async (perfData) => {
    setReplanning(true);
    try {
      const updatedSchedule = await api.submitPerformance(perfData);
      setScheduleData(updatedSchedule);
      const t = await api.getTopics(activeClassId);
      setAllTopics(prev => ({ ...prev, [activeClassId]: t }));
    } catch (err) {
      alert(`Error submitting score: ${err.message}`);
    } finally {
      setReplanning(false);
    }
  };

  // Topic counts across all classes for ClassSelector badge
  const topicCounts = Object.fromEntries(
    Object.entries(allTopics).map(([cid, arr]) => [cid, arr.length])
  );

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col selection:bg-indigo-500 selection:text-white pb-12">

      {/* Header */}
      <Header
        activeTier={activeTier}
        setActiveTier={handleTierChange}
        hardwareInfo={hardwareInfo}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-6 flex-1 w-full">

        {/* Class Selector (Part B) */}
        {!loading && (
          <ClassSelector
            activeClassId={activeClassId}
            onClassChange={handleClassChange}
            topicCounts={topicCounts}
          />
        )}

        {/* Floating Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Lesson Plan & Performance Dashboard
              {replanning && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />}
            </h2>
            <p className="text-xs text-gray-400">
              Schedule recomputes automatically when scores or calendar changes.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Seed Demo Data Button (Part C) */}
            <button
              onClick={handleSeedDemoData}
              disabled={seeding}
              id="seed-demo-btn"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-amber-900/50 hover:bg-amber-900/80 text-amber-200 border border-amber-500/30 transition-all"
            >
              <Database className={`w-3.5 h-3.5 ${seeding ? 'animate-pulse' : ''}`} />
              {seeding ? 'Seeding...' : 'Seed Demo Data'}
            </button>

            <button
              onClick={() => setIsPerfModalOpen(true)}
              id="enter-scores-btn"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-xl shadow-pink-500/20 transition-all transform hover:scale-[1.02]"
            >
              <Award className="w-4 h-4 text-pink-200" />
              {activeTier === 'free' ? 'Enter Test Scores' : 'Scan / Enter Scores'}
            </button>

            <button
              onClick={handleTriggerReplan}
              disabled={replanning}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-gray-300 border border-slate-700 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${replanning ? 'animate-spin' : ''}`} />
              Re-calculate
            </button>
          </div>
        </div>

        {/* Seed Result Toast */}
        {seedResult && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold animate-banner border ${
            seedResult.success
              ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-900/30 border-rose-500/40 text-rose-300'
          }`}>
            {seedResult.success
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {seedResult.msg}
          </div>
        )}

        {loading ? (
          <div className="glass-panel rounded-2xl p-12 text-center text-gray-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 text-indigo-400 animate-spin" />
            <p className="text-sm font-semibold">Initializing Pacekeeper Dashboard & Engine...</p>
          </div>
        ) : (
          <>
            {/* Explanation Banner */}
            <ExplanationBanner scheduleData={scheduleData} />

            {/* Schedule Visualizer */}
            <ScheduleVisualizer
              scheduleData={scheduleData}
              onSelectTopicForReasoning={(topicId) => setReasoningTopicId(topicId)}
            />

            {/* Calendar & Disruption Control */}
            <CalendarControl
              calendarDays={calendarDays}
              onSaveCalendar={handleSaveCalendar}
              onTriggerReplan={handleTriggerReplan}
            />

            {/* Topic Management — scoped to active class */}
            <TopicManager
              topics={topics}
              onCreateTopic={handleCreateTopic}
              onUpdateTopic={handleUpdateTopic}
              onDeleteTopic={handleDeleteTopic}
              onSelectTopicForReasoning={(topicId) => setReasoningTopicId(topicId)}
            />
          </>
        )}

      </main>

      {/* Performance Score Input Modal */}
      <PerformanceModal
        isOpen={isPerfModalOpen}
        onClose={() => setIsPerfModalOpen(false)}
        topics={topics}
        onSubmitPerformance={handleSubmitPerformance}
        activeClassId={activeClassId}
        activeTier={activeTier}
      />

      {/* Priority Scoring Math Reasoning Modal */}
      <PriorityReasoningModal
        topicId={reasoningTopicId}
        topics={topics}
        scheduleData={scheduleData}
        onClose={() => setReasoningTopicId(null)}
      />

      {/* Cloud Tier Settings & API Key Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSettingsSaved={() => loadData()}
      />

    </div>
  );
}
