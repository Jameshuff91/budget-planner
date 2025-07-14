import withPWAInit from '@ducanh2912/next-pwa';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
});

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Optimize production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },

  // Webpack configuration for optimal chunking
  webpack: (config, { dev, isServer }) => {
    // Only apply optimizations in production
    if (!dev && !isServer) {
      // Split chunks for better caching
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Vendor chunks
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
          },
          // Recharts gets its own chunk due to size
          recharts: {
            name: 'recharts',
            test: /[\\/]node_modules[\\/](recharts|d3-.*|victory-vendor)[\\/]/,
            priority: 20,
          },
          // PDF.js and related libraries
          pdf: {
            name: 'pdf',
            test: /[\\/]node_modules[\\/](pdfjs-dist|tesseract\.js)[\\/]/,
            priority: 20,
          },
          // UI components
          ui: {
            name: 'ui',
            test: /[\\/]node_modules[\\/](@radix-ui)[\\/]/,
            priority: 20,
          },
          // Common modules
          common: {
            name: 'common',
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };

      // Configure module IDs for long-term caching
      config.optimization.moduleIds = 'deterministic';

      // Minimize main bundle size
      config.optimization.minimize = true;
    }

    return config;
  },

  // Configure module aliases for cleaner imports
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

// Apply bundle analyzer and PWA in the correct order
export default withPWA(bundleAnalyzer(nextConfig));
