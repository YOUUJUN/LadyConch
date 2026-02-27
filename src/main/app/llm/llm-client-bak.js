// llm-client.js
// 基于 @mariozechner/pi-ai@0.55.0 的 JavaScript 实现

import {
	getModel,
	complete,
	stream,
	getAvailableModels,
	getAvailableProviders,
	StringEnum,
	Type,
} from '@mariozechner/pi-ai'

// ==========================================
// 1. 工具定义（使用 TypeBox）
// ==========================================

const WeatherSchema = Type.Object({
	location: Type.String({ description: '城市名称，如：北京、上海' }),
	units: Type.Optional(StringEnum(['celsius', 'fahrenheit'], { default: 'celsius' })),
})

const ReadFileSchema = Type.Object({
	path: Type.String({ description: '文件路径' }),
	encoding: Type.Optional(Type.String({ default: 'utf-8' })),
})

const WebSearchSchema = Type.Object({
	query: Type.String({ description: '搜索关键词' }),
	num_results: Type.Optional(Type.Number({ default: 5, description: '返回结果数量' })),
})

const ExecuteCodeSchema = Type.Object({
	language: StringEnum(['javascript', 'python', 'typescript', 'bash']),
	code: Type.String({ description: '要执行的代码' }),
	timeout: Type.Optional(Type.Number({ default: 30000 })),
})

// 工具集合
const TOOLS = [
	{
		name: 'get_weather',
		description: '获取指定城市的当前天气信息',
		parameters: WeatherSchema,
	},
	{
		name: 'read_file',
		description: '读取本地文件内容',
		parameters: ReadFileSchema,
	},
	{
		name: 'web_search',
		description: '搜索网络获取最新信息',
		parameters: WebSearchSchema,
	},
	{
		name: 'execute_code',
		description: '在沙箱环境中执行代码',
		parameters: ExecuteCodeSchema,
	},
]

// ==========================================
// 2. LLM Client 类
// ==========================================

class LLMClient {
	/**
	 * @param {Object} config
	 * @param {string} config.provider - 提供商名称
	 * @param {string} config.modelId - 模型ID
	 * @param {string} [config.apiKey] - API密钥
	 * @param {string} [config.baseUrl] - 自定义基础URL
	 * @param {number} [config.temperature=0.7] - 温度参数
	 * @param {number} [config.maxTokens=4096] - 最大token数
	 * @param {number} [config.topP=1.0] - top-p采样
	 * @param {Object} [config.thinking] - 思考模式配置
	 * @param {boolean} config.thinking.enabled - 是否启用思考
	 * @param {'low'|'medium'|'high'} [config.thinking.level] - 思考级别
	 * @param {number} [config.thinking.budgetTokens] - 思考token预算
	 * @param {boolean} [config.parallelToolCalls=true] - 是否并行工具调用
	 * @param {Object} [config.metadata] - 额外元数据
	 */
	constructor(config) {
		this.config = {
			temperature: 0.7,
			maxTokens: 4096,
			topP: 1.0,
			thinking: { enabled: false },
			parallelToolCalls: true,
			...config,
		}

		this.model = getModel(config.provider, config.modelId, {
			apiKey: config.apiKey,
			baseUrl: config.baseUrl,
			...(config.metadata && { metadata: config.metadata }),
		})

		this.context = { messages: [] }
		this.usageHistory = []
		this.toolExecutionCount = 0
		this.maxToolCalls = 10
	}

	/**
	 * 获取模型信息
	 * @returns {Object}
	 */
	getModelInfo() {
		return {
			provider: this.config.provider,
			modelId: this.config.modelId,
			supportsTools: true,
			supportsStreaming: true,
			supportsThinking: ['anthropic', 'openai'].includes(this.config.provider),
			config: this.config,
		}
	}

	/**
	 * 重置上下文
	 * @param {string} [systemPrompt] - 系统提示词
	 */
	resetContext(systemPrompt) {
		this.context = {
			messages: systemPrompt
				? [{ id: 'system-1', role: 'system', content: systemPrompt, createdAt: Date.now() }]
				: [],
		}
		this.toolExecutionCount = 0
	}

