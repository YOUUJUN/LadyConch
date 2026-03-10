import { execDocker, dockerContainerState } from './docker.js'
import { readRegistry, removeRegistryEntry } from './registry.js'

/**
 * 清理过期的沙盒容器
 * @param {import('./types.js').SandboxConfig} cfg - 沙盒配置
 * @returns {Promise<void>}
 */
export async function pruneSandboxContainers(cfg) {
  const now = Date.now()

  // 如果清理配置都为 0，则不清理
  if (cfg.prune.idleHours === 0 && cfg.prune.maxAgeDays === 0) {
    return
  }

  const registry = await readRegistry()

  for (const entry of registry.entries) {
    const idleMs = now - entry.lastUsedAtMs
    const ageMs = now - entry.createdAtMs

    const shouldPrune =
      (cfg.prune.idleHours > 0 && idleMs > cfg.prune.idleHours * 60 * 60 * 1000) ||
      (cfg.prune.maxAgeDays > 0 && ageMs > cfg.prune.maxAgeDays * 24 * 60 * 60 * 1000)

    if (shouldPrune) {
      try {
        // 删除容器
        await execDocker(['rm', '-f', entry.containerName], { allowFailure: true })
      } catch (error) {
        console.warn(`清理容器失败: ${entry.containerName}`, error)
      } finally {
        // 从注册表中删除
        await removeRegistryEntry(entry.containerName)
      }
    }
  }
}

/**
 * 确保容器正在运行
 * @param {string} containerName - 容器名称
 * @returns {Promise<void>}
 */
export async function ensureDockerContainerIsRunning(containerName) {
  const state = await dockerContainerState(containerName)
  if (state.exists && !state.running) {
    await execDocker(['start', containerName])
  }
}

let lastPruneAtMs = 0

/**
 * 可能执行清理（带节流）
 * @param {import('./types.js').SandboxConfig} cfg - 沙盒配置
 * @returns {Promise<void>}
 */
export async function maybePruneSandboxes(cfg) {
  const now = Date.now()

  // 每 5 分钟最多清理一次
  if (now - lastPruneAtMs < 5 * 60 * 1000) {
    return
  }

  lastPruneAtMs = now

  try {
    await pruneSandboxContainers(cfg)
  } catch (error) {
    console.error('沙盒清理失败:', error)
  }
}
