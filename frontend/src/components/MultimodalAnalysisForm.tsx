'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, Link as LinkIcon, Image as ImageIcon, Video as VideoIcon, Mic } from 'lucide-react';
import { UnifiedResponseCard, UnifiedResponseData } from './unified-response-card';

type ContentType = 'text' | 'url' | 'image' | 'video' | 'audio';

// Backend unified response shape (minimal) used for mapping
type BackendUnified = {
  label: 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
  oneLineDescription?: string;
  informationSummary?: string;
  educationalInsight?: string;
  sources?: Array<{ url: string; title: string; credibility: number }>;
  scores?: {
    sourceIntegrityScore: number;
    contentAuthenticityScore: number;
    trustExplainabilityScore: number;
  };
};

const MultimodalAnalysisForm: React.FC = () => {
  const [contentType, setContentType] = useState<ContentType>('text');
  const [content, setContent] = useState('');
  const [fileContent, setFileContent] = useState<string>('');
  const [result, setResult] = useState<UnifiedResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contentTypes = [
    { type: 'text' as ContentType, label: 'Text', icon: FileText },
    { type: 'url' as ContentType, label: 'URL', icon: LinkIcon },
    { type: 'image' as ContentType, label: 'Image', icon: ImageIcon },
    { type: 'video' as ContentType, label: 'Video', icon: VideoIcon },
    { type: 'audio' as ContentType, label: 'Audio', icon: Mic },
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setFileContent(base64);
      setContent(file.name); // Display filename in the UI
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !fileContent) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const endpoint = '/api/analyze';
      let payload: any = {};

      if (contentType === 'text') {
        payload = { type: 'text', payload: { text: content } };
      } else if (contentType === 'url') {
        payload = { type: 'url', payload: { url: content } };
      } else if (contentType === 'image') {
        payload = { type: 'image', payload: { imageData: fileContent || content, mimeType: 'image/jpeg' } };
      } else if (contentType === 'video') {
        payload = { type: 'video', payload: { videoData: fileContent || content, mimeType: 'video/mp4' } };
      } else if (contentType === 'audio') {
        payload = { type: 'audio', payload: { audioData: fileContent || content, mimeType: 'audio/wav' } };
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Analysis failed with status ${response.status}`);
      }

      const backend: BackendUnified = await response.json();

      // Map backend unified fields to UnifiedResponseCard props
      const mapLabelToVerification = (lbl: BackendUnified['label']): { level: 'authentic' | 'suspicious' | 'fake'; verdict: 'True' | 'Suspicious' | 'Fake' } => {
        switch (lbl) {
          case 'GREEN':
            return { level: 'authentic', verdict: 'True' };
          case 'RED':
            return { level: 'fake', verdict: 'Fake' };
          default:
            return { level: 'suspicious', verdict: 'Suspicious' };
        }
      };

      const { level, verdict } = mapLabelToVerification(backend.label);

      const unified: UnifiedResponseData = {
        mainLabel: contentType.toUpperCase(),
        oneLineDescription: backend.oneLineDescription || backend.informationSummary || 'Analysis complete',
        informationSummary: backend.informationSummary || backend.oneLineDescription || '',
        educationalInsight: backend.educationalInsight || '',
        trustScores: {
          sourceContextScore: backend.scores?.sourceIntegrityScore ?? 60,
          contentAuthenticityScore: backend.scores?.contentAuthenticityScore ?? 60,
          explainabilityScore: backend.scores?.trustExplainabilityScore ?? 60,
        },
        sources: (backend.sources || []).map(s => ({ url: s.url, title: s.title })),
        verificationLevel: level,
        verdict,
      };

      setResult(unified);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Multimodal Misinformation Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Content Type Selector */}
          <div className="flex gap-2 flex-wrap">
            {contentTypes.map(({ type, label, icon: Icon }) => (
              <Button
                key={type}
                type="button"
                variant={contentType === type ? 'default' : 'outline'}
                onClick={() => {
                  setContentType(type);
                  setContent('');
                  setFileContent('');
                  setError(null);
                }}
                className="flex items-center gap-2"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Button>
            ))}
          </div>

          {/* Content Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {contentType === 'text' ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter text content to analyze for misinformation..."
                className="min-h-[150px]"
                required
              />
            ) : contentType === 'url' ? (
              <input
                type="url"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter URL to analyze for safety and credibility..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            ) : (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={`${contentType}/*`}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                >
                  {content ? `Selected: ${content}` : `Choose ${contentType} file`}
                </Button>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={loading || (!content.trim() && !fileContent)}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze Content'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Analysis Result */}
      {result && <UnifiedResponseCard response={result} />}
    </div>
  );
};

export default MultimodalAnalysisForm;
