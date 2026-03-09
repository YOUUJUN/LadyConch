# 记忆管理模块 (Memory Manager)

基于 Markdown 文件的智能记忆存储和检索系统。

## 功能特性

### 基础功能
- **Markdown 存储**: 所有记忆以 Markdown 文件形式存储，易于阅读和编辑
- **分类管理**: 支持短期记忆、长期记忆、知识库三种类型
- **标签系统**: 灵活的标签分类和检索
- **全文搜索**: 支持关键词、类型、分类、标签等多维度搜索
- **自动索引**: 自动维护记忆索引文件

### 智能功能（结合 LLM）
- **智能分类**: 自动分析内容并分配类型和标签
- **语义搜索**: 理解查询意图，智能检索相关记忆
- **记忆摘要**: 自动生成记忆摘要
- **关联发现**: 找出相关联的记忆
- **记忆问答**: 基于记忆内容回答问题

## 使用示例

### 基础使用

```javascript
import MemoryManager from './memory-manager.js'

// 创建实例
const memory = new MemoryManager({
  memoryDir: './memory'
})

// 初始化
await memory.initialize()

// 保存记忆
const saved = await memory.saveMemory({
  content: '今天学习了 Vue 3 的 Composition API',
  type: 'long-term',
  category: 'learning',
  tags: ['vue', 'frontend', 'javascript'],
  metadata: {
    source: 'documentation',
    difficulty: 'intermediate'
  }
})

// 搜索记忆
const results = await memory.searchMemories({
  keyword: 'vue',
  type: 'long-term',
  tags: ['frontend']
})

// 更新记忆
await memory.updateMemory(saved.id, {
  content: '今天深入学习了 Vue 3 的 Composition API 和响应式原理'
})

// 删除记忆
await memory.deleteMemory(saved.id)

// 列出所有记忆
const all = await memory.listMemories({ limit: 10, offset: 0 })

// 清理旧记忆
const deleted = await memory.cleanupMemories({
  olderThanDays: 30,
  type: 'short-term'
})
```

### 智能助手使用

```javascript
import MemoryManager from './memory-manager.js'
import MemoryAssistant from './memory-assistant.js'
import LLMClient from '../llm/llm-client.js'

// 创建实例
const memory = new MemoryManager({ memoryDir: './memory' })
const llm = new LLMClient({
  provider: 'ollama',
  modelId: 'qwen2.5:latest',
  baseUrl: 'http://localhost:11434/v1'
})
const assistant = new MemoryAssistant(memory, llm)

// 智能保存（自动分类）
const saved = await assistant.smartSave(
  '今天完成了用户认证模块的开发，使用了 JWT 和 bcrypt'
)

// 语义搜索
const results = await assistant.smartSearch('如何实现用户登录')

// 生成摘要
const summary = await assistant.generateSummary({
  type: 'long-term',
  days: 7
})

// 找出相关记忆
const related = await assistant.findRelated(saved.id, 5)

// 记忆问答
const answer = await assistant.askMemory('我之前学过哪些前端框架？')
```

### 在渲染进程中使用

```javascript
// 初始化
await window.api.memory.init()

// 保存记忆
const result = await window.api.memory.save({
  content: '项目使用 Electron + Vue 3 架构',
  type: 'knowledge',
  category: 'project',
  tags: ['electron', 'vue', 'architecture']
})

// 搜索记忆
const memories = await window.api.memory.search({
  keyword: 'electron',
  type: 'knowledge'
})

// 列出所有记忆
const all = await window.api.memory.list({ limit: 20 })

// 导出记忆
const exported = await window.api.memory.export()

// 导入记忆
await window.api.memory.import({ memories: exported })
```

## API 接口

### MemoryManager

#### `initialize()`
初始化记忆目录和索引文件

#### `saveMemory(memory)`
保存记忆
- 参数: `{ content, type, category, tags, metadata }`
- 返回: 保存的记忆对象

#### `getMemory(memoryId)`
获取指定记忆
- 参数: 记忆 ID
- 返回: 记忆对象或 null

#### `searchMemories(query)`
搜索记忆
- 参数: `{ keyword, type, category, tags }`
- 返回: 匹配的记忆数组

#### `updateMemory(memoryId, updates)`
更新记忆
- 参数: 记忆 ID 和更新内容
- 返回: 更新后的记忆对象

#### `deleteMemory(memoryId)`
删除记忆
- 参数: 记忆 ID
- 返回: 是否成功

#### `listMemories(options)`
列出所有记忆
- 参数: `{ limit, offset }`
- 返回: 记忆数组

#### `cleanupMemories(options)`
清理旧记忆
- 参数: `{ olderThanDays, type }`
- 返回: 删除的记忆数量

#### `exportToJson()`
导出所有记忆为 JSON

#### `importFromJson(memories)`
从 JSON 导入记忆

### MemoryAssistant

#### `smartSave(content, options)`
智能保存（自动分类）

#### `smartSearch(query, options)`
语义搜索

#### `generateSummary(options)`
生成记忆摘要

#### `findRelated(memoryId, limit)`
找出相关记忆

#### `askMemory(question)`
基于记忆回答问题

### IPC 接口

- `memory:init` - 初始化
- `memory:save` - 保存记忆
- `memory:get` - 获取记忆
- `memory:search` - 搜索记忆
- `memory:update` - 更新记忆
- `memory:delete` - 删除记忆
- `memory:list` - 列出记忆
- `memory:cleanup` - 清理记忆
- `memory:export` - 导出记忆
- `memory:import` - 导入记忆

## 记忆类型

### short-term (短期记忆)
临时性的、会话级别的记忆，适合存储：
- 当前任务的临时信息
- 会话中的上下文
- 待办事项

### long-term (长期记忆)
持久性的、重要的记忆，适合存储：
- 学习笔记
- 项目经验
- 重要决策

### knowledge (知识库)
结构化的知识和参考信息，适合存储：
- 技术文档
- 最佳实践
- 代码片段

## Markdown 文件格式

```markdown
# 分类名称

> ID: uuid
> Type: long-term
> Created: 2026-03-09T10:00:00.000Z
> Updated: 2026-03-09T10:00:00.000Z

**Tags**: `vue`, `frontend`, `javascript`

## 内容

今天学习了 Vue 3 的 Composition API

## 元数据

\```json
{
  "source": "documentation",
  "difficulty": "intermediate"
}
\```
```

## 存储位置

默认存储在应用数据目录下的 `memory` 文件夹：
- Windows: `%APPDATA%/lady/memory`
- macOS: `~/Library/Application Support/lady/memory`
- Linux: `~/.config/lady/memory`

## 注意事项

1. 记忆文件可以手动编辑，但需保持格式正确
2. 删除记忆文件后需要手动更新索引
3. 智能功能需要 LLM 服务支持
4. 定期清理短期记忆以节省空间
5. 重要记忆建议定期导出备份
