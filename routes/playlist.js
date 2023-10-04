import express from "express";
import playlistData from "../mongodb/models/playlisData.js";
import * as dotenv from 'dotenv'

dotenv.config()
const router = express.Router();

let combinedData = []
router.route('/').post(async (req,res) => {
  const uid = req.body.userId;
  const username = req.body.username;
  const plaName = req.body.listname;
  const plaData = req.body.playlist;
  const dataLength = req.body.dataLength
  const chunk = JSON.parse(plaData)
  combinedData.push(...chunk)
  console.log(`接收到 ${chunk.length} 個資料項目，目前總共有 ${combinedData.length} 個資料項目`);
  if(combinedData.length === dataLength){
    const isExistPlaylist = await playlistData.findOne({
      userId: uid,
    })
    if(!isExistPlaylist){
      const createPlaylist = await playlistData.create({
        userId: uid,
        username: username,
        items: [
          {
            listname: plaName,
            playlist: combinedData,
          }
        ]
      })
      if(createPlaylist){
        return res.status(201).json({
          success: true,
          message: '新增清單成功'
        })
      }
    }else if(isExistPlaylist){
      const plaIndex = isExistPlaylist.items.findIndex(item => item.listname === plaName);
      if(plaIndex !== -1){
          isExistPlaylist.items[plaIndex].playlist = combinedData;
          const plaUpdate = await isExistPlaylist.save();
          if(plaUpdate){
            return res.status(200).json({
              success: true,
              message: '覆蓋'+plaName+'清單成功'})
        }
      }
      else{
        isExistPlaylist.items.push({
          listname: plaName,
          playlist: combinedData,
        })
        isExistPlaylist.save();
        return res.status(200).json({success: true, message: '新增'+plaName+'清單成功'})
      }
    }
    else{
      return res.status(400).json({success: false, message: '清單存儲變更失敗'})
    }
    res.status(400).json({success: false, message: '新增清單失敗'})

    combinedData = []
  }else{
    res.status(200).json({success: false, message: '接收資料中'})
  }
  
  
})





router.route('/:userId').put( async(req, res) =>{
  try {
    
    const {userId} = req.params;
    const {listname, playlist} = req.body;

    const updatePlaylist = await playlistData.findOne({userId: userId});
    if(!updatePlaylist){
      return res.status(404).json({success: false, message: '待更新清單不存在'})
    }

    const plaIndex = updatePlaylist.items.findIndex(item => item.listname === listname);
    if(plaIndex !== -1){
        updatePlaylist.items[plaIndex].playlist = playlist;
        const plaUpdate = await updatePlaylist.save();
        if(plaUpdate){
          return res.status(200).json({
            success: true,
            message: '覆蓋'+listname+'清單成功'})
      }
    }
    else{
      updatePlaylist.items.push({
        listname: listname,
        playlist: playlist,
      })
      updatePlaylist.save();
      return res.status(200).json({success: true, message: '新增'+listname+'清單成功'})
    }

    res.status(400).json({success: false, message: '更新清單步驟失敗'})

  } catch (err) {
    console.log(err)
    res.status(500).json( {success: false, message: '更新清單失敗'})
  }
})




router.route('/').get(async(req, res) =>{
  const {userId, listname} = req.query;
  console.log(req.query);
  try {
    const playlistD = await playlistData.findOne({userId: userId})
    if(!playlistD){
      return res.status(400).json({success: false, message: '清單不存在'})
    }
    const playlist  =  playlistD.items.find(item => item.listname === listname)
    if(!playlist){
      return res.status(400).json({success: false, message: '找不到相對應的清單'})
    }

    res.status(200).json({success: true, message: '播放清單資料獲取成功', data: playlist})

  }catch (err) {
    res.status(404).json({success: false, message: '播放清單資料獲取失敗'})
  }
})

router.route('/listname').get( async (req,res)=>{
  const {userId} = req.query
  const playlistD = await playlistData.findOne({userId: userId})
  if(!playlistD){
    return res.status(400).json({success: false, message: '清單不存在'})
  }
  console.log('====================================');
  console.log(playlistD);
  console.log('====================================');
  const listnames =  playlistD.items.map(item => item.listname);
  res.status(200).json({success: true, message: '清單名稱獲取成功', listnames: listnames})
})

router.route('/').delete( async (req,res)=>{
  try {
    const {userId, listname} = req.query
    console.log(req.query);
    const playlistD = await playlistData.findOne(
        {userId: userId}
      )
    if(playlistD){
      const index = playlistD.items.findIndex(item => item.listname === listname)
      playlistD.items.splice(index, 1)
      await playlistD.save()
      return res.status(200).json({success: true, message: '清單刪除成功'})
    }


      return res.status(400).json({success: false, message: '清單刪除失敗'})

  } catch (error) {
    res.status(500).json({message: '內部伺服器處理失敗'})
  }
})

export default router