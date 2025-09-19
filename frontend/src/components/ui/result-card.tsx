"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ResultCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  icon?: React.ReactNode
  status?: string
  statusColor?: string
  children: React.ReactNode
}

const ResultCard = React.forwardRef<HTMLDivElement, ResultCardProps>(
  ({ title, icon, status, statusColor, children, className, ...props }, ref) => {
    return (
      <Card ref={ref} className={className} {...props}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              {title}
            </div>
            {status && (
              <span className={cn("text-sm font-semibold", statusColor)}>
                {status}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    )
  }
)

ResultCard.displayName = "ResultCard"

export { ResultCard }