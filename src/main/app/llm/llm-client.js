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
}

export default LLMClient
