import { ipcMain, dialog, shell, app } from 'electron'
import LLMClient from '../../app/llm/llm-client.js'

export async function hi() {
	console.log('hello world2')

	try {
		const client = new LLMClient({
			provider: 'ollama',
			modelId: 'qwen2.5:7b',
			baseUrl: 'http://192.168.31.183:11434/v1',
			apiKey: 'ollama',
			temperature: 0.7,
			maxTokens: 2048,
		})

		console.log('client', client)

		const resp1 = await client.chat('你好，请用一句话介绍量子计算', {
			systemPrompt: '你是量子物理专家，回答简洁专业。',
		})

		console.log('回答:', resp1)
	} catch (err) {
		console.log('err', err)
	}
}

export async function testLLMClient() {
	console.log('hello world2')

	try {
		const client = new LLMClient({
			provider: 'ollama',
			modelId: 'qwen2.5:7b',
			baseUrl: 'http://192.168.31.183:11434/v1',
			apiKey: 'ollama',
			temperature: 0.7,
			maxTokens: 2048,
		})

		console.log('client', client)

		const resp1 = await client.chat('你好，请用一句话介绍量子计算', {
			systemPrompt: '你是量子物理专家，回答简洁专业。',
		})

		console.log('回答:', resp1)
	} catch (err) {
		console.log('err', err)
	}
}

export async function testOnlineLLMClient() {
	try {
		const client = new LLMClient({
			provider: 'kimi-coding',
			modelId: 'kimi-k2-thinking',
			apiKey: 'sk-FQxBQzJLlrxLPxJN13V7sZhraVjTAQMPUFHPmSjaI2Uy2Lus',
			temperature: 0.7,
			maxTokens: 2048,
		})

		console.log('client', client)

		const resp1 = await client.chat('你好，请用一句话介绍量子计算', {
			systemPrompt: '你是量子物理专家，回答简洁专业。',
		})

		console.log('回答:', resp1)
	} catch (err) {
		console.log('err', err)
	}
}

export async function testLLMStream() {
	// 示例 3: 流式输出 + 推理内容
	console.log('\n=== 示例 3: 流式输出 + 推理 ===')
	const client3 = new LLMClient({
		provider: 'ollama',
		modelId: 'qwen2.5:7b',
		baseUrl: 'http://192.168.31.183:11434/v1',
		apiKey: 'ollama',
		temperature: 0.7,
		maxTokens: 2048,
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
}

/**
 * 测试 Kimi 模型调用
 * 包括普通调用和流式调用两种方式
 */
export async function testKimiModel() {
	console.log('\n=== 测试 Kimi 模型 ===')

	try {
		// 创建 Kimi 客户端
		const kimiClient = new LLMClient({
			provider: 'kimi-coding',
			modelId: 'kimi-k2-thinking',
			apiKey: 'sk-FQxBQzJLlrxLPxJN13V7sZhraVjTAQMPUFHPmSjaI2Uy2Lus',
			temperature: 0.7,
			maxTokens: 2048,
		})

		// 测试 1: 普通调用
		console.log('\n--- 测试 1: 普通调用 ---')
		const response = await kimiClient.chat('请用一句话介绍人工智能', {
			systemPrompt: '你是一个专业的 AI 助手，回答简洁准确。',
		})
		console.log('回答:', response)

		// 测试 2: 流式调用
		console.log('\n--- 测试 2: 流式调用 ---')
		process.stdout.write('回答: ')
		for await (const event of kimiClient.streamChat(
			'写一首关于春天的五言绝句',
			{
				systemPrompt: '你是一位古典诗词专家。',
			},
		)) {
			if (event.type === 'token') {
				process.stdout.write(event.content)
			}
		}
		console.log('\n')

		console.log('✅ Kimi 模型测试完成')
		return { success: true, message: 'Kimi 模型测试成功' }
	} catch (err) {
		console.error('❌ Kimi 模型测试失败:', err)
		return { success: false, error: err.message }
	}
}
