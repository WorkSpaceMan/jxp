const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const { expect } = require("chai");
const getModelFileContents = require("../dist/libs/schema_description");

describe("schema_description", () => {
	let tmp;

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jxp-schema-description-"));
	});

	afterEach(() => {
		for (const key of Object.keys(require.cache)) {
			if (key.startsWith(tmp)) delete require.cache[key];
		}
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	it("uses the JXP model registry without reloading model files", async () => {
		const file = path.join(tmp, "whitebeard_customer_model.js");
		fs.writeFileSync(file, 'throw new Error("model file must not be reloaded");');
		const model = {
			modelName: "whitebeardcustomer",
			schema: { get: () => ({ admin: "crud" }) },
		};

		const result = await getModelFileContents(tmp, {
			whitebeard_customer: model,
		});

		expect(result).to.deep.equal([
			{
				model: "whitebeard_customer",
				file: "whitebeard_customer_model.js",
				perms: { admin: "crud" },
			},
		]);
	});

	it("preserves the require cache for already loaded model files", async () => {
		const file = path.join(tmp, "reader_model.js");
		fs.writeFileSync(
			file,
			'module.exports = { modelName: "reader", schema: { get: () => ({ user: "r" }) } };'
		);
		require(file);
		const cacheEntry = require.cache[require.resolve(file)];

		await getModelFileContents(tmp);

		expect(require.cache[require.resolve(file)]).to.equal(cacheEntry);
	});

	it("matches underscore-separated filenames to compiled Mongoose model names", async () => {
		const file = path.join(tmp, "schema_description_customer_model.js");
		fs.writeFileSync(file, 'throw new Error("compiled model must not be overwritten");');
		const modelName = "schemadescriptioncustomer";
		const schema = new mongoose.Schema();
		schema.set("_perms", { admin: "crud" });
		mongoose.model(modelName, schema);

		try {
			const result = await getModelFileContents(tmp);
			expect(result[0].model).to.equal("schema_description_customer");
			expect(result[0].perms).to.deep.equal({ admin: "crud" });
		} finally {
			mongoose.deleteModel(modelName);
		}
	});
});
