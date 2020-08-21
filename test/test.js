process.env.NODE_ENV = 'test';
const config = require("config");
const path = require("path");

var model_dir = config.model_dir || path.join(process.cwd(), "./models");
const Test = require(path.join(model_dir, "test_model"));

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var init = require("./init");

var server = require("../bin/server");

chai.use(chaiHttp);

describe('Test', () => {
	before = init.init;

	var apikey = null;
	var token = null;
	var refresh_token = null;

	describe("login", () => {
		it("it should login", (done) => {
			chai.request(server)
				.post("/login")
				.send({ email: init.email, password: init.password })
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property('user_id');
					res.body.should.have.property('apikey');
					res.body.should.have.property('token');
					res.body.should.have.property('token_expires');
					res.body.should.have.property('refresh_token');
					res.body.should.have.property('refresh_token_expires');
					apikey = res.body.apikey;
					token = res.body.token;
					done();
				});
		});
	});

	describe("logout", () => {
		it("should logout", done => {
			chai.request(server)
				.get("/login/logout")
				.set("Authorization", `Bearer ${token}`)
				.end((err, res) => {
					res.should.have.status(200);
					done();
				});
		})
	})

	describe("logged_out", () => {
		it("should have an expired token", done => {
			chai.request(server)
				.get("/api/test")
				.set("Authorization", `Bearer ${token}`)
				.end((err, res) => {
					res.should.have.status(403);
					done();
				});
		})
	})

	describe("login_again", () => {
		it("it should login again with the same api key but a new token", (done) => {
			chai.request(server)
				.post("/login")
				.send({ email: init.email, password: init.password })
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property('user_id');
					res.body.should.have.property('apikey');
					res.body.should.have.property('token');
					res.body.should.have.property('token_expires');
					res.body.apikey.should.be.eql(apikey);
					res.body.token.should.not.eql(token);
					token = res.body.token;
					refresh_token = res.body.refresh_token;
					done();
				});
		});
	});

	describe("refresh_token", () => {
		it("it should refresh the token", (done) => {
			chai.request(server)
				.post("/refresh")
				.set("Authorization", `Bearer ${refresh_token}`)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property('user_id');
					res.body.should.have.property('token');
					res.body.should.have.property('token_expires');
					res.body.should.have.property('refresh_token');
					res.body.should.have.property('refresh_token_expires');
					res.body.token.should.not.eql(token);
					res.body.refresh_token.should.not.eql(refresh_token);
					token = res.body.token;
					refresh_token = res.body.refresh_token;
					done();
				});
		});
	});

	describe("Authentication", () => {
		it("should authenticate with basic auth", done => {
			chai.request(server)
				.get("/api/user")
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					done();
				});
		});
		it("should authenticate with a token", done => {
			chai.request(server)
				.get("/api/user")
				.set("Authorization", `Bearer ${token}`)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					done();
				});
		})
		it("should authenticate with an API key in the header", done => {
			chai.request(server)
				.get("/api/user")
				.set("X-API-Key", apikey)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					done();
				});
		})
		it("should authenticate with an API key in the url", done => {
			chai.request(server)
				.get(`/api/user?apikey=${apikey}`)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					done();
				});
		})
		it("should fail authenticate without any auth methods", done => {
			chai.request(server)
				.get(`/api/user`)
				.end((err, res) => {
					res.should.have.status(403);
					done();
				});
		})
	})

	describe("/GET test", () => {
		it("it should GET all the tests", (done) => {
			Test.deleteMany(() => {
				chai.request(server)
				.get("/api/test")
				// .auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
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
				fulltext: "In Xanadu did Kubla Khan a stately pleasure dome decree",
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
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(1);
				res.body.data[0].score.should.be.a("number");
				done();
			});
		});
	});

	describe("/GET test", () => {
		it("it should GET a single test contained in a data object", (done) => {
			chai.request(server)
			.get("/api/test/" + post_id)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.have.property("data");
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("foo")
				res.body.data.foo.should.eql("Foo1");
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
		var other_link_id = null;
		it("should add another LINK item", done => {
			let data = {
				name: "name2",
				val: "val2"
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
				res.body.data.name.should.eql("name2");
				other_link_id = res.body.data._id;
				done();
			});
		});
		it("should link another LINK item to a TEST", done => {
			chai.request(server)
			.put("/api/test/" + post_id)
			.auth(init.email, init.password)
			.send({other_link_id})
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("other_link_id")
				res.body.data.other_link_id.should.eql(other_link_id);
				done();
			});
		});
		it("should non-descructively autopopulate on a single record", done => {
			chai.request(server)
			.get(`/api/test/${post_id}?populate=link`)
			.auth(init.email, init.password)
			.end((err, res) => {
				// console.log(res.body);
				res.should.have.status(200);
				res.body.should.have.property("data");
				res.body.data.should.have.property("link");
				res.body.data.link.should.be.an('object');
				res.body.data.link.name.should.eql("name1");
				res.body.data.link.val.should.eql("val1");
				res.body.data.should.have.property("link_id");
				res.body.data.link_id.should.be.eql(link_id);
				done();
			});
		});
		it("should non-descructively autopopulate on a single record to a specific virtual", done => {
			chai.request(server)
				.get(`/api/test/${post_id}?populate=other_link`)
				.auth(init.email, init.password)
				.end((err, res) => {
					// console.log(res.body);
					res.should.have.status(200);
					res.body.should.have.property("data");
					res.body.data.should.have.property("other_link")
					res.body.data.other_link.should.be.an('object');
					res.body.data.other_link.name.should.eql("name2");
					res.body.data.other_link.val.should.eql("val2");
					res.body.data.should.have.property("link_id");
					res.body.data.other_link_id.should.be.eql(other_link_id);
					done();
				});
		});
		it("should autopopulate on all records", done => {
			chai.request(server)
			.get(`/api/test?autopopulate=true`)
			.auth(init.email, init.password)
			.end((err, res) => {
				// console.log(res.body);
				res.should.have.status(200);
				res.body.data[0].should.have.property("link")
				res.body.data[0].link.should.be.an('object');
				res.body.data[0].link.name.should.eql("name1");
				res.body.data[0].link.val.should.eql("val1");
				res.body.data[0].should.have.property("other_link")
				res.body.data[0].other_link.should.be.an('object');
				res.body.data[0].other_link.name.should.eql("name2");
				res.body.data[0].other_link.val.should.eql("val2");
				done();
			});
		});
		it("should autopopulate on a single records", done => {
			chai.request(server)
				.get(`/api/test/${post_id}?autopopulate=true`)
				.auth(init.email, init.password)
				.end((err, res) => {
					// console.log(res.body);
					res.should.have.status(200);
					res.body.data.should.have.property("link")
					res.body.data.link.should.be.an('object');
					res.body.data.link.name.should.eql("name1");
					res.body.data.link.val.should.eql("val1");
					res.body.data.should.have.property("other_link")
					res.body.data.other_link.should.be.an('object');
					res.body.data.other_link.name.should.eql("name2");
					res.body.data.other_link.val.should.eql("val2");
					done();
				});
		});
		it("should non-destructively populate link on a single record", done => {
			chai.request(server)
			.get(`/api/test/${post_id}?populate=link`)
			.auth(init.email, init.password)
			.end((err, res) => {
				// console.log(res.body);
				res.should.have.status(200);
				res.body.should.have.property("data");
				res.body.data.should.have.property("link")
				res.body.data.link.should.be.an('object');
				res.body.data.link.name.should.eql("name1");
				res.body.data.link.val.should.eql("val1");
				res.body.data.link_id.should.be.eql(link_id);
				done();
			});
		});
		it("should populate link_id on all records", done => {
			chai.request(server)
			.get(`/api/test?populate=link`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data[0].should.have.property("link")
				res.body.data[0].link.should.be.an('object');
				res.body.data[0].link.name.should.eql("name1");
				res.body.data[0].link.val.should.eql("val1");
				res.body.data[0].link_id.should.be.eql(link_id);
				done();
			});
		});
		it("should populate just val from link_id on a single record", done => {
			chai.request(server)
			.get(`/api/test/${post_id}?populate[link]=val`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.have.property("data");
				res.body.data.link.should.have.property("val")
				res.body.data.link.should.not.have.property("name")
				res.body.data.link.should.be.an('object');
				res.body.data.link.val.should.eql("val1");
				done();
			});
		});
		it("should populate just val from link_id on all records", done => {
			chai.request(server)
			.get(`/api/test?populate[link]=val`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data[0].link.should.have.property("val")
				res.body.data[0].link.should.not.have.property("name")
				res.body.data[0].link.val.should.eql("val1");
				done();
			});
		});
		it("should populate name and val from link_id on a single record", done => {
			chai.request(server)
			.get(`/api/test/${post_id}?populate[link]=val,name`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.have.property("data");
				res.body.data.link.should.have.property("val")
				res.body.data.link.should.have.property("name")
				res.body.data.link.should.be.an('object');
				res.body.data.link.val.should.eql("val1");
				done();
			});
		});
		it("should populate name and val from link_id on all records", done => {
			chai.request(server)
			.get(`/api/test?populate[link]=val,name`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data[0].link.should.have.property("val")
				res.body.data[0].link.should.have.property("name")
				res.body.data[0].link.val.should.eql("val1");
				done();
			});
		});
		it("should populate link_id and other_link_id on a single record", done => {
			chai.request(server)
			.get(`/api/test/${post_id}?populate[]=link&populate[]=other_link`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.have.property("data");
				res.body.data.should.have.property("link")
				res.body.data.link.should.be.an('object');
				res.body.data.link.name.should.eql("name1");
				res.body.data.link.val.should.eql("val1");
				res.body.data.should.have.property("other_link");
				res.body.data.other_link.should.be.an('object');
				res.body.data.other_link.name.should.eql("name2");
				res.body.data.other_link.val.should.eql("val2");
				done();
			});
		});
		it("should populate link_id and other_link_id on all records", done => {
			chai.request(server)
			.get(`/api/test?populate[]=link&populate[]=other_link`)
			.auth(init.email, init.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data[0].link.should.have.property("val")
				res.body.data[0].link.should.have.property("name")
				res.body.data[0].link.val.should.eql("val1");
				res.body.data[0].other_link.should.have.property("val")
				res.body.data[0].other_link.should.have.property("name")
				res.body.data[0].other_link.val.should.eql("val2");
				done();
			});
		});
		it("should link an array of links to TEST", done => {
			chai.request(server)
				.put("/api/test/" + post_id)
				.auth(init.email, init.password)
				.send({ array_link_id: [ link_id, other_link_id ] })
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('object');
					res.body.data.should.have.property("array_link_id")
					res.body.data.array_link_id.should.be.an("array");
					res.body.data.array_link_id.should.have.length(2);
					done();
				});
		});
		it("should populate an array of links", done => {
			chai.request(server)
				.get(`/api/test?populate=array_link`)
				.auth(init.email, init.password)
				.end((err, res) => {
					// console.log(res.body.data);
					res.should.have.status(200);
					res.body.data[0].should.have.property("array_link");
					res.body.data[0].array_link.should.be.an("array");
					res.body.data[0].array_link.should.have.length(2);
					res.body.data[0].array_link[0].should.be.an("object");
					res.body.data[0].array_link[0].val.should.eql("val1");
					done();
				});
		});
		describe("/POST query", () => {
			it("it should POST a complex query", (done) => {
				var query = {
					"$and": [
						{ 
							"foo": {
								"$regex": "foo",
								"$options": "i"
							}
						},
						{	
							"bar": "Bar"
						}
					]
				};
				chai.request(server)
				.post("/query/test")
				.auth(init.email, init.password)
				.send({query})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					res.body.data[0].should.have.property("_id");
					res.body.data[0].should.have.property("foo");
					res.body.data[0].should.have.property("bar");
					res.body.data[0].should.have.property("yack").which.should.be.an("object");
					res.body.data[0].should.have.property("shmack");
					res.body.data[0].shmack.should.be.an("array");
					res.body.data[0].foo.should.be.a("string");
					res.body.data[0].bar.should.be.a("string");
					res.body.data[0].foo.should.eql("Foo1");
					res.body.data[0].bar.should.eql("Bar");
					done();
				});
			});
		});
		describe("/POST aggregate", () => {
			it("it should POST an aggregate query", (done) => {
				var query = [
					{ $group: { _id: null, count: { $sum: 1 } } }
				];
				chai.request(server)
				.post("/aggregate/test")
				.auth(init.email, init.password)
				.send({ query })
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					res.body.data[0].should.have.property("_id");
					res.body.data[0].should.have.property("count");
					res.body.data[0].count.should.eql(1);
					done();
				});
			});
		});
		describe("/POST bulkwrite", () => {
			it("it should make sure we are set up right", done => {
				chai.request(server)
					.get("/api/test")
					.auth(init.email, init.password)
					.end((err, res) => {
						res.should.have.status(200);
						res.body.data.should.be.an('array');
						res.body.data[0].should.have.property("foo");
						res.body.data[0].foo.should.eql("Foo1");
						res.body.should.have.property("count");
						res.body.count.should.eql(1);
						done();
					});
			})
			it("it should bulkwrite", (done) => {
				const query = [
					{
						"insertOne": {
							"document": {
								"foo": "Foo2",
								"bar": "Bar2",
								"yack": { "yack": "yack2", "shmack": 2 },
							}
						},
					},
					{
						"updateOne": {
							"filter": {
								"foo": "Foo1"
							},
							"update": {
								"$set": {
									"foo": "Foo bulk updated"
								}
							}
						}
					},
					{
						"updateOne": {
							"filter": {
								"foo": "Foo3"
							},
							"update": {
								"foo": "Foo3",
								"bar": "Bar3",
								"yack": { "yack": "yack3", "shmack": 3 },
							},
							"upsert": true
						},
					}
				];
				chai.request(server)
					.post("/bulkwrite/test")
					.auth(init.admin_email, init.admin_password)
					.send(query)
					.end((err, res) => {
						res.should.have.status(200);
						res.body.data.should.be.an('object');
						res.body.data.should.have.property("ok");
						res.body.data.ok.should.eql(1);
						res.body.data.nInserted.should.eql(1);
						res.body.data.nUpserted.should.eql(1);
						res.body.data.nMatched.should.eql(1);
						res.body.data.nModified.should.eql(1);
						done();
					});
			});
			it("it should test bulkwrite", (done) => {
				chai.request(server)
					.get("/api/test?sort[createdAt]=1")
					.auth(init.email, init.password)
					.end((err, res) => {
						res.should.have.status(200);
						res.body.data.should.be.an('array');
						res.body.data[0].should.have.property("foo");
						res.body.data[0].foo.should.eql("Foo bulk updated");
						res.body.data[1].should.have.property("foo");
						res.body.data[2].should.have.property("foo");
						res.body.should.have.property("count");
						res.body.count.should.eql(3);
						done();
					});
			});
		});
	});

	describe("Models", () => {
		it("it should get all the model definitions", (done) => {
			chai.request(server)
				.get("/model")
				// .auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('array');
					done();
				});
		});
	});
});
