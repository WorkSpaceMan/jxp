declare module "@modelcontextprotocol/server" {
	export const McpServer: new (info: { name: string; version: string }) => {
		registerTool: (
			name: string,
			config: Record<string, unknown>,
			handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
		) => void;
		connect: (transport: unknown) => Promise<void>;
	};
	export const StdioServerTransport: new () => unknown;
}

declare module "@modelcontextprotocol/node" {
	export const NodeStreamableHTTPServerTransport: new (options?: {
		sessionIdGenerator?: (() => string) | undefined;
	}) => {
		handleRequest: (req: unknown, res: unknown, parsedBody?: unknown) => Promise<void>;
	};
}

declare module "@modelcontextprotocol/client" {
	export const Client: new (info: { name: string; version: string }) => {
		connect: (transport: unknown) => Promise<void>;
		listTools: () => Promise<{ tools: Record<string, unknown>[] }>;
		callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<{
			content?: { type: string; text?: string }[];
			isError?: boolean;
		}>;
	};
	export const StreamableHTTPClientTransport: new (
		url: URL,
		opts?: { requestInit?: { headers?: Record<string, string> } }
	) => unknown;
}
