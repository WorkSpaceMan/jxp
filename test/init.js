process.env.NODE_ENV = 'test';

var User = require("../models/user_model");
var Apikey = require('../models/apikey_model');

var bcrypt = require('bcrypt');

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var server = require("../bin/server");

chai.use(chaiHttp);


var empty = (model) => {
	return new Promise((resolve, reject) => {
		model.remove({}, err => {
			if (err)
				return reject(err);
			return resolve();
		});
	});
};

var post = (model, data) => {
	return new Promise((resolve, reject) => {
		var item = new model(data);
		item.save((err, result) => {
			if (err)
				return reject(err);
			// console.log(result);
			return resolve(result);
		});
	});
};

var encPassword = (password) => {
	hash = bcrypt.hashSync(password, 4);
	return hash;
};

var email = "test@freespeechpub.co.za";
var password = "test";

var init = () => {
	var location = null;
	var organisation = null;
	return empty(User)
	.then(() => {
		return empty(Apikey);
	})
	.then(() => {
		return post(User, { name: "Test User", email, password: encPassword(password) });
	})
	;
};

describe('Init', () => {
	beforeEach(() => {
		return init();
	});

	describe("/GET user", () => {
		it("it should GET all the users", (done) => {
			chai.request(server)
			.get("/api/user")
			.auth(email, password)
			.end((err, res) => {
				// console.log(res.error);
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(1);
				done();
			});
		});
	});
});

module.exports = {
	init,
	email,
	password
};