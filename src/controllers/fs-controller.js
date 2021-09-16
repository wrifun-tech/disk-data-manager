const path = require('path')
const fs = require('fs')
const assert = require('http-assert')
const db = require("../lib/db")
const fsExtra = require('fs-extra')
const {chunk} = require('../utils/basicHelpers')
const {tl} = require('../utils/locale')
const {handleExtraJson, escapeRegExp, sleep} = require('../utils/fileData')

async function scanDir (ctx) {
  const res = await scanDirFn({params: ctx.request.body})
  ctx.body = res
}

async function scanDirFn ({params}) {
  const { dirPath, catId, subCatId, driveLabel, locale } = params
  const tCatId = Number(catId)
  const validCatId = (Number.isInteger(tCatId) && tCatId > 0) ? tCatId : null
  const tSubCatId = Number(subCatId)
  const validSubCatId = (Number.isInteger(tSubCatId) && tSubCatId > 0) ? tSubCatId : null
  const validDirPath = typeof dirPath === 'string' && fs.existsSync(path.normalize(dirPath))
  const validDriveLabel = (typeof driveLabel === 'string' && driveLabel.trim() !== '') ? driveLabel : ''

  assert(validDirPath, tl({locale, key: 'invalidDirPath'}))

  if (validDriveLabel) {
    await handleExtraJson({labelName: validDriveLabel})
  }

  const {potentialDup} = await handleExtraJson()
  const doOverride = potentialDup === 'override'
  const rootPath = path.normalize(dirPath)
  const files = await readDirSync({dirPath: rootPath})
  const filesToInsert = []
  const res = {
    countNewItems: 0, dupItems: [], countFound: files.length
  }

  for (const file of files) {
    if (driveLabel) {
      Object.assign(file, {drive_label: driveLabel})
    }

    const dupItem = await gotSimilarItem({name: file.name, original_size: file.original_size, type: file.type})

    if (dupItem && doOverride) {
      res.dupItems.push({...file, oItem: dupItem})
      const needChangeCatId = doChangePropFn({valA: validCatId, valB: dupItem.cat_id})
      const needChangeSubCatId = doChangePropFn({valA: validSubCatId, valB: dupItem.sub_cat_id})

      // console.log(`DUP CHECK::::::`, needChangeCatId, needChangeSubCatId)

      if (needChangeCatId || needChangeSubCatId) {
        const cInfo = {cat_id: validCatId, sub_cat_id: validSubCatId}
        if (!validCatId && dupItem.file_id) {
          await db('file_category').where({file_id: dupItem.file_id}).del()
        }
        if (validCatId) {
          if (dupItem.file_id) {
            await db('file_category').where({file_id: dupItem.file_id}).update(cInfo)
          }
          else {
            await db('file_category').insert({...cInfo, file_id: dupItem.id})
          }
        }
      }

      await db('files').where({id: dupItem.id}).update({...file, updated_at: new Date().toISOString()})

      continue
    }
    filesToInsert.push(file)
  }
  const fLen = res.countNewItems = filesToInsert.length
  if (fLen) {
    const listChunk = chunk({list: filesToInsert, chunkSize: 30})
    for (const tChunk of listChunk) {
      const chunkLen = tChunk.length
      await db('files').insert(tChunk, 'id').then(async function (rData) {

        const rId = Array.isArray(rData) && rData[0]
        if (validCatId && Number.isInteger(rId)) {
          const ids = Array(chunkLen).fill(0).map((num, idx) => rId - idx)
          const vList = ids.map(fId => {
            const vItem = {file_id: fId, cat_id: validCatId}
            if (validSubCatId) {
              Object.assign(vItem, {sub_cat_id: validSubCatId})
            }
            return vItem
          })
          try {
            await db('file_category').insert(vList)
          }
          catch (err) {
            console.error(`ERROR when batchInsert file_category.........`)
          }
        }
      })
    }
  }
  return res
}

