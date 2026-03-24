/**
 * Unified Response Card (v3) — Professional Verification UI
 *
 * Redesigned for:
 * - Compact layout that fits at 100% zoom
 * - Accurate donut chart color mapping
 * - Professional loader with real analysis stages
 * - Stage-synchronized progress bar
 * - Smooth animations and auto-scroll
 *
 * Max width: 720px for optimal readability
 */

"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AnalysisLoader } from '@/components/analysis/AnalysisLoader';

import {
  ExternalLink,
  Globe,
  Shield,
  FileText,
  Lightbulb,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UnifiedResponseData {
  verdict: 'True' | 'False' | 'Misleading' | 'Unverified';
  label: 'GREEN' | 'RED' | 'ORANGE' | 'YELLOW';
  oneLineDescription: string;
  explanation: string;
  evidenceSummary: string;
  insight: string;
  sources: Array<{ 
    url: string; 
    title: string; 
    domain: string; 
    credibilityScore: number;
    credibilityTier?: 'high' | 'medium' | 'low';
  }>;
  scores: {
    sourceIntegrity: number;
    contentAuthenticity: number;
    trustExplainability: number;
  };
  claims?: Array<{
    claim: string;
    verdict: string;
    confidence: number;
    reasoning: string;
    keyEvidence?: string[];
  }>;
  metadata?: {
    source?: string;
    isManipulated?: boolean;
    manipulationDetails?: string;
  };
}

export interface AnalysisLoadingSkeleton {
  kind: 'loading';
  stage?: string;
  message?: string;
  expectedChecks?: string[];
  progress?: number;
}

type UnifiedResponse = UnifiedResponseData | AnalysisLoadingSkeleton;

interface UnifiedResponseCardProps {
  response: UnifiedResponse;
  onHeightChange?: (height: number) => void;
}

// ─── Verdict Styling ────────────────────────────────────────────────────────

const VERDICT_STYLES: Record<string, { 
  bg: string; 
  text: string; 
  border: string;
  bgSoft: string;
  badgeBg: string;
  icon: React.ComponentType<any>;
}> = {
  True:       { 
    bg: 'bg-emerald-500', 
    text: 'text-emerald-500', 
    border: 'border-emerald-500/30',
    bgSoft: 'bg-emerald-500/10',
    badgeBg: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  False:      { 
    bg: 'bg-red-500', 
    text: 'text-red-500', 
    border: 'border-red-500/30',
    bgSoft: 'bg-red-500/10',
    badgeBg: 'bg-red-500',
    icon: XCircle,
  },
  Misleading: { 
    bg: 'bg-amber-500', 
    text: 'text-amber-500', 
    border: 'border-amber-500/30',
    bgSoft: 'bg-amber-500/10',
    badgeBg: 'bg-amber-500',
    icon: AlertTriangle,
  },
  Unverified: { 
    bg: 'bg-gray-400', 
    text: 'text-gray-400', 
    border: 'border-gray-400/30',
    bgSoft: 'bg-gray-400/10',
    badgeBg: 'bg-gray-400',
    icon: HelpCircle,
  },
};

const getVerdictStyle = (verdict: string) => VERDICT_STYLES[verdict] || VERDICT_STYLES.Unverified;

// ─── Score Color Logic (Strict Thresholds) ──────────────────────────────────

/**
 * Returns color based on strict score thresholds:
 * 0-39: Red (#EF4444)
 * 40-69: Orange (#F59E0B)
 * 70-100: Green (#10B981)
 */
function getScoreColor(value: number): { 
  stroke: string; 
  gradientStart: string; 
  gradientEnd: string;
  text: string; 
  bg: string;
} {
  if (value < 40) {
    return {
      stroke: '#EF4444',
      gradientStart: '#EF4444',
      gradientEnd: '#DC2626',
      text: 'text-red-500',
      bg: 'bg-red-500',
    };
  }
  if (value < 70) {
    return {
      stroke: '#F59E0B',
      gradientStart: '#F59E0B',
      gradientEnd: '#D97706',
      text: 'text-amber-500',
      bg: 'bg-amber-500',
    };
  }
  return {
    stroke: '#10B981',
    gradientStart: '#10B981',
    gradientEnd: '#059669',
    text: 'text-emerald-500',
    bg: 'bg-emerald-500',
  };
}

// ─── Animated Counter Hook ──────────────────────────────────────────────────

function useAnimatedCounter(targetValue: number, duration: number = 1000, enabled: boolean = true) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(targetValue);
      return;
    }

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.round(targetValue * eased);
      
      setValue(currentValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [targetValue, duration, enabled]);

  return value;
}

