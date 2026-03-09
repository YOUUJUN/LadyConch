# Python 沙盒环境模块 (Python Sandbox)

安全的 Python 代码执行环境，支持隔离执行、资源限制和执行监控。

## 功能特性

### 核心功能
- **安全隔离**: 限制危险模块和函数的访问
- **超时控制**: 防止无限循环和长时间运行
- **输出捕获**: 捕获 stdout、stderr 和返回值
- **模块白名单**: 只允许导入指定的 Python 模块
- **语法验证**: 执行前验证代码语法
- **环境检测**: 检查 Python 解释器是否可用

### 管理功能
- **多沙盒管理**: 创建和管理多个独立沙盒
- **执行历史**: 记录所有执行历史
- **统计分析**: 提供执行统计和成功率
- **预设配置**: 内置严格、标准、数据科学、宽松四种预设
- **批量执行**: 支持批量执行多段代码
- **包管理**: 支持安装 Python 包

## 使用示例

### 基础使用

```javascript
import PythonSandbox from './python-sandbox.js'

// 创建沙盒实例
const sandbox = new PythonSandbox({
  timeout: 10000,          // 10 秒超时
  pythonPath: 'python',    // Python 解释器路径
  allowedModules: ['math', 'random', 'datetime']
})

// 执行 Python 代码
const result = await sandbox.execute(`
import math

def calculate_circle(radius):
    area = math.pi * radius ** 2
    circumference = 2 * math.pi * radius
    return {'area': area, 'circumference': circumference}

result = calculate_circle(5)
print(f"面积: {result['area']:.2f}")
print(f"周长: {result['circumference']:.2f}")

result
`)

console.log(result)
// {
//   success: true,
//   result: "{'area': 78.53981633974483, 'circumference': 31.41592653589793}",
//   stdout: "面积: 78.54\n周长: 31.42\n",
//   stderr: "",
//   executionTime: 123
// }

// 验证语法
const validation = await sandbox.validateSyntax('print("Hello")')
console.log(validation.valid) // true

// 检查 Python 环境
const check = await sandbox.checkPython()
console.log(check)
// {
//   available: true,
//   version: "Python 3.11.0",
//   path: "python"
// }
```

### 使用沙盒管理器

```javascript
import PythonSandboxManager from './python-sandbox-manager.js'

const manager = new PythonSandboxManager()

// 使用预设创建沙盒
manager.createSandboxWithPreset('strict-box', 'strict')
manager.createSandboxWithPreset('data-box', 'datascience')

// 执行代码
const result = await manager.execute(`
import random

numbers = [random.randint(1, 100) for _ in range(10)]
average = sum(numbers) / len(numbers)

print(f"数字: {numbers}")
print(f"平均值: {average:.2f}")

average
`, {
  sandboxId: 'strict-box',
  timeout: 5000
})

// 批量执行
const codes = [
  'x = 10',
  'y = 20',
  'x + y'
]
const results = await manager.executeBatch(codes, {
  sandboxId: 'strict-box'
})

// 执行文件
const fileResult = await manager.executeFile('./script.py', {
  sandboxId: 'data-box'
})

// 获取统计信息
const stats = manager.getSandboxStats('strict-box')
console.log(stats)
// {
//   id: 'strict-box',
//   executionCount: 15,
//   successCount: 14,
//   failureCount: 1,
//   successRate: 93.33
// }

// 检查 Python 环境
const pythonCheck = await manager.checkPython('python3')
console.log(pythonCheck)
```

### 在渲染进程中使用

```javascript
// 检查 Python 环境
const check = await window.api.python.check({ pythonPath: 'python' })
if (!check.data.available) {
  console.error('Python 不可用')
  return
}

// 执行 Python 代码
const result = await window.api.python.execute({
  code: `
import json
import datetime

data = {
    'timestamp': str(datetime.datetime.now()),
    'message': 'Hello from Python!',
    'numbers': [1, 2, 3, 4, 5]
}

print(json.dumps(data, indent=2))
data
  `,
  options: {
    sandboxId: 'my-sandbox',
    timeout: 5000,
    allowedModules: ['json', 'datetime']
  }
})

if (result.success && result.data.success) {
  console.log('结果:', result.data.result)
  console.log('输出:', result.data.stdout)
} else {
  console.error('错误:', result.data.error)
}

// 验证语法
const validation = await window.api.python.validate({
  code: 'print("Hello")'
})

// 创建沙盒（使用预设）
await window.api.python.create({
  id: 'data-science-box',
  preset: 'datascience'
})

// 创建沙盒（自定义配置）
await window.api.python.create({
  id: 'custom-box',
  config: {
    timeout: 15000,
    pythonPath: 'python3',
    allowedModules: ['math', 'random', 'json', 'numpy']
  }
})

// 获取统计
const stats = await window.api.python.stats({ id: 'my-sandbox' })

// 获取历史
const history = await window.api.python.history({
  sandboxId: 'my-sandbox',
  limit: 20
})

// 批量执行
const batchResult = await window.api.python.executeBatch({
  codes: [
    'import math',
    'radius = 5',
    'math.pi * radius ** 2'
  ],
  options: {
    sandboxId: 'my-sandbox',
    stopOnError: true
  }
})

// 执行 Python 文件
const fileResult = await window.api.python.executeFile({
  filePath: 'D:/scripts/analysis.py',
  options: {
    sandboxId: 'data-science-box'
  }
})

// 安装 Python 包
const installResult = await window.api.python.installPackage({
  packageName: 'requests',
  pythonPath: 'python'
})
```

