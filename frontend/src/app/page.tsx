import { UnifiedAnalysisClient } from '@/components/unified-analysis-client';

export default function Home() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-hidden">
        <UnifiedAnalysisClient />
      </div>
    </div>
  );
}