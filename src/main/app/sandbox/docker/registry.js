import fs from 'fs/promises'
import path from 'path'
import { SANDBOX_REGISTRY_PATH, SANDBOX_STATE_DIR } from './constants.js'

/**
 * 读取注册表
 * @returns {Promise<{entries: Array<import('./types.js').SandboxRegistryEntry>}>}
 */
export async function readRegistry() {
  try {
    const raw = await fs.readFile(SANDBOX_REGISTRY_PATH, 'utf-8')
    const parsed = JSON.parse(raw)

    if (parsed && Array.isArray(parsed.entries)) {
      return parsed
    }

    return { entries: [] }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { entries: [] }
    }
    throw error
  }
}

/**
 * 写入注册表
 * @param {{entries: Array<import('./types.js').SandboxRegistryEntry>}} registry - 注册表
 * @returns {Promise<void>}
 */
async function writeRegistry(registry) {
  // 确保目录存在
  await fs.mkdir(SANDBOX_STATE_DIR, { recursive: true })

  // 写入文件
  await fs.writeFile(
    SANDBOX_REGISTRY_PATH,
    JSON.stringify(registry, null, 2) + '\n',
    'utf-8'
  )
}

/**
 * 更新注册表条目
 * @param {import('./types.js').SandboxRegistryEntry} entry - 条目
 * @returns {Promise<void>}
 */
export async function updateRegistry(entry) {
  const registry = await readRegistry()

  // 查找现有条目
  const existingIndex = registry.entries.findIndex(
    (e) => e.containerName === entry.containerName
  )

  if (existingIndex >= 0) {
    // 更新现有条目，保留创建时间
    const existing = registry.entries[existingIndex]
    registry.entries[existingIndex] = {
      ...entry,
      createdAtMs: existing.createdAtMs,
    }
  } else {
    // 添加新条目
    registry.entries.push(entry)
  }

  await writeRegistry(registry)
}

/**
 * 删除注册表条目
 * @param {string} containerName - 容器名称
 * @returns {Promise<void>}
 */
export async function removeRegistryEntry(containerName) {
  const registry = await readRegistry()

  const filtered = registry.entries.filter(
    (e) => e.containerName !== containerName
  )

  // 只有在有变化时才写入
  if (filtered.length !== registry.entries.length) {
    await writeRegistry({ entries: filtered })
  }
}

/**
 * 获取注册表条目
 * @param {string} containerName - 容器名称
 * @returns {Promise<import('./types.js').SandboxRegistryEntry|null>}
 */
export async function getRegistryEntry(containerName) {
  const registry = await readRegistry()
  return registry.entries.find((e) => e.containerName === containerName) || null
}

/**
 * 清理过期的注册表条目
 * @param {number} maxAgeMs - 最大存活时间（毫秒）
 * @returns {Promise<Array<string>>} 被清理的容器名称列表
 */
export async function cleanupExpiredEntries(maxAgeMs) {
  const registry = await readRegistry()
  const now = Date.now()
  const removed = []

  const filtered = registry.entries.filter((entry) => {
    const age = now - entry.lastUsedAtMs
    if (age > maxAgeMs) {
      removed.push(entry.containerName)
      return false
    }
    return true
  })

  if (removed.length > 0) {
    await writeRegistry({ entries: filtered })
  }

  return removed
}
