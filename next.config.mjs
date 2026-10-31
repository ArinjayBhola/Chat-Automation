/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel packages the server through its build adapter. Standalone output is
  // for Docker; combining it with the Next 16.3 adapter breaks file tracing.
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  // Allow the app to build/run even when optional integration env vars are absent.
  env: {},
};

export default nextConfig;
