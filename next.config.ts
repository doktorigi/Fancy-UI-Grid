import type {NextConfig} from 'next';

// GITHUB_PAGES=1 produces the static export the Pages workflow publishes at
// https://doktorigi.github.io/Fancy-UI-Grid/. Local dev and the normal build
// are unaffected.
const isGitHubPages = process.env.GITHUB_PAGES === '1';

const nextConfig: NextConfig = {
  ...(isGitHubPages
    ? {
        output: 'export' as const,
        basePath: '/Fancy-UI-Grid',
        assetPrefix: '/Fancy-UI-Grid/',
        trailingSlash: true, // directory URLs work on any static host
        images: { unoptimized: true },
      }
    : {
        images: {
          remotePatterns: [
            {
              protocol: 'https',
              hostname: 'placehold.co',
              port: '',
              pathname: '/**',
            },
          ],
        },
      }),
};

export default nextConfig;
