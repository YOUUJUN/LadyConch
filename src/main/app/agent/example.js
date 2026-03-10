import AgentManager from './agent.js'

/**
 * 基础使用示例
 */
async function basicExample() {
	console.log('=== 基础使用示例 ===\n')

	// 创建 agent 实例
	const agent = new AgentManager({
		provider: 'anthropic',
		modelId: 'claude-sonnet-4-20250514',
		apiKey: process.env.ANTHROPIC_API_KEY,
		systemPrompt: 'You are a helpful coding assistant.',
		temperature: 0.7,
		maxTokens: 4096,
	})

	// 初始化
	await agent.initialize()

	// 订阅事件
	agent.subscribe((event) => {
		if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
			process.stdout.write(event.assistantMessageEvent.delta)
		}
	})

	// 发送消息
	console.log('User: Hello! Can you help me write a simple function?\n')
	console.log('Assistant: ')
	await agent.prompt('Hello! Can you help me write a simple function?')
	console.log('\n')
}

/**
 * 使用工具示例
 */
async function toolExample() {
	console.log('=== 工具使用示例 ===\n')

	const agent = new AgentManager({
		provider: 'anthropic',
		modelId: 'claude-sonnet-4-20250514',
		apiKey: process.env.ANTHROPIC_API_KEY,
		systemPrompt: 'You are a helpful assistant with access to file operations.',
	})

	await agent.initialize()

	// 添加自定义工具
	agent.addTool({
		name: 'get_weather',
		description: 'Get the current weather for a location',
		parameters: {
			type: 'object',
			properties: {
				location: {
					type: 'string',
					description: 'The city and country, e.g. "London, UK"',
				},
			},
			required: ['location'],
		},
		execute: async (args) => {
			// 模拟天气 API 调用
			return {
				location: args.location,
				temperature: 22,
				condition: 'Sunny',
				humidity: 65,
			}
		},
	})

	agent.subscribe((event) => {
		if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
			process.stdout.write(event.assistantMessageEvent.delta)
		}
	})

	console.log('User: What is the weather in London?\n')
	console.log('Assistant: ')
	await agent.prompt('What is the weather in London?')
	console.log('\n')
}

/**
 * Skills 使用示例
 */
async function skillExample() {
	console.log('=== Skills 使用示例 ===\n')

	const agent = new AgentManager({
		provider: 'anthropic',
		modelId: 'claude-sonnet-4-20250514',
		apiKey: process.env.ANTHROPIC_API_KEY,
		systemPrompt: 'You are a helpful assistant with access to skills.',
	})

	await agent.initialize()

	agent.subscribe((event) => {
		if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
			process.stdout.write(event.assistantMessageEvent.delta)
		}
	})

	// 列出可用的 skills
	console.log('User: What skills are available?\n')
	console.log('Assistant: ')
	await agent.prompt('What skills are available? Use the list_skills tool.')
	console.log('\n')
}

/**
 * 事件流示例
 */
async function eventStreamExample() {
	console.log('=== 事件流示例 ===\n')

	const agent = new AgentManager({
		provider: 'anthropic',
		modelId: 'claude-sonnet-4-20250514',
		apiKey: process.env.ANTHROPIC_API_KEY,
	})

	await agent.initialize()

	// 详细的事件监听
	agent.subscribe((event) => {
		switch (event.type) {
			case 'agent_start':
				console.log('[Agent] Started')
				break
			case 'turn_start':
				console.log('[Turn] Started')
				break
			case 'message_start':
				console.log(`[Message] Started - Role: ${event.message.role}`)
				break
			case 'message_update':
				if (event.assistantMessageEvent?.type === 'text_delta') {
					process.stdout.write(event.assistantMessageEvent.delta)
				} else if (event.assistantMessageEvent?.type === 'tool_call_delta') {
					console.log(`\n[Tool Call] ${event.assistantMessageEvent.toolCall.name}`)
				}
				break
			case 'message_end':
				console.log(`\n[Message] Ended - Role: ${event.message.role}`)
				break
			case 'turn_end':
				console.log('[Turn] Ended')
				if (event.toolResults && event.toolResults.length > 0) {
					console.log(`[Tools] Executed ${event.toolResults.length} tool(s)`)
				}
				break
			case 'agent_end':
				console.log('[Agent] Ended')
				break
		}
	})

	console.log('User: Calculate 123 * 456\n')
	await agent.prompt('Calculate 123 * 456')
	console.log('\n')
}

/**
 * 多轮对话示例
 */
async function conversationExample() {
	console.log('=== 多轮对话示例 ===\n')

	const agent = new AgentManager({
		provider: 'anthropic',
		modelId: 'claude-sonnet-4-20250514',
		apiKey: process.env.ANTHROPIC_API_KEY,
		systemPrompt: 'You are a helpful assistant. Keep your responses concise.',
	})

	await agent.initialize()

	agent.subscribe((event) => {
		if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
			process.stdout.write(event.assistantMessageEvent.delta)
		}
	})

	// 第一轮
	console.log('User: My name is Alice.\n')
	console.log('Assistant: ')
	await agent.prompt('My name is Alice.')
	console.log('\n\n')

	// 第二轮
	console.log('User: What is my name?\n')
	console.log('Assistant: ')
	await agent.prompt('What is my name?')
	console.log('\n\n')

	// 查看对话历史
	const messages = agent.getMessages()
	console.log(`Total messages in history: ${messages.length}`)
}

/**
 * Ollama 本地模型示例
 */
async function ollamaExample() {
	console.log('=== Ollama 本地模型示例 ===\n')

	const agent = new AgentManager({
		provider: 'ollama',
		modelId: 'qwen2.5:7b',
		baseUrl: 'http://localhost:11434/v1',
		systemPrompt: 'You are a helpful assistant.',
	})

	await agent.initialize()

	agent.subscribe((event) => {
		if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
			process.stdout.write(event.assistantMessageEvent.delta)
		}
	})

	console.log('User: Hello! Tell me a joke.\n')
	console.log('Assistant: ')
	await agent.prompt('Hello! Tell me a joke.')
	console.log('\n')
}

// 运行示例
async function main() {
	const example = process.argv[2] || 'basic'

	try {
		switch (example) {
			case 'basic':
				await basicExample()
				break
			case 'tool':
				await toolExample()
				break
			case 'skill':
				await skillExample()
				break
			case 'event':
				await eventStreamExample()
				break
			case 'conversation':
				await conversationExample()
				break
			case 'ollama':
				await ollamaExample()
				break
			default:
				console.log('Unknown example. Available: basic, tool, skill, event, conversation, ollama')
		}
	} catch (error) {
		console.error('Error:', error.message)
		process.exit(1)
	}
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}

export { basicExample, toolExample, skillExample, eventStreamExample, conversationExample, ollamaExample }
