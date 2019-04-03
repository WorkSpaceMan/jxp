process.env.NODE_ENV = 'test';

var Test = require("../models/test_model");

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var init = require("./init");

var server = require("../bin/server");

chai.use(chaiHttp);

describe('Test', () => {
	before = init.init;

	describe("/GET test", () => {
		it("it should GET all the tests", (done) => {
			Test.deleteMany(() => {
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
	});

	var post_id = null;
	describe("/POST test", () => {
		it("it should POST a new test", (done) => {
			var test = {
				foo: "Foo",
				bar: "Bar",
				yack: { yack: "yack", shmack: 1 },
				shmack: [ "do", "ray", "me" ],
				password: "password",
				fulltext: "In Xanadu did Kulba Khan a stately pleasure dome decree",
			};
			chai.request(server)
			.post("/api/test")
			.auth(init.email, init.password)
			.send(test)
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
				post_id = res.body.data._id;
				done();
			});
		});
	});

	describe("/PUT test", () => {
		it("it should PUT a new test", (done) => {
			var test = {
				foo: "Foo1",
			};
			chai.request(server)
			.put("/api/test/" + post_id)
			.send(test)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("foo")
				res.body.data.foo.should.eql("Foo1");
				done();
			});
		});
	});

	describe("Search test", () => {
		it("it should search all the tests", (done) => {
			chai.request(server)
			.get("/api/test?search=Xanadu")
			// .auth(init.email, init.password)
			.end((err, res) => {
				console.log(res.body);
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(1);
				res.body.data[0].score.should.be.a("number");
				done();
			});
		});
	});

	describe("/GET test", () => {
		it("it should GET a single test", (done) => {
			chai.request(server)
			.get("/api/test/" + post_id)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.an('object');
				res.body.should.have.property("_id");
				res.body.should.have.property("foo")
				res.body.foo.should.eql("Foo1");
				done();
			});
		});
	});

	describe("Link test", () => {
		var link_id = null;
		it("should add a LINK item", done => {
			let data = {
				name: "name1",
				val: "val1"
			}
			chai.request(server)
			.post("/api/link")
			.auth(init.email, init.password)
			.send(data)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("name")
				res.body.data.name.should.eql("name1");
				link_id = res.body.data._id;
				done();
			});
		});
		it("should link a LINK item to a TEST", done => {
			chai.request(server)
			.put("/api/test/" + post_id)
			.auth(init.email, init.password)
			.send({link_id})
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("link_id")
				res.body.data.link_id.should.eql(link_id);
				done();
			});
		});
		it("should autopopulate on a single record", done => {
			chai.request(server)
			.get(`/api/test/${post_id}?autopopulate=true`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.have.property("link_id")
				res.body.link_id.should.be.an('object');
				res.body.link_id.name.should.eql("name1");
				res.body.link_id.val.should.eql("val1");
				done();
			});
		});
		it("should autopopulate on all records", done => {
			chai.request(server)
			.get(`/api/test?autopopulate=true`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data[0].should.have.property("link_id")
				res.body.data[0].link_id.should.be.an('object');
				res.body.data[0].link_id.name.should.eql("name1");
				res.body.data[0].link_id.val.should.eql("val1");
				done();
			});
		});
		it("should populate link_id on a single record", done => {
			chai.request(server)
			.get(`/api/test/${post_id}?populate=link_id`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.have.property("link_id")
				res.body.link_id.should.be.an('object');
				res.body.link_id.name.should.eql("name1");
				res.body.link_id.val.should.eql("val1");
				done();
			});
		});
		it("should populate link_id on all records", done => {
			chai.request(server)
			.get(`/api/test?populate=link_id`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data[0].should.have.property("link_id")
				res.body.data[0].link_id.should.be.an('object');
				res.body.data[0].link_id.name.should.eql("name1");
				res.body.data[0].link_id.val.should.eql("val1");
				done();
			});
		});
		it("should populate just val from link_id on a single record", done => {
			chai.request(server)
			.get(`/api/test/${post_id}?populate[link_id]=val`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.link_id.should.have.property("val")
				res.body.link_id.should.not.have.property("name")
				res.body.link_id.should.be.an('object');
				res.body.link_id.val.should.eql("val1");
				done();
			});
		});
		it("should populate just val from link_id on all records", done => {
			chai.request(server)
			.get(`/api/test?populate[link_id]=val`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data[0].link_id.should.have.property("val")
				res.body.data[0].link_id.should.not.have.property("name")
				res.body.data[0].link_id.val.should.eql("val1");
				done();
			});
		});
		it("should populate name and val from link_id on a single record", done => {
			chai.request(server)
			.get(`/api/test/${post_id}?populate[link_id]=val,name`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.link_id.should.have.property("val")
				res.body.link_id.should.have.property("name")
				res.body.link_id.should.be.an('object');
				res.body.link_id.val.should.eql("val1");
				done();
			});
		});
		it("should populate name and val from link_id on all records", done => {
			chai.request(server)
			.get(`/api/test?populate[link_id]=val,name`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data[0].link_id.should.have.property("val")
				res.body.data[0].link_id.should.have.property("name")
				res.body.data[0].link_id.val.should.eql("val1");
				done();
			});
		});
	});
});
