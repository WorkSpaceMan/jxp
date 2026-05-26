import fs from "fs";
import path from "path";
import type { Model } from "mongoose";

/** Framework models loaded from the jxp package when absent from MODEL_DIR. */
export const BUILTIN_MODEL_SLUGS = [
	"user",
	"apikey",
	"token",
	"refreshtoken",
	"usergroups",
	"indexquerylog",
] as const;

export type BuiltinModelSlug = (typeof BUILTIN_MODEL_SLUGS)[number];

export type ModelRegistry = Record<string, Model<unknown>>;

function resolveModelDir(modelDir: string): string {
	return modelDir.charAt(0) === "/" ? modelDir : path.resolve(process.cwd(), modelDir);
}

/** Root of the installed jxp package (works with npm install and link:jxp). */
export function getJxpPackageRoot(): string {
	try {
		return path.dirname(require.resolve("jxp/package.json"));
	} catch {
		return path.join(__dirname, "..", "..");
	}
}

/** Compiled built-in model files shipped with jxp. */
export function getJxpBuiltinModelsDir(): string {
	return path.join(getJxpPackageRoot(), "dist", "models");
}

function parseBuiltinSlugsFromEnv(): BuiltinModelSlug[] | null {
	const raw = process.env.JXP_BUILTIN_MODELS?.trim().toLowerCase();
	if (!raw || raw === "default") return null;
	if (raw === "none" || raw === "false" || raw === "0") return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter((s): s is BuiltinModelSlug =>
			(BUILTIN_MODEL_SLUGS as readonly string[]).includes(s)
		);
}

export function getEnabledBuiltinSlugs(): BuiltinModelSlug[] {
	const fromEnv = parseBuiltinSlugsFromEnv();
	if (fromEnv !== null) return fromEnv;
	return [...BUILTIN_MODEL_SLUGS];
}

/** Load `*_model.js` from the application MODEL_DIR. */
export function loadAppModels(modelDir: string): ModelRegistry {
	const models: ModelRegistry = {};
	const resolved = resolveModelDir(modelDir);
	if (!fs.existsSync(resolved)) {
		return models;
	}
	const files = fs.readdirSync(resolved).filter((f) => f.endsWith("_model.js"));
	for (const fname of files) {
		const slug = fname.replace("_model.js", "");
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require(path.join(resolved, fname));
		models[slug] = mod.default || mod;
	}
	return models;
}

/** Fill missing slugs from jxp package `dist/models`. App models always win. */
export function loadBuiltinModels(models: ModelRegistry, slugs?: BuiltinModelSlug[]): void {
	const enabled = slugs ?? getEnabledBuiltinSlugs();
	if (!enabled.length) return;

	const builtinDir = getJxpBuiltinModelsDir();
	if (!fs.existsSync(builtinDir)) return;

	for (const slug of enabled) {
		if (models[slug]) continue;
		const fname = `${slug}_model.js`;
		const full = path.join(builtinDir, fname);
		if (!fs.existsSync(full)) continue;
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require(full);
		models[slug] = mod.default || mod;
	}
}

/** App MODEL_DIR first, then jxp built-ins for any missing slugs. */
export function loadAllModels(modelDir: string): ModelRegistry {
	const models = loadAppModels(modelDir);
	loadBuiltinModels(models);
	return models;
}

export function getModelFromRegistry(models: ModelRegistry, slug: string): Model<unknown> {
	const model = models[slug];
	if (!model) {
		throw new Error(
			`Model "${slug}" is not loaded. Add ${slug}_model.js to MODEL_DIR or enable jxp built-in models.`
		);
	}
	return model;
}

export function isInternalModel(model: Model<unknown>): boolean {
	return (model.schema as { opts?: { internal?: boolean } }).opts?.internal === true;
}

/** Map slug or modelName input to the stored query-log model name (Mongoose modelName). */
export function resolveModelFilterName(
	models: ModelRegistry,
	input: string
): string {
	const t = input.trim();
	if (!t) return "";
	if (models[t]) return models[t].modelName;
	const bySlug = Object.entries(models).find(
		([slug]) => slug.toLowerCase() === t.toLowerCase()
	);
	if (bySlug) return bySlug[1].modelName;
	const byName = Object.values(models).find(
		(m) => m.modelName.toLowerCase() === t.toLowerCase()
	);
	return byName?.modelName ?? t;
}
