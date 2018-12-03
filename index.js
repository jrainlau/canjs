const Canjs = require('./src')

try {
  window.Canjs = Canjs
} catch (e) {}

try {
  global.Canjs = Canjs
} catch (e) {}
