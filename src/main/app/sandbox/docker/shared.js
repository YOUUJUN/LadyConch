import { hashTextSha256 } from './hash.js'

/**
 * 将会话键转换为安全的 slug
 * @param {string} value - 会话键
 * @returns {string} slug
 */
export function slugifySessionKey(value) {
  const trimmed = value.trim() || 'session'
  const hash = hashTextSha256(trimmed).slice(0, 8)
  const safe = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const base = safe.slice(0, 32) || 'session'
  return `${base}-${hash}`
}

/**
 * 解析沙盒工作区目录
 * @param {string} root - 根目录
 * @param {string} sessionKey - 会话键
 * @returns {string} 工作区目录
 */
export function resolveSandboxWorkspaceDir(root, sessionKey) {
  const slug = slugifySessionKey(sessionKey)
  return `${root}/${slug}`
}

/**
 * 解析沙盒作用域键
 * @param {'session' | 'agent' | 'shared'} scope - 作用域
 * @param {string} sessionKey - 会话键
 * @returns {string} 作用域键
 */
export function resolveSandboxScopeKey(scope, sessionKey) {
  const trimmed = sessionKey.trim() || 'main'
  if (scope === 'shared') {
    return 'shared'
  }
  if (scope === 'session') {
    return trimmed
  }
  // agent scope: 使用 agent ID
  const agentId = resolveAgentIdFromSessionKey(trimmed)
  return `agent:${agentId}`
}

/**
 * 从会话键解析 agent ID
 * @param {string} sessionKey - 会话键
 * @returns {string} agent ID
 */
function resolveAgentIdFromSessionKey(sessionKey) {
  // 简化版本：直接使用 sessionKey 的第一部分作为 agentId
  const parts = sessionKey.split(':').filter(Boolean)
  return parts[0] || 'default'
}

/**
 * 从作用域键解析 agent ID
 * @param {string} scopeKey - 作用域键
 * @returns {string|undefined} agent ID
 */
export function resolveSandboxAgentId(scopeKey) {
  const trimmed = scopeKey.trim()
  if (!trimmed || trimmed === 'shared') {
    return undefined
  }
  const parts = trimmed.split(':').filter(Boolean)
  if (parts[0] === 'agent' && parts[1]) {
    return parts[1]
  }
  return resolveAgentIdFromSessionKey(trimmed)
}
