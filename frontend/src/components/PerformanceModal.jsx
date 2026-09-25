import React, { useState, useRef, useEffect } from 'react';
import { Award, X, Sparkles, Upload, CheckCircle2, AlertTriangle, Camera, RefreshCw, Terminal, Image, Folder, Database, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';

export default function PerformanceModal({ isOpen, onClose, topics, onSubmitPerformance, activeClassId, activeTier = 'free' }) {
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [scorePercentage, setScorePercentage] = useState(40);
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Determine whether AI capabilities are active
  const isAITier = activeTier === 'local' || activeTier === 'cloud';

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
    }
  }, [isOpen, activeClassId]);

  if (!isOpen) return null;

  const topicIdToUse = selectedTopicId || (topics[0]?.id ?? '');

  const addLog = (type, msg) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setPipelineLogs(prev => [{ ts, type, msg }, ...prev].slice(0, 20));
  };

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

        const isPipelineError = data.diagnosis.diagnostic_summary?.includes('AI pipeline') ||
          data.diagnosis.diagnostic_summary?.includes('Ollama') ||
          data.diagnosis.diagnostic_summary?.includes('pipeline failed');

        if (isPipelineError) {
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

        const isPipelineError = data.diagnosis.diagnostic_summary?.includes('AI pipeline') ||
          data.diagnosis.diagnostic_summary?.includes('Ollama') ||
          data.diagnosis.diagnostic_summary?.includes('pipeline failed');

        if (isPipelineError) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!topicIdToUse) return;

    setSubmitting(true);
    try {
      const normalizedScore = scorePercentage / 100.0;
      await onSubmitPerformance({
        topic_id: topicIdToUse,
        score: normalizedScore,
        test_date: testDate,
        max_score: 100,
        raw_score: scorePercentage,
        source: 'live',
        question_breakdown: diagnosisResult ?
          Object.fromEntries(Object.entries(diagnosisResult.question_breakdown || {}).map(([k, v]) => [k, v.score || 0])) :
          { mcq: Math.min(1.0, normalizedScore + 0.1), subjective: Math.max(0.0, normalizedScore - 0.1) }
      });
      await fetchRecords();
      onClose();
    } catch (err) {
      alert(`Error submitting score: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

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

        {/* Header — conditional on AI tier */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {isAITier ? 'Enter Test Scores / Scan Answer Sheet' : 'Enter Student Test Scores'}
            </h3>
            <p className="text-xs text-gray-400">
              {isAITier
                ? 'Upload a real photo, capture from camera, or pick a demo sheet.'
                : 'Record manual topic score and date to auto-replan syllabus schedule.'}
            </p>
          </div>
        </div>

        {/* Scan & Camera options — ONLY rendered when Local or Cloud AI tier is active */}
        {isAITier && (
          <>
            {isCameraActive ? (
              <div className="mb-4 bg-slate-950 rounded-xl p-3 border border-indigo-500/40 text-center">
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
              <div className="mb-4 bg-slate-900/90 border border-dashed border-indigo-500/40 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-300">Scan Answer Sheet — AI Vision Diagnosis</span>
                </div>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {/* File Upload */}
                  <input type="file" accept="image/*" onChange={handleFileScan} className="hidden" id="answer-sheet-upload" />
                  <label
                    htmlFor="answer-sheet-upload"
                    className="flex items-center gap-1.5 cursor-pointer text-xs px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-semibold transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    {scanning ? 'Scanning...' : 'Upload File (Live)'}
                  </label>

                  <span className="text-xs text-gray-500 font-bold">OR</span>

                  {/* Live Camera */}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 font-semibold transition-all"
                  >
                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                    Live Camera
                  </button>

                  <span className="text-xs text-gray-500 font-bold">OR</span>

                  {/* Demo Dataset */}
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
              <div className="mb-4 bg-slate-900/80 border border-amber-500/30 rounded-xl p-3 animate-banner">
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
              <div className={`mb-4 p-3.5 rounded-xl border text-xs space-y-2 animate-banner ${
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
              <div className="mb-4 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono max-h-32 overflow-y-auto">
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
          </>
        )}

        {/* Manual Score Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Select Topic */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Select Syllabus Topic</label>
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

          {/* Score Slider */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-300">Student Performance Score</span>
              <span className={`text-lg font-extrabold px-3 py-0.5 rounded-lg ${
                scorePercentage >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                scorePercentage < 50 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {scorePercentage}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={scorePercentage}
              onChange={(e) => setScorePercentage(Number(e.target.value))}
              className="w-full accent-pink-500 h-2 bg-slate-800 rounded-lg cursor-pointer mb-2"
            />
          </div>

          {/* Submit */}
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
                {submitting ? 'Re-planning Schedule...' : 'Submit Score & Auto-Replan'}
              </button>
            </div>
          </div>
        </form>

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
                Performance Records — {activeClassId?.replace('_', ' ').toUpperCase()}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResetLive}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-rose-900/30 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 transition"
                  title="Clear only real uploaded records, keeping demo records"
                >
                  <Trash2 className="w-3 h-3" />
                  Reset Live Records
                </button>
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-900/30 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 transition"
                  title="Clear only demo dataset records, keeping live records"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Demo Records
                </button>
              </div>
            </div>

            {recentRecords.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center">No performance records for this class yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {recentRecords.map((r) => {
                  const matchingTopic = topics.find(t => t.id === r.topic_id);
                  const isLive = r.source === 'live';
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate mr-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          isLive
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {r.source || 'live'}
                        </span>
                        <span className="font-semibold text-gray-200 truncate">
                          {matchingTopic?.name || r.topic_id}
                        </span>
                        {r.image_path && (
                          <span className="text-[10px] text-gray-500 font-mono hidden sm:inline truncate max-w-[140px]">
                            {r.image_path}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-gray-400 text-[11px]">{r.test_date}</span>
                        <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                          r.score >= 0.8 ? 'text-emerald-400 bg-emerald-500/10' :
                          r.score < 0.5 ? 'text-rose-400 bg-rose-500/10' :
                          'text-amber-400 bg-amber-500/10'
                        }`}>
                          {Math.round(r.score * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
