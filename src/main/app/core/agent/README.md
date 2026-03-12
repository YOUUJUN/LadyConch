# Agent Core Module - Skills to Tools 转换系统

本模块实现了类似 openclaw 的 skills-to-tools 转换机制，允许将 skill 文件自动转换为可被 Agent 调用的 tools。

## 架构概览

```
┌─────────────────┐
│  Skill Files    │  (SKILL.md 文件)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SkillRunner    │  (扫描和加载 skills)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SkillToTool     │  (转换 skills 为 tools)
│  Converter      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ToolRegistry    │  (管理所有 tools)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AgentToolManager│  (集成管理器)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AgentManager   │  (Agent 执行引擎)
└─────────────────┘
```

## 功能特性

- **Skills to Tools 转换**: 自动将 skill 文件转换为可调用的 tools
- **Tool Dispatch**: 支持 skill 转发到其他 tool
- **多模型支持**: 支持 Anthropic Claude、OpenAI、Ollama 等多种模型
- **上下文管理**: 集成记忆、bootstrap 文件、skills 摘要
- **工具注册表**: 统一管理和执行所有 tools
- **事件流**: 完整的事件流支持，实时获取 Agent 状态
- **对话管理**: 自动管理对话历史和上下文
- **流式输出**: 支持流式响应，提升用户体验

## 核心模块

### 1. context.js - 上下文构建器

负责构建 Agent 的系统提示词和消息上下文。

**主要功能：**
- 构建系统提示词（身份、平台信息、bootstrap 文件）
- 集成记忆上下文
- 加载 skills 摘要
- 管理消息历史
- 支持多模态内容（文本 + 图片）

**使用示例：**
```javascript
import { ContextBuilder } from './context.js'

const builder = new ContextBuilder('/path/to/workspace')

// 构建系统提示词
const systemPrompt = await builder.buildSystemPrompt()

// 添加用户消息
const messages = []
await builder.addUserMessage(messages, 'Hello, agent!')

// 添加助手消息
builder.addAssistantMessage(messages, 'Hello! How can I help?')
```

### 2. skill-to-tool.js - Skill 转 Tool 转换器

将 skill 文件转换为可执行的 tool。

**主要功能：**
- 解析 skill frontmatter 配置
- 支持 tool dispatch（转发到其他 tool）
- 创建标准 skill tool
- 解析和执行外部脚本

**Skill Frontmatter 配置：**
```yaml
---
name: github
description: GitHub operations
command-dispatch: tool
command-tool: github_api
command-arg-mode: raw
parameters:
  type: object
  properties:
    action:
      type: string
      description: Action to perform
---
```

### 3. tool-registry.js - Tool 注册表

管理所有可用的 tools。

**主要功能：**
- 注册/注销 tools
- 按类别组织 tools
- 执行 tools
- 转换为不同格式（pi-agent-core、OpenAI）

### 4. tool-manager.js - Agent Tool 管理器

集成 skills 和 tools 的统一管理器。

**主要功能：**
- 自动加载和转换 skills
- 管理内置 tools
- 支持自定义 tools
- 提供统一的 tool 接口

## 快速开始

### 步骤 1: 创建 Skill 文件

在 `skills/` 目录下创建 `SKILL.md` 文件：

```markdown
---
name: github
description: GitHub repository operations
command-dispatch: tool
command-tool: github_api
always: false
---

# GitHub Skill

This skill provides GitHub repository operations.
```

### 步骤 2: 初始化 Tool Manager

```javascript
import { AgentToolManager } from './core/agent/tool-manager.js'

const toolManager = new AgentToolManager({
  workspace: process.cwd(),
  autoLoadSkills: true
})

await toolManager.initialize()
```

### 步骤 3: 集成到 Agent

```javascript
import AgentManager from './core/agent/agent.js'
import { ContextBuilder } from './core/agent/context.js'

// 构建上下文
const contextBuilder = new ContextBuilder(process.cwd())
const systemPrompt = await contextBuilder.buildSystemPrompt()

// 创建 Agent
const agent = new AgentManager({
  provider: 'anthropic',
  modelId: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY,
  systemPrompt
})

await agent.initialize()

// 注册 tools
const tools = toolManager.getPiAgentTools()
agent.registerTools(tools)

// 开始对话
const response = await agent.chat('列出当前目录的文件')
```

## 高级特性

### Tool Dispatch

Skill 可以配置为转发到其他 tool：

```yaml
---
name: my_skill
command-dispatch: tool
command-tool: target_tool_name
command-arg-mode: raw
---
```

当调用 `my_skill` 时，会自动转发到 `target_tool_name`。

### 自定义 Tool

```javascript
toolManager.registerTool({
  name: 'custom_search',
  description: 'Custom search tool',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' }
    }
  },
  execute: async (params) => {
    return { success: true, results: [] }
  },
  metadata: { category: 'search' }
})
```

### Skill 过滤

```javascript
// 使用白名单
const toolManager = new AgentToolManager({
  workspace: process.cwd(),
  skillFilter: ['github', 'docker', 'kubernetes']
})

// 使用自定义过滤函数
const toolManager = new AgentToolManager({
  workspace: process.cwd(),
  skillFilter: (skill) => {
    return skill.frontmatter.category === 'development'
  }
})
```

## 配置选项

### AgentToolManager 配置

```javascript
const toolManager = new AgentToolManager({
  workspace: '/path/to/workspace',  // 工作目录
  skillsDir: '/path/to/skills',     // Skills 目录
  autoLoadSkills: true,              // 自动加载 skills
  skillFilter: null,                 // Skill 过滤器
})
```

### AgentManager 配置

```javascript
const agent = new AgentManager({
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
})
```

