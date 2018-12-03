/**
 * @author Jrainlau
 * @desc 管理作用域
 * 
 * @class
 * 
 * 每次对节点的处理，都要考虑其作用域的问题。Scope实例会定义该作用域为函数作用域（function）或者块级作用域（block）。
 * 每次新建Scope实例，都会为当前节点创建一个全新的“作用域变量空间”（declaration），任何在此作用域内定义的变量都会存放在这个空间当中
 * 此外，新建Scope实例也会保存其父级作用域。
 * “继承父级作用域”属性（inheritParentScope）默认关闭。若设置为true，可以实现如闭包访问外部变量的功能。
 */

const standardMap = require('./standard')
const { SimpleValue } = require('./value')

class Scope {
  constructor (type, parentScope) {
    this.type = type
    this.parentScope = parentScope
    this.globalDeclaration = standardMap
    this.declaration = Object.create(null) // 每次都新建一个全新的作用域
    this.inheritParentScope = false
  }

  addDeclaration (name, value) {
    this.globalDeclaration[name] = new SimpleValue(value)
  }

  get (name) {
    if (this.declaration[name]) {
      return this.declaration[name]
    } else if (this.parentScope) {
      return this.parentScope.get(name)
    } else if (this.globalDeclaration[name]) {
      return this.globalDeclaration[name]
    }
    throw new ReferenceError(`${name} is not defined`)
  }

  set (name, value) {
    if (this.declaration[name]) {
      this.declaration[name].set(value)
    } else if (this.parentScope) {
      this.parentScope.set(name, value)
    } else {
      throw new ReferenceError(`${name} is not defined`)
    }
  }

  declare (name, value, kind = 'var') {
    if (kind === 'var') {
      return this.varDeclare(name, value)
    } else if (kind === 'let') {
      return this.letDeclare(name, value)
    } else if (kind === 'const') {
      return this.constDeclare(name, value)
    } else {
      throw new Error(`canjs: Invalid Variable Declaration Kind of "${kind}"`)
    }
  }

  varDeclare (name, value) {
    let scope = this
    // 若当前作用域存在非函数类型的父级作用域时，就把变量定义到父级作用域
    while (scope.parentScope && scope.type !== 'function') {
      scope = scope.parentScope
    }
    this.declaration[name] = new SimpleValue(value, 'var')
    return this.declaration[name]
  }

  letDeclare (name, value) {
    // 不允许重复定义
    if (this.declaration[name]) {
      throw new SyntaxError(`Identifier ${name} has already been declared`)
    }
    this.declaration[name] = new SimpleValue(value, 'let')
    return this.declaration[name]
  }

  constDeclare (name, value) {
    // 不允许重复定义
    if (this.declaration[name]) {
      throw new SyntaxError(`Identifier ${name} has already been declared`)
    }
    this.declaration[name] = new SimpleValue(value, 'const')
    return this.declaration[name]
  }
}

module.exports = Scope