	/**
	 * 添加消息到上下文
	 * @param {'user'|'assistant'|'system'|'tool'} role - 消息角色
	 * @param {string} content - 消息内容
	 * @param {Object} [metadata] - 额外元数据
	 * @returns {string} 消息ID
	 */
	addMessage(role, content, metadata = {}) {
		const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		const message = {
			id,
			role,
			content,
			createdAt: Date.now(),
			...metadata,
		}
		this.context.messages.push(message)
		return id
	}

	/**
	 * 更新消息
	 * @param {string} id - 消息ID
	 * @param {Object} updates - 更新内容
	 */
	updateMessage(id, updates) {
		const index = this.context.messages.findIndex((m) => m.id === id)
		if (index !== -1) {
			this.context.messages[index] = { ...this.context.messages[index], ...updates }
		}
	}

	/**
	 * 删除消息
	 * @param {string} id - 消息ID
	 */
	removeMessage(id) {
		this.context.messages = this.context.messages.filter((m) => m.id !== id)
	}

	/**
	 * 获取上下文长度（估算token数）
	 * @returns {number}
	 */
	getContextLength() {
		const text = this.context.messages.map((m) => m.content).join('')
		return Math.ceil(text.length / 4)
	}

	/**
	 * 清理旧消息，保留最近N条
	 * @param {number} [keepLast=10] - 保留的消息数
	 */
	trimContext(keepLast = 10) {
		if (this.context.messages.length > keepLast) {
			const systemMessages = this.context.messages.filter((m) => m.role === 'system')
			const otherMessages = this.context.messages.filter((m) => m.role !== 'system')
			const recentMessages = otherMessages.slice(-keepLast)
			this.context.messages = [...systemMessages, ...recentMessages]
		}
	}

	/**
	 * 非流式对话
	 * @param {string} userMessage - 用户消息
	 * @param {Object} [options={}]
	 * @param {string} [options.systemPrompt] - 系统提示词
	 * @param {boolean} [options.useTools] - 是否使用工具
	 * @param {'auto'|'none'|'required'|Object} [options.toolChoice='auto'] - 工具选择策略
	 * @param {number} [options.maxToolCalls=10] - 最大工具调用次数
	 * @param {AbortSignal} [options.abortSignal] - 中止信号
	 * @returns {Promise<Object>}
	 */
	async chat(userMessage, options = {}) {
		this.addMessage('user', userMessage)

		if (options.systemPrompt && !this.context.messages.find((m) => m.role === 'system')) {
			this.context.messages.unshift({
				id: 'system-init',
				role: 'system',
				content: options.systemPrompt,
				createdAt: Date.now(),
			})
		}

		this.maxToolCalls = options.maxToolCalls ?? 10
		this.toolExecutionCount = 0

		return this._executeCompletion(options)
	}

	/**
	 * 内部：执行completion循环
	 * @private
	 */
	async _executeCompletion(options) {
		try {
			const completionOptions = {
				temperature: this.config.temperature,
				maxTokens: this.config.maxTokens,
				topP: this.config.topP,
				tools: options.useTools ? TOOLS : undefined,
				toolChoice: options.useTools ? (options.toolChoice ?? 'auto') : undefined,
				parallelToolCalls: this.config.parallelToolCalls,
				signal: options.abortSignal,
			}

			if (this.config.thinking?.enabled) {
				completionOptions.thinking = {
					level: this.config.thinking.level,
					budgetTokens: this.config.thinking.budgetTokens,
				}
			}

			const response = await complete(this.model, this.context, completionOptions)

			if (response.usage) {
				this.usageHistory.push(response.usage)
			}

			// 处理工具调用
			if (response.toolCalls && response.toolCalls.length > 0) {
				if (this.toolExecutionCount >= this.maxToolCalls) {
					throw new Error(`工具调用次数超过限制 (${this.maxToolCalls})`)
				}

				this.toolExecutionCount += response.toolCalls.length

				this.addMessage('assistant', response.content, {
					toolCalls: response.toolCalls,
					reasoning: response.reasoning,
				})

				const toolResults = await Promise.all(
					response.toolCalls.map(async (toolCall) => {
						const result = await this._executeTool(toolCall)
						return {
							toolCallId: toolCall.id,
							name: toolCall.name,
							result,
						}
					}),
				)

				for (const { toolCallId, result } of toolResults) {
					this.addMessage('tool', JSON.stringify(result), { toolCallId })
				}

				const finalResponse = await this._executeCompletion({ ...options, useTools: false })
				return {
					...finalResponse,
					toolCalls: response.toolCalls,
					toolResults: toolResults.map((r) => r.result),
				}
			}

			this.addMessage('assistant', response.content, {
				reasoning: response.reasoning,
				finishReason: response.finishReason,
			})

			return {
				content: response.content,
				reasoning: response.reasoning,
				usage: response.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
				finishReason: response.finishReason ?? 'stop',
			}
		} catch (error) {
			if (error.name === 'AbortError') {
				throw new Error('请求被用户取消')
			}
			console.error('Completion error:', error)
			throw error
		}
	}

