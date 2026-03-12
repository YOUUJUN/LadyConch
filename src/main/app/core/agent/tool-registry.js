import fs from 'fs/promises'
import path from 'path'

/**
 * Tool 注册表 - 管理所有可用的 tools
 */
export class ToolRegistry {
	constructor() {
		this.tools = new Map()
		this.categories = new Map()
	}

	/**
	 * 注册 tool
	 * @param {Object} tool - tool 对象
	 * @param {string} tool.name - tool 名称
	 * @param {string} tool.description - tool 描述
	 * @param {Object} tool.parameters - tool 参数定义
	 * @param {Function} tool.execute - tool 执行函数
	 * @param {Object} [tool.metadata] - tool 元数据
	 */
	register(tool) {
		if (!tool.name) {
			throw new Error('Tool must have a name')
		}

		if (!tool.execute || typeof tool.execute !== 'function') {
			throw new Error('Tool must have an execute function')
		}

		// 检查是否已存在
		if (this.tools.has(tool.name)) {
			console.warn(`Tool ${tool.name} already registered, overwriting`)
		}

		this.tools.set(tool.name, tool)

		// 按类别分组
		const category = tool.metadata?.category || 'general'
		if (!this.categories.has(category)) {
			this.categories.set(category, [])
		}
		this.categories.get(category).push(tool.name)

		return tool
	}

	/**
	 * 批量注册 tools
	 * @param {Array} tools - tool 列表
	 */
	registerBatch(tools) {
		for (const tool of tools) {
			this.register(tool)
		}
	}

	/**
	 * 获取 tool
	 * @param {string} name - tool 名称
	 * @returns {Object|null} tool 对象
	 */
	get(name) {
		return this.tools.get(name) || null
	}

	/**
	 * 检查 tool 是否存在
	 * @param {string} name - tool 名称
	 * @returns {boolean}
	 */
	has(name) {
		return this.tools.has(name)
	}

	/**
	 * 移除 tool
	 * @param {string} name - tool 名称
	 * @returns {boolean} 是否成功移除
	 */
	unregister(name) {
		const tool = this.tools.get(name)
		if (!tool) {
			return false
		}

		// 从类别中移除
		const category = tool.metadata?.category || 'general'
		if (this.categories.has(category)) {
			const tools = this.categories.get(category)
			const index = tools.indexOf(name)
			if (index > -1) {
				tools.splice(index, 1)
			}
		}

		return this.tools.delete(name)
	}

	/**
	 * 获取所有 tools
	 * @returns {Array} tool 列表
	 */
	getAll() {
		return Array.from(this.tools.values())
	}

	/**
	 * 获取所有 tool 名称
	 * @returns {Array} tool 名称列表
	 */
	getAllNames() {
		return Array.from(this.tools.keys())
	}

	/**
	 * 按类别获取 tools
	 * @param {string} category - 类别名称
	 * @returns {Array} tool 列表
	 */
	getByCategory(category) {
		const toolNames = this.categories.get(category) || []
		return toolNames.map((name) => this.tools.get(name)).filter(Boolean)
	}

	/**
	 * 获取所有类别
	 * @returns {Array} 类别列表
	 */
	getCategories() {
		return Array.from(this.categories.keys())
	}

	/**
	 * 执行 tool
	 * @param {string} name - tool 名称
	 * @param {Object} params - 参数
	 * @returns {Promise<any>} 执行结果
	 */
	async execute(name, params = {}) {
		const tool = this.tools.get(name)
		if (!tool) {
			throw new Error(`Tool not found: ${name}`)
		}

		try {
			return await tool.execute(params)
		} catch (error) {
			throw new Error(`Tool execution failed (${name}): ${error.message}`)
		}
	}

	/**
	 * 转换为 pi-agent-core 格式
	 * @returns {Array} pi-agent-core 格式的 tools
	 */
	toPiAgentTools() {
		return this.getAll().map((tool) => ({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters || {
				type: 'object',
				properties: {},
			},
			execute: tool.execute,
		}))
	}

	/**
	 * 转换为 OpenAI 函数格式
	 * @returns {Array} OpenAI 函数格式的 tools
	 */
	toOpenAIFunctions() {
		return this.getAll().map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters || {
					type: 'object',
					properties: {},
				},
			},
		}))
	}

	/**
	 * 获取 tools 摘要
	 * @returns {string} tools 摘要文本
	 */
	getSummary() {
		const lines = ['# Available Tools\n']

		for (const category of this.getCategories()) {
			const tools = this.getByCategory(category)
			if (tools.length === 0) continue

			lines.push(`## ${category}\n`)
			for (const tool of tools) {
				lines.push(`- **${tool.name}**: ${tool.description}`)
			}
			lines.push('')
		}

		return lines.join('\n')
	}

	/**
	 * 清空所有 tools
	 */
	clear() {
		this.tools.clear()
		this.categories.clear()
	}

	/**
	 * 获取统计信息
	 * @returns {Object} 统计信息
	 */
	getStats() {
		return {
			totalTools: this.tools.size,
			categories: this.categories.size,
			toolsByCategory: Object.fromEntries(
				Array.from(this.categories.entries()).map(([cat, tools]) => [cat, tools.length])
			),
		}
	}
}

export default ToolRegistry
