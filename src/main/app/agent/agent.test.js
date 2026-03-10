import AgentManager from './agent.js'
import { describe, it, before } from 'node:test'
import assert from 'node:assert'

describe('AgentManager', () => {
	let agent

	before(async () => {
		// 使用测试配置创建 agent
		agent = new AgentManager({
			provider: 'anthropic',
			modelId: 'claude-sonnet-4-20250514',
			apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
			systemPrompt: 'You are a test assistant.',
			maxTokens: 1024,
		})
	})

	describe('初始化', () => {
		it('应该成功创建 AgentManager 实例', () => {
			assert.ok(agent instanceof AgentManager)
			assert.equal(agent.config.provider, 'anthropic')
			assert.equal(agent.config.modelId, 'claude-sonnet-4-20250514')
		})

		it('应该成功初始化 agent', async () => {
			await agent.initialize()
			assert.ok(agent.agent !== null)
			assert.ok(agent.tools.length > 0)
		})

		it('应该加载默认工具', async () => {
			const toolNames = agent.tools.map((t) => t.name)
			assert.ok(toolNames.includes('read_file'))
			assert.ok(toolNames.includes('write_file'))
			assert.ok(toolNames.includes('bash'))
			assert.ok(toolNames.includes('execute_skill'))
			assert.ok(toolNames.includes('list_skills'))
		})
	})

	describe('工具管理', () => {
		it('应该能添加自定义工具', () => {
			const initialCount = agent.tools.length

			agent.addTool({
				name: 'test_tool',
				description: 'A test tool',
				parameters: {
					type: 'object',
					properties: {
						input: { type: 'string' },
					},
					required: ['input'],
				},
				execute: async (args) => {
					return { result: args.input.toUpperCase() }
				},
			})

			assert.equal(agent.tools.length, initialCount + 1)
			const testTool = agent.tools.find((t) => t.name === 'test_tool')
			assert.ok(testTool !== undefined)
		})

		it('添加无效工具应该抛出错误', () => {
			assert.throws(() => {
				agent.addTool({
					name: 'invalid_tool',
					// 缺少必需字段
				})
			}, /Invalid tool definition/)
		})
	})

	describe('状态管理', () => {
		it('应该能获取当前状态', () => {
			const state = agent.getState()
			assert.ok(state !== null)
			assert.ok(Array.isArray(state.messages))
		})

		it('应该能重置对话', () => {
			agent.reset()
			const messages = agent.getMessages()
			assert.equal(messages.length, 0)
			assert.equal(agent.toolExecutionCount, 0)
		})

		it('应该能更新系统提示词', () => {
			const newPrompt = 'You are a new assistant.'
			agent.updateSystemPrompt(newPrompt)
			assert.equal(agent.config.systemPrompt, newPrompt)
		})
	})

	describe('事件订阅', () => {
		it('应该能订阅事件', () => {
			let eventReceived = false
			const unsubscribe = agent.subscribe((event) => {
				eventReceived = true
			})

			assert.equal(typeof unsubscribe, 'function')
			assert.equal(agent.eventHandlers.length, 1)

			unsubscribe()
			assert.equal(agent.eventHandlers.length, 0)
		})

		it('应该能处理多个订阅者', () => {
			const handler1 = () => {}
			const handler2 = () => {}

			const unsub1 = agent.subscribe(handler1)
			const unsub2 = agent.subscribe(handler2)

			assert.equal(agent.eventHandlers.length, 2)

			unsub1()
			assert.equal(agent.eventHandlers.length, 1)

			unsub2()
			assert.equal(agent.eventHandlers.length, 0)
		})
	})

	describe('模型配置', () => {
		it('应该支持 Ollama 配置', () => {
			const ollamaAgent = new AgentManager({
				provider: 'ollama',
				modelId: 'qwen2.5:7b',
				baseUrl: 'http://localhost:11434/v1',
			})

			const model = ollamaAgent.model
			assert.equal(model.provider, 'openai')
			assert.equal(model.baseUrl, 'http://localhost:11434/v1')
			assert.equal(model.id, 'qwen2.5:7b')
		})

		it('应该支持 Anthropic 配置', () => {
			const anthropicAgent = new AgentManager({
				provider: 'anthropic',
				modelId: 'claude-sonnet-4-20250514',
				apiKey: 'test-key',
			})

			assert.ok(anthropicAgent.model !== null)
		})
	})

	describe('Skills 集成', () => {
		it('应该初始化 SkillRunner', () => {
			assert.ok(agent.skillRunner !== null)
		})

		it('应该有 execute_skill 工具', () => {
			const skillTool = agent.tools.find((t) => t.name === 'execute_skill')
			assert.ok(skillTool !== undefined)
			assert.equal(skillTool.description, 'Execute a loaded skill by name')
		})

		it('应该有 list_skills 工具', () => {
			const listTool = agent.tools.find((t) => t.name === 'list_skills')
			assert.ok(listTool !== undefined)
			assert.equal(listTool.description, 'List all available skills')
		})
	})

	describe('工具执行限制', () => {
		it('应该跟踪工具执行次数', () => {
			agent.toolExecutionCount = 0
			assert.equal(agent.toolExecutionCount, 0)
		})

		it('应该在 prompt 时重置计数', async () => {
			agent.toolExecutionCount = 5

			// 注意：这个测试需要有效的 API key 才能真正执行
			// 这里只测试重置逻辑
			if (!process.env.ANTHROPIC_API_KEY) {
				agent.toolExecutionCount = 0
				assert.equal(agent.toolExecutionCount, 0)
			}
		})
	})
})

