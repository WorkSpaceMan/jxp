const fs = require("fs");
const os = require("os");
const path = require("path");
const { expect } = require("chai");
const {
	loadAppModels,
	loadBuiltinModels,
	loadAllModels,
	getModelFromRegistry,
	resolveModelFilterName,
	getJxpBuiltinModelsDir,
	BUILTIN_MODEL_SLUGS,
} = require("../dist/libs/builtin_models");

describe("builtin_models", () => {
	it("exposes built-in slugs including indexquerylog", () => {
		expect(BUILTIN_MODEL_SLUGS).to.include("indexquerylog");
		expect(BUILTIN_MODEL_SLUGS).to.include("user");
	});

	it("resolves jxp package models directory", () => {
		const dir = getJxpBuiltinModelsDir();
		expect(fs.existsSync(dir)).to.be.true;
		expect(fs.existsSync(path.join(dir, "user_model.js"))).to.be.true;
		expect(fs.existsSync(path.join(dir, "indexquerylog_model.js"))).to.be.true;
	});

	it("loadAllModels adds indexquerylog when absent from empty app dir", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jxp-models-"));
		try {
			const models = loadAllModels(tmp);
			expect(models).to.have.property("indexquerylog");
			expect(models.indexquerylog.modelName).to.eql("IndexQueryLog");
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("app user model overrides built-in user", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jxp-models-"));
		const stubUser = { modelName: "AppUserStub" };
		try {
			fs.writeFileSync(
				path.join(tmp, "user_model.js"),
				`module.exports = ${JSON.stringify(stubUser)};`
			);
			const models = loadAllModels(tmp);
			expect(models.user).to.eql(stubUser);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("loadBuiltinModels respects JXP_BUILTIN_MODELS=none", () => {
		const prev = process.env.JXP_BUILTIN_MODELS;
		process.env.JXP_BUILTIN_MODELS = "none";
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jxp-models-"));
		try {
			const models = {};
			loadBuiltinModels(models);
			expect(models).to.not.have.property("indexquerylog");
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
			if (prev === undefined) delete process.env.JXP_BUILTIN_MODELS;
			else process.env.JXP_BUILTIN_MODELS = prev;
		}
	});

	it("getModelFromRegistry throws when slug missing", () => {
		expect(() => getModelFromRegistry({}, "missing")).to.throw(/not loaded/);
	});

	it("resolveModelFilterName maps slug or modelName", () => {
		const models = { reader: { modelName: "Reader" } };
		expect(resolveModelFilterName(models, "reader")).to.eql("Reader");
		expect(resolveModelFilterName(models, "Reader")).to.eql("Reader");
		expect(resolveModelFilterName(models, "READER")).to.eql("Reader");
	});
});
