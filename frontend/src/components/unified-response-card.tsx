"use client";
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShineBorder } from '@/components/ui/shine-border';
import { Link as LinkIcon, Globe, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, Shield, Eye, Brain } from "lucide-react";

export interface MultiModalTrustScores {
  sourceContextScore: number;      // Source & Context Verification score
  contentAuthenticityScore: number; // Content Authenticity & Semantic Consistency score  
  explainabilityScore: number;     // Explainability & Composite Trust Score
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
  sources: Array<{url: string, title: string, favicon?: string}>;
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
      return 'bg-[#0F9D58]'; // Google Green
    case 'suspicious':
      return 'bg-[#F4B400]'; // Google Yellow
    case 'fake':
      return 'bg-[#DB4437]'; // Google Red
    default:
      return 'bg-[#4285F4]'; // Google Blue
  }
};

const getVerificationLevel = (score: number): 'authentic' | 'suspicious' | 'fake' => {
  if (score >= 75) return 'authentic';
  if (score >= 40) return 'suspicious';
  return 'fake';
};

const getScoreColor = (score: number): string => {
  if (score >= 75) return '#0F9D58'; // Green
  if (score >= 40) return '#F4B400'; // Yellow  
  return '#DB4437'; // Red
};

// Circular trust score component
const CircularTrustScore = ({ score, label, icon }: { score: number; label: string; icon: React.ReactNode }) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 50 50">
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
            <div className={`text-xs font-bold`} style={{ color }}>{score}</div>
          </div>
        </div>
      </div>
      <div className="text-xs text-center text-muted-foreground font-medium">{label}</div>
    </div>
  );
};

