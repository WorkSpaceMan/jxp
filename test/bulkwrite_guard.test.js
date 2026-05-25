const { expect } = require("chai");
const {
	requiredPermsForBulkOps,
	validateBulkOps,
} = require("../dist/libs/bulkwrite_guard");

describe("bulkwrite_guard", () => {
	describe("requiredPermsForBulkOps", () => {
		it("requires update only for updateOne without upsert", () => {
			const perms = requiredPermsForBulkOps([
				{ updateOne: { filter: { foo: 1 }, update: { $set: { bar: 2 } } } },
			]);
			expect([...perms]).to.eql(["u"]);
		});

		it("requires create and update for updateOne with upsert", () => {
			const perms = requiredPermsForBulkOps([
				{
					updateOne: {
						filter: { foo: 1 },
						update: { $set: { bar: 2 } },
						upsert: true,
					},
				},
			]);
			expect([...perms].sort()).to.eql(["c", "u"]);
		});

		it("requires update only for replaceOne without upsert", () => {
			const perms = requiredPermsForBulkOps([
				{ replaceOne: { filter: { foo: 1 }, replacement: { bar: 2 } } },
			]);
			expect([...perms]).to.eql(["u"]);
		});

		it("requires create and update for replaceOne with upsert", () => {
			const perms = requiredPermsForBulkOps([
				{
					replaceOne: {
						filter: { foo: 1 },
						replacement: { bar: 2 },
						upsert: true,
					},
				},
			]);
			expect([...perms].sort()).to.eql(["c", "u"]);
		});

		it("unions perms when batch mixes upsert and non-upsert updates", () => {
			const perms = requiredPermsForBulkOps([
				{ updateOne: { filter: { a: 1 }, update: { $set: { x: 1 } } } },
				{
					updateOne: {
						filter: { b: 2 },
						update: { $set: { y: 2 } },
						upsert: true,
					},
				},
			]);
			expect([...perms].sort()).to.eql(["c", "u"]);
		});

		it("requires create for insertOne", () => {
			const perms = requiredPermsForBulkOps([
				{ insertOne: { document: { foo: "x" } } },
			]);
			expect([...perms]).to.eql(["c"]);
		});

		it("requires delete for deleteOne", () => {
			const perms = requiredPermsForBulkOps([
				{ deleteOne: { filter: { foo: 1 } } },
			]);
			expect([...perms]).to.eql(["d"]);
		});

		it("unions permissions across multiple operations", () => {
			const perms = requiredPermsForBulkOps([
				{ insertOne: { document: { foo: "a" } } },
				{ deleteOne: { filter: { foo: "b" } } },
			]);
			expect([...perms].sort()).to.eql(["c", "d"]);
		});
	});

	describe("validateBulkOps", () => {
		it("rejects updateMany for non-admin", () => {
			expect(() =>
				validateBulkOps([{ updateMany: { filter: {}, update: { $set: { x: 1 } } } }], {
					isAdmin: false,
				})
			).to.throw(/requires admin/);
		});

		it("allows updateMany for admin", () => {
			expect(() =>
				validateBulkOps([{ updateMany: { filter: {}, update: { $set: { x: 1 } } } }], {
					isAdmin: true,
				})
			).not.to.throw();
		});
	});
});
