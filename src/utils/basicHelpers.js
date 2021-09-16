function removeInvalidKeys (params) {
  const keys = Object.keys(params)

  for (const key of keys) {
    const kVal = params[key]
    const invalid = typeof kVal === 'undefined' || kVal === null
    invalid && delete params[key]
  }
}

function cloneObj (obj) {return JSON.parse(JSON.stringify(obj))}
function chunk(p) {
  const {list, chunkSize} = p;
  const arr = [];
  if (chunkSize) {
    for (let i = 0; i < list.length; i += chunkSize) {
      arr.push(list.slice(i, i + chunkSize));
    }
  }
  return arr;
}
function byteLength (str) {
  let s = str.length
  for (let i = str.length - 1; i >= 0; i--) {
    const code = str.charCodeAt(i)
    if (code > 0x7f && code <= 0x7ff) {
      s++
    }
    else if (code > 0x7ff && code <= 0xffff) {
      s += 2
    }
    if (code >= 0xDC00 && code <= 0xDFFF) {
      i--
    }
  }
  return s
}

function objToUrlParams (obj) {
  const keys = Object.keys(obj)
  const urlParams = keys.reduce((str, key) => {
    const val = obj[key]
    if (val) {
      str += `${str ? '&' : ''}${key}=${val}`
    }
    return str
  }, '')
  return urlParams
}
function validJson (str) {
  try {
    JSON.parse(str)
  }
  catch (e) {
    return false
  }
  return true
}
function isObject (obj) {
  const type = typeof obj
  return type === 'object' && !!obj && !Array.isArray(obj) && typeof obj !== 'function'
}
function fileSize (bytes, options) {

  var units = 'BKMGTPEZY'.split('')
  function equals (a, b) { return a && a.toLowerCase() === b.toLowerCase() }

  bytes = typeof bytes == 'number' ? bytes : 0
  options = options || {}
  options.fixed = typeof options.fixed == 'number' ? options.fixed : 2
  options.spacer = typeof options.spacer == 'string' ? options.spacer : ' '

  options.calculate = function (spec) {

    var type = equals(spec, 'si') ? ['k', 'B'] : ['K', 'iB']
    var algorithm = equals(spec, 'si') ? 1e3 : 1024
    var magnitude = Math.log(bytes) / Math.log(algorithm)|0
    var result = (bytes / Math.pow(algorithm, magnitude))
    var fixed = result.toFixed(options.fixed)
    var suffix

    if (magnitude-1 < 3 && !equals(spec, 'si') && equals(spec, 'jedec'))
      type[1] = 'B'

    suffix = magnitude
      ? (type[0] + 'MGTPEZY')[magnitude-1] + type[1]
      : ((fixed|0) === 1 ? 'Byte' : 'Bytes')

    return {
      suffix: suffix,
      magnitude: magnitude,
      result: result,
      fixed: fixed,
      bits: { result: result/8, fixed: (result/8).toFixed(options.fixed) }
    }
  }

  options.to = function (unit, spec) {
    var algorithm = equals(spec, 'si') ? 1e3 : 1024
    var position = units.indexOf(typeof unit == 'string' ? unit[0].toUpperCase() : 'B')
    var result = bytes

    if (position === -1 || position === 0) return result.toFixed(2)
    for (; position > 0; position--) result /= algorithm
    return result.toFixed(2)
  }

  options.human = function (spec) {
    var output = options.calculate(spec)
    return output.fixed + options.spacer + output.suffix
  }

  return options;
}
function chunk (p) {
  const {list, chunkSize} = p
  const arr = []
  if (chunkSize) {
    for (let i = 0; i < list.length; i += chunkSize) {
      arr.push(list.slice(i, i + chunkSize))
    }
  }
  return arr
}
function cleanFileName (fName) {
  let nNames = []
  try {
    const method = require('./cleanFileName')
    if (typeof method === 'function') {
      nNames = method(fName)
    }
  }
  catch (err) {
    console.error(`ERROR:::::::::`, err)
  }
  return nNames
}
function getValue (obj, route) {
  if (!obj) return false
  if (!Array.isArray(route) || !route.length) return false

  let returnValue = ''

  route.forEach((item) => {
    if (isObject(obj) && obj.hasOwnProperty(item)) {
      obj = obj[item]
      returnValue = obj
    }
    else {
      obj = false
      returnValue = ''
    }

  })

  return returnValue

}

module.exports = {
  removeInvalidKeys, cloneObj, byteLength, objToUrlParams, chunk,
  validJson, fileSize, chunk, cleanFileName, getValue, isObject
}
