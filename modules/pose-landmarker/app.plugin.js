/**
 * Expo config plugin for the pose-landmarker local module.
 *
 * At `expo prebuild` it copies <projectRoot>/assets/models/*.task into the native projects:
 *   - Android: android/app/src/main/assets/<file>.task, and marks `.task` as noCompress
 *     (MediaPipe memory-maps the model via AssetManager.openFd, which fails on compressed assets).
 *   - iOS:     ios/<AppName>/<file>.task, added to the app target's "Copy Bundle Resources".
 *
 * Before copying, any of the two models missing from <modelsDir> is downloaded from Google's MediaPipe
 * model bucket (same URLs as scripts/download-models.sh), so fresh clones and EAS builds get them without
 * a manual step. Offline or failing downloads abort prebuild with a clear message.
 * Set GRASSWORK_SKIP_MODEL_DOWNLOAD=1 to skip the download (prebuild then only warns).
 *
 * Options: { modelsDir?: string; download?: boolean }  (modelsDir relative to the project root,
 *          default "assets/models"; download default true)
 */
const fs = require('fs');
const https = require('https');
const path = require('path');
const {
  IOSConfig,
  withAppBuildGradle,
  withDangerousMod,
  withXcodeProject,
  createRunOncePlugin,
} = require('expo/config-plugins');

const PKG = { name: 'pose-landmarker', version: '0.1.0' };

const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';
const MODEL_VARIANTS = ['lite', 'full'];
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 60000;

function modelUrl(variant) {
  return `${MODEL_BASE}/pose_landmarker_${variant}/float16/latest/pose_landmarker_${variant}.task`;
}

/** GET url into dest (via dest.part), following up to MAX_REDIRECTS redirects. */
function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'grasswork-prebuild' } }, (res) => {
      const code = res.statusCode || 0;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        if (redirects >= MAX_REDIRECTS) {
          reject(new Error(`too many redirects for ${url}`));
          return;
        }
        const next = new URL(res.headers.location, url).toString();
        download(next, dest, redirects + 1).then(resolve, reject);
        return;
      }
      if (code !== 200) {
        res.resume();
        reject(new Error(`HTTP ${code} for ${url}`));
        return;
      }
      const part = `${dest}.part`;
      const out = fs.createWriteStream(part);
      const fail = (e) => {
        out.destroy();
        fs.rm(part, { force: true }, () => reject(e));
      };
      res.on('error', fail);
      out.on('error', fail);
      out.on('finish', () => {
        out.close(() => {
          try {
            if (fs.statSync(part).size === 0) throw new Error(`empty download from ${url}`);
            fs.renameSync(part, dest);
            resolve();
          } catch (e) {
            fs.rm(part, { force: true }, () => reject(e));
          }
        });
      });
      res.pipe(out);
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`timed out after ${TIMEOUT_MS / 1000}s fetching ${url}`)));
    req.on('error', reject);
  });
}

const OFFLINE_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'ETIMEDOUT', 'EHOSTUNREACH']);

/** Downloads whichever pose_landmarker_<variant>.task files are missing (or empty). Runs once per prebuild. */
let ensurePromise = null;
function ensureModels(projectRoot, modelsDir) {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    if (process.env.GRASSWORK_SKIP_MODEL_DOWNLOAD === '1') return;
    const dir = path.resolve(projectRoot, modelsDir);
    fs.mkdirSync(dir, { recursive: true });
    for (const variant of MODEL_VARIANTS) {
      const file = `pose_landmarker_${variant}.task`;
      const dest = path.join(dir, file);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
      const url = modelUrl(variant);
      console.log(`[pose-landmarker] downloading ${file} …`);
      try {
        await download(url, dest);
      } catch (e) {
        const offline = e && OFFLINE_CODES.has(e.code);
        throw new Error(
          `[pose-landmarker] Could not download ${file} into ${dir}` +
            (offline ? ' (no network connection?)' : '') +
            `: ${e && e.message ? e.message : e}\n` +
            `Download it manually from ${url}\n` +
            'or run `npm run models` when online, then re-run prebuild. ' +
            'Set GRASSWORK_SKIP_MODEL_DOWNLOAD=1 to prebuild without models (pose detection will not work).',
        );
      }
    }
  })();
  ensurePromise.catch(() => {
    ensurePromise = null;
  });
  return ensurePromise;
}

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

const withAndroidModels = (config, { modelsDir, download }) => {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      if (download) await ensureModels(root, modelsDir);
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

const withIosModels = (config, { modelsDir, download }) => {
  // dangerous mods run before the xcodeproj mod, so the files exist by the time they're copied below
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      if (download) await ensureModels(cfg.modRequest.projectRoot, modelsDir);
      return cfg;
    },
  ]);
  return withXcodeProject(config, (cfg) => {
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
};

const withPoseLandmarker = (config, props = {}) => {
  const opts = { modelsDir: props.modelsDir || 'assets/models', download: props.download !== false };
  config = withAndroidModels(config, opts);
  config = withIosModels(config, opts);
  return config;
};

module.exports = createRunOncePlugin(withPoseLandmarker, PKG.name, PKG.version);
