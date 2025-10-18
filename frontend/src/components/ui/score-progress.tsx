'use client';

import { cn } from "@/lib/utils";
import { Progress } from "./progress";

interface ScoreProgressProps {
  label: string;
  value: number;
  className?: string;
}

export function ScoreProgress({ label, value, className }: ScoreProgressProps) {
  const getProgressColor = (score: number) => {
    if (score >= 75) return 'bg-[#0F9D58]'; // Google Green
    if (score >= 40) return 'bg-[#F4B400]'; // Google Yellow
    return 'bg-[#DB4437]'; // Google Red
  };

  const getTextColor = (score: number) => {
    if (score >= 75) return 'text-[#0F9D58]'; // Google Green
    if (score >= 40) return 'text-[#F4B400]'; // Google Yellow
    return 'text-[#DB4437]'; // Google Red
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={cn("text-sm font-bold", getTextColor(value))}>
          {value}%
        </span>
      </div>
      <div className="relative">
        <Progress value={value} className="h-2" />
        <div 
          className={cn("absolute top-0 left-0 h-2 rounded-full transition-all duration-500", getProgressColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
