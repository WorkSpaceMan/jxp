const { expect } = require("chai");
const {
	normalizeByteSizeString,
	parseByteSize,
	parseByteSizeOr,
} = require("../dist/libs/parse_byte_size");

describe("parse_byte_size", () => {
	it("normalizes shorthand units", () => {
		expect(normalizeByteSizeString("10M")).to.equal("10mb");
		expect(normalizeByteSizeString("10kb")).to.equal("10kb");
		expect(normalizeByteSizeString("1.5 G")).to.equal("1.5gb");
	});

	it("parses human-friendly sizes", () => {
		expect(parseByteSize("10mb")).to.equal(10 * 1024 * 1024);
		expect(parseByteSize("10M")).to.equal(10 * 1024 * 1024);
		expect(parseByteSize("10kb")).to.equal(10 * 1024);
		expect(parseByteSize(512)).to.equal(512);
	});

	it("returns 0 for disabled", () => {
		expect(parseByteSize("0")).to.equal(0);
		expect(parseByteSize("0b")).to.equal(0);
	});

	it("throws on invalid values", () => {
		expect(() => parseByteSize("not-a-size")).to.throw(/not a valid byte size/i);
	});

	it("parseByteSizeOr uses fallback when missing", () => {
		expect(parseByteSizeOr(undefined, "10mb")).to.equal(10 * 1024 * 1024);
	});
});
