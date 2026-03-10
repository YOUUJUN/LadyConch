import {
  DEFAULT_SANDBOX_CONTAINER_PREFIX,
  DEFAULT_SANDBOX_IDLE_HOURS,
  DEFAULT_SANDBOX_IMAGE,
  DEFAULT_SANDBOX_MAX_AGE_DAYS,
  DEFAULT_SANDBOX_WORKDIR,
  DEFAULT_SANDBOX_WORKSPACE_ROOT,
  DEFAULT_TOOL_ALLOW,
  DEFAULT_TOOL_DENY,
} from './constants.js'

/**
 * 解析沙盒作用域
 * @param {Object} params
 * @param {'session' | 'agent' | 'shared'} [params.scope]
 * @returns {'session' | 'agent' | 'shared'}
 */
export function resolveSandboxScope(params) {
  return params.scope || 'agent'
}

/**
 * 解析 Docker 配置
 * @param {Object} params
 * @param {'session' | 'agent' | 'shared'} params.scope
 * @param {Partial<import('./types.js').SandboxDockerConfig>} [params.dockerOverride]
 * @returns {import('./types.js').SandboxDockerConfig}
 */
export function resolveSandboxDockerConfig(params) {
  const override = params.dockerOverride || {}
  return {
    image: override.image || DEFAULT_SANDBOX_IMAGE,
    containerPrefix: override.containerPrefix || DEFAULT_SANDBOX_CONTAINER_PREFIX,
    workdir: override.workdir || DEFAULT_SANDBOX_WORKDIR,
    network: override.network || 'none',
    user: override.user,
    binds: override.binds,
    env: override.env,
    labels: override.labels,
    dangerouslyAllowReservedContainerTargets:
      override.dangerouslyAllowReservedContainerTargets ?? false,
    dangerouslyAllowExternalBindSources:
      override.dangerouslyAllowExternalBindSources ?? false,
  }
}

/**
 * 解析清理配置
 * @param {Object} params
 * @param {Partial<import('./types.js').SandboxPruneConfig>} [params.pruneOverride]
 * @returns {import('./types.js').SandboxPruneConfig}
 */
export function resolveSandboxPruneConfig(params) {
  const override = params.pruneOverride || {}
  return {
    idleHours: override.idleHours ?? DEFAULT_SANDBOX_IDLE_HOURS,
    maxAgeDays: override.maxAgeDays ?? DEFAULT_SANDBOX_MAX_AGE_DAYS,
  }
}

/**
 * 解析完整沙盒配置
 * @param {Object} [userConfig] - 用户配置
 * @param {string} [agentId] - Agent ID
 * @returns {import('./types.js').SandboxConfig}
 */
export function resolveSandboxConfig(userConfig, agentId) {
  const cfg = userConfig || {}
  const agentCfg = agentId && cfg.agents?.[agentId] ? cfg.agents[agentId] : {}
  const sandboxCfg = agentCfg.sandbox || cfg.sandbox || {}

  const scope = resolveSandboxScope({ scope: sandboxCfg.scope })

  return {
    mode: sandboxCfg.mode || 'off',
    scope,
    workspaceAccess: sandboxCfg.workspaceAccess || 'none',
    workspaceRoot: sandboxCfg.workspaceRoot || DEFAULT_SANDBOX_WORKSPACE_ROOT,
    docker: resolveSandboxDockerConfig({
      scope,
      dockerOverride: sandboxCfg.docker,
    }),
    tools: {
      allow: sandboxCfg.tools?.allow || [...DEFAULT_TOOL_ALLOW],
      deny: sandboxCfg.tools?.deny || [...DEFAULT_TOOL_DENY],
    },
    prune: resolveSandboxPruneConfig({
      pruneOverride: sandboxCfg.prune,
    }),
  }
}
