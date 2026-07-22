const errors = require("restify-errors");

type ReqLike = {
	method?: string;
	url?: string;
	path?: string;
	modelname?: string;
	params?: { item_id?: string; modelname?: string; method_name?: string };
	body?: unknown;
	query?: Record<string, unknown>;
	route?: { path?: string };
	ip?: string;
	headers?: Record<string, string | string[] | undefined>;
	connection?: { remoteAddress?: string };
	socket?: { remoteAddress?: string };
};

type ResLike = {
	user?: { _id?: { toString(): string }; email?: string; admin?: boolean };
};

function filterLogUser(user: ResLike["user"]): string {
	if (!user) return "anonymous";
	if (user.email) return user.email;
	if (user._id) return user._id.toString();
	return "unknown";
}

function headerValue(
	headers: Record<string, string | string[] | undefined> | undefined,
	name: string
): string | undefined {
	if (!headers) return undefined;
	const v = headers[name] ?? headers[name.toLowerCase()];
	if (v === undefined || v === null) return undefined;
	return Array.isArray(v) ? v[0] : String(v);
}

/** Client IP; prefers Restify `req.ip`, then first X-Forwarded-For hop, then socket address. */
export function clientIp(req: ReqLike): string | undefined {
	if (req.ip) return String(req.ip);
	const xff = headerValue(req.headers, "x-forwarded-for");
	if (xff) {
		const first = xff.split(",")[0]?.trim();
		if (first) return first;
	}
	const xri = headerValue(req.headers, "x-real-ip");
	if (xri) return xri.trim();
	return req.socket?.remoteAddress || req.connection?.remoteAddress || undefined;
}

function truncate(value: string, max = 120): string {
	const oneLine = value.replace(/[\r\n]+/g, " ").trim();
	if (oneLine.length <= max) return oneLine;
	return `${oneLine.slice(0, max - 1)}…`;
}

