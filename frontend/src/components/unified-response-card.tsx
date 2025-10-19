"use client";
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link as LinkIcon, Globe, CheckCircle, AlertTriangle, XCircle, Shield } from "lucide-react";
import { useLanguage } from '@/context/language-context';

export interface MultiModalTrustScores {
  sourceIntegrityScore: number;      // Source credibility & integrity
  contentAuthenticityScore: number;  // Content authenticity & semantic consistency
  trustExplainabilityScore: number;  // Explainability & composite rationale
}

export interface MisleadingIndicator {
  indicator: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
}

export interface DeepfakeDetection {
  isDeepfake: boolean;
  confidence: number;
  details: string;
  technicalDetails?: string;
}

export interface SourceMetadata {
  domain?: string;
  author?: string;
  reputation?: string;
  verificationStatus?: 'verified' | 'suspicious' | 'unknown';
  publishDate?: string;
  ssl?: boolean;
}

export interface EducationalCard {
  type: 'verification' | 'manipulation' | 'warning';
  title: string;
  content: string;
  icon: string;
}

export interface UnifiedResponseData {
  mainLabel: string;                    // Content type analyzed (Text, Video, Image, URL)
  oneLineDescription: string;           // Brief description of analyzed input
  informationSummary: string;           // Key findings summary
  educationalInsight: string;           // Educational insight on manipulation/credibility
  
  // Multi-modal trust scores
  trustScores: MultiModalTrustScores;
  
  // Detection results
  misleadingIndicators?: MisleadingIndicator[];
  deepfakeDetection?: DeepfakeDetection;
  
  // Source information
  sources: Array<{url: string, title: string, favicon?: string, credibility?: number}>;
  sourceMetadata?: SourceMetadata;
  
  // Overall verdict
  verificationLevel: 'authentic' | 'suspicious' | 'fake';
  verdict: 'True' | 'Suspicious' | 'Fake';
  
  // Additional data
  educationalCards?: EducationalCard[];
}

// Loading skeleton type for backend-in-flight responses
export interface AnalysisLoadingSkeleton {
  kind: 'loading';
  stage?: string; // e.g., "fetching_sources", "fact_checking", etc.
  message?: string;
  expectedChecks?: string[]; // list of checks that are running
}

type UnifiedResponse = UnifiedResponseData | AnalysisLoadingSkeleton;

interface UnifiedResponseCardProps {
  response: UnifiedResponse;
}

const getLabelVariant = (verificationLevel: string) => {
  switch (verificationLevel) {
    case 'authentic':
      return 'bg-google-green';
    case 'suspicious':
      return 'bg-google-yellow';
    case 'fake':
      return 'bg-google-red';
    default:
      return 'bg-google-blue';
  }
};

// Removed unused getVerificationLevel (handled upstream)

const getScoreColor = (score: number): string => {
  if (score >= 75) return 'hsl(var(--google-green))';
  if (score >= 40) return 'hsl(var(--google-yellow))';
  return 'hsl(var(--google-red))';
};

// Circular trust score component
const CircularTrustScore = ({ score, label }: { score: number; label: string }) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg className="w-16 h-16 sm:w-20 sm:h-20 transform -rotate-90" viewBox="0 0 50 50">
          {/* Background circle */}
          <circle
            cx="25"
            cy="25"
            r={radius}
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            className="text-muted-foreground/20"
          />
          {/* Progress circle */}
          <circle
            cx="25"
            cy="25"
            r={radius}
            stroke={color}
            strokeWidth="3"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={`text-base sm:text-lg font-bold`} style={{ color }}>{score}</div>
          </div>
        </div>
      </div>
      <div className="text-xs text-center text-foreground font-medium">
        <span className="block leading-tight max-w-[7.5rem] break-words">{label}</span>
      </div>
    </div>
  );
};

