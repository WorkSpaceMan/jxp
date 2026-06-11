import jwt from "jsonwebtoken";
import path from "path";
import errors from "restify-errors";
import type { JXPConfig, JXPRequest, JXPResponse } from "../types/jxp-config";

export type DocsAccess = "protected" | "disabled" | "public";

export const DOCS_SESSION_COOKIE = "jxp_docs_session";
const SESSION_MAX_AGE_SEC = 86400;

export interface DocsSessionPayload {
	user_id: string;
	email: string;
	apikey: string;
}

let sharedSecret: string | undefined;

export function parseDocsAccess(raw?: string): DocsAccess {
	const v = (raw ?? "protected").toLowerCase().trim();
	if (v === "disabled" || v === "off" || v === "false" || v === "0") return "disabled";
	if (v === "public" || v === "open") return "public";
	return "protected";
}

export function getDocsAccess(config: JXPConfig): DocsAccess {
	return config.docs?.access ?? "protected";
}

/** Routes that require a docs session (model browser + interactive API). */
export function isProtectedDocsPath(pathname: string): boolean {
	return (
		pathname === "/docs/api" ||
		pathname === "/docs/mcp" ||
		pathname.startsWith("/docs/model/") ||
		pathname === "/docs/diagnostics" ||
		pathname === "/docs/mcp/call"
	);
}

export function isDocsLoginPath(pathname: string): boolean {
	return pathname === "/docs/login";
}

function parseCookies(header: string | undefined): Record<string, string> {
	if (!header) return {};
	return header.split(";").reduce<Record<string, string>>((acc, part) => {
		const idx = part.indexOf("=");
		if (idx === -1) return acc;
		const key = part.slice(0, idx).trim();
		const val = part.slice(idx + 1).trim();
		if (key) acc[key] = decodeURIComponent(val);
		return acc;
	}, {});
}

export function verifyDocsSession(req: JXPRequest): DocsSessionPayload | null {
	if (!sharedSecret) return null;
	const cookies = parseCookies(req.headers.cookie as string | undefined);
	const token = cookies[DOCS_SESSION_COOKIE];
	if (!token) return null;
	try {
		return jwt.verify(token, sharedSecret) as DocsSessionPayload;
	} catch {
		return null;
	}
}

function signDocsSession(payload: DocsSessionPayload): string {
	if (!sharedSecret) throw new Error("SHARED_SECRET is required for docs session");
	return jwt.sign(payload, sharedSecret, { expiresIn: SESSION_MAX_AGE_SEC });
}

function setSessionCookie(res: JXPResponse, token: string): void {
	const secure = process.env.DOCS_COOKIE_SECURE === "1" || process.env.DOCS_COOKIE_SECURE === "true";
	const parts = [
		`${DOCS_SESSION_COOKIE}=${encodeURIComponent(token)}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${SESSION_MAX_AGE_SEC}`,
	];
	if (secure) parts.push("Secure");
	res.header("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res: JXPResponse): void {
	res.header(
		"Set-Cookie",
		`${DOCS_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
	);
}

/** Restify redirect() always requires next; use this in async route handlers. */
function sendRedirect(res: JXPResponse, url: string): void {
	res.status(302);
	res.header("Location", url);
	res.end();
}

export function init(config: JXPConfig): void {
	sharedSecret = config.shared_secret;
}

type Next = (err?: unknown) => void;

export function docsAccessMiddleware(req: JXPRequest, res: JXPResponse, next: Next): void {
	const pathname = req.path();
	if (!isProtectedDocsPath(pathname)) {
		return next();
	}
	const access = getDocsAccess(req.config);
	if (access === "public") {
		return next();
	}
	if (access === "disabled") {
		return next(new errors.NotFoundError("Not found"));
	}
	const session = verifyDocsSession(req);
	if (!session) {
		if (req.method === "GET") {
			const nextUrl = encodeURIComponent(pathname);
			res.redirect(302, `/docs/login?next=${nextUrl}`, next);
			return;
		}
		return next(new errors.UnauthorizedError("Docs login required"));
	}
	(req as JXPRequest & { docsSession?: DocsSessionPayload }).docsSession = session;
	return next();
}

export async function loginPage(
	req: JXPRequest,
	res: JXPResponse,
	renderLogin: (res: JXPResponse, data: Record<string, unknown>) => void,
): Promise<void> {
	const access = getDocsAccess(req.config);
	if (access === "disabled") {
		throw new errors.NotFoundError("Not found");
	}
	if (access === "public") {
		sendRedirect(res, "/docs/api");
		return;
	}
	const session = verifyDocsSession(req);
	if (session) {
		const nextPath =
			typeof req.query.next === "string" && req.query.next.startsWith("/")
				? req.query.next
				: "/docs/api";
		sendRedirect(res, nextPath);
		return;
	}
	const nextDefault =
		typeof req.query.next === "string" && req.query.next.startsWith("/")
			? req.query.next
			: "/docs/api";
	renderLogin(res, {
		docs_user_email: req.config.docs?.user_email ?? "",
		docs_next: nextDefault,
	});
}

/** Store docs session after a successful POST /login (client sends apikey from login response). */
export async function establishSession(req: JXPRequest, res: JXPResponse): Promise<void> {
	const access = getDocsAccess(req.config);
	if (access !== "protected") {
		throw new errors.NotFoundError("Not found");
	}
	const apikey = String(req.body?.apikey ?? "").trim();
	if (!apikey) {
		throw new errors.BadRequestError("apikey is required");
	}
	const security = require("./security");
	let user: { _id: unknown; email: string };
	try {
		user = await security.apiKeyAuth(apikey);
	} catch {
		throw new errors.UnauthorizedError("Invalid apikey");
	}
	const token = signDocsSession({
		user_id: String(user._id),
		email: user.email,
		apikey,
	});
	setSessionCookie(res, token);
	res.send({ ok: true });
}

export async function getSession(req: JXPRequest, res: JXPResponse): Promise<void> {
	const access = getDocsAccess(req.config);
	if (access !== "protected") {
		res.send({ apikey: null });
		return;
	}
	const docsSession = verifyDocsSession(req);
	if (!docsSession) {
		throw new errors.UnauthorizedError("Not authenticated");
	}
	res.send({ apikey: docsSession.apikey });
}

export async function logout(req: JXPRequest, res: JXPResponse): Promise<void> {
	clearSessionCookie(res);
	sendRedirect(res, "/");
}

export function logDocsAccessMode(config: JXPConfig): void {
	if (config.quiet_startup) return;
	const access = getDocsAccess(config);
	if (access === "disabled") {
		console.log("API docs browser: disabled (DOCS_ACCESS=disabled)");
	} else if (access === "public") {
		console.log("API docs browser: public (no login for model explorer)");
	} else {
		console.log("API docs browser: protected (login required for /docs/api, /docs/mcp, and /docs/model/*)");
	}
}
