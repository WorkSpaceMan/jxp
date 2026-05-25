const { expect } = require("chai");
const errors = require("restify-errors");
const { createLoginThrottle } = require("../dist/libs/login_rate_limit");

function mockReq(ip = "203.0.113.50") {
	return {
		connection: { remoteAddress: ip },
		headers: {},
		log: {
			warn: () => {},
			info: () => {},
			debug: () => {},
			trace: () => {},
		},
	};
}

function runThrottle(throttle, ip) {
	return new Promise((resolve) => {
		const req = mockReq(ip);
		const res = { header: () => res };
		throttle(req, res, (err) => resolve({ err, req }));
	});
}

describe("login_rate_limit", () => {
	it("returns null when disabled", () => {
		expect(createLoginThrottle({ login_rate_limit: { enabled: false } })).to.be.null;
	});

	it("returns 429 after burst is exceeded for the same IP", async function () {
		this.timeout(5000);
		const throttle = createLoginThrottle({
			login_rate_limit: { enabled: true, burst: 3, per_minute: 60 },
		});
		expect(throttle).to.be.a("function");
		const ip = "203.0.113.99";
		let lastErr = null;
		for (let i = 0; i < 5; i++) {
			const { err } = await runThrottle(throttle, ip);
			lastErr = err;
		}
		expect(lastErr).to.exist;
		lastErr.should.be.instanceof(errors.TooManyRequestsError);
	});

	it("tracks limits per IP independently", async function () {
		this.timeout(5000);
		const throttle = createLoginThrottle({
			login_rate_limit: { enabled: true, burst: 2, per_minute: 60 },
		});
		await runThrottle(throttle, "203.0.113.1");
		await runThrottle(throttle, "203.0.113.1");
		const blocked = await runThrottle(throttle, "203.0.113.1");
		expect(blocked.err).to.be.instanceof(errors.TooManyRequestsError);
		const other = await runThrottle(throttle, "203.0.113.2");
		expect(other.err).to.be.undefined;
	});
});
