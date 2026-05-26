import mongoose, { type Model } from "mongoose";
import type {
	JXPIndexDiagnosticsConfig,
	JXPQueryMonitorConfig,
	ResolvedIndexDiagnosticsConfig,
} from "../types/jxp-config";

export const SYNC_CONFIRM_PHRASE = "DROP_EXTRA_INDEXES";

export const INDEX_QUERY_LOG_MODEL_NAME = "IndexQueryLog";

const READ_QUERY_OPS = ["find", "findOne", "count", "countDocuments", "distinct"] as const;

const MONITOR_EXCLUDED_MODELS = new Set([INDEX_QUERY_LOG_MODEL_NAME]);

/** Set on queries run by the monitor itself so post hooks do not re-enter. */
const INDEX_DIAG_INTERNAL_EXPLAIN = "_indexDiagExplain";

let explainMonitorDepth = 0;

/** Whether a completed query should trigger sampled explain monitoring. */
export function shouldMonitorQuery(query: mongoose.Query<unknown, unknown>): boolean {
	if (explainMonitorDepth > 0) return false;
	const opts = (query as { options?: Record<string, unknown> }).options;
	if (opts?.explain) return false;
	if (opts?.[INDEX_DIAG_INTERNAL_EXPLAIN]) return false;
	return true;
}

export type ExplainSeverity = "ignore" | "ok" | "warn" | "alert";

export interface ExplainClassification {
	severity: ExplainSeverity;
	reason?: string;
	stage?: string;
	totalDocsExamined?: number;
	nReturned?: number;
	totalKeysExamined?: number;
	millis?: number;
}

export interface QueryMonitorEntry {
	at: string;
	model: string;
	op: string;
	filterSummary: string;
	severity: ExplainSeverity;
	reason?: string;
	stage?: string;
	totalDocsExamined?: number;
	nReturned?: number;
	totalKeysExamined?: number;
	millis?: number;
	/** Present when loaded from IndexQueryLog collection */
	id?: string;
}

export interface IndexAuditEntry {
	modelName: string;
	collection: string;
	ok: boolean;
	missing: Record<string, number>[];
	extra: string[];
	schemaIndexes: Array<{ keys: Record<string, number>; options?: Record<string, unknown> }>;
	dbIndexes: Array<{ name: string; key: Record<string, number>; [k: string]: unknown }>;
	error?: string;
	unused?: Array<{ name: string; accesses: number }>;
}

export interface IndexAuditReport {
	generatedAt: string;
	collections: IndexAuditEntry[];
	summary: { total: number; ok: number; withMissing: number; withExtra: number; errors: number };
}

export interface SyncIndexesResult {
	modelName: string;
	created?: string[];
	dropped?: string[];
	error?: string;
}

function envBool(name: string, fallback = false): boolean {
	const v = process.env[name];
	if (v === undefined) return fallback;
	return v === "1" || v.toLowerCase() === "true";
}

function envFloat(name: string, fallback: number): number {
	const n = parseFloat(process.env[name] ?? "");
	return Number.isFinite(n) ? n : fallback;
}

function envInt(name: string, fallback: number): number {
	const n = parseInt(process.env[name] ?? "", 10);
	return Number.isFinite(n) ? n : fallback;
}

function truncate(value: string, max = 120): string {
	const oneLine = value.replace(/[\r\n]+/g, " ").trim();
	if (oneLine.length <= max) return oneLine;
	return `${oneLine.slice(0, max - 1)}…`;
}

export function summarizeFilter(filter: unknown): string {
	if (filter === undefined || filter === null) return "{}";
	try {
		return truncate(JSON.stringify(filter));
	} catch {
		return "[unserializable]";
	}
}

/** Stages that actually read from the collection (not plan wrappers like PROJECTION_*). */
const DATA_ACCESS_STAGES = new Set([
	"COLLSCAN",
	"IXSCAN",
	"FETCH",
	"IDHACK",
	"DISTINCT_SCAN",
	"TEXT",
	"COUNT_SCAN",
	"COUNT",
	"SUBPLAN",
]);

