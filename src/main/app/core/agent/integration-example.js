import AgentManager from './agent.js'
import { ContextBuilder } from './context.js'
import { AgentToolManager } from './tool-manager.js'
import path from 'path'

/**
 * 集成示例 - 展示如何使用 skills-to-tools 功能
 */
async function example() {
	const workspace = process.cwd()

	// 1. 创建 Tool Manager
	console.log('=== 初始化 Tool Manager ===')
	const toolManager = new AgentToolManager({
		workspace,
		skillsDir: path.join(workspace, 'skills'),
		autoLoadSkills: true,
		// skillFilter: ['github', 'docker'], // 可选：只加载特定 skills
	})

	await toolManager.initialize()

	// 2. 查看加载的 tools
	console.log('\n=== Tools 统计 ===')
	console.log(toolManager.getStats())

	console.log('\n=== Tools 摘要 ===')
	console.log(toolManager.getToolsSummary())

	// 3. 创建 Context Builder
	console.log('\n=== 初始化 Context Builder ===')
	const contextBuilder = new ContextBuilder(workspace)

	// 4. 构建系统提示词
	const systemPrompt = await contextBuilder.buildSystemPrompt()
	console.log('\n=== 系统提示词 (前 500 字符) ===')
	console.log(systemPrompt.substring(0, 500) + '...')

	// 5. 创建 Agent Manager
	console.log('\n=== 初始化 Agent Manager ===')
	const agentManager = new AgentManager({
		provider: 'anthropic',
		modelId: 'claude-sonnet-4-20250514',
		apiKey: process.env.ANTHROPIC_API_KEY,
		systemPrompt,
		skillsDir: path.join(workspace, 'skills'),
	})

	await agentManager.initialize()

	// 6. 注册 tools 到 agent
	console.log('\n=== 注册 Tools 到 Agent ===')
	const piAgentTools = toolManager.getPiAgentTools()
	agentManager.registerTools(piAgentTools)

	console.log(`已注册 ${piAgentTools.length} 个 tools`)

	// 7. 测试执行 tool
	console.log('\n=== 测试执行 Tool ===')
	try {
		const result = await toolManager.executeTool('read_file', {
			path: path.join(workspace, 'package.json'),
		})
		console.log('执行结果:', result.success ? '成功' : '失败')
		if (result.success) {
			console.log('文件内容长度:', result.content.length)
		}
	} catch (error) {
		console.error('执行失败:', error.message)
	}

	// 8. 测试 Agent 对话
	console.log('\n=== 测试 Agent 对话 ===')
	try {
		const response = await agentManager.chat('列出当前目录下的所有文件')
		console.log('Agent 响应:', response.substring(0, 200) + '...')
	} catch (error) {
		console.error('对话失败:', error.message)
	}

	return {
		toolManager,
		contextBuilder,
		agentManager,
	}
}

/**
 * 高级示例 - 自定义 skill 转 tool
 */
async function advancedExample() {
	const workspace = process.cwd()

	// 创建 Tool Manager
	const toolManager = new AgentToolManager({
		workspace,
		skillsDir: path.join(workspace, 'skills'),
		autoLoadSkills: false, // 手动控制加载
	})

	await toolManager.initialize()

	// 手动注册自定义 tool
	toolManager.registerTool({
		name: 'custom_search',
		description: 'Search in custom knowledge base',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search query',
				},
				limit: {
					type: 'number',
					description: 'Maximum results',
					default: 10,
				},
			},
			required: ['query'],
		},
		execute: async (params) => {
			// 自定义搜索逻辑
			console.log('执行自定义搜索:', params.query)
			return {
				success: true,
				results: [
					{ title: 'Result 1', content: 'Content 1' },
					{ title: 'Result 2', content: 'Content 2' },
				],
			}
		},
		metadata: {
			category: 'search',
			author: 'custom',
		},
	})

	// 加载特定的 skills
	await toolManager.skillRunner.scanSkills()
	const githubSkill = toolManager.skillRunner.getSkill('github')

	if (githubSkill) {
		// 转换单个 skill 为 tool
		const tool = toolManager.converter.createToolFromSkill(githubSkill)
		toolManager.registerTool(tool)
		console.log('已注册 github skill tool')
	}

	// 查看所有 tools
	console.log('\n=== 所有 Tools ===')
	const allTools = toolManager.getAllTools()
	allTools.forEach((tool) => {
		console.log(`- ${tool.name}: ${tool.description}`)
	})

	return toolManager
}

/**
 * Skill Dispatch 示例
 */
async function skillDispatchExample() {
	const workspace = process.cwd()

	const toolManager = new AgentToolManager({ workspace })
	await toolManager.initialize()

	// 注册一个目标 tool
	toolManager.registerTool({
		name: 'github_api',
		description: 'Call GitHub API',
		parameters: {
			type: 'object',
			properties: {
				endpoint: { type: 'string' },
				method: { type: 'string', default: 'GET' },
			},
			required: ['endpoint'],
		},
		execute: async (params) => {
			console.log('调用 GitHub API:', params)
			return { success: true, data: { message: 'API called' } }
		},
		metadata: { category: 'api' },
	})

	// 创建一个 skill，配置 dispatch 到 github_api tool
	const dispatchSkill = {
		name: 'github',
		description: 'GitHub operations',
		frontmatter: {
			'command-dispatch': 'tool',
			'command-tool': 'github_api',
			'command-arg-mode': 'raw',
		},
		body: 'GitHub skill content',
	}

	// 转换为 tool
	const tool = toolManager.converter.createToolFromSkill(dispatchSkill)
	toolManager.registerTool(tool)

	// 执行 dispatch tool
	console.log('\n=== 执行 Dispatch Tool ===')
	const result = await toolManager.executeTool('github', {
		args: '--endpoint=/repos/owner/repo --method=GET',
	})
	console.log('执行结果:', result)

	return toolManager
}

// 导出示例函数
export { example, advancedExample, skillDispatchExample }

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
	example()
		.then(() => {
			console.log('\n=== 示例执行完成 ===')
		})
		.catch((error) => {
			console.error('示例执行失败:', error)
			process.exit(1)
		})
}
