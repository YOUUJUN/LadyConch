import { ipcMain } from 'electron'
import * as llmHandlers from './handlers/llm'
import { registerPlannerHandlers } from './handlers/planner'

console.log('llmHandlers', llmHandlers)
export function registerIpcHandlers() {
	// llm
	ipcMain.handle('llm:hi', llmHandlers.hi)
	ipcMain.handle('llm:testLLMClient', llmHandlers.testLLMClient)
	ipcMain.handle('llm:testLLMStream', llmHandlers.testLLMStream)

	// planner
	registerPlannerHandlers()
}