// ─── Donut Chart Component (Corrected) ──────────────────────────────────────

interface DonutChartProps {
  value: number;
  label: string;
  icon?: React.ReactNode;
  size?: 'md' | 'lg';
  delay?: number;
}

const DonutChart = ({ value, label, icon, size = 'lg', delay = 0 }: DonutChartProps) => {
  const normalizedValue = Math.max(0, Math.min(100, value));
  const animatedValue = useAnimatedCounter(normalizedValue, 1000, true);
  // Color based on the ANIMATED value so it updates during animation
  const colors = getScoreColor(animatedValue);
  const uniqueId = React.useId();

  const config = {
    container: 'w-16 h-16',
    value: 'text-base',
    label: 'text-[9px]',
    strokeWidth: 8,
    radius: 30,
  };

  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`relative ${config.container}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={config.radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          />
          {/* Use direct stroke color instead of gradient to avoid ID collisions */}
          <circle
            cx="50"
            cy="50"
            r={config.radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: `stroke-dashoffset ${1000 + delay}ms ease-out ${delay}ms, stroke 300ms ease`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${colors.text} ${config.value}`}>
            {animatedValue}
          </span>
        </div>
      </div>
      <span className={`text-muted-foreground ${config.label} font-semibold uppercase tracking-wide`}>
        {label}
      </span>
    </div>
  );
};

// ─── Professional Loader (using reusable AnalysisLoader component) ──────────

interface LoaderProps {
  stage?: string;
  message?: string;
  progress?: number;
}

const Loader = ({ stage, progress }: LoaderProps) => {
  return <AnalysisLoader stage={stage} progress={progress} />;
};

// ─── Source Favicon ─────────────────────────────────────────────────────────

