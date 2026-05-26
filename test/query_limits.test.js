const { expect } = require("chai");
const errors = require("restify-errors");
const {
	getLimits,
	parseRequestedLimit,
	hasClientFilter,
	shouldRunCount,
	enforceListLimit,
	enforceResponseSize,
	finalizeListPagination,
	DEFAULTS,
} = require("../dist/libs/query_limits");

function mockReq(overrides = {}) {
	return {
		modelname: "reader",
		query: {},
		config: { query_limits: { enabled: true, large_collection_threshold: 10000, max: 1000 } },
		Model: { schema: { opts: {} } },
		...overrides,
	};
}

const noopChangeUrl = () => "http://example/next";

describe("query_limits", () => {
	it("returns defaults merged with config", () => {
		const limits = getLimits(mockReq({ config: { query_limits: { max: 500 } } }));
		expect(limits.max).to.equal(500);
		expect(limits.large_collection_threshold).to.equal(10000);
		expect(limits.max_response_bytes).to.equal(10 * 1024 * 1024);
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

	it("hasClientFilter detects query.filter and body query", () => {
		expect(hasClientFilter(mockReq())).to.be.false;
		expect(hasClientFilter(mockReq({ query: { filter: {} } }))).to.be.false;
		expect(hasClientFilter(mockReq({ query: { filter: { status: "active" } } }))).to.be.true;
		expect(hasClientFilter(mockReq(), { foo: "bar" })).to.be.true;
		expect(hasClientFilter(mockReq(), {})).to.be.false;
	});

	it("applies default limit when client omits limit", () => {
		const { limit } = enforceListLimit(mockReq(), 5);
		expect(limit).to.equal(100);
	});

	it("shouldRunCount is false without page or count", () => {
		expect(shouldRunCount(mockReq())).to.be.false;
		expect(shouldRunCount(mockReq({ query: { count: "true" } }))).to.be.true;
		expect(shouldRunCount(mockReq({ query: { page: "2" } }))).to.be.true;
	});

	it("shouldRunCount when filter exemption or limit capped", () => {
		expect(shouldRunCount(mockReq(), { filterExemption: true })).to.be.true;
		expect(shouldRunCount(mockReq(), { limitCapped: true })).to.be.true;
	});

	it("requires limit on large collections without filter", () => {
		expect(() => enforceListLimit(mockReq(), 50000)).to.throw(errors.BadRequestError);
	});

	it("allows default limit on large collections with filter", () => {
		const req = mockReq({ query: { filter: { status: "active" } } });
		const { limit, filterExemption } = enforceListLimit(req, 50000, null, {
			bodyQuery: { status: "active" },
		});
		expect(limit).to.equal(100);
		expect(filterExemption).to.be.true;
	});

	it("caps limit above max instead of throwing", () => {
		const result = {};
		const { limit, limitCapped } = enforceListLimit(
			mockReq({ query: { limit: "5000" } }),
			50000,
			null,
			{ result }
		);
		expect(limit).to.equal(1000);
		expect(limitCapped).to.be.true;
		expect(result.limit_capped).to.be.true;
	});

	it("returns effective limit when valid", () => {
		const { limit } = enforceListLimit(mockReq({ query: { limit: "50" } }), 50000);
		expect(limit).to.equal(50);
	});

	it("respects enabled: false", () => {
		const req = mockReq({
			config: { query_limits: { enabled: false, large_collection_threshold: 0, max: 1000 } },
			query: { limit: "25" },
		});
		expect(enforceListLimit(req, 999999).limit).to.equal(25);
		expect(enforceListLimit(mockReq({ config: { query_limits: { enabled: false } } }), 999999).limit).to.be.null;
	});

	it("uses DEFAULTS when config missing", () => {
		const limits = getLimits({ Model: { schema: { opts: {} } } });
		expect(limits.large_collection_threshold).to.equal(DEFAULTS.large_collection_threshold);
	});

	it("finalizeListPagination sets has_more when count unknown and page full", () => {
		const result = { page: 1 };
		finalizeListPagination(result, mockReq(), 100, 100, -1, noopChangeUrl);
		expect(result.has_more).to.be.true;
		expect(result.next).to.equal("http://example/next");
	});

	it("enforceResponseSize throws when over limit", () => {
		const req = mockReq({
			config: { query_limits: { max_response_size: "50b" } },
		});
		expect(() =>
			enforceResponseSize({ data: [{ x: "a".repeat(100) }] }, req)
		).to.throw(errors.PayloadTooLargeError);
	});

	it("parses max_response_size from per-model opts", () => {
		const limits = getLimits(mockReq({
			Model: { schema: { opts: { query_limits: { max_response_size: "512kb" } } } },
		}));
		expect(limits.max_response_bytes).to.equal(512 * 1024);
	});

	it("enforceResponseSize no-op when disabled", () => {
		const req = mockReq({
			config: { query_limits: { max_response_size: "0" } },
		});
		expect(() =>
			enforceResponseSize({ data: [{ x: "a".repeat(10000) }] }, req)
		).to.not.throw();
	});
});
