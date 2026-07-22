import React, { useState, createContext, useContext, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, Area, AreaChart, CartesianGrid, ResponsiveContainer, Cell, Legend } from 'recharts';
import { AlertTriangle, Info, Map as MapIcon, Activity, Wind, ShieldAlert, Download, ArrowUp, ArrowDown, Search, Thermometer, Droplets, Layers, Flame, Bell, BellRing, BellOff, Volume2, VolumeX, Trash2, Sparkles, Sliders, RotateCcw } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { syntheticDataset, getAQIColor, WardData } from './lib/syntheticData';
import { Agents } from './lib/gemini';

import LandingPage from './LandingPage';

export interface AQIAlert {
  id: string;
  wardId: string;
  wardName: string;
  city: string;
  peakAqi: number;
  projectedHour: number;
  timestamp: string;
  acknowledged: boolean;
  severeHours: number[];
}

const AppContext = createContext<{
  selectedWard: WardData | null;
  setSelectedWard: (w: WardData) => void;
  language: 'en'|'hi'|'kn'|'ta';
  setLanguage: (l: 'en'|'hi'|'kn'|'ta') => void;
  dataset: WardData[];
  setDataset: React.Dispatch<React.SetStateAction<WardData[]>>;
  alerts: AQIAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<AQIAlert[]>>;
  toasts: AQIAlert[];
  setToasts: React.Dispatch<React.SetStateAction<AQIAlert[]>>;
  isMonitoring: boolean;
  setIsMonitoring: (m: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (s: boolean) => void;
  scenarioAdjustments: {
    vehicular: number;
    construction: number;
    industrial: number;
    waste: number;
  };
  setScenarioAdjustments: React.Dispatch<React.SetStateAction<{
    vehicular: number;
    construction: number;
    industrial: number;
    waste: number;
  }>>;
}>({
  selectedWard: null,
  setSelectedWard: () => {},
  language: 'en',
  setLanguage: () => {},
  dataset: [],
  setDataset: () => {},
  alerts: [],
  setAlerts: () => {},
  toasts: [],
  setToasts: () => {},
  isMonitoring: true,
  setIsMonitoring: () => {},
  soundEnabled: true,
  setSoundEnabled: () => {},
  scenarioAdjustments: { vehicular: 0, construction: 0, industrial: 0, waste: 0 },
  setScenarioAdjustments: () => {},
});

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15); // E5
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.warn("Audio Context blocked or failed", e);
  }
}

function triggerBrowserNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  
  const notify = () => {
    try {
      new Notification(title, { body });
    } catch (e) {
      console.warn("Notification blocked in iframe/sandbox context:", e);
    }
  };

  if (Notification.permission === "granted") {
    notify();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        notify();
      }
    });
  }
}

