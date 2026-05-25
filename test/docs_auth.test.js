const { expect } = require("chai");
const errors = require("restify-errors");
const jwt = require("jsonwebtoken");
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();

const docsAuth = require("../dist/libs/docs-auth");
const { DOCS_SESSION_COOKIE } = docsAuth;
const init = require("./init");

chai.use(chaiHttp);

const server = require("../dist/bin/server");

function mockReq(overrides = {}) {
	return {
		path: () => "/docs/api",
		method: "GET",
		headers: {},
		config: {
			shared_secret: process.env.SHARED_SECRET || "change-me",
			docs: { access: "protected" },
		},
		...overrides,
	};
}

/** Login via POST /login, then POST /docs/session — same flow as the docs login page. */
function docsLogin(agent, done) {
	agent
		.post("/login")
		.send({ email: init.email, password: init.password })
		.end((err, loginRes) => {
			loginRes.should.have.status(200);
			loginRes.body.should.have.property("apikey");
			agent
				.post("/docs/session")
				.send({ apikey: loginRes.body.apikey })
				.end((err2, sessRes) => {
					sessRes.should.have.status(200);
					sessRes.body.should.have.property("ok", true);
					done();
				});
		});
}

describe("docs_auth", () => {
	describe("parseDocsAccess", () => {
		it("defaults to protected", () => {
			expect(docsAuth.parseDocsAccess()).to.equal("protected");
		});

		it("parses disabled and public", () => {
			expect(docsAuth.parseDocsAccess("disabled")).to.equal("disabled");
			expect(docsAuth.parseDocsAccess("public")).to.equal("public");
		});
	});

	describe("isProtectedDocsPath", () => {
		it("only gates model explorer routes", () => {
			expect(docsAuth.isProtectedDocsPath("/docs/api")).to.be.true;
			expect(docsAuth.isProtectedDocsPath("/docs/model/user")).to.be.true;
			expect(docsAuth.isProtectedDocsPath("/")).to.be.false;
			expect(docsAuth.isProtectedDocsPath("/docs/md/api.md")).to.be.false;
			expect(docsAuth.isProtectedDocsPath("/docs/login")).to.be.false;
		});
	});

	describe("docsAccessMiddleware", () => {
		it("passes through non-protected paths", (done) => {
			const req = mockReq({ path: () => "/" });
			docsAuth.docsAccessMiddleware(req, {}, (err) => {
				expect(err).to.be.undefined;
				done();
			});
		});

		it("returns 404 when disabled", (done) => {
			const req = mockReq({ config: { docs: { access: "disabled" } } });
			docsAuth.docsAccessMiddleware(req, {}, (err) => {
				err.should.be.instanceof(errors.NotFoundError);
				done();
			});
		});

		it("redirects unauthenticated GET on /docs/api", (done) => {
			const req = mockReq();
			const res = {
				redirect(code, url, next) {
					code.should.equal(302);
					url.should.include("/docs/login");
					url.should.include("next=%2Fdocs%2Fapi");
					next();
				},
			};
			docsAuth.docsAccessMiddleware(req, res, (err) => {
				expect(err).to.be.undefined;
				done();
			});
		});
	});

	describe("verifyDocsSession", () => {
		before(() => {
			docsAuth.init({ shared_secret: process.env.SHARED_SECRET || "change-me" });
		});

		it("returns payload for a valid session cookie", () => {
			const secret = process.env.SHARED_SECRET || "change-me";
			const token = jwt.sign(
				{ user_id: "abc", email: init.email, apikey: "testkey123" },
				secret,
				{ expiresIn: 3600 },
			);
			const req = mockReq({
				headers: { cookie: `${DOCS_SESSION_COOKIE}=${encodeURIComponent(token)}` },
			});
			const session = docsAuth.verifyDocsSession(req);
			session.should.have.property("apikey", "testkey123");
		});
	});

	describe("HTTP integration", () => {
		before(async function () {
			this.timeout(10000);
			await init.init();
		});

		it("serves home and guides without a session", (done) => {
			chai.request(server)
				.get("/")
				.end((err, home) => {
					home.should.have.status(200);
					chai.request(server)
						.get("/docs/md/api.md")
						.end((err2, guide) => {
							guide.should.have.status(200);
							done();
						});
				});
		});

		it("redirects /docs/api to login without a session", (done) => {
			chai.request(server)
				.get("/docs/api")
				.redirects(0)
				.end((err, res) => {
					res.should.have.status(302);
					res.header.location.should.include("/docs/login");
					done();
				});
		});

		it("logs in via /login + /docs/session and reaches /docs/api", (done) => {
			const agent = chai.request.agent(server);
			docsLogin(agent, () => {
				agent
					.get("/docs/session")
					.end((err, sess) => {
						sess.should.have.status(200);
						sess.body.should.have.property("apikey").that.is.a("string");
						agent
							.get("/docs/api")
							.end((err2, page) => {
								page.should.have.status(200);
								page.text.should.include("API reference");
								done();
							});
					});
			});
		});

		it("rejects /docs/session without a cookie", (done) => {
			chai.request(server)
				.get("/docs/session")
				.end((err, res) => {
					res.should.have.status(401);
					done();
				});
		});

		it("rejects establishSession with invalid apikey", (done) => {
			chai.request(server)
				.post("/docs/session")
				.send({ apikey: "not-a-real-key" })
				.end((err, res) => {
					res.should.have.status(401);
					done();
				});
		});
	});
});
