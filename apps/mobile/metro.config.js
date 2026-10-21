const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo root
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Resolve TypeScript ESM relative .js imports to .ts/.tsx in monorepo packages
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js') && (moduleName.startsWith('./') || moduleName.startsWith('../'))) {
    const parentDir = path.dirname(context.originModulePath);
    const candidateTs = path.resolve(parentDir, moduleName.replace(/\.js$/, '.ts'));
    const candidateTsx = path.resolve(parentDir, moduleName.replace(/\.js$/, '.tsx'));
    if (fs.existsSync(candidateTs)) {
      return {
        type: 'sourceFile',
        filePath: candidateTs,
      };
    }
    if (fs.existsSync(candidateTsx)) {
      return {
        type: 'sourceFile',
        filePath: candidateTsx,
      };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
