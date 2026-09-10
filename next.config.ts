import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = {
 output: 'export', trailingSlash: true, images: {unoptimized: true}, poweredByHeader: false,
 outputFileTracingRoot: process.cwd(),
 webpack(config, {webpack}) {
  config.resolve.alias["@6over3/zeroperl-ts"] = path.resolve(".generated/zeroperl-browser.js");
  // zeroperl also supports Node. Its Node-only dynamic import must not enter a browser bundle.
  config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:fs\/promises$/,path.resolve('src/lib/browser-fs-stub.ts')));
  return config;
 }
};
export default config;
