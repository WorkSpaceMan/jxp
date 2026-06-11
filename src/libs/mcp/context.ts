import { AsyncLocalStorage } from "node:async_hooks";
import type { McpAuthContext } from "./model_visibility";

export const mcpAuthStorage = new AsyncLocalStorage<McpAuthContext>();

export function getMcpAuth(): McpAuthContext {
	const ctx = mcpAuthStorage.getStore();
	if (!ctx) {
		throw new Error("MCP auth context missing");
	}
	return ctx;
}