	/**
	 * 流式对话（异步生成器）
	 * @param {string} userMessage - 用户消息
	 * @param {Object} [options={}]
	 * @param {string} [options.systemPrompt] - 系统提示词
	 * @param {boolean} [options.useTools] - 是否使用工具
	 * @param {Function} [options.onToken] - 收到token时的回调
	 * @param {Function} [options.onThinking] - 收到思考内容时的回调
	 * @param {Function} [options.onToolCall] - 收到工具调用时的回调
	 * @param {Function} [options.onUsage] - 收到使用量时的回调
	 * @param {number} [options.maxToolCalls=10] - 最大工具调用次数
	 * @param {AbortSignal} [options.abortSignal] - 中止信号
	 */
	async *streamChat(userMessage, options = {}) {
		this.addMessage('user', userMessage)

		if (options.systemPrompt) {
			this.context.messages.unshift({
				id: 'system-init',
				role: 'system',
				content: options.systemPrompt,
				createdAt: Date.now(),
			})
		}

		this.maxToolCalls = options.maxToolCalls ?? 10
		this.toolExecutionCount = 0

		yield* this._executeStream(options)
	}

	/**
	 * 内部：执行流式循环
	 * @private
	 */
	async *_executeStream(options) {
		const streamOptions = {
			temperature: this.config.temperature,
			maxTokens: this.config.maxTokens,
			topP: this.config.topP,
			tools: options.useTools ? TOOLS : undefined,
			toolChoice: options.useTools ? (options.toolChoice ?? 'auto') : undefined,
			signal: options.abortSignal,
		}

		if (this.config.thinking?.enabled) {
			streamOptions.thinking = {
				level: this.config.thinking.level,
				budgetTokens: this.config.thinking.budgetTokens,
			}
		}

		let fullContent = ''
		let reasoningContent = ''
		const toolCalls = []
		let currentToolCall = null
		let usage = null

		try {
			const streamIterator = stream(this.model, this.context, streamOptions)

			for await (const event of streamIterator) {
				switch (event.type) {
					case 'content':
						fullContent += event.content
						options.onToken?.(event.content)
						yield { type: 'token', content: event.content }
						break

					case 'reasoning':
						reasoningContent += event.content
						options.onThinking?.(event.content)
						yield { type: 'reasoning', content: event.content }
						break

					case 'toolCallStart':
						currentToolCall = {
							id: event.toolCallId,
							name: event.toolCallName,
							arguments: '',
						}
						break

					case 'toolCallDelta':
						if (currentToolCall) {
							currentToolCall.arguments = (currentToolCall.arguments || '') + event.argumentsDelta
						}
						break

					case 'toolCallEnd':
						if (currentToolCall) {
							toolCalls.push(currentToolCall)
							options.onToolCall?.(currentToolCall)
							yield { type: 'toolCall', toolCall: currentToolCall }
						}
						currentToolCall = null
						break

					case 'usage':
						usage = event.usage
						options.onUsage?.(event.usage)
						yield { type: 'usage', usage: event.usage }
						break

					case 'finish':
						yield { type: 'finish', reason: event.finishReason }
						break
				}
			}

			// 处理工具调用
			if (toolCalls.length > 0) {
				if (this.toolExecutionCount >= this.maxToolCalls) {
					throw new Error('工具调用次数超过限制')
				}

				this.toolExecutionCount += toolCalls.length

				this.addMessage('assistant', fullContent, {
					toolCalls,
					reasoning: reasoningContent || undefined,
				})

				for (const toolCall of toolCalls) {
					const result = await this._executeTool(toolCall)
					this.addMessage('tool', JSON.stringify(result), { toolCallId: toolCall.id })
					yield { type: 'toolResult', toolCallId: toolCall.id, result }
				}

				yield* this._executeStream({ ...options, useTools: false })
			} else {
				this.addMessage('assistant', fullContent, {
					reasoning: reasoningContent || undefined,
				})

				if (usage) {
					this.usageHistory.push(usage)
				}
			}
		} catch (error) {
			if (error.name === 'AbortError') {
				console.log('Stream aborted by user')
				return
			}
			throw error
		}
	}

