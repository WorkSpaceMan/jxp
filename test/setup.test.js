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

const mock_data = {
   users: [
       { email: init.admin_email, password: init.admin_password, name: "Admin User", admin: true, urlid: "admin-user" },
       { email: init.email, password: init.password, name: "Jeff", admin: false, urlid: "jeff" },
    ],
    tests: [
        { foo: "setup_data", bar: "setup_data" }
    ]
}
describe('Setup', () => {
    beforeEach(async function() {
        await init.empty_user_collections();
    })

	describe("setup", () => {
		it("it should setup a primary user", (done) => {
			chai.request(server)
				.post("/setup")
				.send({ email: init.email, password: init.password })
				.end((err, res) => {
                    console.log(res.body);
					res.should.have.status(200);
					res.body.status.should.equal('success');
                    res.body.name.should.equal('admin');
                    res.body.email.should.equal(init.email);
					done();
				});
		});
    });
    
    describe("setup_data", () => {
        it("it will set the database up with custom data", (done) => {
			chai.request(server)
				.post("/setup/data")
				.send(mock_data)
				.end((err, res) => {
					res.should.have.status(200);
                    res.body.status.should.equal('success');
                    res.body.results.users.insertedCount.should.equal(2);
                    res.body.results.tests.insertedCount.should.equal(1);
					done();
				});
		});
    })
});
