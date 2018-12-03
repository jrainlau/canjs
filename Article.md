说起编译原理，印象往往只停留在本科时那些枯燥的课程和晦涩的概念。作为前端开发者，编译原理似乎离我们很远，对它的理解很可能仅仅局限于“抽象语法树（AST）”。但这仅仅是个开头而已。编译原理的使用，甚至能让我们利用JS直接写一个能运行JS代码的解释器。

> 项目地址：https://github.com/jrainlau/canjs
> 
> 在线体验：https://codepen.io/jrainlau/pen/YRgQXo

## 为什么要用JS写JS的解释器
接触过小程序开发的同学应该知道，小程序运行的环境禁止`new Function`，`eval`等方法的使用，导致我们无法直接执行字符串形式的动态代码。此外，许多平台也对这些JS自带的可执行动态代码的方法进行了限制，那么我们是没有任何办法了吗？既然如此，我们便可以用JS写一个解析器，让JS自己去运行自己。

在开始之前，我们先简单回顾一下编译原理的一些概念。

## 什么是编译器
说到编译原理，肯定离不开编译器。简单来说，当一段代码经过编译器的词法分析、语法分析等阶段之后，会生成一个树状结构的“抽象语法树（AST）”，该语法树的每一个节点都对应着代码当中不同含义的片段。

比如有这么一段代码：
```javascript
const a = 1
console.log(a)
```
经过编译器处理后，它的AST长这样：
```
{
  "type": "Program",
  "start": 0,
  "end": 26,
  "body": [
    {
      "type": "VariableDeclaration",
      "start": 0,
      "end": 11,
      "declarations": [
        {
          "type": "VariableDeclarator",
          "start": 6,
          "end": 11,
          "id": {
            "type": "Identifier",
            "start": 6,
            "end": 7,
            "name": "a"
          },
          "init": {
            "type": "Literal",
            "start": 10,
            "end": 11,
            "value": 1,
            "raw": "1"
          }
        }
      ],
      "kind": "const"
    },
    {
      "type": "ExpressionStatement",
      "start": 12,
      "end": 26,
      "expression": {
        "type": "CallExpression",
        "start": 12,
        "end": 26,
        "callee": {
          "type": "MemberExpression",
          "start": 12,
          "end": 23,
          "object": {
            "type": "Identifier",
            "start": 12,
            "end": 19,
            "name": "console"
          },
          "property": {
            "type": "Identifier",
            "start": 20,
            "end": 23,
            "name": "log"
          },
          "computed": false
        },
        "arguments": [
          {
            "type": "Identifier",
            "start": 24,
            "end": 25,
            "name": "a"
          }
        ]
      }
    }
  ],
  "sourceType": "module"
}
```
> 常见的JS编译器有`babylon`，`acorn`等等，感兴趣的同学可以在[AST explorer][1]这个网站自行体验。

可以看到，编译出来的AST详细记录了代码中所有语义代码的类型、起始位置等信息。这段代码除了根节点`Program`外，主体包含了两个节点`VariableDeclaration`和`ExpressionStatement`，而这些节点里面又包含了不同的子节点。

正是由于AST详细记录了代码的语义化信息，所以Babel，Webpack，Sass，Less等工具可以针对代码进行非常智能的处理。

## 什么是解释器
如同翻译人员不仅能看懂一门外语，也能对其艺术加工后把它翻译成母语一样，人们把能够将代码转化成AST的工具叫做“编译器”，而把能够将AST翻译成目标语言并运行的工具叫做“解释器”。

在编译原理的课程中，我们思考过这么一个问题：如何让计算机运行算数表达式`1+2+3`:
```
1 + 2 + 3
```
当机器执行的时候，它可能会是这样的机器码：
```
1 PUSH 1
2 PUSH 2
3 ADD
4 PUSH 3
5 ADD
```
而运行这段机器码的程序，就是解释器。

在这篇文章中，我们不会搞出机器码这样复杂的东西，仅仅是使用JS在其runtime环境下去解释JS代码的AST。由于解释器使用JS编写，所以我们可以大胆使用JS自身的语言特性，比如this绑定、new关键字等等，完全不需要对它们进行额外处理，也因此让JS解释器的实现变得非常简单。

在回顾了编译原理的基本概念之后，我们就可以着手进行开发了。

## 节点遍历器
通过分析上文的AST，可以看到每一个节点都会有一个类型属性`type`，不同类型的节点需要不同的处理方式，处理这些节点的程序，就是“节点处理器（`nodeHandler`）”

