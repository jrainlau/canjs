/**
 * @author: JrainLau
 * @desc: es5标准库，提供es5所支持的内置对象/方法
 */

const { SimpleValue } = require('./value')

let windowObj = null
let globalObj = null

try {
  windowObj = window
} catch (e) {}

try {
  globalObj = global
} catch (e) {}

const standardMap = {
  // Function properties
  isFinite: new SimpleValue(isFinite),
  isNaN: new SimpleValue(isNaN),
  parseFloat: new SimpleValue(parseFloat),
  parseInt: new SimpleValue(parseInt),
  decodeURI: new SimpleValue(decodeURI),
  decodeURIComponent: new SimpleValue(decodeURIComponent),
  encodeURI: new SimpleValue(encodeURI),
  encodeURIComponent: new SimpleValue(encodeURIComponent),

  // Fundamental objects
  Object: new SimpleValue(Object),
  Function: new SimpleValue(Function),
  Boolean: new SimpleValue(Boolean),
  Symbol: new SimpleValue(Symbol),
  Error: new SimpleValue(Error),
  EvalError: new SimpleValue(EvalError),
  RangeError: new SimpleValue(RangeError),
  ReferenceError: new SimpleValue(ReferenceError),
  SyntaxError: new SimpleValue(SyntaxError),
  TypeError: new SimpleValue(TypeError),
  URIError: new SimpleValue(URIError),

  // Numbers and dates
  Number: new SimpleValue(Number),
  Math: new SimpleValue(Math),
  Date: new SimpleValue(Date),

  // Text processing
  String: new SimpleValue(String),
  RegExp: new SimpleValue(RegExp),

  // Indexed collections
  Array: new SimpleValue(Array),
  Int8Array: new SimpleValue(Int8Array),
  Uint8Array: new SimpleValue(Uint8Array),
  Uint8ClampedArray: new SimpleValue(Uint8ClampedArray),
  Int16Array: new SimpleValue(Int16Array),
  Uint16Array: new SimpleValue(Uint16Array),
  Int32Array: new SimpleValue(Int32Array),
  Uint32Array: new SimpleValue(Uint32Array),
  Float32Array: new SimpleValue(Float32Array),
  Float64Array: new SimpleValue(Float64Array),

  // Structured data
  ArrayBuffer: new SimpleValue(ArrayBuffer),
  DataView: new SimpleValue(DataView),
  JSON: new SimpleValue(JSON),
  
  // // Other
  window: new SimpleValue(windowObj),
  global: new SimpleValue(globalObj),
  console: new SimpleValue(console),
  setTimeout: new SimpleValue(setTimeout),
  clearTimeout: new SimpleValue(clearTimeout),
  setInterval: new SimpleValue(setInterval),
  clearInterval: new SimpleValue(clearInterval)
}

module.exports = standardMap
