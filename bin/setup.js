#! /usr/bin/env node
const mkdirp = require("mkdirp");
const program = require("commander");
const path = require("path");
const readline = require('readline-sync');
const fs = require("fs");
const crypto = require("crypto");
const execSync = require('child_process').execSync;
const mongoose = require("mongoose");

const security = require("../libs/security");
global.JXPSchema = require("../libs/schema");

const User = require("../models/user_model");

const pkg = require('../package.json');

const version = pkg.version;

program
	.version(version)
	.usage('[options] [dir]')
	.option('-v, --version', 'JXP version')
	.parse(process.argv);

async function main() {
	try {
		const models = ["apikey", "test", "token", "user", "usergroups", "link", "refreshtoken"];
		const destination_path = program.args.shift() || '.';
		// Get some defaults
		let default_author_name = "Me";
		let default_author_email = "me@example.com";
		let default_app_description = "A JXP installation";
		let default_license = "MIT";
		let default_version = "0.0.1";
		try {
			default_author_name = execSync('git config --global user.name', { encoding: 'utf-8' }).trim();
			default_author_email = execSync('git config --global user.email', { encoding: 'utf-8' }).trim();
		} catch(err) {
			// Nothing to see here
		}
		let default_app_author = `${default_author_name} <${default_author_email}>`;
		// Ask the basics
		let default_app_name = path.basename(path.resolve(destination_path));
		const app_name = readline.question(`App name (${default_app_name}): `, { defaultInput: default_app_name });
		const app_description = readline.question(`App description (${default_app_description}): `, { defaultInput: default_app_description });
		const app_license = readline.question(`Licence (${default_license}): `, { defaultInput: default_license });
		const app_author = readline.question(`Author (${default_app_author}): `, { defaultInput: default_app_author });
		const app_version = readline.question(`Version (${default_version}): `, { defaultInput: default_version });
		var opts = {};
		// Config setup
		// opts.email = readline.question("Admin email address: ");
		// opts.password = readline.question("Admin password: ", { hideEchoBack: true });
		opts.port = readline.question("Port (2001): ", { defaultInput: "2001" });
		opts.url = readline.question("URL (http://localhost:" + opts.port + "): ", { defaultInput: "http://localhost:" + opts.port });
		const default_connection_string = `mongodb://localhost/${ app_name }?retryWrites=true&w=majority`;
		opts.connection_string = readline.question(`Mongo connection string (${default_connection_string}): `, { defaultInput: default_connection_string });
		const email = readline.question(`Admin user email (${default_author_email}): `);
		const name = readline.question(`Admin user name (${default_author_name}): `, { defaultInput: "Admin" });
		const random_password = crypto.randomBytes(12).toString('base64');
		const password = readline.question(`Admin user password (${random_password}): `, { hideEchoBack: true, defaultInput: random_password });
		opts.shared_secret = crypto.randomBytes(20).toString('hex');
		const package_data = {
			"name": app_name,
			"version": app_version,
			"description": app_description,
			"main": "bin/server.js",
			"scripts": {
				"test": "echo \"Error: no test specified\" && exit 1",
				"start": "node bin/server.js"
			},
			"dependencies": {
				"jxp": "^2.12.3"
			},
			"author": app_author,
			"license": app_license
		};
		await mkdirp(destination_path); // Ensure the dir exists
		write(path.join(destination_path, "package.json"), JSON.stringify(package_data, null, "\t"));
		await mkdir(path.join(destination_path, "bin"));
		await mkdir(path.join(destination_path, "models"));
		await mkdir(path.join(destination_path, "config"));
		await mkdir(path.join(destination_path, "logs"));
		await mkdir(path.join(destination_path, "libs"));
		await cp_replace("../config_sample.json", path.join(destination_path, "config/default.json"), opts, "{", "}");
		await cp_replace("./server.js", path.join(destination_path, "bin/server.js"), { "../libs/jxp": "jxp/libs/jxp", "../libs/connection_string": "jxp/libs/connection_string" });
		for (let model of models) {
			await cp("../models/" + model + "_model.js", path.join(destination_path, "models/" + model + "_model.js"));
		}

		console.log();
		console.log("Installing dependencies...")
		console.log();

		execSync(`cd ${destination_path} && npm install`);
		
		console.log();
		console.log("Setting up your admin user...")
		console.log();
		
		try {
			mongoose.connect(opts.connection_string, function (err) {
				if (err) {
					throw(err);
				}
				
			}, {
				db: {
					safe: true
				},
				useCreateIndex: true,
				useNewUrlParser: true,
			});
		} catch(err) {
			console.log("WARNING: We had a problem talking to the database")
			console.error(err);
			return process.exit(1);
		}
		var user = new User();
		user.email = email;
		user.password = security.encPassword(password);
		user.name = name;
		user.admin = true;
		user.save((err) => {
			if (err) {
				console.log("Error saving user");
				console.error(err.message);
				return process.exit(1);
			} else {
				console.log("Created admin user", name, "<" + email + ">");
			}
		});
		process.chdir(destination_path);
		console.log("Congratulations! Your JXP server is ready to go. Happy API'ing...");
		console.log("Next steps:");
		console.log("0. Change to your directory");
		console.log(`     cd ${ destination_path }`);
		console.log("1. Start your server");
		console.log("     npm start");
		console.log("2. Connect to your server");
		console.log(`     ${opts.url}`);
		return process.exit(0);
	} catch(err) {
		console.log("Error:", err.message);
		return process.exit(1);
	}
}

/**
 * Copy from to replacing text as we go
 *
 */
function cp_replace(from, to, opts, startEnclosure = "", endEnclosure = "") {
	startEnclosure = startEnclosure || "";
	endEnclosure = endEnclosure || "";
	from = path.join(__dirname, from);
	var s = fs.readFileSync(from, "utf-8");
	for(var i in opts) {
		console.log(startEnclosure + i + endEnclosure, opts[i]);
		s = s.replace(startEnclosure + i + endEnclosure, opts[i]);
	}
	write(to, s);
}

 /**
  * Copy from to
  *
  * @param {String} from
  * @param {String} to
  */
function cp(from, to) {
	from = path.join(__dirname, from);
	write(to, fs.readFileSync(from, 'utf-8'));
}

function write(path, str, mode) {
	fs.writeFileSync(path, str, { mode });
	console.log('   \x1b[36mcreate\x1b[0m : ' + path);
}

/**
 * Mkdir -p.
 *
 * @param {String} path
 * @return {Promise}
 */

function mkdir(path) {
	return mkdirp(path, 0o755);
}

main();