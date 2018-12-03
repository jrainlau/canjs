/**
 * @author Jrainlau
 * @desc 和变量保存相关
 */

/**
 * 创建一个普通变量值
 * 
 * @class
 * @param any value 值
 * @param string kind 变量定义符（var, let, const）
 * @method set 设置值
 * @method get 获取值
 */
class SimpleValue {
  constructor (value, kind = '') {
    this.value = value
    this.kind = kind
  }

  set (value) {
    // 禁止重新对const类型变量赋值
    if (this.kind === 'const') {
      throw new TypeError('Assignment to constant variable')
    } else {
      this.value = value
    }
  }

  get () {
    return this.value
  }
}

/**
 * 创建一个类变量
 * 
 * @class
 * @param any obj 类
 * @param prop any 属性
 * @method set 设置类的属性的值
 * @method get 获取类的属性的值
 */
class MemberValue {
  constructor(obj, prop) {
    this.obj = obj
    this.prop = prop
  }

  set (value) {
    this.obj[this.prop] = value
  }

  get () {
    return this.obj[this.prop]
  }
}

module.exports.SimpleValue = SimpleValue
module.exports.MemberValue = MemberValue
