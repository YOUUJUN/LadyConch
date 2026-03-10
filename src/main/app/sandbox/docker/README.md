# Docker Sandbox 模块

基于 openclaw 的 sandbox 设计思路实现的 Docker 沙盒模块，为 LadyConch 提供安全的代码执行环境。

## 功能特性

- **容器隔离**: 使用 Docker 容器提供安全的执行环境
- **会话管理**: 支持 session、agent、shared 三种作用域
- **工作区管理**: 灵活的工作区挂载和访问控制
- **自动清理**: 自动清理过期的容器
- **注册表**: 持久化容器信息
- **工具策略**: 可配置的工具允许/拒绝列表

## 核心概念

### 沙盒作用域 (Scope)

- **session**: 每个会话独立的沙盒
- **agent**: 每个 agent 共享的沙盒
- **shared**: 所有会话共享的沙盒

### 工作区访问 (Workspace Access)

- **none**: 不挂载工作区
- **ro**: 只读挂载
- **rw**: 读写挂载

### 沙盒模式 (Mode)

- **off**: 禁用沙盒
- **non-main**: 仅非主会话使用沙盒
- **all**: 所有会话使用沙盒

## 使用示例

### 基础使用

```javascript
import DockerSandboxManager from './docker/manager.js'

// 创建管理器
const manager = new DockerSandboxManager({
  sandbox: {
    mode: 'all',
    scope: 'session',
    workspaceAccess: 'rw',
    docker: {
      image: 'node:18-alpine',
    },
  },
})

// 执行代码
const result = await manager.execute('console.log("Hello from sandbox")', {
  language: 'js',
  sessionKey: 'my-session',
})

console.log(result.stdout) // "Hello from sandbox"
```

### 获取沙盒上下文

```javascript
import { ensureSandboxContext } from './docker/context.js'

const context = await ensureSandboxContext({
  config: userConfig,
  sessionKey: 'my-session',
  agentId: 'my-agent',
})

if (context) {
  console.log('容器名称:', context.containerName)
  console.log('工作目录:', context.workspaceDir)
}
```

### 列出所有容器

```javascript
const containers = await manager.list()

for (const container of containers) {
  console.log(`${container.containerName}: ${container.running ? '运行中' : '已停止'}`)
}
```

### 删除容器

```javascript
await manager.remove('ladyconch-sbx-my-session-abc123')
```

## 配置示例

```javascript
const config = {
  sandbox: {
    mode: 'all', // 'off' | 'non-main' | 'all'
    scope: 'session', // 'session' | 'agent' | 'shared'
    workspaceAccess: 'rw', // 'none' | 'ro' | 'rw'
    workspaceRoot: '/path/to/sandboxes',
    docker: {
      image: 'node:18-alpine',
      containerPrefix: 'ladyconch-sbx-',
      workdir: '/workspace',
      network: 'none',
      binds: ['/host/path:/container/path:ro'],
      env: ['NODE_ENV=production'],
    },
    tools: {
      allow: ['exec', 'read', 'write'],
      deny: ['network', 'browser'],
    },
    prune: {
      idleHours: 24,
      maxAgeDays: 7,
    },
  },
}
```

## 文件结构

```
docker/
├── index.js          # 模块入口
├── manager.js        # 沙盒管理器
├── context.js        # 上下文管理
├── config.js         # 配置解析
├── docker.js         # Docker 命令执行
├── registry.js       # 容器注册表
├── workspace.js      # 工作区管理
├── prune.js          # 容器清理
├── shared.js         # 共享工具函数
├── hash.js           # 哈希工具
├── constants.js      # 常量定义
└── types.js          # 类型定义
```

## 设计思路

本模块参考了 openclaw 的 sandbox 设计：

1. **分层架构**: 从底层 Docker 操作到高层管理器
2. **注册表机制**: 持久化容器信息，支持重启后恢复
3. **作用域管理**: 灵活的会话/agent/共享作用域
4. **自动清理**: 基于时间的容器清理策略
5. **配置驱动**: 通过配置控制沙盒行为

## 注意事项

1. **Docker 依赖**: 需要系统安装 Docker
2. **镜像准备**: 需要预先构建或拉取沙盒镜像
3. **权限管理**: 注意容器的用户权限配置
4. **资源限制**: 建议配置容器资源限制
5. **网络隔离**: 默认使用 `none` 网络模式

## 与 openclaw 的差异

- 使用 JavaScript/Node.js 而非 TypeScript
- 简化了浏览器沙盒功能
- 移除了 MCP 相关功能
- 适配 Electron 应用环境
- 简化了配置层级

## 后续扩展

- [ ] 添加资源限制配置（CPU、内存）
- [ ] 支持自定义 Dockerfile 构建
- [ ] 添加容器日志收集
- [ ] 支持容器快照和恢复
- [ ] 添加网络代理配置
- [ ] 支持多容器编排
