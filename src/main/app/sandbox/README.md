# JavaScript 沙盒环境模块 (Sandbox)

安全的 JavaScript 代码执行环境，支持隔离执行、资源限制和执行监控。

## 功能特性

### 核心功能
- **安全隔离**: 使用 Node.js `vm` 模块隔离执行环境
- **超时控制**: 防止无限循环和长时间运行
- **内存限制**: 限制沙盒可用内存
- **控制台捕获**: 捕获 console 输出
- **同步/异步执行**: 支持两种执行模式
- **Worker 线程**: 异步模式使用独立线程，真正隔离

### 管理功能
- **多沙盒管理**: 创建和管理多个独立沙盒
- **执行历史**: 记录所有执行历史
- **统计分析**: 提供执行统计和成功率
- **预设配置**: 内置严格、标准、宽松三种预设
- **批量执行**: 支持批量执行多段代码

## 使用示例

### 基础使用

```javascript
import Sandbox from './sandbox.js'

// 创建沙盒实例
const sandbox = new Sandbox({
  timeout: 5000,           // 5 秒超时
  memoryLimit: 50 * 1024 * 1024,  // 50MB 内存限制
  enableConsole: true      // 启用 console
})

// 同步执行
const result = sandbox.executeSync(`
  const sum = (a, b) => a + b
  console.log('计算中...')
  sum(1, 2)
`)

console.log(result)
// {
//   success: true,
//   result: 3,
//   logs: [{ type: 'log', args: ['计算中...'] }],
//   errors: []
// }

// 异步执行（使用 Worker）
const asyncResult = await sandbox.executeAsync(`
  let total = 0
  for (let i = 0; i < 1000000; i++) {
    total += i
  }
  total
`)

// 验证语法
const validation = sandbox.validateSyntax('const x = 1')
console.log(validation.valid) // true

// 执行函数
const fnResult = sandbox.executeFunction(
  function multiply(a, b) {
    return a * b
  },
  [3, 4]
)
console.log(fnResult.result) // 12
```

### 使用沙盒管理器

```javascript
import SandboxManager from './sandbox-manager.js'

const manager = new SandboxManager()

// 使用预设创建沙盒
manager.createSandboxWithPreset('strict-box', 'strict')
manager.createSandboxWithPreset('standard-box', 'standard')
manager.createSandboxWithPreset('relaxed-box', 'relaxed')

// 执行代码
const result = await manager.execute(`
  const data = [1, 2, 3, 4, 5]
  data.reduce((sum, n) => sum + n, 0)
`, {
  sandboxId: 'standard-box',
  context: { customVar: 'hello' },
  async: true
})

// 批量执行
const codes = [
  'const a = 1',
  'const b = 2',
  'a + b'
]
const results = await manager.execute(codes[2], {
  sandboxId: 'standard-box'
})

// 获取统计信息
const stats = manager.getSandboxStats('standard-box')
console.log(stats)
// {
//   id: 'standard-box',
//   executionCount: 10,
//   successCount: 9,
//   failureCount: 1,
//   successRate: 90
// }

// 获取执行历史
const history = manager.getHistory({
  sandboxId: 'standard-box',
  limit: 10
})

// 列出所有沙盒
const sandboxes = manager.listSandboxes()
```

### 在渲染进程中使用

```javascript
// 执行代码
const result = await window.api.sandbox.execute({
  code: `
    const fibonacci = (n) => {
      if (n <= 1) return n
      return fibonacci(n - 1) + fibonacci(n - 2)
    }
    fibonacci(10)
  `,
  options: {
    sandboxId: 'my-sandbox',
    timeout: 3000,
    enableConsole: true,
    async: false
  }
})

if (result.success) {
  console.log('结果:', result.data.result)
  console.log('日志:', result.data.logs)
} else {
  console.error('错误:', result.data.error)
}

// 验证语法
const validation = await window.api.sandbox.validate({
  code: 'const x = 1'
})

// 创建沙盒（使用预设）
await window.api.sandbox.create({
  id: 'my-strict-box',
  preset: 'strict'
})

// 创建沙盒（自定义配置）
await window.api.sandbox.create({
  id: 'my-custom-box',
  config: {
    timeout: 10000,
    memoryLimit: 100 * 1024 * 1024,
    enableConsole: true
  }
})

// 获取统计
const stats = await window.api.sandbox.stats({ id: 'my-sandbox' })

// 获取历史
const history = await window.api.sandbox.history({
  sandboxId: 'my-sandbox',
  limit: 20
})

// 批量执行
const batchResult = await window.api.sandbox.executeBatch({
  codes: ['const a = 1', 'const b = 2', 'a + b'],
  options: {
    sandboxId: 'my-sandbox',
    stopOnError: true
  }
})
```

