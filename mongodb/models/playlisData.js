import mongoose from "mongoose";

const snippetSchema = new mongoose.Schema({
  listname: {type : String, required: true},
  playlist:[
    {
      id: { type: String, required: true },
      snippet: {
        position: Number,
        resourceId: {
          videoId: String
        },
        thumbnails: {
          medium: {
            url: String
          }
        },
        title: String
      }
    }],
})

const playlistSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  items: [snippetSchema],
  createdAt:{type: Date,default: Date.now}

})

const playlistData = mongoose.model("playlistData", playlistSchema);
export default playlistData;
