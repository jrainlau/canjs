# CanJS

`CanJS` is a javascript interpreter, which can run JS code in JS.

## Usage
It's fine to run the JS code in string directly.
```javascript
const Canjs = require('Canjs')

new Canjs(`
  console.log('Hello World!')
`).run()
```

`CanJS` uses ES5 standard library, but you can also provide custom variable to it:
```javascript
const Canjs = require('Canjs')

const wx = {
  name: wx
}

new Canjs(`
  console.log(wx.name)
`, { wx }).run()
```

## License
MIT