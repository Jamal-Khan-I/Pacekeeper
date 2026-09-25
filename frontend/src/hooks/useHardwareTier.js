import { useState, useEffect } from 'react';

export function useHardwareTier() {
  const [hardwareInfo, setHardwareInfo] = useState({
    cpuCores: 4,
    ramGB: 8,
    gpuRenderer: 'Generic WebGL',
    recommendedTier: 'free',
    recommendationReason: 'Analyzing hardware...',
  });

  useEffect(() => {
    try {
      const cores = navigator.hardwareConcurrency || 4;
      const ram = navigator.deviceMemory || 8;

      let gpu = 'Standard Graphics';
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'WebGL Device';
          }
        }
      } catch (e) {
        console.warn('WebGL detection fallback:', e);
      }

      // Tier recommendation logic
      let recommended = 'free';
      let reason = 'Low-spec or virtualized hardware. Free tier (deterministic core) recommended.';

      const isDedicatedGPU = /NVIDIA|AMD|Radeon|GeForce|RTX|GTX|Apple M/i.test(gpu);

      if (ram >= 8 && (cores >= 6 || isDedicatedGPU)) {
        recommended = 'local';
        reason = `Sufficient system capacity (${cores} CPU cores, ~${ram}GB RAM, ${gpu.split('/')[0]}). Local Gemma 4 Agent tier suggested.`;
      } else {
        reason = `System specs (${cores} CPU cores, ~${ram}GB RAM). Free Tier recommended for zero-lag scheduling.`;
      }

      setHardwareInfo({
        cpuCores: cores,
        ramGB: ram,
        gpuRenderer: gpu,
        recommendedTier: recommended,
        recommendationReason: reason,
      });
    } catch (err) {
        console.error('Error detecting hardware:', err);
    }
  }, []);

  return hardwareInfo;
}
