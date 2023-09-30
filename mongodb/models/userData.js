import mongoose from "mongoose";

const user = new mongoose.Schema({
    userId:{type: String, required: true},
    username:{type: String, required: true},
    email:{type: String, required: true},
    avatar:{type: String},
    createdAt:{type: Date,default: Date.now},//取得時間戳記
})

const PostUser = mongoose.model('PostUser', user)

export default PostUser;