定义一个节点处理器：
```javascript
const nodeHandler = {
  Program () {},
  VariableDeclaration () {},
  ExpressionStatement () {},
  MemberExpression () {},
  CallExpression () {},
  Identifier () {}
}
```
关于节点处理器的具体实现，会在后文进行详细探讨，这里暂时不作展开。

有了节点处理器，我们便需要去遍历AST当中的每一个节点，递归地调用节点处理器，直到完成对整棵语法书的处理。

定义一个节点遍历器（`NodeIterator`）：
```javascript
class NodeIterator {
  constructor (node) {
    this.node = node
    this.nodeHandler = nodeHandler
  }

  traverse (node) {
    // 根据节点类型找到节点处理器当中对应的函数
    const _eval = this.nodeHandler[node.type]
    // 若找不到则报错
    if (!_eval) {
      throw new Error(`canjs: Unknown node type "${node.type}".`)
    }
    // 运行处理函数
    return _eval(node)
  }

}
```

理论上，节点遍历器这样设计就可以了，但仔细推敲，发现漏了一个很重要的东西——作用域处理。

回到节点处理器的`VariableDeclaration()`方法，它用来处理诸如`const a = 1`这样的变量声明节点。假设它的代码如下：
```javascript
  VariableDeclaration (node) {
    for (const declaration of node.declarations) {
      const { name } = declaration.id
      const value = declaration.init ? traverse(declaration.init) : undefined
      // 问题来了，拿到了变量的名称和值，然后把它保存到哪里去呢？
      // ...
    }
  },
```
问题在于，处理完变量声明节点以后，理应把这个变量保存起来。按照JS语言特性，这个变量应该存放在一个作用域当中。在JS解析器的实现过程中，这个作用域可以被定义为一个`scope`对象。

改写节点遍历器，为其新增一个`scope`对象
```javascript
class NodeIterator {
  constructor (node, scope = {}) {
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

  createScope (blockType = 'block') {
    return new Scope(blockType, this.scope)
  }
}
```
然后节点处理函数`VariableDeclaration()`就可以通过`scope`保存变量了：
```javascript
  VariableDeclaration (nodeIterator) {
    const kind = nodeIterator.node.kind
    for (const declaration of nodeIterator.node.declarations) {
      const { name } = declaration.id
      const value = declaration.init ? nodeIterator.traverse(declaration.init) : undefined
      // 在作用域当中定义变量
      // 如果当前是块级作用域且变量用var定义，则定义到父级作用域
      if (nodeIterator.scope.type === 'block' && kind === 'var') {
        nodeIterator.scope.parentScope.declare(name, value, kind)
      } else {
        nodeIterator.scope.declare(name, value, kind)
      }
    }
  },
```

关于作用域的处理，可以说是整个JS解释器最难的部分。接下来我们将对作用域处理进行深入的剖析。

## 作用域处理
考虑到这样一种情况：
```javascript
const a = 1
{
  const b = 2
  console.log(a)
}
console.log(b)
```
运行结果必然是能够打印出`a`的值，然后报错：`Uncaught ReferenceError: b is not defined`

这段代码就是涉及到了作用域的问题。块级作用域或者函数作用域可以读取其父级作用域当中的变量，反之则不行，所以对于作用域我们不能简单地定义一个空对象，而是要专门进行处理。

定义一个作用域基类`Scope`：
```javascript
class Scope {
  constructor (type, parentScope) {
    // 作用域类型，区分函数作用域function和块级作用域block
    this.type = type
    // 父级作用域
    this.parentScope = parentScope
    // 全局作用域
    this.globalDeclaration = standardMap
    // 当前作用域的变量空间
    this.declaration = Object.create(null)
  }

  /*
   * get/set方法用于获取/设置当前作用域中对应name的变量值
     符合JS语法规则，优先从当前作用域去找，若找不到则到父级作用域去找，然后到全局作用域找。
     如果都没有，就报错
   */
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
      this.declaration[name] = value
    } else if (this.parentScope[name]) {
      this.parentScope.set(name, value)
    } else {
      throw new ReferenceError(`${name} is not defined`)
    }
  }

  /**
   * 根据变量的kind调用不同的变量定义方法
   */
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
```

这里使用了一个叫做`simpleValue()`的函数来定义变量值，主要用于处理常量：
```javascript
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
```
处理作用域问题思路，关键的地方就是在于JS语言本身寻找变量的特性——优先当前作用域，父作用域次之，全局作用域最后。反过来，在节点处理函数`VariableDeclaration()`里，如果遇到块级作用域且关键字为`var`，则需要把这个变量也定义到父级作用域当中，这也就是我们常说的“全局变量污染”。

