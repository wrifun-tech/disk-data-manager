function onAddDrivesDataClickFn () {
  GLOBAL_DEF.checkDirPath = ''
  handleCategoryUI()
  getDrives({
    onData ({data}) {
      const drives = data && data.drives
      if (Array.isArray(drives) && drives.length) {
        handleModalStyle('drives', 'open')
        GLOBAL_DEF.drives = drives
        const listWp = document.querySelector('.hdd-list')
        listWp.style.maxHeight = document.body.clientHeight * 0.6
        listWp.innerHTML = ''
        for (const [index, drive] of drives.entries()) {
          appendDriveElement({drive, listWp, index})
        }
        const eItems = document.querySelectorAll('.hdd-drive-item')
        const eItemList = Array.from(eItems)
        for (const eItem of eItemList) {
          eItem.addEventListener('change', (evt) => {
            const eP = evt.target.parentNode.parentNode
            const itemData = drives[eP.dataset.index]

            const ePressed = document.querySelector('.hdd-dir-item-name.item-pressed')
            if (ePressed) {
              removeClass(ePressed, 'item-pressed')
            }
            upSelection({
              el: evt.target,
              path: `${itemData.driveLetter}:\\`,
              driveLetter: itemData.driveLetter,
              driveLabel: itemData.driveLabel
            })
            getDirs({
              dirpath: GLOBAL_DEF.checkDirPath,
              parentNode: eP,
              onData ({data: gData}) {
                const dirs = gData && gData.dirs
                try {
                  handleDirs({dirs, driveData: itemData, parentNode: eP})
                }
                catch (err) {console.error(':::::::::::', err)}
              }
            })
          })
        }
      }
    }
  })
}
function onAddDrivesDataClick () {
  try {
    onAddDrivesDataClickFn()
  }
  catch (err) {
    console.error(`onAddDrivesDataClick ERR: `, err)
  }
}
function handleCategoryUI () {
  const hasCategories = GLOBAL_DEF.categories.length > 0
  const eEmpty = document.querySelector('.hdd-select-wp .empty-tip-gp')
  const eSelCategory = document.querySelector('.hdd-select-wp')
  const clearSub = () => {
    const subEl = document.querySelector('.hdd-select-wp-sub')
    if (subEl && subEl.innerHTML) {subEl.innerHTML = ''}
  }
  const eSub = document.querySelector('.hdd-select-wp-sub')
  const renderSubSel = () => {
    if (GLOBAL_DEF.driveSelectedCat.subCategories && GLOBAL_DEF.driveSelectedCat.subCategories.length) {
      if (!eSub.querySelector('.hdd-select-label')) {
        const subLabel = document.createElement('span')
        subLabel.className = 'hdd-select-label'
        subLabel.innerHTML = LNG.selectSubCat
        eSub.appendChild(subLabel)
      }
      renderSelection({
        options: GLOBAL_DEF.driveSelectedCat.subCategories, el: eSub,
        selection: GLOBAL_DEF.driveSelectedSubCat,
        onChange ({val}) {
          syncSelectedCategory({sId: Number(val)})
        }
      })
    }
    else {
      clearSub()
    }
  }

  if (!hasCategories) {
    eEmpty.innerHTML = LNG.haveNoCategory
    const rLink = document.createElement('span')
    rLink.innerHTML = LNG.goToSettings
    rLink.className = 'empty-tip-fix'
    eEmpty.appendChild(rLink)
    rLink.addEventListener('click', () => {
      handleModalStyle('drives', 'close')
      openSettings()
    })
    const cSel = document.querySelector('.hdd-select-wp .st-data-select')
    if (cSel) {
      cSel.parentNode.removeChild(cSel)
    }
    clearSub()
  }
  if (hasCategories) {
    eEmpty.innerHTML = ''
  }

  syncSelectedCategory()
  renderSelection({
    options: GLOBAL_DEF.allCategory(), el: eSelCategory,
    selection: GLOBAL_DEF.driveSelectedCat,
    insertBeforeEl: eEmpty,
    onChange ({val}) {
      syncSelectedCategory({cId: Number(val)})
      renderSubSel()
    }
  })
  renderSubSel()
}