## API 接口

### Sandbox 类

#### `constructor(config)`
创建沙盒实例
- `timeout`: 超时时间（毫秒）
- `memoryLimit`: 内存限制（字节）
- `enableConsole`: 是否启用 console

#### `executeSync(code, context)`
同步执行代码
- 返回: `{ success, result, logs, errors }`

#### `executeAsync(code, context)`
异步执行代码（使用 Worker）
- 返回: `Promise<{ success, result, logs, errors, executionTime }>`

#### `execute(code, options)`
自动选择执行模式
- `options.context`: 上下文对象
- `options.async`: 是否异步执行

#### `validateSyntax(code)`
验证代码语法
- 返回: `{ valid, error? }`

#### `executeFunction(fn, args, context)`
执行函数

#### `executeBatch(codes, options)`
批量执行代码

### SandboxManager 类

#### `createSandbox(id, config)`
创建沙盒

#### `createSandboxWithPreset(id, preset)`
使用预设创建沙盒
- 预设: `'strict'` | `'standard'` | `'relaxed'`

#### `getSandbox(id)`
获取沙盒实例

#### `deleteSandbox(id)`
删除沙盒

#### `execute(code, options)`
执行代码

#### `listSandboxes()`
列出所有沙盒

#### `getSandboxStats(id)`
获取统计信息

#### `getHistory(options)`
获取执行历史

#### `clearHistory()`
清空历史

### IPC 接口

- `sandbox:execute` - 执行代码
- `sandbox:validate` - 验证语法
- `sandbox:create` - 创建沙盒
- `sandbox:delete` - 删除沙盒
- `sandbox:list` - 列出沙盒
- `sandbox:stats` - 获取统计
- `sandbox:history` - 获取历史
- `sandbox:clearHistory` - 清空历史
- `sandbox:executeBatch` - 批量执行
- `sandbox:presets` - 获取预设列表

## 预设配置

### strict (严格模式)
- 超时: 3 秒
- 内存: 10MB
- Console: 禁用
- 适用: 不信任的代码

### standard (标准模式)
- 超时: 5 秒
- 内存: 50MB
- Console: 启用
- 适用: 一般用途

### relaxed (宽松模式)
- 超时: 10 秒
- 内存: 100MB
- Console: 启用
- 适用: 复杂计算

## 安全限制

沙盒会禁用以下危险功能：
- `require()` - 禁止加载模块
- `process` - 禁止访问进程
- `setTimeout/setInterval` - 禁止定时器
- `Buffer` - 禁止 Buffer 操作
- `global` - 禁止访问全局对象
- 文件系统访问
- 网络访问

## 执行结果格式

```javascript
{
  success: true,           // 是否成功
  result: any,             // 返回值
  logs: [                  // console.log 输出
    { type: 'log', args: [...] },
    { type: 'warn', args: [...] }
  ],
  errors: [                // console.error 输出
    { type: 'error', args: [...] }
  ],
  executionTime: 123       // 执行时间（毫秒）
}
```

## 错误处理

```javascript
{
  success: false,
  error: {
    message: '错误信息',
    stack: '堆栈跟踪',
    name: 'Error'
  },
  logs: [],
  errors: []
}
```

## 注意事项

1. **超时**: 超时后代码会被强制终止
2. **内存**: 超过内存限制会抛出错误
3. **异步代码**: 沙盒内不支持 Promise、async/await
4. **模块加载**: 默认禁止 require，需要通过 context 传入
5. **Worker 开销**: 异步模式有线程创建开销，适合长时间运行的代码
6. **上下文隔离**: 每次执行都是独立的，不共享状态

## 使用场景

- 用户提交的代码执行
- 插件系统
- 公式计算器
- 脚本引擎
- 代码教学平台
- 自动化测试