function isDataAccessStage(name: string): boolean {
	return DATA_ACCESS_STAGES.has(name);
}

function stageName(stage: unknown): string | undefined {
	if (!stage || typeof stage !== "object") return undefined;
	const s = stage as Record<string, unknown>;
	if (typeof s.stage === "string") return s.stage;
	if (s.inputStage) return stageName(s.inputStage);
	if (Array.isArray(s.inputStages) && s.inputStages[0]) return stageName(s.inputStages[0]);
	return undefined;
}

/** Deepest data-access stages from collection inward (e.g. IXSCAN → FETCH). */
export function extractScanStagePath(stage: unknown): string[] {
	if (!stage || typeof stage !== "object") return [];
	const s = stage as Record<string, unknown>;
	const name = typeof s.stage === "string" ? s.stage : undefined;

	const childPaths: string[][] = [];
	if (s.inputStage) childPaths.push(extractScanStagePath(s.inputStage));
	if (Array.isArray(s.inputStages)) {
		for (const st of s.inputStages) childPaths.push(extractScanStagePath(st));
	}
	if (s.shards && typeof s.shards === "object") {
		for (const shard of Object.values(s.shards as Record<string, unknown>)) {
			if (shard && typeof shard === "object") {
				const es = (shard as Record<string, unknown>).executionStages;
				if (es) childPaths.push(extractScanStagePath(es));
			}
		}
	}

	const deepest = childPaths.reduce(
		(best, cur) => (cur.length > best.length ? cur : best),
		[] as string[]
	);

	if (name && isDataAccessStage(name)) {
		return [...deepest, name];
	}
	return deepest;
}

export function formatScanStagePath(path: string[]): string | undefined {
	if (!path.length) return undefined;
	return path.join(" → ");
}

function scanStageFromExplain(rootStage: unknown): string | undefined {
	return formatScanStagePath(extractScanStagePath(rootStage)) ?? stageName(rootStage);
}

export function hasCollScan(stage: unknown): boolean {
	if (!stage || typeof stage !== "object") return false;
	const s = stage as Record<string, unknown>;
	if (s.stage === "COLLSCAN") return true;
	if (s.inputStage && hasCollScan(s.inputStage)) return true;
	if (Array.isArray(s.inputStages)) {
		return s.inputStages.some((st) => hasCollScan(st));
	}
	return false;
}

function getExecutionStats(explain: Record<string, unknown>): Record<string, unknown> | undefined {
	const stats = explain.executionStats;
	if (stats && typeof stats === "object") return stats as Record<string, unknown>;
	return undefined;
}

export function classifyExplain(
	explain: Record<string, unknown>,
	options: {
		minDocsExamined?: number;
		docsExaminedRatio?: number;
		smallCollectionThreshold?: number;
		collectionDocCount?: number;
	} = {}
): ExplainClassification {
	const minDocsExamined = options.minDocsExamined ?? 50;
	const docsExaminedRatio = options.docsExaminedRatio ?? 10;
	const smallCollectionThreshold = options.smallCollectionThreshold ?? 1000;

	if (
		options.collectionDocCount !== undefined &&
		options.collectionDocCount < smallCollectionThreshold
	) {
		return { severity: "ignore", reason: "small_collection" };
	}

	const stats = getExecutionStats(explain);
	if (!stats) {
		return { severity: "ignore", reason: "no_execution_stats" };
	}

	const nReturned = Number(stats.nReturned ?? 0);
	const totalDocsExamined = Number(stats.totalDocsExamined ?? 0);
	const totalKeysExamined = Number(stats.totalKeysExamined ?? 0);
	const millis = Number(stats.executionTimeMillis ?? 0);
	const rootStage = stats.executionStages ?? explain.queryPlanner;
	const stage = scanStageFromExplain(rootStage);
	const collScan = hasCollScan(rootStage);

	if (collScan && totalDocsExamined >= minDocsExamined) {
		const ratio = totalDocsExamined / Math.max(nReturned, 1);
		if (ratio >= docsExaminedRatio) {
			return {
				severity: "alert",
				reason: "collection_scan",
				stage,
				totalDocsExamined,
				nReturned,
				totalKeysExamined,
				millis,
			};
		}
	}

	if (
		!collScan &&
		totalKeysExamined > 0 &&
		totalDocsExamined >= minDocsExamined &&
		totalDocsExamined > nReturned * docsExaminedRatio
	) {
		return {
			severity: "warn",
			reason: "inefficient_index",
			stage,
			totalDocsExamined,
			nReturned,
			totalKeysExamined,
			millis,
		};
	}

	if (collScan) {
		return {
			severity: "warn",
			reason: "collection_scan_below_threshold",
			stage,
			totalDocsExamined,
			nReturned,
			totalKeysExamined,
			millis,
		};
	}

	return {
		severity: "ok",
		stage,
		totalDocsExamined,
		nReturned,
		totalKeysExamined,
		millis,
	};
}

