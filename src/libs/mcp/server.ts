import type { JXPConfig } from "../../types/jxp-config";
import type { ModelRegistry } from "../builtin_models";
import { getMcpConfig } from "./config";
import { getMcpAuth } from "./context";
import {
	buildMcpGuideMarkdown,
	buildMcpInstructions,
	MCP_GUIDE_RESOURCE_NAME,
	MCP_GUIDE_URI,
} from "./guides";
import { executeMcpTool } from "./execute_tool";
import { dynamicImport } from "./dynamic_import";

const path = require("path");
const { z } = require("zod");
const pkg = require(path.join(__dirname, "../../../package.json"));

type McpToolResult = { content: { type: string; text: string }[]; isError?: boolean };

type McpServerInstance = {
	registerTool: (
		name: string,
		config: Record<string, unknown>,
		handler: (args: Record<string, unknown>) => Promise<McpToolResult>
	) => void;
	registerResource: (
		name: string,
		uri: string,
		config: Record<string, unknown>,
		handler: () => Promise<{ contents: { uri: string; mimeType: string; text: string }[] }>
	) => void;
	connect: (transport: unknown) => Promise<void>;
};

function toolText(payload: unknown): { content: { type: "text"; text: string }[] } {
	return {
		content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }],
	};
}

function toolError(err: unknown): { content: { type: "text"; text: string }[]; isError?: boolean } {
	const message = err instanceof Error ? err.message : String(err);
	return { content: [{ type: "text", text: message }], isError: true };
}

export async function createMcpServer(config: JXPConfig, models: ModelRegistry) {
	const { McpServer } = await dynamicImport<{
		McpServer: new (
			info: { name: string; version: string },
			options?: { instructions?: string }
		) => McpServerInstance;
	}>("@modelcontextprotocol/server");
	const mcpConfig = getMcpConfig();
	const guideCtx = { config, mcpConfig };

	const server = new McpServer(
		{ name: "jxp", version: pkg.version },
		{ instructions: buildMcpInstructions(guideCtx) }
	);

	server.registerResource(
		MCP_GUIDE_RESOURCE_NAME,
		MCP_GUIDE_URI,
		{
			title: "JXP MCP usage guide",
			description: "Full markdown guide for querying JXP via MCP tools.",
			mimeType: "text/markdown",
		},
		async () => ({
			contents: [
				{
					uri: MCP_GUIDE_URI,
					mimeType: "text/markdown",
					text: buildMcpGuideMarkdown(guideCtx),
				},
			],
		})
	);

	const modelSlug = z.string().min(1).describe("Model slug (from jxp_list_models)");

	server.registerTool(
		"jxp_list_models",
		{
			title: "List JXP models",
			description:
				"Always call this first to discover model slugs. Read resource jxp-guide if unsure about workflow.",
			inputSchema: z.object({}),
		},
		async () => {
			const auth = getMcpAuth();
			const result = await executeMcpTool("jxp_list_models", {}, config, models, auth);
			return result.isError ? toolError(result.text) : toolText(JSON.parse(result.text));
		}
	);

	server.registerTool(
		"jxp_describe_model",
		{
			title: "Describe JXP model",
			description:
				"JSON schema for a model: fields, links, populate hints. Call after jxp_list_models before jxp_find.",
			inputSchema: z.object({ model: modelSlug }),
		},
		async ({ model }) => {
			const auth = getMcpAuth();
			const result = await executeMcpTool(
				"jxp_describe_model",
				{ model: String(model) },
				config,
				models,
				auth
			);
			return result.isError ? toolError(result.text) : toolText(JSON.parse(result.text));
		}
	);

	const findSchema = z.object({
		model: modelSlug,
		id: z.string().optional().describe("MongoDB _id for a single document"),
		filter: z.record(z.string(), z.unknown()).optional(),
		search: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
		populate: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
		fields: z.string().optional().describe("Comma-separated field projection"),
		sort: z.string().optional(),
		limit: z.number().int().positive().optional(),
		page: z.number().int().positive().optional(),
		skip: z.number().int().nonnegative().optional(),
	});

	server.registerTool(
		"jxp_find",
		{
			title: "Find JXP documents",
			description:
				"List or get documents. Use jxp_count first on large collections. Always set fields and a low limit. " +
				`Default limit ${mcpConfig.defaultLimit}, max ${mcpConfig.maxLimit}.`,
			inputSchema: findSchema,
		},
		async (args) => {
			const auth = getMcpAuth();
			const result = await executeMcpTool(
				"jxp_find",
				args as Record<string, unknown>,
				config,
				models,
				auth
			);
			if (result.isError) return toolError(result.text);
			try {
				return toolText(JSON.parse(result.text));
			} catch {
				return toolText(result.text);
			}
		}
	);

	server.registerTool(
		"jxp_count",
		{
			title: "Count JXP documents",
			description:
				"Count matching documents. Use before jxp_find on large collections to avoid huge result sets.",
			inputSchema: z.object({
				model: modelSlug,
				filter: z.record(z.string(), z.unknown()).optional(),
				search: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
			}),
		},
		async (args) => {
			const auth = getMcpAuth();
			const result = await executeMcpTool(
				"jxp_count",
				args as Record<string, unknown>,
				config,
				models,
				auth
			);
			return result.isError ? toolError(result.text) : toolText(JSON.parse(result.text));
		}
	);

	server.registerTool(
		"jxp_export_csv",
		{
			title: "Export JXP documents as CSV",
			description:
				"Export matching documents as CSV text. Prefer fields and a low limit. No populate support.",
			inputSchema: findSchema.omit({ id: true }),
		},
		async (args) => {
			const auth = getMcpAuth();
			const result = await executeMcpTool(
				"jxp_export_csv",
				args as Record<string, unknown>,
				config,
				models,
				auth
			);
			return result.isError ? toolError(result.text) : toolText(result.text);
		}
	);

	return server as McpServerInstance;
}
