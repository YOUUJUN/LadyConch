import SkillRunner from '../../skills/skill-runner.js'
import { SkillToToolConverter } from './skill-to-tool.js'
import ToolRegistry from './tool-registry.js'
import path from 'path'

/**
 * Agent Tool Manager - 集成 skills 和 tools 管理
 * 参考 openclaw 的架构实现
 */
export class AgentToolManager {
	constructor(config = {}) {
		this.workspace = config.workspace || process.cwd()
		this.skillsDir = config.skillsDir || path.join(this.workspace, 'skills')

		// 初始化组件
		this.skillRunner = new SkillRunner({ skillsDir: this.skillsDir })
		this.toolRegistry = new ToolRegistry()
		this.converter = new SkillToToolConverter({ skillRunner: this.skillRunner })

		// 配置
		this.autoLoadSkills = config.autoLoadSkills !== false
		this.skillFilter = config.skillFilter || null // 可选的 skill 过滤器
	}

	/**
	 * 初始化 - 加载 skills 并转换为 tools
	 */
	async initialize() {
		// 1. 加载内置 tools
		await this._loadBuiltInTools()

		// 2. 加载 skills 并转换为 tools
		if (this.autoLoadSkills) {
			await this._loadSkillsAsTools()
		}

		console.log('AgentToolManager 初始化完成')
		console.log(this.toolRegistry.getStats())
	}

	/**
	 * 加载内置 tools
	 * @private
	 */
	async _loadBuiltInTools() {
		// 注册基础文件操作 tools
		this.toolRegistry.register({
			name: 'read_file',
			description: 'Read content from a file',
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description: 'File path to read',
					},
				},
				required: ['path'],
			},
			execute: async (params) => {
				const fs = await import('fs/promises')
				try {
					const content = await fs.readFile(params.path, 'utf-8')
					return { success: true, content }
				} catch (error) {
					return { success: false, error: error.message }
				}
			},
			metadata: { category: 'filesystem' },
		})

		this.toolRegistry.register({
			name: 'write_file',
			description: 'Write content to a file',
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description: 'File path to write',
					},
					content: {
						type: 'string',
						description: 'Content to write',
					},
				},
				required: ['path', 'content'],
			},
			execute: async (params) => {
				const fs = await import('fs/promises')
				try {
					await fs.writeFile(params.path, params.content, 'utf-8')
					return { success: true, message: 'File written successfully' }
				} catch (error) {
					return { success: false, error: error.message }
				}
			},
			metadata: { category: 'filesystem' },
		})

		this.toolRegistry.register({
			name: 'execute_command',
			description: 'Execute a shell command',
			parameters: {
				type: 'object',
				properties: {
					command: {
						type: 'string',
						description: 'Command to execute',
					},
					cwd: {
						type: 'string',
						description: 'Working directory (optional)',
					},
				},
				required: ['command'],
			},
			execute: async (params) => {
				const { exec } = await import('child_process')
				const { promisify } = await import('util')
				const execAsync = promisify(exec)

				try {
					const { stdout, stderr } = await execAsync(params.command, {
						cwd: params.cwd || this.workspace,
						timeout: 30000,
					})
					return { success: true, stdout, stderr }
				} catch (error) {
					return { success: false, error: error.message, code: error.code }
				}
			},
			metadata: { category: 'system' },
		})
	}

	/**
	 * 加载 skills 并转换为 tools
	 * @private
	 */
	async _loadSkillsAsTools() {
		try {
			// 扫描 skills 目录
			await this.skillRunner.scanSkills()

			// 获取所有 skills
			let skills = Array.from(this.skillRunner.skills.values())

			// 应用过滤器
			if (this.skillFilter) {
				skills = this._filterSkills(skills)
			}

			// 转换为 tools
			const tools = this.converter.convertSkillsToTools(skills)

			// 注册到 registry
			this.toolRegistry.registerBatch(tools)

			console.log(`已加载 ${tools.length} 个 skill tools`)
		} catch (error) {
			console.error('加载 skills 失败:', error)
		}
	}

	/**
	 * 过滤 skills
	 * @private
	 */
	_filterSkills(skills) {
		if (!this.skillFilter) {
			return skills
		}

		if (typeof this.skillFilter === 'function') {
			return skills.filter(this.skillFilter)
		}

		if (Array.isArray(this.skillFilter)) {
			// 白名单模式
			return skills.filter((skill) => this.skillFilter.includes(skill.name))
		}

		return skills
	}

	/**
	 * 注册自定义 tool
	 * @param {Object} tool - tool 对象
	 */
	registerTool(tool) {
		return this.toolRegistry.register(tool)
	}

	/**
	 * 批量注册 tools
	 * @param {Array} tools - tool 列表
	 */
	registerTools(tools) {
		return this.toolRegistry.registerBatch(tools)
	}

	/**
	 * 获取 tool
	 * @param {string} name - tool 名称
	 */
	getTool(name) {
		return this.toolRegistry.get(name)
	}

	/**
	 * 获取所有 tools
	 */
	getAllTools() {
		return this.toolRegistry.getAll()
	}

	/**
	 * 获取 pi-agent-core 格式的 tools
	 */
	getPiAgentTools() {
		return this.toolRegistry.toPiAgentTools()
	}

	/**
	 * 获取 OpenAI 格式的 tools
	 */
	getOpenAITools() {
		return this.toolRegistry.toOpenAIFunctions()
	}

	/**
	 * 执行 tool
	 * @param {string} name - tool 名称
	 * @param {Object} params - 参数
	 */
	async executeTool(name, params) {
		return await this.toolRegistry.execute(name, params)
	}

	/**
	 * 重新加载 skills
	 */
	async reloadSkills() {
		// 清除现有的 skill tools
		const allTools = this.toolRegistry.getAll()
		for (const tool of allTools) {
			if (tool.metadata?.type === 'skill') {
				this.toolRegistry.unregister(tool.name)
			}
		}

		// 重新加载
		await this._loadSkillsAsTools()
	}

	/**
	 * 获取 tools 摘要
	 */
	getToolsSummary() {
		return this.toolRegistry.getSummary()
	}

	/**
	 * 获取统计信息
	 */
	getStats() {
		return {
			...this.toolRegistry.getStats(),
			skillsLoaded: this.skillRunner.skills.size,
		}
	}

	/**
	 * 构建 skill 命令规范
	 * @param {Object} options - 选项
	 * @returns {Array} 命令规范列表
	 */
	async buildSkillCommandSpecs(options = {}) {
		const { userInvocable = true } = options

		// 获取所有 skills
		let skills = Array.from(this.skillRunner.skills.values())

		// 过滤
		if (this.skillFilter) {
			skills = this._filterSkills(skills)
		}

		// 构建命令规范
		return this.converter.buildSkillCommandSpecs(skills, { userInvocable })
	}

	/**
	 * 从 skill 快照恢复
	 * @param {Object} snapshot - skill 快照
	 */
	async restoreFromSnapshot(snapshot) {
		if (!snapshot || !snapshot.skills) {
			return
		}

		// 根据快照中的 skills 列表加载
		const skillNames = snapshot.skills.map((s) => s.name)
		this.skillFilter = skillNames

		await this.reloadSkills()
	}
}

export default AgentToolManager
