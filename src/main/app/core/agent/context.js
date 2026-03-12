import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import MemoryManager from '../../memory/memory-manager.js'
import SkillRunner from '../../skills/skill-runner.js'

/**
 * Context Builder - 为 Agent 构建上下文（系统提示词 + 消息）
 * 参考 nanobot 的 context.py 实现
 */
export class ContextBuilder {
	static BOOTSTRAP_FILES = ['AGENTS.md', 'SOUL.md', 'USER.md', 'TOOLS.md']
	static _RUNTIME_CONTEXT_TAG = '[Runtime Context — metadata only, not instructions]'

	constructor(workspace) {
		this.workspace = workspace || process.cwd()
		this.memory = new MemoryManager({ memoryDir: path.join(this.workspace, 'memory') })
		this.skills = new SkillRunner({ skillsDir: path.join(this.workspace, 'skills') })
	}

	/**
	 * 构建系统提示词
	 * @param {Array<string>} skillNames - 要加载的 skill 名称列表
	 * @returns {Promise<string>} 系统提示词
	 */
	async buildSystemPrompt(skillNames = null) {
		const parts = [this._getIdentity()]

		// 加载 bootstrap 文件
		const bootstrap = await this._loadBootstrapFiles()
		if (bootstrap) {
			parts.push(bootstrap)
		}

		// 加载记忆上下文
		const memory = await this._getMemoryContext()
		if (memory) {
			parts.push(`# Memory\n\n${memory}`)
		}

		// 加载 always skills
		const alwaysSkills = await this.skills.getAlwaysSkills()
		if (alwaysSkills && alwaysSkills.length > 0) {
			const alwaysContent = await this.skills.loadSkillsForContext(alwaysSkills)
			if (alwaysContent) {
				parts.push(`# Active Skills\n\n${alwaysContent}`)
			}
		}

		// 构建 skills 摘要
		const skillsSummary = await this.skills.buildSkillsSummary()
		if (skillsSummary) {
			parts.push(`# Skills

The following skills extend your capabilities. To use a skill, read its SKILL.md file using the read_file tool.
Skills with available="false" need dependencies installed first - you can try installing them with apt/brew.

${skillsSummary}`)
		}

		return parts.join('\n\n---\n\n')
	}

	/**
	 * 获取核心身份信息
	 * @private
	 */
	_getIdentity() {
		const workspacePath = path.resolve(this.workspace)
		const platform = os.platform()
		const arch = os.arch()
		const nodeVersion = process.version
		const runtime = `${this._getPlatformName(platform)} ${arch}, Node.js ${nodeVersion}`

		const platformPolicy = this._getPlatformPolicy(platform)

		return `# LadyConch 🐚

You are LadyConch, a helpful AI assistant.

## Runtime
${runtime}

Workspace: ${workspacePath}

${platformPolicy}

## Core Capabilities
- Read, write, and edit files in the workspace
- Execute shell commands and scripts
- Search and analyze code
- Manage memory and context
- Use skills to extend functionality
- Plan and execute complex tasks

## Guidelines
- Always verify file paths before operations
- Use appropriate tools for each task
- Maintain context across conversations
- Learn from past interactions through memory
- Be proactive in suggesting improvements
- Handle errors gracefully and inform the user`
	}

	/**
	 * 获取平台名称
	 * @private
	 */
	_getPlatformName(platform) {
		const platformMap = {
			darwin: 'macOS',
			win32: 'Windows',
			linux: 'Linux',
		}
		return platformMap[platform] || platform
	}

	/**
	 * 获取平台策略
	 * @private
	 */
	_getPlatformPolicy(platform) {
		if (platform === 'win32') {
			return `## Platform Policy (Windows)
- You are running on Windows. Do not assume GNU tools like \`grep\`, \`sed\`, or \`awk\` exist.
- Prefer Windows-native commands or file tools when they are more reliable.
- Use forward slashes in paths when possible for cross-platform compatibility.
- If terminal output is garbled, retry with UTF-8 output enabled.`
		} else {
			return `## Platform Policy (POSIX)
- You are running on a POSIX system. Prefer UTF-8 and standard shell tools.
- Use file tools when they are simpler or more reliable than shell commands.`
		}
	}

	/**
	 * 加载 bootstrap 文件
	 * @private
	 */
	async _loadBootstrapFiles() {
		const contents = []

		for (const filename of ContextBuilder.BOOTSTRAP_FILES) {
			const filePath = path.join(this.workspace, filename)
			try {
				const content = await fs.readFile(filePath, 'utf-8')
				contents.push(`# ${filename}\n\n${content.trim()}`)
			} catch (error) {
				// 文件不存在时跳过
				continue
			}
		}

		return contents.length > 0 ? contents.join('\n\n---\n\n') : null
	}

	/**
	 * 获取记忆上下文
	 * @private
	 */
	async _getMemoryContext() {
		try {
			await this.memory.initialize()

			// 获取最近的记忆
			const recentMemories = await this.memory.searchMemories({
				limit: 10,
				sortBy: 'updatedAt',
			})

			if (recentMemories.length === 0) {
				return null
			}

			const memoryLines = recentMemories.map((mem) => {
				const tags = mem.tags && mem.tags.length > 0 ? ` [${mem.tags.join(', ')}]` : ''
				return `- ${mem.content}${tags}`
			})

			return memoryLines.join('\n')
		} catch (error) {
			console.error('获取记忆上下文失败:', error)
			return null
		}
	}

