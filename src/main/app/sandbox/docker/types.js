/**
 * Docker Sandbox 类型定义
 */

/**
 * @typedef {Object} SandboxDockerConfig
 * @property {string} image - Docker 镜像名称
 * @property {string} containerPrefix - 容器名称前缀
 * @property {string} workdir - 容器内工作目录
 * @property {string} network - 网络模式
 * @property {string} [user] - 运行用户
 * @property {Array<string>} [binds] - 挂载绑定
 * @property {Array<string>} [env] - 环境变量
 * @property {Object<string, string>} [labels] - 容器标签
 * @property {boolean} [dangerouslyAllowReservedContainerTargets] - 允许保留容器目标
 * @property {boolean} [dangerouslyAllowExternalBindSources] - 允许外部绑定源
 */

/**
 * @typedef {'none' | 'ro' | 'rw'} SandboxWorkspaceAccess
 */

/**
 * @typedef {'session' | 'agent' | 'shared'} SandboxScope
 */

/**
 * @typedef {Object} SandboxToolPolicy
 * @property {Array<string>} [allow] - 允许的工具列表
 * @property {Array<string>} [deny] - 拒绝的工具列表
 */

/**
 * @typedef {Object} SandboxPruneConfig
 * @property {number} idleHours - 空闲小时数
 * @property {number} maxAgeDays - 最大存活天数
 */

/**
 * @typedef {Object} SandboxConfig
 * @property {'off' | 'non-main' | 'all'} mode - 沙盒模式
 * @property {SandboxScope} scope - 沙盒作用域
 * @property {SandboxWorkspaceAccess} workspaceAccess - 工作区访问权限
 * @property {string} workspaceRoot - 工作区根目录
 * @property {SandboxDockerConfig} docker - Docker 配置
 * @property {SandboxToolPolicy} tools - 工具策略
 * @property {SandboxPruneConfig} prune - 清理配置
 */

/**
 * @typedef {Object} SandboxContext
 * @property {boolean} enabled - 是否启用
 * @property {string} sessionKey - 会话键
 * @property {string} workspaceDir - 工作区目录
 * @property {string} agentWorkspaceDir - Agent 工作区目录
 * @property {SandboxWorkspaceAccess} workspaceAccess - 工作区访问权限
 * @property {string} containerName - 容器名称
 * @property {string} containerWorkdir - 容器工作目录
 * @property {SandboxDockerConfig} docker - Docker 配置
 * @property {SandboxToolPolicy} tools - 工具策略
 */

/**
 * @typedef {Object} SandboxRegistryEntry
 * @property {string} containerName - 容器名称
 * @property {string} sessionKey - 会话键
 * @property {number} createdAtMs - 创建时间戳
 * @property {number} lastUsedAtMs - 最后使用时间戳
 * @property {string} image - 镜像名称
 * @property {string} [configHash] - 配置哈希
 */

/**
 * @typedef {Object} DockerContainerState
 * @property {boolean} exists - 容器是否存在
 * @property {boolean} running - 容器是否运行中
 */

export default {}
