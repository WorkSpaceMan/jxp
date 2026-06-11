import fs from "fs";
import path from "path";
import type { JXPConfig } from "../../types/jxp-config";
import type { McpConfig } from "./config";

export const MCP_GUIDE_URI = "jxp://guide";
export const MCP_GUIDE_RESOURCE_NAME = "jxp-guide";

export interface McpGuideContext {
	config: JXPConfig;
	mcpConfig: McpConfig;
}

let cachedGuideMarkdown: string | null = null;
let cachedGuideKey: string | null = null;

function resolveGuidePath(filePath: string): string {
	if (path.isAbsolute(filePath)) return filePath;
	return path.resolve(process.cwd(), filePath);
}

function defaultGuidePath(): string {
	return path.join(__dirname, "guides", "default.md");
}

function collectGuideFilePaths(config: JXPConfig): string[] {
	const paths: string[] = [];
	const fromConfig = config.mcp?.guideFiles || [];
	for (const p of fromConfig) {
		if (p?.trim()) paths.push(p.trim());
	}
	const fromEnv = process.env.MCP_GUIDE_FILES?.trim();
	if (fromEnv) {
		for (const p of fromEnv.split(",")) {
			const t = p.trim();
			if (t) paths.push(t);
		}
	}
	return paths;
}

export function loadGuideFiles(paths: string[]): string[] {
	const parts: string[] = [];
	const defaultPath = defaultGuidePath();
	if (fs.existsSync(defaultPath)) {
		parts.push(fs.readFileSync(defaultPath, "utf8"));
	} else {
		console.warn(new Date(), `MCP default guide not found at ${defaultPath}`);
	}

	for (const filePath of paths) {
		const resolved = resolveGuidePath(filePath);
		try {
			parts.push(fs.readFileSync(resolved, "utf8"));
		} catch {
			console.warn(new Date(), `MCP guide file not found: ${resolved}`);
		}
	}
	return parts;
}

function guideCacheKey(ctx: McpGuideContext): string {
	return JSON.stringify({
		files: collectGuideFilePaths(ctx.config),
		append: process.env.MCP_INSTRUCTIONS_APPEND || "",
		appInstructions: ctx.config.mcp?.instructions || "",
		limits: {
			default: ctx.mcpConfig.defaultLimit,
			max: ctx.mcpConfig.maxLimit,
		},
	});
}

export function buildMcpGuideMarkdown(ctx: McpGuideContext): string {
	const key = guideCacheKey(ctx);
	if (cachedGuideMarkdown !== null && cachedGuideKey === key) {
		return cachedGuideMarkdown;
	}

	const parts = loadGuideFiles(collectGuideFilePaths(ctx.config));
	const runtime = [
		"",
		"## Runtime limits",
		"",
		`- Default \`limit\`: ${ctx.mcpConfig.defaultLimit}`,
		`- Max \`limit\`: ${ctx.mcpConfig.maxLimit}`,
		`- Max JSON response: ${ctx.mcpConfig.maxResponseBytes} bytes`,
		`- Max CSV response: ${ctx.mcpConfig.maxCsvBytes} bytes`,
		`- String truncation at: ${ctx.mcpConfig.truncateStringsAt} characters`,
		"",
	];

	cachedGuideMarkdown = [...parts, runtime.join("\n")].filter(Boolean).join("\n\n---\n\n");
	cachedGuideKey = key;
	return cachedGuideMarkdown;
}

export function buildMcpInstructions(ctx: McpGuideContext): string {
	const { mcpConfig } = ctx;
	const lines = [
		"You have read-only access to a JXP REST API via MCP tools.",
		"",
		"Required workflow:",
		"1. jxp_list_models — discover available model slugs for this user.",
		"2. jxp_describe_model — inspect fields, filters, and populate hints before querying.",
		"3. jxp_count — estimate result size on large collections before jxp_find.",
		"4. jxp_find — use fields + low limit; pass id for a single document.",
		"5. jxp_export_csv — small tabular exports only (no populate).",
		"",
		`Limits: default limit ${mcpConfig.defaultLimit}, max ${mcpConfig.maxLimit}. Responses are size-capped; strings may be truncated.`,
		"Filter syntax matches MongoDB ($gte, $in, $regex, etc.). Use populate[field]=a,b for links.",
		"Do not mutate data — MCP is read-only.",
		"",
		"For the full guide, read MCP resource jxp-guide (uri jxp://guide).",
	];

	const appInstructions = ctx.config.mcp?.instructions?.trim();
	if (appInstructions) {
		lines.push("", appInstructions);
	}

	const envAppend = process.env.MCP_INSTRUCTIONS_APPEND?.trim();
	if (envAppend) {
		lines.push("", envAppend);
	}

	return lines.join("\n");
}

/** Clear cached guide (for tests). */
export function clearMcpGuideCache(): void {
	cachedGuideMarkdown = null;
	cachedGuideKey = null;
}
