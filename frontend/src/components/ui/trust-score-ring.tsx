'use client';

import { cn } from "@/lib/utils";

interface TrustScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function TrustScoreRing({ 
  score, 
  size = 'md', 
  showLabel = true, 
  className 
}: TrustScoreRingProps) {
  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-20 w-20'
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-[#0F9D58]'; // Google Green
    if (score >= 40) return 'text-[#F4B400]'; // Google Yellow
    return 'text-[#DB4437]'; // Google Red
  };

  const getProgressColor = (score: number) => {
    if (score >= 75) return 'stroke-[#0F9D58]'; // Google Green
    if (score >= 40) return 'stroke-[#F4B400]'; // Google Yellow
    return 'stroke-[#DB4437]'; // Google Red
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("relative flex items-center justify-center", sizeClasses[size], className)}>
      {/* Background circle */}
      <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-muted/20"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className={getProgressColor(score)}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out',
          }}
        />
      </svg>
      
      {/* Score text */}
      {showLabel && (
        <div className="flex flex-col items-center justify-center text-center">
          <span className={cn("font-bold", getScoreColor(score), size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg')}>
            {score}
          </span>
          {size !== 'sm' && (
            <span className="text-xs text-muted-foreground">Trust</span>
          )}
        </div>
      )}
    </div>
  );
}
