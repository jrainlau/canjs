const Canjs = require('./src')

try {
  global.Canjs = Canjs
} catch (e) {}

try {
  window.Canjs = Canjs
} catch (e) {}
