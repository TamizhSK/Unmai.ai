
'use client';

import { VerifySourceOutput } from '@/ai/flows/verify-source';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface SourceInformationProps {
  sourceResult?: VerifySourceOutput;
}

export function SourceInformation({ sourceResult }: SourceInformationProps) {
  if (!sourceResult?.originalSource) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Original Source</CardTitle>
      </CardHeader>
      <CardContent>
        <a href={sourceResult.originalSource.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          {sourceResult.originalSource.title}
        </a>
        <p className="text-gray-600">{sourceResult.originalSource.snippet}</p>
      </CardContent>
    </Card>
  );
}
