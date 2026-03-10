import {
  ensureSandboxContext,
  listSandboxContainers,
  removeSandboxContainer,
  execInSandbox,
} from './context.js'
import { resolveSandboxConfig } from './config.js'
import { dockerContainerState } from './docker.js'

/**
 * Docker 沙盒管理器
 */
class DockerSandboxManager {
  constructor(config = {}) {
    this.config = config
    this.contexts = new Map()
  }

  /**
   * 获取或创建沙盒上下文
   * @param {Object} params
   * @param {string} [params.sessionKey] - 会话键
   * @param {string} [params.agentId] - Agent ID
   * @param {string} [params.workspaceDir] - 工作区目录
   * @returns {Promise<import('./types.js').SandboxContext | null>}
   */
  async getContext(params = {}) {
    const sessionKey = params.sessionKey || 'default'
    const cacheKey = `${params.agentId || 'default'}:${sessionKey}`

    // 检查缓存
    if (this.contexts.has(cacheKey)) {
      const cached = this.contexts.get(cacheKey)
      // 验证容器是否仍然存在
      const state = await dockerContainerState(cached.containerName)
      if (state.exists) {
        return cached
      }
      // 容器不存在，清除缓存
      this.contexts.delete(cacheKey)
    }

    // 创建新上下文
    const context = await ensureSandboxContext({
      config: this.config,
      sessionKey,
      agentId: params.agentId,
      workspaceDir: params.workspaceDir,
    })

    if (context) {
      this.contexts.set(cacheKey, context)
    }

    return context
  }

  /**
   * 执行代码
   * @param {string} code - 代码
   * @param {Object} [options] - 选项
   * @param {string} [options.sessionKey] - 会话键
   * @param {string} [options.agentId] - Agent ID
   * @param {string} [options.language] - 语言（js, python, bash）
   * @param {number} [options.timeout] - 超时时间（毫秒）
   * @returns {Promise<{success: boolean, result?: any, error?: any, stdout?: string, stderr?: string}>}
   */
  async execute(code, options = {}) {
    const startTime = Date.now()

    try {
      // 获取沙盒上下文
      const context = await this.getContext({
        sessionKey: options.sessionKey,
        agentId: options.agentId,
        workspaceDir: options.workspaceDir,
      })

      if (!context) {
        return {
          success: false,
          error: {
            message: '沙盒未启用',
            code: 'SANDBOX_DISABLED',
          },
        }
      }

      // 根据语言选择执行方式
      const language = options.language || 'bash'
      let command

      switch (language) {
        case 'js':
        case 'javascript':
          command = ['node', '-e', code]
          break
        case 'python':
          command = ['python3', '-c', code]
          break
        case 'bash':
        case 'sh':
          command = ['sh', '-c', code]
          break
        default:
          return {
            success: false,
            error: {
              message: `不支持的语言: ${language}`,
              code: 'UNSUPPORTED_LANGUAGE',
            },
          }
      }

      // 执行命令
      const result = await execInSandbox(context, command, {
        timeout: options.timeout,
      })

      return {
        success: result.code === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.code,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
        },
        executionTime: Date.now() - startTime,
      }
    }
  }

  /**
   * 列出所有沙盒容器
   * @returns {Promise<Array>}
   */
  async list() {
    return await listSandboxContainers(this.config)
  }

  /**
   * 删除沙盒容器
   * @param {string} containerName - 容器名称
   * @returns {Promise<void>}
   */
  async remove(containerName) {
    await removeSandboxContainer(containerName)

    // 清除缓存
    for (const [key, context] of this.contexts.entries()) {
      if (context.containerName === containerName) {
        this.contexts.delete(key)
      }
    }
  }

  /**
   * 清除所有缓存的上下文
   */
  clearCache() {
    this.contexts.clear()
  }

  /**
   * 获取沙盒配置
   * @param {string} [agentId] - Agent ID
   * @returns {import('./types.js').SandboxConfig}
   */
  getConfig(agentId) {
    return resolveSandboxConfig(this.config, agentId)
  }

  /**
   * 检查沙盒是否启用
   * @param {string} [agentId] - Agent ID
   * @returns {boolean}
   */
  isEnabled(agentId) {
    const cfg = this.getConfig(agentId)
    return cfg.mode !== 'off'
  }
}

export default DockerSandboxManager
