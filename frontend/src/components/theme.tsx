'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'

// System-only theme provider - follows OS preference automatically
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check initial system theme and apply class
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
    
    // Apply initial theme
    applyTheme(mediaQuery.matches)
    
    // Listen for system theme changes
    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches)
    }
    
    mediaQuery.addEventListener('change', handleChange)
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  // Prevent hydration mismatch with a simple wrapper
  if (!mounted) {
    return <div suppressHydrationWarning>{children}</div>
  }

  return <>{children}</>
}
