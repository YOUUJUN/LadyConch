import { Agent } from '@mariozechner/pi-agent-core'
import { getModel } from '@mariozechner/pi-ai'
import SkillRunner from '../../skills/skill-runner.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Agent 管理器 - 基于 pi-agent-core 实现
 * 支持 skills 调用和工具执行
 */
class AgentManager {
	constructor(config = {}) {
		this.config = {
			provider: config.provider || 'anthropic',
			modelId: config.modelId || 'claude-sonnet-4-20250514',
			apiKey: config.apiKey,
			baseUrl: config.baseUrl,
			systemPrompt: config.systemPrompt || 'You are a helpful assistant.',
			temperature: config.temperature ?? 0.7,
			maxTokens: config.maxTokens ?? 4096,
			thinking: config.thinking || { enabled: false },
			skillsDir: config.skillsDir || path.join(__dirname, '../skills'),
			maxToolCalls: config.maxToolCalls ?? 10,
			...config,
		}

		// 初始化 skill runner
		this.skillRunner = new SkillRunner({
			skillsDir: this.config.skillsDir,
		})

		// 创建模型
		this.model = this._createModel()

		// 初始化 agent
		this.agent = null
		this.tools = []
		this.eventHandlers = []
		this.isRunning = false
		this.toolExecutionCount = 0
	}

	/**
	 * 创建模型实例
	 * @private
	 */
	_createModel() {
		const { provider, modelId, apiKey, baseUrl } = this.config

		if (provider === 'ollama') {
			return {
				id: modelId,
				name: modelId,
				api: 'openai-completions',
				provider: 'openai',
				baseUrl: baseUrl || 'http://localhost:11434/v1',
				reasoning: false,
				input: ['text'],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 128000,
				maxTokens: 32000,
				headers: {
					Authorization: 'Bearer ollama',
				},
			}
		}

		return getModel(provider, modelId, {
			apiKey,
			baseUrl,
		})
	}

	/**
	 * 初始化 agent
	 */
	async initialize() {
		// 加载所有 skills
		await this.skillRunner.loadAllSkills()

		// 注册默认工具
		this._registerDefaultTools()

		// 创建 agent 实例
		this.agent = new Agent({
			initialState: {
				systemPrompt: this.config.systemPrompt,
				model: this.model,
				tools: this.tools,
				temperature: this.config.temperature,
				maxTokens: this.config.maxTokens,
				thinking: this.config.thinking,
			},
		})

		// 订阅事件
		this.agent.subscribe((event) => {
			this._handleEvent(event)
		})

		return this
	}

