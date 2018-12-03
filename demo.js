const Canjs = require('./src')

new Canjs(`
  const word = 'Hello world, Canjs!'
  console.log(word)
`).run()

new Canjs(`
  function Hello () {
    console.log('Hello world, Canjs!')
  }
  Hello()
`).run()

new Canjs(`
let x = 1
{
  let y = 2
  console.log(y)
}
console.log(1)
`).run()
