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

const pause = ms => new Promise(res => setTimeout(res, ms));

describe('Test', () => {
	before(async function () {
		await init.init();
	})

	beforeEach(async function () {
		await pause(0);
	})


	var apikey = null;
	var token = null;
	var refresh_token = null;
	var user_id = null;
	var objectid = null;

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
					res.body.should.have.property('provider');
					res.body.provider.should.be.eql('https://api.workspaceman.nl');
					apikey = res.body.apikey;
					token = res.body.token;
					user_id = res.body.user_id;
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

	describe("/GET test count", () => {
		it("it should count all the tests", (done) => {
			Test.deleteMany(() => {
				chai.request(server)
					.get("/count/test")
					.end((err, res) => {
						res.should.have.status(200);
						res.body.count.should.be.eql(0);
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
				shmack: ["do", "ray", "me"],
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

	describe("/GET test count", () => {
		it("it should count all the tests", (done) => {
			chai.request(server)
				.get("/count/test")
				.end((err, res) => {
					res.should.have.status(200);
					res.body.count.should.be.eql(1);
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
					res.body.data._updated_by_id.should.eql(user_id);
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

	describe("Date filtering", () => {
		let dateTestId;
		const testDate = new Date('2024-03-20T10:00:00.000Z');

		before(async () => {
			// Create a test record with a known date
			const test = new Test({
				foo: "DateTest",
				bar: "DateTestBar",
				date_field: testDate
			});
			const saved = await test.save();
			dateTestId = saved._id;
		});

		it("should filter by exact date", (done) => {
			chai.request(server)
				.get(`/api/test?filter[date_field]=${testDate.toISOString()}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					res.body.data.length.should.be.eql(1);
					res.body.data[0]._id.should.equal(dateTestId.toString());
					done();
				});
		});

		it("should filter by date range using array syntax", (done) => {
			const startDate = new Date(testDate);
			startDate.setDate(startDate.getDate() - 1);
			const endDate = new Date(testDate);
			endDate.setDate(endDate.getDate() + 1);

			chai.request(server)
				.get(`/api/test?filter[date_field]=$gte:${startDate.toISOString()}&filter[date_field]=$lte:${endDate.toISOString()}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					res.body.data.length.should.be.eql(1);
					res.body.data[0]._id.should.equal(dateTestId.toString());
					done();
				});
		});

		it("should filter by date range using operator syntax", (done) => {
			const startDate = new Date(testDate);
			startDate.setDate(startDate.getDate() - 1);
			const endDate = new Date(testDate);
			endDate.setDate(endDate.getDate() + 1);

			chai.request(server)
				.get(`/api/test?filter[date_field]=$gte:${startDate.toISOString()}&filter[date_field]=$lte:${endDate.toISOString()}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					res.body.data.length.should.be.eql(1);
					res.body.data[0]._id.should.equal(dateTestId.toString());
					done();
				});
		});

		it("should handle invalid date formats gracefully", (done) => {
			chai.request(server)
				.get('/api/test?filter[date_field]=invalid-date')
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(500);
					res.body.should.have.property('code', 'InternalServer');
					done();
				});
		});

		it("should return empty array for dates outside range", (done) => {
			const futureDate = new Date(testDate);
			futureDate.setFullYear(futureDate.getFullYear() + 1);

			chai.request(server)
				.get(`/api/test?filter[date_field]=${futureDate.toISOString()}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('array');
					res.body.data.length.should.be.eql(0);
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
				.send({ link_id })
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
				.send({ other_link_id })
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
				.send({ array_link_id: [link_id, other_link_id] })
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
					.send({ query })
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
						objectid = res.body.data[0]._id;
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
						res.body.data[0].count.should.eql(2);
						done();
					});
			});
		});
		describe("/POST aggregate", () => {
			it("it should POST an aggregate query but not embedded in query", (done) => {
				var query = [
					{ $group: { _id: null, count: { $sum: 1 } } }
				];
				chai.request(server)
					.post("/aggregate/test")
					.auth(init.email, init.password)
					.send(query)
					.end((err, res) => {
						res.should.have.status(200);
						res.body.data.should.be.an('array');
						res.body.data[0].should.have.property("_id");
						res.body.data[0].should.have.property("count");
						res.body.data[0].count.should.eql(2);
						done();
					});
			});
		});
		describe("/POST aggregate", () => {
			it("it should POST an aggregate query with calculated Date", (done) => {
				var query = [
					{
						$match: {
							"createdAt": {
								"$gte": "new Date(\"2020-01-01\")"
							}
						}
					},
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
						res.body.data[0].count.should.eql(2);
						done();
					});
			});
		});
		describe("/POST aggregate", () => {
			it("it should POST an aggregate query with calculated relative_date", (done) => {
				var query = [
					{
						$match: {
							"createdAt": {
								"$gte": "relative_date(-1, \"days\")",
								"$lte": "relative_date(null, null, null, \"month\")",
							}
						}
					},
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
						res.body.data[0].count.should.eql(2);
						done();
					});
			});
		});
		describe("/POST aggregate", () => {
			it("it should POST an aggregate query with calculated ObjectId", (done) => {
				var query = [
					{
						$match: {
							"_id": `ObjectId("${objectid}")`
						}
					},
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
		describe("/POST aggregate allowDiskUse", () => {
			it("it should POST an aggregate query with allowDiskUse", (done) => {
				var query = [
					{ $group: { _id: null, count: { $sum: 1 } } }
				];
				chai.request(server)
					.post("/aggregate/test?allowDiskUse=true")
					.auth(init.email, init.password)
					.send({ query })
					.end((err, res) => {
						res.should.have.status(200);
						res.body.data.should.be.an('array');
						res.body.data[0].should.have.property("_id");
						res.body.data[0].should.have.property("count");
						res.body.data[0].count.should.eql(2);
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
						res.body.count.should.eql(2);
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
						res.body.count.should.eql(4);
						done();
					});
			});
		});
		// it("should $push to an array", done => {
		// 	chai.request(server)
		// 		.patch("/api/test/" + post_id)
		// 		.auth(init.email, init.password)
		// 		.send({ $push: { shmack: "fah" } })
		// 		.end((err, res) => {
		// 			// console.log(res.body.data);
		// 			res.should.have.status(200);
		// 			res.body.data.should.be.an('object');
		// 			res.body.data.should.have.property("shmack")
		// 			res.body.data.shmack.should.be.an("array");
		// 			res.body.data.shmack.should.have.length(4);
		// 			done();
		// 		});
		// });
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

	describe("Delete", () => {
		it("should soft-delete an item", (done) => {
			chai.request(server)
				.del(`/api/test/${post_id}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.status.should.equal('ok');
					done();
				});
		});
		it("should show item as deleted", (done) => {
			chai.request(server)
				.get(`/api/test/${post_id}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(404);
					res.body.message.should.equal(`Document ${post_id} is deleted on Test`);
					res.body.code.should.equal('NotFound');
					done();
				});
		});
		it("should show item", (done) => {
			chai.request(server)
				.get(`/api/test/${post_id}?showDeleted=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data._deleted.should.equal(true);
					res.body.data.bar.should.equal("Bar");
					done();
				});
		});
		it("should undeleted item", (done) => {
			chai.request(server)
				.put(`/api/test/${post_id}`)
				.send({
					_deleted: false
				})
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.status.should.equal('ok');
					done();
				});
		});
		it("should show item", (done) => {
			chai.request(server)
				.get(`/api/test/${post_id}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data._deleted.should.equal(false);
					res.body.data.bar.should.equal("Bar");
					done();
				});
		});
		it("should permanently delete item", (done) => {
			chai.request(server)
				.del(`/api/test/${post_id}?_permaDelete=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.status.should.equal('ok');
					done();
				});
		});
		it("should fail to find item", (done) => {
			chai.request(server)
				.get(`/api/test/${post_id}?showDeleted=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(404);
					done();
				});
		});
		let link_id = null;
		let test_with_links_id = null;
		it("should add a LINK item", done => {
			let data = {
				name: "deltest_name",
				val: "deltest_val",
				bar: "Gloop"
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
					res.body.data.name.should.eql("deltest_name");
					link_id = res.body.data._id;
					done();
				});
		});
		it("should link a LINK item to a TEST", done => {
			chai.request(server)
				.post("/api/test")
				.auth(init.email, init.password)
				.send({
					link_id
				})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('object');
					res.body.data.should.have.property("link_id")
					res.body.data.link_id.should.eql(link_id);
					test_with_links_id = res.body.data._id;
					done();
				});
		});
		it("should fail because a parent item exists", (done) => {
			chai.request(server)
				.del(`/api/link/${link_id}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(409);
					res.body.message.should.equal(`Parent link item exists in test/link_id`);
					done();
				});
		});
		it("should cascade delete", (done) => {
			chai.request(server)
				.del(`/api/link/${link_id}?_cascade=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.status.should.equal('ok');
					done();
				});
		});
		it("link item should no longer exist", (done) => {
			chai.request(server)
				.get(`/api/test/${test_with_links_id}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(404);
					res.body.message.should.equal(`Document ${test_with_links_id} is deleted on Test`);
					done();
				});
		});
		it("link item should be soft-deleted", (done) => {
			chai.request(server)
				.get(`/api/test/${test_with_links_id}?showDeleted=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					done();
				});
		});
		it("should add a LINK item", done => {
			let data = {
				name: "permdeltest_name",
				val: "permdeltest_val",
				bar: "Yoop"
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
					res.body.data.name.should.eql("permdeltest_name");
					link_id = res.body.data._id;
					done();
				});
		});
		it("should link a LINK item to a TEST", done => {
			chai.request(server)
				.post("/api/test")
				.auth(init.email, init.password)
				.send({
					link_id,
					bar: "link1"
				})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.be.an('object');
					res.body.data.should.have.property("link_id")
					res.body.data.link_id.should.eql(link_id);
					test_with_links_id = res.body.data._id;
					done();
				});
		});
		it("should fail because a parent item exists", (done) => {
			chai.request(server)
				.del(`/api/link/${link_id}`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(409);
					res.body.message.should.equal(`Parent link item exists in test/link_id`);
					done();
				});
		});
		it("should cascade delete", (done) => {
			chai.request(server)
				.del(`/api/link/${link_id}?_cascade=1&_permaDelete=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.status.should.equal('ok');
					done();
				});
		});
		it("link item should be permanently deleted", (done) => {
			chai.request(server)
				.get(`/api/test/${test_with_links_id}?showDeleted=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(404);
					done();
				});
		});
	});

	describe("/Filter with +", () => {
		it("it should POST a user with a + in email", (done) => {
			var user = {
				name: "Plus User",
				email: "plus+user@gmail.com"
			};
			chai.request(server)
				.post("/api/user")
				.auth(init.admin_email, init.admin_password)
				.send(user)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data.should.have.property("_id");
					done();
				});
		});
		it("it should GET a user with a + in email", (done) => {
			chai.request(server)
				.get("/api/user?filter[email]=plus%2Buser@gmail.com")
				.auth(init.admin_email, init.admin_password)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.data[0].should.have.property("_id");
					done();
				});
		});
	});

	describe("Error Handling", () => {
		it("should get an error", (done) => {
			chai.request(server)
				.post("/api/test")
				.auth(init.email, init.password)
				.send({
					error: true,
					bar: "Throw an error"
				})
				.end((err, res) => {
					res.should.have.status(418);
					res.body.message.should.equal(`I'm a teapot`);
					done();
				});
		})
	});

	describe("Caching", () => {
		it("should give us cache stats", (done) => {
			chai.request(server)
				.get("/cache/stats")
				.end((err, res) => {
					// console.log(res.body);
					res.should.have.status(200);
					res.body.should.have.property("hits");
					done();
				});
		})
		it("should clear the cache stats", (done) => {
			chai.request(server)
				.get("/cache/clear")
				.end((err, res) => {
					// console.log(res.body);
					res.should.have.status(200);
					done();
				});
		});
		it("should get an uncached request", (done) => {
			chai.request(server)
				.get("/api/test")
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.headers.should.have.property("jxp-cache");
					res.headers["jxp-cache"].should.equal("miss");
					done();
				});
		});
		it("should get an cached request", (done) => {
			chai.request(server)
				.get("/api/test")
				.auth(init.email, init.password)
				.end((err, res) => {
					res.should.have.status(200);
					res.headers.should.have.property("jxp-cache");
					res.headers["jxp-cache"].should.equal("hit");
					done();
				});
		});
		it("should give us cache stats", (done) => {
			chai.request(server)
				.get("/cache/stats")
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property("hits");
					res.body.hits.should.be.greaterThan(0);
					res.body.misses.should.be.greaterThan(0);
					done();
				});
		})
	});
	describe("Cache invalidating", () => {
		let test_id;
		it("should get a test record", done => {
			chai.request(server)
				.get(`/api/test?populate=link&limit=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					// console.log(res.headers)
					res.should.have.status(200);
					res.body.data[0].should.have.property("_id");
					test_id = res.body.data[0]._id;
					res.body.data[0].should.have.property("link");
					should.equal(res.body.data[0].link, null);
					res.headers["jxp-cache"].should.equal("miss");
					done();
				});
		});
		it("should get a cached test record", done => {
			chai.request(server)
				.get(`/api/test?populate=link&limit=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					// console.log(res.headers)
					res.should.have.status(200);
					res.body.data[0].should.have.property("_id");
					res.headers["jxp-cache"].should.equal("hit");
					should.equal(res.body.data[0].link, null);
					done();
				});
		});
		let link_id;
		it("should add a link record", done => {
			chai.request(server)
				.post(`/api/link`)
				.auth(init.email, init.password)
				.send({
					name: "cache_test",
					val: "YoYoYo"
				})
				.end((err, res) => {
					// console.log(res.body)
					res.should.have.status(200);
					res.body.data.should.have.property("_id");
					link_id = res.body.data._id;
					done();
				});
		});
		it("should put link_id into test record", done => {
			chai.request(server)
				.put(`/api/test/${test_id}`)
				.auth(init.admin_email, init.admin_password)
				.send({
					link_id
				})
				.end((err, res) => {
					// console.log(res.body)
					res.should.have.status(200);
					res.body.data.should.have.property("_id");
					res.body.data.link_id.should.equal(link_id);
					done();
				});
		});
		it("should get a test record with link", done => {
			chai.request(server)
				.get(`/api/test?populate=link&limit=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					// console.log(res.body)
					res.should.have.status(200);
					res.body.data[0].should.have.property("_id");
					res.body.data[0].should.have.property("link");
					res.body.data[0].link.should.not.equal(null);
					res.body.data[0].link._id.should.equal(link_id);
					res.body.data[0].link.name.should.equal("cache_test");
					res.body.data[0].link.val.should.equal("YoYoYo");
					res.headers["jxp-cache"].should.equal("miss");
					done();
				});
		});
		it("should update link record", done => {
			chai.request(server)
				.put(`/api/link/${link_id}`)
				.auth(init.admin_email, init.admin_password)
				.send({
					val: "YoYoYo2"
				})
				.end((err, res) => {
					// console.log(res.body)
					res.should.have.status(200);
					res.body.data.should.have.property("_id");
					res.body.data.val.should.equal("YoYoYo2");
					done();
				});
		});
		it("should get a test record with updated link", done => {
			chai.request(server)
				.get(`/api/test?populate=link&limit=1`)
				.auth(init.email, init.password)
				.end((err, res) => {
					// console.log(res.body.data[0].link)
					res.should.have.status(200);
					res.body.data[0].should.have.property("_id");
					res.body.data[0].should.have.property("link");
					res.body.data[0].link.should.not.equal(null);
					res.body.data[0].link._id.should.equal(link_id);
					res.body.data[0].link.name.should.equal("cache_test");
					res.body.data[0].link.val.should.equal("YoYoYo2");
					res.headers["jxp-cache"].should.equal("miss");
					done();
				});
		});
	})
});
