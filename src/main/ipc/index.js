import { ipcMain } from 'electron'
import * as llmHandlers from './handlers/llm'
import { registerPlannerHandlers } from './handlers/planner'
import { registerMemoryHandlers } from './handlers/memory'
import { registerSandboxHandlers } from './handlers/sandbox'
import { registerPythonSandboxHandlers } from './handlers/python-sandbox'
import { registerSkillHandlers } from './handlers/skill'

console.log('llmHandlers', llmHandlers)
export function registerIpcHandlers() {
	// llm
	ipcMain.handle('llm:hi', llmHandlers.hi)
	ipcMain.handle('llm:testLLMClient', llmHandlers.testLLMClient)
	ipcMain.handle('llm:testOnlineLLMClient', llmHandlers.testOnlineLLMClient)
	ipcMain.handle('llm:testLLMStream', llmHandlers.testLLMStream)

	// planner
	registerPlannerHandlers()

	// memory
	registerMemoryHandlers()

	// sandbox
	registerSandboxHandlers()

	// python sandbox
	registerPythonSandboxHandlers()

	// skills
	registerSkillHandlers()
}
