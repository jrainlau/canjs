const Signal = require('../signal')
const { MemberValue } = require('../value')

const NodeHandler = {
  Program (evaluator) {
    for (const node of evaluator.node.body) {
      evaluator.evaluate(node)
    }
  },
  VariableDeclaration (evaluator) {
    const kind = evaluator.node.kind
    for (const declaration of evaluator.node.declarations) {
      const { name } = declaration.id
      const value = declaration.init ? evaluator.evaluate(declaration.init) : undefined
      // 在作用域当中定义变量
      evaluator.scope.declare(name, value, kind)
    }
  },
  Identifier (evaluator) {
    if (evaluator.node.name === 'undefined') {
      return undefined
    }
    return evaluator.scope.get(evaluator.node.name).value
  },
  Literal (evaluator) {
    return evaluator.node.value
  },

  ExpressionStatement (evaluator) {
    return evaluator.evaluate(evaluator.node.expression)
  },
  CallExpression (evaluator) {
    const func = evaluator.evaluate(evaluator.node.callee)
    const args = evaluator.node.arguments.map(arg => evaluator.evaluate(arg))

    let value
    if (evaluator.node.callee.type === 'MemberExpression') {
      value = evaluator.evaluate(evaluator.node.callee.object)
    }
    return func.apply(value, args)
  },
  MemberExpression (evaluator) {
    const obj = evaluator.evaluate(evaluator.node.object)
    const name = evaluator.node.property.name
    return obj[name]
  },
  ObjectExpression (evaluator) {
    const obj = {}
    for (const prop of evaluator.node.properties) {
      let key
      if (prop.key.type === 'Literal') {
        key = `${prop.key.value}`
      } else if (prop.key.type === 'Identifier') {
        key = prop.key.name
      } else {
        throw new Error(`canjs: [ObjectExpression] Unsupported property key type "${prop.key.type}"`)
      }
      obj[key] = evaluator.evaluate(prop.value)
    }
    return obj
  },
  ArrayExpression (evaluator) {
    return evaluator.node.elements.map(ele => evaluator.evaluate(ele))
  },

  BlockStatement (evaluator) {
    let scope
    /**
     * 判断是否需要继承父级作用域
     * 若不需要，则单独新建一个块级作用域
     * 若需要，则继承之，于是便可以在当前作用域直接获取父级作用域的变量
     */
    if (!evaluator.scope.inheritParentScope) {
      scope = evaluator.createScope('block')
    } else {
      scope = evaluator.scope
      scope.inheritParentScope = false
    }

    // 处理块级节点内的每一个节点
    for (const node of evaluator.node.body) {
      if (node.type === 'VariableDeclaration' && node.kind === 'var') {
        for (const declaration of node.declarations) {
          scope.varDeclare(declaration.id.name)
        }
      } else if (node.type === 'FunctionDeclaration') {
        evaluator.evaluate(node, { scope })
      }
    }

    // 提取关键字（return, break, continue）
    for (const node of evaluator.node.body) {
      if (node.type === 'FunctionDeclaration') {
        continue
      }
      const signal = evaluator.evaluate(node, { scope })
      if (Signal.isSignal(signal)) {
        return signal
      }
    }
  },
  FunctionDeclaration (evaluator) {
    const fn = NodeHandler.FunctionExpression(evaluator)
    evaluator.scope.varDeclare(evaluator.node.id.name, fn)
    return fn    
  },
  FunctionExpression (evaluator) {
    const node = evaluator.node
    /**
     * 定义函数需要先为其定义一个函数作用域，且允许继承腹肌作用域
     * 注册`this`, `arguments`和形参到作用域的变量空间
     * 检查return关键字
     * 定义函数名和长度
     */
    const fn = function () {
      const scope = evaluator.createScope('function', true)
      scope.constDeclare('this', this)
      scope.constDeclare('arguments', arguments)

      node.params.forEach((param, index) => {
        const name = param.name
        scope.varDeclare(name, arguments[index])
      })

      const signal = evaluator.evaluate(node.body, { scope })
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
  ThisExpression (evaluator) {
    const value = evaluator.scope.get('this')
    return value ? value.value : null
  },
  NewExpression (evaluator) {
    const func = evaluator.evaluate(evaluator.node.callee)
    const args = evaluator.node.arguments.map(arg => evaluator.evaluate(arg))
    return new (func.bind(null, ...args))
  },

  UpdateExpression (evaluator) {
    let { value } = evaluator.scope.get(evaluator.node.argument.name)
    if (evaluator.node.operator === '++') {
      evaluator.node.prefix ? ++value : value++
    } else {
      evaluator.node.prefix ? --value : value--
    }
    evaluator.scope.set(evaluator.node.argument.name, value)
    return value
  },
  AssignmentExpressionOperatorEvaluateMap: {
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
  AssignmentExpression (evaluator) {
    const node = evaluator.node
    const value = getIdentifierOrMemberExpressionValue(node.left, evaluator)
    return NodeHandler.AssignmentExpressionOperatorEvaluateMap[node.operator](value, evaluator.evaluate(node.right))
  },
  UnaryExpressionOperatorEvaluateMap: {
    '-': (evaluator) => -evaluator.evaluate(evaluator.node.argument),
    '+': (evaluator) => +evaluator.evaluate(evaluator.node.argument),
    '!': (evaluator) => !evaluator.evaluate(evaluator.node.argument),
    '~': (evaluator) => ~evaluator.evaluate(evaluator.node.argument),
    'typeof': (evaluator) => {
      if (evaluator.node.argument.type === 'Identifier') {
        try {
          const value = evaluator.scope.get(evaluator.node.argument.name)
          return value ? typeof value.value : 'undefined'
        } catch (err) {
          if (err.message === `${evaluator.node.argument.name} is not defined`) {
            return 'undefined'
          } else {
            throw err
          }
        }
      } else {
        return typeof evaluator.evaluate(evaluator.node.argument)
      }
    },
    'void': (evaluator) => void evaluator.evaluate(evaluator.node.argument),
    'delete': (evaluator) => {
      const argument = evaluator.node.argument
      if (argument.type === 'MemberExpression') {
        const obj = evaluator.evaluate(argument.object)
        const name = getPropertyName(argument, evaluator)
        return delete obj[name]
      } else if (argument.type === 'Identifier') {
        return false
      } else if (argument.type === 'Literal') {
        return true
      }
    }
  },
  UnaryExpression (evaluator) {
    return NodeHandler.UnaryExpressionOperatorEvaluateMap[evaluator.node.operator](evaluator)
  },
  BinaryExpressionOperatorEvaluateMap: {
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
  BinaryExpression (evaluator) {
    const a = evaluator.evaluate(evaluator.node.left)
    const b = evaluator.evaluate(evaluator.node.right)
    return NodeHandler.BinaryExpressionOperatorEvaluateMap[evaluator.node.operator](a, b)
  },
  LogicalExpressionOperatorEvaluateMap: {
    '||': (a, b) => a || b,
    '&&': (a, b) => a && b
  },
  LogicalExpression (evaluator) {
    const a = evaluator.evaluate(evaluator.node.left)
    const b = evaluator.evaluate(evaluator.node.right)
    return NodeHandler.LogicalExpressionOperatorEvaluateMap[evaluator.node.operator](a, b)
  },

  ForStatement (evaluator) {
    const node = evaluator.node
    let scope = evaluator.scope
    if (node.init && node.init.type === 'VariableDeclaration' && node.init.kind !== 'var') {
      scope = evaluator.createScope('block')
    }

    for (
      node.init && evaluator.evaluate(node.init, { scope });
      node.test ? evaluator.evaluate(node.test, { scope }) : true;
      node.update && evaluator.evaluate(node.update, { scope })
    ) {
      const signal = evaluator.evaluate(node.body, { scope })
      
      if (Signal.isBreak(signal)) {
        break
      } else if (Signal.isContinue(signal)) {
        continue
      } else if (Signal.isReturn(signal)) {
        return signal
      }
    }
  },
  ForInStatement (evaluator) {
    const { left, right, body } = evaluator.node
    let scope = evaluator.scope

    let value
    if (left.type === 'VariableDeclaration') {
      const id = left.declarations[0].id
      value = scope.declare(id.name, undefined, left.kind)
    } else if (left.type === 'Identifier') {
      value = scope.get(left.name, true)
    } else {
      throw new Error(`canjs: [ForInStatement] Unsupported left type "${left.type}"`)
    }

    for (const key in evaluator.evaluate(right)) {
      value.value = key
      const signal = evaluator.evaluate(body, { scope })

      if (Signal.isBreak(signal)) {
        break
      } else if (Signal.isContinue(signal)) {
        continue
      } else if (Signal.isReturn(signal)) {
        return signal
      }
    }
  },
  WhileStatement (evaluator) {
    while (evaluator.evaluate(evaluator.node.test)) {
      const signal = evaluator.evaluate(evaluator.node.body)
      
      if (Signal.isBreak(signal)) {
        break
      } else if (Signal.isContinue(signal)) {
        continue
      } else if (Signal.isReturn(signal)) {
        return signal
      }
    }
  },
  DoWhileStatement (evaluator) {
    do {
      const signal = evaluator.evaluate(evaluator.node.body)
      
      if (Signal.isBreak(signal)) {
        break
      } else if (Signal.isContinue(signal)) {
        continue
      } else if (Signal.isReturn(signal)) {
        return signal
      }
    } while (evaluator.evaluate(evaluator.node.test))
  },

  ReturnStatement (evaluator) {
    let value
    if (evaluator.node.argument) {
      value = evaluator.evaluate(evaluator.node.argument)
    }
    return Signal.Return(value)
  },
  BreakStatement (evaluator) {
    let label
    if (evaluator.node.label) {
      label = evaluator.node.label.name
    }
    return Signal.Break(label)
  },
  ContinueStatement (evaluator) {
    let label
    if (evaluator.node.label) {
      label = evaluator.node.label.name
    }
    return Signal.Continue(label)
  },

  IfStatement (evaluator) {
    if (evaluator.evaluate(evaluator.node.test)) {
      return evaluator.evaluate(evaluator.node.consequent)
    } else if (evaluator.node.alternate) {
      return evaluator.evaluate(evaluator.node.alternate)
    }
  },
  SwitchStatement (evaluator) {
    const discriminant = evaluator.evaluate(evaluator.node.discriminant)
    
    for (const theCase of evaluator.node.cases) {
      if (!theCase.test || discriminant === evaluator.evaluate(theCase.test)) {
        const signal = evaluator.evaluate(theCase)

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
  SwitchCase (evaluator) {
    for (const node of evaluator.node.consequent) {
      const signal = evaluator.evaluate(node)
      if (Signal.isSignal(signal)) {
        return signal
      }
    }
  },
  ConditionalExpression (evaluator) {
    return evaluator.evaluate(evaluator.node.test)
      ? evaluator.evaluate(evaluator.node.consequent)
      : evaluator.evaluate(evaluator.node.alternate)
  },

  ThrowStatement(evaluator) {
    throw evaluator.evaluate(evaluator.node.argument)
  },
  TryStatement(evaluator) {
    const { block, handler, finalizer } = evaluator.node
    try {
      return evaluator.evaluate(block)
    } catch (err) {
      if (handler) {
        const param = handler.param
        const scope = evaluator.createScope('block', true)
        scope.letDeclare(param.name, err)
        return evaluator.evaluate(handler, { scope })
      }
      throw err
    } finally {
      if (finalizer) {
        return evaluator.evaluate(finalizer)
      }
    }
  },
  CatchClause(evaluator) {
    return evaluator.evaluate(evaluator.node.body);
  }
}

function getPropertyName (node, evaluator) {
  if (node.computed) {
    return evaluator.evaluate(node.property)
  } else {
    return node.property.name
  }
}

function getIdentifierOrMemberExpressionValue(node, evaluator) {
  if (node.type === 'Identifier') {
    return evaluator.scope.get(node.name)
  } else if (node.type === 'MemberExpression') {
    const obj = evaluator.evaluate(node.object)
    const name = getPropertyName(node, evaluator)
    return new MemberValue(obj, name)
  } else {
    throw new Error(`canjs: Not support to get value of node type "${node.type}"`)
  }
}

module.exports = NodeHandler
