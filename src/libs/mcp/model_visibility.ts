import type { Model } from "mongoose";
import type { ModelRegistry } from "../builtin_models";
import { isInternalModel } from "../builtin_models";
import type { McpConfig } from "./config";

const security = require("../security");

export interface McpAuthUser {
	_id: unknown;
	email?: string;
	name?: string;
	admin?: boolean;
}

export interface McpAuthContext {
	user: McpAuthUser | null;
	groups: string[];
}

export function isDefaultHiddenModel(slug: string, model: Model<unknown>, config: McpConfig): boolean {
	if (isInternalModel(model)) return true;
	return config.defaultHiddenModels.has(slug.toLowerCase());
}

export function isVisibilityOverridden(slug: string, config: McpConfig): boolean {
	return config.modelWhitelist.has(slug.toLowerCase());
}

export function isBlacklisted(slug: string, config: McpConfig): boolean {
	return config.modelBlacklist.has(slug.toLowerCase());
}

export async function canReadModel(
	auth: McpAuthContext,
	model: Model<unknown>,
	itemId?: string
): Promise<boolean> {
	try {
		await security.check_perms(auth.user, auth.groups, model, "r", itemId);
		return true;
	} catch {
		return false;
	}
}

/**
 * Whether a model should appear in MCP list/describe and accept read tools.
 * Whitelist overrides default-hidden only; never grants read permission.
 */
export async function isModelVisibleMcp(
	slug: string,
	model: Model<unknown>,
	auth: McpAuthContext,
	config: McpConfig,
	itemId?: string
): Promise<boolean> {
	if (!(await canReadModel(auth, model, itemId))) return false;
	if (isBlacklisted(slug, config)) return false;
	if (isDefaultHiddenModel(slug, model, config) && !isVisibilityOverridden(slug, config)) {
		return false;
	}
	return true;
}

export async function assertModelVisibleMcp(
	slug: string,
	model: Model<unknown>,
	auth: McpAuthContext,
	config: McpConfig,
	itemId?: string
): Promise<void> {
	const errors = require("restify-errors");
	if (!(await canReadModel(auth, model, itemId))) {
		throw new errors.ForbiddenError(`No read access to model "${slug}"`);
	}
	if (isBlacklisted(slug, config)) {
		throw new errors.ForbiddenError(`Model "${slug}" is not available via MCP`);
	}
	if (isDefaultHiddenModel(slug, model, config) && !isVisibilityOverridden(slug, config)) {
		throw new errors.NotFoundError(`Model "${slug}" not found`);
	}
}

export async function listVisibleModels(
	models: ModelRegistry,
	auth: McpAuthContext,
	config: McpConfig
): Promise<{ slug: string; collection: string; permissions: { read: boolean } }[]> {
	const slugs = Object.keys(models).sort();
	const out: { slug: string; collection: string; permissions: { read: boolean } }[] = [];
	for (const slug of slugs) {
		const model = models[slug];
		if (await isModelVisibleMcp(slug, model, auth, config)) {
			out.push({
				slug,
				collection: model.collection.name,
				permissions: { read: true },
			});
		}
	}
	return out;
}
