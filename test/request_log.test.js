const { expect } = require("chai");
const {
	requestSummary,
	requestQueryHints,
	requestClientInfo,
	clientIp,
	authHint,
	summarizeBulkBody,
	summarizeAggregatePipeline,
} = require("../dist/libs/request_log");

describe("request_log", () => {
	it("formats request summary with model and user", () => {
		const s = requestSummary(
			{ method: "POST", url: "/bulkwrite/whitebeard_customer", modelname: "whitebeard_customer" },
			{ user: { email: "admin@example.com", admin: true } }
		);
		expect(s).to.include("POST /bulkwrite/whitebeard_customer");
		expect(s).to.include("model=whitebeard_customer");
		expect(s).to.include("user=admin@example.com");
		expect(s).to.include("admin");
	});

	it("summarizes bulk operation types", () => {
		const s = summarizeBulkBody([
			{ updateOne: { filter: { id: 1 }, update: { $set: { x: 1 } } } },
			{ updateOne: { filter: { id: 2 }, update: { $set: { y: 2 } }, upsert: true } },
			{ insertOne: { document: { z: 3 } } },
		]);
		expect(s).to.eql("bulk[3 updateOne:2 insertOne:1]");
	});

	it("formats query hints for list GET", () => {
		const s = requestQueryHints({
			query: { limit: "50", page: "2", filter: { status: "active", type: "x" } },
		});
		expect(s).to.include("?limit=50");
		expect(s).to.include("?page=2");
		expect(s).to.include("filterKeys=2");
	});

	it("summarizes aggregate pipeline stages", () => {
		const s = summarizeAggregatePipeline([
			{ $match: { foo: 1 } },
			{ $group: { _id: "$bar" } },
			{ $limit: 10 },
		]);
		expect(s).to.eql("aggregate[3 $match:1 $group:1 $limit:1]");
	});

	it("resolves client IP from X-Forwarded-For", () => {
		expect(
			clientIp({
				headers: { "x-forwarded-for": "203.0.113.50, 10.0.0.1" },
				connection: { remoteAddress: "127.0.0.1" },
			})
		).to.eql("203.0.113.50");
	});

	it("prefers req.ip when set", () => {
		expect(
			clientIp({
				ip: "198.51.100.2",
				headers: { "x-forwarded-for": "203.0.113.50" },
			})
		).to.eql("198.51.100.2");
	});

	it("detects auth method without leaking credentials", () => {
		expect(authHint({ query: { apikey: "secret-key" } })).to.eql("apikey-query");
		expect(authHint({ headers: { authorization: "Bearer abc" } })).to.eql("bearer");
		expect(authHint({ headers: { "x-api-key": "secret" } })).to.eql("apikey-header");
	});

	it("formats client info for error logs", () => {
		const s = requestClientInfo({
			ip: "203.0.113.9",
			headers: { "user-agent": "jxp-helper/1.4", authorization: "Bearer x" },
		});
		expect(s).to.include("ip=203.0.113.9");
		expect(s).to.include("ua=jxp-helper/1.4");
		expect(s).to.include("auth=bearer");
	});
});
