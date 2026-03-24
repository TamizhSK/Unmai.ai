
/**
 * AnalysisLoader Component
 * 
 * Reusable loading component with smooth animated gradient progress bar.
 * Displays analysis stages with continuous animation that never restarts.
 * 
 * Features:
 * - Smooth gradient flow animation (blue → purple → cyan)
 * - Continuous progress that never jumps or restarts
 * - Stage indicators with fade transitions
 * - Reusable across the application
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Layers, 
  FileCheck, 
  Search, 
  Database, 
  Shield, 
  BrainCircuit, 
  Sparkles, 
  ClipboardCheck 
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnalysisLoaderStage {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  progress: number;
}

export interface AnalysisLoaderProps {
  stage?: string;
  message?: string;
  progress?: number;
  expectedChecks?: string[];
}

// ─── Stage Configuration ─────────────────────────────────────────────────────

// Stage IDs match backend PIPELINE_STAGES in unified-analysis.ts
const LOADER_STAGES: AnalysisLoaderStage[] = [
  { id: 'detecting', label: 'Detecting input type', icon: Activity, progress: 8 },
  { id: 'extracting', label: 'Extracting content', icon: Layers, progress: 20 },
  { id: 'claims', label: 'Identifying factual claims', icon: FileCheck, progress: 32 },
  { id: 'queries', label: 'Generating search queries', icon: Search, progress: 42 },
  { id: 'evidence', label: 'Searching fact-check databases', icon: Database, progress: 55 },
  { id: 'ranking', label: 'Ranking source credibility', icon: Shield, progress: 68 },
  { id: 'reasoning', label: 'AI analyzing evidence', icon: BrainCircuit, progress: 80 },
  { id: 'explanation', label: 'Generating explanation', icon: Sparkles, progress: 92 },
  { id: 'complete', label: 'Preparing verification report', icon: ClipboardCheck, progress: 100 },
];

// ─── Animated Gradient Progress Bar ──────────────────────────────────────────

const AnimatedProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  const width = `${Math.min(100, Math.max(2, progress))}%`;

  return (
    <div className="relative w-full h-[4px] rounded-full overflow-hidden bg-muted/50">
      {/* Google brand gradient: Blue → Red → Yellow → Green */}
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width,
          transition: 'width 100ms linear',
          background: 'linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853, #4285F4)',
          backgroundSize: '200% 100%',
          animation: 'gradientFlow 3s linear infinite',
        }}
      />

      {/* Shimmer overlay */}
      <div
        className="absolute inset-y-0 left-0 rounded-full opacity-30"
        style={{
          width,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s linear infinite',
        }}
      />

      {/* Glow effect with Google colors */}
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width,
          background: 'linear-gradient(90deg, rgba(66,133,244,0.4), rgba(234,67,53,0.4), rgba(251,188,5,0.4), rgba(52,168,83,0.4))',
          filter: 'blur(4px)',
        }}
      />
    </div>
  );
};

// ─── Stage Indicator ─────────────────────────────────────────────────────────

const StageIndicator: React.FC<{ 
  stage: AnalysisLoaderStage; 
  isActive: boolean;
  isCompleted: boolean;
}> = ({ stage: Stage, isActive, isCompleted }) => {
  const IconComponent = Stage.icon;
  
  return (
    <div className={`flex items-center gap-2 transition-all duration-300 ${
      isActive ? 'opacity-100' : isCompleted ? 'opacity-50' : 'opacity-30'
    }`}>
      {/* Pulse dot for active stage — Google Blue */}
      {isActive && (
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: '#4285F4' }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#4285F4' }} />
        </span>
      )}

      {/* Stage icon */}
      <IconComponent className={`h-3.5 w-3.5 ${
        isActive ? '' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/40'
      }`} style={isActive ? { color: '#4285F4' } : undefined} />
      
      {/* Stage label */}
      <span className={`text-xs ${
        isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
      }`}>
        {Stage.label}
      </span>
    </div>
  );
};

// ─── Main Loader Component ───────────────────────────────────────────────────

export const AnalysisLoader: React.FC<AnalysisLoaderProps> = ({ 
  stage, 
  progress
  // expectedChecks removed - no longer displayed
}) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(2);
  const [visible, setVisible] = useState(true);
  const stageIndexRef = useRef(0);

  // Sync stage from backend with smooth fade transition
  useEffect(() => {
    let newIdx = -1;
    
    if (progress !== undefined) {
      const idx = LOADER_STAGES.findIndex(s => s.progress >= progress);
      if (idx !== -1) newIdx = idx;
    } else if (stage) {
      const idx = LOADER_STAGES.findIndex(s => s.id === stage.toLowerCase());
      if (idx !== -1) newIdx = idx;
    }
    
    if (newIdx !== -1 && newIdx !== stageIndexRef.current) {
      // Fade out
      setVisible(false);
      
      const t = setTimeout(() => {
        stageIndexRef.current = newIdx;
        setCurrentStageIndex(newIdx);
        // Fade in
        setVisible(true);
      }, 150);
      
      return () => clearTimeout(t);
    }
  }, [stage, progress]);

  // Smooth progress animation toward target (continuous, never restarts)
  useEffect(() => {
    const target = LOADER_STAGES[currentStageIndex]?.progress || 2;
    
    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= target) return target;
        // Smooth easing function
        return prev + Math.max(0.3, (target - prev) * 0.08);
      });
    }, 16); // ~60fps
    
    return () => clearInterval(interval);
  }, [currentStageIndex]);

  const currentStage = LOADER_STAGES[currentStageIndex];
  const pct = Math.min(100, Math.max(2, displayProgress));

  return (
    <div className="w-full space-y-3 py-2">
      {/* Stage indicator */}
      <div
        className="transition-opacity duration-150"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <StageIndicator
          stage={currentStage}
          isActive={true}
          isCompleted={false}
        />
      </div>

      {/* Animated gradient progress bar */}
      <AnimatedProgressBar progress={pct} />

      {/* Progress percentage */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Analysis in progress</span>
        <span className="tabular-nums font-mono">
          {currentStageIndex + 1}/{LOADER_STAGES.length}
        </span>
      </div>

      {/* CSS for gradient animations */}
      <style jsx>{`
        @keyframes gradientFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );
};

export default AnalysisLoader;
