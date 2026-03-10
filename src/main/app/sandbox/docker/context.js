import fs from 'fs/promises'
import path from 'path'
import { resolveSandboxConfig } from './config.js'
import { ensureSandboxContainer, execInContainer, dockerContainerState, execDocker } from './docker.js'
import { maybePruneSandboxes } from './prune.js'
import { readRegistry, updateRegistry, removeRegistryEntry } from './registry.js'
import { resolveSandboxScopeKey, resolveSandboxWorkspaceDir } from './shared.js'
import { ensureSandboxWorkspace } from './workspace.js'

/**
 * 解析沙盒会话
 * @param {Object} params
 * @param {Object} [params.config] - 用户配置
 * @param {string} [params.sessionKey] - 会话键
 * @param {string} [params.agentId] - Agent ID
 * @returns {{cfg: import('./types.js').SandboxConfig, rawSessionKey: string} | null}
 */
function resolveSandboxSession(params) {
  const cfg = resolveSandboxConfig(params.config, params.agentId)

  if (cfg.mode === 'off') {
    return null
  }

  const rawSessionKey = params.sessionKey?.trim() || 'main'
  return { cfg, rawSessionKey }
}

/**
 * 确保沙盒上下文（创建或复用容器）
 * @param {Object} params
 * @param {Object} [params.config] - 用户配置
 * @param {string} [params.sessionKey] - 会话键
 * @param {string} [params.agentId] - Agent ID
 * @param {string} [params.workspaceDir] - 工作区目录（覆盖默认）
 * @returns {Promise<import('./types.js').SandboxContext | null>}
 */
export async function ensureSandboxContext(params) {
  const resolved = resolveSandboxSession(params)
  if (!resolved) {
    return null
  }

  const { cfg, rawSessionKey } = resolved

  // 触发清理（节流）
  await maybePruneSandboxes(cfg).catch(() => undefined)

  // 解析作用域键
  const scopeKey = resolveSandboxScopeKey(cfg.scope, rawSessionKey)

  // 解析工作区目录
  const agentWorkspaceDir = params.workspaceDir
    ? path.resolve(params.workspaceDir)
    : process.cwd()

  const sandboxWorkspaceDir =
    cfg.scope === 'shared'
      ? path.resolve(cfg.workspaceRoot)
      : resolveSandboxWorkspaceDir(cfg.workspaceRoot, scopeKey)

  const workspaceDir =
    cfg.workspaceAccess === 'rw' ? agentWorkspaceDir : sandboxWorkspaceDir

  // 确保工作区存在
  if (workspaceDir === sandboxWorkspaceDir) {
    await ensureSandboxWorkspace(sandboxWorkspaceDir, agentWorkspaceDir)
  } else {
    await fs.mkdir(workspaceDir, { recursive: true })
  }

  // 解析容器名称
  const containerName = `${cfg.docker.containerPrefix}${scopeKey.replace(/[^a-z0-9-]/g, '-')}`

  // 确保容器存在并运行
  await ensureSandboxContainer({
    cfg,
    workspaceDir,
    agentWorkspaceDir,
    scopeKey,
    containerName,
  })

  // 更新注册表
  const now = Date.now()
  await updateRegistry({
    containerName,
    sessionKey: scopeKey,
    createdAtMs: now,
    lastUsedAtMs: now,
    image: cfg.docker.image,
  })

  return {
    enabled: true,
    sessionKey: rawSessionKey,
    workspaceDir,
    agentWorkspaceDir,
    workspaceAccess: cfg.workspaceAccess,
    containerName,
    containerWorkdir: cfg.docker.workdir,
    docker: cfg.docker,
    tools: cfg.tools,
  }
}

/**
 * 列出所有沙盒容器
 * @param {Object} [config] - 用户配置
 * @returns {Promise<Array<import('./types.js').SandboxRegistryEntry & {running: boolean}>>}
 */
export async function listSandboxContainers(config) {
  const registry = await readRegistry()
  const results = []

  for (const entry of registry.entries) {
    const state = await dockerContainerState(entry.containerName)
    results.push({
      ...entry,
      running: state.running,
    })
  }

  return results
}

/**
 * 删除沙盒容器
 * @param {string} containerName - 容器名称
 * @returns {Promise<void>}
 */
export async function removeSandboxContainer(containerName) {
  try {
    await execDocker(['rm', '-f', containerName], { allowFailure: true })
  } catch {
    // 忽略删除失败
  }
  await removeRegistryEntry(containerName)
}

/**
 * 在沙盒中执行命令
 * @param {import('./types.js').SandboxContext} context - 沙盒上下文
 * @param {Array<string>} command - 命令
 * @param {Object} [options] - 选项
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
export async function execInSandbox(context, command, options = {}) {
  return await execInContainer(context.containerName, command, options)
}
