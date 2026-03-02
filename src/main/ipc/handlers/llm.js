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
