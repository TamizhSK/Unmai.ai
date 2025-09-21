import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrustScoreRing } from '@/components/ui/trust-score-ring';
import { Separator } from '@/components/ui/separator';
import { ShineBorder } from '@/components/ui/shine-border';
import { GeminiLoaderRing } from '@/components/gemini-loader';
import { Link, Globe, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export interface TrustScoreBreakdown {
  sourceCredibility: number;
  factCheckMatch: number;
  semanticSimilarity: number;
  languageCues: number;
  overall: number;
}

export interface EducationalCard {
  type: 'verification' | 'manipulation' | 'warning';
  title: string;
  content: string;
  icon: string;
}

export interface UnifiedResponseData {
  mainLabel: string;
  oneLineDescription: string;
  informationSummary: {
    what?: string;
    when?: string;
    why?: string;
    how?: string;
  };
  educationalInsight: string;
  trustScore: number;
  trustScoreBreakdown?: TrustScoreBreakdown;
  educationalCards?: EducationalCard[];
  sources: Array<{url: string, title: string}>;
  sourceDetails?: any;
  verificationLevel: 'authentic' | 'suspicious' | 'fake';
}

interface UnifiedResponseCardProps {
  response: UnifiedResponseData;
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

const getVerificationLevel = (trustScore: number): 'authentic' | 'suspicious' | 'fake' => {
  if (trustScore >= 75) return 'authentic';
  if (trustScore >= 40) return 'suspicious';
  return 'fake';
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

  const TrustScoreBreakdownSection = ({ breakdown }: { breakdown?: TrustScoreBreakdown }) => {
    if (!breakdown) return null;
    
    const metrics = [
      { label: 'Source Credibility', value: breakdown.sourceCredibility, weight: '30%' },
      { label: 'Fact-check Match', value: breakdown.factCheckMatch, weight: '35%' },
      { label: 'Semantic Similarity', value: breakdown.semanticSimilarity, weight: '20%' },
      { label: 'Language Cues', value: breakdown.languageCues, weight: '15%' },
    ];
    
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-[#4285F4]" />
          <h3 className="font-semibold">Trust Score Breakdown</h3>
        </div>
        
        <div className="space-y-3">
          {metrics.map((metric, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{metric.label} ({metric.weight})</span>
                <span className="font-medium">{metric.value}/100</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    metric.value >= 75 ? 'bg-[#0F9D58]' : 
                    metric.value >= 40 ? 'bg-[#F4B400]' : 'bg-[#DB4437]'
                  }`}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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

  return (
    <Card className="relative bg-card text-card-foreground shadow-lg rounded-xl transition-all duration-300 hover:shadow-xl overflow-hidden border-0">
      <ShineBorder 
        duration={6}
        borderWidth={1.5}
        className="rounded-xl"
      />
      <CardHeader className="pb-3">
        <div className="space-y-3">
          <Badge className={`text-sm px-2.5 py-0.5 text-white w-fit ${getLabelVariant(response.verificationLevel || getVerificationLevel(response.trustScore))}`}>
            {typeof response.mainLabel === 'string' ? response.mainLabel : JSON.stringify(response.mainLabel)}
          </Badge>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {typeof response.oneLineDescription === 'string' 
              ? response.oneLineDescription 
              : JSON.stringify(response.oneLineDescription)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-6">
        {/* Information Summary Section */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium text-foreground">Information Summary</h3>
          <div className="text-muted-foreground text-sm leading-relaxed space-y-1">
            {Object.entries(response.informationSummary).map(([key, value]) => {
              const display = typeof value === 'string' ? value : JSON.stringify(value);
              return value ? (
                <p key={key}>
                  <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {display}
                </p>
              ) : null;
            })}
          </div>
        </div>

        {/* Trust Score Breakdown Section */}
        {response.trustScoreBreakdown && (
          <>
            <Separator />
            <TrustScoreBreakdownSection breakdown={response.trustScoreBreakdown} />
          </>
        )}

        {/* Educational Cards Section */}
        {response.educationalCards && (
          <>
            <Separator />
            <EducationalCardsSection cards={response.educationalCards} />
          </>
        )}

        {/* Educational Insight Section */}
        <Separator />
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium text-foreground">Educational Insight</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {typeof response.educationalInsight === 'string' 
              ? response.educationalInsight 
              : JSON.stringify(response.educationalInsight)}
          </p>
        </div>

        {/* Trust Score and Sources Section */}
        <Separator />
        <div className="flex items-center justify-between pt-1.5">
          <Dialog>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 transition-colors hover:bg-muted/80">
                <span className="text-sm font-medium text-foreground">Sources</span>
                <div className="flex gap-1.5">
                  {response.sources.slice(0, 4).map((src, index) => {
                    const icon = getFavicon(src.url);
                    if (icon) {
                      return (
                        <img
                          key={index}
                          src={icon}
                          alt={typeof src.title === 'string' ? src.title : 'source'}
                          className="w-5 h-5 rounded-full bg-muted border border-border/15"
                          referrerPolicy="no-referrer"
                        />
                      );
                    }
                    return <div key={index} className="w-5 h-5 rounded-full bg-muted-foreground/20 border border-border/15" />;
                  })}
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Resources</DialogTitle>
                <DialogDescription>Links and details to associated sources.</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 pr-2">
                {response.sourceDetails && <SourceInformationSection sourceResult={response.sourceDetails} />}
                <div className="space-y-2">
                  {response.sources.map((source, index) => {
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
                            alt={typeof source.title === 'string' ? source.title : 'source'}
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
                            {typeof source.title === 'string' ? source.title : JSON.stringify(source.title)}
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
                          <Link className="h-4 w-4 text-muted-foreground group-hover:text-[#4285F4] transition-colors" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <div className="flex flex-col items-center">
            <TrustScoreRing score={response.trustScore} size="sm" />
        </div>
      </div>
    </CardContent>
  </Card>
);
}