	/**
	 * 执行工具
	 * @private
	 */
	async _executeTool(toolCall) {
		const { name, arguments: argsStr } = toolCall
		let args = {}

		try {
			args = JSON.parse(argsStr)
		} catch {
			args = {}
		}

		console.log(`🔧 执行工具: ${name}`, args)

		switch (name) {
			case 'get_weather': {
				const { location, units = 'celsius' } = args
				return {
					location,
					temperature: Math.floor(Math.random() * 30) + 10,
					condition: ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)],
					humidity: `${Math.floor(Math.random() * 40) + 40}%`,
					units,
					timestamp: new Date().toISOString(),
				}
			}

			case 'read_file': {
				const { path, encoding = 'utf-8' } = args
				try {
					const fs = await import('fs/promises')
					const content = await fs.readFile(path, encoding)
					return {
						success: true,
						path,
						size: content.length,
						content: content.substring(0, 5000),
						truncated: content.length > 5000,
					}
				} catch (error) {
					return {
						success: false,
						path,
						error: error.message,
					}
				}
			}

			case 'web_search': {
				const { query, num_results = 5 } = args
				return {
					query,
					results: Array.from({ length: num_results }, (_, i) => ({
						title: `搜索结果 ${i + 1} for "${query}"`,
						url: `https://example.com/result-${i + 1}`,
						snippet: `这是关于 ${query} 的模拟搜索结果摘要...`,
					})),
					total_results: num_results,
					search_time: '0.32s',
				}
			}

			case 'execute_code': {
				const { language, code, timeout = 30000 } = args
				return {
					success: true,
					language,
					executed: false,
					message: '代码执行功能需要在沙箱环境中启用',
					code_preview: code.substring(0, 100) + (code.length > 100 ? '...' : ''),
				}
			}

			default:
				return { error: `未知工具: ${name}` }
		}
	}

	/**
	 * 获取使用统计
	 * @returns {Object}
	 */
	getUsageStats() {
		const total = this.usageHistory.reduce(
			(acc, u) => ({
				promptTokens: acc.promptTokens + u.promptTokens,
				completionTokens: acc.completionTokens + u.completionTokens,
				totalTokens: acc.totalTokens + u.totalTokens,
				costUsd: acc.costUsd + (u.costUsd || 0),
			}),
			{ promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
		)

		return {
			totalCalls: this.usageHistory.length,
			...total,
			averageCostPerCall: this.usageHistory.length > 0 ? total.costUsd / this.usageHistory.length : 0,
			history: this.usageHistory,
		}
	}

	/**
	 * 导出会话
	 * @returns {Object}
	 */
	exportSession() {
		return {
			config: { ...this.config },
			messages: [...this.context.messages],
			usage: [...this.usageHistory],
		}
	}

	/**
	 * 导入会话
	 * @param {Object} session
	 */
	importSession(session) {
		if (session.config) {
			this.config = { ...this.config, ...session.config }
		}
		this.context = { messages: [...session.messages] }
		if (session.usage) {
			this.usageHistory = [...session.usage]
		}
	}

	/**
	 * 克隆客户端
	 * @returns {LLMClient}
	 */
	clone() {
		const newClient = new LLMClient(this.config)
		newClient.importSession({
			messages: this.context.messages,
			usage: this.usageHistory,
		})
		return newClient
	}
}

