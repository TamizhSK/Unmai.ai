# UI Transformation Requirements - Unmai.ai Frontend

## Introduction

This specification outlines the complete UI transformation of the Unmai.ai frontend to implement a modern, responsive design using Shadcn UI and MagicUI components. The transformation focuses on system-based theming, enhanced animations, improved accessibility, and a cohesive visual experience across all screen sizes.

## Glossary

- **System Theme**: Automatic theme detection based on user's OS preference (light/dark mode)
- **MagicUI**: Enhanced UI component library with advanced animations and effects
- **Shadcn UI**: Modern React component library with accessibility-first design
- **Particles Background**: Animated particle system for visual depth
- **Shine Border**: Animated gradient border effect for cards and containers
- **Typing Animation**: Character-by-character text reveal animation
- **Input Bar**: Main user interaction component for queries and file uploads
- **Message View**: Chat interface displaying conversation history
- **Landing Page**: Initial welcome screen with centered input
- **Google Colors**: Brand color palette (#4285F4, #EA4335, #FBBC05, #34A853)

## Requirements

### Requirement 1: System-Based Theme Implementation

**User Story:** As a user, I want the application to automatically match my system's light/dark mode preference, so that I have a consistent experience across my devices.

#### Acceptance Criteria

1. THE System SHALL detect user's OS theme preference using `prefers-color-scheme` media query
2. THE System SHALL apply light theme colors when OS is in light mode
3. THE System SHALL apply dark theme colors when OS is in dark mode
4. THE System SHALL update theme automatically when OS preference changes
5. THE System SHALL remove all manual theme toggle components and logic

### Requirement 2: Enhanced Background Animation System

**User Story:** As a user, I want to see subtle animated backgrounds that enhance the visual appeal without being distracting, so that the interface feels modern and engaging.

#### Acceptance Criteria

1. THE System SHALL implement MagicUI Particles component on landing page
2. THE System SHALL implement MagicUI Particles component on message view
3. THE Particles SHALL be configured with 180 quantity, 60 ease, 40 staticity, 1.1 size
4. THE Particles SHALL use appropriate colors for both light and dark themes
5. THE Particles SHALL be positioned behind content with z-index -10

### Requirement 3: Responsive Landing Page Layout

**User Story:** As a user, I want the landing page to be visually appealing and responsive across all devices, so that I can easily access the application from any screen size.

#### Acceptance Criteria

1. THE Landing Page SHALL maintain centered layout on desktop screens
2. THE Landing Page SHALL implement MagicUI Typing Animation for headlines
3. THE Typing Animation SHALL not cause layout shifts or affect surrounding elements
4. THE Landing Page SHALL be responsive across 768px, 1024px, and 1280px+ breakpoints
5. THE Landing Page SHALL use proportional spacing and padding

### Requirement 4: Advanced Input Bar Implementation

**User Story:** As a user, I want an intuitive, curved input bar with language selection and smooth transitions, so that I can easily interact with the AI system.

#### Acceptance Criteria

1. THE Input Bar SHALL be fully rounded (curved) with smooth edges
2. THE Input Bar SHALL include language selector dropdown with 9+ languages
3. THE Input Bar SHALL be medium-sized and centered on landing page
4. THE Input Bar SHALL smoothly transition to bottom position in chat mode
5. THE Input Bar SHALL include file attachment, voice input, and submit buttons

### Requirement 5: Enhanced Message Cards with Shine Effects

**User Story:** As a user, I want visually appealing message cards with subtle animations, so that the conversation interface feels polished and professional.

#### Acceptance Criteria

1. THE Message Cards SHALL use Shadcn Card component as base structure
2. THE AI Response Cards SHALL implement MagicUI Shine Border with Google colors
3. THE Loading State SHALL use Shadcn Skeleton component with shine effects
4. THE Message Cards SHALL maintain proper spacing and hierarchy
5. THE Message Cards SHALL be responsive across all screen sizes

### Requirement 6: Custom Typography Integration

**User Story:** As a user, I want consistent, readable typography that matches Google's design language, so that the interface feels cohesive and professional.

#### Acceptance Criteria

1. THE System SHALL load Google Sans fonts from public folder
2. THE System SHALL apply Google Sans as primary font family
3. THE System SHALL use appropriate font weights (400, 500, 700)
4. THE System SHALL ensure font loading optimization with font-display: swap
5. THE System SHALL maintain typography hierarchy across all components

### Requirement 7: Color System and Contrast Optimization

**User Story:** As a user, I want proper color contrast and accessibility in both light and dark modes, so that the interface is readable and usable for everyone.

#### Acceptance Criteria

1. THE Color System SHALL implement Google Material Design 3 color tokens
2. THE Light Mode SHALL use high contrast dark text on light backgrounds
3. THE Dark Mode SHALL use high contrast light text on dark backgrounds
4. THE Color System SHALL support Google brand colors (#4285F4, #EA4335, #FBBC05, #34A853)
5. THE Color System SHALL meet WCAG AA accessibility standards

### Requirement 8: Component Architecture Cleanup

**User Story:** As a developer, I want a clean, maintainable component structure without redundant files, so that the codebase is easy to understand and modify.

#### Acceptance Criteria

1. THE System SHALL remove simple-header.tsx component and references
2. THE System SHALL remove theme-toggle.tsx component and references
3. THE System SHALL remove animated-theme-toggler.tsx component and references
4. THE System SHALL update component imports to reflect removed files
5. THE System SHALL maintain proper spacing without header components

### Requirement 9: Performance and Animation Optimization

**User Story:** As a user, I want smooth animations that respect my system preferences, so that the interface feels responsive without being overwhelming.

#### Acceptance Criteria

1. THE System SHALL implement `prefers-reduced-motion` support
2. THE Animations SHALL use GPU acceleration where appropriate
3. THE System SHALL optimize bundle size for MagicUI components
4. THE Animations SHALL use cubic-bezier easing for smooth transitions
5. THE System SHALL prevent layout shifts during animations

### Requirement 10: Language Selection Integration

**User Story:** As a user, I want to easily select my preferred language for the interface, so that I can use the application in my native language.

#### Acceptance Criteria

1. THE Language Selector SHALL be integrated into the input bar
2. THE Language Selector SHALL support English and 9 Indian languages
3. THE Language Selector SHALL display 2-letter language codes (EN, HI, BN, etc.)
4. THE Language Selector SHALL use Shadcn Select component
5. THE Language Selector SHALL maintain selection across page transitions

### Requirement 11: Responsive Design Implementation

**User Story:** As a user, I want the interface to work seamlessly across all device sizes, so that I can use the application on mobile, tablet, and desktop.

#### Acceptance Criteria

1. THE System SHALL implement mobile-first responsive design
2. THE Layout SHALL adapt to screen sizes: 320px+, 768px+, 1024px+, 1280px+
3. THE Components SHALL scale proportionally across breakpoints
4. THE Touch Targets SHALL be minimum 44x44px on mobile devices
5. THE System SHALL handle safe area insets on mobile devices

### Requirement 12: Accessibility and Usability Enhancement

**User Story:** As a user with accessibility needs, I want the interface to be fully accessible and usable with assistive technologies, so that I can effectively use the application.

#### Acceptance Criteria

1. THE System SHALL implement proper ARIA labels and roles
2. THE System SHALL support keyboard navigation for all interactive elements
3. THE System SHALL provide focus indicators for all focusable elements
4. THE System SHALL maintain semantic HTML structure
5. THE System SHALL support screen reader compatibility