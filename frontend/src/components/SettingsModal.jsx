import React, { useState, useEffect } from 'react';
import {
  Settings, Cloud, Key, CheckCircle2, AlertCircle, Eye, EyeOff,
  Loader2, X, Sparkles, Cpu, Globe, Palette, Moon, Sun, Terminal, Check
} from 'lucide-react';
import { api } from '../services/api';

const THEME_OPTIONS = [
  {
    id: 'cyber',
    name: 'Cyber Mode',
    subtitle: 'Dark green & light neon green',
    tag: 'Matrix Green',
    icon: Terminal,
    activeBorder: 'border-emerald-500 shadow-lg shadow-emerald-500/20 bg-emerald-950/40 text-emerald-200',
    inactiveBorder: 'border-slate-800 bg-slate-900/60 text-gray-400 hover:border-slate-700',
    swatches: ['#030d07', '#052e16', '#10b981', '#34d399']
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    subtitle: 'Deep space indigo & midnight slate',
    tag: 'Default',
    icon: Moon,
    activeBorder: 'border-indigo-500 shadow-lg shadow-indigo-500/20 bg-indigo-950/40 text-indigo-200',
    inactiveBorder: 'border-slate-800 bg-slate-900/60 text-gray-400 hover:border-slate-700',
    swatches: ['#0b0f19', '#1e1b4b', '#6366f1', '#a855f7']
  },
  {
    id: 'light',
    name: 'White Mode',
    subtitle: 'Crisp, high-contrast clean light',
    tag: 'Clean Light',
    icon: Sun,
    activeBorder: 'border-blue-500 shadow-lg shadow-blue-500/20 bg-blue-50/80 text-blue-900',
    inactiveBorder: 'border-slate-800 bg-slate-900/60 text-gray-400 hover:border-slate-700',
    swatches: ['#f8fafc', '#ffffff', '#4f46e5', '#38bdf8']
  }
];

export default function SettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
  currentTheme = 'dark',
  onThemeChange
}) {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getSystemSettings().then((data) => {
        const prov = data.cloud_provider || 'gemini';
        setProvider(prov);
        const savedKey = localStorage.getItem(`pk_key_${prov}`) || '';
        setApiKey(savedKey);
      }).catch(err => console.error('Failed to load settings:', err));
    }
  }, [isOpen]);

  const handleSelectProvider = (prov) => {
    setProvider(prov);
    setTestResult(null);
    const savedKey = localStorage.getItem(`pk_key_${prov}`) || '';
    setApiKey(savedKey);
  };

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!apiKey) {
      setTestResult({ success: false, message: 'Please enter an API Key first.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testApiKey(provider, apiKey);
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (apiKey) {
        localStorage.setItem(`pk_key_${provider}`, apiKey);
      }

      await api.updateSystemSettings({
        cloud_provider: provider,
        gemini_api_key: provider === 'gemini' ? apiKey : undefined,
        groq_api_key: provider === 'groq' ? apiKey : undefined,
      });

      if (onSettingsSaved) {
        onSettingsSaved();
      }
      onClose();
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">
                System & Interface Settings
              </h3>
              <p className="text-xs text-gray-400">Personalize your theme and manage AI cloud providers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          
          {/* SECTION 1: THEME SELECTION (FIRST AS REQUESTED) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                <label className="text-sm font-bold text-gray-200">Interface Theme</label>
              </div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                Instant Preview
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {THEME_OPTIONS.map((t) => {
                const Icon = t.icon;
                const isSelected = currentTheme === t.id;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (onThemeChange) {
                        onThemeChange(t.id);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all duration-200 relative flex flex-col justify-between ${
                      isSelected ? t.activeBorder : t.inactiveBorder
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{t.name}</span>
                        </div>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] leading-snug opacity-80 mb-3">
                        {t.subtitle}
                      </p>
                    </div>

                    {/* Palette Swatches */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-700/50">
                      {t.swatches.map((color, idx) => (
                        <span
                          key={idx}
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                      <span className="text-[9px] uppercase tracking-wider font-semibold opacity-70 ml-auto">
                        {t.tag}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* SECTION 2: CLOUD LLM PROVIDER & API KEY */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-blue-400" />
              <label className="text-sm font-bold text-gray-200">Cloud LLM Provider</label>
            </div>

            {/* Provider Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'gemini', label: 'Google Gemini', icon: Sparkles },
                { id: 'openai', label: 'OpenAI (GPT)', icon: Globe },
                { id: 'claude', label: 'Anthropic Claude', icon: Cloud },
                { id: 'groq', label: 'Groq Cloud', icon: Cpu },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectProvider(id)}
                  className={`p-3 rounded-xl border flex items-center gap-2 font-bold transition-all ${
                    provider === id
                      ? 'bg-blue-600/25 border-blue-500 text-blue-300 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-gray-400 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-indigo-400" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* Single API Key Input */}
            <div>
              <label className="block text-gray-300 font-bold mb-1.5">
                {provider.toUpperCase()} API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder={`Enter your ${provider.toUpperCase()} API Key...`}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-gray-200 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Connection Test Result */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs transition-all ${
                  testResult.success
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold">{testResult.success ? 'Connection Verified' : 'Connection Failed'}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{testResult.message}</p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleTestKey}
            disabled={testing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700 transition"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5 text-blue-400" />}
            Test Key
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-slate-800 transition"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 transition"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save API Key
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
