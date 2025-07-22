import "./src/env.js";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
  images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "img.clerk.com",
    },
  ],
},
};

export default nextConfig;
