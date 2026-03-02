import { getModel, complete, stream, getProviders, StringEnum } from '@mariozechner/pi-ai'
import { v1 as uuidv1 } from 'uuid'

class LLMClient {
	config = {
		temperature: 0.7,
		maxTokens: 4096,
		topP: 1.0,
		thinking: { enabled: false },
		parallelToolCalls: true,
	}
	model = null
	context = { messages: [] }
	usageHistory = []
	//工具调用次数
	toolExecutionCount = 0
	//最多工具调用次数
	maxToolCalls = 10

	constructor(config) {
		this.config = {
			...config,
		}

		this.model = this._createModel()
		console.log('this.model', this.model)
	}

	_createModel() {
		const { provider, modelId, apiKey, baseUrl, metadata } = this.config

		let model = null

		if (this.config.provider === 'ollama') {
			// 定义本地 Ollama 模型
			model = {
				id: modelId,
				name: modelId,
				api: 'openai-completions', // 使用 OpenAI 兼容 API
				provider: 'openai',
				baseUrl, // Ollama 默认地址
				reasoning: false,
				input: ['text'],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, // 本地模型无费用
				contextWindow: 128000,
				maxTokens: 32000,
				headers: {
					Authorization: 'Bearer ollama',
				},
			}
		} else {
			model = getModel(provider, modelId, {
				apiKey,
				baseUrl,
				...(metadata && { metadata }),
			})
		}

		return model
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
		const id = uuidv1()
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
				tools: options.useTools || undefined,
				toolChoice: options.useTools ? (options.toolChoice ?? 'auto') : undefined,
				parallelToolCalls: this.config.parallelToolCalls,
				signal: options.abortSignal,
				apiKey: this.config.apiKey,
			}

			if (this.config.thinking?.enabled) {
				completionOptions.thinking = {
					level: this.config.thinking.level,
					budgetTokens: this.config.thinking.budgetTokens,
				}
			}

			const response = await complete(this.model, this.context, completionOptions)
			console.log('response', response)

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
			apiKey: this.config.apiKey,
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
			console.log('streamIterator', streamIterator)

			for await (const event of streamIterator) {
				console.log('event', event.type)

				switch (event.type) {
					case 'text_delta': // ✅ 文本增量
						fullContent += event.delta
						options.onToken?.(event.delta)
						yield { type: 'token', content: event.delta }
						break

					case 'thinking_delta': // ✅ 思考增量
						reasoningContent += event.delta
						options.onThinking?.(event.delta)
						yield { type: 'reasoning', content: event.delta }
						break

					case 'toolcall_start': // ✅ 工具调用开始
						currentToolCall = {
							id: event.partial.content[event.contentIndex]?.id,
							name: event.partial.content[event.contentIndex]?.name,
							arguments: '',
						}
						break

					case 'toolcall_delta': // ✅ 工具调用增量
						if (currentToolCall) {
							currentToolCall.arguments += event.delta
						}
						break

					case 'toolcall_end': // ✅ 工具调用结束
						if (currentToolCall) {
							toolCalls.push(currentToolCall)
							options.onToolCall?.(currentToolCall)
							yield { type: 'toolCall', toolCall: currentToolCall }
						}
						currentToolCall = null
						break

					case 'done': // ✅ 完成
						yield { type: 'finish', reason: event.reason }
						break

					case 'error': // ✅ 错误
						throw new Error(event.error.errorMessage)

					case 'start':
					case 'text_start':
					case 'text_end':
					case 'thinking_start':
					case 'thinking_end':
						// 可选：处理这些事件
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
}

export default LLMClient
