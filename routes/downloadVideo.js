import { spawn } from 'child_process'
import { copyFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import express from 'express'
import * as dotenv from 'dotenv'
import { installYtdlp } from '../scripts/install-ytdlp.js'

//preset
dotenv.config();
const router = express.Router()

// ytdl-core no longer works with YouTube, so the download is delegated to the
// standalone yt-dlp binary. Audio goes to stdout, and the metadata line printed
// right before the download goes to stderr.
const META_PREFIX = '__META__';

// Optional: path to a Netscape-format cookies.txt (e.g. a Render secret file at
// /etc/secrets/cookies.txt) for when YouTube asks the server to sign in.
// yt-dlp writes cookies back, so it gets a writable copy.
const prepareCookies = async () => {
    if (!process.env.YT_COOKIES_FILE) return null;
    const copy = path.join(os.tmpdir(), 'yt-cookies.txt');
    await copyFile(process.env.YT_COOKIES_FILE, copy);
    return copy;
}

// Make sure the binary exists. postinstall downloads the latest release on every
// build; `yt-dlp -U` is not used because it hits GitHub's API rate limit on Render.
const ready = (async () => {
    const binPath = await installYtdlp();
    return { binPath, cookiesPath: await prepareCookies() };
})();
ready.catch((err) => console.error('yt-dlp setup failed:', err));

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

    const args = [
        '--format', 'bestaudio[ext=m4a]/bestaudio',
        '--output', '-',
        '--quiet', '--no-warnings', '--no-playlist', '--no-simulate',
        // yt-dlp needs a JS runtime to solve YouTube's challenges; use this Node
        '--js-runtimes', `node:${process.execPath}`,
        '--print', `before_dl:${META_PREFIX}%(.{title,ext,filesize})j`,
    ];
    if (cookiesPath) args.push('--cookies', cookiesPath);
    // Optional extra yt-dlp flags, e.g. YT_PROXY=http://user:pass@host:port or
    // YTDLP_ARGS="--verbose" (whitespace-separated, no quoting)
    if (process.env.YT_PROXY) args.push('--proxy', process.env.YT_PROXY);
    if (process.env.YTDLP_ARGS) args.push(...process.env.YTDLP_ARGS.trim().split(/\s+/));
    args.push(videoUrl);
    const subprocess = spawn(binPath, args);

    let stderr = '';
    let started = false;
    subprocess.stderr.on('data', (chunk) => {
        stderr += chunk;
        if (started) return;
        const line = stderr.split('\n').map((l) => l.trim()).find((l) => l.startsWith(META_PREFIX));
        if (!line || !line.endsWith('}')) return;
        started = true;

        const meta = JSON.parse(line.slice(META_PREFIX.length));
        const ext = meta.ext || 'm4a';
        const title = (meta.title || videoId).replace(/[\\/:*?"<>|]/g, '_');
        const filename = `${title}.${ext}`;
        const asciiFilename = filename.replace(/[^\x20-\x7e]/g, '_');

        res.setHeader('Content-Type', ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`);
        if (meta.filesize) res.setHeader('Content-Length', meta.filesize);
        res.setHeader('Content-Disposition',
            `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        subprocess.stdout.pipe(res);
    });

    let clientClosed = false;
    const fail = (message) => {
        console.error('Error:', message);
        if (!res.headersSent) {
            res.status(500).send('An error occurred while fetching the audio.');
        } else {
            res.destroy();
        }
    }
    subprocess.on('error', (error) => fail(error.message));
    subprocess.on('close', (code) => {
        if (code === 0) {
            console.log('Download completed.');
        } else if (clientClosed) {
            console.log('Client disconnected.');
        } else {
            fail(stderr.trim());
        }
    });

    // stop yt-dlp if the client goes away before the download finishes
    res.on('close', () => {
        if (!res.writableFinished && subprocess.exitCode === null) {
            clientClosed = true;
            subprocess.kill();
        }
    });
});

export default router;
