process.env.NODE_ENV = 'test';

var Test = require("../models/test_model");

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var init = require("./init");

var server = require("../bin/server");

chai.use(chaiHttp);

describe('Test', () => {
	bofore = init.init;

	beforeEach(done => {
		Test.remove({}, err => {
			done();
		});
	});

	describe("/GET test", () => {
		it("it should GET all the tests", (done) => {
			chai.request(server)
			.get("/api/test")
			// .auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(0);
				done();
			});
		});
	});

	describe("/POST test", () => {
		it("it should POST a new test", (done) => {
			var test = {
				foo: "Foo",
				bar: "Bar",
				yack: { yack: "yack", shmack: 1 },
				shmack: [ "do", "ray", "me" ],
				password: "password"
			};
			chai.request(server)
			.post("/api/test")
			.send(test)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("foo");
				res.body.data.should.have.property("bar");
				res.body.data.should.have.property("yack").which.should.be.an("object");
				res.body.data.should.have.property("shmack");
				res.body.data.shmack.should.be.an("array");
				res.body.data.foo.should.be.a("string");
				res.body.data.bar.should.be.a("string");
				res.body.data.foo.length.should.be.eql(3);
				res.body.data.foo.length.should.not.be.eql("password");
				done();
			});
		});
	});


});