# 任务规划模块 (Task Planner)

类似 OpenClaw 的任务分解和执行系统，现已增强支持 Skills 集成。

## 功能特性

- **任务分解**: 将复杂目标自动分解为可执行的子任务
- **依赖管理**: 识别和处理任务之间的依赖关系
- **优先级排序**: 为任务分配优先级并按顺序执行
- **进度跟踪**: 实时监控任务执行进度
- **重新规划**: 基于执行反馈动态调整计划
- **执行历史**: 记录所有任务执行历史
- **Skills 集成** (新增): 自动查询和使用 skills，必要时创建新 skill
- **智能评估** (新增): 评估现有 skills 是否足以完成任务
- **自动创建** (新增): 调用 skill-creator 自动生成新 skill

## Skills 集成功能

### 1. 自动查询可用 Skills

在创建任务计划时，TaskPlanner 会自动：
- 根据目标关键词搜索相关的 skills
- 评估现有 skills 是否足以完成任务
- 在任务计划中优先使用可用的 skills

### 2. 自动创建新 Skill

如果现有 skills 不足以完成任务，TaskPlanner 会：
- 调用 `skill-creator` skill
- 自动生成新的 skill 定义
- 将新 skill 纳入任务计划

### 3. Skill 集成执行

在执行任务时：
- 如果任务指定了 skill，会自动加载 skill 的上下文
- 将 skill 的指令和引用文档传递给 LLM
- 提高任务执行的准确性和效率

## 使用示例

### 在渲染进程中使用

```javascript
// 创建任务计划（自动使用 skills）
const result = await window.api.planner.plan({
  goal: '开发一个用户登录功能',
  context: {
    framework: 'Vue 3',
    backend: 'Node.js'
  },
  config: {
    provider: 'ollama',
    modelId: 'qwen2.5:latest',
    baseUrl: 'http://localhost:11434/v1'
  }
})

if (result.success) {
  const plan = result.data
  console.log('任务计划:', plan)
  console.log('使用的 Skills:', plan.usedSkills)
  console.log('新创建的 Skill:', plan.newSkill)

  // 执行任务计划
  const execResult = await window.api.planner.execute({
    planId: plan.id
  })

  console.log('执行结果:', execResult)
}

// 监听执行进度
window.api.planner.onProgress((progress) => {
  console.log('任务进度:', progress)
})

// 查询可用的 skills
const skills = await window.api.planner.skills.list()
console.log('可用 Skills:', skills.data)

// 搜索 skills
const searchResults = await window.api.planner.skills.search({ query: 'auth' })
console.log('搜索结果:', searchResults.data)

// 获取 skill 详情
const skill = await window.api.planner.skills.get({ skillName: 'skill-creator' })
console.log('Skill 详情:', skill.data)

// 重新加载 skills
await window.api.planner.skills.reload()
```

### 在主进程中使用

```javascript
import LLMClient from './app/llm/llm-client.js'
import TaskPlanner from './app/planner/task-planner.js'

// 创建实例
const llmClient = new LLMClient({
  provider: 'ollama',
  modelId: 'qwen2.5:latest',
  baseUrl: 'http://localhost:11434/v1'
})

const planner = new TaskPlanner(llmClient, {
  skillsConfig: {
    skillsDir: './custom/skills/path'  // 可选：自定义 skills 目录
  }
})

// 创建任务计划（会自动查询和使用 skills）
const plan = await planner.planTask('开发一个用户登录功能', {
  framework: 'Vue 3',
  backend: 'Node.js'
})

console.log('使用的 Skills:', plan.usedSkills)
console.log('新创建的 Skill:', plan.newSkill)

// 执行任务计划
const result = await planner.executePlan(plan.id, (progress) => {
  console.log('进度:', progress)
})

// 查询可用的 skills
const skills = await planner.getAvailableSkills()

// 搜索 skills
const searchResults = await planner.searchSkills('authentication')

// 获取 skill 详情
const skillDetails = await planner.getSkillDetails('skill-creator')
```

## API 接口

### IPC 接口

#### 任务规划相关

##### `planner:plan`
创建任务计划（自动使用 skills）
- 参数: `{ goal, context, config }`
- 返回: `{ success, data: plan }`

##### `planner:execute`
执行任务计划
- 参数: `{ planId }`
- 返回: `{ success, data: result }`

##### `planner:get`
获取任务计划
- 参数: `{ planId }`
- 返回: `{ success, data: plan }`

##### `planner:list`
列出所有任务计划
- 返回: `{ success, data: plans[] }`

##### `planner:history`
获取执行历史
- 返回: `{ success, data: history[] }`