// ==========================================
// 3. 多模型路由器
// ==========================================

class LLMRouter {
	constructor() {
		this.clients = new Map()
		this.routes = new Map()
		this.defaultRouteId = null
	}

	/**
	 * 注册模型路由
	 * @param {Object} route
	 * @param {string} route.id - 路由ID
	 * @param {Object} route.config - 客户端配置
	 * @param {number} route.priority - 优先级
	 */
	register(route) {
		this.clients.set(route.id, new LLMClient(route.config))
		this.routes.set(route.id, route)

		if (!this.defaultRouteId || route.priority > (this.routes.get(this.defaultRouteId)?.priority ?? 0)) {
			this.defaultRouteId = route.id
		}
	}

	/**
	 * 获取客户端
	 * @param {string} [routeId] - 路由ID
	 * @returns {LLMClient}
	 */
	getClient(routeId) {
		const id = routeId || this.defaultRouteId
		if (!id || !this.clients.has(id)) {
			throw new Error(`Route ${id} not found`)
		}
		return this.clients.get(id)
	}

	/**
	 * 根据任务类型路由
	 * @param {'coding'|'analysis'|'creative'|'chat'} task - 任务类型
	 * @returns {LLMClient}
	 */
	routeByTask(task) {
		const routeMap = {
			coding: ['claude-opus', 'gpt-4', 'claude-sonnet'],
			analysis: ['claude-sonnet', 'gpt-4', 'claude-opus'],
			creative: ['gpt-4', 'claude-sonnet'],
			chat: ['claude-haiku', 'gpt-3.5', 'groq-llama'],
		}

		const preferred = routeMap[task] || []
		for (const routeId of preferred) {
			if (this.clients.has(routeId)) {
				return this.clients.get(routeId)
			}
		}
		return this.getClient()
	}

	/**
	 * 会话迁移
	 * @param {string} fromId - 源路由ID
	 * @param {string} toId - 目标路由ID
	 * @param {Function} [transform] - 消息转换函数
	 */
	async handoff(fromId, toId, transform) {
		const fromClient = this.getClient(fromId)
		const toClient = this.getClient(toId)

		let messages = fromClient.exportSession().messages

		if (transform) {
			messages = transform(messages)
		}

		toClient.importSession({ messages })

		console.log(`🚀 会话从 ${fromId} 迁移至 ${toId}`)
		console.log(`   携带消息数: ${messages.length}`)

		return toClient
	}

	/**
	 * 并行查询多个模型
	 * @param {string} message - 查询消息
	 * @param {string[]} routeIds - 路由ID数组
	 * @param {Object} [options] - 查询选项
	 * @returns {Promise<Array>}
	 */
	async parallelQuery(message, routeIds, options) {
		const results = await Promise.all(
			routeIds.map(async (id) => {
				const start = Date.now()
				const client = this.getClient(id)
				const clone = client.clone()
				const response = await clone.chat(message, options)
				return {
					routeId: id,
					response,
					latency: Date.now() - start,
				}
			}),
		)
		return results
	}

	/**
	 * 列出所有路由
	 * @returns {string[]}
	 */
	listRoutes() {
		return Array.from(this.routes.keys())
	}
}

// ==========================================
// 4. 使用示例
// ==========================================

