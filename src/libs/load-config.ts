import dotenv from "dotenv";
import path from "path";
import type { JXPConfig } from "../types/jxp-config";
import { parseDocsAccess } from "./docs-auth";

let envLoaded = false;

/** Load `.env`, then `.env.{NODE_ENV}` when set (e.g. `.env.test`). */
export function loadEnv(): void {
	if (envLoaded) return;
	const root = process.cwd();
	dotenv.config({ path: path.join(root, ".env") });
	if (process.env.NODE_ENV) {
		dotenv.config({
			path: path.join(root, `.env.${process.env.NODE_ENV}`),
			override: true,
		});
	}
	envLoaded = true;
}

function envInt(name: string, fallback: number): number {
	const n = parseInt(process.env[name] ?? "", 10);
	return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback = false): boolean {
	const v = process.env[name];
	if (v === undefined) return fallback;
	return v === "1" || v.toLowerCase() === "true";
}

/** MongoDB connection string from environment. */
export function getMongoConnectionString(): string {
	loadEnv();
	if (process.env.MONGO_CONNECTION_STRING) {
		return process.env.MONGO_CONNECTION_STRING;
	}

	const {
		MONGODB_USER,
		MONGODB_PASSWORD,
		MONGODB_PASS,
		MONGODB_HOST,
		MONGODB_PORT,
		MONGODB_NAME,
		MONGODB_AUTH_DB,
	} = process.env;

	const password = MONGODB_PASSWORD || MONGODB_PASS;
	const host = MONGODB_HOST || "127.0.0.1";
	const port = MONGODB_PORT || "27017";
	const db = MONGODB_NAME || "jxp";

	if (MONGODB_HOST || MONGODB_USER || password) {
		const auth =
			MONGODB_USER && password
				? `${MONGODB_USER}:${password}@`
				: MONGODB_USER
					? `${MONGODB_USER}@`
					: "";
		const qs = MONGODB_AUTH_DB ? `?authSource=${MONGODB_AUTH_DB}` : "";
		return `mongodb://${auth}${host}:${port}/${db}${qs}`;
	}

	return `mongodb://localhost:27017/jxp`;
}

/** Token TTL defaults (seconds) — used by built-in token models at load time. */
export function getTokenExpiry(): number {
	loadEnv();
	return envInt("TOKEN_EXPIRY", 86400);
}

export function getRefreshTokenExpiry(): number {
	loadEnv();
	return envInt("REFRESH_TOKEN_EXPIRY", 2678400);
}

/** Resolve model directory from env or global (set by JXP before models load). */
export function getModelDirFromEnv(): string | undefined {
	loadEnv();
	return process.env.MODEL_DIR || global.model_dir;
}

/**
 * Build a JXP options object from environment variables.
 * Used by the sample server; apps pass their own object to `JXP()`.
 */
export function loadJxpConfig(overrides: Partial<JXPConfig> = {}): JXPConfig {
	loadEnv();

	const port = envInt("PORT", envInt("NODE_DOCKER_PORT", 4001));
	const url =
		process.env.API_URL ||
		process.env.API_SERVER ||
		`http://localhost:${port}`;

	const mongoOptions = process.env.MONGO_OPTIONS
		? (JSON.parse(process.env.MONGO_OPTIONS) as Record<string, unknown>)
		: {};

	const throttle = process.env.THROTTLE_JSON
		? (JSON.parse(process.env.THROTTLE_JSON) as Record<string, unknown>)
		: undefined;

	const config: JXPConfig = {
		port,
		url,
		server: process.env.API_SERVER || url,
		apikey: process.env.APIKEY,
		shared_secret: process.env.SHARED_SECRET,
		token_expiry: getTokenExpiry(),
		refresh_token_expiry: getRefreshTokenExpiry(),
		model_dir: process.env.MODEL_DIR || "./dist/models",
		log: process.env.LOG_FILE || "access.log",
		mongo: {
			connection_string: getMongoConnectionString(),
			options: mongoOptions,
		},
		debug: envBool("DEBUG"),
		cache: {
			enabled: envBool("CACHE_ENABLED"),
			debug: envBool("CACHE_DEBUG"),
			ttl: envInt("CACHE_TTL", 300),
		},
		query_limits: {
			enabled: envBool("QUERY_LIMITS_ENABLED", true),
			large_collection_threshold: envInt("QUERY_LIMITS_LARGE_COLLECTION_THRESHOLD", 10000),
			max: envInt("QUERY_LIMITS_MAX", 1000),
			default: envInt("QUERY_LIMITS_DEFAULT", 100),
			require_limit_always: envBool("QUERY_LIMITS_REQUIRE_LIMIT_ALWAYS", true),
			skip_count_unless_paginated: envBool("QUERY_LIMITS_SKIP_COUNT_UNLESS_PAGINATED", true),
			max_response_size:
				process.env.QUERY_LIMITS_MAX_RESPONSE_SIZE ||
				process.env.QUERY_LIMITS_MAX_RESPONSE_BYTES ||
				"10mb",
		},
		security: {
			strip_fields: process.env.SECURITY_STRIP_FIELDS
				? process.env.SECURITY_STRIP_FIELDS.split(",").map((s) => s.trim())
				: ["password"],
		},
		docs: {
			access: parseDocsAccess(process.env.DOCS_ACCESS),
			user_email: process.env.DOCS_USER_EMAIL?.trim() || undefined,
		},
		login_rate_limit: {
			enabled: envBool("LOGIN_RATE_LIMIT_ENABLED", true),
			burst: envInt("LOGIN_RATE_BURST", 8),
			per_minute: envInt("LOGIN_RATE_PER_MINUTE", 12),
			xff: envBool("LOGIN_RATE_LIMIT_XFF"),
		},
		cors: {
			origins: process.env.CORS_ORIGINS
				? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
				: ["*"],
		},
		callbacks: {
			put: () => {},
			post: () => {},
			delete: () => {},
			get: () => {},
			getOne: () => {},
			update: () => {},
		},
		pre_hooks: {
			login: (_req, _res, next) => next(),
			get: (_req, _res, next) => next(),
			getOne: (_req, _res, next) => next(),
			post: (_req, _res, next) => next(),
			put: (_req, _res, next) => next(),
			update: (_req, _res, next) => next(),
			delete: (_req, _res, next) => next(),
		},
		post_hooks: {
			login: async () => {},
		},
	};

	if (throttle) {
		(config as JXPConfig & { throttle?: unknown }).throttle = throttle;
	}

	return Object.assign(config, overrides);
}

