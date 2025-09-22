/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // Optimize for production
  poweredByHeader: false,
  generateEtags: false,
  
  // Enable compression
  compress: true,
  
  // Optimize images
  images: {
    unoptimized: true, // For Cloud Run compatibility
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
  
  // Experimental features for better performance
  experimental: {
    serverComponentsExternalPackages: ['sharp']
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
        ],
      },
    ]
  },
}

module.exports = nextConfig
