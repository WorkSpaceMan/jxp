const path = require("path");
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const init = require("./init");

const model_dir = process.env.MODEL_DIR
	? path.resolve(process.cwd(), process.env.MODEL_DIR)
	: path.join(process.cwd(), "dist/models");
const testMod = require(path.join(model_dir, "test_model"));
const Test = testMod.default || testMod;

const server = require("../dist/bin/server");

chai.use(chaiHttp);

describe("security hardening", () => {
	before(async function () {
		await init.init();
	});

	it("rejects /call for unlisted static", (done) => {
		chai.request(server)
			.post("/call/test/notAllowed")
			.auth(init.email, init.password)
			.send({})
			.end((err, res) => {
				res.should.have.status(403);
				done();
			});
	});

	it("allows /call for listed static", (done) => {
		chai.request(server)
			.post("/call/test/test")
			.auth(init.email, init.password)
			.send({})
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
	});

	it("rejects filter with $where", (done) => {
		chai.request(server)
			.get('/api/test?filter[$where]=true&limit=10')
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(400);
				done();
			});
	});

	it("strips password from list responses", (done) => {
		Test.deleteMany(() => {
			const item = new Test({ foo: "pw", bar: "pwbar", password: "secret" });
			item.save(() => {
				chai.request(server)
					.get("/api/user?limit=10")
					.auth(init.email, init.password)
					.end((err, res) => {
						res.should.have.status(200);
						if (res.body.data.length) {
							res.body.data[0].should.not.have.property("password");
						}
						done();
					});
			});
		});
	});

	it("rejects password_override without admin", (done) => {
		const userMod = require(path.join(model_dir, "user_model"));
		const User = userMod.default || userMod;
		const plain = new User({
			email: "nonadmin@test.local",
			name: "Non Admin",
			password: init.password,
			admin: false,
		});
		plain.save((err, saved) => {
			if (err) return done(err);
			chai.request(server)
				.put(`/api/user/${saved._id}?password_override=1`)
				.auth(init.email, init.password)
				.send({ password: "$2a$04$fakehash" })
				.end((err2, res) => {
					res.should.have.status(403);
					done();
				});
		});
	});
});
