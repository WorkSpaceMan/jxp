process.env.NODE_ENV = 'test';

var chai = require('chai');
var chaiHttp = require('chai-http');

var init = require("./init");
var server = require("../bin/server");

chai.use(chaiHttp);

describe('Authentication Tests', () => {
    before(async function () {
        // First empty collections
        await init.empty_user_collections();
        console.log("Emptied collections");

        // Then run setup
        await new Promise((resolve, reject) => {
            chai.request(server)
                .post("/setup")
                .send({ email: init.email, password: init.password })
                .end((err, res) => {
                    if (err) return reject(err);
                    res.should.have.status(200);
                    res.body.status.should.equal('success');
                    console.log("Setup complete with email:", init.email);
                    resolve();
                });
        });
    });

    var apikey = null;
    var token = null;
    var refresh_token = null;
    var user_id = null;

    describe("Login", () => {
        it("should login with valid credentials", (done) => {
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
                    apikey = res.body.apikey;
                    token = res.body.token;
                    user_id = res.body.user_id;
                    refresh_token = res.body.refresh_token;
                    done();
                });
        });

        it("should fail with invalid credentials", (done) => {
            console.log("Attempting login with invalid password for:", init.email);
            chai.request(server)
                .post("/login")
                .send({ email: init.email, password: "wrongpassword" })
                .end((err, res) => {
                    if (err) return done(err);
                    console.log("Response status:", res.status);
                    console.log("Response body:", res.body);
                    res.should.have.status(403);
                    done();
                });
        });
    });

    describe("Token Authentication", () => {
        it("should authenticate with valid token", (done) => {
            chai.request(server)
                .get("/api/user")
                .set("Authorization", `Bearer ${token}`)
                .end((err, res) => {
                    if (err) return done(err);
                    res.should.have.status(200);
                    res.body.data.should.be.an('array');
                    done();
                });
        });

        it("should fail with invalid token", (done) => {
            chai.request(server)
                .get("/api/user")
                .set("Authorization", "Bearer invalidtoken")
                .end((err, res) => {
                    if (err) return done(err);
                    res.should.have.status(403);
                    done();
                });
        });
    });

    describe("API Key Authentication", () => {
        it("should authenticate with valid API key in header", (done) => {
            chai.request(server)
                .get("/api/user")
                .set("X-API-Key", apikey)
                .end((err, res) => {
                    if (err) return done(err);
                    res.should.have.status(200);
                    res.body.data.should.be.an('array');
                    done();
                });
        });

        it("should authenticate with valid API key in query", (done) => {
            chai.request(server)
                .get(`/api/user?apikey=${apikey}`)
                .end((err, res) => {
                    if (err) return done(err);
                    res.should.have.status(200);
                    res.body.data.should.be.an('array');
                    done();
                });
        });

        it("should fail with invalid API key", (done) => {
            chai.request(server)
                .get("/api/user")
                .set("X-API-Key", "invalidapikey")
                .end((err, res) => {
                    if (err) return done(err);
                    res.should.have.status(403);
                    done();
                });
        });
    });

    describe("Refresh Token", () => {
        it("should refresh token successfully", (done) => {
            chai.request(server)
                .post("/refresh")
                .set("Authorization", `Bearer ${refresh_token}`)
                .end((err, res) => {
                    if (err) return done(err);
                    res.should.have.status(200);
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

        it("should fail with invalid refresh token", (done) => {
            chai.request(server)
                .post("/refresh")
                .set("Authorization", "Bearer invalidrefreshtoken")
                .end((err, res) => {
                    if (err) return done(err);
                    res.should.have.status(403);
                    done();
                });
        });
    });

    describe("Logout", () => {
        it("should logout successfully", (done) => {
            chai.request(server)
                .get("/login/logout")
                .set("Authorization", `Bearer ${token}`)
                .end((err, res) => {
                    if (err) return done(err);
                    res.should.have.status(200);
                    done();
                });
        });

        it("should not be able to use token after logout", (done) => {
            chai.request(server)
                .get("/api/user")
                .set("Authorization", `Bearer ${token}`)
                .end((err, res) => {
                    if (err) return done(err);
                    res.should.have.status(403);
                    done();
                });
        });
    });
}); 