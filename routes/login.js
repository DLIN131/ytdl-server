import express from 'express'
import * as dotenv from 'dotenv'
import PostUser from '../mongodb/models/userData.js';
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

dotenv.config();

const router = express.Router()



router.route('/').get((req,res) => {
    res.send('hello')
})

router.route('/').post(async (req, res) => {
    try {
       const {username, password} = req.body
       const user = await PostUser.findOne({username})
       if(!user){
        return res.status(401).send('User not found')
       }
       const passwordMatch = bcrypt.compare(password, user.password)
       if(!passwordMatch){
        return res.status(401).send('password not match')
       }

       const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET,{expiresIn: '24h'})
       res.status(200).json({token})

      
    } catch (error) {
        console.log(error);
        res.status(500).send(error)
    }
})

export default router