/** Redact API credentials from relative or absolute URLs before logging. */
export function sanitizeRequestUrl(value: string): string {
	return String(value).replace(
		/([?&](?:apikey|api_key|x-api-key)=)[^&#]*/gi,
		"$1[REDACTED]"
	);
}

/** How the request authenticated (no secrets logged). */
export function authHint(req: ReqLike): string | undefined {
	if (req.query?.apikey) return "apikey-query";
	const apiHeader =
		headerValue(req.headers, "x-api-key") || headerValue(req.headers, "X-API-Key");
	if (apiHeader) return "apikey-header";
	const auth = headerValue(req.headers, "authorization");
	if (auth) {
		const lower = auth.trim().toLowerCase();
		if (lower.startsWith("bearer ")) return "bearer";
		if (lower.startsWith("basic ")) return "basic";
	}
	return undefined;
}

export function requestClientInfo(req: ReqLike): string | undefined {
	const parts: string[] = [];
	const ip = clientIp(req);
	if (ip) parts.push(`ip=${ip}`);
	const ua = headerValue(req.headers, "user-agent");
	if (ua) parts.push(`ua=${truncate(ua, 80)}`);
	const auth = authHint(req);
	if (auth) parts.push(`auth=${auth}`);
	return parts.length ? parts.join(" ") : undefined;
}

function summarizeBulkBody(body: unknown): string | undefined {
	if (!Array.isArray(body)) return undefined;
	const counts: Record<string, number> = {};
	for (const op of body) {
		if (!op || typeof op !== "object") {
			counts.invalid = (counts.invalid || 0) + 1;
			continue;
		}
		const keys = Object.keys(op as Record<string, unknown>);
		const name = keys.length === 1 ? keys[0] : "?";
		counts[name] = (counts[name] || 0) + 1;
	}
	const parts = Object.entries(counts).map(([k, n]) => `${k}:${n}`);
	return `bulk[${body.length} ${parts.join(" ")}]`;
}

function summarizeAggregatePipeline(body: unknown): string | undefined {
	let pipeline: unknown = body;
	if (body && typeof body === "object" && !Array.isArray(body)) {
		const q = (body as { query?: unknown }).query;
		if (Array.isArray(q)) pipeline = q;
	}
	if (!Array.isArray(pipeline)) return undefined;
	const counts: Record<string, number> = {};
	for (const stage of pipeline) {
		if (!stage || typeof stage !== "object") continue;
		for (const key of Object.keys(stage as Record<string, unknown>)) {
			if (key.startsWith("$")) {
				counts[key] = (counts[key] || 0) + 1;
			}
		}
	}
	const parts = Object.entries(counts).map(([k, n]) => `${k}:${n}`);
	return `aggregate[${pipeline.length} ${parts.join(" ")}]`;
}

function summarizePostQueryBody(body: unknown): string | undefined {
	if (!body || typeof body !== "object") return undefined;
	const q = (body as { query?: unknown }).query;
	if (!q || typeof q !== "object" || Array.isArray(q)) return "postQuery=invalid";
	return `postQuery keys=${Object.keys(q as Record<string, unknown>).length}`;
}

export function requestQueryHints(req: ReqLike): string | undefined {
	const q = req.query;
	if (!q) return undefined;
	const parts: string[] = [];
	if (q.limit !== undefined && q.limit !== "") parts.push(`?limit=${q.limit}`);
	if (q.page !== undefined && q.page !== "") parts.push(`?page=${q.page}`);
	if (q.count === true || q.count === "true") parts.push("?count=true");
	if (q.search) parts.push("?search");
	if (q.filter !== undefined && q.filter !== null && q.filter !== "") {
		if (typeof q.filter === "object" && !Array.isArray(q.filter)) {
			parts.push(`filterKeys=${Object.keys(q.filter as object).length}`);
		} else {
			parts.push("?filter");
		}
	}
	return parts.length ? parts.join(" ") : undefined;
}

function summarizeRequestDetail(req: ReqLike): string | undefined {
	const path = req.url || req.path || "";
	const routePath = req.route?.path || "";
	const route = path || routePath;

	if (route.includes("/bulkwrite")) return summarizeBulkBody(req.body);
	if (route.includes("/aggregate")) return summarizeAggregatePipeline(req.body);
	if (route.includes("/query")) return summarizePostQueryBody(req.body);
	if (route.includes("/call/") && req.params?.method_name) {
		return `call=${req.params.method_name}`;
	}
	if (
		req.method === "GET" &&
		(route.includes("/api/") || route.includes("/csv/") || route.includes("/count/"))
	) {
		return requestQueryHints(req);
	}
	if (req.method === "POST" && route.includes("/query")) {
		return summarizePostQueryBody(req.body);
	}
	return requestQueryHints(req);
}

export function requestSummary(req: ReqLike, res?: ResLike): string {
	const method = req.method || "?";
	const path = sanitizeRequestUrl(req.url || req.path || "?");
	const bits = [`${method} ${path}`];
	const model = req.modelname || req.params?.modelname;
	if (model) bits.push(`model=${model}`);
	if (req.params?.item_id) bits.push(`id=${req.params.item_id}`);
	bits.push(`user=${filterLogUser(res?.user)}`);
	if (res?.user?.admin) bits.push("admin");
	return bits.join(" ");
}

export function logRequestError(
	req: ReqLike,
	res: ResLike | undefined,
	err: unknown,
	context?: string,
	extra?: string
): void {
	const detail = extra || summarizeRequestDetail(req);
	const errMsg =
		err instanceof Error
			? err.message
			: typeof err === "string"
				? err
				: String(err);
	const headline = [
		new Date().toISOString(),
		requestClientInfo(req),
		requestSummary(req, res),
		context,
		detail,
		errMsg,
	]
		.filter(Boolean)
		.join(" | ");
	console.error(headline);
	if (err instanceof Error && err.stack) {
		const skipStack =
			err instanceof errors.ForbiddenError ||
			err instanceof errors.NotFoundError ||
			err instanceof errors.BadRequestError;
		if (!skipStack) {
			console.error(err.stack);
		}
	}
}

export function logAndThrow(
	req: ReqLike,
	res: ResLike | undefined,
	err: Error,
	context?: string,
	extra?: string
): never {
	logRequestError(req, res, err, context, extra);
	throw err;
}

module.exports = {
	filterLogUser,
	clientIp,
	sanitizeRequestUrl,
	authHint,
	requestClientInfo,
	requestSummary,
	requestQueryHints,
	summarizeBulkBody,
	summarizeAggregatePipeline,
	summarizePostQueryBody,
	summarizeRequestDetail,
	logRequestError,
	logAndThrow,
};
