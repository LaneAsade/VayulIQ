import React from 'react';
import { Wind, ShieldAlert, Activity, Search, Map as MapIcon, ArrowRight } from 'lucide-react';

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-[#8cb8d9] to-[#f4c28d] text-white font-sans flex flex-col selection:bg-white/30">
      {/* Navbar */}
      <nav className="flex justify-between items-center py-6 px-10 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Wind size={24} className="text-white/90" />
          <span className="text-3xl font-serif italic tracking-tighter drop-shadow-sm">
            VayuIQ
          </span>
        </div>
        
        <div className="flex items-center">
          <button 
            onClick={onEnter}
            className="bg-white hover:bg-white/95 text-slate-900 px-6 py-2.5 rounded-lg font-semibold transition-all active:scale-95 shadow-md text-sm hover:shadow-lg"
          >
            Launch Platform
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center pt-20 pb-20 px-10 text-center relative z-10 max-w-7xl mx-auto w-full">
        
        {/* Clouds decoration (CSS-based) */}
        <div className="absolute top-10 left-10 w-64 h-24 bg-white/30 rounded-full blur-3xl -z-10 mix-blend-screen"></div>
        <div className="absolute top-30 right-20 w-96 h-32 bg-white/40 rounded-full blur-3xl -z-10 mix-blend-screen"></div>
        
        <h1 className="text-5xl md:text-7xl font-light tracking-tight max-w-4xl leading-[1.15] mb-6 drop-shadow-sm">
          Next-generation ambient air intelligence <span className="italic font-serif font-normal">at scale.</span>
        </h1>
        
        <p className="text-base md:text-lg text-white/90 max-w-2xl mb-12 leading-relaxed">
          Arm your municipal administration with VayuIQ. Easily track ward-level air quality indexes, isolate particulate pollution sources, forecast microclimate trends, and dispatch target compliance alerts in seconds.
        </p>

        <div className="mb-16">
          <button 
            onClick={onEnter}
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-medium transition-all active:scale-95 flex items-center gap-3 shadow-xl hover:shadow-2xl border border-white/10"
          >
            Access Administrator Portal
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Core Capabilities Section */}
        <div className="w-full text-left mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/80 border-b border-white/20 pb-2 mb-8 max-w-xs">
            Core Capabilities
          </h2>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full text-left">
          
          {/* Card 1 */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-lg hover:bg-white/20 transition-all group flex flex-col justify-between">
            <div>
              <div className="p-3 bg-white/10 rounded-xl w-fit mb-4">
                <MapIcon size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-medium mb-2">Hyperlocal Map Explorer</h3>
              <p className="text-white/80 text-xs leading-relaxed">
                Filter and locate specific wards quickly. Zoom into street-level microgrids with color-coded scale visualizations from Good to Severe.
              </p>
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-wider font-bold text-white/60 group-hover:text-white transition-colors">
              Ward Filter Enabled
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-lg hover:bg-white/20 transition-all group flex flex-col justify-between">
            <div>
              <div className="p-3 bg-white/10 rounded-xl w-fit mb-4">
                <Activity size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-medium mb-2">Environment Telemetry</h3>
              <p className="text-white/80 text-xs leading-relaxed">
                Access microclimate tracking metrics. Monitor wind speed vector velocities, localized humidity rates, and ambient temperatures in real-time.
              </p>
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-wider font-bold text-white/60 group-hover:text-white transition-colors">
              Dynamic Sensor Simulation
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-lg hover:bg-white/20 transition-all group flex flex-col justify-between">
            <div>
              <div className="p-3 bg-white/10 rounded-xl w-fit mb-4">
                <Wind size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-medium mb-2">Source Attribution</h3>
              <p className="text-white/80 text-xs leading-relaxed">
                Analyze and rank dominant pollution factors. Map relative contributions from traffic, heavy industries, construction dust, and open waste fires.
              </p>
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-wider font-bold text-white/60 group-hover:text-white transition-colors">
              AI Vector Identification
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-lg hover:bg-white/20 transition-all group flex flex-col justify-between">
            <div>
              <div className="p-3 bg-white/10 rounded-xl w-fit mb-4">
                <ShieldAlert size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-medium mb-2">Enforcement Sync</h3>
              <p className="text-white/80 text-xs leading-relaxed">
                Generate automatic, localized dispatch mandates. Provide field officers with actionable site targets and route-optimized action justifications.
              </p>
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-wider font-bold text-white/60 group-hover:text-white transition-colors">
              Optimized Dispatch Workflow
            </div>
          </div>

        </div>

        {/* Footer info */}
        <div className="mt-20 text-[11px] text-white/60 flex flex-col sm:flex-row gap-4 sm:gap-12 border-t border-white/10 pt-6 w-full justify-between items-center">
          <div>© 2026 VayuIQ Platform. All rights reserved. For municipal administration use only.</div>
          <div className="flex gap-6">
            <span>High-Contrast UI</span>
            <span>Local Telemetry Mode</span>
          </div>
        </div>

      </main>
    </div>
  );
}

