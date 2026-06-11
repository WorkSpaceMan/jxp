import type { JXPConfig } from "../../types/jxp-config";
import type { ModelRegistry } from "../builtin_models";
import { getMcpConfig } from "./config";
import { mcpAuthStorage } from "./context";
import { describeModelJson } from "./describe";
import { assertModelVisibleMcp, listVisibleModels, type McpAuthContext } from "./model_visibility";
import { mcpCount, mcpExportCsv, mcpFind } from "./read_service";

export type McpToolResult = { text: string; isError?: boolean };

const ALLOWED_TOOLS = new Set([
	"jxp_list_models",
	"jxp_describe_model",
	"jxp_find",
	"jxp_count",
	"jxp_export_csv",
]);

export function isAllowedMcpTool(name: string): boolean {
	return ALLOWED_TOOLS.has(name);
}

export async function executeMcpTool(
	name: string,
	args: Record<string, unknown>,
	config: JXPConfig,
	models: ModelRegistry,
	auth: McpAuthContext
): Promise<McpToolResult> {
	if (!isAllowedMcpTool(name)) {
		return { text: `Unknown MCP tool: ${name}`, isError: true };
	}

	const mcpConfig = getMcpConfig();
	try {
		return await mcpAuthStorage.run(auth, async () => {
			switch (name) {
				case "jxp_list_models": {
					const list = await listVisibleModels(models, auth, mcpConfig);
					return { text: JSON.stringify(list, null, 2) };
				}
				case "jxp_describe_model": {
					const slug = String(args.model ?? "");
					if (!slug) throw new Error("model is required");
					const Model = models[slug];
					if (!Model) throw new Error(`Model "${slug}" not found`);
					await assertModelVisibleMcp(slug, Model, auth, mcpConfig);
					return { text: JSON.stringify(describeModelJson(slug, Model), null, 2) };
				}
				case "jxp_find": {
					const result = await mcpFind(
						models,
						config,
						auth,
						args as unknown as Parameters<typeof mcpFind>[3]
					);
					return {
						text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
					};
				}
				case "jxp_count": {
					const result = await mcpCount(
						models,
						config,
						auth,
						args as unknown as Parameters<typeof mcpCount>[3]
					);
					return { text: JSON.stringify(result, null, 2) };
				}
				case "jxp_export_csv": {
					const csv = await mcpExportCsv(
						models,
						config,
						auth,
						args as unknown as Parameters<typeof mcpExportCsv>[3]
					);
					return { text: csv };
				}
				default:
					return { text: `Unknown MCP tool: ${name}`, isError: true };
			}
		});
	} catch (err) {
		return { text: err instanceof Error ? err.message : String(err), isError: true };
	}
}
