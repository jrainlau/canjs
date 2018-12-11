# CanJS

`CanJS` is a javascript interpreter, which can run JS code in JS.

Relate article: [《
前端与编译原理——用JS写一个JS解释器》](http://sfau.lt/b5bkvoY)

## Install

``` sh
git clone https://github.com/jrainlau/canjs.git
```

## Usage
It's fine to run the JS code in string directly.

```javascript
const Canjs = require('./dist/index.js')

new Canjs(`
  console.log('Hello World!')
`).run()
```

`CanJS` uses ES5 standard library, but you can also provide custom variables to it:

```javascript
const Canjs = require('./dist/index.js')

const wx = {
  name: 'wx'
}

new Canjs(`
  console.log(wx.name)
`, { wx }).run()
```

## License
MIT