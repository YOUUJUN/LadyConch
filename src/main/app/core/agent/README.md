# Agent 模块

基于 `@mariozechner/pi-agent-core` 实现的智能 Agent 系统，支持工具调用和 Skills 集成。

## 功能特性

- **多模型支持**: 支持 Anthropic Claude、OpenAI、Ollama 等多种模型
- **工具系统**: 内置文件操作、命令执行等工具，支持自定义工具
- **Skills 集成**: 与项目 Skills 系统无缝集成
- **事件流**: 完整的事件流支持，实时获取 Agent 状态
- **对话管理**: 自动管理对话历史和上下文
- **流式输出**: 支持流式响应，提升用户体验

## 快速开始

### 基础使用

```javascript
import AgentManager from './agent.js'

// 创建 agent 实例
const agent = new AgentManager({
  provider: 'anthropic',
  modelId: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY,
  systemPrompt: 'You are a helpful assistant.',
})

// 初始化
await agent.initialize()

// 订阅事件以获取流式输出
agent.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta)
  }
})

// 发送消息
await agent.prompt('Hello! How can you help me?')
```

### 使用 Ollama 本地模型

```javascript
const agent = new AgentManager({
  provider: 'ollama',
  modelId: 'qwen2.5:7b',
  baseUrl: 'http://localhost:11434/v1',
  systemPrompt: 'You are a helpful assistant.',
})

await agent.initialize()
await agent.prompt('Hello!')
```

## 配置选项

```javascript
const config = {
  // 模型配置
  provider: 'anthropic',           // 'anthropic' | 'openai' | 'ollama'
  modelId: 'claude-sonnet-4-20250514',
  apiKey: 'your-api-key',
  baseUrl: 'https://api.anthropic.com', // 可选，自定义 API 端点

  // Agent 配置
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7,
  maxTokens: 4096,
  thinking: { enabled: false },    // 启用思考模式

  // 工具配置
  maxToolCalls: 10,                // 最大工具调用次数
  skillsDir: './skills',           // Skills 目录路径
}
```

## 内置工具

Agent 默认提供以下工具：

### 1. read_file
读取文件内容

```javascript
{
  name: 'read_file',
  parameters: {
    path: 'file/path.txt'
  }
}
```

### 2. write_file
写入文件内容

```javascript
{
  name: 'write_file',
  parameters: {
    path: 'file/path.txt',
    content: 'file content'
  }
}
```

### 3. bash
执行 bash 命令

```javascript
{
  name: 'bash',
  parameters: {
    command: 'ls -la'
  }
}
```

### 4. execute_skill
执行已加载的 Skill

```javascript
{
  name: 'execute_skill',
  parameters: {
    skillName: 'skill-creator',
    context: { /* 上下文数据 */ }
  }
}
```

### 5. list_skills
列出所有可用的 Skills

```javascript
{
  name: 'list_skills',
  parameters: {}
}
```

## 自定义工具

### 添加工具

```javascript
agent.addTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city and country, e.g. "London, UK"'
      }
    },
    required: ['location']
  },
  execute: async (args) => {
    // 实现工具逻辑
    const weather = await fetchWeather(args.location)
    return {
      location: args.location,
      temperature: weather.temp,
      condition: weather.condition
    }
  }
})
```

### 工具执行限制

为防止无限循环，Agent 会限制工具调用次数（默认 10 次）。可通过 `maxToolCalls` 配置：

```javascript
const agent = new AgentManager({
  maxToolCalls: 20,  // 增加到 20 次
})
```

## 事件系统

Agent 使用事件流来通知状态变化。

### 事件类型

```javascript
agent.subscribe((event) => {
  switch (event.type) {
    case 'agent_start':
      // Agent 开始处理
      break

    case 'turn_start':
      // 新的对话轮次开始
      break

    case 'message_start':
      // 消息开始（用户或助手）
      console.log('Message role:', event.message.role)
      break

    case 'message_update':
      // 消息更新（流式输出）
      if (event.assistantMessageEvent?.type === 'text_delta') {
        // 文本增量
        process.stdout.write(event.assistantMessageEvent.delta)
      } else if (event.assistantMessageEvent?.type === 'tool_call_delta') {
        // 工具调用
        console.log('Tool:', event.assistantMessageEvent.toolCall.name)
      }
      break

    case 'message_end':
      // 消息结束
      break

    case 'turn_end':
      // 对话轮次结束
      console.log('Tool results:', event.toolResults)
      break

    case 'agent_end':
      // Agent 处理完成
      console.log('Total messages:', event.messages.length)
      break
  }
})
```