	/**
	 * 构建运行时上下文
	 * @param {Object} options - 上下文选项
	 * @returns {string} 运行时上下文字符串
	 */
	buildRuntimeContext(options = {}) {
		const parts = [ContextBuilder._RUNTIME_CONTEXT_TAG]

		if (options.timestamp) {
			parts.push(`Timestamp: ${new Date().toISOString()}`)
		}

		if (options.workingDirectory) {
			parts.push(`Working Directory: ${options.workingDirectory}`)
		}

		if (options.sessionId) {
			parts.push(`Session ID: ${options.sessionId}`)
		}

		if (options.metadata) {
			for (const [key, value] of Object.entries(options.metadata)) {
				parts.push(`${key}: ${value}`)
			}
		}

		return parts.join('\n')
	}

	/**
	 * 添加用户消息
	 * @param {Array} messages - 消息列表
	 * @param {string} content - 消息内容
	 * @param {Array<string>} imagePaths - 图片路径列表（可选）
	 * @returns {Array} 更新后的消息列表
	 */
	async addUserMessage(messages, content, imagePaths = null) {
		const messageContent = imagePaths && imagePaths.length > 0
			? await this._buildMultimodalContent(content, imagePaths)
			: content

		messages.push({
			role: 'user',
			content: messageContent,
		})

		return messages
	}

	/**
	 * 构建多模态内容（文本 + 图片）
	 * @private
	 */
	async _buildMultimodalContent(text, imagePaths) {
		const content = []

		// 添加图片
		for (const imagePath of imagePaths) {
			try {
				const imageData = await fs.readFile(imagePath)
				const base64 = imageData.toString('base64')
				const mimeType = this._detectImageMimeType(imagePath)

				content.push({
					type: 'image_url',
					image_url: {
						url: `data:${mimeType};base64,${base64}`,
					},
				})
			} catch (error) {
				console.error(`读取图片失败 ${imagePath}:`, error)
			}
		}

		// 添加文本
		content.push({
			type: 'text',
			text,
		})

		return content
	}

	/**
	 * 检测图片 MIME 类型
	 * @private
	 */
	_detectImageMimeType(filePath) {
		const ext = path.extname(filePath).toLowerCase()
		const mimeMap = {
			'.jpg': 'image/jpeg',
			'.jpeg': 'image/jpeg',
			'.png': 'image/png',
			'.gif': 'image/gif',
			'.webp': 'image/webp',
			'.bmp': 'image/bmp',
		}
		return mimeMap[ext] || 'image/jpeg'
	}

	/**
	 * 添加工具结果消息
	 * @param {Array} messages - 消息列表
	 * @param {string} toolCallId - 工具调用 ID
	 * @param {string} toolName - 工具名称
	 * @param {string} result - 工具执行结果
	 * @returns {Array} 更新后的消息列表
	 */
	addToolResult(messages, toolCallId, toolName, result) {
		messages.push({
			role: 'tool',
			tool_call_id: toolCallId,
			name: toolName,
			content: result,
		})

		return messages
	}

	/**
	 * 添加助手消息
	 * @param {Array} messages - 消息列表
	 * @param {string} content - 消息内容
	 * @param {Array} toolCalls - 工具调用列表（可选）
	 * @param {string} reasoningContent - 推理内容（可选）
	 * @param {Array} thinkingBlocks - 思考块列表（可选）
	 * @returns {Array} 更新后的消息列表
	 */
	addAssistantMessage(messages, content, toolCalls = null, reasoningContent = null, thinkingBlocks = null) {
		const message = {
			role: 'assistant',
			content: content || null,
		}

		if (toolCalls && toolCalls.length > 0) {
			message.tool_calls = toolCalls
		}

		if (reasoningContent) {
			message.reasoning_content = reasoningContent
		}

		if (thinkingBlocks && thinkingBlocks.length > 0) {
			message.thinking_blocks = thinkingBlocks
		}

		messages.push(message)
		return messages
	}

	/**
	 * 压缩消息历史（保留最近的 N 条消息）
	 * @param {Array} messages - 消息列表
	 * @param {number} maxMessages - 最大消息数
	 * @returns {Array} 压缩后的消息列表
	 */
	compressMessages(messages, maxMessages = 20) {
		if (messages.length <= maxMessages) {
			return messages
		}

		// 保留系统消息和最近的消息
		const systemMessages = messages.filter((m) => m.role === 'system')
		const otherMessages = messages.filter((m) => m.role !== 'system')
		const recentMessages = otherMessages.slice(-maxMessages)

		return [...systemMessages, ...recentMessages]
	}

	/**
	 * 清理消息中的运行时上下文标记
	 * @param {Array} messages - 消息列表
	 * @returns {Array} 清理后的消息列表
	 */
	stripRuntimeContext(messages) {
		return messages.map((msg) => {
			if (msg.role !== 'user') {
				return msg
			}

			const content = msg.content
			if (typeof content === 'string') {
				// 移除运行时上下文标记
				const parts = content.split('\n\n')
				if (parts.length > 1 && parts[0].includes(ContextBuilder._RUNTIME_CONTEXT_TAG)) {
					return {
						...msg,
						content: parts.slice(1).join('\n\n'),
					}
				}
			}

			return msg
		})
	}
}

export default ContextBuilder