	/**
	 * 注册默认工具
	 * @private
	 */
	_registerDefaultTools() {
		// 文件读取工具
		this.addTool({
			name: 'read_file',
			description: 'Read the contents of a file',
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description: 'The path to the file to read',
					},
				},
				required: ['path'],
			},
			execute: async (args) => {
				const fs = await import('fs/promises')
				try {
					const content = await fs.readFile(args.path, 'utf-8')
					return { success: true, content }
				} catch (error) {
					return { success: false, error: error.message }
				}
			},
		})

		// 文件写入工具
		this.addTool({
			name: 'write_file',
			description: 'Write content to a file',
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description: 'The path to the file to write',
					},
					content: {
						type: 'string',
						description: 'The content to write to the file',
					},
				},
				required: ['path', 'content'],
			},
			execute: async (args) => {
				const fs = await import('fs/promises')
				try {
					await fs.writeFile(args.path, args.content, 'utf-8')
					return { success: true, message: 'File written successfully' }
				} catch (error) {
					return { success: false, error: error.message }
				}
			},
		})

		// Bash 命令执行工具
		this.addTool({
			name: 'bash',
			description: 'Execute a bash command',
			parameters: {
				type: 'object',
				properties: {
					command: {
						type: 'string',
						description: 'The bash command to execute',
					},
				},
				required: ['command'],
			},
			execute: async (args) => {
				const { exec } = await import('child_process')
				const { promisify } = await import('util')
				const execAsync = promisify(exec)

				try {
					const { stdout, stderr } = await execAsync(args.command)
					return {
						success: true,
						stdout,
						stderr,
					}
				} catch (error) {
					return {
						success: false,
						error: error.message,
						stdout: error.stdout,
						stderr: error.stderr,
					}
				}
			},
		})

		// Skill 执行工具
		this.addTool({
			name: 'execute_skill',
			description: 'Execute a loaded skill by name',
			parameters: {
				type: 'object',
				properties: {
					skillName: {
						type: 'string',
						description: 'The name of the skill to execute',
					},
					context: {
						type: 'object',
						description: 'Context data to pass to the skill',
					},
				},
				required: ['skillName'],
			},
			execute: async (args) => {
				try {
					const skill = this.skillRunner.getSkill(args.skillName)
					if (!skill) {
						return {
							success: false,
							error: `Skill '${args.skillName}' not found`,
						}
					}

					return {
						success: true,
						skill: {
							name: skill.name,
							description: skill.description,
							body: skill.body,
						},
						context: args.context || {},
					}
				} catch (error) {
					return {
						success: false,
						error: error.message,
					}
				}
			},
		})

		// 列出可用 skills
		this.addTool({
			name: 'list_skills',
			description: 'List all available skills',
			parameters: {
				type: 'object',
				properties: {},
			},
			execute: async () => {
				const skills = this.skillRunner.listSkills()
				return {
					success: true,
					skills: skills.map((s) => ({
						name: s.name,
						description: s.description,
					})),
					count: skills.length,
				}
			},
		})
	}

	/**
	 * 添加自定义工具
	 * @param {Object} tool - 工具定义
	 */
	addTool(tool) {
		if (!tool.name || !tool.description || !tool.parameters || !tool.execute) {
			throw new Error('Invalid tool definition')
		}

		// 包装执行函数以处理工具调用计数
		const originalExecute = tool.execute
		tool.execute = async (args) => {
			this.toolExecutionCount++
			if (this.toolExecutionCount > this.config.maxToolCalls) {
				throw new Error(`Maximum tool calls (${this.config.maxToolCalls}) exceeded`)
			}
			return await originalExecute(args)
		}

		this.tools.push(tool)
	}

	/**
	 * 发送消息给 agent
	 * @param {string} message - 用户消息
	 * @returns {Promise<Object>} agent 响应
	 */
	async prompt(message) {
		if (!this.agent) {
			throw new Error('Agent not initialized. Call initialize() first.')
		}

		this.isRunning = true
		this.toolExecutionCount = 0

		try {
			await this.agent.prompt(message)
			return this._getLastAssistantMessage()
		} finally {
			this.isRunning = false
		}
	}

	/**
	 * 处理 agent 事件
	 * @private
	 */
	_handleEvent(event) {
		// 触发所有注册的事件处理器
		this.eventHandlers.forEach((handler) => {
			try {
				handler(event)
			} catch (error) {
				console.error('Event handler error:', error)
			}
		})
	}

	/**
	 * 订阅 agent 事件
	 * @param {Function} handler - 事件处理函数
	 */
	subscribe(handler) {
		this.eventHandlers.push(handler)
		return () => {
			const index = this.eventHandlers.indexOf(handler)
			if (index > -1) {
				this.eventHandlers.splice(index, 1)
			}
		}
	}

	/**
	 * 获取最后一条助手消息
	 * @private
	 */
	_getLastAssistantMessage() {
		const messages = this.agent.getState().messages
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === 'assistant') {
				return messages[i]
			}
		}
		return null
	}

	/**
	 * 获取对话历史
	 */
	getMessages() {
		return this.agent ? this.agent.getState().messages : []
	}

	/**
	 * 重置对话
	 */
	reset() {
		if (this.agent) {
			this.agent.setState({
				systemPrompt: this.config.systemPrompt,
				messages: [],
			})
		}
		this.toolExecutionCount = 0
	}

	/**
	 * 更新系统提示词
	 */
	updateSystemPrompt(systemPrompt) {
		this.config.systemPrompt = systemPrompt
		if (this.agent) {
			this.agent.setState({
				systemPrompt,
			})
		}
	}

	/**
	 * 获取当前状态
	 */
	getState() {
		return this.agent ? this.agent.getState() : null
	}

	/**
	 * 停止当前运行
	 */
	stop() {
		this.isRunning = false
		// pi-agent-core 不直接支持中止，需要在工具执行中检查 isRunning
	}
}

export default AgentManager