### 取消订阅

```javascript
const unsubscribe = agent.subscribe(handler)

// 取消订阅
unsubscribe()
```

## Skills 集成

Agent 自动加载 Skills 目录中的所有 Skills，并提供工具来执行它们。

### 列出可用 Skills

```javascript
await agent.prompt('What skills are available? Use the list_skills tool.')
```

### 执行 Skill

```javascript
await agent.prompt('Execute the skill-creator skill to help me create a new skill.')
```

### Skills 目录结构

```
skills/
├── skill-name/
│   ├── SKILL.md          # Skill 定义
│   ├── scripts/          # 可执行脚本
│   ├── references/       # 引用文档
│   └── assets/           # 资源文件
```

## API 参考

### AgentManager

#### 构造函数

```javascript
new AgentManager(config)
```

#### 方法

##### initialize()
初始化 Agent，加载 Skills 和工具

```javascript
await agent.initialize()
```

##### prompt(message)
发送消息给 Agent

```javascript
const response = await agent.prompt('Hello!')
```

##### addTool(tool)
添加自定义工具

```javascript
agent.addTool({
  name: 'tool_name',
  description: 'Tool description',
  parameters: { /* JSON Schema */ },
  execute: async (args) => { /* 实现 */ }
})
```

##### subscribe(handler)
订阅事件

```javascript
const unsubscribe = agent.subscribe((event) => {
  console.log(event.type)
})
```

##### getMessages()
获取对话历史

```javascript
const messages = agent.getMessages()
```

##### reset()
重置对话

```javascript
agent.reset()
```

##### updateSystemPrompt(prompt)
更新系统提示词

```javascript
agent.updateSystemPrompt('You are a coding expert.')
```

##### getState()
获取当前状态

```javascript
const state = agent.getState()
console.log(state.messages, state.systemPrompt)
```

##### stop()
停止当前运行

```javascript
agent.stop()
```

## 示例

查看 `example.js` 文件获取完整示例：

```bash
# 基础使用
node example.js basic

# 工具使用
node example.js tool

# Skills 使用
node example.js skill

# 事件流
node example.js event

# 多轮对话
node example.js conversation

# Ollama 本地模型
node example.js ollama
```

## 最佳实践

### 1. 错误处理

```javascript
try {
  await agent.prompt('Your message')
} catch (error) {
  if (error.message.includes('Maximum tool calls')) {
    console.error('Tool call limit exceeded')
  } else {
    console.error('Agent error:', error)
  }
}
```

### 2. 流式输出

始终订阅事件以获取流式输出，提升用户体验：

```javascript
agent.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta)
  }
})
```

### 3. 工具设计

- 工具描述要清晰，帮助模型理解何时使用
- 参数使用 JSON Schema 定义，确保类型安全
- 工具执行要快速，避免长时间阻塞
- 返回结构化数据，便于模型理解

### 4. 系统提示词

根据使用场景定制系统提示词：

```javascript
// 代码助手
systemPrompt: 'You are an expert coding assistant. Provide clear, concise code examples.'

// 数据分析
systemPrompt: 'You are a data analyst. Use tools to read and analyze data files.'

// 通用助手
systemPrompt: 'You are a helpful assistant. Use available tools when needed.'
```

## 故障排除

### 工具调用失败

检查工具的 `execute` 函数是否正确实现，并返回有效的 JSON 对象。

### Skills 未加载

确保 Skills 目录路径正确，且 SKILL.md 文件格式正确。

### 模型连接失败

- 检查 API Key 是否正确
- 检查网络连接
- 对于 Ollama，确保服务正在运行

### 超过工具调用限制

增加 `maxToolCalls` 配置，或优化工具设计减少调用次数。

## 相关文档

- [pi-agent-core 文档](../../../docs/@mariozechnerpi-agent-core.md)
- [pi-ai 文档](../../../docs/@mariozechnerpi-ai.md)
- [Skills 文档](../skills/README.md)

## License

MIT
