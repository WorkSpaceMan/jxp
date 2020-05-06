#! /usr/bin/env node
var program = require("commander");
var readline = require('readline-sync');
var mongoose = require("mongoose");
var security = require("../libs/security");
var User = require("../models/user_model");

var pkg = require('../package.json');

var version = pkg.version;

program
.version(version)
.usage('[options] [dir]')
.option('-v, --version', 'JXP version')
.option("-c, --config <config.js>", "Use config file")
.option("-e, --email <user>", "Admin user email")
.option("-p, --password <password>", "Admin password")
.option("-u, --username <name>", "Admin user name")
.parse(process.argv);

function main() {
	var config = require("config");
	var email = program.email || readline.question("Admin user email: ");
	var password = program.password || readline.question("Admin user password: ");
	var name = program.username || readline.question("Admin user name (Admin): ", { defaultInput: "Admin" });
	config.mongo = config.mongo || { server: "localhost", db: "jxp" };
	//DB connection
	mongoose.connect('mongodb://' + config.mongo.server + '/' + config.mongo.db, function(err) {
		if (err) {
			console.log("Database connection error", err);
		}
	}, {
		db: {
			safe:true
		},
		useCreateIndex: true,
		useNewUrlParser: true,
	}); // connect to our database
	var user = new User();
	user.email = email;
	user.password = security.encPassword(password);
	user.name = name;
	user.admin = true;
	user.save((err) => {
		if (err) {
			console.log("Error:", err.message);
			return process.exit(1);
		} else {
			console.log("Created admin user", name, "<" + email + ">");
			return process.exit(0);
		}
	});
}

main();
