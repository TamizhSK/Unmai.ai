'use client'

import { useEffect, useState, type ReactNode } from 'react'

interface HydrationBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * HydrationBoundary prevents hydration mismatches caused by:
 * - Browser extensions modifying the DOM (e.g., bis_skin_checked, grammarly, etc.)
 * - Client-only code that differs from server rendering
 * 
 * It renders nothing on the server and only renders children after client hydration.
 */
export function HydrationBoundary({ children, fallback = null }: HydrationBoundaryProps) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    // Return a minimal placeholder that won't be affected by browser extensions
    return fallback ? <>{fallback}</> : null
  }

  return <>{children}</>
}

/**
 * ClientOnly is a simpler version that just delays rendering until client-side
 */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  return mounted ? <>{children}</> : null
}