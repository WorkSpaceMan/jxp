#!/usr/bin/env node
/**
 * stdio MCP bridge — proxies Cursor/LM Studio to a JXP HTTP MCP endpoint.
 * Env: JXP_URL (default http://localhost:4001), JXP_API_KEY (required), MCP_PATH (default /mcp)
 */
import { dynamicImport } from "../libs/mcp/dynamic_import";

const path = require("path");
const { z } = require("zod");
const pkg = require(path.join(__dirname, "../../package.json"));

function envOptional(name: string, fallback: string): string {
	const v = process.env[name];
	return v !== undefined && v !== "" ? v : fallback;
}

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) {
		console.error(`${name} is required`);
		process.exit(1);
	}
	return v;
}

async function main() {
	const mcpServer = await dynamicImport<{
		StdioServerTransport: new () => unknown;
		McpServer: new (
			info: { name: string; version: string },
			options?: { instructions?: string }
		) => {
			registerTool: (
				name: string,
				config: Record<string, unknown>,
				handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
			) => void;
			registerResource: (
				name: string,
				uri: string,
				config: Record<string, unknown>,
				handler: () => Promise<{ contents: unknown[] }>
			) => void;
			connect: (transport: unknown) => Promise<void>;
		};
	}>("@modelcontextprotocol/server");
	const mcpClient = await dynamicImport<{
		Client: new (info: { name: string; version: string }) => {
			connect: (transport: unknown) => Promise<void>;
			getInstructions: () => string | undefined;
			listTools: () => Promise<{ tools: Record<string, unknown>[] }>;
			listResources: () => Promise<{
				resources: { name?: string; uri: string; title?: string; description?: string; mimeType?: string }[];
			}>;
			readResource: (params: { uri: string }) => Promise<{ contents: unknown[] }>;
			callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<{
				content?: { type: string; text?: string }[];
				isError?: boolean;
			}>;
		};
		StreamableHTTPClientTransport: new (
			url: URL,
			opts?: { requestInit?: { headers?: Record<string, string> } }
		) => unknown;
	}>("@modelcontextprotocol/client");

	const { StdioServerTransport, McpServer } = mcpServer;
	const { Client, StreamableHTTPClientTransport } = mcpClient;

	const baseUrl = envOptional("JXP_URL", "http://localhost:4001").replace(/\/$/, "");
	const apiKey = requireEnv("JXP_API_KEY");
	const mcpPath = process.env.MCP_PATH?.trim() || "/mcp";
	const url = new URL(mcpPath.startsWith("/") ? mcpPath : `/${mcpPath}`, `${baseUrl}/`);

	const remote = new Client({ name: "jxp-mcp-bridge", version: pkg.version });
	const remoteTransport = new StreamableHTTPClientTransport(url, {
		requestInit: {
			headers: {
				"X-API-Key": apiKey,
			},
		},
	});
	await remote.connect(remoteTransport);

	const instructions = remote.getInstructions();
	const proxy = new McpServer(
		{ name: "jxp-mcp", version: pkg.version },
		instructions ? { instructions } : undefined
	);

	const { tools } = await remote.listTools();
	for (const tool of tools) {
		const t = tool as {
			name: string;
			title?: string;
			description?: string;
			inputSchema?: { properties?: Record<string, unknown> };
		};
		const props = t.inputSchema?.properties || {};
		const shape: Record<string, unknown> = {};
		for (const key of Object.keys(props)) {
			shape[key] = z.unknown().optional();
		}
		const inputSchema = z.object(shape);

		proxy.registerTool(
			t.name,
			{
				title: t.title,
				description: t.description,
				inputSchema,
			},
			async (args) => {
				const result = await remote.callTool({ name: t.name, arguments: args });
				return {
					content: (result.content || []).map((block) => {
						if (block.type === "text") {
							return { type: "text" as const, text: block.text };
						}
						return { type: "text" as const, text: JSON.stringify(block) };
					}),
					isError: result.isError,
				};
			}
		);
	}

	const { resources } = await remote.listResources();
	for (const resource of resources) {
		const name = resource.name || resource.uri;
		const uri = resource.uri;
		proxy.registerResource(
			name,
			uri,
			{
				title: resource.title,
				description: resource.description,
				mimeType: resource.mimeType || "text/markdown",
			},
			async () => remote.readResource({ uri })
		);
	}

	const stdio = new StdioServerTransport();
	await proxy.connect(stdio);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
