/** @type {import('next').NextConfig} */
const config = {
  agentRules: false,
  devIndicators: false,
  webpack(webpackConfig) {
    // Shared server modules use Node ESM .js specifiers in TypeScript source.
    // Resolve those specifiers to source files for the Next build.
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return webpackConfig;
  },
};

export default config;
