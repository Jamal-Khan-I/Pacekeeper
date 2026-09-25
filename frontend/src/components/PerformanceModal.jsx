import React, { useState, useRef, useEffect } from 'react';
import { 
  Award, X, Sparkles, Upload, CheckCircle2, AlertTriangle, Camera, 
  Terminal, Image, Folder, Database, ChevronDown, ChevronUp, 
  FileSpreadsheet, Plus, FileText, Check, Layers, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function PerformanceModal({ 
  isOpen, 
  onClose, 
  topics, 
  onSubmitPerformance, 
  onSubmitBatchPerformance,
  onCreateTopic,
  activeClassId, 
  activeTier = 'free' 
}) {
  // Determine whether AI capabilities are active
  const isAITier = activeTier === 'local' || activeTier === 'cloud';

  // Active sub-tab
  const [activeTab, setActiveTab] = useState(isAITier ? 'scan' : 'manual');

  // Single Manual Entry State
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [scoreMode, setScoreMode] = useState('raw'); // 'raw' (obtained/max) or 'slider' (%)
  const [rawMarksObtained, setRawMarksObtained] = useState(18);
  const [rawMaxMarks, setRawMaxMarks] = useState(25);
  const [scorePercentage, setScorePercentage] = useState(72);
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Optional Advanced Details
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [mcqMarks, setMcqMarks] = useState('');
  const [subjectiveMarks, setSubjectiveMarks] = useState('');
  const [diagnosticNote, setDiagnosticNote] = useState('');

  // Inline Quick Add Topic
  const [showQuickAddTopic, setShowQuickAddTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicSubject, setNewTopicSubject] = useState('Mathematics');
  const [newTopicWeightage, setNewTopicWeightage] = useState(20);
  const [newTopicDifficulty, setNewTopicDifficulty] = useState(3.0);
  const [creatingTopic, setCreatingTopic] = useState(false);

  // Bulk / Drop CSV State
  const [bulkText, setBulkText] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);

  // Vision scan state (AI tiers only)
  const [scanFile, setScanFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [providerUsed, setProviderUsed] = useState(null);

  // Live Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Demo images state
  const [demoImages, setDemoImages] = useState([]);
  const [showDemoPanel, setShowDemoPanel] = useState(false);

  // Pipeline logs (client-side)
  const [pipelineLogs, setPipelineLogs] = useState([]);

  // Live vs Demo records audit view
  const [recentRecords, setRecentRecords] = useState([]);
  const [showRecordsLog, setShowRecordsLog] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);

  const fetchRecords = async () => {
    try {
      const recs = await api.getPerformanceRecords(activeClassId);
      setRecentRecords(recs || []);
    } catch {
      setRecentRecords([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
      setActiveTab(isAITier ? 'scan' : 'manual');
    }
  }, [isOpen, activeClassId, isAITier]);

  // Keep scorePercentage synced when in raw marks mode
  useEffect(() => {
    if (scoreMode === 'raw') {
      const obtained = parseFloat(rawMarksObtained) || 0;
      const max = parseFloat(rawMaxMarks) || 1;
      const pct = Math.round(Math.min(100, Math.max(0, (obtained / max) * 100)));
      setScorePercentage(pct);
    }
  }, [rawMarksObtained, rawMaxMarks, scoreMode]);

  if (!isOpen) return null;

  const topicIdToUse = selectedTopicId || (topics[0]?.id ?? '');

  const addLog = (type, msg) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setPipelineLogs(prev => [{ ts, type, msg }, ...prev].slice(0, 20));
  };

  // --- CAMERA & AI VISION HELPERS ---
  const startCamera = async () => {
    setIsCameraActive(true);
    setDiagnosisResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert(`Camera Access Error: ${err.message || 'Could not access webcam'}`);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhotoAndScan = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg');
    stopCamera();
    await analyzeImageBase64(base64Image, 'camera capture', null, 'live');
  };

  const analyzeImageBase64 = async (base64Str, sourceDescription = 'upload', filename = null, sourceTag = 'live') => {
    setScanning(true);
    setDiagnosisResult(null);

    const topicObj = topics.find(t => t.id === topicIdToUse);
    addLog('info', `[${new Date().toLocaleTimeString()}] Starting scan | Source: ${sourceDescription} (tag: ${sourceTag}) | Topic hint: "${topicObj?.name || 'auto'}" | Class: ${activeClassId}`);

    try {
      const formData = new FormData();
      formData.append('image_base64', base64Str);
      formData.append('source', sourceTag);
      if (filename) formData.append('filename', filename);
      if (topicObj) formData.append('topic_hint', topicObj.name);
      if (activeClassId) formData.append('class_id', activeClassId);

      const res = await fetch('/api/agents/analyze-answer-sheet', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errJson.detail || errJson.message || `Server returned HTTP ${res.status}`);
      }
      const data = await res.json();

      if (data.diagnosis) {
        setDiagnosisResult(data.diagnosis);
        setProviderUsed(data.provider_used);
        setScorePercentage(Math.round(data.diagnosis.overall_score * 100));

        const isPipelineErr = data.diagnosis.diagnostic_summary?.includes('AI pipeline') ||
          data.diagnosis.diagnostic_summary?.includes('Ollama') ||
          data.diagnosis.diagnostic_summary?.includes('pipeline failed');

        if (isPipelineErr) {
          addLog('error', `[AI Pipeline] FALLBACK FIRED ✗ | ${data.diagnosis.diagnostic_summary?.slice(0, 150)}`);
        } else {
          addLog('success', `[AI Pipeline] REAL RESPONSE ✓ | Provider: ${data.provider_used} | Tag: ${data.source} | Topic: "${data.diagnosis.detected_topic}" | Score: ${Math.round(data.diagnosis.overall_score * 100)}%`);
        }
        await fetchRecords();
      }
    } catch (err) {
      addLog('error', `Scan error: ${err.message}`);
      alert(`Answer sheet scan error: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleFileScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanFile(file);
    setScanning(true);
    setDiagnosisResult(null);

    const topicObj = topics.find(t => t.id === topicIdToUse);
    addLog('info', `File upload: ${file.name} | size=${(file.size/1024).toFixed(1)}KB | source: live`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);
      formData.append('source', 'live');
      if (topicObj) formData.append('topic_hint', topicObj.name);
      if (activeClassId) formData.append('class_id', activeClassId);

      const res = await fetch('/api/agents/analyze-answer-sheet', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errJson.detail || errJson.message || `Server returned HTTP ${res.status}`);
      }
      const data = await res.json();

      if (data.diagnosis) {
        setDiagnosisResult(data.diagnosis);
        setProviderUsed(data.provider_used);
        setScorePercentage(Math.round(data.diagnosis.overall_score * 100));

        const isPipelineErr = data.diagnosis.diagnostic_summary?.includes('AI pipeline') ||
          data.diagnosis.diagnostic_summary?.includes('Ollama') ||
          data.diagnosis.diagnostic_summary?.includes('pipeline failed');

        if (isPipelineErr) {
          addLog('error', `[AI Pipeline] FALLBACK FIRED ✗ | Provider: ${data.provider_used} | ${data.diagnosis.diagnostic_summary?.slice(0, 120)}`);
        } else {
          addLog('success', `[AI Pipeline] REAL RESPONSE ✓ | Provider: ${data.provider_used} | Saved to: ${data.image_path || 'uploads/live'} | Topic: "${data.diagnosis.detected_topic}" | Score: ${Math.round(data.diagnosis.overall_score * 100)}%`);
        }
        await fetchRecords();
      }
    } catch (err) {
      addLog('error', `Scan error: ${err.message}`);
      alert(`Answer sheet scan error: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const loadDemoImages = async () => {
    if (!activeClassId) return;
    try {
      const data = await api.getDemoImages(activeClassId);
      setDemoImages(data.images || []);
      setShowDemoPanel(true);
    } catch {
      setDemoImages([]);
      setShowDemoPanel(true);
    }
  };

  const scanDemoImage = async (filename) => {
    setShowDemoPanel(false);
    addLog('info', `Loading demo image: ${filename} (source: demo)`);
    try {
      const res = await fetch(`/demo/${filename}`);
      if (!res.ok) throw new Error(`Demo image not found at /demo/${filename}`);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        await analyzeImageBase64(reader.result, `demo: ${filename}`, filename, 'demo');
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      addLog('error', `Could not load demo image: ${err.message}`);
      alert(`Demo image load failed: ${err.message}`);
    }
  };

  // --- QUICK INLINE TOPIC CREATION ---
  const handleQuickAddTopic = async (e) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    setCreatingTopic(true);
    try {
      if (onCreateTopic) {
        await onCreateTopic({
          name: newTopicName.trim(),
          subject: newTopicSubject,
          exam_weightage: parseFloat(newTopicWeightage) || 20,
          difficulty: parseFloat(newTopicDifficulty) || 3.0,
          estimated_hours: 6.0,
          tags: [newTopicSubject.toLowerCase()]
        });
      } else {
        await api.createTopic({
          name: newTopicName.trim(),
          subject: newTopicSubject,
          exam_weightage: parseFloat(newTopicWeightage) || 20,
          difficulty: parseFloat(newTopicDifficulty) || 3.0,
          estimated_hours: 6.0,
          tags: [newTopicSubject.toLowerCase()],
          class_id: activeClassId
        });
      }
      setNewTopicName('');
      setShowQuickAddTopic(false);
    } catch (err) {
      alert(`Failed to create topic: ${err.message}`);
    } finally {
      setCreatingTopic(false);
    }
  };

  // --- SINGLE MANUAL SUBMIT ---
  const handleSubmitSingle = async (e) => {
    e.preventDefault();
    if (!topicIdToUse) return;

    setSubmitting(true);
    try {
      const normalizedScore = scorePercentage / 100.0;
      const questionBreakdown = {};
      
      if (mcqMarks) {
        questionBreakdown.mcq = parseFloat(mcqMarks);
      }
      if (subjectiveMarks) {
        questionBreakdown.subjective = parseFloat(subjectiveMarks);
      }
      if (studentName) {
        questionBreakdown.student = studentName;
      }
      if (diagnosticNote) {
        questionBreakdown.note = diagnosticNote;
      }

      await onSubmitPerformance({
        topic_id: topicIdToUse,
        score: normalizedScore,
        test_date: testDate,
        max_score: scoreMode === 'raw' ? parseFloat(rawMaxMarks) || 100 : 100,
        raw_score: scoreMode === 'raw' ? parseFloat(rawMarksObtained) || scorePercentage : scorePercentage,
        source: 'live',
        question_breakdown: Object.keys(questionBreakdown).length > 0 
          ? questionBreakdown 
          : { mcq: Math.min(1.0, normalizedScore + 0.1), subjective: Math.max(0.0, normalizedScore - 0.1) }
      });
      await fetchRecords();
      onClose();
    } catch (err) {
      alert(`Error submitting score: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // --- BULK / CSV PARSING LOGIC ---
  const parseBulkInput = (text) => {
    if (!text || !text.trim()) return [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip commented lines or headers
      if (line.startsWith('#') || (i === 0 && line.toLowerCase().includes('topic') && (line.toLowerCase().includes('mark') || line.toLowerCase().includes('score')))) {
        continue;
      }

      // Detect separator: tab, comma, or semicolon
      let delimiter = ',';
      if (line.includes('\t')) delimiter = '\t';
      else if (line.includes(';')) delimiter = ';';

      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) continue;

      const topicName = parts[0];
      let rawScore = 0;
      let maxScore = 100;

      // Handle "18/25", "85%", or "18"
      const scoreStr = parts[1];
      if (scoreStr.includes('/')) {
        const [s, m] = scoreStr.split('/').map(Number);
        rawScore = isNaN(s) ? 0 : s;
        maxScore = isNaN(m) || m === 0 ? 100 : m;
      } else if (scoreStr.includes('%')) {
        rawScore = parseFloat(scoreStr.replace('%', '')) || 0;
        maxScore = 100;
      } else {
        rawScore = parseFloat(scoreStr) || 0;
        if (parts[2]) {
          const m = parseFloat(parts[2]);
          if (!isNaN(m) && m > 0) maxScore = m;
        }
      }

      // Check for date in 3rd or 4th position
      let dateStr = new Date().toISOString().split('T')[0];
      if (parts.length >= 4 && /^\d{4}-\d{2}-\d{2}$/.test(parts[3])) {
        dateStr = parts[3];
      } else if (parts.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[2])) {
        dateStr = parts[2];
      }

      const pct = Math.round(Math.min(100, Math.max(0, (rawScore / maxScore) * 100)));

      // Fuzzy match topic name with existing syllabus topics
      const matched = topics.find(t => 
        t.name.toLowerCase().trim() === topicName.toLowerCase().trim() ||
        t.name.toLowerCase().includes(topicName.toLowerCase()) ||
        topicName.toLowerCase().includes(t.name.toLowerCase())
      );

      rows.push({
        id: `bulk-${i}`,
        topicName,
        matchedTopic: matched || null,
        rawScore,
        maxScore,
        percentage: pct,
        date: dateStr,
        isNew: !matched
      });
    }

    return rows;
  };

  const parsedBulkRows = parseBulkInput(bulkText);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setBulkText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleLoadSampleCSV = () => {
    const sample = `Topic Name, Marks Obtained, Max Marks, Date
Trigonometry & Trigonometric Identities, 34, 40, ${new Date().toISOString().split('T')[0]}
Calculus Derivatives & Chain Rule, 18, 25, ${new Date().toISOString().split('T')[0]}
Limits & Continuity, 19, 20, ${new Date().toISOString().split('T')[0]}`;
    setBulkText(sample);
  };

  const handleSubmitBulk = async () => {
    if (parsedBulkRows.length === 0) return;
    setBulkImporting(true);

    try {
      const recordsToSubmit = [];

      for (const row of parsedBulkRows) {
        let topicId = row.matchedTopic?.id;

        // If topic doesn't exist, create it on the fly
        if (!topicId) {
          const newTopic = await api.createTopic({
            name: row.topicName,
            subject: 'Mathematics',
            exam_weightage: 20,
            difficulty: 3.0,
            estimated_hours: 6.0,
            tags: ['mathematics'],
            class_id: activeClassId
          });
          topicId = newTopic.id;
        }

        recordsToSubmit.push({
          topic_id: topicId,
          score: row.percentage / 100.0,
          test_date: row.date,
          max_score: row.maxScore,
          raw_score: row.rawScore,
          source: 'live',
          question_breakdown: {
            mcq: Math.min(1.0, (row.percentage / 100) + 0.1),
            subjective: Math.max(0.0, (row.percentage / 100) - 0.1)
          }
        });
      }

      if (onSubmitBatchPerformance) {
        await onSubmitBatchPerformance(recordsToSubmit);
      } else {
        for (const rec of recordsToSubmit) {
          await onSubmitPerformance(rec);
        }
      }

      await fetchRecords();
      onClose();
    } catch (err) {
      alert(`Bulk score import error: ${err.message}`);
    } finally {
      setBulkImporting(false);
    }
  };

  // --- RESET HANDLERS ---
  const handleResetLive = async () => {
    try {
      const res = await api.resetLiveRecords();
      setResetMessage(res.message);
      await fetchRecords();
      setTimeout(() => setResetMessage(null), 4000);
    } catch (err) {
      alert(`Failed to reset live records: ${err.message}`);
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await api.resetDemoRecords();
      setResetMessage(res.message);
      await fetchRecords();
      setTimeout(() => setResetMessage(null), 4000);
    } catch (err) {
      alert(`Failed to reset demo records: ${err.message}`);
    }
  };

  const isPipelineError = diagnosisResult?.diagnostic_summary?.includes('AI pipeline') ||
    diagnosisResult?.diagnostic_summary?.includes('Ollama') ||
    diagnosisResult?.diagnostic_summary?.includes('pipeline failed');

  const liveCount = recentRecords.filter(r => r.source === 'live').length;
  const demoCount = recentRecords.filter(r => r.source === 'demo').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-banner">
      <div className="glass-panel border-indigo-500/40 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">

        {/* Close Button */}
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">
                {isAITier ? 'Enter Scores / Scan Answer Sheet' : 'Manual Test Scores & Marks Drop'}
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                activeTier === 'free' 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
              }`}>
                {activeTier === 'free' ? 'Free Tier (Zero Latency)' : activeTier.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {activeTier === 'free'
                ? 'Drop raw marks or upload a CSV gradebook to automatically recompute your spaced revision roadmap.'
                : 'Upload exam sheet photos, live capture, or manually drop marks.'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800 mb-5">
          {isAITier && (
            <button
              onClick={() => { stopCamera(); setActiveTab('scan'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'scan'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Vision Scan</span>
            </button>
          )}

          <button
            onClick={() => { stopCamera(); setActiveTab('manual'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'manual'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Single Topic Entry</span>
          </button>

          <button
            onClick={() => { stopCamera(); setActiveTab('bulk'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'bulk'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Drop Marks / CSV</span>
            {parsedBulkRows.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-400/20 text-cyan-200 text-[10px]">
                {parsedBulkRows.length}
              </span>
            )}
          </button>
        </div>

        {/* ================= TAB 1: AI VISION SCAN (AI TIERS ONLY) ================= */}
        {isAITier && activeTab === 'scan' && (
          <div className="space-y-4 animate-banner">
            {isCameraActive ? (
              <div className="bg-slate-950 rounded-xl p-3 border border-indigo-500/40 text-center">
                <div className="relative rounded-lg overflow-hidden bg-black mb-3">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover rounded-lg" />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={capturePhotoAndScan}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition"
                  >
                    <Camera className="w-4 h-4" />
                    Snap Photo & Scan (Live)
                  </button>
                  <button type="button" onClick={stopCamera} className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white">
                    Cancel Camera
                  </button>
                </div>
              </div>
            ) : (
              /* Scan Box */
              <div className="bg-slate-900/90 border border-dashed border-indigo-500/40 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-300">Scan Student Answer Sheet — AI Vision Diagnosis</span>
                </div>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <input type="file" accept="image/*" onChange={handleFileScan} className="hidden" id="answer-sheet-upload" />
                  <label
                    htmlFor="answer-sheet-upload"
                    className="flex items-center gap-1.5 cursor-pointer text-xs px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-semibold transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    {scanning ? 'Scanning...' : 'Upload File (Live)'}
                  </label>

                  <span className="text-xs text-gray-500 font-bold">OR</span>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 font-semibold transition-all"
                  >
                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                    Live Camera
                  </button>

                  <span className="text-xs text-gray-500 font-bold">OR</span>

                  <button
                    type="button"
                    onClick={loadDemoImages}
                    className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 border border-amber-500/30 font-semibold transition-all"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    Demo Dataset
                  </button>
                </div>
              </div>
            )}

            {/* Demo Image Picker Panel */}
            {showDemoPanel && (
              <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3 animate-banner">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5" />
                    Sample Answer Sheets — {activeClassId?.replace('_', ' ').toUpperCase()} (source: demo)
                  </span>
                  <button onClick={() => setShowDemoPanel(false)} className="text-gray-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {demoImages.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">
                    No demo images found. Run "Seed Demo Data" from the main dashboard first.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {demoImages.map((img) => (
                      <button
                        key={img.filename}
                        onClick={() => scanDemoImage(img.filename)}
                        disabled={!img.exists}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs ${
                          img.exists
                            ? 'bg-slate-800/80 hover:bg-slate-800 text-gray-200 hover:text-white'
                            : 'bg-slate-900/50 text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${img.exists ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                        <span className="font-mono truncate">{img.filename}</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">DEMO</span>
                        {!img.exists && <span className="text-rose-400 shrink-0">(missing)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Vision Diagnosis Result */}
            {diagnosisResult && (
              <div className={`p-3.5 rounded-xl border text-xs space-y-2 animate-banner ${
                isPipelineError
                  ? 'bg-rose-950/30 border-rose-500/40'
                  : 'bg-purple-950/40 border-purple-500/40'
              }`}>
                <div className="font-bold flex items-center justify-between">
                  <span className={isPipelineError ? 'text-rose-300' : 'text-purple-300'}>
                    {isPipelineError ? '⚠ AI Pipeline Error' : '✓ Answer Sheet Diagnosis'}
                  </span>
                  {!isPipelineError && (
                    <span className="text-emerald-400 font-extrabold">{Math.round(diagnosisResult.overall_score * 100)}% Score</span>
                  )}
                </div>

                {providerUsed && !isPipelineError && (
                  <div className="text-[11px] text-gray-400">
                    Provider: <span className="text-indigo-300 font-semibold">{providerUsed}</span> |
                    Topic: <span className="text-purple-300 font-semibold">{diagnosisResult.detected_topic}</span> |
                    Fallback Fired: <span className="text-emerald-400 font-bold">False ✓</span>
                  </div>
                )}

                <p className={`italic ${isPipelineError ? 'text-rose-300' : 'text-gray-300'}`}>
                  {diagnosisResult.diagnostic_summary}
                </p>

                {!isPipelineError && diagnosisResult.weak_question_types?.length > 0 && (
                  <div className="pt-1 text-[11px] font-semibold text-rose-300">
                    Weak Types: {diagnosisResult.weak_question_types.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Pipeline Logs */}
            {pipelineLogs.length > 0 && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono max-h-32 overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase">AI Pipeline Logs</span>
                </div>
                {pipelineLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-gray-600 shrink-0 w-20">{log.ts}</span>
                    <span className={`${
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'error' ? 'text-rose-400' :
                      'text-blue-400'
                    } break-all leading-relaxed`}>{log.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: MANUAL SCORE ENTRY ================= */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSubmitSingle} className="space-y-4 animate-banner">
            
            {/* Topic Selection + Quick Add Topic Button */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-300">Select Syllabus Topic</label>
                <button
                  type="button"
                  onClick={() => setShowQuickAddTopic(!showQuickAddTopic)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  <Plus className="w-3 h-3" />
                  <span>{showQuickAddTopic ? 'Hide Topic Creator' : '+ Quick Add Topic'}</span>
                </button>
              </div>

              {/* Inline Quick Add Topic Form */}
              {showQuickAddTopic && (
                <div className="mb-3 p-3 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-2 animate-banner">
                  <span className="text-[11px] font-bold text-indigo-300 block">Add New Topic to Syllabus</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        placeholder="Topic Name (e.g. Vectors & Matrices)"
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                        className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <select
                        value={newTopicSubject}
                        onChange={(e) => setNewTopicSubject(e.target.value)}
                        className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                      >
                        <option value="Mathematics" className="bg-slate-900">Mathematics</option>
                        <option value="Physics" className="bg-slate-900">Physics</option>
                        <option value="Chemistry" className="bg-slate-900">Chemistry</option>
                        <option value="Biology" className="bg-slate-900">Biology</option>
                        <option value="Computer Science" className="bg-slate-900">Computer Science</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddTopic(false)}
                      className="px-2.5 py-1 text-xs text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={creatingTopic || !newTopicName.trim()}
                      onClick={handleQuickAddTopic}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                    >
                      {creatingTopic ? 'Creating...' : 'Create Topic'}
                    </button>
                  </div>
                </div>
              )}

              <select
                value={topicIdToUse}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm font-semibold"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                    {t.name} ({t.subject}) — {t.performance_score !== null ? `${Math.round(t.performance_score * 100)}%` : 'Untested'}
                  </option>
                ))}
              </select>
            </div>

            {/* Score Input Mode (Raw Marks vs Slider) */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-300">Scoring Format</span>
                <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setScoreMode('raw')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      scoreMode === 'raw' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Raw Marks (e.g. 18 / 25)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoreMode('slider')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      scoreMode === 'slider' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Percentage Slider
                  </button>
                </div>
              </div>

              {scoreMode === 'raw' ? (
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Marks Obtained</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={rawMarksObtained}
                      onChange={(e) => setRawMarksObtained(e.target.value)}
                      className="w-full glass-input px-3 py-2 rounded-xl text-sm font-bold text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Max / Total Marks</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={rawMaxMarks}
                      onChange={(e) => setRawMaxMarks(e.target.value)}
                      className="w-full glass-input px-3 py-2 rounded-xl text-sm font-bold text-white"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={scorePercentage}
                    onChange={(e) => setScorePercentage(Number(e.target.value))}
                    className="w-full accent-pink-500 h-2 bg-slate-800 rounded-lg cursor-pointer my-2"
                  />
                </div>
              )}

              {/* Calculated Percentage Badge */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-gray-400">Calculated Mastery:</span>
                <span className={`text-base font-extrabold px-3 py-0.5 rounded-lg ${
                  scorePercentage >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  scorePercentage < 50 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                  'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {scorePercentage}% {scorePercentage < 50 ? '• Needs Revision' : scorePercentage >= 80 ? '• Mastered' : '• In Progress'}
                </span>
              </div>
            </div>

            {/* Test Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Test Date</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full glass-input px-3.5 py-2 rounded-xl text-xs"
                required
              />
            </div>

            {/* Optional Advanced Details Toggle */}
            <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/50">
              <button
                type="button"
                onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-gray-300 flex items-center justify-between hover:bg-slate-800/50 transition"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Optional Exam Details (Student Name, Question Types, Notes)</span>
                </div>
                {showOptionalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showOptionalDetails && (
                <div className="p-3.5 space-y-3 border-t border-slate-800/80 bg-slate-950/50 animate-banner">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Student Name / Roll Number (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Alex Mercer (Roll #14)"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">MCQ / Section A Score (Optional)</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="e.g. 8"
                        value={mcqMarks}
                        onChange={(e) => setMcqMarks(e.target.value)}
                        className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Subjective / Section B Score (Optional)</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="e.g. 10"
                        value={subjectiveMarks}
                        onChange={(e) => setSubjectiveMarks(e.target.value)}
                        className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Teacher Diagnostic Note / Weak Concept (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Struggled with chain rule application on trigonometric terms"
                      value={diagnosticNote}
                      onChange={(e) => setDiagnosticNote(e.target.value)}
                      className="w-full glass-input px-3 py-1.5 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRecordsLog(!showRecordsLog)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
              >
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>Records ({liveCount} Live, {demoCount} Demo)</span>
                {showRecordsLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { stopCamera(); onClose(); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-xl shadow-pink-500/25 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? 'Re-planning Schedule...' : 'Save Score & Auto-Replan'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ================= TAB 3: DROP / PASTE MARKS & TOPICS (BULK CSV) ================= */}
        {activeTab === 'bulk' && (
          <div className="space-y-4 animate-banner">
            
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={handleFileDrop}
              className={`p-5 rounded-2xl border-2 border-dashed text-center transition-all ${
                isDraggingFile
                  ? 'border-cyan-400 bg-cyan-950/30'
                  : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
              }`}
            >
              <FileSpreadsheet className="w-8 h-8 text-cyan-400 mx-auto mb-2 animate-bounce" />
              <p className="text-xs font-bold text-gray-200 mb-1">
                Drag & Drop Gradebook CSV / Spreadsheet or Paste Below
              </p>
              <p className="text-[11px] text-gray-400 mb-3">
                Format: <code className="text-cyan-300">Topic Name, Marks Obtained, Max Marks, Date (optional)</code>
              </p>

              <div className="flex items-center justify-center gap-3">
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileDrop}
                  className="hidden"
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700 transition"
                >
                  Choose File (.csv, .txt)
                </label>
                <button
                  type="button"
                  onClick={handleLoadSampleCSV}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 transition"
                >
                  Load Sample Template
                </button>
              </div>
            </div>

            {/* Paste Textarea */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Paste CSV or Excel Rows:
              </label>
              <textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`Trigonometry & Trigonometric Identities, 34, 40\nCalculus Derivatives & Chain Rule, 18, 25\nLimits & Continuity, 19, 20`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs font-mono"
              />
            </div>

            {/* Parsed Rows Preview */}
            {parsedBulkRows.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-200">
                    Parsed {parsedBulkRows.length} Test Record{parsedBulkRows.length > 1 ? 's' : ''}:
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {parsedBulkRows.filter(r => r.isNew).length > 0 && (
                      <span className="text-amber-400 font-semibold">
                        ({parsedBulkRows.filter(r => r.isNew).length} new topic will be auto-created)
                      </span>
                    )}
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {parsedBulkRows.map((r, i) => (
                    <div
                      key={r.id || i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-semibold text-gray-200 truncate">{r.topicName}</span>
                        {r.isNew ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold shrink-0">
                            + Auto Create
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0">
                            Matched
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-gray-300">
                          {r.rawScore} / {r.maxScore}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          r.percentage >= 80 ? 'bg-emerald-500/20 text-emerald-300' :
                          r.percentage < 50 ? 'bg-rose-500/20 text-rose-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {r.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bulk Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBulkText('')}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Clear
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkImporting || parsedBulkRows.length === 0}
                  onClick={handleSubmitBulk}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-xl shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {bulkImporting 
                    ? 'Importing & Replanning...' 
                    : `Import ${parsedBulkRows.length} Scores & Auto-Replan`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset status banner */}
        {resetMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{resetMessage}</span>
          </div>
        )}

        {/* Collapsible Performance Log (Live vs Demo Separation Audit) */}
        {showRecordsLog && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 animate-banner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-300">
                Score History — {activeClassId?.replace('_', ' ').toUpperCase()} ({recentRecords.length} Total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetLive}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 transition font-semibold"
                >
                  Reset Live Records
                </button>
                <button
                  onClick={handleResetDemo}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 transition font-semibold"
                >
                  Reset Demo Records
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
              {recentRecords.length === 0 ? (
                <p className="text-gray-500 text-center py-3">No score records recorded yet.</p>
              ) : (
                recentRecords.slice(0, 15).map((rec) => {
                  const tObj = topics.find(t => t.id === rec.topic_id);
                  const isDemo = rec.source === 'demo';
                  const pct = Math.round(rec.score * 100);
                  return (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isDemo ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <span className="font-semibold text-gray-200">{tObj?.name || rec.topic_id}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                          isDemo
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {isDemo ? 'DEMO' : 'LIVE'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-[11px]">{rec.test_date}</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          pct >= 80 ? 'bg-emerald-500/20 text-emerald-300' :
                          pct < 50 ? 'bg-rose-500/20 text-rose-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
