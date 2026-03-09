import fs from 'fs/promises'
import path from 'path'
import { v1 as uuidv1 } from 'uuid'

/**
 * 记忆管理器 - 基于 Markdown 文件的记忆存储系统
 */
class MemoryManager {
	constructor(config = {}) {
		this.memoryDir = config.memoryDir || path.join(process.cwd(), 'memory')
		this.indexFile = path.join(this.memoryDir, 'INDEX.md')
		this.initialized = false
	}

	/**
	 * 初始化记忆目录
	 */
	async initialize() {
		if (this.initialized) return

		try {
			await fs.mkdir(this.memoryDir, { recursive: true })

			// 创建索引文件（如果不存在）
			try {
				await fs.access(this.indexFile)
			} catch {
				await this._createIndexFile()
			}

			this.initialized = true
			console.log('记忆管理器初始化成功:', this.memoryDir)
		} catch (error) {
			console.error('记忆管理器初始化失败:', error)
			throw error
		}
	}

	/**
	 * 创建索引文件
	 * @private
	 */
	async _createIndexFile() {
		const content = `# 记忆索引

> 自动生成的记忆索引文件
> 最后更新: ${new Date().toISOString()}

## 记忆分类

### 短期记忆 (Short-term)
临时性的、会话级别的记忆

### 长期记忆 (Long-term)
持久性的、跨会话的重要记忆

### 知识库 (Knowledge)
结构化的知识和参考信息

---

## 记忆列表

`
		await fs.writeFile(this.indexFile, content, 'utf-8')
	}

	/**
	 * 保存记忆
	 * @param {Object} memory - 记忆对象
	 * @param {string} memory.content - 记忆内容
	 * @param {string} [memory.type='short-term'] - 记忆类型
	 * @param {string} [memory.category] - 分类标签
	 * @param {Array<string>} [memory.tags] - 标签列表
	 * @param {Object} [memory.metadata] - 额外元数据
	 * @returns {Promise<Object>} 保存的记忆对象
	 */
	async saveMemory(memory) {
		await this.initialize()

		const memoryId = uuidv1()
		const timestamp = new Date().toISOString()
		const type = memory.type || 'short-term'
		const category = memory.category || 'general'

		const memoryData = {
			id: memoryId,
			content: memory.content,
			type,
			category,
			tags: memory.tags || [],
			createdAt: timestamp,
			updatedAt: timestamp,
			metadata: memory.metadata || {},
		}

		// 生成文件名
		const fileName = `${type}_${category}_${memoryId.split('-')[0]}.md`
		const filePath = path.join(this.memoryDir, fileName)

		// 生成 Markdown 内容
		const markdownContent = this._generateMarkdown(memoryData)

		// 写入文件
		await fs.writeFile(filePath, markdownContent, 'utf-8')

		// 更新索引
		await this._updateIndex(memoryData, fileName)

		return { ...memoryData, filePath }
	}

	/**
	 * 生成 Markdown 内容
	 * @private
	 */
	_generateMarkdown(memory) {
		const lines = [
			`# ${memory.category}`,
			'',
			`> ID: ${memory.id}`,
			`> Type: ${memory.type}`,
			`> Created: ${memory.createdAt}`,
			`> Updated: ${memory.updatedAt}`,
			'',
		]

		if (memory.tags.length > 0) {
			lines.push(`**Tags**: ${memory.tags.map(t => `\`${t}\``).join(', ')}`)
			lines.push('')
		}

		lines.push('## 内容')
		lines.push('')
		lines.push(memory.content)
		lines.push('')

		if (Object.keys(memory.metadata).length > 0) {
			lines.push('## 元数据')
			lines.push('')
			lines.push('```json')
			lines.push(JSON.stringify(memory.metadata, null, 2))
			lines.push('```')
			lines.push('')
		}

