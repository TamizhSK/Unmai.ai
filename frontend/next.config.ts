import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@google-cloud/vertexai', '@google-cloud/speech', '@google-cloud/translate', '@google-cloud/video-intelligence', '@google-cloud/vision', '@google-cloud/web-risk'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