## 示例代码

查看 `integration-example.js` 获取完整示例：

```bash
node src/main/app/core/agent/integration-example.js
```

### 基础示例

```javascript
import { AgentToolManager } from './tool-manager.js'
import AgentManager from './agent.js'
import { ContextBuilder } from './context.js'

// 1. 初始化 Tool Manager
const toolManager = new AgentToolManager({
  workspace: process.cwd(),
  autoLoadSkills: true
})
await toolManager.initialize()

// 2. 构建上下文
const contextBuilder = new ContextBuilder(process.cwd())
const systemPrompt = await contextBuilder.buildSystemPrompt()

// 3. 创建 Agent
const agent = new AgentManager({
  provider: 'anthropic',
  modelId: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY,
  systemPrompt
})
await agent.initialize()

// 4. 注册 tools
const tools = toolManager.getPiAgentTools()
agent.registerTools(tools)

// 5. 开始对话
const response = await agent.chat('帮我读取 package.json 文件')
console.log(response)
```

### Tool Dispatch 示例

```javascript
// 注册目标 tool
toolManager.registerTool({
  name: 'github_api',
  description: 'Call GitHub API',
  parameters: {
    type: 'object',
    properties: {
      endpoint: { type: 'string' },
      method: { type: 'string', default: 'GET' }
    }
  },
  execute: async (params) => {
    console.log('调用 GitHub API:', params)
    return { success: true, data: {} }
  }
})

// 创建 dispatch skill
const skill = {
  name: 'github',
  description: 'GitHub operations',
  frontmatter: {
    'command-dispatch': 'tool',
    'command-tool': 'github_api',
    'command-arg-mode': 'raw'
  },
  body: 'GitHub skill content'
}

// 转换并注册
const tool = toolManager.converter.createToolFromSkill(skill)
toolManager.registerTool(tool)

// 执行
const result = await toolManager.executeTool('github', {
  args: '--endpoint=/repos/owner/repo --method=GET'
})
```

## 目录结构

```
src/main/app/core/agent/
├── README.md                    # 本文档
├── context.js                   # 上下文构建器
├── skill-to-tool.js            # Skill 转 Tool 转换器
├── tool-registry.js            # Tool 注册表
├── tool-manager.js             # Agent Tool 管理器
├── agent.js                    # Agent 管理器
├── integration-example.js      # 集成示例
└── index.js                    # 模块导出
```

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

## API 参考

### ContextBuilder

**构造函数**
```javascript
new ContextBuilder(workspace)
```

**方法**
- `buildSystemPrompt(skillNames)` - 构建系统提示词
- `addUserMessage(messages, content, imagePaths)` - 添加用户消息
- `addAssistantMessage(messages, content, toolCalls)` - 添加助手消息
- `addToolResult(messages, toolCallId, toolName, result)` - 添加工具结果
- `buildRuntimeContext(options)` - 构建运行时上下文
- `trimMessages(messages, maxMessages)` - 限制消息数量
- `stripRuntimeContext(messages)` - 清理运行时标记

### SkillToToolConverter

**构造函数**
```javascript
new SkillToToolConverter({ skillRunner })
```

**方法**
- `createToolFromSkill(skill)` - 从 skill 创建 tool
- `convertSkillsToTools(skills)` - 批量转换 skills
- `registerTool(name, tool)` - 注册外部 tool
- `getTool(name)` - 获取已注册的 tool
- `getAllTools()` - 获取所有 tools

### ToolRegistry

**构造函数**
```javascript
new ToolRegistry()
```

**方法**
- `register(tool)` - 注册 tool
- `registerBatch(tools)` - 批量注册
- `get(name)` - 获取 tool
- `has(name)` - 检查是否存在
- `unregister(name)` - 移除 tool
- `getAll()` - 获取所有 tools
- `getByCategory(category)` - 按类别获取
- `execute(name, params)` - 执行 tool
- `toPiAgentTools()` - 转换为 pi-agent-core 格式
- `toOpenAIFunctions()` - 转换为 OpenAI 格式
- `getSummary()` - 获取摘要
- `getStats()` - 获取统计信息

### AgentToolManager

**构造函数**
```javascript
new AgentToolManager({ workspace, skillsDir, autoLoadSkills, skillFilter })
```

**方法**
- `initialize()` - 初始化
- `registerTool(tool)` - 注册自定义 tool
- `registerTools(tools)` - 批量注册
- `getTool(name)` - 获取 tool
- `getAllTools()` - 获取所有 tools
- `getPiAgentTools()` - 获取 pi-agent-core 格式
- `getOpenAITools()` - 获取 OpenAI 格式
- `executeTool(name, params)` - 执行 tool
- `reloadSkills()` - 重新加载 skills
- `getToolsSummary()` - 获取摘要
- `getStats()` - 获取统计信息

## 故障排除

### Skills 未加载

确保 Skills 目录路径正确，且 SKILL.md 文件格式正确。

### Tool 执行失败

检查 tool 的 `execute` 函数是否正确实现，并返回有效的结果。

### Tool Dispatch 失败

确保目标 tool 已注册，且 frontmatter 配置正确：
- `command-dispatch: tool`
- `command-tool: target_tool_name`

### 模型连接失败

- 检查 API Key 是否正确
- 检查网络连接
- 对于 Ollama，确保服务正在运行

## 参考资料

- 参考项目: [openclaw](https://github.com/openclaw/openclaw) - Skills to Tools 机制
- 参考项目: [nanobot](https://github.com/nanobot/nanobot) - Context Builder 实现
- [pi-agent-core 文档](https://github.com/mariozechner/pi-agent-core)
- [Skills 文档](../../skills/README.md)

## License

MIT