export function UnifiedResponseCard({ response }: UnifiedResponseCardProps) {
  const { translate } = useLanguage();
  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  };

  const getFavicon = (url: string) => {
    const host = getHostname(url);
    if (!host) return '';
    // DuckDuckGo IP3 favicons are reliable and fast
    return `https://icons.duckduckgo.com/ip3/${host}.ico`;
  };

  const safeRender = (value: any): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    if (value === null || value === undefined) return '';
    // Since backend now returns properly formatted strings, just convert to string
    return String(value);
  };

  // Frontend does not perform JSON/markdown formatting; backend returns clean strings.
  const sanitizeText = (value: any): string => {
    let text = safeRender(value);
    if (!text) return '';
    // Minimal whitespace normalization only
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
  };

  const getSourceStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-google-green" />;
      case 'suspicious':
        return <XCircle className="h-4 w-4 text-google-red" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-google-yellow" />;
    }
  };

  const getSourceStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-google-green/10 text-google-green';
      case 'suspicious':
        return 'bg-google-red/10 text-google-red';
      default:
        return 'bg-google-yellow/10 text-google-yellow';
    }
  };


  // Calculate composite trust score from individual scores
  const getCompositeScore = (scores: MultiModalTrustScores) => {
    return Math.round(
      (scores.sourceIntegrityScore + scores.contentAuthenticityScore + scores.trustExplainabilityScore) / 3
    );
  };

  const EducationalCardsSection = ({ cards }: { cards?: EducationalCard[] }) => {
    if (!cards || cards.length === 0) return null;
    
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase">{translate('card.heading.educationalSection')}</h3>
        <div className="grid gap-3">
          {cards.map((card, index) => (
            <div key={index} className={`p-3 rounded-lg border-l-4 ${
              card.type === 'verification' ? 'border-l-google-green bg-google-green/5' :
              card.type === 'manipulation' ? 'border-l-google-yellow bg-google-yellow/5' :
              'border-l-google-red bg-google-red/5'
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-lg">{card.icon}</span>
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-1 text-foreground">{card.title}</h4>
                  <p className="text-xs text-foreground leading-relaxed text-justify">{card.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SourceInformationSection = ({ sourceMetadata }: { sourceMetadata?: SourceMetadata }) => {
    if (!sourceMetadata) return null;
    return (
          <div className="p-3 sm:p-4 border rounded-lg bg-muted/50">
        <h3 className="font-medium mb-3 flex items-center gap-2 text-sm sm:text-base">
          <Shield className="h-4 w-4" />
          {translate('card.heading.sourceInformation')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {sourceMetadata.domain && (
            <div>
              <span className="text-muted-foreground">{translate('card.label.domain')}</span>
              <p className="font-medium">{sourceMetadata.domain}</p>
            </div>
          )}
          {sourceMetadata.author && (
            <div>
              <span className="text-muted-foreground">{translate('card.label.author')}</span>
              <p className="font-medium">{sourceMetadata.author}</p>
            </div>
          )}
          {sourceMetadata.publishDate && (
            <div>
              <span className="text-muted-foreground">{translate('card.label.published')}</span>
              <p className="font-medium">{sourceMetadata.publishDate}</p>
            </div>
          )}
          {sourceMetadata.reputation && (
            <div>
              <span className="text-muted-foreground">{translate('card.label.reputation')}</span>
              <p className="font-medium capitalize">{sourceMetadata.reputation}</p>
            </div>
          )}
          {sourceMetadata.verificationStatus && (
            <div>
              <span className="text-muted-foreground">{translate('card.label.status')}</span>
              <span className={`ml-2 text-xs px-2 py-1 rounded-full ${getSourceStatusColor(sourceMetadata.verificationStatus)} inline-flex items-center gap-1`}>
                {getSourceStatusIcon(sourceMetadata.verificationStatus)}
                <span className="capitalize">{sourceMetadata.verificationStatus}</span>
              </span>
            </div>
          )}
          {typeof sourceMetadata.ssl === 'boolean' && (
            <div>
              <span className="text-muted-foreground">{translate('card.label.ssl')}</span>
              <p className="font-medium">{sourceMetadata.ssl ? translate('card.text.sslEnabled') : translate('card.text.sslDisabled')}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const isLoading = (resp: UnifiedResponse): resp is AnalysisLoadingSkeleton => (resp as any)?.kind === 'loading';
  const compositeScore = !isLoading(response) && (response as UnifiedResponseData).trustScores ? 
    getCompositeScore((response as UnifiedResponseData).trustScores) : 0;
  
  if (isLoading(response)) {
    // Skeleton UI while backend analysis runs
    return (
      <div className="relative rounded-xl">
        <Card className="relative bg-card text-card-foreground shadow-lg rounded-xl overflow-hidden border z-0">
          <CardContent className="p-6 space-y-4">
            <div className="w-24 h-6 rounded-md bg-muted animate-pulse" />
            <div className="space-y-3">
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              <div className="h-16 w-full bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-72 bg-muted rounded animate-pulse" />
              <div className="h-20 w-full bg-muted rounded animate-pulse" />
              {response.expectedChecks && response.expectedChecks.length > 0 && (
                <div className="grid gap-2">
                  {response.expectedChecks.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-muted animate-pulse" />
                      <div className="text-xs text-muted-foreground">{c}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-end justify-between pt-2">
              <div>
                <div className="h-8 w-20 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="flex items-end gap-3">
                {[0,1,2].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
                    <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
              </div>
              {response.message && (
                <div className="mt-3 text-xs text-muted-foreground">{response.message}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = response as UnifiedResponseData;

  return (
    <div className="relative rounded-xl w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto">
      <Card className="relative bg-card text-card-foreground shadow-lg rounded-xl transition-all duration-300 hover:shadow-xl overflow-hidden border z-0">
        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
          {/* 1. Analysis Label - Shows risk level prominently */}
            <div className="flex items-center gap-2 sm:gap-3">
            <Badge className={`text-xs sm:text-sm px-2.5 sm:px-3 py-0.5 sm:py-1 text-white w-fit pointer-events-none ${getLabelVariant(data.verificationLevel)}`}>
              {data.mainLabel}
            </Badge>
          </div>
          {/* Prominent Deepfake Banner (if applicable) */}
          {data.deepfakeDetection && (
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${data.deepfakeDetection.isDeepfake ? 'bg-google-red/10 border-google-red/20' : 'bg-google-green/10 border-google-green/20'}`}>
              <div className="flex-shrink-0">
                {data.deepfakeDetection.isDeepfake ? (
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-google-red" />
                ) : (
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-google-green" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-medium text-foreground">
                    {data.deepfakeDetection.isDeepfake ? 'Deepfake Detected' : 'No Deepfake Detected'}
                  </h3>
                  <Badge variant={data.deepfakeDetection.isDeepfake ? ('destructive' as const) : ('default' as const)} className="text-xs pointer-events-none">
                    {data.deepfakeDetection.confidence}% confidence
                  </Badge>
                </div>
                <p className="text-xs text-foreground mt-1 text-justify">{data.deepfakeDetection.details}</p>
              </div>
            </div>
          )}
          
          {/* 2. One-line description of the input */}
          <div className="space-y-1 border-b border-border pb-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{translate('card.heading.description')}</h3>
            <p className="text-foreground text-sm leading-relaxed break-words whitespace-pre-wrap text-justify">
              {sanitizeText(data.oneLineDescription) || translate('card.placeholder.noDescription')}
            </p>
          </div>

          {/* 3. Information Summary of the analysis */}
          <div className="space-y-2 border-b border-border pb-3">
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">{translate('card.heading.summary')}</h3>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words text-justify">
              {sanitizeText(data.informationSummary) || translate('card.placeholder.noSummary')}
            </p>
          </div>

          {/* 4. Educational Insight - Expandable */}
          <Accordion type="single" collapsible className="border-b border-border">
            <AccordionItem value="educational" className="border-0">
              <AccordionTrigger className="text-xs sm:text-sm font-medium text-muted-foreground py-2 hover:no-underline uppercase">
                {translate('card.heading.educational')}
              </AccordionTrigger>
              <AccordionContent>
                {data.educationalInsight && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm leading-relaxed">
                    <p className="whitespace-pre-wrap break-words text-foreground text-justify">{sanitizeText(data.educationalInsight)}</p>
                
                {/* Misleading Indicators */}
                {data.misleadingIndicators && data.misleadingIndicators.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase">{translate('card.heading.misleadingIndicators')}</h4>
                    {data.misleadingIndicators.map((indicator, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                        <span className="text-xs">{indicator.indicator}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${
                                indicator.severity === 'high' ? 'bg-google-red' :
                                indicator.severity === 'medium' ? 'bg-google-yellow' : 'bg-google-green'
                              }`}
                              style={{ width: `${indicator.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{indicator.confidence}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Educational Cards (if available) */}
                {data.educationalCards && data.educationalCards.length > 0 && (
                  <div className="mt-4">
                    <EducationalCardsSection cards={data.educationalCards} />
                  </div>
                )}

                {/* Deepfake Detection Results */}
                {data.deepfakeDetection && (
                  <div className="mt-4 p-3 bg-background rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase">{translate('card.heading.deepfakeDetection')}</h4>
                      <Badge variant={data.deepfakeDetection.isDeepfake ? ("destructive" as const) : ("default" as const)} className="text-xs pointer-events-none">
                        {data.deepfakeDetection.isDeepfake ? translate('card.badge.detected') : translate('card.badge.notDetected')}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground mb-2 text-justify">{data.deepfakeDetection.details}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{translate('card.text.deepfakeConfidence')}</span>
                      <div className="w-20 bg-muted rounded-full h-1.5">
                        <div 
                          className="h-1.5 bg-google-blue rounded-full"
                          style={{ width: `${data.deepfakeDetection.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{data.deepfakeDetection.confidence}%</span>
                    </div>
                    {data.deepfakeDetection.technicalDetails && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">{translate('card.details.technical')}</summary>
                        <pre className="mt-1 text-[10px] leading-snug whitespace-pre-wrap text-muted-foreground bg-muted/50 p-2 rounded">{sanitizeText(data.deepfakeDetection.technicalDetails)}</pre>
                      </details>
                    )}
                  </div>
                )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* 5. Sources, Scores, and Overall Verdict */}
          <div className="space-y-2.5 sm:space-y-3">
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">{translate('card.heading.sources')}</h3>
            {/* Trust Scores */}
            <div className="flex items-center justify-between gap-3 px-1 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 sm:justify-items-center sm:px-0">
              <CircularTrustScore 
                score={data.trustScores?.sourceIntegrityScore || 0} 
                label={translate('card.trust.sourceIntegrity')}
              />
              <CircularTrustScore 
                score={data.trustScores?.contentAuthenticityScore || 0} 
                label={translate('card.trust.contentAuthenticity')}
              />
              <CircularTrustScore 
                score={(data.trustScores?.trustExplainabilityScore ?? compositeScore) ?? 0} 
                label={translate('card.trust.trustExplainability')}
              />
            </div>
            
            {/* Verdict + Sources in a single bar */}
            <div className="p-2.5 sm:p-3 bg-muted/50 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:justify-between">
              {/* Sources Button with Avatar Group (left) */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-full flex items-center gap-2 w-full sm:w-auto justify-center"
                  >
                    {/* Grouped favicon avatars */}
                    {data.sources && data.sources.length > 0 && (
                      <div className="flex -space-x-2 sm:-space-x-2.5 md:-space-x-3">
                        {data.sources.slice(0, 3).map((source, index) => {
                          const fav = source.favicon || getFavicon(source.url);
                          return (
                            <div key={index} className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full border-2 border-background shadow-sm overflow-hidden flex-shrink-0 bg-background">
                              {fav ? (
                                <img src={fav} alt="" className="w-full h-full object-contain p-0.5" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                              ) : null}
                              <div className={`w-full h-full bg-gradient-to-br from-[#4285F4] to-[#0F9D58] flex items-center justify-center ${fav ? 'hidden' : ''}`}>
                                <Globe className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          );
                        })}
                        {data.sources.length > 3 && (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full border-2 border-background bg-muted shadow-sm flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-semibold text-muted-foreground">+{data.sources.length - 3}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {translate('card.heading.sourcesButton')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl h-[90vh] sm:h-auto max-h-[85vh] sm:max-h-[85vh] overflow-hidden flex flex-col rounded-none sm:rounded-lg p-3 sm:p-6">
                  <DialogHeader className="flex-shrink-0 pb-3 sm:pb-4 border-b">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1.5 sm:-space-x-2">
                        {data.sources?.slice(0, 4).map((source, index) => {
                          const fav = source.favicon || getFavicon(source.url);
                          return (
                            <div key={index} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-background overflow-hidden shadow-sm bg-background">
                              {fav ? (
                                <img src={fav} alt="" className="w-full h-full object-contain p-0.5" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                              ) : null}
                              <div className={`w-full h-full bg-gradient-to-br from-[#4285F4] to-[#0F9D58] flex items-center justify-center ${fav ? 'hidden' : ''}`}>
                                <Globe className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div>
                        <DialogTitle className="text-lg sm:text-xl">{translate('card.dialog.title')}</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">{translate('card.dialog.referenced', { count: data.sources?.length || 0 })}</DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto space-y-4 py-4">
                    {/* Source Metadata */}
                    {data.sourceMetadata && (
                      <SourceInformationSection sourceMetadata={data.sourceMetadata} />
                    )}
                    
                    {/* Sources List */}
                    <div className="space-y-3">
                      {data.sources && data.sources.length > 0 ? (
                        data.sources.map((source, index) => {
                          const fav = source.favicon || getFavicon(source.url);
                          const hostname = getHostname(source.url);
                          return (
                            <a
                              key={index}
                              href={source.url || '#'}
                              target={source.url ? "_blank" : undefined}
                              rel={source.url ? "nofollow noopener noreferrer" : undefined}
                              className="flex items-start gap-3 rounded-xl p-3 sm:p-4 hover:bg-accent transition-all duration-200 border border-border/50 hover:border-[#4285F4]/40 hover:shadow-sm group"
                            >
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden flex-shrink-0 shadow-sm border border-border/20 bg-background">
                                {fav ? (
                                  <img src={fav} alt={source.title} className="w-full h-full object-contain p-0.5" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                                ) : null}
                                <div className={`w-full h-full bg-gradient-to-br from-[#4285F4] to-[#0F9D58] flex items-center justify-center ${fav ? 'hidden' : ''}`}>
                                  <Globe className="w-3 h-3 text-white" />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-[#4285F4] transition-colors">
                                  {source.title}
                                </div>
                                {source.url && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="text-xs text-muted-foreground truncate max-w-[180px] sm:max-w-[300px] md:max-w-[420px]">
                                      {hostname || source.url}
                                    </div>
                                    {hostname && (
                                      <div className="px-2 py-1 bg-muted/50 rounded-md text-xs text-muted-foreground flex-shrink-0">
                                        {new URL(source.url).protocol.replace(':', '')}
                                      </div>
                                    )}
                                    {typeof source.credibility === 'number' && (
                                      <div className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium flex-shrink-0">
                                        {Math.round(source.credibility * 100)}% credible
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-hover:text-[#4285F4] transition-colors flex-shrink-0 mt-1" />
                            </a>
                          );
                        })
                      ) : (
                        <div className="text-sm text-muted-foreground p-8 bg-muted/30 rounded-xl text-center">
                          {translate('card.dialog.noSources')}
                        </div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Overall Verdict (right) */}
              <div className="flex items-center gap-2 w-full justify-between sm:w-auto sm:justify-start sm:self-auto">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">{translate('card.label.overallVerdict')}</span>
                <Badge className={`${getLabelVariant(data.verificationLevel)} text-white px-4 py-1 pointer-events-none`}>
                  {data.verdict}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
