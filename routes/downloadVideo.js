import ytdl from '@distube/ytdl-core'
import express from 'express'
import * as dotenv from 'dotenv'

//preset
dotenv.config();
const router = express.Router()

//download data route
router.route('/:videoId').get(async (req, res) => {
    const videoId = req.params.videoId;
    console.log(videoId);
    // const videoId = 'Yf0TR7cqHQI';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const audioStream = ytdl(videoUrl, { 
        quality: 'highestaudio',
        filter: 'audioonly'
    });
    console.log(videoUrl);
    audioStream.on('info', (info) => {
        console.log(info);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${info.title}"`);
        audioStream.pipe(res);
        // audioStream.pipe(fs.createWriteStream("audio.mp3"));
    });
    audioStream.on('end', () => {
        console.log('Download completed.');
    });
    audioStream.on('error', (error) => {
        console.error('Error:', error);
        res.status(500).send('An error occurred while fetching the audio.');
    });
});

export default router;