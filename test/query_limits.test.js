const { expect } = require("chai");
const errors = require("restify-errors");
const {
	getLimits,
	parseRequestedLimit,
	enforceListLimit,
	DEFAULTS,
} = require("../libs/query_limits");

function mockReq(overrides = {}) {
	return {
		modelname: "reader",
		query: {},
		config: { query_limits: { enabled: true, large_collection_threshold: 10000, max: 1000 } },
		Model: { schema: { opts: {} } },
		...overrides,
	};
}

describe("query_limits", () => {
	it("returns defaults merged with config", () => {
		const limits = getLimits(mockReq({ config: { query_limits: { max: 500 } } }));
		expect(limits.max).to.equal(500);
		expect(limits.large_collection_threshold).to.equal(10000);
	});

	it("merges per-model schema opts", () => {
		const limits = getLimits(mockReq({
			Model: { schema: { opts: { query_limits: { max: 100 } } } },
		}));
		expect(limits.max).to.equal(100);
	});

	it("parseRequestedLimit rejects missing, zero, and invalid", () => {
		expect(parseRequestedLimit(mockReq())).to.be.null;
		expect(parseRequestedLimit(mockReq({ query: { limit: "0" } }))).to.be.null;
		expect(parseRequestedLimit(mockReq({ query: { limit: "abc" } }))).to.be.null;
		expect(parseRequestedLimit(mockReq({ query: { limit: "10" } }))).to.equal(10);
	});

	it("allows unbounded list on small collections", () => {
		const limit = enforceListLimit(mockReq(), 5);
		expect(limit).to.be.null;
	});

	it("requires limit on large collections", () => {
		expect(() => enforceListLimit(mockReq(), 50000)).to.throw(errors.BadRequestError);
	});

	it("rejects limit above max", () => {
		expect(() => enforceListLimit(mockReq({ query: { limit: "5000" } }), 50000))
			.to.throw(errors.BadRequestError);
	});

	it("returns effective limit when valid", () => {
		expect(enforceListLimit(mockReq({ query: { limit: "50" } }), 50000)).to.equal(50);
	});

	it("respects enabled: false", () => {
		const req = mockReq({
			config: { query_limits: { enabled: false, large_collection_threshold: 0, max: 1000 } },
			query: { limit: "25" },
		});
		expect(enforceListLimit(req, 999999)).to.equal(25);
		expect(enforceListLimit(mockReq({ config: { query_limits: { enabled: false } } }), 999999)).to.be.null;
	});

	it("uses DEFAULTS when config missing", () => {
		const limits = getLimits({ Model: { schema: { opts: {} } } });
		expect(limits.large_collection_threshold).to.equal(DEFAULTS.large_collection_threshold);
	});
});
