import { loadEnv } from "../load-config";
import { parseByteSizeOr } from "../parse_byte_size";
import { BUILTIN_MODEL_SLUGS } from "../builtin_models";
import type { JXPQueryLimits } from "../../types/jxp-config";

export interface McpConfig {
	enabled: boolean;
	path: string;
	requireApiKey: boolean;
	modelWhitelist: Set<string>;
	modelBlacklist: Set<string>;
	defaultHiddenModels: Set<string>;
	defaultLimit: number;
	maxLimit: number;
	maxResponseBytes: number;
	maxCsvBytes: number;
	truncateStringsAt: number;
	disableAutopopulate: boolean;
}

function envBool(name: string, fallback: boolean): boolean {
	loadEnv();
	const v = process.env[name];
	if (v === undefined) return fallback;
	return v === "1" || v.toLowerCase() === "true";
}

function envInt(name: string, fallback: number): number {
	loadEnv();
	const n = parseInt(process.env[name] ?? "", 10);
	return Number.isFinite(n) ? n : fallback;
}

function parseSlugSet(raw: string | undefined): Set<string> {
	if (!raw?.trim()) return new Set();
	return new Set(
		raw
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean)
	);
}

const DEFAULT_HIDDEN = [...BUILTIN_MODEL_SLUGS];

export function getMcpConfig(): McpConfig {
	loadEnv();
	return {
		enabled: envBool("MCP_ENABLED", false),
		path: process.env.MCP_PATH?.trim() || "/mcp",
		requireApiKey: envBool("MCP_REQUIRE_API_KEY", true),
		modelWhitelist: parseSlugSet(process.env.MCP_MODEL_WHITELIST),
		modelBlacklist: parseSlugSet(process.env.MCP_MODEL_BLACKLIST),
		defaultHiddenModels: process.env.MCP_DEFAULT_HIDDEN_MODELS?.trim()
			? parseSlugSet(process.env.MCP_DEFAULT_HIDDEN_MODELS)
			: new Set(DEFAULT_HIDDEN),
		defaultLimit: envInt("MCP_DEFAULT_LIMIT", 20),
		maxLimit: envInt("MCP_MAX_LIMIT", 100),
		maxResponseBytes: parseByteSizeOr(
			process.env.MCP_MAX_RESPONSE_SIZE,
			"256kb",
			"MCP_MAX_RESPONSE_SIZE"
		),
		maxCsvBytes: parseByteSizeOr(process.env.MCP_MAX_CSV_SIZE, "512kb", "MCP_MAX_CSV_SIZE"),
		truncateStringsAt: envInt("MCP_TRUNCATE_STRINGS_AT", 4000),
		disableAutopopulate: envBool("MCP_DISABLE_AUTOPOPULATE", true),
	};
}

export function isMcpEnabled(): boolean {
	return getMcpConfig().enabled;
}

/** Merge MCP-specific limits over the app's query_limits for MCP read operations. */
export function overlayMcpQueryLimits(
	base: JXPQueryLimits | undefined,
	mcp: McpConfig
): JXPQueryLimits {
	const merged = { ...(base || {}) };
	merged.default = mcp.defaultLimit;
	merged.max = mcp.maxLimit;
	merged.max_response_size = mcp.maxResponseBytes;
	return merged;
}

export function overlayMcpCsvLimits(
	base: JXPQueryLimits | undefined,
	mcp: McpConfig
): JXPQueryLimits {
	const merged = overlayMcpQueryLimits(base, mcp);
	merged.max_response_size = mcp.maxCsvBytes;
	return merged;
}
