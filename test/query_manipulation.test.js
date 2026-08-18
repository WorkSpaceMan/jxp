const { expect } = require("chai");
const { Types: { ObjectId } } = require("mongoose");
const { fix_query } = require("../dist/libs/query_manipulation");

const ID_A = "507f1f77bcf86cd799439011";
const ID_B = "507f191e810c19729de860ea";

describe("query_manipulation.fix_query", () => {
	it("converts a single $oid wrapper", () => {
		const result = fix_query({ $match: { _id: { $oid: ID_A } } });
		expect(result.$match._id).to.be.instanceOf(ObjectId);
		expect(result.$match._id.toString()).to.equal(ID_A);
	});

	it("converts a single ObjectId() string", () => {
		const result = fix_query({ $match: { _id: `ObjectId("${ID_A}")` } });
		expect(result.$match._id).to.be.instanceOf(ObjectId);
		expect(result.$match._id.toString()).to.equal(ID_A);
	});

	it("converts ObjectId() strings inside $in without collapsing the array", () => {
		const result = fix_query({
			$match: {
				_id: { $in: [`ObjectId("${ID_A}")`, `ObjectId("${ID_B}")`] },
			},
		});
		expect(result.$match._id.$in).to.be.an("array").with.lengthOf(2);
		expect(result.$match._id.$in[0]).to.be.instanceOf(ObjectId);
		expect(result.$match._id.$in[1]).to.be.instanceOf(ObjectId);
		expect(result.$match._id.$in[0].toString()).to.equal(ID_A);
		expect(result.$match._id.$in[1].toString()).to.equal(ID_B);
	});

	it("converts $oid wrappers inside $in arrays", () => {
		const result = fix_query({
			$match: {
				_id: { $in: [{ $oid: ID_A }, { $oid: ID_B }] },
			},
		});
		expect(result.$match._id.$in).to.be.an("array").with.lengthOf(2);
		expect(result.$match._id.$in[0]).to.be.instanceOf(ObjectId);
		expect(result.$match._id.$in[1]).to.be.instanceOf(ObjectId);
		expect(result.$match._id.$in[0].toString()).to.equal(ID_A);
		expect(result.$match._id.$in[1].toString()).to.equal(ID_B);
	});

	it("leaves non-ObjectId $in arrays intact", () => {
		const result = fix_query({ $match: { urlid: { $in: ["foo", "bar"] } } });
		expect(result.$match.urlid.$in).to.eql(["foo", "bar"]);
	});

	it("converts a single $date wrapper", () => {
		const result = fix_query({ $match: { sent_at: { $date: "2026-01-01T00:00:00.000Z" } } });
		expect(result.$match.sent_at).to.be.instanceOf(Date);
		expect(result.$match.sent_at.toISOString()).to.equal("2026-01-01T00:00:00.000Z");
	});

	it("converts new Date() strings and relative_date() strings", () => {
		const result = fix_query({
			$match: {
				sent_at: { $gte: 'new Date("2026-01-01T00:00:00.000Z")' },
				createdAt: "relative_date(-1,days,day)",
			},
		});
		expect(result.$match.sent_at.$gte).to.be.instanceOf(Date);
		expect(result.$match.sent_at.$gte.toISOString()).to.equal("2026-01-01T00:00:00.000Z");
		expect(result.$match.createdAt).to.be.instanceOf(Date);
	});

	it("leaves ordinary objects untouched", () => {
		const result = fix_query({
			$match: {
				meta: { $date: "2026-01-01T00:00:00.000Z", label: "keep-me" },
			},
		});
		expect(result.$match.meta).to.eql({
			$date: "2026-01-01T00:00:00.000Z",
			label: "keep-me",
		});
	});

	it("throws on invalid $oid wrappers like legacy ObjectId() strings do", () => {
		expect(() => fix_query({ $match: { _id: { $oid: "not-an-object-id" } } })).to.throw();
	});
});