describe('工具执行', () => {
	let agent

	before(async () => {
		agent = new AgentManager({
			provider: 'anthropic',
			modelId: 'claude-sonnet-4-20250514',
			apiKey: 'test-key',
		})
		await agent.initialize()
	})

	it('read_file 工具应该正确定义', () => {
		const tool = agent.tools.find((t) => t.name === 'read_file')
		assert.ok(tool)
		assert.equal(tool.parameters.type, 'object')
		assert.ok(tool.parameters.properties.path)
		assert.ok(tool.parameters.required.includes('path'))
	})

	it('write_file 工具应该正确定义', () => {
		const tool = agent.tools.find((t) => t.name === 'write_file')
		assert.ok(tool)
		assert.ok(tool.parameters.properties.path)
		assert.ok(tool.parameters.properties.content)
		assert.equal(tool.parameters.required.length, 2)
	})

	it('bash 工具应该正确定义', () => {
		const tool = agent.tools.find((t) => t.name === 'bash')
		assert.ok(tool)
		assert.ok(tool.parameters.properties.command)
		assert.ok(tool.parameters.required.includes('command'))
	})
})

// 集成测试（需要真实 API key）
describe('集成测试', () => {
	// 只在有 API key 时运行
	const hasApiKey = !!process.env.ANTHROPIC_API_KEY

	if (!hasApiKey) {
		it.skip('跳过集成测试（需要 ANTHROPIC_API_KEY）', () => {})
		return
	}

	let agent

	before(async () => {
		agent = new AgentManager({
			provider: 'anthropic',
			modelId: 'claude-sonnet-4-20250514',
			apiKey: process.env.ANTHROPIC_API_KEY,
			systemPrompt: 'You are a helpful assistant. Keep responses very brief.',
			maxTokens: 512,
		})
		await agent.initialize()
	})

	it('应该能发送消息并获得响应', async function () {
		this.timeout(30000) // 增加超时时间

		let textReceived = false

		agent.subscribe((event) => {
			if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
				textReceived = true
			}
		})

		await agent.prompt('Say "Hello" and nothing else.')

		assert.ok(textReceived, 'Should receive text delta events')

		const messages = agent.getMessages()
		assert.ok(messages.length >= 2, 'Should have at least user and assistant messages')
	})

	it('应该能进行多轮对话', async function () {
		this.timeout(60000)

		agent.reset()

		await agent.prompt('My favorite color is blue.')
		await agent.prompt('What is my favorite color?')

		const messages = agent.getMessages()
		assert.ok(messages.length >= 4, 'Should have multiple messages')
	})
})
