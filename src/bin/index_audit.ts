#! /usr/bin/env node
import mongoose from "mongoose";
import { Command } from "commander";
import { loadEnv, getMongoConnectionString, loadJxpConfig } from "../libs/load-config";

const schemaModule = require("../libs/schema");
global.JXPSchema = schemaModule.default || schemaModule;
import {
	auditAllModels,
	formatAuditReportHuman,
	loadModelsFromDir,
	syncAllModels,
	SYNC_CONFIRM_PHRASE,
} from "../libs/index_diagnostics";

const pkg = require("../../package.json");

loadEnv();

const program = new Command();
program
	.name("jxp-indexes")
	.description("Compare Mongoose schema indexes to MongoDB and optionally sync")
	.version(pkg.version)
	.option("--json", "Output JSON report")
	.option("--unused", "Include $indexStats unused index hints")
	.option("--sync", "Apply syncIndexes (create missing, drop extras)")
	.option(
		"--confirm <phrase>",
		`Required with --sync; must be "${SYNC_CONFIRM_PHRASE}"`
	)
	.parse();

const opts = program.opts<{
	json?: boolean;
	unused?: boolean;
	sync?: boolean;
	confirm?: string;
}>();

async function main(): Promise<void> {
	const config = loadJxpConfig();
	const modelDir = config.model_dir || "./dist/models";

	await mongoose.connect(getMongoConnectionString());
	const models = loadModelsFromDir(modelDir);

	if (opts.sync) {
		const results = await syncAllModels(models, { confirm: opts.confirm });
		if (opts.json) {
			console.log(JSON.stringify({ sync: results }, null, 2));
		} else {
			for (const r of results) {
				if (r.error) {
					console.log(`${r.modelName}: ERROR ${r.error}`);
				} else {
					console.log(
						`${r.modelName}: synced (created: ${(r.created || []).length}, dropped: ${(r.dropped || []).length})`
					);
				}
			}
		}
		const failed = results.filter((r) => r.error);
		await mongoose.disconnect();
		process.exit(failed.length ? 1 : 0);
		return;
	}

	const report = await auditAllModels(models, { includeUnused: !!opts.unused });

	if (opts.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(formatAuditReportHuman(report));
	}

	await mongoose.disconnect();
	const hasProblems = report.collections.some((c) => !c.ok);
	process.exit(hasProblems ? 1 : 0);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
