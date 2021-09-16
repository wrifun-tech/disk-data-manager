const fs = require('fs')
const fsExtra = require('fs-extra')
const path = require('path')
const request = require('request')
const slug = require('slug')
const req = require('request-promise')
const db = require("./db")
const {handleExtraJson, sleep} = require('../utils/fileData')
const {tl} = require('../utils/locale')
const mdbUri = 'https://api.themoviedb.org/3'
const imgHost = 'https://image.tmdb.org'
const mdbImgUrl = `${imgHost}/t/p/w500/`

const assert = require('http-assert')

const makeReq = async (options) => {

  if (!options) return false

  const { method, query, data, jsonParse, uri, sync, mdbRelated, locale } = options
  const methods = ['GET', 'POST', 'PUT', 'DEL']
  const methodUp = method.toUpperCase()

  if (!uri) return false
  if (!method.includes(methodUp)) return false

  const {proxy, tmdbKey = ''} = await handleExtraJson()

  if (mdbRelated) {
    assert(tmdbKey, tl({locale, key: 'tmdbKeyMissing'}))
  }
  const proxiedRequest = req.defaults({ proxy: proxy || null })
  const isGet = (methodUp === 'GET')
  const opts = {
    method: method,
    uri,
    json: jsonParse === false ? false : true,
  }

  if (mdbRelated) {
    opts.uri = mdbUri + uri
  }

  if (isGet) {
    opts['qs'] = {}
    mdbRelated && (opts.qs.api_key = tmdbKey)

    if (query) {
      opts.qs = Object.assign(opts.qs, query)
    }
  }
  if (!isGet && data) {
    opts['body'] = data
    mdbRelated && (opts['body'].api_key = tmdbKey)
  }
  if (sync) {
    const result = {
      err: null,
      data: null,
    }
    try {
      result.data = await proxiedRequest(opts)
    }
    catch (err) {
      assert(false, err)
    }
    return result
  }
  return proxiedRequest(opts)
}


function videoResPath () {
  const {mediaDir} = require('../utils/fileData').altAssetsDir()
  const bDir = mediaDir || path.join(__dirname, '../medias')
  const tmpPath = path.join(bDir, 'tmp')
  return {
    coverTmpPath: path.join(tmpPath, 'covers'),
    creditTmpPath: path.join(tmpPath, 'credits'),
    coverDestPath: path.join(bDir, 'covers'),
    creditDestPath: path.join(bDir, 'credits'),
  }
}
const dlImg = async (params, callback) => {
  const {
    filename,
    filePath,
    copyFile,
    createDescFile,
    dlPath,
    destPath,
    fileTmpPath,
  } = params
  const imgPath = dlPath || filename
  const imgUrl = mdbImgUrl + imgPath
  const tmpFilePath = path.join(fileTmpPath, filename)
  const tPath = copyFile ? tmpFilePath : filePath
  const txtExt = '.txt'
  const tDestPath = destPath ? path.join(destPath, filename) : tPath
  const fileAlready = (fPath) => fs.existsSync(fPath)
  const createIfNotFoundDir = async (path) => {
    if (!fs.existsSync(path)) {
      fsExtra.mkdirpSync(path)
    }
  }
  const {coverTmpPath, creditTmpPath, coverDestPath, creditDestPath} = videoResPath()
  await createIfNotFoundDir(coverTmpPath)
  await createIfNotFoundDir(creditTmpPath)
  await createIfNotFoundDir(coverDestPath)
  await createIfNotFoundDir(creditDestPath)

  if (fileAlready(tPath)) {
    let retryCount = 0
    const checkIfDlFinished = async () => {
      if (retryCount > 8) {
        return callback({ failedToDl: true })
      }
      if (fileAlready(tDestPath)) return callback && callback()
      await sleep(1500)
      retryCount += 1
      return checkIfDlFinished()
    }
    return checkIfDlFinished()
  }

  if (fileAlready(tDestPath)) {
    return callback && callback()
  }
  request.head(imgUrl, (err, res, body) => {

    if (err) {
      throw err
    }
    request(imgUrl).pipe(fs.createWriteStream(tPath)).on('close', () => {
      if (copyFile && destPath) {
        fs.copyFileSync(tPath, tDestPath)
        if (createDescFile) {
          fs.writeFileSync(path.join(destPath, createDescFile + txtExt), '')
        }
      }
      if (copyFile && tPath) {
        fs.unlinkSync(tPath, err => null)
      }
      callback && callback()
    });
  })
}

const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

