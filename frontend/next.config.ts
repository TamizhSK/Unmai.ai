import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Explicitly set the root to silence workspace warnings
  outputFileTracingRoot: path.join(__dirname, '..'),

  // Standalone output for optimized Cloud Run deployment
  output: 'standalone',
  
  // Optimize for production
  poweredByHeader: false,
  generateEtags: false,
  compress: true,
  
  // External packages for server components
  serverExternalPackages: [
    '@google-cloud/vertexai',
    '@google-cloud/speech', 
    '@google-cloud/translate',
    '@google-cloud/video-intelligence',
    '@google-cloud/vision',
    '@google-cloud/web-risk',
    'sharp'
  ],
  
  // Build optimizations
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Image optimization for Cloud Run
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  // Reduce hydration warnings in development
  reactStrictMode: true,
};

export default nextConfig;
