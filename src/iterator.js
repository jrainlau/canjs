/**
 * @author Jrainlau
 * @desc 节点遍历器，递归遍历AST内的每一个节点并调用对应的方法进行解析
 * 
 * @class
 * 
 * 针对AST节点进行解析，根据节点类型调用“节点处理器”（nodeHandler）对应的方法。
 * 在进行解析的时候，会传入节点和节点对应的作用域。
 * 
 * 另外也提供了创建作用域的方法（createScope），可用于创建函数作用域或者块级作用域。
 */

const nodeHandler = require('./es_versions')
const Scope = require('./scope')

class NodeIterator {
  constructor (node, scope) {
    this.node = node
    this.scope = scope
    this.nodeHandler = nodeHandler
  }

  traverse (node, options = {}) {
    const scope = options.scope || this.scope
    const nodeIterator = new NodeIterator(node, scope)
    const _eval = this.nodeHandler[node.type]
    if (!_eval) {
      throw new Error(`canjs: Unknown node type "${node.type}".`)
    }
    return _eval(nodeIterator)
  }

  createScope (blockType = 'block', inheritParentScope = false) {
    const scope = new Scope(blockType, this.scope)
    scope.inheritParentScope = inheritParentScope
    return scope
  }
}

module.exports = NodeIterator