const clearDir = (dirPath) => {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath)
    if (files.length) {
      files.forEach(fItem => {
        const fPath = path.join(dirPath, fItem)
        fs.unlinkSync(fPath)
      })
    }
  }
  return true
}

const storePic = async (mediaid, onFinish) => {
  if (!mediaid) return false
  const item = await db('videos').first().where({mediaid})
  const {coverTmpPath, creditTmpPath, coverDestPath, creditDestPath} = videoResPath()

  if (!item) {
    return console.error(`StorePic: Cannot find this video`)
  }
  const itemDetail = typeof item.detail === 'object' ? item.detail : item.detail ? JSON.parse(item.detail) : {}
  const itemCredits = typeof item.credits === 'object' ? item.credits : item.credits ? JSON.parse(item.credits) : {}
  MEDIA_DL_STATUS[mediaid] = 0
  const { id, poster_path, title, name } = itemDetail
  const oName = title || name
  const ext = '.jpg'
  const filename = id + ext
  const dlStatus = {
    cover: false,
    credits: false,
  }
  const idsDone = {
    cover: '',
    credits: [],
  }

  const optionsForCover = {
    filename,
    dlPath: poster_path,
    destPath: coverDestPath,
    copyFile: true,
    fileTmpPath: coverTmpPath,
    createDescFile: slug(`${id} ${oName}`),
  }

  if (poster_path) {
    dlImg(optionsForCover, () => {
      dlStatus.cover = true
      idsDone.cover = mediaid
    })
  }
  else {
    dlStatus.cover = true
  }

  const { crew, cast } = itemCredits
  const itemsHaveImg = []
  const appendedIds = []

  const creditsImg = (pList) => {
    if (!Array.isArray(pList) || pList.length <= 0) return false

    pList.forEach(cItem => {
      if (!cItem.profile_path) return false
      if (appendedIds.includes(cItem.id)) return false
      appendedIds.push(cItem.id)
      itemsHaveImg.push(cItem)
    })
    return true
  }

  creditsImg(crew)
  creditsImg(cast)

  const updateItem = async (val) => {
    return await db('videos').where({ mediaid }).update({ 'stored_pics': val })
  }

  if (!itemsHaveImg.length) {
    dlStatus.credits = true
  }
  const itemsIds = itemsHaveImg.map(cItem => cItem.id)
  const finishedIds = []
  let hasErr = false

  itemsHaveImg.forEach(cItem => {

    const { profile_path, id: pId, name } = cItem
    const cName = pId + ext
    const optionsForCredit = {
      filename: cName,
      dlPath: profile_path,
      destPath: creditDestPath,
      copyFile: true,
      fileTmpPath: creditTmpPath,
      createDescFile: name ? slug(`${pId} ${name}`) : null,
    }

    dlImg(optionsForCredit, (params) => {
      if (params && params.failedToDl) {
        hasErr = true
        return false
      }
      finishedIds.push(pId)
      dlStatus.credits = (finishedIds.length === itemsIds.length)
    })
  })

  const checkStatus = async () => {
    await sleep(2000)
    if (dlStatus.cover && dlStatus.credits) {
      hasErr = false
      MEDIA_DL_STATUS[mediaid] = 1
      console.log(mediaid + ' has finished all downloads')
      idsDone.credits = finishedIds
      await updateItem(JSON.stringify(idsDone))
      onFinish && onFinish()
      return true
    }

    return !hasErr && checkStatus()
  }
  return checkStatus()
}

const bulkDl = async () => {
  const vItems = await db('videos').where('stored_pics', null)
  const videos = vItems
  const {coverTmpPath, creditTmpPath} = videoResPath()

  if (!videos.length) return false

  clearDir(coverTmpPath)
  clearDir(creditTmpPath)

  const vSliced = videos.slice(0, 10)
  const idsBeingDled = vSliced.map(vItem => vItem.mediaid)
  const storePicCallback = () => {
    const newItem = videos[idsBeingDled.length]
    if (!newItem || idsBeingDled.includes(newItem.mediaid)) {
      return false
    }
    idsBeingDled.push(newItem.mediaid)
    storePic(newItem, storePicCallback)
  }

  vSliced.forEach(vItem => {
    storePic(vItem, storePicCallback)
  })

}
const MEDIA_DL_STATUS = {}
exports.makeReq = makeReq
exports.dlImg = dlImg
exports.deepClone = deepClone
exports.sleep = sleep
exports.storePic = storePic
exports.bulkDl = bulkDl
exports.MEDIA_DL_STATUS = MEDIA_DL_STATUS
