import type { Server } from "restify";
import type { Model } from "mongoose";

export type JXPHook = (req: JXPRequest, res: JXPResponse, next: () => void) => void | Promise<void>;

export type JXPCallback = (
	modelname: string,
	item: unknown,
	user: unknown,
	opts?: { soft?: boolean }
) => void;

export interface JXPQueryLimits {
	enabled?: boolean;
	large_collection_threshold?: number;
	max?: number;
	/** Applied when client omits ?limit= (secure default) */
	default?: number;
	require_limit_always?: boolean;
	/** Skip countDocuments unless ?page= or ?count=true */
	skip_count_unless_paginated?: boolean;
	/** Max JSON/CSV response size (`10mb`, `512kb`, `10M`, or bytes as number); `0` disables */
	max_response_size?: string | number;
	/** @deprecated Use `max_response_size` (string or number) */
	max_response_bytes?: string | number;
}

export interface JXPSecurityConfig {
	strip_fields?: string[];
	filter_operators_deny?: string[];
	aggregate_stages_allow?: string[];
	bulk_operations_allow?: string[];
}

export interface JXPCorsConfig {
	origins?: string[];
}

export interface LoginRateLimitConfig {
	enabled?: boolean;
	burst?: number;
	per_minute?: number;
	xff?: boolean;
}

export interface JXPDocsConfig {
	/** protected (default) | disabled | public */
	access?: "protected" | "disabled" | "public";
	/** System user email for docs login (protected mode) */
	user_email?: string;
}

export interface JXPCacheConfig {
	enabled?: boolean;
	debug?: boolean;
	ttl?: number;
}

export interface JXPQueryMonitorConfig {
	enabled?: boolean;
	/** 0–1; dev default 1.0, production default 0.02 */
	sample_rate?: number;
	min_docs_examined?: number;
	docs_examined_ratio?: number;
	small_collection_threshold?: number;
	buffer_size?: number;
}

export interface JXPIndexDiagnosticsConfig {
	enabled?: boolean;
	query_monitor?: JXPQueryMonitorConfig;
}

export interface ResolvedIndexDiagnosticsConfig {
	enabled: boolean;
	query_monitor: Required<JXPQueryMonitorConfig>;
}

export interface JXPOAuthProviderConfig {
	auth_uri: string;
	token_uri: string;
	api_uri: string;
	app_id: string;
	app_secret: string;
	scope?: string;
}

export interface JXPConfig {
	port?: number;
	url?: string;
	server?: string;
	apikey?: string;
	secret?: string;
	shared_secret?: string;
	model_dir?: string;
	log?: string;
	mongo?: {
		connection_string?: string;
		server?: string;
		db?: string;
		options?: Record<string, unknown>;
	};
	debug?: boolean;
	/** When true, skip default console startup lines (use custom banner in bin/server). */
	quiet_startup?: boolean;
	throttle?: Record<string, unknown>;
	token_expiry?: number;
	refresh_token_expiry?: number;
	password_recovery_url?: string;
	smtp_server?: string;
	smtp_username?: string;
	smtp_password?: string;
	smtp_from?: string;
	cache?: JXPCacheConfig;
	index_diagnostics?: JXPIndexDiagnosticsConfig;
	docs?: JXPDocsConfig;
	login_rate_limit?: LoginRateLimitConfig;
	cache_timeout?: string;
	query_limits?: JXPQueryLimits;
	security?: JXPSecurityConfig;
	cors?: JXPCorsConfig;
	oauth?: {
		success_uri?: string;
		fail_uri?: string;
		[provider: string]: JXPOAuthProviderConfig | string | undefined;
	};
	callbacks?: {
		put?: JXPCallback;
		post?: JXPCallback;
		delete?: JXPCallback;
		get?: JXPCallback;
		getOne?: JXPCallback;
		update?: JXPCallback;
	};
	pre_hooks?: {
		login?: JXPHook;
		get?: JXPHook;
		getOne?: JXPHook;
		post?: JXPHook;
		put?: JXPHook;
		update?: JXPHook;
		delete?: JXPHook;
	};
	post_hooks?: {
		login?: (req: JXPRequest, res: JXPResponse) => void | Promise<void>;
	};
}

/** Restify request extended by JXP middleware. */
export interface JXPRequest {
	params: Record<string, string>;
	query: Record<string, unknown>;
	body?: Record<string, unknown>;
	headers: Record<string, string | string[] | undefined>;
	method: string;
	route?: { name?: string };
	modelname?: string;
	Model?: Model<unknown>;
	config: JXPConfig;
	username?: string;
	path(): string;
}

/** Restify response extended by JXP middleware. */
export interface JXPResponse {
	user?: {
		_id: unknown;
		email?: string;
		name?: string;
		admin?: boolean;
	};
	groups?: string[];
	token?: unknown;
	refresh_token?: unknown;
	username?: string;
	result?: unknown;
	jxp_cache_key?: string;
	header(name: string, value?: string): unknown;
	status(code: number): JXPResponse;
	redirect(code: number, url: string, next?: () => void): void;
	redirect(url: string, next?: () => void): void;
	send(body?: unknown): unknown;
	json(body?: unknown): unknown;
	writeHead(code: number, headers?: Record<string, unknown>): void;
	write(chunk: string | Buffer): void;
	end(chunk?: string | Buffer): void;
}

export type JXPFactory = (options: JXPConfig) => Server;
