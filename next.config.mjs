/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "10.126.34.72",
    "localhost",
    "127.0.0.1",
  ],

  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        "10.126.34.72",
        "localhost",
        "127.0.0.1",
      ],
    },
  },
}

export default nextConfig