		return lines.join('\n')
	}

	/**
	 * 更新索引文件
	 * @private
	 */
	async _updateIndex(memory, fileName) {
		try {
			let indexContent = await fs.readFile(this.indexFile, 'utf-8')

			// 更新时间戳
			indexContent = indexContent.replace(
				/最后更新: .*/,
				`最后更新: ${new Date().toISOString()}`
			)

			// 添加记忆条目
			const entry = `- [${memory.category}](${fileName}) - ${memory.content.substring(0, 50)}... (${memory.createdAt})`
			indexContent += `\n${entry}`

			await fs.writeFile(this.indexFile, indexContent, 'utf-8')
		} catch (error) {
			console.error('更新索引失败:', error)
		}
	}

	/**
	 * 读取记忆
	 * @param {string} memoryId - 记忆ID
	 * @returns {Promise<Object|null>} 记忆对象
	 */
	async getMemory(memoryId) {
		await this.initialize()

		const files = await fs.readdir(this.memoryDir)
		const targetFile = files.find(f => f.includes(memoryId.split('-')[0]))

		if (!targetFile) {
			return null
		}

		const filePath = path.join(this.memoryDir, targetFile)
		const content = await fs.readFile(filePath, 'utf-8')

		return this._parseMarkdown(content, filePath)
	}

	/**
	 * 解析 Markdown 内容
	 * @private
	 */
	_parseMarkdown(content, filePath) {
		const lines = content.split('\n')
		const memory = {
			filePath,
			content: '',
		}

		let inContent = false
		let inMetadata = false
		let metadataJson = ''

		for (const line of lines) {
			if (line.startsWith('> ID:')) {
				memory.id = line.replace('> ID:', '').trim()
			} else if (line.startsWith('> Type:')) {
				memory.type = line.replace('> Type:', '').trim()
			} else if (line.startsWith('> Created:')) {
				memory.createdAt = line.replace('> Created:', '').trim()
			} else if (line.startsWith('> Updated:')) {
				memory.updatedAt = line.replace('> Updated:', '').trim()
			} else if (line.startsWith('**Tags**:')) {
				const tagsStr = line.replace('**Tags**:', '').trim()
				memory.tags = tagsStr.match(/`([^`]+)`/g)?.map(t => t.replace(/`/g, '')) || []
			} else if (line === '## 内容') {
				inContent = true
			} else if (line === '## 元数据') {
				inContent = false
				inMetadata = true
			} else if (inMetadata && line.startsWith('```json')) {
				continue
			} else if (inMetadata && line.startsWith('```')) {
				inMetadata = false
				try {
					memory.metadata = JSON.parse(metadataJson)
				} catch {
					memory.metadata = {}
				}
			} else if (inMetadata) {
				metadataJson += line + '\n'
			} else if (inContent && line.trim()) {
				memory.content += line + '\n'
			}
		}

		memory.content = memory.content.trim()
		return memory
	}

	/**
	 * 搜索记忆
	 * @param {Object} query - 查询条件
	 * @param {string} [query.keyword] - 关键词
	 * @param {string} [query.type] - 记忆类型
	 * @param {string} [query.category] - 分类
	 * @param {Array<string>} [query.tags] - 标签
	 * @returns {Promise<Array>} 匹配的记忆列表
	 */
	async searchMemories(query = {}) {
		await this.initialize()

		const files = await fs.readdir(this.memoryDir)
		const memories = []

		for (const file of files) {
			if (file === 'INDEX.md' || !file.endsWith('.md')) continue

			const filePath = path.join(this.memoryDir, file)
			const content = await fs.readFile(filePath, 'utf-8')
			const memory = this._parseMarkdown(content, filePath)

			// 应用过滤条件
			if (query.type && memory.type !== query.type) continue
			if (query.category && memory.category !== query.category) continue
			if (query.tags && !query.tags.some(t => memory.tags?.includes(t))) continue
			if (query.keyword && !memory.content.toLowerCase().includes(query.keyword.toLowerCase())) continue

			memories.push(memory)
		}

		// 按时间倒序排序
		return memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
	}

	/**
	 * 更新记忆
	 * @param {string} memoryId - 记忆ID
	 * @param {Object} updates - 更新内容
	 * @returns {Promise<Object>} 更新后的记忆
	 */
	async updateMemory(memoryId, updates) {
		const memory = await this.getMemory(memoryId)
		if (!memory) {
			throw new Error(`记忆不存在: ${memoryId}`)
		}

		const updatedMemory = {
			...memory,
			...updates,
			updatedAt: new Date().toISOString(),
		}

		const markdownContent = this._generateMarkdown(updatedMemory)
		await fs.writeFile(memory.filePath, markdownContent, 'utf-8')

		return updatedMemory
	}

	/**
	 * 删除记忆
	 * @param {string} memoryId - 记忆ID
	 * @returns {Promise<boolean>} 是否成功删除
	 */
	async deleteMemory(memoryId) {
		const memory = await this.getMemory(memoryId)
		if (!memory) {
			return false
		}

		await fs.unlink(memory.filePath)
		return true
	}

	/**
	 * 列出所有记忆
	 * @param {Object} options - 选项
	 * @param {number} [options.limit] - 限制数量
	 * @param {number} [options.offset] - 偏移量
	 * @returns {Promise<Array>} 记忆列表
	 */
	async listMemories(options = {}) {
		const memories = await this.searchMemories()

		const start = options.offset || 0
		const end = options.limit ? start + options.limit : undefined

		return memories.slice(start, end)
	}

	/**
	 * 清理旧记忆
	 * @param {Object} options - 选项
	 * @param {number} [options.olderThanDays] - 删除多少天前的记忆
	 * @param {string} [options.type] - 只清理特定类型
	 * @returns {Promise<number>} 删除的记忆数量
	 */
	async cleanupMemories(options = {}) {
		const memories = await this.searchMemories({ type: options.type })
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - (options.olderThanDays || 30))

		let deletedCount = 0

		for (const memory of memories) {
			const memoryDate = new Date(memory.createdAt)
			if (memoryDate < cutoffDate) {
				await this.deleteMemory(memory.id)
				deletedCount++
			}
		}

		return deletedCount
	}

	/**
	 * 导出记忆为 JSON
	 * @returns {Promise<Array>} 所有记忆的 JSON 数组
	 */
	async exportToJson() {
		return await this.searchMemories()
	}

	/**
	 * 从 JSON 导入记忆
	 * @param {Array} memories - 记忆数组
	 * @returns {Promise<number>} 导入的记忆数量
	 */
	async importFromJson(memories) {
		let importedCount = 0

		for (const memory of memories) {
			try {
				await this.saveMemory(memory)
				importedCount++
			} catch (error) {
				console.error('导入记忆失败:', error)
			}
		}

		return importedCount
	}
}

export default MemoryManager
