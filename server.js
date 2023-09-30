import  express  from 'express'
import cors from 'cors'
import connectDB from './mongodb/connect.js'
import register from './routes/register.js'
import login from './routes/login.js'
import googleLogin from './routes/googleLogin.js'
import protect from './routes/protected.js'
import download from './routes/downloadVideo.js'
import playlist from './routes/playlist.js' 

const app = express()
app.use(cors())
app.use(express.json())


connectDB(process.env.MONGODB_URL)
app.use('/register',register)
app.use('/login',login)
app.use('/google-login',googleLogin)
app.use('/protect',protect)
app.use('/download',download)
app.use('/playlist',playlist)






const port = process.env.PORT || 5000;

app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}` );
})

// app.post('/', async (req,res) => {
//     try {
//         const prompt = req.body.prompt
//         const response = await openai.createCompletion({
//             model: "text-davinci-003",
//             prompt: `${prompt}`,
//             temperature: 0,
//             max_tokens: 3000,
//             top_p: 1,
//             frequency_penalty: 0.5,
//             presence_penalty: 0,
//           });

//           res.status(200).send({
//             bot: response.data.choices[0].text
//           })
//     } catch (error) {
//         console.log(error);
//         res.status(500).send(error)
//     }
// })




// const videoUrl = 'https://www.youtube.com/watch?v=v5HmMuKswcc'; // Replace with the YouTube video URL
// const outputFilePath = 'video.mp3'; // Name of the output video file

// const videoStream = ytdl(videoUrl, { quality: 'highestaudio' });

// videoStream.on('info', (info) => {
//   console.log('Video info:', info.title);
//   videoStream.pipe(fs.createWriteStream(outputFilePath));
// });

// videoStream.on('end', () => {
//   console.log('Download completed.');
// });

// const audioStream = ytdl(videoUrl, { 
//     quality: 'highestaudio',
//     filter: 'audioonly'
//  });

// audioStream.on('info', (info) => {
//   console.log('audio info:', info.title);
//   audioStream.pipe(fs.createWriteStream(outputFilePath));
// });

// audioStream.on('end', () => {
//   console.log('Download completed.');
// });


// ytdl.getInfo(`${videoUrl}`, { quality: 'highestaudio' }, function(err, info) {
//     var stream = ytdl.downloadFromInfo(info, {
//      quality: 'highestaudio'
//     })
  
//     ffmpeg(stream)
//     .audioBitrate(info.formats[0].audioBitrate)
//     .withAudioCodec("libmp3lame")
//     .toFormat("mp3")
//     .saveToFile(`${videoId}.mp3`)
//     .on("error", function(err) {
//      console.log('error', err)
//      res.json(err)
//     })
//     .on("end", function() {
//     //  next() 
//     })
// })