export function UnifiedResponseCard({ response }: UnifiedResponseCardProps) {
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
    return JSON.stringify(value);
  };

  const getSourceStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'suspicious':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getSourceStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'suspicious':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  const [isEducationalExpanded, setIsEducationalExpanded] = React.useState(false);

  // Calculate composite trust score from individual scores
  const getCompositeScore = (scores: MultiModalTrustScores) => {
    return Math.round((scores.sourceContextScore + scores.contentAuthenticityScore + scores.explainabilityScore) / 3);
  };

  const EducationalCardsSection = ({ cards }: { cards?: EducationalCard[] }) => {
    if (!cards || cards.length === 0) return null;
    
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Educational Insights</h3>
        <div className="grid gap-3">
          {cards.map((card, index) => (
            <div key={index} className={`p-3 rounded-lg border-l-4 ${
              card.type === 'verification' ? 'border-l-[#0F9D58] bg-[#0F9D58]/5' :
              card.type === 'manipulation' ? 'border-l-[#F4B400] bg-[#F4B400]/5' :
              'border-l-[#DB4437] bg-[#DB4437]/5'
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-lg">{card.icon}</span>
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-1">{card.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SourceInformationSection = ({ sourceResult }: { sourceResult?: any }) => {
    if (!sourceResult) return null;
    
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-muted">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Source Information</h3>
        </div>
        
        <div className="space-y-2">
          {sourceResult.sourceCredibility !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Credibility Score:</span>
              <span className="font-medium">{safeRender(sourceResult.sourceCredibility)}/100</span>
            </div>
          )}
          
          {sourceResult.sourceType && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Source Type:</span>
              <span className="font-medium capitalize">{safeRender(sourceResult.sourceType)}</span>
            </div>
          )}
          
          {sourceResult.verificationStatus && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status:</span>
              <span className={`text-xs px-2 py-1 rounded-full ${getSourceStatusColor(safeRender(sourceResult.verificationStatus))} flex items-center gap-1`}>
                {getSourceStatusIcon(safeRender(sourceResult.verificationStatus))}
                <span className="capitalize">{safeRender(sourceResult.verificationStatus)}</span>
              </span>
            </div>
          )}
          
          {sourceResult.details?.domain && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Domain:</span>
              <span className="font-medium">{safeRender(sourceResult.details.domain)}</span>
            </div>
          )}
          
          {sourceResult.details?.reputation && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Reputation:</span>
              <span className="font-medium capitalize">{safeRender(sourceResult.details.reputation)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const isLoading = (resp: UnifiedResponse): resp is AnalysisLoadingSkeleton => (resp as any)?.kind === 'loading';
  const compositeScore = !isLoading(response) ? getCompositeScore((response as UnifiedResponseData).trustScores) : 0;
  
  if (isLoading(response)) {
    // Skeleton UI while backend analysis runs
    return (
      <div className="relative rounded-xl p-0.5">
        <ShineBorder duration={10} borderWidth={1.5} className="rounded-xl" />
        <Card className="relative bg-card text-card-foreground shadow-lg rounded-xl overflow-hidden border-0 z-10">
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
    <div className="relative rounded-xl p-0.5">
      <ShineBorder 
        duration={10}
        borderWidth={1.5}
        className="rounded-xl"
      />
      <Card className="relative bg-card text-card-foreground shadow-lg rounded-xl transition-all duration-300 hover:shadow-xl overflow-hidden border-0 z-10">
        <CardContent className="p-6 space-y-4">
          {/* Header Label */}
          <Badge className={`text-sm px-3 py-1 text-white w-fit ${getLabelVariant(data.verificationLevel)}`}>
            {data.mainLabel}
          </Badge>
          {/* Prominent Deepfake Banner (if applicable) */}
          {data.deepfakeDetection && (
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${data.deepfakeDetection.isDeepfake ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex-shrink-0">
                {data.deepfakeDetection.isDeepfake ? (
                  <XCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    {data.deepfakeDetection.isDeepfake ? 'Deepfake Detected' : 'No Deepfake Detected'}
                  </h3>
                  <Badge variant={data.deepfakeDetection.isDeepfake ? ('destructive' as const) : ('default' as const)} className="text-xs">
                    {data.deepfakeDetection.confidence}% confidence
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{data.deepfakeDetection.details}</p>
              </div>
            </div>
          )}
          
          {/* One line description */}
          <div className="text-foreground text-sm leading-relaxed border-b border-border pb-3">
            {data.oneLineDescription}
          </div>

          {/* Information Summary */}
          <div className="space-y-2 border-b border-border pb-3">
            <h3 className="text-sm font-medium text-foreground">Information summary</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {data.informationSummary}
            </p>
          </div>

          {/* Educational Insight - Expandable */}
          <div className="space-y-2 border-b border-border pb-3">
            <Button
              variant="ghost"
              onClick={() => setIsEducationalExpanded(!isEducationalExpanded)}
              className="h-auto p-0 text-sm font-medium text-foreground hover:bg-transparent justify-start"
            >
              Educational insight on how the manipulation is done/how well the information is given
              {isEducationalExpanded ? (
                <ChevronUp className="ml-1 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
              )}
            </Button>
            {isEducationalExpanded && (
              <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground leading-relaxed">
                {data.educationalInsight}
                
                {/* Misleading Indicators */}
                {data.misleadingIndicators && data.misleadingIndicators.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-medium text-foreground">Misleading Indicators:</h4>
                    {data.misleadingIndicators.map((indicator, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                        <span className="text-xs">{indicator.indicator}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${
                                indicator.severity === 'high' ? 'bg-red-500' :
                                indicator.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
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

                {/* Deepfake Detection Results */}
                {data.deepfakeDetection && (
                  <div className="mt-4 p-3 bg-background rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium text-foreground">Deepfake Detection:</h4>
                      <Badge variant={data.deepfakeDetection.isDeepfake ? ("destructive" as const) : ("default" as const)} className="text-xs">
                        {data.deepfakeDetection.isDeepfake ? "Detected" : "Not Detected"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{data.deepfakeDetection.details}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Confidence:</span>
                      <div className="w-20 bg-muted rounded-full h-1.5">
                        <div 
                          className="h-1.5 bg-blue-500 rounded-full"
                          style={{ width: `${data.deepfakeDetection.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{data.deepfakeDetection.confidence}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Section: Sources and Trust Scores */}
          <div className="flex items-end justify-between pt-2">
            {/* Sources Button */}
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="rounded-full bg-muted hover:bg-muted/80 border-0 text-foreground"
                >
                  Sources
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Sources & Verification Details</DialogTitle>
                  <DialogDescription>Source information and verification results</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {/* Source Metadata */}
                  {data.sourceMetadata && (
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Source Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {data.sourceMetadata.domain && (
                          <div>
                            <span className="text-muted-foreground">Domain:</span>
                            <p className="font-medium">{data.sourceMetadata.domain}</p>
                          </div>
                        )}
                        {data.sourceMetadata.author && (
                          <div>
                            <span className="text-muted-foreground">Author:</span>
                            <p className="font-medium">{data.sourceMetadata.author}</p>
                          </div>
                        )}
                        {data.sourceMetadata.reputation && (
                          <div>
                            <span className="text-muted-foreground">Reputation:</span>
                            <p className="font-medium capitalize">{data.sourceMetadata.reputation}</p>
                          </div>
                        )}
                        {data.sourceMetadata.verificationStatus && (
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={(data.sourceMetadata.verificationStatus === 'verified' ? 'default' : 'secondary') as 'default' | 'secondary'}>
                              {data.sourceMetadata.verificationStatus}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Sources List */}
                  <div className="space-y-2">
                    {data.sources.map((source, index) => {
                      const fav = getFavicon(source.url);
                      const hostname = getHostname(source.url);
                      return (
                        <a
                          key={index}
                          href={source.url || '#'}
                          target={source.url ? "_blank" : undefined}
                          rel={source.url ? "noopener noreferrer" : undefined}
                          className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm border border-border/15 hover:border-[#4285F4]/20 group"
                        >
                          {fav ? (
                            <img
                              src={fav}
                              alt={source.title}
                              className="w-6 h-6 rounded-sm bg-muted border border-border/15 flex-shrink-0 mt-0.5"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-sm bg-gradient-to-br from-[#4285F4] to-[#0F9D58] border border-border/15 flex-shrink-0 flex items-center justify-center mt-0.5">
                              <Globe className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="font-medium text-foreground leading-5 line-clamp-2 group-hover:text-[#4285F4] transition-colors">
                              {source.title}
                            </div>
                            {source.url && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="text-xs text-muted-foreground break-all leading-4">
                                  {hostname || source.url}
                                </div>
                                {hostname && (
                                  <div className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground border border-border/10 flex-shrink-0">
                                    {new URL(source.url).protocol.replace(':', '')}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-start gap-2 flex-shrink-0 mt-1">
                            <div className="w-2 h-2 rounded-full bg-[#0F9D58]" title="Verified Source" />
                            <LinkIcon className="h-4 w-4 text-muted-foreground group-hover:text-[#4285F4] transition-colors" />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Three Trust Score Circles */}
            <div className="flex items-end gap-3">
              <CircularTrustScore 
                score={data.trustScores.sourceContextScore} 
                label="Source & Context Verification"
                icon={<Shield />}
              />
              <CircularTrustScore 
                score={data.trustScores.contentAuthenticityScore} 
                label="Authenticity & Consistency"
                icon={<Eye />}
              />
              <CircularTrustScore 
                score={compositeScore} 
                label="Explainability & Composite"
                icon={<Brain />}
              />
            </div>
          </div>

          {/* Overall Verdict */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Verdict:</span>
              <Badge className={`${getLabelVariant(data.verificationLevel)} text-white`}>
                {data.verdict}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}