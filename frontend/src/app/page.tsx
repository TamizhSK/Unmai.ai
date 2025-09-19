'use client';

import { UnifiedAnalysisClient } from '@/components/unified-analysis-client';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 h-screen">
        <UnifiedAnalysisClient />
      </div>
    </div>
  );
}