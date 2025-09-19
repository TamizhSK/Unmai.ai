"use client"

import * as React from "react"
import { Progress } from "./progress"

interface ScoreProgressProps extends React.ComponentPropsWithoutRef<typeof Progress> {
  score: number
  maxScore?: number
  showLabel?: boolean
}

const getScoreColorClass = (score: number, maxScore: number = 100) => {
  const percentage = (score / maxScore) * 100
  if (percentage < 40) return 'bg-destructive'
  if (percentage < 70) return 'bg-yellow-500'
  return 'bg-green-500'
}

const ScoreProgress = React.forwardRef<
  React.ElementRef<typeof Progress>,
  ScoreProgressProps
>(({ score, maxScore = 100, showLabel = false, className, ...props }, ref) => {
  const percentage = (score / maxScore) * 100
  
  return (
    <div className="space-y-2">
      <Progress
        ref={ref}
        value={percentage}
        indicatorClassName={getScoreColorClass(score, maxScore)}
        className={className}
        {...props}
      />
      {showLabel && (
        <p className="text-sm text-muted-foreground">
          {score}{maxScore !== 100 ? `/${maxScore}` : ''} 
          {maxScore === 100 ? `%` : ''}
        </p>
      )}
    </div>
  )
})

ScoreProgress.displayName = "ScoreProgress"

export { ScoreProgress, getScoreColorClass }