function formatSchemaIndex(entry: [Record<string, number>, Record<string, unknown>]): {
	keys: Record<string, number>;
	options?: Record<string, unknown>;
} {
	const [keys, options] = entry;
	const out: { keys: Record<string, number>; options?: Record<string, unknown> } = { keys };
	if (options && Object.keys(options).length) out.options = options;
	return out;
}

export async function auditModel(
	model: Model<unknown>,
	opts?: { includeUnused?: boolean }
): Promise<IndexAuditEntry> {
	const modelName = model.modelName;
	const collection = model.collection.name;
	const entry: IndexAuditEntry = {
		modelName,
		collection,
		ok: true,
		missing: [],
		extra: [],
		schemaIndexes: [],
		dbIndexes: [],
	};

	try {
		const schemaIndexes = model.schema.indexes() as unknown as Array<
			[Record<string, number>, Record<string, unknown>]
		>;
		entry.schemaIndexes = schemaIndexes.map(formatSchemaIndex);

		const dbIndexes = await model.listIndexes();
		entry.dbIndexes = dbIndexes.map((idx) => ({
			name: String(idx.name),
			key: idx.key as Record<string, number>,
			...idx,
		}));

		const diff = await model.diffIndexes();
		entry.missing = (diff.toCreate || []) as Record<string, number>[];
		entry.extra = (diff.toDrop || []) as string[];
		entry.ok = entry.missing.length === 0 && entry.extra.length === 0;

		if (opts?.includeUnused) {
			try {
				const stats = (await model.collection
					.aggregate([{ $indexStats: {} }])
					.toArray()) as Array<{
					name: string;
					accesses?: { ops?: number };
				}>;
				entry.unused = stats
					.filter((s) => s.name !== "_id_" && (s.accesses?.ops ?? 0) === 0)
					.map((s) => ({ name: s.name, accesses: s.accesses?.ops ?? 0 }));
			} catch {
				entry.unused = [];
			}
		}
	} catch (err) {
		entry.ok = false;
		entry.error = err instanceof Error ? err.message : String(err);
	}

	return entry;
}

export async function auditAllModels(
	models: Record<string, Model<unknown>>,
	opts?: { includeUnused?: boolean }
): Promise<IndexAuditReport> {
	const collections: IndexAuditEntry[] = [];
	const names = Object.keys(models).sort();

	for (const name of names) {
		collections.push(await auditModel(models[name], opts));
	}

	const withMissing = collections.filter((c) => c.missing.length > 0).length;
	const withExtra = collections.filter((c) => c.extra.length > 0).length;
	const errors = collections.filter((c) => c.error).length;

	return {
		generatedAt: new Date().toISOString(),
		collections,
		summary: {
			total: collections.length,
			ok: collections.filter((c) => c.ok).length,
			withMissing,
			withExtra,
			errors,
		},
	};
}

