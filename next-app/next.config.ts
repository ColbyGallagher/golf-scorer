import type { NextConfig } from "next";

// When built by GitHub Actions the GITHUB_ACTIONS env var is set to "true"
const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGitHubPages ? "/golf-scorer" : "",
  assetPrefix: isGitHubPages ? "/golf-scorer/" : "",
  images: { unoptimized: true },
};

export default nextConfig;
