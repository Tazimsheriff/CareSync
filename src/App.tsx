import { useState, useEffect, useRef } from "react";
import { Activity, Thermometer, Heart, AlertTriangle, Clock, RefreshCw } from "lucide-react";

// Types
interface Alarm {
  label: string;
  level: "critical" | "warning" | "normal";
  active: boolean;
}

export default function App() {
  // --- States for Clinical Parameters ---
  const [hr, setHr] = useState(134);
  const [spo2, setSpo2] = useState(91);
  const [nibpSys, setNibpSys] = useState(82);
  const [nibpDia, setNibpDia] = useState(48);
  const [temp, setTemp] = useState(39.4);
  const [rr, setRr] = useState(26);
  const [co2, setCo2] = useState(28);
  const [ediScore, setEdiScore] = useState(76);

  // --- Clock State ---
  const [timeStr, setTimeStr] = useState("21:15:30");
  const [lookDeepTime, setLookDeepTime] = useState("Restless — 21:13");

  // --- NIBP Timer States ---
  const [nibpSeconds, setNibpSeconds] = useState(300);
  const [nibpMeasuring, setNibpMeasuring] = useState(false);

  // --- Refs for Animation Loop ---
  const hrRef = useRef(134);
  const spo2Ref = useRef(91);
  const rrRef = useRef(26);
  const co2Ref = useRef(28);

  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spo2CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const respCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const co2CanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync refs with state
  useEffect(() => { hrRef.current = hr; }, [hr]);
  useEffect(() => { spo2Ref.current = spo2; }, [spo2]);
  useEffect(() => { rrRef.current = rr; }, [rr]);
  useEffect(() => { co2Ref.current = co2; }, [co2]);

  // --- Live Clock & LookDeep motion updates ---
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      setTimeStr(d.toTimeString().split(" ")[0]);
      
      // LookDeep active motion based on minutes
      const curHour = String(d.getHours()).padStart(2, "0");
      const prevMin = String((d.getMinutes() - 1 + 60) % 60).padStart(2, "0");
      const status = d.getMinutes() % 2 === 0 ? "Restless" : "Active";
      setLookDeepTime(`${status} — ${curHour}:${prevMin}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- NIBP Countdown Timer ---
  useEffect(() => {
    const timer = setInterval(() => {
      setNibpSeconds(prev => {
        if (prev <= 1) {
          setNibpMeasuring(true);
          setTimeout(() => {
            setNibpMeasuring(false);
            // Subtle NIBP update
            setNibpSys(Math.floor(80 + Math.random() * 5));
            setNibpDia(Math.floor(46 + Math.random() * 4));
          }, 4000);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Physiologically plausible parameter drifts ---
  useEffect(() => {
    // 1. HR & SpO2 drift every 3.5s
    const hrSpO2Drift = setInterval(() => {
      setHr(prev => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = Math.max(128, Math.min(139, prev + delta));
        return next;
      });
      setSpo2(prev => {
        if (Math.random() < 0.4) {
          const delta = Math.random() > 0.5 ? 1 : -1;
          const next = Math.max(89, Math.min(92, prev + delta));
          return next;
        }
        return prev;
      });
    }, 3500);

    // 2. Epic EDI drift every 4.0s (70 to 82)
    const ediDrift = setInterval(() => {
      setEdiScore(prev => {
        const delta = Math.random() > 0.5 ? 2 : -2;
        const next = Math.max(71, Math.min(82, prev + delta));
        return next;
      });
    }, 4000);

    // 3. Slower drifts (RR, CO2, Temp) every 6s
    const slowDrift = setInterval(() => {
      setRr(prev => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = Math.max(24, Math.min(28, prev + delta));
        return next;
      });
      setCo2(prev => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = Math.max(26, Math.min(30, prev + delta));
        return next;
      });
      setTemp(prev => {
        const delta = Math.random() > 0.5 ? 0.1 : -0.1;
        const next = Math.round(Math.max(39.1, Math.min(39.7, prev + delta)) * 10) / 10;
        return next;
      });
    }, 6000);

    return () => {
      clearInterval(hrSpO2Drift);
      clearInterval(ediDrift);
      clearInterval(slowDrift);
    };
  }, []);

  // --- Drawing & Simulation Loop for waveforms ---
  useEffect(() => {
    const canvasRefs = [ecgCanvasRef, spo2CanvasRef, respCanvasRef, co2CanvasRef];
    
    // Wave history buffers sized for 1200 points
    const buffers = {
      ecg: new Array(1200).fill(NaN),
      spo2: new Array(1200).fill(NaN),
      resp: new Array(1200).fill(NaN),
      co2: new Array(1200).fill(NaN),
    };
    
    let writePtr = 0;
    let simTime = 0;
    let lastTime = performance.now();
    let frameId = 0;
    let timeAccumulator = 0;

    const sampleRate = 250; // Hz
    const sampleStep = 1 / sampleRate;

    const tick = (now: number) => {
      let dt = (now - lastTime) / 1000;
      if (dt > 0.1) dt = 0.1; // Clamp lags
      lastTime = now;

      timeAccumulator += dt;
      let samplesToGen = Math.floor(timeAccumulator / sampleStep);
      timeAccumulator -= samplesToGen * sampleStep;

      // Cap samples to process per frame
      if (samplesToGen > 50) samplesToGen = 50;

      for (let s = 0; s < samplesToGen; s++) {
        simTime += sampleStep;

        const currentHR = hrRef.current;
        const beatPeriod = 60 / currentHR;
        
        // --- 1. ECG II Morphological Generation (Gaussian peaks) ---
        const pEcg = (simTime % beatPeriod) / beatPeriod;
        let ecgVal = 0;
        // P-wave
        if (pEcg >= 0.12 && pEcg < 0.22) {
          ecgVal += 0.12 * Math.exp(-Math.pow((pEcg - 0.17) / 0.02, 2));
        }
        // Q-wave
        if (pEcg >= 0.32 && pEcg < 0.35) {
          ecgVal -= 0.08 * Math.exp(-Math.pow((pEcg - 0.34) / 0.01, 2));
        }
        // R-spike
        if (pEcg >= 0.35 && pEcg < 0.39) {
          ecgVal += 1.35 * Math.exp(-Math.pow((pEcg - 0.375) / 0.006, 2));
        }
        // S-dip
        if (pEcg >= 0.39 && pEcg < 0.43) {
          ecgVal -= 0.28 * Math.exp(-Math.pow((pEcg - 0.405) / 0.007, 2));
        }
        // T-wave
        if (pEcg >= 0.50 && pEcg < 0.70) {
          ecgVal += 0.32 * Math.exp(-Math.pow((pEcg - 0.60) / 0.045, 2));
        }
        // U-wave
        if (pEcg >= 0.70 && pEcg < 0.85) {
          ecgVal += 0.03 * Math.exp(-Math.pow((pEcg - 0.77) / 0.03, 2));
        }
        // Baseline noise
        ecgVal += (Math.random() - 0.5) * 0.015;
        buffers.ecg[writePtr] = ecgVal;

        // --- 2. SpO2 plethysmogram (Sinusoidal with dicrotic notch) ---
        const tSpo2 = simTime - 0.08; // delayed slightly
        const pSpo2 = ((tSpo2 % beatPeriod) + beatPeriod) % beatPeriod / beatPeriod;
        let spo2Val = 0;
        if (pSpo2 < 0.22) {
          spo2Val = Math.sin((pSpo2 / 0.22) * Math.PI / 2);
        } else {
          const x = (pSpo2 - 0.22) / 0.78;
          const decay = Math.cos(x * Math.PI / 2);
          const notch = 0.22 * Math.exp(-Math.pow((x - 0.22) / 0.08, 2));
          spo2Val = decay + notch;
        }
        const scale = spo2Ref.current / 100;
        spo2Val = spo2Val * scale + (Math.random() - 0.5) * 0.006;
        buffers.spo2[writePtr] = spo2Val;

        // --- 3. Resp (Slow gentle sine) ---
        const currentRR = rrRef.current;
        const respPeriod = 60 / currentRR;
        const pResp = (simTime % respPeriod) / respPeriod;
        const respVal = Math.sin(pResp * 2 * Math.PI) * 0.38 + 0.5 + (Math.random() - 0.5) * 0.005;
        buffers.resp[writePtr] = respVal;

        // --- 4. EtCO2 (Capnogram plateau & rapid fall) ---
        let co2Val = 0;
        if (pResp < 0.42) {
          const riseFactor = Math.min(1, pResp / 0.06); // sharp rise
          const plateau = 0.96 + 0.04 * (pResp / 0.42); // flat top
          co2Val = riseFactor * plateau;
        } else if (pResp < 0.46) {
          const fallFactor = 1 - (pResp - 0.42) / 0.04; // sharp drop
          co2Val = Math.max(0, fallFactor);
        } else {
          co2Val = 0; // inhalation phase at zero
        }
        co2Val += (Math.random() - 0.5) * 0.006;
        buffers.co2[writePtr] = co2Val;

        writePtr = (writePtr + 1) % 1200;
      }

      // Safe sweep eraser gap (30 points)
      const gapSize = 30;
      for (let g = 0; g < gapSize; g++) {
        const idx = (writePtr + g) % 1200;
        buffers.ecg[idx] = NaN;
        buffers.spo2[idx] = NaN;
        buffers.resp[idx] = NaN;
        buffers.co2[idx] = NaN;
      }

      // Draw all channels
      for (let k = 0; k < 4; k++) {
        const canvas = canvasRefs[k].current;
        if (!canvas) continue;

        const parent = canvas.parentElement;
        if (parent) {
          const dpr = window.devicePixelRatio || 1;
          const rect = parent.getBoundingClientRect();
          const w = Math.floor(rect.width);
          const h = Math.floor(rect.height);
          if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
          }
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (k === 0) ctx.strokeStyle = "#00E676"; // green
        else if (k === 1) ctx.strokeStyle = "#00E5FF"; // cyan
        else if (k === 2) ctx.strokeStyle = "#AA80FF"; // purple
        else if (k === 3) ctx.strokeStyle = "#FF9100"; // orange

        ctx.beginPath();
        let insideLine = false;

        for (let i = 0; i < 1200; i++) {
          let val = 0;
          if (k === 0) val = buffers.ecg[i];
          else if (k === 1) val = buffers.spo2[i];
          else if (k === 2) val = buffers.resp[i];
          else if (k === 3) val = buffers.co2[i];

          if (isNaN(val)) {
            if (insideLine) {
              ctx.stroke();
              ctx.beginPath();
              insideLine = false;
            }
            continue;
          }

          const x = (i / 1200) * w;
          let y = 0;

          if (k === 0) {
            y = 0.62 * h - val * h * 0.35;
          } else if (k === 1) {
            y = 0.82 * h - val * h * 0.55;
          } else if (k === 2) {
            y = 0.85 * h - val * h * 0.70;
          } else if (k === 3) {
            y = 0.88 * h - val * h * 0.72;
          }

          if (!insideLine) {
            ctx.moveTo(x, y);
            insideLine = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        if (insideLine) {
          ctx.stroke();
        }
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // --- Map Calculation ---
  const calculatedMap = Math.round((2 * nibpDia + nibpSys) / 3);

  // --- Epic EDI Color & Status computation ---
  let ediColor = "#00E676"; // default green
  let ediRiskText = "LOW RISK";
  if (ediScore > 68) {
    ediColor = "#FF5252"; // red
    ediRiskText = "HIGH RISK";
  } else if (ediScore >= 38) {
    ediColor = "#FFD740"; // amber
    ediRiskText = "INTERMEDIATE RISK";
  }

  const ediR = 30;
  const ediCircum = 2 * Math.PI * ediR;
  const ediOffset = ediCircum - (ediScore / 100) * ediCircum;

  // --- List of active alarms in the topbar ---
  const activeAlarms: Alarm[] = [
    { label: "SYS LOW", level: "critical", active: nibpSys < 90 },
    { label: "TACHYCARDIA", level: "critical", active: hr > 130 },
    { label: "SPO2 DESAT", level: "warning", active: spo2 < 93 },
    { label: "FEVER HIGH", level: "warning", active: temp > 38.5 },
  ];

  return (
    <div id="pac-monitor-root" className="h-screen w-screen bg-[#080D18] flex flex-col text-white font-mono select-none overflow-hidden relative">
      <style>{`
        @keyframes alarm-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-alarm-flash {
          animation: alarm-flash 0.9s infinite ease-in-out;
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.35); opacity: 1; }
        }
        .animate-pulse-dot {
          animation: pulse-dot ${Math.max(0.4, 60 / hr).toFixed(2)}s infinite ease-in-out;
        }
      `}</style>

      {/* --- TOPBAR (44px) --- */}
      <header id="topbar" className="h-[44px] border-b border-[#1C2E44] px-4 flex items-center justify-between bg-[#080D18] z-10">
        <div className="flex items-center space-x-5 text-[11px]">
          <span className="font-bold text-sm tracking-wider text-[#00E676]">JENKINS, SARAH</span>
          <div className="border-l border-[#1C2E44] pl-4">
            <span className="text-neutral-500">BED </span>
            <span className="font-semibold text-red-500">ICU-08</span>
          </div>
          <div className="border-l border-[#1C2E44] pl-4">
            <span className="text-neutral-500">AGE/SEX </span>
            <span className="font-semibold">72Y / F</span>
          </div>
          <div className="border-l border-[#1C2E44] pl-4">
            <span className="text-neutral-500">DX </span>
            <span className="font-semibold text-red-400">SEPTIC SHOCK</span>
          </div>
        </div>

        {/* Alarms and Clock block */}
        <div className="flex items-center space-x-3">
          {/* Active flashing alarm pills */}
          <div id="alarm-pills-container" className="flex items-center space-x-2">
            {activeAlarms.map((alarm, id) => {
              if (!alarm.active) return null;
              const isCrit = alarm.level === "critical";
              const classStr = isCrit
                ? "bg-red-950/40 text-[#FF5252] border-[#FF5252]/60 animate-alarm-flash"
                : "bg-amber-950/30 text-[#FFD740] border-[#FFD740]/60 animate-alarm-flash";
              return (
                <div key={id} className={`px-2 py-0.5 text-[8.5px] font-bold border rounded-none flex items-center space-x-1 ${classStr}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  <span>{alarm.label}</span>
                </div>
              );
            })}
          </div>

          {/* Dot-live pulse animation */}
          <div className="flex items-center space-x-1.5 border-l border-[#1C2E44] pl-3 select-none">
            <span className="text-[10px] text-neutral-500">PULSE</span>
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className="absolute w-2 h-2 bg-[#00E676] rounded-full animate-pulse-dot"></span>
              <span className="w-1.5 h-1.5 bg-[#00E676] rounded-full"></span>
            </div>
          </div>

          {/* Live Clock */}
          <div className="flex items-center space-x-2 border-l border-[#1C2E44] pl-3 text-sm text-neutral-300 font-bold tracking-wider select-none">
            <Clock size={13} className="text-neutral-500" />
            <span id="systime-clock">{timeStr}</span>
          </div>
        </div>
      </header>

      {/* --- BODY (fills remaining height) --- */}
      <main id="monitor-body" className="flex-1 flex overflow-hidden">
        {/* --- Left waveform column (~75% width) --- */}
        <section id="waveform-column" className="flex-1 relative grid grid-rows-4 h-full border-r border-[#1C2E44]">
          {/* Wave 1: ECG II */}
          <div id="wave-row-ecg" className="relative border-b border-[#1C2E44] flex flex-col justify-between p-2 pb-0">
            <div className="flex justify-between items-start z-10 pointer-events-none">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-wider text-[#00E676]">ECG · LEAD II</span>
                <span className="text-[7.5px] text-neutral-500">X1.0 · FILTERED</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xs font-bold text-[#00E676]">{hr}</span>
                <span className="text-[8px] text-neutral-500">BPM</span>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <canvas ref={ecgCanvasRef} className="absolute top-0 left-0 w-full h-full" />
            </div>
          </div>

          {/* Wave 2: SpO2 */}
          <div id="wave-row-spo2" className="relative border-b border-[#1C2E44] flex flex-col justify-between p-2 pb-0">
            <div className="flex justify-between items-start z-10 pointer-events-none">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-wider text-[#00E5FF]">SPO2 · PLETH</span>
                <span className="text-[7.5px] text-neutral-500">PLETH WAVEFORM</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xs font-bold text-[#00E5FF]">{spo2}%</span>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <canvas ref={spo2CanvasRef} className="absolute top-0 left-0 w-full h-full" />
            </div>
          </div>

          {/* Wave 3: Resp */}
          <div id="wave-row-resp" className="relative border-b border-[#1C2E44] flex flex-col justify-between p-2 pb-0">
            <div className="flex justify-between items-start z-10 pointer-events-none">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-wider text-[#AA80FF]">RESP · THORACIC</span>
                <span className="text-[7.5px] text-neutral-500">IMPEDANCE SENSOR</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xs font-bold text-[#AA80FF]">{rr}</span>
                <span className="text-[8px] text-neutral-500">/MIN</span>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <canvas ref={respCanvasRef} className="absolute top-0 left-0 w-full h-full" />
            </div>
          </div>

          {/* Wave 4: CO2 */}
          <div id="wave-row-co2" className="relative flex flex-col justify-between p-2 pb-0">
            <div className="flex justify-between items-start z-10 pointer-events-none">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-wider text-[#FF9100]">CO2 · CAPNOGRAPH</span>
                <span className="text-[7.5px] text-neutral-500">SIDESTREAM INFRARED</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xs font-bold text-[#FF9100]">{co2}</span>
                <span className="text-[8px] text-neutral-500">mmHg</span>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <canvas ref={co2CanvasRef} className="absolute top-0 left-0 w-full h-full" />
            </div>
          </div>

          {/* Floating EDI Panel */}
          <div id="floating-edi-panel" className="absolute top-3 right-3 w-[140px] bg-[#141E33]/92 border border-[#1C2E44] p-2.5 z-20 flex flex-col select-none shadow-none rounded-none text-white">
            <div className="text-[8px] font-bold tracking-wider text-neutral-500 uppercase flex items-center justify-between">
              <span>EDI · EPIC</span>
              <span className="scale-75 text-[#FF5252] font-semibold">LIVE</span>
            </div>

            {/* Donut gauge */}
            <div className="relative w-[90px] h-[90px] mx-auto mt-1.5 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="45" cy="45" r={ediR} stroke="#1C2E44" strokeWidth="4.5" fill="transparent" />
                <circle
                  cx="45"
                  cy="45"
                  r={ediR}
                  stroke={ediColor}
                  strokeWidth="5"
                  strokeDasharray={ediCircum}
                  strokeDashoffset={ediOffset}
                  fill="transparent"
                  strokeLinecap="square"
                  className="transition-all duration-1000 ease-in-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[20px] font-bold" style={{ color: ediColor }}>
                  {ediScore}
                </span>
                <span className="text-[6.5px] text-neutral-500 font-semibold tracking-wide">INDEX</span>
              </div>
            </div>

            {/* Risk label below circle */}
            <div className="text-center text-[7.5px] font-bold tracking-wide mt-1" style={{ color: ediColor }}>
              {ediRiskText}
            </div>

            {/* Faint bar percentage */}
            <div className="h-[2px] w-full bg-[#1C2E44] mt-1.5 overflow-hidden">
              <div className="h-full transition-all duration-1000 ease-in-out" style={{ width: `${ediScore}%`, backgroundColor: ediColor }}></div>
            </div>

            {/* 5 Flag pills driving score */}
            <div className="flex flex-col space-y-1 mt-2 text-[7px] font-bold">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">MAP CRITICAL</span>
                <span className="px-1 py-0.2 bg-red-950/50 text-[#FF5252] border border-red-900/40">RED</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">HR EXTRA-HIGH</span>
                <span className="px-1 py-0.2 bg-red-950/50 text-[#FF5252] border border-red-900/40">RED</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">TEMP HYPER</span>
                <span className="px-1 py-0.2 bg-red-950/50 text-[#FF5252] border border-red-900/40">RED</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">RESP ELEVATED</span>
                <span className="px-1 py-0.2 bg-[#3a2f1a] text-[#FFD740] border border-[#ffb300]/20">AMBER</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">WBC COUNT HI</span>
                <span className="px-1 py-0.2 bg-[#3a2f1a] text-[#FFD740] border border-[#ffb300]/20">AMBER</span>
              </div>
            </div>
          </div>
        </section>

        {/* --- Right parameter column (160px fixed width) --- */}
        <section id="parameter-column" className="w-[160px] h-full bg-[#0E1525] grid grid-rows-6">
          {/* Blocks: HR, SpO2, NIBP, Temp, RR, EtCO2 */}
          
          {/* Block 1: HR */}
          <div id="param-hr-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#00E676] uppercase">HR</span>
              <span className="text-[9px] text-neutral-500">LO 50 HI 120</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#00E676] leading-none tracking-tighter">{hr}</span>
              <span className="text-[8px] text-[#00E676] opacity-75">bpm</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span>ECG LEAD II</span>
              <span className="text-red-500 animate-pulse font-bold">↑ TACHY</span>
            </div>
          </div>

          {/* Block 2: SpO2 */}
          <div id="param-spo2-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#00E5FF] uppercase">SPO2</span>
              <span className="text-[9px] text-neutral-500">LO 90 HI 100</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#00E5FF] leading-none tracking-tighter">{spo2}</span>
              <span className="text-[10px] text-[#00E5FF] opacity-75">%</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span>PR: {hr} bpm</span>
              <span className="text-amber-500 animate-pulse font-bold">↓ DESAT</span>
            </div>
          </div>

          {/* Block 3: NIBP */}
          <div id="param-nibp-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#FF5252] uppercase">NIBP</span>
              <span className="text-[9px] text-neutral-500">SYS 140/90</span>
            </div>
            <div className="flex items-baseline justify-end">
              {nibpMeasuring ? (
                <span className="text-sm font-semibold text-[#FF5252] leading-none animate-pulse">CUFF MAIN...</span>
              ) : (
                <span className="text-[26px] font-semibold text-[#FF5252] leading-none tracking-tighter">
                  {nibpSys}/{nibpDia}
                </span>
              )}
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-400">
              <span>MAP: ({calculatedMap})</span>
              <span className="text-red-500 animate-pulse font-bold">↓ HYPO</span>
            </div>
          </div>

          {/* Block 4: Temp */}
          <div id="param-temp-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#FFD740] uppercase">TEMP</span>
              <span className="text-[9px] text-neutral-500">LO 36.0 HI 38.5</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#FFD740] leading-none tracking-tighter">{temp.toFixed(1)}</span>
              <span className="text-[10px] text-[#FFD740] opacity-75">°C</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span>{((temp * 9) / 5 + 32).toFixed(1)} °F</span>
              <span className="text-amber-500 animate-pulse font-bold">↑ FEVER</span>
            </div>
          </div>

          {/* Block 5: RR */}
          <div id="param-rr-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#AA80FF] uppercase">RESP</span>
              <span className="text-[9px] text-neutral-500">LO 8 HI 25</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#AA80FF] leading-none tracking-tighter">{rr}</span>
              <span className="text-[8px] text-[#AA80FF] opacity-75">/min</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span>I:E 1:2.0</span>
              <span className="text-amber-500 font-bold">↑ TACHY</span>
            </div>
          </div>

          {/* Block 6: EtCO2 */}
          <div id="param-co2-block" style={{ contentVisibility: "auto" }} className="p-2 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#FF9100] uppercase">CO2</span>
              <span className="text-[9px] text-neutral-500">LO 30 HI 45</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#FF9100] leading-none tracking-tighter">{co2}</span>
              <span className="text-[9px] text-[#FF9100] opacity-75">mmHg</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span>FiCO2: 1</span>
              <span className="text-amber-500 font-bold">↓ HYPO</span>
            </div>
          </div>
        </section>
      </main>

      {/* --- BOTTOMBAR (36px) --- */}
      <footer id="bottombar" className="h-[36px] border-t border-[#1C2E44] grid grid-cols-5 divide-x divide-[#1C2E44] bg-[#080D18] text-[9.5px] font-bold uppercase select-none z-10">
        <div className="flex items-center justify-center space-x-1.5 px-2">
          <span className="text-neutral-500">EWS SCORE:</span>
          <span className="text-[#FF5252] animate-pulse">10 / 12 [CRITICAL]</span>
        </div>
        <div className="flex items-center justify-center space-x-1.5 px-2">
          <span className="text-neutral-500">EPIC EDI:</span>
          <span style={{ color: ediColor }}>
            {ediScore} [{ediRiskText.split(" ")[0]}]
          </span>
        </div>
        <div className="flex items-center justify-center space-x-1.5 px-2">
          <span className="text-neutral-500 font-mono text-[#FF5252] animate-pulse">▲ TREWS SEPSIS:</span>
          <span className="text-[#FF5252] animate-pulse">ALERT — 4/5 CRITERIA</span>
        </div>
        <div className="flex items-center justify-center space-x-1.5 px-2">
          <span className="text-neutral-500">LOOKDEEP MOTION:</span>
          <span className="text-amber-500 font-semibold">{lookDeepTime}</span>
        </div>
        <div className="flex items-center justify-center space-x-1.5 px-2 text-neutral-300">
          <RefreshCw size={11} className="text-neutral-500 animate-spin" strokeWidth={2.4} style={{ animationDuration: "14s" }} />
          <span className="text-neutral-500">NEXT NIBP IN:</span>
          <span className="text-neutral-300 font-mono whitespace-nowrap">
            {Math.floor(nibpSeconds / 60)}:{String(nibpSeconds % 60).padStart(2, "0")}
          </span>
        </div>
      </footer>
    </div>
  );
}
