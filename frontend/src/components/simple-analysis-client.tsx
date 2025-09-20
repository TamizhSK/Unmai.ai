'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/language-context';
import { InputBar } from '@/components/input-bar';
import { ComprehensiveResponseCard } from '@/components/comprehensive-response-card';

export function SimpleAnalysisClient() {
  const { language, setLanguage } = useLanguage();
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (input: string, file: { dataUrl: string, type: string } | null) => {
    setIsLoading(true);
    // NOTE: This is a mock API call. Replace with your actual API call.
    await new Promise(resolve => setTimeout(resolve, 2000));
    const mockResponse = {
      label: "Misinformation",
      oneLineDescription: "This is a one-line description of the analyzed content.",
      informationSummary: "This is a summary of the information provided.",
      educationalInsight: "This is an educational insight into how the information is manipulated.",
      trustScore: 27,
      sources: [
        { url: "https://example.com/source1", title: "Source 1" },
        { url: "https://example.com/source2", title: "Source 2" },
      ],
    };
    setResponse(mockResponse);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-4xl p-4">
        <h1 className="text-4xl font-bold text-center mb-8">Verity</h1>
        <InputBar
          onSubmit={handleSubmit}
          disabled={isLoading}
          selectedLanguage={language}
          onLanguageChange={setLanguage}
        />
        {isLoading && <p>Loading...</p>}
        {response && <ComprehensiveResponseCard response={response} />}
      </div>
    </div>
  );
}
