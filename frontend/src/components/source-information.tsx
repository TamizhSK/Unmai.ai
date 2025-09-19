'use client';

import { Globe, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from './ui/badge';

interface SourceResult {
  sourceCredibility?: number;
  sourceType?: string;
  verificationStatus?: 'verified' | 'unverified' | 'suspicious';
  details?: {
    domain?: string;
    reputation?: string;
    lastUpdated?: string;
  };
}

interface SourceInformationProps {
  sourceResult?: SourceResult;
}

export function SourceInformation({ sourceResult }: SourceInformationProps) {
  if (!sourceResult) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'suspicious':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'default';
      case 'suspicious':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Source Information</h3>
      </div>
      
      <div className="space-y-2">
        {sourceResult.sourceCredibility !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Credibility Score:</span>
            <span className="font-medium">{sourceResult.sourceCredibility}/100</span>
          </div>
        )}
        
        {sourceResult.sourceType && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Source Type:</span>
            <span className="font-medium capitalize">{sourceResult.sourceType}</span>
          </div>
        )}
        
        {sourceResult.verificationStatus && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={getStatusColor(sourceResult.verificationStatus)} className="flex items-center gap-1">
              {getStatusIcon(sourceResult.verificationStatus)}
              <span className="capitalize">{sourceResult.verificationStatus}</span>
            </Badge>
          </div>
        )}
        
        {sourceResult.details?.domain && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Domain:</span>
            <span className="font-medium">{sourceResult.details.domain}</span>
          </div>
        )}
        
        {sourceResult.details?.reputation && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Reputation:</span>
            <span className="font-medium capitalize">{sourceResult.details.reputation}</span>
          </div>
        )}
      </div>
    </div>
  );
}