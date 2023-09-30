import express from 'express'
import * as dotenv from 'dotenv'
import jwt from 'jsonwebtoken';
import PostUser from '../mongodb/models/userData.js';

const router = express.Router()
dotenv.config()


async function verifyToken(req, res, next) {
  let token = req.headers['x-access-token'] || req.headers.authorization;
  if (!token) {
    return res.status(401).json({ 
      status: 401,
      error: 'No token provided.'
    });
  }
  if (token.startsWith('Bearer ')) {
    // Remove Bearer from string
    token = token.slice(7, token.length);
  }
  try { 
    const decoded = await jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  }catch (err) {
    return res.status(401).json({
      status: 401,
      error: 'Token is not valid'
    })
  }
}

router.route('/').get(verifyToken, async (req, res) => {
  const uid = req.user.userId
  console.log(uid);
  const userInfo = await PostUser.findOne({userId: uid})
  console.log(userInfo);
  res.status(200).json(userInfo)
})

export default router