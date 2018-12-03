const Canjs = require('./src')

// new Canjs(`
//   const word = 'Hello world, Canjs!'
//   console.log(word)
// `).run()

new Canjs(`
for (var i = 0; i < 5; i++) {
  var a = i
}
console.log(a)
`).run()