### JS标准库注入
细心的读者会发现，在定义`Scope`基类的时候，其全局作用域`globalScope`被赋值了一个`standardMap`对象，这个对象就是JS标准库。

简单来说，JS标准库就是JS这门语言本身所带有的一系列方法和属性，如常用的`setTimeout`，`console.log`等等。为了让解析器也能够执行这些方法，所以我们需要为其注入标准库：
```javascript
const standardMap = {
  console: new SimpleValue(console)
}
```
这样就相当于往解析器的全局作用域当中注入了`console`这个对象，也就可以直接被使用了。

## 节点处理器
在处理完节点遍历器、作用域处理的工作之后，便可以来编写节点处理器了。顾名思义，节点处理器是专门用来处理AST节点的，上文反复提及的`VariableDeclaration()`方法便是其中一个。下面将对部分关键的节点处理器进行讲解。

在开发节点处理器之前，需要用到一个工具，用于判断JS语句当中的`return`，`break`，`continue`关键字。

### 关键字判断工具`Signal`
定义一个`Signal`基类：
```javascript
class Signal {
  constructor (type, value) {
    this.type = type
    this.value = value
  }

  static Return (value) {
    return new Signal('return', value)
  }

  static Break (label = null) {
    return new Signal('break', label)
  }

  static Continue (label) {
    return new Signal('continue', label)
  }

  static isReturn(signal) {
    return signal instanceof Signal && signal.type === 'return'
  }

  static isContinue(signal) {
    return signal instanceof Signal && signal.type === 'continue'
  }

  static isBreak(signal) {
    return signal instanceof Signal && signal.type === 'break'
  }

  static isSignal (signal) {
    return signal instanceof Signal
  }
}
```
有了它，就可以对语句当中的关键字进行判断处理，接下来会有大用处。

### 变量定义节点处理器——`VariableDeclaration()`
最常用的节点处理器之一，负责把变量注册到正确的作用域。
```javascript
  VariableDeclaration (nodeIterator) {
    const kind = nodeIterator.node.kind
    for (const declaration of nodeIterator.node.declarations) {
      const { name } = declaration.id
      const value = declaration.init ? nodeIterator.traverse(declaration.init) : undefined
      // 在作用域当中定义变量
      // 若为块级作用域且关键字为var，则需要做全局污染
      if (nodeIterator.scope.type === 'block' && kind === 'var') {
        nodeIterator.scope.parentScope.declare(name, value, kind)
      } else {
        nodeIterator.scope.declare(name, value, kind)
      }
    }
  },
```

### 标识符节点处理器——`Identifier()`
专门用于从作用域中获取标识符的值。
```javascript
  Identifier (nodeIterator) {
    if (nodeIterator.node.name === 'undefined') {
      return undefined
    }
    return nodeIterator.scope.get(nodeIterator.node.name).value
  },
```

### 字符节点处理器——`Literal()`
返回字符节点的值。
```javascript
  Literal (nodeIterator) {
    return nodeIterator.node.value
  }
```

### 表达式调用节点处理器——`CallExpression()`
用于处理表达式调用节点的处理器，如处理`func()`，`console.log()`等。
```javascript
  CallExpression (nodeIterator) {
    // 遍历callee获取函数体
    const func = nodeIterator.traverse(nodeIterator.node.callee)
    // 获取参数
    const args = nodeIterator.node.arguments.map(arg => nodeIterator.traverse(arg))

    let value
    if (nodeIterator.node.callee.type === 'MemberExpression') {
      value = nodeIterator.traverse(nodeIterator.node.callee.object)
    }
    // 返回函数运行结果
    return func.apply(value, args)
  },
```

### 表达式节点处理器——`MemberExpression()`
区分于上面的“表达式调用节点处理器”，表达式节点指的是`person.say`，`console.log`这种函数表达式。
```javascript
  MemberExpression (nodeIterator) {
    // 获取对象，如console
    const obj = nodeIterator.traverse(nodeIterator.node.object)
    // 获取对象的方法，如log
    const name = nodeIterator.node.property.name
    // 返回表达式，如console.log
    return obj[name]
  }
```

### 块级声明节点处理器——`BlockStatement()`
非常常用的处理器，专门用于处理块级声明节点，如函数、循环、`try...catch...`当中的情景。
```javascript
  BlockStatement (nodeIterator) {
    // 先定义一个块级作用域
    let scope = nodeIterator.createScope('block')

    // 处理块级节点内的每一个节点
    for (const node of nodeIterator.node.body) {
      if (node.type === 'VariableDeclaration' && node.kind === 'var') {
        for (const declaration of node.declarations) {
          scope.declare(declaration.id.name, declaration.init.value, node.kind)
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
  }
```