function renderSelection ({options, valueProp, textProp, el, selection, onChange, insertBeforeEl}) {
  const rSel = el.querySelector('.st-data-select')
  if (rSel) {
    rSel.parentNode.removeChild(rSel)
  }
  const eSelect = document.createElement('select')
  eSelect.className = 'st-data-select'
  const vProp = valueProp || 'id'
  const tProp = textProp || 'name'

  insertBeforeEl ? el.insertBefore(eSelect, insertBeforeEl) :  el.appendChild(eSelect)

  if (options) {
    for (const oItem of options) {
      const eOption = document.createElement('option')
      eOption.value = oItem[vProp] || ''
      if (selection && selection[vProp] === Number(eOption.value)) {
        eOption.selected = true
      }
      eOption.innerHTML = oItem[tProp] || ''
      eSelect.appendChild(eOption)
    }
  }

  eSelect.addEventListener('change', (evt) => {
    const val = evt.target.value
    onChange && onChange({val})
  })
}
function syncSelectedCategory (params) {
  const {cId, sId} = params || {}
  const allCat = GLOBAL_DEF.allCategory()
  if (!GLOBAL_DEF.driveSelectedCat) {
    GLOBAL_DEF.driveSelectedCat = allCat[0]
  }
  if (!GLOBAL_DEF.driveSelectedSubCat && GLOBAL_DEF.driveSelectedCat) {
    if (GLOBAL_DEF.driveSelectedCat && GLOBAL_DEF.driveSelectedCat.subCategories && GLOBAL_DEF.driveSelectedCat.subCategories.length) {
      GLOBAL_DEF.driveSelectedSubCat = GLOBAL_DEF.driveSelectedCat.subCategories[0]
    }
  }
  if (cId) {
    const cSelection = allCat.find(fItem => fItem.id === cId)
    if (cSelection) {
      GLOBAL_DEF.driveSelectedCat = cSelection
      GLOBAL_DEF.driveSelectedSubCat = null
      syncSelectedCategory()
    }
  }
  if (sId && GLOBAL_DEF.driveSelectedCat && GLOBAL_DEF.driveSelectedCat.subCategories) {
    const cSelection = GLOBAL_DEF.driveSelectedCat.subCategories.find(fItem => fItem.id === sId)
    if (cSelection) {
      GLOBAL_DEF.driveSelectedSubCat = cSelection
    }
  }
  if (GLOBAL_DEF.driveSelectedCat) {
    const findC = allCat.find(fItem => fItem.id === GLOBAL_DEF.driveSelectedCat.id)
    if (findC) {
      Object.assign(GLOBAL_DEF.driveSelectedCat, findC)
    }
    else {
      GLOBAL_DEF.driveSelectedCat = null
      GLOBAL_DEF.driveSelectedSubCat = null
      syncSelectedCategory()
    }
  }
  if (GLOBAL_DEF.driveSelectedSubCat) {
    const fSub = GLOBAL_DEF.driveSelectedCat && GLOBAL_DEF.driveSelectedCat.subCategories && GLOBAL_DEF.driveSelectedCat.subCategories.find(fItem => fItem.id === GLOBAL_DEF.driveSelectedSubCat.id)
    if (fSub) {
      Object.assign(GLOBAL_DEF.driveSelectedSubCat, fSub)
    }
    else {
      GLOBAL_DEF.driveSelectedSubCat = null
      syncSelectedCategory()
    }
  }
}
function upSelection ({el, driveLetter, path, driveLabel}) {
  const findSelected = document.querySelector('.hdd-drive-item-wp.selected')

  if (findSelected) {
    removeClass(findSelected, 'selected')
  }
  const eP = findAncestor(el, 'hdd-drive-item-wp')
  addClass(eP, 'selected')

  upPathValue({pathVal: path})
  GLOBAL_DEF.checkDirPath = path
  GLOBAL_DEF.selectedDriveLabel = driveLabel
}
function upPathValue ({pathVal}) {
  const eDriveValue = document.querySelector('.hdd-drive-value')
  eDriveValue.innerHTML = pathVal
}
function getDrives ({onData}) {
  apiRequest({
    uri: `/drives`,
    onData (data) {
      onData && onData({data})
    }
  })
}
function getDirs ({onData, dirpath, parentNode}) {
  if (parentNode && parentNode.querySelector(':scope>.hdd-dirs')) {
    return console.warn('Already added')
  }
  apiRequest({
    uri: `/folders`,
    urlParams: {dirpath},
    onData (data) {

      if (data && (!Array.isArray(data.dirs) || !data.dirs.length)) {
        handleToast({msg: LNG.noDirectory, showToast: true})
        Object.assign(data, {noDir: true})
      }
      onData && onData({data})
    }
  })
}