async function readDirSync ({dirPath}) {
  let files = []
  let enableDeepScan = await isDeepScanFn({filepath: dirPath, passSymbolCheck: true})
  const fList = fs.readdirSync(dirPath, 'utf-8')
  const repList = await db('format_filename')
  const repListFn = (nameStr, isDir) => {
    if (!isDir) {
      const isDotFirstAndOnly = nameStr[0] === '.' && nameStr.match(/\./g).length === 1
      if (!isDotFirstAndOnly) {
        let nArr = nameStr.split('.')
        const nExt = nArr.pop()
        nameStr = nameStr.replace(`.${nExt}`, '')
      }
    }
    if (repList.length) {
      const rStr = repList.map(rItem => escapeRegExp(rItem.name)).join('|')
      const repReg = new RegExp(rStr, 'gi')
      return nameStr.replace(repReg, ' ').replace(/\s{2,}/g, ' ')
    }
    return nameStr
  }

  for (const file of fList) {
    const doSkip = await isFileExcluded({name: file})
    if (doSkip) {
      continue
    }
    const filepath = path.join(dirPath, file)
    const {bytes, fileType, isDir} = await getFolderSize({filepath})
    // console.log(`????????fullPath:${filepath}???????isDir:${isDir} bytes:${bytes}::::::::fileType:${fileType} --------- `,  readableSize)

    const fileProp = {
      filepath,
      original_size: bytes,
      type: fileType,
      name: repListFn(file, isDir),
      drive_label: '',
    }
    files.push(fileProp)

    if (isDir && enableDeepScan) {
      const nFiles = await readDirSync({dirPath: filepath})
      files = [...files, ...nFiles]
    }
    if (isDir && !enableDeepScan) {
      const shouldContinueScanThisFile = await isDeepScanFn({filepath, filename: file})
      if (shouldContinueScanThisFile) {
        const nFiles = await readDirSync({dirPath: filepath})
        files = [...files, ...nFiles]
      }
    }
  }

  return files
}
async function isDeepScanFn ({filepath, passSymbolCheck, filename}) {
  let isDeepScan = false
  if (!passSymbolCheck && filename) {
    const cSymbols = await db('collection_symbol').select(['name'])

    isDeepScan = cSymbols.some(item => {
      const reg = new RegExp(item.name, 'gi')
      return reg.test(filename)
    })
  }
  if (!isDeepScan) {
    const fDeepPath = await db('deepscan_path').first().whereRaw(`LOWER(name) = ?`, filepath.toLowerCase())

    if (fDeepPath) {
      isDeepScan = true
    }
  }
  return isDeepScan
}

async function getFolderSize ({filepath}) {
  let bytes = 0
  let hasErr = false
  let fileType = 'folder'
  let isDir = false
  try {
    const fStat = fs.lstatSync(filepath)

    if (fStat.isFile()) {

      bytes += fStat.size
      fileType = path.extname(filepath).substring(1).toUpperCase()
    }
    if (fStat.isDirectory()) {
      isDir = true
      const files = fs.readdirSync(filepath, 'utf-8')
      for (const file of files) {
        const fPath = path.join(filepath, file)
        bytes += (await getFolderSize({filepath: fPath})).bytes
      }
    }
  }
  catch (err) {
    console.error(`getFolderSize ERROR:::::: `, err)
    hasErr = true
  }
  return {bytes, hasErr, fileType, isDir}
}

async function isFileExcluded ({name}) {
  const findN = await db('file_exclusion').first().whereRaw('LOWER(name) = ?', name.toLowerCase())
  const bool = findN ? true : false

  return bool
}

async function gotSimilarItem ({name, original_size, type}) {
  const findItem = await db('files')
    .first()
    .whereRaw(`LOWER(name) = ?`, name.toLowerCase())
    .where({original_size, type})
    .leftJoin('file_category', 'file_category.file_id', 'files.id')


  if (findItem) {
    const categoryInfo = await db('file_category').first().where({file_id: findItem.id})
    if (categoryInfo) {
      Object.assign(findItem, categoryInfo)
    }
  }
  return findItem
}

function doChangePropFn ({valA, valB}) {
  return !!((!valA && valB) || (valA && !valB) || (valA !== valB))
}

async function getDrives (ctx) {
  const res = {drives: []}
  const sysInfo = require('systeminformation')

  try {
    const drives = await sysInfo.blockDevices()
    for (const item of drives) {
      const nSize = Number(item.size)

      if (nSize > 0) {
        let driveLetter = item.mount || item.identifier
        driveLetter = driveLetter.replace(':', '')
        const info = {
          driveLetter,
          driveLabel: item.label,
          driveSize: nSize,
        }
        res.drives.push(info)
      }
    }
  }
  catch (err) {
    console.error(`GET DRIVES:::::::`, err)
  }
  ctx.body = res
}

async function getFolders (ctx) {
  const {dirpath} = ctx.query

  assert(fs.existsSync(dirpath), 'PATH DOES NOT EXIST')

  const res = {dirs: []}
  const excludeDirs = [
    '$RECYCLE.BIN', 'System Volume Information', 'Config.Msi',
    '$Hyper-V.tmp', '$SysReset', 'Documents and Settings',
    'found.000', 'PerfLogs', 'Program Files (x86)', 'ProgramData',
    'Recovery', 'Windows', 'Windows.old', 'Program Files',
  ]
  const fList = fs.readdirSync(dirpath, 'utf-8')
  for (const file of fList) {
    const filepath = path.join(dirpath, file)
    try {
      const isPathDir = fs.statSync(filepath).isDirectory()
      if (isPathDir && !excludeDirs.includes(file)) {
        res.dirs.push({'file': file, 'filepath': filepath})
      }
    }
    catch (err) {

    }
}
  ctx.body = res
}
async function clearElectronCache (ctx) {
  const {doClear, doReload} = ctx.query
  const {BrowserWindow} = require('electron')
  if (BrowserWindow) {
    const mWin = BrowserWindow.getFocusedWindow()
    if (doClear) {
      mWin.webContents.session.clearCache()
      await sleep(3000)
    }
    if (doReload) {
      mWin.webContents.reloadIgnoringCache()
    }
  }
  ctx.body = {}
}
module.exports = {
  scanDir, getDrives, getFolders, clearElectronCache
}