可以看到这个处理器里面有两个`for...of`循环。第一个用于处理块级内语句，第二个专门用于识别关键字，如循环体内部的`break`，`continue`或者函数体内部的`return`。

### 函数定义节点处理器——`FunctionDeclaration()`
往作用当中声明一个和函数名相同的变量，值为所定义的函数：
```javascript
  FunctionDeclaration (nodeIterator) {
    const fn = NodeHandler.FunctionExpression(nodeIterator)
    nodeIterator.scope.varDeclare(nodeIterator.node.id.name, fn)
    return fn    
  }
```

### 函数表达式节点处理器——`FunctionExpression()`
用于定义一个函数：
```javascript
  FunctionExpression (nodeIterator) {
    const node = nodeIterator.node
    /**
     * 1、定义函数需要先为其定义一个函数作用域，且允许继承父级作用域
     * 2、注册`this`, `arguments`和形参到作用域的变量空间
     * 3、检查return关键字
     * 4、定义函数名和长度
     */
    const fn = function () {
      const scope = nodeIterator.createScope('function')
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
  }
```

### this表达式处理器——`ThisExpression()`
该处理器直接使用JS语言自身的特性，把`this`关键字从作用域中取出即可。
```javascript
  ThisExpression (nodeIterator) {
    const value = nodeIterator.scope.get('this')
    return value ? value.value : null
  }
```

### new表达式处理器——`NewExpression()`
和`this`表达式类似，也是直接沿用JS的语言特性，获取函数和参数之后，通过`bind`关键字生成一个构造函数，并返回。
```javascript
  NewExpression (nodeIterator) {
    const func = nodeIterator.traverse(nodeIterator.node.callee)
    const args = nodeIterator.node.arguments.map(arg => nodeIterator.traverse(arg))
    return new (func.bind(null, ...args))
  }
```

### For循环节点处理器——`ForStatement()`
For循环的三个参数对应着节点的`init`，`test`，`update`属性，对着三个属性分别调用节点处理器处理，并放回JS原生的for循环当中即可。
```javascript
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
  }
```
同理，`for...in`，`while`和`do...while`循环也是类似的处理方式，这里不再赘述。

### If声明节点处理器——`IfStatemtnt()`
处理If语句，包括`if`，`if...else`，`if...elseif...else`。
```javascript
  IfStatement (nodeIterator) {
    if (nodeIterator.traverse(nodeIterator.node.test)) {
      return nodeIterator.traverse(nodeIterator.node.consequent)
    } else if (nodeIterator.node.alternate) {
      return nodeIterator.traverse(nodeIterator.node.alternate)
    }
  }
```
同理，`switch`语句、三目表达式也是类似的处理方式。

---

上面列出了几个比较重要的节点处理器，在es5当中还有很多节点需要处理，详细内容可以访问[这个地址](https://github.com/jrainlau/canjs/blob/master/src/es_versions/es5.js)一探究竟。

## 定义调用方式
经过了上面的所有步骤，解析器已经具备处理es5代码的能力，接下来就是对这些散装的内容进行组装，最终定义一个方便用户调用的办法。

```javascript
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
    // 定义全局作用域，该作用域类型为函数作用域
    const globalScope = new Scope('function')
    // 根据入参定义标准库之外的全局变量
    Object.keys(this.extraDeclaration).forEach((key) => {
      globalScope.addDeclaration(key, this.extraDeclaration[key])
    })
    this.nodeIterator = new NodeIterator(null, globalScope)
  }

  run () {
    return this.nodeIterator.traverse(this.ast)
  }
}
```
这里我们定义了一个名为`Canjs`的基类，接受字符串形式的JS代码，同时可定义标准库之外的变量。当运行`run()`方法的时候就可以得到运行结果。

## 后续
至此，整个JS解析器已经完成，可以很好地运行ES5的代码（可能还有bug没有发现）。但是在当前的实现中，所有的运行结果都是放在一个类似沙盒的地方，无法对外界产生影响。如果要把运行结果取出来，可能的办法有两种。第一种是传入一个全局的变量，把影响作用在这个全局变量当中，借助它把结果带出来；另外一种则是让解析器支持`export`语法，能够把`export`语句声明的结果返回，感兴趣的读者可以自行研究。

最后，这个JS解析器已经在我的Github上开源，欢迎前来交流~

https://github.com/jrainlau/canjs

## 参考资料
[从零开始写一个Javascript解析器](https://juejin.im/post/5aa25be1518825557b4c5720#heading-11)

[jkeylu/evil-eval](https://github.com/jkeylu/evil-eval)







  [1]: https://astexplorer.net