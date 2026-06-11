import type { JXPConfig } from "../../types/jxp-config";
import type { ModelRegistry } from "../builtin_models";
import {
	buildSyntheticRequest,
	buildSyntheticResponse,
	executeCount,
	executeGetOne,
	executeList,
	resultToCsv,
} from "../read_handlers";
import {
	getMcpConfig,
	overlayMcpCsvLimits,
	overlayMcpQueryLimits,
	type McpConfig,
} from "./config";
import { assertModelVisibleMcp, type McpAuthContext } from "./model_visibility";

const errors = require("restify-errors");

export interface FindParams {
	model: string;
	id?: string;
	filter?: Record<string, unknown>;
	search?: string | Record<string, unknown>;
	populate?: string | Record<string, string>;
	fields?: string;
	sort?: string;
	limit?: number;
	page?: number;
	skip?: number;
}

function truncateValue(value: unknown, maxLen: number): unknown {
	if (typeof value === "string" && value.length > maxLen) {
		return value.slice(0, maxLen);
	}
	if (Array.isArray(value)) {
		return value.map((v) => truncateValue(v, maxLen));
	}
	if (value && typeof value === "object" && !(value instanceof Date)) {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = truncateValue(v, maxLen);
		}
		return out;
	}
	return value;
}

function truncateResultPayload(payload: unknown, maxLen: number): unknown {
	if (!payload || typeof payload !== "object") return payload;
	const clone = JSON.parse(JSON.stringify(payload));
	if (clone.data && Array.isArray(clone.data)) {
		clone.data = clone.data.map((row: Record<string, unknown>) => {
			const next = truncateValue(row, maxLen) as Record<string, unknown>;
			if (JSON.stringify(row).length > JSON.stringify(next).length) {
				next._truncated = true;
			}
			return next;
		});
	} else if (clone.data && typeof clone.data === "object") {
		const row = truncateValue(clone.data, maxLen) as Record<string, unknown>;
		if (JSON.stringify(clone.data).length > JSON.stringify(row).length) {
			row._truncated = true;
		}
		clone.data = row;
	}
	return clone;
}

function buildQueryFromFindParams(params: FindParams, mcp: McpConfig): Record<string, unknown> {
	const query: Record<string, unknown> = {};
	if (params.filter) query.filter = params.filter;
	if (params.search !== undefined) query.search = params.search;
	if (params.populate !== undefined) query.populate = params.populate;
	if (params.fields) query.fields = params.fields;
	if (params.sort) query.sort = params.sort;
	if (params.page) query.page = params.page;
	if (params.skip) query.skip = params.skip;
	if (params.limit !== undefined) {
		query.limit = Math.min(params.limit, mcp.maxLimit);
	}
	return query;
}

function mcpConfigForRequest(baseConfig: JXPConfig, forCsv = false): JXPConfig {
	const mcp = getMcpConfig();
	const query_limits_overlay = forCsv
		? overlayMcpCsvLimits(baseConfig.query_limits, mcp)
		: overlayMcpQueryLimits(baseConfig.query_limits, mcp);
	return { ...baseConfig, query_limits: query_limits_overlay };
}

export async function mcpFind(
	models: ModelRegistry,
	baseConfig: JXPConfig,
	auth: McpAuthContext,
	params: FindParams
): Promise<unknown> {
	const mcp = getMcpConfig();
	const slug = params.model;
	const Model = models[slug];
	if (!Model) {
		throw new errors.NotFoundError(`Model "${slug}" not found`);
	}
	await assertModelVisibleMcp(slug, Model, auth, mcp, params.id);

	const config = mcpConfigForRequest(baseConfig);
	const query = buildQueryFromFindParams(params, mcp);
	if (mcp.disableAutopopulate && query.autopopulate) {
		delete query.autopopulate;
	}

	const res = buildSyntheticResponse(auth.user, auth.groups);
	if (params.id) {
		const req = buildSyntheticRequest(config, slug, Model, query, { item_id: params.id });
		await executeGetOne(req, res);
		return truncateResultPayload(res.result, mcp.truncateStringsAt);
	}

	const req = buildSyntheticRequest(config, slug, Model, query);
	await executeList(req, res);
	return truncateResultPayload(res.result, mcp.truncateStringsAt);
}

export async function mcpCount(
	models: ModelRegistry,
	baseConfig: JXPConfig,
	auth: McpAuthContext,
	params: { model: string; filter?: Record<string, unknown>; search?: string | Record<string, unknown> }
): Promise<unknown> {
	const mcp = getMcpConfig();
	const slug = params.model;
	const Model = models[slug];
	if (!Model) {
		throw new errors.NotFoundError(`Model "${slug}" not found`);
	}
	await assertModelVisibleMcp(slug, Model, auth, mcp);

	const config = mcpConfigForRequest(baseConfig);
	const query: Record<string, unknown> = {};
	if (params.filter) query.filter = params.filter;
	if (params.search !== undefined) query.search = params.search;

	const req = buildSyntheticRequest(config, slug, Model, query);
	const res = buildSyntheticResponse(auth.user, auth.groups);
	await executeCount(req, res);
	return res.result;
}

export async function mcpExportCsv(
	models: ModelRegistry,
	baseConfig: JXPConfig,
	auth: McpAuthContext,
	params: Omit<FindParams, "id">
): Promise<string> {
	const mcp = getMcpConfig();
	const slug = params.model;
	const Model = models[slug];
	if (!Model) {
		throw new errors.NotFoundError(`Model "${slug}" not found`);
	}
	await assertModelVisibleMcp(slug, Model, auth, mcp);

	const config = mcpConfigForRequest(baseConfig, true);
	const query = buildQueryFromFindParams(params, mcp);
	const req = buildSyntheticRequest(config, slug, Model, query);
	const res = buildSyntheticResponse(auth.user, auth.groups);
	await executeList(req, res);

	const csv = resultToCsv(res.result as Record<string, unknown>);
	const maxBytes = mcp.maxCsvBytes;
	if (maxBytes > 0) {
		const size = Buffer.byteLength(csv, "utf8");
		if (size > maxBytes) {
			throw new errors.PayloadTooLargeError(
				`CSV export size ${size} bytes exceeds MCP maximum ${maxBytes} bytes. Use fields and a lower limit.`
			);
		}
	}
	return csv;
}