## API 接口

### PythonSandbox 类

#### `constructor(config)`
创建沙盒实例
- `timeout`: 超时时间（毫秒）
- `pythonPath`: Python 解释器路径
- `allowedModules`: 允许导入的模块列表
- `maxOutputSize`: 最大输出大小（字节）
- `workDir`: 工作目录

#### `execute(code, options)`
执行 Python 代码
- 返回: `Promise<{ success, result, stdout, stderr, error, executionTime }>`

#### `validateSyntax(code)`
验证代码语法
- 返回: `Promise<{ valid, error? }>`

#### `checkPython()`
检查 Python 是否可用
- 返回: `Promise<{ available, version?, error? }>`

#### `installPackage(packageName)`
安装 Python 包
- 返回: `Promise<{ success, output }>`

### PythonSandboxManager 类

#### `createSandbox(id, config)`
创建沙盒

#### `createSandboxWithPreset(id, preset)`
使用预设创建沙盒
- 预设: `'strict'` | `'standard'` | `'datascience'` | `'relaxed'`

#### `getSandbox(id)`
获取沙盒实例

#### `deleteSandbox(id)`
删除沙盒

#### `execute(code, options)`
执行代码

#### `executeBatch(codes, options)`
批量执行代码

#### `executeFile(scriptPath, options)`
执行 Python 文件

#### `listSandboxes()`
列出所有沙盒

#### `getSandboxStats(id)`
获取统计信息

#### `getHistory(options)`
获取执行历史

#### `clearHistory()`
清空历史

#### `checkPython(pythonPath)`
检查 Python 环境

### IPC 接口

- `python:execute` - 执行代码
- `python:validate` - 验证语法
- `python:check` - 检查 Python 环境
- `python:create` - 创建沙盒
- `python:delete` - 删除沙盒
- `python:list` - 列出沙盒
- `python:stats` - 获取统计
- `python:history` - 获取历史
- `python:clearHistory` - 清空历史
- `python:executeBatch` - 批量执行
- `python:executeFile` - 执行文件
- `python:installPackage` - 安装包
- `python:presets` - 获取预设列表

## 预设配置

### strict (严格模式)
- 超时: 5 秒
- 允许模块: `math`, `random`
- 适用: 不信任的代码

### standard (标准模式)
- 超时: 10 秒
- 允许模块: `math`, `random`, `datetime`, `json`, `re`, `collections`
- 适用: 一般用途

### datascience (数据科学模式)
- 超时: 30 秒
- 允许模块: 标准模块 + `numpy`, `pandas`, `matplotlib`, `scipy`
- 适用: 数据分析和科学计算

### relaxed (宽松模式)
- 超时: 30 秒
- 允许模块: 标准模块 + `os`, `sys`, `time`, `itertools`, `functools`
- 适用: 复杂任务

## 安全限制

沙盒会禁用以下危险功能：
- `eval()` - 禁止动态执行代码
- `exec()` - 禁止动态执行代码
- `compile()` - 禁止编译代码
- `open()` - 禁止文件操作
- `__import__()` - 限制模块导入（仅允许白名单）

未在白名单中的模块无法导入，会抛出 `ImportError`。

## 执行结果格式

```javascript
{
  success: true,           // 是否成功
  result: "返回值",        // 最后一个表达式的值
  stdout: "标准输出",      // print() 输出
  stderr: "标准错误",      // 错误输出
  executionTime: 123       // 执行时间（毫秒）
}
```

## 错误处理

```javascript
{
  success: false,
  error: {
    type: 'ImportError',   // 错误类型
    message: '错误信息',
    traceback: '堆栈跟踪'
  },
  stdout: "",
  stderr: "",
  executionTime: 123
}
```

## 注意事项

1. **Python 环境**: 需要系统安装 Python 3.x
2. **路径配置**: 确保 Python 在系统 PATH 中，或指定完整路径
3. **超时**: 超时后进程会被强制终止
4. **模块限制**: 只能导入白名单中的模块
5. **文件操作**: 默认禁用文件操作，需要特殊配置
6. **临时文件**: 代码会写入临时文件执行，执行后自动清理
7. **输出大小**: 输出超过限制会被截断
8. **包安装**: 安装包需要 pip，且可能需要管理员权限

## 使用场景

- 用户提交的 Python 代码执行
- 数据分析和科学计算
- 算法验证和测试
- 教学和培训平台
- 自动化脚本执行
- 插件系统

## 示例代码

### 数据分析示例

```python
import json
import random

# 生成随机数据
data = [random.randint(1, 100) for _ in range(20)]

# 统计分析
stats = {
    'count': len(data),
    'sum': sum(data),
    'average': sum(data) / len(data),
    'min': min(data),
    'max': max(data)
}

print(json.dumps(stats, indent=2))
stats
```

### 算法示例

```python
def fibonacci(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b

# 计算前 10 个斐波那契数
result = [fibonacci(i) for i in range(10)]
print(f"斐波那契数列: {result}")
result
```

### JSON 处理示例

```python
import json

data = {
    'users': [
        {'name': 'Alice', 'age': 25},
        {'name': 'Bob', 'age': 30}
    ]
}

# 格式化输出
formatted = json.dumps(data, indent=2, ensure_ascii=False)
print(formatted)

# 返回数据
data
```
