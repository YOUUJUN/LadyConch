import fs from 'fs/promises'
import path from 'path'

/**
 * Skill 到 Tool 的转换器
 * 参考 openclaw 的 skills-to-tools 机制
 */
export class SkillToToolConverter {
	constructor(config = {}) {
		this.skillRunner = config.skillRunner
		this.toolRegistry = new Map()
	}

	/**
	 * 从 skill 创建 tool
	 * @param {Object} skill - skill 对象
	 * @returns {Object} tool 对象
	 */
	createToolFromSkill(skill) {
		const { name, description, frontmatter, body } = skill

		// 检查是否配置了 tool dispatch
		const dispatchConfig = this._parseDispatchConfig(frontmatter)

		// 如果配置了 tool dispatch，返回 dispatch tool
		if (dispatchConfig) {
			return this._createDispatchTool(skill, dispatchConfig)
		}

		// 否则创建标准的 skill tool
		return this._createStandardSkillTool(skill)
	}

	/**
	 * 解析 dispatch 配置
	 * @private
	 */
	_parseDispatchConfig(frontmatter) {
		const dispatch = frontmatter['command-dispatch'] || frontmatter['command_dispatch']
		const toolName = frontmatter['command-tool'] || frontmatter['command_tool']
		const argMode = frontmatter['command-arg-mode'] || frontmatter['command_arg_mode'] || 'raw'

		if (dispatch === 'tool' && toolName) {
			return {
				kind: 'tool',
				toolName,
				argMode,
			}
		}

		return null
	}

	/**
	 * 创建 dispatch tool（转发到其他 tool）
	 * @private
	 */
	_createDispatchTool(skill, dispatchConfig) {
		const { name, description } = skill
		const { toolName, argMode } = dispatchConfig

		return {
			name: this._sanitizeToolName(name),
			description: description || `Execute ${name} skill`,
			parameters: {
				type: 'object',
				properties: {
					args: {
						type: 'string',
						description: 'Arguments to pass to the tool',
					},
				},
			},
			execute: async (params) => {
				// 转发到目标 tool
				const targetTool = this.toolRegistry.get(toolName)
				if (!targetTool) {
					throw new Error(`Target tool not found: ${toolName}`)
				}

				// 根据 argMode 处理参数
				let toolParams = params
				if (argMode === 'raw' && params.args) {
					toolParams = this._parseRawArgs(params.args)
				}

				return await targetTool.execute(toolParams)
			},
			metadata: {
				skillName: name,
				dispatchTo: toolName,
				argMode,
			},
		}
	}

	/**
	 * 创建标准 skill tool
	 * @private
	 */
	_createStandardSkillTool(skill) {
		const { name, description, body, frontmatter } = skill

		// 解析参数定义
		const parameters = this._parseSkillParameters(frontmatter, body)

		return {
			name: this._sanitizeToolName(name),
			description: description || `Execute ${name} skill`,
			parameters,
			execute: async (params) => {
				// 执行 skill 逻辑
				return await this._executeSkill(skill, params)
			},
			metadata: {
				skillName: name,
				type: 'skill',
			},
		}
	}

	/**
	 * 解析 skill 参数定义
	 * @private
	 */
	_parseSkillParameters(frontmatter, body) {
		// 从 frontmatter 或 body 中提取参数定义
		const paramsSchema = frontmatter.parameters || frontmatter.params

		if (paramsSchema) {
			try {
				return typeof paramsSchema === 'string' ? JSON.parse(paramsSchema) : paramsSchema
			} catch (error) {
				console.error('解析参数定义失败:', error)
			}
		}

		// 默认参数结构
		return {
			type: 'object',
			properties: {
				input: {
					type: 'string',
					description: 'Input for the skill',
				},
			},
		}
	}

	/**
	 * 执行 skill
	 * @private
	 */
	async _executeSkill(skill, params) {
		const { name, body, resources } = skill

		try {
			// 检查是否有可执行脚本
			const scriptPath = resources?.script || resources?.executable

			if (scriptPath) {
				// 执行外部脚本
				return await this._executeScript(scriptPath, params)
			}

			// 返回 skill 内容作为提示
			return {
				success: true,
				content: body,
				params,
				message: `Skill ${name} loaded. Use the content as guidance.`,
			}
		} catch (error) {
			return {
				success: false,
				error: error.message,
				skillName: name,
			}
		}
	}