##### `planner:replan`
重新规划任务
- 参数: `{ planId, feedback, config }`
- 返回: `{ success, data: newPlan }`

##### `planner:progress` (事件)
任务执行进度更新
- 数据: `{ taskId, status, task, result, error }`

#### Skills 管理相关 (新增)

##### `planner:skills:list`
获取所有可用的 skills
- 返回: `{ success, data: skills[] }`

##### `planner:skills:search`
搜索 skills
- 参数: `{ query }`
- 返回: `{ success, data: skills[] }`

##### `planner:skills:get`
获取 skill 详情
- 参数: `{ skillName }`
- 返回: `{ success, data: skill }`

##### `planner:skills:reload`
重新加载 skills
- 返回: `{ success, data: skills[] }`

## 任务计划结构

增强后的任务计划包含以下额外字段：

```javascript
{
  id: 'uuid',
  goal: '目标描述',
  tasks: [
    {
      id: 'task-1',
      title: '任务标题',
      description: '详细描述',
      dependencies: ['task-0'],
      priority: 'high',
      estimatedTime: '30分钟',
      tools: ['file_operations', 'code_generation'],
      skill: '使用的 skill 名称'  // 新增
    }
  ],
  executionOrder: ['task-1', 'task-2', 'task-3'],
  status: 'pending|executing|completed|failed|partial',
  createdAt: 1234567890,
  completedAt: 1234567890,
  results: [],
  usedSkills: ['skill1', 'skill2'],  // 新增
  newSkill: {                         // 新增
    name: '新 skill 名称',
    description: '描述',
    content: 'SKILL.md 内容'
  }
}
```

## 工作流程

### 任务规划阶段

```
用户输入目标
    ↓
查询相关 Skills
    ↓
评估是否需要新 Skill
    ↓
如需要 → 调用 skill-creator 创建
    ↓
生成任务计划（包含 skill 信息）
```

### 任务执行阶段

```
遍历任务列表
    ↓
检查任务是否指定 Skill
    ↓
如指定 → 加载 Skill 上下文
    ↓
将 Skill 指令传递给 LLM
    ↓
执行任务并返回结果
```

## 配置说明

支持的 LLM 配置:
- `provider`: 'ollama' | 'openai' | 'anthropic' 等
- `modelId`: 模型 ID
- `baseUrl`: API 基础 URL
- `apiKey`: API 密钥（如需要）

支持的 Skills 配置 (新增):
- `skillsConfig.skillsDir`: 自定义 skills 目录路径

## 示例场景

### 场景 1：使用现有 Skill

```javascript
// 目标：创建一个新的 skill
const plan = await planner.planTask('创建一个用于代码审查的 skill')

// TaskPlanner 会：
// 1. 找到 skill-creator skill
// 2. 在任务计划中使用 skill-creator
// 3. 执行时加载 skill-creator 的完整上下文
```

### 场景 2：创建新 Skill

```javascript
// 目标：实现一个特殊的功能
const plan = await planner.planTask('实现一个自动化测试报告生成器')

// TaskPlanner 会：
// 1. 搜索相关 skills（可能找不到）
// 2. 判断需要创建新 skill
// 3. 调用 skill-creator 生成新 skill
// 4. 将新 skill 纳入任务计划
```

### 场景 3：混合使用

```javascript
// 目标：复杂的多步骤任务
const plan = await planner.planTask('构建一个完整的博客系统')

// TaskPlanner 会：
// 1. 为不同子任务匹配不同的 skills
// 2. 对于没有合适 skill 的部分，创建新 skill
// 3. 生成包含多个 skills 的综合任务计划
```

## 注意事项

1. 确保 LLM 服务正常运行
2. 任务执行可能需要较长时间，建议监听进度事件
3. 高优先级任务失败会中断整个计划执行
4. 可以基于执行反馈重新规划任务
5. **skill-creator 依赖** (新增): 自动创建新 skill 功能依赖 `skill-creator` skill
6. **首次加载** (新增): 第一次使用时会自动加载所有 skills
7. **热重载** (新增): 修改 skills 后需要调用 `reloadSkills()` 才能生效

## 调试

启用详细日志：

```javascript
// 在控制台查看 skill 查询和创建过程
const plan = await planner.planTask(goal, context)

// 日志输出示例：
// 找到 2 个相关 skills
// 需要创建新 skill: test-report-generator
// 新 skill 已创建: test-report-generator
```

## 性能优化

1. **Skills 缓存**: Skills 只在首次使用时加载，后续使用缓存
2. **并行查询**: 多个关键词搜索可以并行执行
3. **按需加载**: Skill 的引用文档只在需要时加载
