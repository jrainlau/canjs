/**
 * @author Jrainlau
 * @desc Canjs类
 * 
 * @class
 * 
 * 传入字符串形式的es5代码，可选的新增全局变量
 * 运行`.run()`方法即可输出运行结果
 * 
 * eg: new Canjs('console.log("Hello World!")').run()
 */

const { Parser } = require('acorn')
const NodeIterator = require('./iterator')
const Scope = require('./scope')

class Canjs {
  constructor (code = '', extraDeclaration = {}) {
    this.code = code
    this.extraDeclaration = extraDeclaration
    this.ast = Parser.parse(code)
    this.nodeIterator = null
    this.init()
  }

  init () {
    const globalScope = new Scope('function')
    Object.keys(this.extraDeclaration).forEach((key) => {
      globalScope.addDeclaration(key, this.extraDeclaration[key])
    })
    this.nodeIterator = new NodeIterator(null, globalScope)
  }

  run () {
    return this.nodeIterator.traverse(this.ast)
  }
}

module.exports = Canjs
