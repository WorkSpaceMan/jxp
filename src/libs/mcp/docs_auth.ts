import errors from "restify-errors";
import type { JXPRequest } from "../../types/jxp-config";
import { verifyDocsSession } from "../docs-auth";
import { authenticateMcpRequest } from "./auth";
import type { McpAuthContext } from "./model_visibility";
import { getMcpConfig } from "./config";

function headerApiKey(req: JXPRequest): string | undefined {
	const raw = req.headers["x-api-key"];
	if (Array.isArray(raw)) return raw[0]?.trim() || undefined;
	return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

/** Resolve MCP auth for docs playground: navbar key, then HttpOnly session. */
export async function authenticateDocsMcpRequest(req: JXPRequest): Promise<McpAuthContext> {
	const mcpConfig = getMcpConfig();
	const fromHeader = headerApiKey(req);
	if (fromHeader) {
		req.headers["x-api-key"] = fromHeader;
		return authenticateMcpRequest(req as unknown as import("node:http").IncomingMessage, mcpConfig.requireApiKey);
	}

	const session = (req as JXPRequest & { docsSession?: { apikey: string } }).docsSession
		?? verifyDocsSession(req);
	if (session?.apikey) {
		req.headers["x-api-key"] = session.apikey;
		return authenticateMcpRequest(req as unknown as import("node:http").IncomingMessage, mcpConfig.requireApiKey);
	}

	if (mcpConfig.requireApiKey) {
		throw new errors.UnauthorizedError("API key required (top bar or sign in)");
	}
	return authenticateMcpRequest(req as unknown as import("node:http").IncomingMessage, false);
}