function appendDriveElement ({drive, listWp, index}) {
  const eWp = document.createElement('div')
  eWp.className = 'hdd-drive-item-wp'

  const eItem = document.createElement('label')
  eItem.className = 'hdd-drive-item'

  const eRadio = document.createElement('input')
  eRadio.type = 'radio'
  eRadio.name = 'drive-radio'
  eRadio.className = 'hdd-drive-item-radio'

  const eLetter = document.createElement('div')
  eLetter.className = 'hdd-drive-item-letter'
  eLetter.innerHTML = `${drive.driveLetter}:`

  const eLabel = document.createElement('div')
  eLabel.className = 'hdd-drive-item-label'
  eLabel.innerHTML = `${drive.driveLabel}`

  listWp.appendChild(eWp)
  eWp.appendChild(eItem)
  eItem.appendChild(eRadio)
  eItem.appendChild(eLetter)
  eItem.appendChild(eLabel)
  eWp.dataset.index = index
}

function handleDriveListModalHide () {
  const eDriveValue = document.querySelector('.hdd-drive-value')
  const ePath = document.querySelector('.hdd-path-value')
  eDriveValue.innerHTML = ''
  addClass(ePath, 'hidden')
}

function onScanDrive () {

  let errMsg = ''
  const sParams = {dirPath: GLOBAL_DEF.checkDirPath}

  if (GLOBAL_DEF.selectedDriveLabel) {
    sParams.driveLabel = GLOBAL_DEF.selectedDriveLabel
  }
  if (GLOBAL_DEF.driveSelectedCat) {
    sParams.catId = GLOBAL_DEF.driveSelectedCat.id
  }
  if (GLOBAL_DEF.driveSelectedSubCat) {
    sParams.subCatId = GLOBAL_DEF.driveSelectedSubCat.id
  }
  if (!errMsg && !sParams.dirPath) {
    errMsg = LNG.noDirPathTip
  }
  if (errMsg) {
    return handleToast({msg: errMsg, showToast: true})
  }

  popBox({
    supportCloseBtn: true,
    labelOk: LNG.Confirm,
    onRenderMsg ({msgWp}) {
      const eTitle = document.createElement('div')
      eTitle.innerHTML = LNG.goingToAddData
      eTitle.className = 'hdd-addData-popup-title  hdd-addData-popupProp'

      const ePath = document.createElement('div')
      ePath.innerHTML = sParams.dirPath
      ePath.className = 'hdd-addData-popup-path hdd-addData-popupProp'

      const eCategory = document.createElement('div')
      eCategory.innerHTML = `${LNG.category}: ${GLOBAL_DEF.driveSelectedCat.name}`
      eCategory.className = 'hdd-addData-popup-category  hdd-addData-popupProp'

      msgWp.appendChild(eTitle)
      msgWp.appendChild(ePath)
      msgWp.appendChild(eCategory)

      if (GLOBAL_DEF.driveSelectedSubCat) {
        const eSub = document.createElement('div')
        eSub.innerHTML = `${LNG.subCategory}: ${GLOBAL_DEF.driveSelectedSubCat.name}`
        eSub.className = 'hdd-addData-popup-subCategory  hdd-addData-popupProp'
        msgWp.appendChild(eSub)
      }

      const noteEl = document.createElement('div')
      noteEl.className = `hdd-addData-popup-note`
      noteEl.innerHTML = LNG.addDirDataSlowResponse
      msgWp.appendChild(noteEl)
    },
    onOk () {
      removeInvalidKeys(sParams)
      apiRequest({
        uri: `/file/scan`,
        sendData: {...sParams},
        method: 'POST',
        onData (data) {
          if (data && data.countFound) {
            try {
              popBox({
                onRenderMsg ({msgWp}) {
                  renderAddingDataResult({msgWp, ...data})
                }
              })
            }
            catch (err) {
              console.error(`err::::::::::`, err)
            }
          }
        }
      })
    }
  })

}

