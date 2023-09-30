import express from 'express'
import * as dotenv from 'dotenv'
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import PostUser from '../mongodb/models/userData.js'

const router = express.Router()
dotenv.config();



router.route('/').get((req,res) => {
    res.send('hello')
})

router.route('/').post(async (req, res) => {
    try {
        const oauth2Client = new OAuth2Client();
        const googleAccessToken = req.body.access_token;
        console.log(googleAccessToken);
        oauth2Client.setCredentials({ access_token: googleAccessToken })
        const userInfo = await oauth2Client
        .request({
          url: 'https://www.googleapis.com/oauth2/v3/userinfo'
        })
        .then((response) => response.data)
        .catch(() => null)
        
        const user = {
            userId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            avatar: userInfo.picture,
            emailVerified: userInfo.email_verified
        }
        const userName = user.name
        const userEmail = user.email
        console.log(userName);
        const existingUser = await PostUser.findOne({email: userEmail})
        if(existingUser){
            console.log('isexist:'+existingUser );
            const token = jwt.sign({userId: existingUser.userId}, process.env.JWT_SECRET,{expiresIn: '24h'})
            return res.status(200).json({success: true, user: user, token})
        }

        const newUser = await PostUser.create({
            userId: user.userId,
            username: userName,
            email: userEmail,
            avatar: user.avatar,
        })
        console.log(newUser);
        await newUser.save() // 將用戶存入資料庫

        const token = jwt.sign({userId: user.userId}, process.env.JWT_SECRET,{expiresIn: '24h'})
        oauth2Client.revokeCredentials()
        res.status(200).json({success: true, user: user, token})
      
    } catch (error) {
        console.log('google login faild');
        res.status(401).json({success: false, error: error.message})
    }
})

export default router