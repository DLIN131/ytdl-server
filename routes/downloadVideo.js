import { spawn } from 'child_process'
import { copyFile, readdir, mkdtemp, rm, stat } from 'fs/promises'
import { createReadStream } from 'fs'
import os from 'os'
import path from 'path'
import express from 'express'
import ffmpegPath from 'ffmpeg-static'
import * as dotenv from 'dotenv'
import { installYtdlp } from '../scripts/install-ytdlp.js'

//preset
dotenv.config();
const router = express.Router()

// ytdl-core no longer works with YouTube, so the download is delegated to the
// standalone yt-dlp binary. It downloads into a temp dir and extracts the audio
// with ffmpeg; the metadata line it prints after that goes to stdout.
const META_PREFIX = '__META__';

// Optional: path to a Netscape-format cookies.txt (e.g. a Render secret file at
// /etc/secrets/cookies.txt) for when YouTube asks the server to sign in.
// yt-dlp writes cookies back, so it gets a writable copy. A missing file only
// disables cookies instead of breaking downloads.
const prepareCookies = async () => {
    const source = process.env.YT_COOKIES_FILE;
    if (!source) return null;
    const copy = path.join(os.tmpdir(), 'yt-cookies.txt');
    try {
        await copyFile(source, copy);
        console.log(`Using YouTube cookies from ${source}`);
        return copy;
    } catch (error) {
        const dir = path.dirname(source);
        const found = await readdir(dir).catch(() => null);
        console.warn(`YT_COOKIES_FILE ${source} could not be read (${error.code}); continuing without cookies. ` +
            `Files in ${dir}: ${found ? JSON.stringify(found) : '(directory not found)'}`);
        return null;
    }
}

// Make sure the binary exists. postinstall downloads the latest release on every
// build; `yt-dlp -U` is not used because it hits GitHub's API rate limit on Render.
const ready = (async () => {
    const binPath = await installYtdlp();
    return { binPath, cookiesPath: await prepareCookies() };
})();
ready.catch((err) => console.error('yt-dlp setup failed:', err));

// Safety net for temp dirs left behind when a killed yt-dlp keeps writing
// (its bundled-Python child process can outlive the killed launcher).
const TEMP_PREFIX = 'ytdl-';
const sweepTempDirs = async () => {
    const tmp = os.tmpdir();
    const entries = await readdir(tmp).catch(() => []);
    for (const name of entries.filter((n) => n.startsWith(TEMP_PREFIX))) {
        const dir = path.join(tmp, name);
        const info = await stat(dir).catch(() => null);
        if (info && Date.now() - info.mtimeMs > 60 * 60 * 1000) {
            await rm(dir, { recursive: true, force: true }).catch(() => {});
        }
    }
}
setInterval(sweepTempDirs, 60 * 60 * 1000).unref();

//download data route
router.route('/:videoId').get(async (req, res) => {
    const videoId = req.params.videoId;
    console.log(videoId);
    if (!/^[\w-]{11}$/.test(videoId)) {
        return res.status(400).send('Invalid video id.');
    }
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    let binPath, cookiesPath;
    try {
        ({ binPath, cookiesPath } = await ready);
    } catch (error) {
        return res.status(500).send('Downloader is not available.');
    }

    // On Render, YouTube often only offers muxed video+audio formats, so the
    // audio is extracted with ffmpeg. AAC audio is copied without re-encoding.
    const workDir = await mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    const cleanup = () => rm(workDir, { recursive: true, force: true }).catch(() => {});

    const args = [
        // prefer audio-only; otherwise the smallest reasonable muxed format
        '--format', 'bestaudio[ext=m4a]/bestaudio/best[acodec!=none][height<=480]/best[acodec!=none]',
        '--extract-audio', '--audio-format', 'm4a',
        '--ffmpeg-location', ffmpegPath,
        '--output', path.join(workDir, 'audio.%(ext)s'),
        '--quiet', '--no-warnings', '--no-playlist', '--no-simulate',
        // yt-dlp needs a JS runtime to solve YouTube's challenges; use this Node
        '--js-runtimes', `node:${process.execPath}`,
        '--print', `after_move:${META_PREFIX}%(.{title,filepath})j`,
    ];
    if (cookiesPath) args.push('--cookies', cookiesPath);
    // Optional extra yt-dlp flags, e.g. YT_PROXY=http://user:pass@host:port or
    // YTDLP_ARGS="--verbose" (whitespace-separated, no quoting)
    if (process.env.YT_PROXY) args.push('--proxy', process.env.YT_PROXY);
    if (process.env.YTDLP_ARGS) args.push(...process.env.YTDLP_ARGS.trim().split(/\s+/));
    args.push(videoUrl);
    const subprocess = spawn(binPath, args);

    let stdout = '';
    let stderr = '';
    subprocess.stdout.on('data', (chunk) => { stdout += chunk; });
    subprocess.stderr.on('data', (chunk) => { stderr += chunk; });

    const fail = (message) => {
        console.error('Error:', message);
        cleanup();
        if (!res.headersSent) {
            res.status(500).send('An error occurred while fetching the audio.');
        } else {
            res.destroy();
        }
    }

    // stop yt-dlp if the client goes away before the download finishes
    let clientClosed = false;
    res.on('close', () => {
        if (subprocess.exitCode === null) {
            clientClosed = true;
            subprocess.kill();
        }
        cleanup();
    });

    subprocess.on('error', (error) => fail(error.message));
    subprocess.on('close', async (code) => {
        if (clientClosed) {
            console.log('Client disconnected.');
            return cleanup();
        }
        const line = stdout.split('\n').map((l) => l.trim()).find((l) => l.startsWith(META_PREFIX));
        if (code !== 0 || !line) return fail(stderr.trim() || `yt-dlp exited with code ${code}`);

        try {
            const meta = JSON.parse(line.slice(META_PREFIX.length));
            const { size } = await stat(meta.filepath);
            const ext = path.extname(meta.filepath).slice(1) || 'm4a';
            const title = (meta.title || videoId).replace(/[\\/:*?"<>|]/g, '_');
            const filename = `${title}.${ext}`;
            const asciiFilename = filename.replace(/[^\x20-\x7e]/g, '_');

            res.setHeader('Content-Type', ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`);
            res.setHeader('Content-Length', size);
            res.setHeader('Content-Disposition',
                `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
            res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

            const fileStream = createReadStream(meta.filepath);
            fileStream.on('error', (error) => fail(error.message));
            res.on('finish', () => console.log('Download completed.'));
            fileStream.pipe(res);
        } catch (error) {
            fail(error.message);
        }
    });
});

export default router;
