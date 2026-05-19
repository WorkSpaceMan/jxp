#! /usr/bin/env node
const program = require("commander");
const readline = require("readline-sync");
const mongoose = require("mongoose");
const path = require("path");
const security = require("../libs/security");
const { getMongoConnectionString, loadEnv } = require("../libs/load-config");

const schemaModule = require("../libs/schema");
global.JXPSchema = schemaModule.default || schemaModule;

loadEnv();
const modelDir = process.env.MODEL_DIR || path.resolve(process.cwd(), "dist/models");
const User = require(path.join(modelDir, "user_model"));
const UserModel = User.default || User;

const pkg = require("../../package.json");

program
	.version(pkg.version)
	.usage("[options] [dir]")
	.option("-v, --version", "JXP version")
	.option("-e, --email <user>", "Admin user email")
	.option("-p, --password <password>", "Admin password")
	.option("-u, --username <name>", "Admin user name")
	.parse();

const opts = program.opts();

async function main() {
	const email = opts.email || readline.question("Admin user email: ");
	const password = opts.password || readline.question("Admin user password: ");
	const name =
		opts.username ||
		readline.question("Admin user name (Admin): ", { defaultInput: "Admin" });

	await mongoose.connect(getMongoConnectionString());
	const user = new UserModel();
	user.email = email;
	user.password = security.encPassword(password);
	user.name = name;
	user.admin = true;
	try {
		await user.save();
		console.log("Created admin user", name, "<" + email + ">");
		process.exit(0);
	} catch (err) {
		console.log("Error:", err.message);
		process.exit(1);
	}
}

main();
