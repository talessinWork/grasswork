/**
 * Expo config plugin for the pose-landmarker local module.
 *
 * At `expo prebuild` it copies <projectRoot>/assets/models/*.task into the native projects:
 *   - Android: android/app/src/main/assets/<file>.task, and marks `.task` as noCompress
 *     (MediaPipe memory-maps the model via AssetManager.openFd, which fails on compressed assets).
 *   - iOS:     ios/<AppName>/<file>.task, added to the app target's "Copy Bundle Resources".
 *
 * Options: { modelsDir?: string }  (relative to the project root, default "assets/models")
 */
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withAppBuildGradle,
  withDangerousMod,
  withXcodeProject,
  createRunOncePlugin,
} = require('expo/config-plugins');

const PKG = { name: 'pose-landmarker', version: '0.1.0' };

function listModels(projectRoot, modelsDir) {
  const dir = path.resolve(projectRoot, modelsDir);
  if (!fs.existsSync(dir)) return { dir, files: [] };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.task'));
  return { dir, files };
}

function warnIfEmpty(files, dir) {
  if (files.length === 0) {
    console.warn(
      `[pose-landmarker] No .task models in ${dir}. Run modules/pose-landmarker/scripts/download-models.sh ` +
        'before prebuild, or pose detection will report "model not found" at runtime.',
    );
  }
}

const withAndroidModels = (config, { modelsDir }) => {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const { dir, files } = listModels(root, modelsDir);
      warnIfEmpty(files, dir);
      const dest = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
      fs.mkdirSync(dest, { recursive: true });
      for (const f of files) fs.copyFileSync(path.join(dir, f), path.join(dest, f));
      return cfg;
    },
  ]);

  config = withAppBuildGradle(config, (cfg) => {
    const marker = '// pose-landmarker: keep .task models uncompressed';
    if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes(marker)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /android\s*\{/,
        (m) => `${m}\n    ${marker}\n    androidResources {\n        noCompress 'task'\n    }\n`,
      );
    }
    return cfg;
  });
  return config;
};

const withIosModels = (config, { modelsDir }) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const root = cfg.modRequest.projectRoot;
    const projectName = cfg.modRequest.projectName; // e.g. "Grasswork"
    const { dir, files } = listModels(root, modelsDir);
    warnIfEmpty(files, dir);
    const destDir = path.join(cfg.modRequest.platformProjectRoot, projectName);
    fs.mkdirSync(destDir, { recursive: true });
    for (const f of files) {
      fs.copyFileSync(path.join(dir, f), path.join(destDir, f));
      const rel = `${projectName}/${f}`;
      if (!project.hasFile(rel)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath: rel,
          groupName: projectName,
          project,
          isBuildFile: true,
        });
      }
    }
    return cfg;
  });

const withPoseLandmarker = (config, props = {}) => {
  const opts = { modelsDir: props.modelsDir || 'assets/models' };
  config = withAndroidModels(config, opts);
  config = withIosModels(config, opts);
  return config;
};

module.exports = createRunOncePlugin(withPoseLandmarker, PKG.name, PKG.version);