const SourceFavicon = ({ url, size = 'sm' }: { url: string; size?: 'sm' | 'md' }) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-5 h-5' };
  
  const getFavicon = (url: string) => {
    try { 
      const domain = new URL(url).hostname.replace(/^www\./, '');
      return `https://icons.duckduckgo.com/ip3/${domain}.ico`; 
    } catch { 
      return ''; 
    }
  };
  
  const fav = getFavicon(url);
  
  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0 bg-background border`}>
      {fav ? (
        <img src={fav} alt="" className="w-full h-full object-contain p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <Globe className="w-2.5 h-2.5 m-1 text-muted-foreground" />
      )}
    </div>
  );
};

// ─── Sources Dialog ─────────────────────────────────────────────────────────

const SourcesDialog = ({ sources }: { sources: UnifiedResponseData['sources'] }) => {
  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'high': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'low': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full flex items-center gap-2 w-full sm:w-auto justify-center hover:bg-accent/50 transition-colors">
          <div className="flex -space-x-2">
            {sources.slice(0, 3).map((s, i) => (
              <SourceFavicon key={i} url={s.url} size="sm" />
            ))}
          </div>
          <span className="text-xs font-medium">Sources</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
            {sources.length}
          </Badge>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[80vh] sm:max-h-[85vh] overflow-hidden flex flex-col rounded-lg p-0">
        <DialogHeader className="flex-shrink-0 pb-3 border-b px-5 pt-5">
          <DialogTitle className="text-base">Sources & References</DialogTitle>
          <DialogDescription className="text-sm">
            {sources.length} credible sources referenced
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {sources.length > 0 ? sources.map((source, i) => (
            <a
              key={i}
              href={source.url || '#'}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="flex items-start gap-3 rounded-lg p-3 hover:bg-accent/50 transition-colors border border-border/50 group"
            >
              <SourceFavicon url={source.url} size="md" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-blue-500 transition-colors">
                  {source.title}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground truncate">{source.domain}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getTierBadge(source.credibilityTier)}`}>
                    {source.credibilityTier === 'high' ? 'High' : source.credibilityTier === 'medium' ? 'Medium' : 'Low'}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {Math.round(source.credibilityScore * 100)}%
                  </span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 flex-shrink-0 mt-0.5" />
            </a>
          )) : (
            <div className="text-center py-8">
              <Globe className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No sources found</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Card Component ────────────────────────────────────────────────────

export const UnifiedResponseCard = React.memo(function UnifiedResponseCard({ 
  response,
  onHeightChange,
}: UnifiedResponseCardProps) {
  
  const [isMounted, setIsMounted] = useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Notify parent of height changes
  useEffect(() => {
    if (cardRef.current && onHeightChange) {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          onHeightChange(entry.contentRect.height);
        }
      });
      observer.observe(cardRef.current);
      return () => observer.disconnect();
    }
  }, [onHeightChange]);

  // Auto-scroll is handled by the parent MessagesContainer.
  // The card should NOT independently force scroll — it causes jumps when user has scrolled up.

  const isLoading = (r: UnifiedResponse): r is AnalysisLoadingSkeleton => 
    (r as any)?.kind === 'loading';

  if (isLoading(response)) {
    return (
      <div ref={cardRef} className="w-full max-w-[560px] min-w-0 overflow-hidden">
        <Loader {...(response as AnalysisLoadingSkeleton)} />
      </div>
    );
  }

  const data = response as UnifiedResponseData;
  const style = getVerdictStyle(data.verdict);
  const VerdictIcon = style.icon;

  return (
    <div ref={cardRef} className="w-full max-w-[560px] min-w-0 overflow-hidden">
      <Card className={`bg-card text-card-foreground shadow-md rounded-xl overflow-hidden border ${style.border}`}>
        <CardContent className="p-2.5 sm:p-3.5 space-y-2 sm:space-y-2.5">

          {/* ── 1. Verdict Header ─────────────────────────────── */}
          <div className="flex items-center gap-2 pb-2.5 border-b border-border/50">
            <VerdictIcon className={`w-4.5 h-4.5 ${style.text}`} strokeWidth={2.5} />
            <Badge className={`${style.badgeBg} text-white text-xs px-2.5 py-0.5 pointer-events-none font-semibold`}>
              {data.metadata?.isManipulated ? 'Manipulated' : data.verdict}
            </Badge>
          </div>

          {/* ── 2. Headline ───────────────────────────────────── */}
          <p className="text-foreground text-[13px] leading-relaxed font-medium">
            {data.oneLineDescription}
          </p>

          {/* ── 3. Information Summary ─────────────────────────── */}
          <div className="space-y-1 pt-1.5">
            <h3 className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Information Summary
            </h3>
            <p className="text-foreground text-[13px] leading-relaxed">
              {data.explanation}
            </p>
          </div>

          {/* ── 4. Educational Insight ────────────────────────── */}
          {data.insight && (
            <div className="space-y-1 pt-1.5 border-t border-border/50">
              <h3 className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3 text-amber-500" strokeWidth={2} />
                Educational Insight
              </h3>
              <div className="p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/10">
                <p className="text-[13px] text-foreground leading-relaxed">
                  {data.insight}
                </p>
              </div>
            </div>
          )}

          {/* ── 5. Trust Metrics (Donut Charts) ───────────────── */}
          <div className="space-y-1.5 sm:space-y-2 pt-1.5 border-t border-border/50">
            <h3 className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
              Trust Metrics
            </h3>
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              <DonutChart
                value={data.scores.sourceIntegrity}
                label="Source"
                delay={0}
              />
              <DonutChart
                value={data.scores.contentAuthenticity}
                label="Content"
                delay={200}
              />
              <DonutChart
                value={data.scores.trustExplainability}
                label="Trust"
                delay={400}
              />
            </div>
          </div>

          {/* ── 6. Sources + Final Verdict ────────────────────── */}
          <div className="flex items-center gap-2 justify-between pt-2 border-t border-border/50">
            <SourcesDialog sources={data.sources} />

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Verdict:</span>
              <Badge className={`${style.badgeBg} text-white px-2 py-0 pointer-events-none font-semibold text-[10px]`}>
                {data.verdict}
              </Badge>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
});

export default UnifiedResponseCard;
