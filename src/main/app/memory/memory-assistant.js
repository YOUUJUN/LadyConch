import MemoryManager from './memory-manager.js'
import LLMClient from '../llm/llm-client.js'

/**
 * 智能记忆助手 - 结合 LLM 的记忆管理
 */
class MemoryAssistant {
	constructor(memoryManager, llmClient) {
		this.memory = memoryManager
		this.llm = llmClient
	}

	/**
	 * 智能保存记忆（自动分类和标签）
	 * @param {string} content - 记忆内容
	 * @param {Object} options - 选项
	 * @returns {Promise<Object>} 保存的记忆
	 */
	async smartSave(content, options = {}) {
		// 使用 LLM 分析内容并生成分类和标签
		const systemPrompt = `你是一个记忆分类助手。分析用户的记忆内容，提供合适的分类和标签。

输出 JSON 格式：
{
  "type": "short-term|long-term|knowledge",
  "category": "分类名称",
  "tags": ["标签1", "标签2"],
  "summary": "简短摘要"
}`

		this.llm.resetContext(systemPrompt)
		const response = await this.llm.chat(`请分析以下内容：\n\n${content}`)

		let analysis
		try {
			const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/) ||
			                  response.content.match(/\{[\s\S]*\}/)
			analysis = JSON.parse(jsonMatch[1] || jsonMatch[0])
		} catch {
			// 如果解析失败，使用默认值
			analysis = {
				type: 'short-term',
				category: 'general',
				tags: [],
				summary: content.substring(0, 100),
			}
		}

		// 保存记忆
		return await this.memory.saveMemory({
			content,
			type: options.type || analysis.type,
			category: options.category || analysis.category,
			tags: options.tags || analysis.tags,
			metadata: {
				...options.metadata,
				summary: analysis.summary,
				autoClassified: true,
			},
		})
	}

	/**
	 * 智能搜索记忆（语义搜索）
	 * @param {string} query - 查询内容
	 * @param {Object} options - 选项
	 * @returns {Promise<Array>} 相关记忆列表
	 */
	async smartSearch(query, options = {}) {
		// 使用 LLM 理解查询意图
		const systemPrompt = `你是一个记忆检索助手。理解用户的查询意图，提取关键词和搜索条件。

输出 JSON 格式：
{
  "keywords": ["关键词1", "关键词2"],
  "type": "short-term|long-term|knowledge|null",
  "tags": ["标签1", "标签2"]
}`

		this.llm.resetContext(systemPrompt)
		const response = await this.llm.chat(`用户查询：${query}`)

		let searchParams
		try {
			const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/) ||
			                  response.content.match(/\{[\s\S]*\}/)
			searchParams = JSON.parse(jsonMatch[1] || jsonMatch[0])
		} catch {
			searchParams = { keywords: [query] }
		}

		// 搜索记忆
		const allMemories = await this.memory.searchMemories({
			type: searchParams.type || options.type,
			tags: searchParams.tags || options.tags,
		})

		// 使用关键词过滤
		const keywords = searchParams.keywords || [query]
		const filtered = allMemories.filter(m => {
			const text = m.content.toLowerCase()
			return keywords.some(kw => text.includes(kw.toLowerCase()))
		})

		return filtered.slice(0, options.limit || 10)
	}

	/**
	 * 生成记忆摘要
	 * @param {Object} options - 选项
	 * @param {string} [options.type] - 记忆类型
	 * @param {number} [options.days] - 最近多少天
	 * @returns {Promise<string>} 摘要内容
	 */
	async generateSummary(options = {}) {
		const memories = await this.memory.searchMemories({ type: options.type })

		// 过滤时间范围
		if (options.days) {
			const cutoffDate = new Date()
			cutoffDate.setDate(cutoffDate.getDate() - options.days)
			const filtered = memories.filter(m => new Date(m.createdAt) >= cutoffDate)
			memories.splice(0, memories.length, ...filtered)
		}

		if (memories.length === 0) {
			return '暂无记忆'
		}

		// 使用 LLM 生成摘要
		const systemPrompt = '你是一个记忆摘要助手。将多条记忆整合为简洁的摘要。'
		this.llm.resetContext(systemPrompt)

		const memoryTexts = memories.map((m, i) => `${i + 1}. ${m.content}`).join('\n')
		const response = await this.llm.chat(`请为以下记忆生成摘要：\n\n${memoryTexts}`)

		return response.content
	}

	/**
	 * 关联记忆（找出相关记忆）
	 * @param {string} memoryId - 记忆ID
	 * @param {number} [limit=5] - 返回数量
	 * @returns {Promise<Array>} 相关记忆列表
	 */
	async findRelated(memoryId, limit = 5) {
		const targetMemory = await this.memory.getMemory(memoryId)
		if (!targetMemory) {
			throw new Error('记忆不存在')
		}

		// 使用 LLM 提取关键概念
		const systemPrompt = '你是一个记忆关联助手。提取内容中的关键概念和主题。'
		this.llm.resetContext(systemPrompt)

		const response = await this.llm.chat(`提取关键概念：\n\n${targetMemory.content}`)
		const concepts = response.content.split(/[,，、\n]/).map(c => c.trim()).filter(Boolean)

		// 搜索相关记忆
		const allMemories = await this.memory.searchMemories()
		const related = []

		for (const memory of allMemories) {
			if (memory.id === memoryId) continue

			const text = memory.content.toLowerCase()
			const matchCount = concepts.filter(c => text.includes(c.toLowerCase())).length

			if (matchCount > 0) {
				related.push({ memory, relevance: matchCount })
			}
		}

		// 按相关度排序
		related.sort((a, b) => b.relevance - a.relevance)

		return related.slice(0, limit).map(r => r.memory)
	}

	/**
	 * 记忆问答
	 * @param {string} question - 问题
	 * @returns {Promise<string>} 答案
	 */
	async askMemory(question) {
		// 搜索相关记忆
		const relevantMemories = await this.smartSearch(question, { limit: 5 })

		if (relevantMemories.length === 0) {
			return '抱歉，我没有找到相关的记忆。'
		}

		// 使用 LLM 基于记忆回答问题
		const systemPrompt = '你是一个记忆问答助手。基于提供的记忆内容回答用户问题。'
		this.llm.resetContext(systemPrompt)

		const context = relevantMemories.map((m, i) => `记忆 ${i + 1}:\n${m.content}`).join('\n\n')
		const response = await this.llm.chat(`基于以下记忆回答问题：\n\n${context}\n\n问题：${question}`)

		return response.content
	}
}

export default MemoryAssistant
