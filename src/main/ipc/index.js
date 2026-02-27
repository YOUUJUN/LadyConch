import { ipcMain } from 'electron'
import * as llmHandlers from './handlers/llm'

console.log('llmHandlers', llmHandlers)
export function registerIpcHandlers() {
	// llm
	ipcMain.handle('llm:hi', () => console.log('hello world'))
}