function handleDirs ({dirs, driveData, parentNode}) {
  const hasDir = Array.isArray(dirs) && dirs.length > 0

  if (hasDir) {
    const pItem = document.createElement('div')
    pItem.className = 'hdd-dirs'
    parentNode.appendChild(pItem)
    for (const [index, dir] of dirs.entries()) {
      const dirItem = document.createElement('div')
      dirItem.className = 'hdd-dir-item'

      const contentWp = document.createElement('div')
      contentWp.className = 'hdd-dir-item-contentWp'

      const expand = document.createElement('span')
      expand.className = 'hdd-dir-item-exp'
      expand.innerHTML = '+'

      const name = document.createElement('div')
      name.className = 'hdd-dir-item-name'
      name.innerHTML = dir.file

      pItem.appendChild(dirItem)
      dirItem.appendChild(contentWp)
      contentWp.appendChild(expand)
      contentWp.appendChild(name)
      name.dataset.filepath = dir.filepath

      name.addEventListener('click', () => {
        const tUp = {el: name, path: dir.filepath}
        if (driveData) {
          Object.assign(tUp, {driveLabel: driveData.driveLabel})
        }

        const ePressed = document.querySelector('.hdd-dir-item-name.item-pressed')
        if (ePressed) {
          removeClass(ePressed, 'item-pressed')
        }
        addClass(name, 'item-pressed')
        upSelection(tUp)
        if (hasClass(name, 'remove')) {
          handleToast({msg: LNG.noMoreFolderInThisDir, showToast: true})
        }
      })

      expand.addEventListener('click', () => {
        if (hasClass(expand, 'expanded')) {
          const eP = findAncestor(expand, 'hdd-dir-item')
          let sign = ''
          if (hasClass(eP, 'hide')) {
            removeClass(eP, 'hide')
            sign = '-'
          }
          else {
            addClass(eP, 'hide')
            sign = '+'
          }
          expand.innerHTML = sign
          return console.debug('Already expanded')
        }
        expand.innerHTML = '-'
        addClass(expand, 'expanded')
        getDirs({
          parentNode: dirItem,
          dirpath: dir.filepath,
          onData ({data}) {
            if (data.noDir) {
              addClass(expand, 'visHidden')
              addClass(name, 'remove')
            }
            handleDirs({dirs: data && data.dirs, driveData, parentNode: dirItem})
          }
        })
      })
    }
  }
}

function renderAddingDataResult ({msgWp, countFound, countNewItems, dupItems}) {
  const renderT = ({labelVal, numVal, wpCls, extraEl, maxWpHeight}) => {
    const div = document.createElement('div')
    let wClass = 'addDataRes-wrapper'
    if (wpCls) {
      wClass += ` ${wpCls}`
    }
    div.className = wClass
    if (maxWpHeight) {
      div.style.maxHeight = maxWpHeight
    }

    const label = document.createElement('div')
    label.className = 'addDataRes-label'
    label.textContent = labelVal

    const num = document.createElement('span')
    num.className = 'addDataRes-num'
    num.textContent = numVal

    msgWp.appendChild(div)
    div.appendChild(label)
    label.appendChild(num)

    if (extraEl) {
      div.appendChild(extraEl)
    }
  }

  renderT({
    labelVal: LNG.totalNumOfIdentified,
    numVal: countFound,
    wpCls: 'addDataRes-found'
  })

  renderT({
    labelVal: LNG.newlyAdded,
    numVal: countNewItems || 0,
    wpCls: 'addDataRes-insert'
  })

  if (dupItems && dupItems.length) {
    const dList = document.createElement('div')
    dList.className = 'addDataRes-dupList'

    for (const fItem of dupItems) {
      const eDup = document.createElement('div')
      eDup.className = 'addDataRes-dupItem'

      const pA = document.createElement('div')
      pA.className = 'addDataRes-dupItem-a'
      pA.textContent = `${LNG.filename}: ${fItem.name}, ${LNG.filepath}: ${fItem.filepath}`
      eDup.appendChild(pA)
      if (fItem.oItem) {
        const pB = document.createElement('div')
        pB.className = 'addDataRes-dupItem-b'
        pB.textContent = `${LNG.filename}: ${fItem.oItem.name}, ${LNG.filepath}: ${fItem.oItem.filepath}`
        eDup.appendChild(pB)
      }

      dList.appendChild(eDup)
    }
    renderT({
      labelVal: LNG.foundPotentialDup,
      numVal: dupItems.length,
      wpCls: 'addDataRes-dup',
      extraEl: dList,
      maxWpHeight: document.body.clientHeight * 0.67
    })
  }
}
