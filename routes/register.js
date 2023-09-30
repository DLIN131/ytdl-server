import express, { json } from 'express'
import * as dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken';
import PostUser from '../mongodb/models/userData.js'

dotenv.config();

const router = express.Router();


//GET ALL POSTS
router.route('/').get(async (req, res) => {
    try {
        
    } catch (error) {
        res.status(500).json({success: false, message: error})
        
    }
})

//CREATE A POST
router.route('/regist').post(async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body
        const existingUser = await PostUser.findOne({username})
        const existingEmail =await PostUser.findOne({email})
        if(existingUser){
            return res.status(400).json({success: false, message: 'Username already exists'})
        }
        else if(existingEmail){
            return res.status(400).json({success: false, message: 'Email already exists'})
        }
        else if(password !== confirmPassword){
            return res.status(400).json({success: false, message: 'password and confirmPassword not match'})
        }

        const saltRounds  = 10 //將密碼哈希
        const hashedPassword = await bcrypt.hash(password, saltRounds)

        // 創進新用戶
        const newUser = await PostUser.create({
            username,
            email,
            password: hashedPassword,
        })
        console.log(newUser);
        await newUser.save() // 將用戶存入資料庫
        res.status(201).json({message: '註冊成功', data: newUser})
    } catch (error) {
        res.status(500).json({success: false, message: error})
    }

})

export default router
