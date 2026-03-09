# 任务规划模块 (Task Planner)

类似 OpenClaw 的任务分解和执行系统。

## 功能特性

- **任务分解**: 将复杂目标自动分解为可执行的子任务
- **依赖管理**: 识别和处理任务之间的依赖关系
- **优先级排序**: 为任务分配优先级并按顺序执行
- **进度跟踪**: 实时监控任务执行进度
- **重新规划**: 基于执行反馈动态调整计划
- **执行历史**: 记录所有任务执行历史

## 使用示例

### 在渲染进程中使用

```javascript
// 创建任务计划
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

const planner = new TaskPlanner(llmClient)

// 创建任务计划
const plan = await planner.planTask('开发一个用户登录功能', {
  framework: 'Vue 3',
  backend: 'Node.js'
})

// 执行任务计划
const result = await planner.executePlan(plan.id, (progress) => {
  console.log('进度:', progress)
})
```

## API 接口

### IPC 接口

#### `planner:plan`
创建任务计划
- 参数: `{ goal, context, config }`
- 返回: `{ success, data: plan }`

#### `planner:execute`
执行任务计划
- 参数: `{ planId }`
- 返回: `{ success, data: result }`

#### `planner:get`
获取任务计划
- 参数: `{ planId }`
- 返回: `{ success, data: plan }`

#### `planner:list`
列出所有任务计划
- 返回: `{ success, data: plans[] }`

#### `planner:history`
获取执行历史
- 返回: `{ success, data: history[] }`

#### `planner:replan`
重新规划任务
- 参数: `{ planId, feedback, config }`
- 返回: `{ success, data: newPlan }`

#### `planner:progress` (事件)
任务执行进度更新
- 数据: `{ taskId, status, task, result, error }`

## 任务计划结构

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
      tools: ['file_operations', 'code_generation']
    }
  ],
  executionOrder: ['task-1', 'task-2', 'task-3'],
  status: 'pending|executing|completed|failed|partial',
  createdAt: 1234567890,
  completedAt: 1234567890,
  results: []
}
```

## 配置说明

支持的 LLM 配置:
- `provider`: 'ollama' | 'openai' | 'anthropic' 等
- `modelId`: 模型 ID
- `baseUrl`: API 基础 URL
- `apiKey`: API 密钥（如需要）

## 注意事项

1. 确保 LLM 服务正常运行
2. 任务执行可能需要较长时间，建议监听进度事件
3. 高优先级任务失败会中断整个计划执行
4. 可以基于执行反馈重新规划任务
