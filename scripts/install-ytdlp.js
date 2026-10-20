// Downloads the standalone yt-dlp binary for this platform into ./bin.
// Standalone builds bundle Python, so nothing else needs to be installed
// (important on Render, whose native Node environment may lack a suitable Python).
// Runs on `npm install` (postinstall) and is also used by the server at startup.
import { chmod, mkdir, rename, access } from 'fs/promises'
import { createWriteStream } from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN_DIR = path.join(ROOT, 'bin');

const ASSETS = {
    'win32-x64': 'yt-dlp.exe',
    'linux-x64': 'yt-dlp_linux',
    'linux-arm64': 'yt-dlp_linux_aarch64',
    'darwin-x64': 'yt-dlp_macos',
    'darwin-arm64': 'yt-dlp_macos',
};

const asset = ASSETS[`${process.platform}-${process.arch}`];
export const YTDLP_PATH = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

const exists = (file) => access(file).then(() => true, () => false);

export async function installYtdlp({ force = false } = {}) {
    if (!force && await exists(YTDLP_PATH)) return YTDLP_PATH;
    if (!asset) throw new Error(`No yt-dlp binary for ${process.platform}-${process.arch}`);

    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
    console.log(`Downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download yt-dlp: HTTP ${response.status}`);

    await mkdir(BIN_DIR, { recursive: true });
    const tmpPath = `${YTDLP_PATH}.download`;
    await pipeline(Readable.fromWeb(response.body), createWriteStream(tmpPath));
    await chmod(tmpPath, 0o755);
    await rename(tmpPath, YTDLP_PATH);
    console.log(`yt-dlp installed at ${YTDLP_PATH}`);
    return YTDLP_PATH;
}

// run directly: `node scripts/install-ytdlp.js [--force]`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    installYtdlp({ force: process.argv.includes('--force') }).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
