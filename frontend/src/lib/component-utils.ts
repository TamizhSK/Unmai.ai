// Utility functions for consistent color coding across components

export const getScoreColorClass = (score: number, type: 'default' | 'credibility' | 'confidence' | 'safety' = 'default') => {
  switch (type) {
    case 'credibility':
      if (score < 40) return 'bg-destructive';
      if (score < 70) return 'bg-yellow-500';
      return 'bg-green-500';
    case 'confidence':
      if (score > 75) return 'bg-destructive';
      if (score > 40) return 'bg-yellow-500';
      return 'bg-green-500';
    case 'safety':
      if (score > 0.8) return 'bg-green-500';
      if (score > 0.5) return 'bg-yellow-500';
      return 'bg-destructive';
    default:
      // Default threshold pattern
      if (score < 40) return 'bg-destructive';
      if (score < 70) return 'bg-yellow-500';
      return 'bg-green-500';
  }
};

export const getScoreTextColorClass = (score: number, type: 'default' | 'credibility' | 'confidence' | 'safety' = 'default') => {
  switch (type) {
    case 'credibility':
      if (score < 40) return 'text-destructive';
      if (score < 70) return 'text-yellow-500';
      return 'text-green-500';
    case 'confidence':
      if (score > 75) return 'text-destructive';
      if (score > 40) return 'text-yellow-500';
      return 'text-green-500';
    case 'safety':
      if (score > 0.8) return 'text-green-500';
      if (score > 0.5) return 'text-yellow-500';
      return 'text-destructive';
    default:
      // Default threshold pattern
      if (score < 40) return 'text-destructive';
      if (score < 70) return 'text-yellow-500';
      return 'text-green-500';
  }
};

export const getSafetyRatingColor = (rating: string) => {
  switch (rating) {
    case 'SAFE':
      return 'text-green-500';
    case 'HARMFUL':
      return 'text-destructive';
    case 'MISLEADING':
      return 'text-yellow-500';
    case 'UNKNOWN':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
};

export const getSafetyRatingIcon = (rating: string) => {
  switch (rating) {
    case 'SAFE':
      return { icon: 'CheckCircle', className: 'text-green-500' };
    case 'HARMFUL':
      return { icon: 'AlertTriangle', className: 'text-destructive' };
    case 'MISLEADING':
      return { icon: 'AlertTriangle', className: 'text-yellow-500' };
    case 'UNKNOWN':
      return { icon: 'Info', className: 'text-muted-foreground' };
    default:
      return { icon: 'Info', className: 'text-muted-foreground' };
  }
};