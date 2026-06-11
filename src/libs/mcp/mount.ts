import type { Server } from "restify";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { JXPConfig } from "../../types/jxp-config";
import type { ModelRegistry } from "../builtin_models";
import { getMcpConfig, isMcpEnabled } from "./config";
import { authenticateMcpRequest } from "./auth";
import { mcpAuthStorage } from "./context";
import { createMcpServer } from "./server";
import { dynamicImport } from "./dynamic_import";

type NodeTransport = {
	handleRequest: (
		req: IncomingMessage,
		res: ServerResponse,
		parsedBody?: unknown
	) => Promise<void>;
};

type McpServerInstance = {
	connect: (transport: unknown) => Promise<void>;
};

let serverPromise: Promise<McpServerInstance> | null = null;
let nodeTransportModule: Promise<{
	NodeStreamableHTTPServerTransport: new (options?: { sessionIdGenerator?: undefined }) => NodeTransport;
}> | null = null;

async function getMcpServer(config: JXPConfig, models: ModelRegistry): Promise<McpServerInstance> {
	if (!serverPromise) {
		serverPromise = createMcpServer(config, models) as Promise<McpServerInstance>;
	}
	return serverPromise;
}

async function createStatelessTransport(): Promise<NodeTransport> {
	if (!nodeTransportModule) {
		nodeTransportModule = dynamicImport("@modelcontextprotocol/node");
	}
	const { NodeStreamableHTTPServerTransport } = await nodeTransportModule;
	return new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
}

async function handleMcpRequest(
	req: IncomingMessage,
	res: ServerResponse,
	parsedBody: unknown,
	config: JXPConfig,
	models: ModelRegistry
) {
	const mcpConfig = getMcpConfig();
	let auth;
	try {
		auth = await authenticateMcpRequest(req, mcpConfig.requireApiKey);
	} catch (err) {
		const status = err.statusCode || 401;
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: err.message || String(err) }));
		return;
	}

	const mcpServer = await getMcpServer(config, models);
	const transport = await createStatelessTransport();
	await mcpServer.connect(transport);
	await mcpAuthStorage.run(auth, async () => {
		await transport.handleRequest(req, res, parsedBody);
	});
}

export function mountMcp(server: Server, opts: { config: JXPConfig; models: ModelRegistry }): void {
	if (!isMcpEnabled()) {
		return;
	}

	const mcpPath = getMcpConfig().path;
	console.log(new Date(), `MCP enabled at ${mcpPath}`);

	const handler = async (req, res) => {
		try {
			const nodeReq = req as unknown as IncomingMessage;
			const nodeRes = res as unknown as ServerResponse;
			await handleMcpRequest(nodeReq, nodeRes, req.body, opts.config, opts.models);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (!res.headersSent) {
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: message }));
			}
		}
	};

	server.get(mcpPath, handler);
	server.post(mcpPath, handler);
}

export { isMcpEnabled };
