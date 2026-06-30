import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produce a minimal, self-contained server bundle for Docker.
  output: 'standalone',
  // We live in a pnpm monorepo, so file-tracing must start at the repo root.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
