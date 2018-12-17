#! /usr/bin/env node
var program = require("commander");
var path = require("path");
var readline = require('readline-sync');
var os = require("os");
var mongoose = require("mongoose");
var security = require("../libs/security");
var User = require("../models/user_model");
var jexpress = require("../libs/jexpress");

var pkg = require('../package.json');

var version = pkg.version;

program
.version(version)
.usage('[options] [dir]')
.option('-v, --version', 'JExpress version')
.option("-c, --config <config.js>", "Use config file")
.option("-e, --email <user>", "Admin user email")
.option("-p, --password <password>", "Admin password")
.option("-u, --username <name>", "Admin user name")
.parse(process.argv);

function main() {
	var pwd = process.cwd();
	var config = require("config");
	var email = program.email || readline.question("Admin user email: ");
	var password = program.password || readline.question("Admin user password: ");
	var name = program.username || readline.question("Admin user name (Admin): ", { defaultInput: "Admin" });
	config.mongo = config.mongo || { server: "localhost", db: "jexpress" };
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
	user.save((err, result) => {
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