function Dashboard() {
  const [dataset, setDataset] = useState<WardData[]>(() => [...syntheticDataset]);
  const [alerts, setAlerts] = useState<AQIAlert[]>([]);
  const [toasts, setToasts] = useState<AQIAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scenarioAdjustments, setScenarioAdjustments] = useState({ vehicular: 0, construction: 0, industrial: 0, waste: 0 });

  // Auto-dismiss toasts after 6 seconds for cleaner UX and less clutter
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 6000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Keep a Ref in sync with alerts to avoid dependency updates causing infinite rendering loops
  const alertsRef = React.useRef(alerts);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  // Background monitoring evaluator
  useEffect(() => {
    if (!isMonitoring) return;

    const checkForecasts = () => {
      const newAlerts: AQIAlert[] = [];
      const newToasts: AQIAlert[] = [];

      dataset.forEach(ward => {
        const hist = ward.history;
        const recentMean = hist.slice(-24).reduce((a, b) => a + b, 0) / 24;
        const prevMean = hist.slice(-48, -24).reduce((a, b) => a + b, 0) / 24;
        const trend = recentMean - prevMean;

        let peakAqi = 0;
        let projectedHour = 0;
        const severeHours: number[] = [];

        for (let i = 0; i < 72; i++) {
          const seasonalBase = hist[hist.length - 24 + (i % 24)];
          const dampedTrend = trend * Math.pow(0.9, i);
          const fcast = Math.max(0, Math.round(seasonalBase + dampedTrend));

          if (fcast >= 300) {
            severeHours.push(i + 1);
            if (fcast > peakAqi) {
              peakAqi = fcast;
              projectedHour = i + 1;
            }
          }
        }

        if (peakAqi >= 300) {
          const alertId = `${ward.id}-${peakAqi}`;
          const exists = alertsRef.current.some(a => a.id === alertId);

          const alertObj: AQIAlert = {
            id: alertId,
            wardId: ward.id,
            wardName: ward.name,
            city: ward.city,
            peakAqi,
            projectedHour,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            acknowledged: false,
            severeHours,
          };

          newAlerts.push(alertObj);

          if (!exists) {
            newToasts.push(alertObj);
          }
        }
      });

      if (newAlerts.length > 0) {
        setAlerts(prev => {
          const merged = [...prev];
          newAlerts.forEach(na => {
            const idx = merged.findIndex(ma => ma.id === na.id);
            if (idx === -1) {
              merged.unshift(na);
            } else {
              merged[idx] = { ...merged[idx], ...na, acknowledged: merged[idx].acknowledged };
            }
          });
          return merged;
        });
      }

      if (newToasts.length > 0) {
        setToasts(prev => {
          const mergedToasts = [...prev];
          newToasts.forEach(nt => {
            if (!mergedToasts.some(mt => mt.id === nt.id)) {
              mergedToasts.push(nt);
            }
          });
          return mergedToasts;
        });
        
        if (soundEnabled) {
          playAlertSound();
        }

        newToasts.forEach(t => {
          triggerBrowserNotification(
            `⚠️ Severe AQI Projected: ${t.wardName}`,
            `AQI is projected to reach ${t.peakAqi} in +${t.projectedHour} hours. Limit outdoor events.`
          );
        });
      }
    };

    checkForecasts();

    const interval = setInterval(checkForecasts, 12000);
    return () => clearInterval(interval);
  }, [dataset, isMonitoring, soundEnabled]);

  const [selectedWard, setSelectedWard] = useState<WardData>(syntheticDataset[0]);
  const [language, setLanguage] = useState<'en'|'hi'|'kn'|'ta'>('en');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!selectedWard) return;
    setIsDownloading(true);
    try {
      // get sources
      const p = selectedWard.proxies;
      const total = p.trafficDensity + (p.constructionPermits * 5) + (p.industrialStacks * 10) + (p.wasteBurningIncidents * 15);
      const sources = [
        { name: 'Vehicular', value: Math.round((p.trafficDensity / total) * 100) },
        { name: 'Construction', value: Math.round(((p.constructionPermits * 5) / total) * 100) },
        { name: 'Industrial', value: Math.round(((p.industrialStacks * 10) / total) * 100) },
        { name: 'Waste Burning', value: Math.round(((p.wasteBurningIncidents * 15) / total) * 100) },
      ].filter(s => s.value > 0);
      const percentages = Object.fromEntries(sources.map(s => [s.name, s.value]));
      
      // get forecast trend
      const hist = selectedWard.history;
      const recentMean = hist.slice(-24).reduce((a,b)=>a+b,0)/24;
      const prevMean = hist.slice(-48, -24).reduce((a,b)=>a+b,0)/24;
      const trend = recentMean - prevMean;
      const trendDir = trend > 0 ? "Deteriorating" : "Improving";

      const currentAqi = hist[hist.length - 1];
      const band = currentAqi > 200 ? 'Severe' : currentAqi > 100 ? 'Moderate' : 'Good';

      // Wait for AI
      const [sourceData, forecastData, schoolAdv, hospitalAdv, elderlyAdv, workerAdv] = await Promise.all([
        Agents.analyzeSources(percentages),
        Agents.explainForecast(trendDir, "Low wind speed, thermal inversion expected"),
        Agents.generateAdvisory(selectedWard.id, 'Schools', band),
        Agents.generateAdvisory(selectedWard.id, 'Hospitals', band),
        Agents.generateAdvisory(selectedWard.id, 'Elderly', band),
        Agents.generateAdvisory(selectedWard.id, 'Outdoor Workers', band),
      ]);

      const report = {
        timestamp: new Date().toISOString(),
        ward: selectedWard.name,
        city: selectedWard.city,
        currentAQI: currentAqi,
        statistics: {
          proxies: selectedWard.proxies,
          sourcesPercentage: percentages
        },
        aiAnalysis: {
          sourceAttribution: sourceData,
          meteorologicalForecast: forecastData,
          healthAdvisories: {
            Schools: schoolAdv,
            Hospitals: hospitalAdv,
            Elderly: elderlyAdv,
            OutdoorWorkers: workerAdv
          }
        }
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VayuIQ_Report_${selectedWard.id}_${new Date().getTime()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to generate report", e);
    }
    setIsDownloading(false);
  };

  return (
    <AppContext.Provider value={{ 
      selectedWard, 
      setSelectedWard, 
      language, 
      setLanguage,
      dataset,
      setDataset,
      alerts,
      setAlerts,
      toasts,
      setToasts,
      isMonitoring,
      setIsMonitoring,
      soundEnabled,
      setSoundEnabled,
      scenarioAdjustments,
      setScenarioAdjustments
    }}>
      <div className="h-screen bg-slate-50 bg-gradient-to-br from-slate-50 via-slate-100/60 to-sky-50/40 text-slate-900 font-sans flex flex-col p-4 overflow-hidden select-none relative">
        {/* Floating Toast Alerts Container */}
        <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm pointer-events-none w-[90%] sm:w-80">
          {toasts.slice(-3).map(toast => (
            <div 
              key={toast.id}
              className="pointer-events-auto bg-slate-900 text-white border border-rose-500/30 p-3.5 rounded-xl shadow-xl shadow-rose-950/15 flex gap-3 transition-all duration-300 transform translate-y-0 scale-100"
            >
              <div className="bg-rose-500 text-white rounded-full p-1.5 h-fit flex items-center justify-center shrink-0">
                <BellRing size={14} className="animate-bounce" />
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-rose-400">Severe AQI Forecasted</span>
                  <button 
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="text-slate-400 hover:text-white text-xs font-bold px-1 rounded cursor-pointer -mt-1 -mr-1"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] font-bold text-white mb-1 truncate">
                  {toast.wardName} ({toast.city})
                </p>
                <p className="text-[10px] text-slate-300 leading-normal mb-2">
                  Projections show AQI reaching <span className="text-rose-400 font-bold">{toast.peakAqi}</span> in <span className="text-amber-400 font-bold">+{toast.projectedHour}h</span>. Immediate policy intervention recommended.
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const ward = dataset.find(w => w.id === toast.wardId);
                      if (ward) setSelectedWard(ward);
                      setToasts(prev => prev.filter(t => t.id !== toast.id));
                    }}
                    className="text-[9px] bg-rose-600 hover:bg-rose-500 font-bold px-2 py-1 rounded transition-colors text-white uppercase tracking-wider shadow-sm cursor-pointer"
                  >
                    Inspect
                  </button>
                  <button 
                    onClick={() => {
                      setAlerts(prev => prev.map(a => a.id === toast.id ? { ...a, acknowledged: true } : a));
                      setToasts(prev => prev.filter(t => t.id !== toast.id));
                    }}
                    className="text-[9px] bg-white/10 hover:bg-white/20 font-bold px-2 py-1 rounded transition-colors text-slate-200 uppercase tracking-wider cursor-pointer"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Header Section */}
        <header className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-serif italic tracking-tighter drop-shadow-sm flex items-center text-slate-800">
              VayuIQ <span className="font-sans not-italic font-bold tracking-tight text-slate-500 text-lg ml-2 pt-0.5">Intelligence</span>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Download size={14} className="text-slate-500" />
              {isDownloading ? 'GENERATING...' : 'EXPORT REPORT'}
            </button>
            <div className="flex bg-white rounded p-0.5 border border-slate-200 shadow-sm">
              <select 
                className="bg-transparent text-xs text-slate-700 outline-none px-2 py-1 font-medium cursor-pointer"
                value={language} onChange={e => setLanguage(e.target.value as any)}
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>
            </div>
          </div>
        </header>

        {/* Main Dashboard Grid */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-y-auto lg:overflow-hidden h-[calc(100vh-85px)]">
          {/* LEFT COLUMN: Map */}
          <div className="col-span-1 lg:col-span-3 flex flex-col gap-4 min-w-0 lg:max-h-full lg:overflow-y-auto pr-1">
            <MapExplorer />
          </div>

          {/* CENTER COLUMN: Forecast & Multi-City */}
          <div className="col-span-1 lg:col-span-6 flex flex-col gap-4 min-w-0 lg:max-h-full lg:overflow-y-auto pr-1">
            <HyperlocalForecast />
            <WeatherModule />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
              <SourceAttribution />
              <MultiCityCompare />
            </div>
          </div>

          {/* RIGHT COLUMN: Enforcement & Health */}
          <div className="col-span-1 lg:col-span-3 flex flex-col gap-4 min-w-0 lg:max-h-full lg:overflow-y-auto pr-1">
            <AlertingServiceModule />
            <EnforcementIntelligence />
            <CitizenHealthAdvisory />
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
}

/* =========================================
   MODULE 1: Map & Ward Explorer (Pure UI)
   ========================================= */
const sparklineStyles = `
@keyframes drawSparkline {
  from {
    stroke-dashoffset: 80;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes growBar {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
.shimmer-bg {
  background: linear-gradient(90deg, rgba(241, 245, 249, 0.4) 25%, rgba(255, 255, 255, 0.8) 50%, rgba(241, 245, 249, 0.4) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
`;

function TextSkeleton({ lines = 2, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 py-1 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded shimmer-bg bg-slate-200/50"
          style={{ width: i === lines - 1 && lines > 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  );
}

function WardButton({ ward, isSelected, onClick }: { ward: WardData; isSelected: boolean; onClick: () => void; key?: string | number }) {
  const [isHovered, setIsHovered] = useState(false);
  const currentAqi = ward.history[ward.history.length - 1];
  const color = getAQIColor(currentAqi);

  // Generate sparkline path points
  const sparklineData = useMemo(() => {
    const last12 = ward.history.slice(-12); // Use last 12h for sparkline density
    const min = Math.min(...last12);
    const max = Math.max(...last12);
    const range = max - min || 1;
    const width = 50;
    const height = 16;
    const pts = last12.map((val, i) => {
      const x = (i / (last12.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    
    // Calculate trend direction
    const trend = last12[last12.length - 1] - last12[0];
    return { pts, trend };
  }, [ward.history]);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex items-center justify-between p-2 rounded-lg border text-left transition-all duration-300 cursor-pointer select-none ${
        isSelected 
          ? 'bg-white/95 border-sky-400 shadow-[0_2px_8px_rgba(56,189,248,0.2)] text-slate-900' 
          : 'bg-white/30 hover:bg-white/60 border-white/40 text-slate-700 hover:text-slate-900 hover:translate-y-[-1px] hover:shadow-sm'
      }`}
    >
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[10px] font-bold truncate pr-1">{ward.name}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ backgroundColor: color }}
          />
          <span className="text-[10px] font-extrabold text-slate-800">{currentAqi}</span>
        </div>
      </div>

      {/* Sparkline trend representation */}
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <div className="relative w-[50px] h-4 flex items-center">
          <svg className="w-[50px] h-4 overflow-visible" viewBox="0 0 50 16">
            {/* Background baseline */}
            <line x1="0" y1="8" x2="50" y2="8" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="1 2" opacity="0.6" />
            <polyline
              fill="none"
              stroke={isHovered ? color : '#64748B'}
              strokeWidth={isHovered ? "1.8" : "1.2"}
              points={sparklineData.pts}
              className="transition-all duration-300"
              style={{
                strokeDasharray: 80,
                strokeDashoffset: isHovered ? 0 : 80,
                animation: isHovered ? 'drawSparkline 0.8s ease-out forwards' : 'none',
              }}
            />
          </svg>
        </div>
        {sparklineData.trend > 0 ? (
          <ArrowUp size={8} className={`text-red-500 shrink-0 ${isHovered ? 'animate-bounce' : ''}`} />
        ) : sparklineData.trend < 0 ? (
          <ArrowDown size={8} className={`text-emerald-500 shrink-0 ${isHovered ? 'animate-bounce' : ''}`} />
        ) : null}
      </div>

      {/* Embedded Sparkline Tooltip on Hover */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/95 backdrop-blur-md text-white rounded-lg p-2.5 shadow-xl border border-slate-700/50 z-[9999] pointer-events-none flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="flex justify-between items-center text-[9px] text-slate-300 uppercase tracking-wider font-extrabold">
            <span>{ward.name} 12h Trend</span>
            <span style={{ color: color }}>AQI {currentAqi}</span>
          </div>
          <div className="h-10 w-full flex items-end justify-between gap-0.5 pt-1">
            {ward.history.slice(-12).map((hVal, hIdx) => {
              const hColor = getAQIColor(hVal);
              const heightPct = Math.max(10, Math.min(100, (hVal / 450) * 100));
              return (
                <div key={hIdx} className="flex-1 flex flex-col items-center gap-1 group/bar">
                  <div 
                    className="w-full rounded-t-sm transition-all duration-500 origin-bottom"
                    style={{ 
                      height: `${heightPct}%`, 
                      backgroundColor: hColor,
                      animation: 'growBar 0.5s ease-out forwards',
                      animationDelay: `${hIdx * 25}ms`
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] text-slate-400 font-bold">
            <span>-12h</span>
            <span>Current AQI</span>
          </div>
        </div>
      )}
    </button>
  );
}

function MapExplorer() {
  const { selectedWard, setSelectedWard, dataset } = useContext(AppContext);
  const cities = ['Delhi', 'Mumbai', 'Kolkata', 'Bengaluru', 'Chennai'];
  const [activeCity, setActiveCity] = useState('Delhi');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHeatmap, setShowHeatmap] = useState(true);

  const cityWards = dataset.filter(w => w.city === activeCity && w.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex-1 bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col shadow-sm min-w-0 hover:shadow-md/40 transition-all duration-300 relative">
      <style>{sparklineStyles}</style>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">City Ward Explorer</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded shadow-sm border transition-colors ${showHeatmap ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white/50 text-slate-600 border-white/60'}`}
          >
            <Flame size={12} className={showHeatmap ? "text-orange-500" : "text-slate-400"} />
            Incident Heatmap
          </button>
          <span className="text-[10px] bg-white/50 px-2 py-0.5 rounded text-slate-700 shadow-sm">{activeCity} NCR</span>
        </div>
      </div>
      {/* City Selector */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory" style={{ WebkitOverflowScrolling: 'touch' }}>
        {cities.map(c => (
          <button 
            key={c} onClick={() => { setActiveCity(c); setSearchQuery(''); }}
            className={`flex-shrink-0 snap-start px-3 py-2 min-h-[44px] text-[10px] font-bold rounded whitespace-nowrap transition-colors shadow-sm ${activeCity === c ? 'bg-white/80 text-sky-700 border border-white' : 'bg-white/30 text-slate-600 hover:bg-white/50 border border-transparent'}`}
          >
            {c}
          </button>
        ))}
      </div>
      
      {/* Search Filter */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          <Search size={14} className="text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search wards in ${activeCity}...`}
          className="w-full bg-white/50 border border-white/60 rounded-md py-1.5 pl-8 pr-3 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-400 placeholder-slate-500 shadow-sm"
        />
      </div>

      {/* Ward Directory Grid */}
      <div className="mb-4">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-center px-0.5">
          <span>Ward Directory</span>
          <span className="text-[9px] text-slate-400 font-normal">Hover for 12h trend</span>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-[145px] overflow-y-auto pr-1 scrollbar-hide">
          {cityWards.map(ward => (
            <WardButton 
              key={ward.id} 
              ward={ward} 
              isSelected={selectedWard?.id === ward.id} 
              onClick={() => setSelectedWard(ward)} 
            />
          ))}
          {cityWards.length === 0 && (
            <div className="col-span-2 text-center py-4 text-[10px] text-slate-500 bg-white/20 border border-dashed border-slate-300 rounded-lg">
              No wards found matching search
            </div>
          )}
        </div>
      </div>

      {/* Real Google Map Visual */}
      <div className="flex-1 w-full relative rounded overflow-hidden min-h-[300px]">
        <APIProvider apiKey="AIzaSyDZF9C7vFEH851FmQBP7ivFmluOOmOdg4s">
          <Map
            center={{ lat: cityWards[0]?.lat || 28.6139, lng: cityWards[0]?.lng || 77.2090 }}
            defaultZoom={11}
            mapId="DEMO_MAP_ID"
            style={{ width: '100%', height: '100%' }}
            disableDefaultUI={true}
            gestureHandling={'greedy'}
          >
            {cityWards.map(ward => {
              const currentAqi = ward.history[ward.history.length - 1];
              const color = getAQIColor(currentAqi);
              const isSelected = selectedWard?.id === ward.id;
              
              // Calculate trend over the last 3 hours compared to previous 3 hours
              const last3 = ward.history.slice(-3);
              const prev3 = ward.history.slice(-6, -3);
              const last3Avg = last3.reduce((a, b) => a + b, 0) / 3;
              const prev3Avg = prev3.reduce((a, b) => a + b, 0) / 3;
              const trend = last3Avg - prev3Avg;
              
              return (
                <AdvancedMarker 
                  key={ward.id} 
                  position={{ lat: ward.lat, lng: ward.lng }}
                  onClick={() => setSelectedWard(ward)}
                  zIndex={isSelected ? 100 : 1}
                  title={`${ward.name}: ${currentAqi}`}
                >
                  <div className="relative flex flex-col items-center">
                    <Pin 
                      background={color} 
                      borderColor={isSelected ? '#ffffff' : color} 
                      glyphColor="#ffffff" 
                      scale={isSelected ? 1.3 : 1}
                    />
                    <div className={`absolute top-full mt-0.5 bg-white/95 px-1 py-0.5 rounded text-[9px] font-bold whitespace-nowrap z-50 flex items-center gap-0.5 text-slate-800 border transition-all duration-500 ${Math.abs(trend) > 3 ? (trend > 0 ? 'border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]') : 'border-slate-200 shadow-sm'}`}>
                      {currentAqi}
                      {trend > 0.5 ? (
                        <ArrowUp size={8} className={`text-red-500 ${trend > 3 ? 'animate-pulse' : ''}`} />
                      ) : trend < -0.5 ? (
                        <ArrowDown size={8} className={`text-emerald-500 ${trend < -3 ? 'animate-pulse' : ''}`} />
                      ) : null}
                    </div>
                  </div>
                </AdvancedMarker>
              );
            })}
            
            {showHeatmap && cityWards.map(ward => {
              const intensity = ward.proxies.wasteBurningIncidents + ward.proxies.constructionPermits;
              if (intensity === 0) return null;
              
              // Scale radius logically. E.g., intensity 1->30px, 15->120px
              const radius = Math.min(25 + intensity * 6, 120);
              const opacity = Math.min(0.2 + intensity * 0.05, 0.6);
              
              return (
                <AdvancedMarker
                  key={`heatmap-${ward.id}`}
                  position={{ lat: ward.lat, lng: ward.lng }}
                  zIndex={0}
                >
                  <div 
                    className="rounded-full bg-orange-500 pointer-events-none mix-blend-multiply"
                    style={{ 
                       width: `${radius}px`, 
                       height: `${radius}px`, 
                       transform: 'translateY(50%)',
                       opacity: opacity,
                       boxShadow: `0 0 ${radius/2}px rgba(249, 115, 22, ${opacity})`
                    }}
                  />
                </AdvancedMarker>
              );
            })}

            {selectedWard && selectedWard.city === activeCity && (
              <InfoWindow
                position={{ lat: selectedWard.lat, lng: selectedWard.lng }}
                onCloseClick={() => setSelectedWard(null)}
              >
                <div className="p-2 min-w-[120px]">
                  <div className="font-bold text-slate-800 text-xs mb-1">{selectedWard.name}</div>
                  <div className="flex justify-between text-[10px] text-slate-600 mb-2 pb-1 border-b border-slate-200">
                    <span>AQI: <span className="font-bold text-slate-800">{selectedWard.history[selectedWard.history.length - 1]}</span></span>
                    <span className="flex items-center gap-0.5">
                      Trend: 
                      {(() => {
                        const last3 = selectedWard.history.slice(-3);
                        const prev3 = selectedWard.history.slice(-6, -3);
                        const trend = (last3.reduce((a, b) => a + b, 0) / 3) - (prev3.reduce((a, b) => a + b, 0) / 3);
                        return trend > 0.5 ? <ArrowUp size={10} className="text-red-500" /> : trend < -0.5 ? <ArrowDown size={10} className="text-green-500" /> : <span className="text-slate-400">-</span>;
                      })()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-600">
                    <div className="flex items-center gap-1">
                      <Thermometer size={10} className="text-orange-500" />
                      {(20 + (selectedWard.id.charCodeAt(selectedWard.id.length - 1) % 15) + (selectedWard.history[23] % 5) * 0.5).toFixed(1)}°C
                    </div>
                    <div className="flex items-center gap-1">
                      <Droplets size={10} className="text-blue-500" />
                      {(40 + (selectedWard.id.charCodeAt(selectedWard.id.length - 1) % 40) + (selectedWard.history[23] % 10)).toFixed(0)}%
                    </div>
                    <div className="flex items-center gap-1 col-span-2">
                      <Wind size={10} className="text-slate-400" />
                      {(5 + (selectedWard.id.charCodeAt(selectedWard.id.length - 1) % 20) + (selectedWard.history[23] % 8) * 0.5).toFixed(1)} km/h
                    </div>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>
      
      {/* Floating Legend */}
      <div className="absolute top-1/2 left-4 md:left-auto md:right-4 -translate-y-1/2 bg-white/80 backdrop-blur-md border border-white/60 p-2 rounded-md shadow-lg pointer-events-none hidden lg:flex flex-col gap-1.5 z-20">
        <div className="text-[9px] font-bold text-slate-700 uppercase mb-1">AQI Scale</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: '#22c55e'}}></div><span className="text-[10px] text-slate-800">Good (0-50)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: '#eab308'}}></div><span className="text-[10px] text-slate-800">Satisfactory (51-100)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: '#f97316'}}></div><span className="text-[10px] text-slate-800">Moderate (101-200)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: '#ef4444'}}></div><span className="text-[10px] text-slate-800">Poor (201-300)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: '#881337'}}></div><span className="text-[10px] text-slate-800">Severe (300+)</span></div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-white/40">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-slate-600">Selected Ward:</span>
          <span className="text-slate-900 font-bold">{selectedWard?.name || 'None'}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-600">Current AQI:</span>
          <span className="text-red-600 font-bold">{selectedWard?.history[selectedWard.history.length - 1]}</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   MODULE 2: Source Attribution Agent
   ========================================= */
function SourceAttribution() {
  const { selectedWard, scenarioAdjustments, setScenarioAdjustments } = useContext(AppContext);
  const [agentData, setAgentData] = useState<{summary: string, confidence: string}|null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'scenario'>('current');

  // Original, unadjusted sources
  const currentSources = useMemo(() => {
    if (!selectedWard) return [];
    const p = selectedWard.proxies;
    const total = p.trafficDensity + (p.constructionPermits * 5) + (p.industrialStacks * 10) + (p.wasteBurningIncidents * 15);
    if (total === 0) return [];
    return [
      { name: 'Vehicular', value: Math.round((p.trafficDensity / total) * 100), color: '#3b82f6' },
      { name: 'Construction', value: Math.round(((p.constructionPermits * 5) / total) * 100), color: '#eab308' },
      { name: 'Industrial', value: Math.round(((p.industrialStacks * 10) / total) * 100), color: '#ef4444' },
      { name: 'Waste Burning', value: Math.round(((p.wasteBurningIncidents * 15) / total) * 100), color: '#a855f7' },
    ].filter(s => s.value > 0);
  }, [selectedWard]);

  // Adjusted sources based on scenario sliders
  const scenarioSources = useMemo(() => {
    if (!selectedWard) return [];
    const p = selectedWard.proxies;
    const vehVal = p.trafficDensity * (1 + scenarioAdjustments.vehicular / 100);
    const constVal = (p.constructionPermits * 5) * (1 + scenarioAdjustments.construction / 100);
    const indVal = (p.industrialStacks * 10) * (1 + scenarioAdjustments.industrial / 100);
    const wasteVal = (p.wasteBurningIncidents * 15) * (1 + scenarioAdjustments.waste / 100);
    
    const total = vehVal + constVal + indVal + wasteVal;
    if (total === 0) return [];
    
    return [
      { name: 'Vehicular', value: Math.round((vehVal / total) * 100), color: '#3b82f6' },
      { name: 'Construction', value: Math.round((constVal / total) * 100), color: '#eab308' },
      { name: 'Industrial', value: Math.round((indVal / total) * 100), color: '#ef4444' },
      { name: 'Waste Burning', value: Math.round((wasteVal / total) * 100), color: '#a855f7' },
    ].filter(s => s.value > 0);
  }, [selectedWard, scenarioAdjustments]);

  // Use scenario sources when in scenario mode
  const activeSources = activeTab === 'scenario' ? scenarioSources : currentSources;

  // Compute AQI impact
  const localMultiplier = useMemo(() => {
    if (!selectedWard) return 1;
    const p = selectedWard.proxies;
    
    const w_vehicular = p.trafficDensity * 1.0;
    const w_construction = p.constructionPermits * 5.0;
    const w_industrial = p.industrialStacks * 10.0;
    const w_waste = p.wasteBurningIncidents * 15.0;
    
    const totalWeight = w_vehicular + w_construction + w_industrial + w_waste;
    if (totalWeight === 0) return 1;
    
    const adjustedWeight = 
      w_vehicular * (1 + scenarioAdjustments.vehicular / 100) +
      w_construction * (1 + scenarioAdjustments.construction / 100) +
      w_industrial * (1 + scenarioAdjustments.industrial / 100) +
      w_waste * (1 + scenarioAdjustments.waste / 100);
      
    return adjustedWeight / totalWeight;
  }, [selectedWard, scenarioAdjustments]);

  const currentAqi = selectedWard ? selectedWard.history[selectedWard.history.length - 1] : 0;
  const theoreticalAqi = Math.max(0, Math.round(currentAqi * (0.3 + 0.7 * localMultiplier)));
  const percentChange = currentAqi > 0 ? Math.round(((theoreticalAqi - currentAqi) / currentAqi) * 100) : 0;

  useEffect(() => {
    if (!selectedWard) return;
    setAgentData(null);
    const percentages = Object.fromEntries(activeSources.map(s => [s.name, s.value]));
    Agents.analyzeSources(percentages).then(setAgentData);
  }, [selectedWard, activeSources]);

  const handlePreset = (type: 'green' | 'traffic' | 'heavy' | 'reset') => {
    if (type === 'green') {
      setScenarioAdjustments({ vehicular: -30, construction: -20, industrial: -50, waste: -80 });
    } else if (type === 'traffic') {
      setScenarioAdjustments({ vehicular: 50, construction: 0, industrial: 0, waste: 0 });
    } else if (type === 'heavy') {
      setScenarioAdjustments({ vehicular: -10, construction: 30, industrial: 40, waste: 20 });
    } else {
      setScenarioAdjustments({ vehicular: 0, construction: 0, industrial: 0, waste: 0 });
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col shadow-sm min-w-0 hover:shadow-md/40 transition-all duration-300">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <Sliders size={13} className="text-sky-500" />
          Source Attribution &amp; Sandbox
        </h2>
        {/* Tab switchers */}
        <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/40">
          <button
            onClick={() => setActiveTab('current')}
            className={`text-[9px] font-bold px-2 py-1 rounded-md transition-all ${
              activeTab === 'current'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Current
          </button>
          <button
            onClick={() => setActiveTab('scenario')}
            className={`text-[9px] font-bold px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
              activeTab === 'scenario'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sandbox
            {(scenarioAdjustments.vehicular !== 0 || scenarioAdjustments.construction !== 0 || scenarioAdjustments.industrial !== 0 || scenarioAdjustments.waste !== 0) && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'current' ? (
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={activeSources} cx="50%" cy="50%" innerRadius={30} outerRadius={40} dataKey="value" stroke="none" paddingAngle={2}>
                  {activeSources.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '8px', fontSize: '10px', color: '#0f172a' }} itemStyle={{ color: '#0f172a' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
              <span className="text-[10px] text-slate-600 leading-none">{agentData?.confidence || '--'}</span>
              <span className="text-[8px] text-slate-500 font-bold leading-none mt-0.5">CONF.</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {activeSources.map((s) => (
              <div key={s.name} className="flex justify-between text-[10px]">
                <span className="flex items-center gap-1 text-slate-700">
                  <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: s.color }}></div> {s.name}
                </span>
                <span className="text-slate-900 font-bold">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Theoretical Impact Metric */}
          <div className="bg-white/60 backdrop-blur-sm border border-white/50 p-2.5 rounded-lg flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Theoretical AQI</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base font-extrabold text-slate-800">{theoreticalAqi}</span>
                <span className="text-[10px] text-slate-500 font-bold">from {currentAqi}</span>
              </div>
            </div>
            <div className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 ${
              percentChange < 0 
                ? 'bg-emerald-100 text-emerald-800' 
                : percentChange > 0 
                  ? 'bg-rose-100 text-rose-800' 
                  : 'bg-slate-100 text-slate-600'
            }`}>
              {percentChange < 0 ? <ArrowDown size={10} /> : percentChange > 0 ? <ArrowUp size={10} /> : null}
              {percentChange > 0 ? `+${percentChange}%` : `${percentChange}%`}
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button
              onClick={() => handlePreset('green')}
              className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 rounded border border-emerald-500/20 cursor-pointer"
            >
              Eco-Drive (-30%)
            </button>
            <button
              onClick={() => handlePreset('traffic')}
              className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-2 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-800 rounded border border-sky-500/20 cursor-pointer"
            >
              Peak Commute (+50% Veh)
            </button>
            <button
              onClick={() => handlePreset('heavy')}
              className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 rounded border border-amber-500/20 cursor-pointer"
            >
              Industrial Surge
            </button>
            <button
              onClick={() => handlePreset('reset')}
              className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-1.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer"
              title="Reset Sandbox"
            >
              Reset
            </button>
          </div>

          {/* Sliders */}
          <div className="space-y-2 pt-1 border-t border-slate-200/40">
            {/* Vehicular */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
                  Vehicular Emissions
                </span>
                <span className={`text-[9px] font-extrabold ${scenarioAdjustments.vehicular < 0 ? 'text-emerald-600' : scenarioAdjustments.vehicular > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {scenarioAdjustments.vehicular > 0 ? `+${scenarioAdjustments.vehicular}%` : `${scenarioAdjustments.vehicular}%`}
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="5"
                value={scenarioAdjustments.vehicular}
                onChange={(e) => setScenarioAdjustments(prev => ({ ...prev, vehicular: Number(e.target.value) }))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* Construction */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#eab308' }}></div>
                  Construction Dust
                </span>
                <span className={`text-[9px] font-extrabold ${scenarioAdjustments.construction < 0 ? 'text-emerald-600' : scenarioAdjustments.construction > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {scenarioAdjustments.construction > 0 ? `+${scenarioAdjustments.construction}%` : `${scenarioAdjustments.construction}%`}
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="5"
                value={scenarioAdjustments.construction}
                onChange={(e) => setScenarioAdjustments(prev => ({ ...prev, construction: Number(e.target.value) }))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Industrial */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                  Industrial Emissions
                </span>
                <span className={`text-[9px] font-extrabold ${scenarioAdjustments.industrial < 0 ? 'text-emerald-600' : scenarioAdjustments.industrial > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {scenarioAdjustments.industrial > 0 ? `+${scenarioAdjustments.industrial}%` : `${scenarioAdjustments.industrial}%`}
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="5"
                value={scenarioAdjustments.industrial}
                onChange={(e) => setScenarioAdjustments(prev => ({ ...prev, industrial: Number(e.target.value) }))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            {/* Waste Burning */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#a855f7' }}></div>
                  Waste Incineration
                </span>
                <span className={`text-[9px] font-extrabold ${scenarioAdjustments.waste < 0 ? 'text-emerald-600' : scenarioAdjustments.waste > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {scenarioAdjustments.waste > 0 ? `+${scenarioAdjustments.waste}%` : `${scenarioAdjustments.waste}%`}
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="5"
                value={scenarioAdjustments.waste}
                onChange={(e) => setScenarioAdjustments(prev => ({ ...prev, waste: Number(e.target.value) }))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Dynamic AI Analysis Description */}
      {agentData ? (
        <p className="mt-3 text-[10px] text-slate-700 bg-white/50 p-2 rounded italic border border-white/30 shadow-sm flex items-start gap-1">
          <Sparkles size={11} className="text-sky-500 shrink-0 mt-0.5" />
          <span>"{agentData.summary}"</span>
        </p>
      ) : (
        <div className="mt-3 bg-white/50 p-2.5 rounded border border-white/30 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1.5 text-[9px] text-sky-600 font-bold uppercase tracking-wider">
            <Sparkles size={11} className="text-sky-500 animate-pulse" />
            AI Analyzing source vectors...
          </div>
          <TextSkeleton lines={2} />
        </div>
      )}
    </div>
  );
}

/* =========================================
   MODULE 3: Hyperlocal Forecast Agent
   ========================================= */
function HyperlocalForecast() {
  const { selectedWard, scenarioAdjustments } = useContext(AppContext);
  const [explanation, setExplanation] = useState<string>('');

  const isScenarioActive = scenarioAdjustments.vehicular !== 0 ||
                           scenarioAdjustments.construction !== 0 ||
                           scenarioAdjustments.industrial !== 0 ||
                           scenarioAdjustments.waste !== 0;

  const localMultiplier = useMemo(() => {
    if (!selectedWard) return 1;
    const p = selectedWard.proxies;
    
    const w_vehicular = p.trafficDensity * 1.0;
    const w_construction = p.constructionPermits * 5.0;
    const w_industrial = p.industrialStacks * 10.0;
    const w_waste = p.wasteBurningIncidents * 15.0;
    
    const totalWeight = w_vehicular + w_construction + w_industrial + w_waste;
    if (totalWeight === 0) return 1;
    
    const adjustedWeight = 
      w_vehicular * (1 + scenarioAdjustments.vehicular / 100) +
      w_construction * (1 + scenarioAdjustments.construction / 100) +
      w_industrial * (1 + scenarioAdjustments.industrial / 100) +
      w_waste * (1 + scenarioAdjustments.waste / 100);
      
    return adjustedWeight / totalWeight;
  }, [selectedWard, scenarioAdjustments]);

  const chartData = useMemo(() => {
    if (!selectedWard) return [];
    const hist = selectedWard.history;
    const data = [];
    
    // Last 24 hours of history
    for(let i = 24; i > 0; i--) {
      data.push({ 
        time: `-${i}h`, 
        actual: hist[hist.length - i], 
        forecast: null, 
        scenarioForecast: null, 
        lower: null, 
        upper: null 
      });
    }

    // Next 72 hours (Deterministic Seasonal-Naive + Damped Trend)
    const recentMean = hist.slice(-24).reduce((a,b)=>a+b,0)/24;
    const prevMean = hist.slice(-48, -24).reduce((a,b)=>a+b,0)/24;
    const trend = recentMean - prevMean;

    let lastAqi = hist[hist.length - 1];
    for (let i = 0; i < 72; i++) {
      const seasonalBase = hist[hist.length - 24 + (i % 24)];
      const dampedTrend = trend * Math.pow(0.9, i); // Damped
      const fcast = Math.max(0, Math.round(seasonalBase + dampedTrend));
      
      const scenarioFcast = Math.max(0, Math.round(fcast * (0.3 + 0.7 * localMultiplier)));
      
      data.push({ 
        time: `+${i+1}h`, 
        actual: i===0 ? lastAqi : null, 
        forecast: fcast,
        scenarioForecast: isScenarioActive ? scenarioFcast : null,
        lower: Math.max(0, fcast - (10 + i * 0.5)),
        upper: fcast + (10 + i * 0.5)
      });
    }
    return data;
  }, [selectedWard, localMultiplier, isScenarioActive]);

  useEffect(() => {
    setExplanation('');
    if (!chartData || chartData.length === 0 || !chartData[chartData.length - 1] || !chartData[23]) {
      return;
    }
    const targetForecastValue = isScenarioActive ? (chartData[chartData.length-1].scenarioForecast || 0) : chartData[chartData.length-1].forecast;
    Agents.explainForecast(
      targetForecastValue > chartData[23].actual ? "Deteriorating" : "Improving",
      "Low wind speed, thermal inversion expected"
    ).then(res => res && setExplanation(res.explanation));
  }, [chartData, isScenarioActive]);

  return (
    <div className="h-[300px] bg-white border border-slate-200/80 rounded-xl p-5 flex flex-col relative shadow-sm min-w-0 hover:shadow-md/40 transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">72-Hour Hyperlocal Forecast - {selectedWard?.name}</h2>
          <div className="text-2xl font-light text-slate-900">
            {isScenarioActive ? (
              <span className="flex items-baseline gap-1.5">
                <span className="text-rose-600 font-bold">{Math.max(0, Math.round((chartData[23]?.actual || 0) * (0.3 + 0.7 * localMultiplier)))}</span>
                <span className="text-xs text-slate-500 font-normal line-through">({chartData[23]?.actual || '--'})</span>
                <span className="text-[10px] text-rose-500 font-extrabold uppercase tracking-widest bg-rose-50 px-1 py-0.5 rounded border border-rose-200">Sandbox</span>
              </span>
            ) : (
              <span>{chartData[23]?.actual || '--'} <span className="text-sm text-slate-500 uppercase">Avg AQI</span></span>
            )}
          </div>
        </div>
        <div className="hidden sm:block bg-white/60 backdrop-blur-sm p-2.5 rounded-lg border border-white/50 max-w-[200px] lg:max-w-[250px] shadow-sm">
           <div className="text-[10px] font-bold text-sky-600 mb-1.5 flex items-center gap-1">
             <Activity size={10} className={!explanation ? "animate-pulse" : ""} /> METEOROLOGY AGENT
           </div>
           {explanation ? (
             <p className="text-[10px] text-slate-700 leading-snug italic">"{explanation}"</p>
           ) : (
             <div className="space-y-1.5">
               <div className="text-[8px] text-sky-500 font-extrabold uppercase tracking-wide flex items-center gap-1 animate-pulse">
                 Calculating outlook...
               </div>
               <TextSkeleton lines={3} />
             </div>
           )}
        </div>
      </div>
      <div className="flex-1 w-full min-h-[150px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#cbd5e1" vertical={false} />
            <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '8px', fontSize: '12px', color: '#0f172a' }} itemStyle={{ color: '#0f172a' }} />
            <Area type="monotone" dataKey="upper" stroke="none" fill="#3B82F6" fillOpacity={0.15} />
            <Area type="monotone" dataKey="lower" stroke="none" fill="#ffffff" fillOpacity={0.5} />
            <Line type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={3} dot={false} name="Historical AQI" />
            <Line type="monotone" dataKey="forecast" stroke="#3B82F6" strokeWidth={3} strokeDasharray="6 4" dot={false} name="Forecast AQI" />
            {isScenarioActive && (
              <Line type="monotone" dataKey="scenarioForecast" stroke="#EC4899" strokeWidth={3} strokeDasharray="3 3" dot={false} name="Scenario Forecast" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* =========================================
   NEW MODULE: Local Environment Weather
   ========================================= */
function WeatherModule() {
  const { selectedWard } = useContext(AppContext);

  // Synthetic data based on ward ID to keep it somewhat stable but varied
  const seed = selectedWard ? selectedWard.id.charCodeAt(selectedWard.id.length - 1) : 0;
  const temp = (20 + (seed % 15) + (selectedWard ? selectedWard.history[23] % 5 : 0) * 0.5).toFixed(1);
  const humidity = (40 + (seed % 40) + (selectedWard ? selectedWard.history[23] % 10 : 0)).toFixed(0);
  const wind = (5 + (seed % 20) + (selectedWard ? selectedWard.history[23] % 8 : 0) * 0.5).toFixed(1);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col shadow-sm min-w-0 hover:shadow-md/40 transition-all duration-300">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
        <Wind size={14} className="text-sky-500" />
        Local Environment Data
      </h2>
      
      {selectedWard ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/50 rounded-lg p-3 text-center flex flex-col items-center justify-center border border-white/40 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Thermometer size={18} className="text-rose-500 mb-1" />
            <div className="text-lg font-light text-slate-800">{temp}°<span className="text-xs font-bold">C</span></div>
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Temperature</div>
          </div>
          <div className="bg-white/50 rounded-lg p-3 text-center flex flex-col items-center justify-center border border-white/40 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Droplets size={18} className="text-blue-500 mb-1" />
            <div className="text-lg font-light text-slate-800">{humidity}<span className="text-xs font-bold">%</span></div>
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Humidity</div>
          </div>
          <div className="bg-white/50 rounded-lg p-3 text-center flex flex-col items-center justify-center border border-white/40 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Wind size={18} className="text-teal-500 mb-1" />
            <div className="text-lg font-light text-slate-800">{wind} <span className="text-xs font-bold">km/h</span></div>
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Wind Speed</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-500 h-[80px]">
          Select a ward to view local environment data
        </div>
      )}
    </div>
  );
}

/* =========================================
   MODULE 7: Alerting Service Module
   ========================================= */
function AlertingServiceModule() {
  const { 
    alerts, 
    setAlerts, 
    toasts, 
    setToasts, 
    isMonitoring, 
    setIsMonitoring, 
    soundEnabled, 
    setSoundEnabled,
    dataset,
    setDataset,
    setSelectedWard
  } = useContext(AppContext);

  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestPermission = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(permission => {
      setNotificationPermission(permission);
    });
  };

  const handleSimulateSpike = () => {
    const randomIdx = Math.floor(Math.random() * dataset.length);
    const targetWard = dataset[randomIdx];
    
    const spikedHistory = [...targetWard.history];
    const spikeHourOffset = 12 + Math.floor(Math.random() * 24); // spikes in +12h to +36h
    const spikeAqi = 310 + Math.floor(Math.random() * 80); // 310 to 390
    
    for (let i = 1; i <= 24; i++) {
       spikedHistory[spikedHistory.length - i] += 120; // boost overall
    }
    const targetSeasonalIdx = spikedHistory.length - 24 + ((spikeHourOffset - 1) % 24);
    spikedHistory[targetSeasonalIdx] = spikeAqi - 15;

    const updatedDataset = dataset.map((w, idx) => {
       if (idx === randomIdx) {
          return {
             ...w,
             history: spikedHistory,
             proxies: {
                ...w.proxies,
                wasteBurningIncidents: Math.max(w.proxies.wasteBurningIncidents, 4),
                industrialStacks: Math.max(w.proxies.industrialStacks, 12)
             }
          };
       }
       return w;
    });

    setDataset(updatedDataset);
    setSelectedWard(updatedDataset[randomIdx]);
  };

  const handleClearAlerts = () => {
     setAlerts([]);
     setToasts([]);
  };

  const activeAlerts = alerts.filter(a => !a.acknowledged);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col shadow-sm min-w-0 hover:shadow-md/40 transition-all duration-300">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <Bell size={14} className={activeAlerts.length > 0 ? "text-rose-500 animate-bounce" : "text-slate-400"} />
          Forecast Guard Alerting
        </h2>
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${isMonitoring ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}></span>
          <span className="text-[9px] text-slate-500 uppercase font-bold">{isMonitoring ? "Live Checking" : "Paused"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`flex items-center justify-center gap-1 text-[10px] py-1.5 px-2 rounded font-bold transition-all border cursor-pointer ${isMonitoring ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"}`}
        >
          {isMonitoring ? <BellOff size={11} /> : <Bell size={11} />}
          {isMonitoring ? "MUTE SCANNER" : "RESUME SCANNER"}
        </button>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`flex items-center justify-center gap-1 text-[10px] py-1.5 px-2 rounded font-bold transition-all border cursor-pointer ${soundEnabled ? "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"}`}
        >
          {soundEnabled ? <VolumeX size={11} /> : <Volume2 size={11} />}
          {soundEnabled ? "SOUND ON" : "SOUND MUTED"}
        </button>
      </div>

      <div className="flex flex-col gap-1.5 bg-white/60 p-2.5 rounded-lg border border-slate-100/50 mb-3 shadow-inner">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-500 font-bold uppercase tracking-wider">Browser Popups:</span>
          {notificationPermission === 'default' ? (
            <button 
              onClick={requestPermission} 
              className="bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm cursor-pointer uppercase transition-colors"
            >
              Authorize
            </button>
          ) : (
            <span className={`font-bold uppercase tracking-wider ${notificationPermission === 'granted' ? 'text-emerald-600' : 'text-slate-400'}`}>
              {notificationPermission}
            </span>
          )}
        </div>

        <button
          onClick={handleSimulateSpike}
          className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white text-[10px] font-extrabold py-1.5 px-3 rounded shadow-sm uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1 transition-all"
        >
          <Sparkles size={11} />
          Simulate Severe AQI Event
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-[140px] max-h-[220px]">
         <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">
           <span>Projected Breaches (&gt;300 AQI)</span>
           {alerts.length > 0 && (
             <button 
               onClick={handleClearAlerts}
               className="text-slate-400 hover:text-rose-500 flex items-center gap-0.5 cursor-pointer font-bold"
             >
               <Trash2 size={10} /> Clear All
             </button>
           )}
         </div>

         {activeAlerts.length === 0 ? (
           <div className="flex-1 border border-dashed border-slate-200/80 rounded-lg flex flex-col items-center justify-center p-4 bg-slate-50/30">
              <span className="text-[10px] font-medium text-slate-400 text-center">No projected severe breaches. Safey thresholds intact.</span>
           </div>
         ) : (
           <div className="space-y-2 overflow-y-auto pr-1 flex-1 scrollbar-hide">
             {activeAlerts.map(alert => (
                <div key={alert.id} className="bg-rose-50/60 border border-rose-100 rounded-lg p-2.5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-extrabold text-slate-800 leading-tight truncate max-w-[140px]">{alert.wardName}</span>
                    <span className="text-[8px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-1 py-0.2 rounded uppercase">Severe ({alert.peakAqi})</span>
                  </div>
                  <div className="text-[9px] text-slate-500 mb-2">
                    City: <span className="font-bold text-slate-700">{alert.city}</span> • Triggered {alert.timestamp}
                  </div>
                  <p className="text-[10px] text-slate-700 leading-snug mb-2 italic">
                     "Peak <span className="text-rose-600 font-bold">{alert.peakAqi} AQI</span> expected in <span className="text-amber-600 font-bold">+{alert.projectedHour}h</span>. Activate Grap-IV rules."
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                         const ward = dataset.find(w => w.id === alert.wardId);
                         if (ward) setSelectedWard(ward);
                      }}
                      className="text-[8px] bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded cursor-pointer uppercase"
                    >
                      Locate
                    </button>
                    <button 
                      onClick={() => {
                        setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, acknowledged: true } : a));
                      }}
                      className="text-[8px] bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold px-1.5 py-0.5 rounded cursor-pointer uppercase"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
             ))}
           </div>
         )}
      </div>
    </div>
  );
}

/* =========================================
   MODULE 4: Enforcement Intelligence Agent
   ========================================= */
function EnforcementIntelligence() {
  const { dataset } = useContext(AppContext);
  const [justifications, setJustifications] = useState<any[]>([]);
  
  const topTargets = useMemo(() => {
    return dataset.map(ward => {
      const aqi = ward.history[ward.history.length - 1];
      const p = ward.proxies;
      // Deterministic Weighted Sum
      const score = (aqi * 0.4) + (p.industrialStacks * 15) + (p.wasteBurningIncidents * 20) + (p.constructionPermits * 5);
      return { id: ward.id, name: ward.name, score: Math.round(score), aqi, sourceWeight: p.industrialStacks > 5 ? 'Industrial' : 'Mixed' };
    }).sort((a,b) => b.score - a.score).slice(0, 5);
  }, [dataset]);

  useEffect(() => {
    setJustifications([]);
    Agents.justifyEnforcement(topTargets).then(res => res && setJustifications(res));
  }, [topTargets]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col shadow-sm min-w-0 hover:shadow-md/40 transition-all duration-300">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
        <ShieldAlert size={14} /> AI Inspection Targets
      </h2>
      <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-hide">
        {topTargets.map((target, idx) => {
          const aiData = justifications.find(j => j.siteId === target.id);
          const aiText = aiData?.justification;
          const urgency = aiData?.urgency || 'Pending...';
          const action = aiData?.recommendedAction || 'Calculating...';
          const confidence = aiData?.evidenceConfidence || 0;
          
          const getUrgencyColor = (u: string) => {
            if (u === 'Critical') return 'bg-red-500 text-white';
            if (u === 'High') return 'bg-orange-500 text-white';
            if (u === 'Medium') return 'bg-amber-400 text-slate-800';
            return 'bg-slate-400 text-white';
          };
          
          const getUrgencyBorder = (u: string) => {
            if (u === 'Critical') return 'border-red-500';
            if (u === 'High') return 'border-orange-500';
            if (u === 'Medium') return 'border-amber-400';
            return 'border-slate-300';
          };

          return (
            <div key={target.id} className={`bg-white/60 border-l-[3px] ${aiData ? getUrgencyBorder(urgency) : 'border-slate-200'} p-3 rounded shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                   <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[11px] font-extrabold text-slate-900 tracking-tight">{idx + 1}. {target.name}</span>
                      {aiData ? (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${getUrgencyColor(urgency)}`}>{urgency}</span>
                      ) : (
                        <div className="w-10 h-3.5 rounded shimmer-bg bg-slate-200/50" />
                      )}
                   </div>
                   <div className="text-[9px] text-slate-500 font-medium">Source: {target.sourceWeight} • AQI {target.aqi}</div>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[12px] font-mono font-bold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/50">{target.score}</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Priority</span>
                </div>
              </div>
              
              <div className="bg-slate-50/80 rounded p-2 mb-2 border border-slate-100/80">
                {aiText ? (
                  <p className="text-[10px] text-slate-700 leading-snug">"{aiText}"</p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[8px] text-indigo-500 font-extrabold uppercase tracking-wide flex items-center gap-1 animate-pulse">
                      <Activity size={9} /> Evaluating site data...
                    </div>
                    <TextSkeleton lines={2} />
                  </div>
                )}
              </div>

              {aiData ? (
                 <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                    <div className="flex flex-col flex-1 pr-2">
                       <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Action Plan</span>
                       <span className="text-[9px] font-bold text-sky-700 flex items-center gap-1 bg-sky-50/50 px-1.5 py-1 rounded inline-block w-fit">
                          <ShieldAlert size={10} className="text-sky-500 inline-block mr-0.5"/>
                          {action}
                       </span>
                    </div>
                    <div className="flex flex-col items-end min-w-[70px]">
                       <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          Confidence
                       </span>
                       <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden flex items-center relative shadow-inner">
                          <div className={`h-full transition-all duration-1000 ${confidence > 80 ? 'bg-emerald-500' : confidence > 50 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${confidence}%` }}></div>
                       </div>
                       <span className="text-[8px] font-bold text-slate-600 mt-0.5">{confidence}% Match</span>
                    </div>
                 </div>
              ) : (
                 <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                    <div className="flex flex-col flex-1 pr-2">
                       <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Action Plan</span>
                       <div className="w-24 h-3 rounded shimmer-bg bg-slate-200/50" />
                    </div>
                    <div className="flex flex-col items-end min-w-[70px]">
                       <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Confidence</span>
                       <div className="w-12 h-2.5 rounded shimmer-bg bg-slate-200/50" />
                    </div>
                 </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================
   MODULE 5: Citizen Health Advisory Agent
   ========================================= */
function CitizenHealthAdvisory() {
  const { selectedWard, language } = useContext(AppContext);
  const [advisories, setAdvisories] = useState<Record<string, any>>({});
  const [activeGroup, setActiveGroup] = useState<string>('Schools');

  const groups = ['Schools', 'Hospitals', 'Elderly', 'Outdoor Workers'];
  
  useEffect(() => {
    if (!selectedWard) return;
    setAdvisories({});
    const currentAqi = selectedWard.history[selectedWard.history.length - 1];
    const band = currentAqi > 200 ? 'Severe' : currentAqi > 100 ? 'Moderate' : 'Good';
    
    groups.forEach(group => {
      Agents.generateAdvisory(selectedWard.id, group, band).then(data => {
        if(data) setAdvisories(prev => ({ ...prev, [group]: data }));
      });
    });
  }, [selectedWard]);

  const chartData = useMemo(() => {
    if (!selectedWard) return [];
    const last24 = selectedWard.history.slice(-24);
    const currentHour = new Date().getHours();
    
    return last24.map((aqi, i) => {
       const hourOffset = 23 - i;
       const hourValue = (currentHour - hourOffset + 24) % 24;
       const ampm = hourValue >= 12 ? 'PM' : 'AM';
       const displayHour = hourValue % 12 === 0 ? 12 : hourValue % 12;
       const timeLabel = `${displayHour} ${ampm}`;
       
       let multiplier = 1;
       if (activeGroup === 'Schools' && hourValue >= 8 && hourValue <= 15) multiplier = 1.5;
       else if (activeGroup === 'Schools') multiplier = 1.0;
       if (activeGroup === 'Hospitals') multiplier = 1.2;
       if (activeGroup === 'Elderly') multiplier = 1.3;
       if (activeGroup === 'Outdoor Workers' && hourValue >= 9 && hourValue <= 18) multiplier = 2.0;
       else if (activeGroup === 'Outdoor Workers') multiplier = 1.0;
       
       return {
          time: timeLabel,
          relative: `-${hourOffset}h`,
          risk: Math.round(aqi * multiplier)
       };
    });
  }, [selectedWard, activeGroup]);

  const futureData = useMemo(() => {
    if (!selectedWard) return [];
    const hist = selectedWard.history;
    const recentMean = hist.slice(-24).reduce((a,b)=>a+b,0)/24;
    const prevMean = hist.slice(-48, -24).reduce((a,b)=>a+b,0)/24;
    const trend = recentMean - prevMean;

    const data = [];
    const currentHour = new Date().getHours();
    for (let i = 0; i < 24; i++) {
       const seasonalBase = hist[hist.length - 24 + i];
       const dampedTrend = trend * Math.pow(0.9, i);
       const fcast = Math.max(0, Math.round(seasonalBase + dampedTrend));
       
       const hourOfDay = (currentHour + i + 1) % 24;
       let multiplier = 1;
       if (activeGroup === 'Schools' && hourOfDay >= 8 && hourOfDay <= 15) multiplier = 1.5;
       else if (activeGroup === 'Schools') multiplier = 1.0;
       if (activeGroup === 'Hospitals') multiplier = 1.2;
       if (activeGroup === 'Elderly') multiplier = 1.3;
       if (activeGroup === 'Outdoor Workers' && hourOfDay >= 9 && hourOfDay <= 18) multiplier = 2.0;
       else if (activeGroup === 'Outdoor Workers') multiplier = 1.0;

       data.push({
          hourOffset: `+${i+1}h`,
          time: `${hourOfDay}:00`,
          risk: Math.round(fcast * multiplier)
       });
    }
    return data;
  }, [selectedWard, activeGroup]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex-1 flex flex-col shadow-sm min-w-0 hover:shadow-md/40 transition-all duration-300">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
        <AlertTriangle size={14} /> Targeted Advisories
      </h2>
      
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 hide-scrollbar">
        {groups.map(group => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={`px-3 py-1 text-[10px] font-bold rounded-full whitespace-nowrap transition-colors ${
              activeGroup === group 
                ? 'bg-slate-800 text-white shadow-md' 
                : 'bg-white/60 text-slate-600 hover:bg-white border border-slate-200'
            }`}
          >
            {group}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col gap-4">
        <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 shadow-sm min-h-[60px] flex flex-col justify-center">
          {advisories[activeGroup]?.[language] ? (
            <p className="text-xs text-slate-800 leading-relaxed font-medium">
              {advisories[activeGroup][language]}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="text-[9px] font-bold text-blue-600 flex items-center gap-1.5 uppercase tracking-wide">
                <Wind size={10} className="animate-pulse" />
                Tailoring health advisory guidelines...
              </div>
              <TextSkeleton lines={2} className="opacity-90" />
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="bg-white/50 rounded-lg p-3 border border-slate-100 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Severity Heatmap (Next 24h)
              </div>
              <div className="text-[9px] text-slate-400 font-medium">Green = Safe, Red = Severe</div>
            </div>
            <div className="flex w-full h-6 rounded overflow-hidden shadow-inner">
              {futureData.map((d, i) => {
                const getGradientColor = (risk: number) => {
                  if (risk <= 50) return 'bg-emerald-400';
                  if (risk <= 100) return 'bg-yellow-400';
                  if (risk <= 150) return 'bg-orange-400';
                  if (risk <= 200) return 'bg-red-500';
                  return 'bg-rose-700';
                };
                return (
                  <div 
                    key={i} 
                    className={`flex-1 ${getGradientColor(d.risk)} border-r border-white/20 last:border-r-0 transition-all hover:opacity-80 cursor-help relative group`}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-slate-800 text-white text-[9px] py-1 px-2 rounded whitespace-nowrap shadow-lg">
                      {d.time} (+{i+1}h): {d.risk} AQI Risk
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-[155px] bg-white/50 rounded-lg p-2 border border-slate-100 flex flex-col">
            <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wide">
              {activeGroup} Vulnerability Index (Past 24h)
            </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.4} />
                <XAxis 
                  dataKey="time" 
                  stroke="#64748B" 
                  fontSize={8} 
                  tickLine={false} 
                  axisLine={false} 
                  minTickGap={15} 
                />
                <YAxis 
                  stroke="#64748B" 
                  fontSize={8} 
                  tickLine={false} 
                  axisLine={false} 
                  domain={['dataMin - 15', 'dataMax + 15']} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '6px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '2px' }}
                  formatter={(value: any, name: any, props: any) => [value, `${props.payload.relative ? `${name} (${props.payload.relative})` : name}`]}
                />
                <Area type="monotone" dataKey="risk" name="Risk Level" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   MODULE 6: Multi-City Comparison
   ========================================= */
function MultiCityCompare() {
  const { dataset } = useContext(AppContext);
  const cityStats = useMemo(() => {
    const stats: any[] = [];
    const trendData: any[] = [];
    
    // Initialize trend data points for 30 days
    for(let d = 0; d < 30; d++) {
       trendData.push({ day: `D-${30-d}` });
    }

    ['Delhi', 'Mumbai', 'Kolkata', 'Bengaluru', 'Chennai'].forEach(city => {
      const wards = dataset.filter(w => w.city === city);
      let daysAbovePoor = 0;
      
      const hist = wards[0].history; 
      for(let d = 0; d < 30; d++) {
        // Find if this day was poor for this ward
        const dayAqi = hist.slice(d*24, (d+1)*24);
        const max = Math.max(...dayAqi);
        if (max > 200) daysAbovePoor++;
        
        // Calculate daily average for the city (average of all wards)
        let totalAqi = 0;
        let count = 0;
        wards.forEach(w => {
           const wDayAqi = w.history.slice(d*24, (d+1)*24);
           totalAqi += wDayAqi.reduce((a,b)=>a+b, 0);
           count += 24;
        });
        trendData[d][city] = Math.round(totalAqi / count);
      }
      stats.push({ name: city, daysAbovePoor });
    });
    return { stats, trendData };
  }, [dataset]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col shadow-sm min-w-0 hover:shadow-md/40 transition-all duration-300">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Metro Comparative Index</h2>
      
      <div className="flex-1 min-h-[120px] w-full mb-4 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={cityStats.trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
            <XAxis dataKey="day" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.5)', backgroundColor: 'rgba(255, 255, 255, 0.9)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
            <Line type="monotone" dataKey="Delhi" stroke="#ef4444" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Mumbai" stroke="#f97316" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Kolkata" stroke="#eab308" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Bengaluru" stroke="#22c55e" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Chennai" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3 justify-end flex flex-col">
        {cityStats.stats.map((stat: any) => {
          const pct = Math.round((stat.daysAbovePoor / 30) * 100);
          
          let colorClass = 'bg-slate-500';
          if (stat.name === 'Delhi') colorClass = 'bg-red-500';
          if (stat.name === 'Mumbai') colorClass = 'bg-orange-500';
          if (stat.name === 'Kolkata') colorClass = 'bg-yellow-500';
          if (stat.name === 'Bengaluru') colorClass = 'bg-green-500';
          if (stat.name === 'Chennai') colorClass = 'bg-blue-500';

          return (
            <div key={stat.name} className="space-y-1">
              <div className="flex justify-between text-[9px] text-slate-600">
                <span>{stat.name}</span>
                <span className="text-slate-900 font-medium">{stat.daysAbovePoor}/30 Days Poor</span>
              </div>
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden shadow-inner border border-white/40">
                <div 
                  className={`h-full shadow-sm ${colorClass}`} 
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'landing'|'dashboard'>('landing');

  if (view === 'landing') {
    return <LandingPage onEnter={() => setView('dashboard')} />;
  }

  return <Dashboard />;
}