export async function syncAllModels(
	models: Record<string, Model<unknown>>,
	opts: { confirm?: string }
): Promise<SyncIndexesResult[]> {
	if (opts.confirm !== SYNC_CONFIRM_PHRASE) {
		throw new Error(
			`syncIndexes requires confirm="${SYNC_CONFIRM_PHRASE}" (creates missing indexes and drops extras not in schema)`
		);
	}

	const results: SyncIndexesResult[] = [];
	const names = Object.keys(models).sort();

	for (const name of names) {
		const model = models[name];
		try {
			const before = await model.diffIndexes();
			await model.syncIndexes();
			results.push({
				modelName: name,
				created: (before.toCreate || []).map((k) => JSON.stringify(k)),
				dropped: before.toDrop || [],
			});
		} catch (err) {
			results.push({
				modelName: name,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return results;
}

import { loadAllModels } from "./builtin_models";

/** Load app MODEL_DIR plus jxp built-in models (app overrides built-ins). */
export function loadModelsFromDir(modelDir: string): Record<string, Model<unknown>> {
	return loadAllModels(modelDir);
}

export function wireQueryLogPersistence(models: Record<string, Model<unknown>>): void {
	const logModel =
		models.indexquerylog ||
		Object.values(models).find((m) => m.modelName === INDEX_QUERY_LOG_MODEL_NAME);
	if (logModel) {
		setQueryLogModel(logModel);
	} else {
		setQueryLogModel(null);
	}
}

export function resolveIndexDiagnosticsConfig(
	config?: JXPIndexDiagnosticsConfig
): ResolvedIndexDiagnosticsConfig {
	const isProd = process.env.NODE_ENV === "production";
	const masterOn = config?.enabled ?? envBool("INDEX_DIAGNOSTICS_ENABLED", false);

	let monitorOn: boolean | undefined;
	if (config?.query_monitor?.enabled !== undefined) {
		monitorOn = config.query_monitor.enabled;
	} else if (process.env.QUERY_INDEX_MONITOR !== undefined) {
		monitorOn = envBool("QUERY_INDEX_MONITOR");
	} else {
		monitorOn = isProd ? masterOn : true;
	}

	const enabled = masterOn || monitorOn === true;

	const queryDefaults: Required<
		Pick<
			JXPQueryMonitorConfig,
			| "enabled"
			| "sample_rate"
			| "min_docs_examined"
			| "docs_examined_ratio"
			| "small_collection_threshold"
			| "buffer_size"
		>
	> = isProd
		? {
				enabled: false,
				sample_rate: 0.02,
				min_docs_examined: 100,
				docs_examined_ratio: 10,
				small_collection_threshold: 1000,
				buffer_size: 200,
			}
		: {
				enabled: true,
				sample_rate: 1.0,
				min_docs_examined: 20,
				docs_examined_ratio: 5,
				small_collection_threshold: 500,
				buffer_size: 200,
			};

	const qm = config?.query_monitor ?? {};
	const query_monitor: ResolvedIndexDiagnosticsConfig["query_monitor"] = {
		enabled: enabled && monitorOn === true,
		sample_rate: qm.sample_rate ?? envFloat("QUERY_INDEX_SAMPLE_RATE", queryDefaults.sample_rate),
		min_docs_examined:
			qm.min_docs_examined ??
			envInt("QUERY_INDEX_MIN_DOCS_EXAMINED", queryDefaults.min_docs_examined),
		docs_examined_ratio:
			qm.docs_examined_ratio ??
			envFloat("QUERY_INDEX_DOCS_EXAMINED_RATIO", queryDefaults.docs_examined_ratio),
		small_collection_threshold:
			qm.small_collection_threshold ??
			envInt("QUERY_INDEX_SMALL_COLLECTION_THRESHOLD", queryDefaults.small_collection_threshold),
		buffer_size: qm.buffer_size ?? envInt("QUERY_INDEX_BUFFER_SIZE", queryDefaults.buffer_size),
	};

	return {
		enabled,
		query_monitor,
	};
}

const queryBuffer: QueryMonitorEntry[] = [];
let resolvedConfig: ResolvedIndexDiagnosticsConfig | null = null;
let pluginRegistered = false;
let queryLogModel: Model<unknown> | null = null;
let persistQueries = true;

export function setQueryLogModel(model: Model<unknown> | null): void {
	queryLogModel = model;
}

export function setPersistQueries(enabled: boolean): void {
	persistQueries = enabled;
}

export function getQueryMonitorBuffer(): QueryMonitorEntry[] {
	return [...queryBuffer];
}

export interface QueryLogListOptions {
	limit?: number;
	skip?: number;
	severity?: string;
	model_name?: string;
}

export interface QueryMonitorStatus {
	/** Sampling + explain hooks are active */
	active: boolean;
	is_production: boolean;
	diagnostics_enabled: boolean;
	query_monitor_enabled: boolean;
	/** Env set but registerQueryIndexMonitor never ran (e.g. old app server bootstrap) */
	registration_missing: boolean;
	/** Raw env for UI debugging */
	env: {
		QUERY_INDEX_MONITOR?: string;
		INDEX_DIAGNOSTICS_ENABLED?: string;
		NODE_ENV?: string;
	};
	/** Suggested .env lines when inactive */
	env_hints: Array<{ name: string; value: string; comment?: string }>;
}

function envWantsQueryMonitor(): boolean {
	if (envBool("INDEX_DIAGNOSTICS_ENABLED", false)) return true;
	if (process.env.QUERY_INDEX_MONITOR !== undefined) {
		return envBool("QUERY_INDEX_MONITOR");
	}
	return process.env.NODE_ENV !== "production";
}

export interface QueryLogListResult {
	config: ResolvedIndexDiagnosticsConfig["query_monitor"] | null;
	monitor_status: QueryMonitorStatus;
	entries: QueryMonitorEntry[];
	persisted: boolean;
	total?: number;
}

export function getQueryMonitorStatus(): QueryMonitorStatus {
	const isProd = process.env.NODE_ENV === "production";
	const cfg = resolvedConfig;
	const diagnostics_enabled = cfg?.enabled ?? false;
	const query_monitor_enabled = cfg?.query_monitor?.enabled ?? false;
	const active = diagnostics_enabled && query_monitor_enabled;
	const registration_missing = cfg === null && envWantsQueryMonitor();
	const envSnapshot = {
		QUERY_INDEX_MONITOR: process.env.QUERY_INDEX_MONITOR,
		INDEX_DIAGNOSTICS_ENABLED: process.env.INDEX_DIAGNOSTICS_ENABLED,
		NODE_ENV: process.env.NODE_ENV,
	};

	if (active) {
		return {
			active: true,
			is_production: isProd,
			diagnostics_enabled,
			query_monitor_enabled,
			registration_missing: false,
			env: envSnapshot,
			env_hints: [],
		};
	}

	const env_hints: QueryMonitorStatus["env_hints"] = isProd
		? [
				{
					name: "INDEX_DIAGNOSTICS_ENABLED",
					value: "true",
					comment: "Required in production",
				},
				{ name: "QUERY_INDEX_MONITOR", value: "true" },
				{
					name: "QUERY_INDEX_SAMPLE_RATE",
					value: "0.02",
					comment: "1–5% recommended",
				},
			]
		: [{ name: "QUERY_INDEX_MONITOR", value: "true" }];

	if (registration_missing) {
		env_hints.unshift({
			name: "(restart)",
			value: "required",
			comment: "Env is set but monitor was not registered at startup — restart after upgrading jxp",
		});
	}

	return {
		active: false,
		is_production: isProd,
		diagnostics_enabled,
		query_monitor_enabled,
		registration_missing,
		env: envSnapshot,
		env_hints,
	};
}

export async function listQueryLogs(opts: QueryLogListOptions = {}): Promise<QueryLogListResult> {
	const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
	const skip = Math.max(opts.skip ?? 0, 0);
	const config = getQueryMonitorConfig();
	const monitor_status = getQueryMonitorStatus();

	if (!queryLogModel || !persistQueries) {
		const entries = getQueryMonitorBuffer()
			.filter((e) => {
				if (opts.severity && e.severity !== opts.severity) return false;
				if (opts.model_name && e.model !== opts.model_name) return false;
				return true;
			})
			.slice(skip, skip + limit);
		return { config, monitor_status, entries, persisted: false };
	}

	const filter: Record<string, unknown> = {};
	if (opts.severity) filter.severity = opts.severity;
	if (opts.model_name) filter.model_name = opts.model_name;

	const [docs, total] = await Promise.all([
		queryLogModel
			.find(filter)
			.sort({ observed_at: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),
		queryLogModel.countDocuments(filter),
	]);

	const entries: QueryMonitorEntry[] = docs.map((doc) => {
		const d = doc as Record<string, unknown>;
		const observed = d.observed_at || d.createdAt;
		return {
			at: observed instanceof Date ? observed.toISOString() : String(observed ?? ""),
			model: String(d.model_name ?? ""),
			op: String(d.op ?? ""),
			filterSummary: String(d.filter_summary ?? "{}"),
			severity: d.severity as ExplainSeverity,
			reason: d.reason ? String(d.reason) : undefined,
			stage: d.stage ? String(d.stage) : undefined,
			totalDocsExamined: d.total_docs_examined as number | undefined,
			nReturned: d.n_returned as number | undefined,
			totalKeysExamined: d.total_keys_examined as number | undefined,
			millis: d.millis as number | undefined,
			id: d._id ? String(d._id) : undefined,
		};
	});

	return { config, monitor_status, entries, persisted: true, total };
}

export function getQueryMonitorConfig(): ResolvedIndexDiagnosticsConfig["query_monitor"] | null {
	return resolvedConfig?.query_monitor ?? null;
}

function shouldSample(cfg: ResolvedIndexDiagnosticsConfig): boolean {
	if (!cfg.enabled || !cfg.query_monitor.enabled) return false;
	if (cfg.query_monitor.sample_rate >= 1) return true;
	return Math.random() < cfg.query_monitor.sample_rate;
}

function pushQueryEntry(entry: QueryMonitorEntry, maxSize: number): void {
	queryBuffer.push(entry);
	while (queryBuffer.length > maxSize) {
		queryBuffer.shift();
	}
}

async function persistQueryEntry(entry: QueryMonitorEntry): Promise<void> {
	if (!persistQueries || !queryLogModel) return;
	if (entry.severity !== "alert" && entry.severity !== "warn") return;

	try {
		await queryLogModel.create({
			model_name: entry.model,
			op: entry.op,
			filter_summary: entry.filterSummary,
			severity: entry.severity,
			reason: entry.reason,
			stage: entry.stage,
			total_docs_examined: entry.totalDocsExamined,
			n_returned: entry.nReturned,
			total_keys_examined: entry.totalKeysExamined,
			millis: entry.millis,
			observed_at: new Date(entry.at),
		});
	} catch {
		// persistence must not affect API requests
	}
}

async function runExplainMonitor(
	query: mongoose.Query<unknown, unknown>,
	op: string,
	cfg: ResolvedIndexDiagnosticsConfig
): Promise<void> {
	if (!shouldMonitorQuery(query)) return;

	const model = query.model;
	if (!model) return;
	if (MONITOR_EXCLUDED_MODELS.has(model.modelName)) return;

	const qm = cfg.query_monitor;
	let collectionDocCount: number | undefined;
	explainMonitorDepth += 1;
	try {
		try {
			const estimated = await model.estimatedDocumentCount();
			collectionDocCount = estimated;
		} catch {
			collectionDocCount = undefined;
		}

		const explainQuery = query.clone().explain("executionStats");
		explainQuery.setOptions({ [INDEX_DIAG_INTERNAL_EXPLAIN]: true });
		const explain = (await explainQuery) as Record<string, unknown>;
		const classification = classifyExplain(explain, {
			minDocsExamined: qm.min_docs_examined,
			docsExaminedRatio: qm.docs_examined_ratio,
			smallCollectionThreshold: qm.small_collection_threshold,
			collectionDocCount,
		});

		if (classification.severity === "ignore" || classification.severity === "ok") return;

		const entry: QueryMonitorEntry = {
			at: new Date().toISOString(),
			model: model.modelName,
			op,
			filterSummary: summarizeFilter(query.getFilter()),
			severity: classification.severity,
			reason: classification.reason,
			stage: classification.stage,
			totalDocsExamined: classification.totalDocsExamined,
			nReturned: classification.nReturned,
			totalKeysExamined: classification.totalKeysExamined,
			millis: classification.millis,
		};
		pushQueryEntry(entry, qm.buffer_size);
		void persistQueryEntry(entry);
	} catch {
		// explain failures must not affect API requests
	} finally {
		explainMonitorDepth -= 1;
	}
}

function attachQueryMonitorHooks(schema: mongoose.Schema, cfg: ResolvedIndexDiagnosticsConfig): void {
	for (const op of READ_QUERY_OPS) {
		schema.post(op, function (this: mongoose.Query<unknown, unknown>) {
			if (!shouldSample(cfg)) return;
			const query = this;
			if (!shouldMonitorQuery(query)) return;
			setImmediate(() => {
				void runExplainMonitor(query, op, cfg);
			});
		});
	}
}

/**
 * Register mongoose plugin for sampled explain-based query monitoring.
 * Call before models are loaded.
 */
export function registerQueryIndexMonitor(config?: JXPIndexDiagnosticsConfig): void {
	resolvedConfig = resolveIndexDiagnosticsConfig(config);
	if (!resolvedConfig.enabled || !resolvedConfig.query_monitor.enabled) return;
	if (pluginRegistered) return;
	pluginRegistered = true;

	const cfg = resolvedConfig;
	mongoose.plugin((schema) => {
		attachQueryMonitorHooks(schema, cfg);
	});
}

let auditCache: { at: number; report: IndexAuditReport } | null = null;
const AUDIT_CACHE_MS = 30_000;

export async function getCachedIndexAudit(
	models: Record<string, Model<unknown>>,
	opts?: { includeUnused?: boolean; refresh?: boolean }
): Promise<IndexAuditReport> {
	const now = Date.now();
	if (!opts?.refresh && auditCache && now - auditCache.at < AUDIT_CACHE_MS) {
		return auditCache.report;
	}
	const report = await auditAllModels(models, opts);
	auditCache = { at: now, report };
	return report;
}

export function formatAuditReportHuman(report: IndexAuditReport): string {
	const lines: string[] = [];
	for (const c of report.collections) {
		if (c.error) {
			lines.push(`${c.modelName}: ERROR ${c.error}`);
			continue;
		}
		if (c.ok) {
			lines.push(`${c.modelName}: OK`);
			continue;
		}
		const parts: string[] = [`${c.modelName}:`];
		if (c.missing.length) parts.push(`MISSING ${c.missing.map((k) => JSON.stringify(k)).join(", ")}`);
		if (c.extra.length) parts.push(`EXTRA [${c.extra.join(", ")}]`);
		lines.push(parts.join(" "));
	}
	lines.push(
		`--- summary: ${report.summary.ok}/${report.summary.total} OK, ${report.summary.withMissing} missing, ${report.summary.withExtra} extra, ${report.summary.errors} errors`
	);
	return lines.join("\n");
}
