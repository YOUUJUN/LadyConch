import crypto from 'crypto'

/**
 * 计算文本的 SHA256 哈希
 * @param {string} text - 要哈希的文本
 * @returns {string} 哈希值
 */
export function hashTextSha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/**
 * 计算对象的哈希值
 * @param {Object} obj - 要哈希的对象
 * @returns {string} 哈希值
 */
export function hashObject(obj) {
  const json = JSON.stringify(obj, Object.keys(obj).sort())
  return hashTextSha256(json)
}