async function main() {
	console.log('🚀 LLM Client Demo (JavaScript + pi-ai@0.55.0)\n')

	// 查看可用资源
	console.log('可用提供商:', getAvailableProviders())
	console.log('可用模型数:', getAvailableModels().length)

	// 示例 1: 基础对话
	console.log('\n=== 示例 1: 基础对话 ===')
	const client = new LLMClient({
		provider: 'anthropic',
		modelId: 'claude-sonnet-4-20250514',
		temperature: 0.7,
		maxTokens: 2048,
	})

	const resp1 = await client.chat('你好，请用一句话介绍量子计算', {
		systemPrompt: '你是量子物理专家，回答简洁专业。',
	})
	console.log('回答:', resp1.content)
	console.log('Token 使用:', resp1.usage)

	// 示例 2: 工具调用
	console.log('\n=== 示例 2: 工具调用 ===')
	const client2 = new LLMClient({
		provider: 'anthropic',
		modelId: 'claude-sonnet-4-20250514',
		temperature: 0.5,
	})

	const resp2 = await client2.chat('北京和上海今天天气怎么样？适合出门吗？', {
		systemPrompt: '你是天气助手，使用工具获取实时天气。',
		useTools: true,
		maxToolCalls: 3,
	})
	console.log('回答:', resp2.content)
	if (resp2.toolCalls) {
		console.log(
			'调用的工具:',
			resp2.toolCalls.map((t) => t.name),
		)
	}

	// 示例 3: 流式输出 + 推理内容
	console.log('\n=== 示例 3: 流式输出 + 推理 ===')
	const client3 = new LLMClient({
		provider: 'anthropic',
		modelId: 'claude-opus-4-20250514',
		thinking: {
			enabled: true,
			level: 'high',
			budgetTokens: 2000,
		},
	})

	process.stdout.write('🤔 推理过程: ')
	let hasReasoning = false

	for await (const event of client3.streamChat(
		'解决这个数学问题：如果有 3 个苹果，吃掉 1 个，再买 2 个，最后有几个？',
		{
			systemPrompt: '请展示你的推理过程。',
		},
	)) {
		if (event.type === 'reasoning') {
			hasReasoning = true
			process.stdout.write(event.content)
		} else if (event.type === 'token') {
			if (hasReasoning) {
				process.stdout.write('\n💡 答案: ')
				hasReasoning = false
			}
			process.stdout.write(event.content)
		}
	}
	console.log('\n')

	// 示例 4: 使用 AbortController 取消请求
	console.log('\n=== 示例 4: 取消请求 ===')
	const abortController = new AbortController()

	// 3秒后取消
	setTimeout(() => {
		console.log('⏹️  取消请求...')
		abortController.abort()
	}, 3000)

	try {
		for await (const event of client.streamChat('写一个很长的故事', {
			abortSignal: abortController.signal,
		})) {
			if (event.type === 'token') {
				process.stdout.write(event.content)
			}
		}
	} catch (error) {
		console.log('\n❌ 请求已取消:', error.message)
	}

	// 示例 5: 多模型路由
	console.log('\n=== 示例 5: 多模型路由 ===')
	const router = new LLMRouter()

	router.register({
		id: 'claude-sonnet',
		config: {
			provider: 'anthropic',
			modelId: 'claude-sonnet-4-20250514',
		},
		priority: 2,
	})

	router.register({
		id: 'gpt-4',
		config: {
			provider: 'openai',
			modelId: 'gpt-4.1',
		},
		priority: 1,
	})

	// 根据任务类型自动选择
	const codingClient = router.routeByTask('coding')
	console.log('编程任务选择:', codingClient.getModelInfo().modelId)

	// 并行对比
	console.log('\n=== 示例 6: 并行对比 ===')
	const comparisons = await router.parallelQuery('解释什么是区块链', ['claude-sonnet', 'gpt-4'], {
		systemPrompt: '用一句话解释。',
	})

	comparisons.forEach(({ routeId, response, latency }) => {
		console.log(`${routeId} (${latency}ms): ${response.content.substring(0, 100)}...`)
	})

	// 示例 7: 会话迁移
	console.log('\n=== 示例 7: 会话迁移 ===')
	const claudeClient = router.getClient('claude-sonnet')
	await claudeClient.chat('我们正在讨论 Node.js 的异步编程模型。')
	await claudeClient.chat('Promise 和 async/await 有什么区别？')

	// 迁移到 GPT-4 继续讨论
	await router.handoff('claude-sonnet', 'gpt-4', (messages) => {
		return messages.slice(-5) // 只保留最近 5 条
	})

	const gptClient = router.getClient('gpt-4')
	const handoffResp = await gptClient.chat('基于上面的讨论，给我一些最佳实践建议。')
	console.log('迁移后继续:', handoffResp.content)

	// 统计信息
	console.log('\n=== 使用统计 ===')
	console.log('Client 1 统计:', client.getUsageStats())
	console.log('Client 2 统计:', client2.getUsageStats())
}

// 运行
main().catch(console.error)

// 导出模块
export { LLMClient, LLMRouter, TOOLS }