	/**
	 * 执行外部脚本
	 * @private
	 */
	async _executeScript(scriptPath, params) {
		const { exec } = await import('child_process')
		const { promisify } = await import('util')
		const execAsync = promisify(exec)

		try {
			// 构建命令
			const args = Object.entries(params)
				.map(([key, value]) => `--${key}="${value}"`)
				.join(' ')

			const command = `"${scriptPath}" ${args}`

			// 执行命令
			const { stdout, stderr } = await execAsync(command, {
				timeout: 30000, // 30秒超时
			})

			return {
				success: true,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
			}
		} catch (error) {
			return {
				success: false,
				error: error.message,
				code: error.code,
			}
		}
	}

	/**
	 * 解析原始参数字符串
	 * @private
	 */
	_parseRawArgs(argsString) {
		// 简单的参数解析：支持 --key=value 和 --key value 格式
		const params = {}
		const regex = /--(\w+)(?:=([^\s]+)|(?:\s+([^\s-][^\s]*)))?/g
		let match

		while ((match = regex.exec(argsString)) !== null) {
			const key = match[1]
			const value = match[2] || match[3] || true
			params[key] = value
		}

		return params
	}

	/**
	 * 清理 tool 名称
	 * @private
	 */
	_sanitizeToolName(name) {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, '_')
			.replace(/_+/g, '_')
			.replace(/^_|_$/g, '')
	}

	/**
	 * 批量转换 skills 为 tools
	 * @param {Array} skills - skill 列表
	 * @returns {Array} tool 列表
	 */
	convertSkillsToTools(skills) {
		const tools = []

		for (const skill of skills) {
			try {
				const tool = this.createToolFromSkill(skill)
				tools.push(tool)

				// 注册到 registry
				this.toolRegistry.set(tool.name, tool)
			} catch (error) {
				console.error(`转换 skill 失败: ${skill.name}`, error)
			}
		}

		return tools
	}

	/**
	 * 注册外部 tool
	 * @param {string} name - tool 名称
	 * @param {Object} tool - tool 对象
	 */
	registerTool(name, tool) {
		this.toolRegistry.set(name, tool)
	}

	/**
	 * 获取已注册的 tool
	 * @param {string} name - tool 名称
	 * @returns {Object|null} tool 对象
	 */
	getTool(name) {
		return this.toolRegistry.get(name) || null
	}

	/**
	 * 获取所有已注册的 tools
	 * @returns {Array} tool 列表
	 */
	getAllTools() {
		return Array.from(this.toolRegistry.values())
	}

	/**
	 * 构建 skill 命令规范
	 * @param {Array} skills - skill 列表
	 * @returns {Array} 命令规范列表
	 */
	buildSkillCommandSpecs(skills) {
		const commandSpecs = []
		const seenNames = new Set()

		for (const skill of skills) {
			const { name, description, frontmatter } = skill

			// 清理命令名称
			const commandName = this._sanitizeToolName(name)

			// 去重
			if (seenNames.has(commandName)) {
				console.warn(`重复的命令名称: ${commandName}`)
				continue
			}
			seenNames.add(commandName)

			// 解析 dispatch 配置
			const dispatch = this._parseDispatchConfig(frontmatter)

			const spec = {
				name: commandName,
				skillName: name,
				description: description || `Execute ${name}`,
			}

			if (dispatch) {
				spec.dispatch = dispatch
			}

			commandSpecs.push(spec)
		}

		return commandSpecs
	}

	/**
	 * 从 skill 快照创建 tools
	 * @param {Object} skillsSnapshot - skills 快照
	 * @returns {Array} tool 列表
	 */
	async createToolsFromSnapshot(skillsSnapshot) {
		if (!skillsSnapshot || !skillsSnapshot.resolvedSkills) {
			return []
		}

		const { resolvedSkills } = skillsSnapshot

		// 转换为内部 skill 格式
		const skills = resolvedSkills.map((skill) => ({
			name: skill.name,
			description: skill.description,
			body: skill.body,
			frontmatter: skill.frontmatter || {},
			resources: skill.resources || {},
		}))

		return this.convertSkillsToTools(skills)
	}
}

export default SkillToToolConverter
