/**
 * @author Jrainlau
 * @desc 节点处理器，处理AST当中的节点
 */

const Signal = require('../signal')
const { MemberValue } = require('../value')

const NodeHandler = {
  Program (nodeIterator) {
    for (const node of nodeIterator.node.body) {
      nodeIterator.traverse(node)
    }
  },
  VariableDeclaration (nodeIterator) {
    const kind = nodeIterator.node.kind
    for (const declaration of nodeIterator.node.declarations) {
      const { name } = declaration.id
      const value = declaration.init ? nodeIterator.traverse(declaration.init) : undefined
      // 在作用域当中定义变量
      nodeIterator.scope.declare(name, value, kind)
    }
  },
  Identifier (nodeIterator) {
    if (nodeIterator.node.name === 'undefined') {
      return undefined
    }
    return nodeIterator.scope.get(nodeIterator.node.name).value
  },
  Literal (nodeIterator) {
    return nodeIterator.node.value
  },

  ExpressionStatement (nodeIterator) {
    return nodeIterator.traverse(nodeIterator.node.expression)
  },
  CallExpression (nodeIterator) {
    const func = nodeIterator.traverse(nodeIterator.node.callee)
    const args = nodeIterator.node.arguments.map(arg => nodeIterator.traverse(arg))

    let value
    if (nodeIterator.node.callee.type === 'MemberExpression') {
      value = nodeIterator.traverse(nodeIterator.node.callee.object)
    }
    return func.apply(value, args)
  },
  MemberExpression (nodeIterator) {
    const obj = nodeIterator.traverse(nodeIterator.node.object)
    const name = nodeIterator.node.property.name
    return obj[name]
  },
  ObjectExpression (nodeIterator) {
    const obj = {}
    for (const prop of nodeIterator.node.properties) {
      let key
      if (prop.key.type === 'Literal') {
        key = `${prop.key.value}`
      } else if (prop.key.type === 'Identifier') {
        key = prop.key.name
      } else {
        throw new Error(`canjs: [ObjectExpression] Unsupported property key type "${prop.key.type}"`)
      }
      obj[key] = nodeIterator.traverse(prop.value)
    }
    return obj
  },
  ArrayExpression (nodeIterator) {
    return nodeIterator.node.elements.map(ele => nodeIterator.traverse(ele))
  },

  BlockStatement (nodeIterator) {
    let scope
    /**
     * 判断是否需要继承父级作用域
     * 若不需要，则单独新建一个块级作用域
     * 若需要，则继承之，于是便可以在当前作用域直接获取父级作用域的变量
     */
    if (!nodeIterator.scope.inheritParentScope) {
      scope = nodeIterator.createScope('block')
    } else {
      scope = nodeIterator.scope
      scope.inheritParentScope = false
    }

    // 处理块级节点内的每一个节点
    for (const node of nodeIterator.node.body) {
      if (node.type === 'VariableDeclaration' && node.kind === 'var') {
        for (const declaration of node.declarations) {
          scope.varDeclare(declaration.id.name)
        }
      } else if (node.type === 'FunctionDeclaration') {
        nodeIterator.traverse(node, { scope })
      }
    }

    // 提取关键字（return, break, continue）
    for (const node of nodeIterator.node.body) {
      if (node.type === 'FunctionDeclaration') {
        continue
      }
      const signal = nodeIterator.traverse(node, { scope })
      if (Signal.isSignal(signal)) {
        return signal
      }
    }
  },
  FunctionDeclaration (nodeIterator) {
    const fn = NodeHandler.FunctionExpression(nodeIterator)
    nodeIterator.scope.varDeclare(nodeIterator.node.id.name, fn)
    return fn    
  },
  FunctionExpression (nodeIterator) {
    const node = nodeIterator.node
    /**
     * 定义函数需要先为其定义一个函数作用域，且允许继承腹肌作用域
     * 注册`this`, `arguments`和形参到作用域的变量空间
     * 检查return关键字
     * 定义函数名和长度
     */
    const fn = function () {
      const scope = nodeIterator.createScope('function', true)
      scope.constDeclare('this', this)
      scope.constDeclare('arguments', arguments)

      node.params.forEach((param, index) => {
        const name = param.name
        scope.varDeclare(name, arguments[index])
      })

      const signal = nodeIterator.traverse(node.body, { scope })
      if (Signal.isReturn(signal)) {
        return signal.value
      }
    }

    Object.defineProperties(fn, {
      name: { value: node.id ? node.id.name : '' },
      length: { value: node.params.length }
    })

    return fn
  },
  ThisExpression (nodeIterator) {
    const value = nodeIterator.scope.get('this')
    return value ? value.value : null
  },
  NewExpression (nodeIterator) {
    const func = nodeIterator.traverse(nodeIterator.node.callee)
    const args = nodeIterator.node.arguments.map(arg => nodeIterator.traverse(arg))
    return new (func.bind(null, ...args))
  },

  UpdateExpression (nodeIterator) {
    let { value } = nodeIterator.scope.get(nodeIterator.node.argument.name)
    if (nodeIterator.node.operator === '++') {
      nodeIterator.node.prefix ? ++value : value++
    } else {
      nodeIterator.node.prefix ? --value : value--
    }
    nodeIterator.scope.set(nodeIterator.node.argument.name, value)
    return value
  },
  AssignmentExpressionOperatortraverseMap: {
    '=': (memberValue, value) => memberValue.obj[memberValue.name] = value,
    '+=': (memberValue, value) => memberValue.obj[memberValue.name] += value,
    '-=': (memberValue, value) => memberValue.obj[memberValue.name] -= value,
    '*=': (memberValue, value) => memberValue.obj[memberValue.name] *= value,
    '/=': (memberValue, value) => memberValue.obj[memberValue.name] /= value,
    '%=': (memberValue, value) => memberValue.obj[memberValue.name] %= value,
    '**=': () => { throw new Error('canjs: es5 doen\'t supports operator "**=') },
    '<<=': (memberValue, value) => memberValue.obj[memberValue.name] <<= value,
    '>>=': (memberValue, value) => memberValue.obj[memberValue.name] >>= value,
    '>>>=': (memberValue, value) => memberValue.obj[memberValue.name] >>>= value,
    '|=': (memberValue, value) => memberValue.obj[memberValue.name] |= value,
    '^=': (memberValue, value) => memberValue.obj[memberValue.name] ^= value,
    '&=': (memberValue, value) => memberValue.obj[memberValue.name] &= value
  },
  AssignmentExpression (nodeIterator) {
    const node = nodeIterator.node
    const value = getIdentifierOrMemberExpressionValue(node.left, nodeIterator)
    return NodeHandler.AssignmentExpressionOperatortraverseMap[node.operator](value, nodeIterator.traverse(node.right))
  },
  UnaryExpressionOperatortraverseMap: {
    '-': (nodeIterator) => -nodeIterator.traverse(nodeIterator.node.argument),
    '+': (nodeIterator) => +nodeIterator.traverse(nodeIterator.node.argument),
    '!': (nodeIterator) => !nodeIterator.traverse(nodeIterator.node.argument),
    '~': (nodeIterator) => ~nodeIterator.traverse(nodeIterator.node.argument),
    'typeof': (nodeIterator) => {
      if (nodeIterator.node.argument.type === 'Identifier') {
        try {
          const value = nodeIterator.scope.get(nodeIterator.node.argument.name)
          return value ? typeof value.value : 'undefined'
        } catch (err) {
          if (err.message === `${nodeIterator.node.argument.name} is not defined`) {
            return 'undefined'
          } else {
            throw err
          }
        }
      } else {
        return typeof nodeIterator.traverse(nodeIterator.node.argument)
      }
    },
    'void': (nodeIterator) => void nodeIterator.traverse(nodeIterator.node.argument),
    'delete': (nodeIterator) => {
      const argument = nodeIterator.node.argument
      if (argument.type === 'MemberExpression') {
        const obj = nodeIterator.traverse(argument.object)
        const name = getPropertyName(argument, nodeIterator)
        return delete obj[name]
      } else if (argument.type === 'Identifier') {
        return false
      } else if (argument.type === 'Literal') {
        return true
      }
    }
  },
  UnaryExpression (nodeIterator) {
    return NodeHandler.UnaryExpressionOperatortraverseMap[nodeIterator.node.operator](nodeIterator)
  },
  BinaryExpressionOperatortraverseMap: {
    '==': (a, b) => a == b,
    '!=': (a, b) => a != b,
    '===': (a, b) => a === b,
    '!==': (a, b) => a !== b,
    '<': (a, b) => a < b,
    '<=': (a, b) => a <= b,
    '>': (a, b) => a > b,
    '>=': (a, b) => a >= b,
    '<<': (a, b) => a << b,
    '>>': (a, b) => a >> b,
    '>>>': (a, b) => a >>> b,
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => a / b,
    '%': (a, b) => a % b,
    '**': (a, b) => { throw new Error('canjs: es5 doesn\'t supports operator "**"') },
    '|': (a, b) => a | b,
    '^': (a, b) => a ^ b,
    '&': (a, b) => a & b,
    'in': (a, b) => a in b,
    'instanceof': (a, b) => a instanceof b
  },
  BinaryExpression (nodeIterator) {
    const a = nodeIterator.traverse(nodeIterator.node.left)
    const b = nodeIterator.traverse(nodeIterator.node.right)
    return NodeHandler.BinaryExpressionOperatortraverseMap[nodeIterator.node.operator](a, b)
  },
  LogicalExpressionOperatortraverseMap: {
    '||': (a, b) => a || b,
    '&&': (a, b) => a && b
  },
  LogicalExpression (nodeIterator) {
    const a = nodeIterator.traverse(nodeIterator.node.left)
    const b = nodeIterator.traverse(nodeIterator.node.right)
    return NodeHandler.LogicalExpressionOperatortraverseMap[nodeIterator.node.operator](a, b)
  },

  ForStatement (nodeIterator) {
    const node = nodeIterator.node
    let scope = nodeIterator.scope
    if (node.init && node.init.type === 'VariableDeclaration' && node.init.kind !== 'var') {
      scope = nodeIterator.createScope('block')
    }

    for (
      node.init && nodeIterator.traverse(node.init, { scope });
      node.test ? nodeIterator.traverse(node.test, { scope }) : true;
      node.update && nodeIterator.traverse(node.update, { scope })
    ) {
      const signal = nodeIterator.traverse(node.body, { scope })
      
      if (Signal.isBreak(signal)) {
        break
      } else if (Signal.isContinue(signal)) {
        continue
      } else if (Signal.isReturn(signal)) {
        return signal
      }
    }
  },
  ForInStatement (nodeIterator) {
    const { left, right, body } = nodeIterator.node
    let scope = nodeIterator.scope

    let value
    if (left.type === 'VariableDeclaration') {
      const id = left.declarations[0].id
      value = scope.declare(id.name, undefined, left.kind)
    } else if (left.type === 'Identifier') {
      value = scope.get(left.name, true)
    } else {
      throw new Error(`canjs: [ForInStatement] Unsupported left type "${left.type}"`)
    }

    for (const key in nodeIterator.traverse(right)) {
      value.value = key
      const signal = nodeIterator.traverse(body, { scope })

      if (Signal.isBreak(signal)) {
        break
      } else if (Signal.isContinue(signal)) {
        continue
      } else if (Signal.isReturn(signal)) {
        return signal
      }
    }
  },
  WhileStatement (nodeIterator) {
    while (nodeIterator.traverse(nodeIterator.node.test)) {
      const signal = nodeIterator.traverse(nodeIterator.node.body)
      
      if (Signal.isBreak(signal)) {
        break
      } else if (Signal.isContinue(signal)) {
        continue
      } else if (Signal.isReturn(signal)) {
        return signal
      }
    }
  },
  DoWhileStatement (nodeIterator) {
    do {
      const signal = nodeIterator.traverse(nodeIterator.node.body)
      
      if (Signal.isBreak(signal)) {
        break
      } else if (Signal.isContinue(signal)) {
        continue
      } else if (Signal.isReturn(signal)) {
        return signal
      }
    } while (nodeIterator.traverse(nodeIterator.node.test))
  },

  ReturnStatement (nodeIterator) {
    let value
    if (nodeIterator.node.argument) {
      value = nodeIterator.traverse(nodeIterator.node.argument)
    }
    return Signal.Return(value)
  },
  BreakStatement (nodeIterator) {
    let label
    if (nodeIterator.node.label) {
      label = nodeIterator.node.label.name
    }
    return Signal.Break(label)
  },
  ContinueStatement (nodeIterator) {
    let label
    if (nodeIterator.node.label) {
      label = nodeIterator.node.label.name
    }
    return Signal.Continue(label)
  },

  IfStatement (nodeIterator) {
    if (nodeIterator.traverse(nodeIterator.node.test)) {
      return nodeIterator.traverse(nodeIterator.node.consequent)
    } else if (nodeIterator.node.alternate) {
      return nodeIterator.traverse(nodeIterator.node.alternate)
    }
  },
  SwitchStatement (nodeIterator) {
    const discriminant = nodeIterator.traverse(nodeIterator.node.discriminant)
    
    for (const theCase of nodeIterator.node.cases) {
      if (!theCase.test || discriminant === nodeIterator.traverse(theCase.test)) {
        const signal = nodeIterator.traverse(theCase)

        if (Signal.isBreak(signal)) {
          break
        } else if (Signal.isContinue(signal)) {
          continue
        } else if (Signal.isReturn(signal)) {
          return signal
        }
      }
    }
  },
  SwitchCase (nodeIterator) {
    for (const node of nodeIterator.node.consequent) {
      const signal = nodeIterator.traverse(node)
      if (Signal.isSignal(signal)) {
        return signal
      }
    }
  },
  ConditionalExpression (nodeIterator) {
    return nodeIterator.traverse(nodeIterator.node.test)
      ? nodeIterator.traverse(nodeIterator.node.consequent)
      : nodeIterator.traverse(nodeIterator.node.alternate)
  },

  ThrowStatement(nodeIterator) {
    throw nodeIterator.traverse(nodeIterator.node.argument)
  },
  TryStatement(nodeIterator) {
    const { block, handler, finalizer } = nodeIterator.node
    try {
      return nodeIterator.traverse(block)
    } catch (err) {
      if (handler) {
        const param = handler.param
        const scope = nodeIterator.createScope('block', true)
        scope.letDeclare(param.name, err)
        return nodeIterator.traverse(handler, { scope })
      }
      throw err
    } finally {
      if (finalizer) {
        return nodeIterator.traverse(finalizer)
      }
    }
  },
  CatchClause(nodeIterator) {
    return nodeIterator.traverse(nodeIterator.node.body);
  }
}

function getPropertyName (node, nodeIterator) {
  if (node.computed) {
    return nodeIterator.traverse(node.property)
  } else {
    return node.property.name
  }
}

function getIdentifierOrMemberExpressionValue(node, nodeIterator) {
  if (node.type === 'Identifier') {
    return nodeIterator.scope.get(node.name)
  } else if (node.type === 'MemberExpression') {
    const obj = nodeIterator.traverse(node.object)
    const name = getPropertyName(node, nodeIterator)
    return new MemberValue(obj, name)
  } else {
    throw new Error(`canjs: Not support to get value of node type "${node.type}"`)
  }
}

module.exports = NodeHandler
