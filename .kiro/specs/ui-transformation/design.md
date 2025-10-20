# UI Transformation Design Document

## Overview

This design document outlines the technical architecture and implementation strategy for transforming the Unmai.ai frontend into a modern, responsive application using Shadcn UI and MagicUI components with system-based theming.

## Architecture

### Component Hierarchy

```
App Layout
├── ThemeProvider (System-based)
├── LanguageProvider
└── Main Content
    ├── Landing Page
    │   ├── Particles Background
    │   ├── Typing Animation Header
    │   └── Curved Input Bar
    └── Chat View
        ├── Particles Background
        ├── Messages Container
        │   ├── User Messages
        │   └── AI Response Cards (Shine Border)
        └── Bottom Input Bar
```

### Theme System Architecture

```typescript
// System Theme Detection
const useSystemTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mediaQuery.matches ? 'dark' : 'light');
    
    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return theme;
};
```

## Components and Interfaces

### 1. Enhanced Landing Page Component

```typescript
interface LandingPageProps {
  onQuerySubmit: (query: string, language: string) => void;
  isLoading: boolean;
}

// Features:
// - Particles background with theme-aware colors
// - Typing animation for headlines
// - Centered curved input bar
// - Responsive layout grid
```

### 2. Advanced Input Bar Component

```typescript
interface InputBarProps {
  onSubmit: (query: string, file?: File) => void;
  onLanguageChange: (language: string) => void;
  position: 'center' | 'bottom';
  isLoading: boolean;
}

// Features:
// - Fully rounded design with gradient border
// - Language selector dropdown
// - File attachment support
// - Voice input capability
// - Smooth position transitions
```

### 3. Enhanced Message Cards

```typescript
interface MessageCardProps {
  message: Message;
  isLoading?: boolean;
  showShimmer?: boolean;
}

// Features:
// - Shine border animation with Google colors
// - Skeleton loading states
// - Responsive card sizing
// - Proper accessibility attributes
```

### 4. Particles Background System

```typescript
interface ParticlesConfig {
  quantity: number;
  ease: number;
  staticity: number;
  size: number;
  color: string;
  theme: 'light' | 'dark';
}

// Implementation:
// - Theme-aware particle colors
// - Performance optimized rendering
// - Reduced motion support
```

## Data Models

### Theme Configuration

```typescript
interface ThemeConfig {
  mode: 'system';
  colors: {
    light: ColorPalette;
    dark: ColorPalette;
  };
  animations: {
    enabled: boolean;
    reducedMotion: boolean;
  };
}

interface ColorPalette {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  border: string;
  googleBlue: string;
  googleRed: string;
  googleYellow: string;
  googleGreen: string;
}
```

### Language Configuration

```typescript
interface LanguageConfig {
  code: string;
  name: string;
  displayCode: string;
  rtl: boolean;
}

const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: 'en-US', name: 'English', displayCode: 'EN', rtl: false },
  { code: 'hi-IN', name: 'हिन्दी', displayCode: 'HI', rtl: false },
  { code: 'bn-IN', name: 'বাংলা', displayCode: 'BN', rtl: false },
  // ... additional languages
];
```

## Error Handling

### Theme System Error Handling

```typescript
// Fallback to light theme if system detection fails
const safeThemeDetection = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (error) {
    console.warn('Theme detection failed, falling back to light mode');
    return 'light';
  }
};
```

### Animation Error Handling

```typescript
// Graceful degradation for animation failures
const safeAnimationSetup = (component: string) => {
  try {
    // Initialize animation
  } catch (error) {
    console.warn(`Animation setup failed for ${component}, using static fallback`);
    // Provide static alternative
  }
};
```

## Testing Strategy

### Component Testing

1. **Theme System Tests**
   - System theme detection accuracy
   - Theme switching responsiveness
   - Color contrast validation
   - CSS variable application

2. **Animation Tests**
   - Particles rendering performance
   - Shine border animation smoothness
   - Typing animation completion
   - Reduced motion compliance

3. **Responsive Design Tests**
   - Breakpoint behavior validation
   - Component scaling accuracy
   - Touch target size compliance
   - Safe area handling

### Integration Testing

1. **Cross-Component Communication**
   - Theme propagation across components
   - Language selection persistence
   - Input bar position transitions
   - Message card rendering consistency

2. **Performance Testing**
   - Animation frame rate monitoring
   - Bundle size optimization validation
   - Memory usage tracking
   - Load time measurement

## Implementation Phases

### Phase 1: Foundation Setup
1. Install and configure Shadcn UI components
2. Install and configure MagicUI components
3. Set up system theme detection
4. Implement custom font loading
5. Create base color system

### Phase 2: Core Components
1. Rebuild Landing Page with particles
2. Implement enhanced Input Bar
3. Create advanced Message Cards
4. Add typing animation system
5. Integrate language selection

### Phase 3: Polish and Optimization
1. Fine-tune animations and transitions
2. Optimize performance and bundle size
3. Implement accessibility features
4. Add responsive design refinements
5. Conduct comprehensive testing

### Phase 4: Cleanup and Documentation
1. Remove deprecated components
2. Update component exports
3. Clean up unused dependencies
4. Document component APIs
5. Create usage examples

## Performance Considerations

### Animation Optimization
- Use `transform` and `opacity` for GPU acceleration
- Implement `will-change` property strategically
- Respect `prefers-reduced-motion` setting
- Optimize particle count based on device capabilities

### Bundle Size Management
- Tree-shake unused MagicUI components
- Lazy load non-critical animations
- Optimize font loading with `font-display: swap`
- Use dynamic imports for heavy components

### Memory Management
- Clean up animation listeners on unmount
- Implement proper particle system disposal
- Monitor memory usage in development
- Use React.memo for expensive components

## Accessibility Implementation

### Keyboard Navigation
- Ensure all interactive elements are focusable
- Implement logical tab order
- Provide keyboard shortcuts for common actions
- Support escape key for modal dismissal

### Screen Reader Support
- Use semantic HTML elements
- Implement proper ARIA labels and roles
- Provide alternative text for visual elements
- Ensure content is announced correctly

### Visual Accessibility
- Maintain WCAG AA contrast ratios
- Support high contrast mode
- Provide focus indicators
- Ensure text scaling compatibility

## Security Considerations

### Font Loading Security
- Validate font file integrity
- Use secure font loading practices
- Implement fallback fonts
- Monitor for font loading failures

### Animation Security
- Prevent animation-based attacks
- Validate animation parameters
- Implement safe defaults
- Monitor performance impact

This design provides a comprehensive foundation for implementing the UI transformation while maintaining code quality, performance, and accessibility standards.