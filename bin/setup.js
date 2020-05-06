#! /usr/bin/env node
const mkdirp = require("mkdirp");
const program = require("commander");
const path = require("path");
const readline = require('readline-sync');
const fs = require("fs");
const crypto = require("crypto");
const execSync = require('child_process').execSync;

const pkg = require('../package.json');

const version = pkg.version;

program
	.version(version)
	.usage('[options] [dir]')
	.option('-v, --version', 'JXP version')
	.parse(process.argv);

async function main() {
	try {
		const models = ["apikey", "test", "token", "user", "usergroups"];
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
		let app_license = readline.question(`Licence (${default_license}): `, { defaultInput: default_license });
		var app_author = readline.question(`Author (${default_app_author}): `, { defaultInput: default_app_author });
		var app_version = readline.question(`Version (${default_version}): `, { defaultInput: default_version });
		var opts = {};
		// Config setup
		// opts.email = readline.question("Admin email address: ");
		// opts.password = readline.question("Admin password: ", { hideEchoBack: true });
		opts.port = readline.question("Port (2001): ", { defaultInput: "2001" });
		opts.url = readline.question("URL (http://localhost:" + opts.port + "): ", { defaultInput: "http://localhost:" + opts.port });
		const default_connection_string = `mongodb://localhost/${ app_name }?retryWrites=true&w=majority`;
		opts.connection_string = readline.question(`Mongo connection string (${default_connection_string}): `, { defaultInput: default_connection_string });
		opts.shared_secret = crypto.randomBytes(20).toString('hex');
		var packageJson = {
			"name": app_name,
			"version": app_version,
			"description": app_description,
			"main": "bin/server.js",
			"scripts": {
				"test": "echo \"Error: no test specified\" && exit 1",
				"start": "node bin/server.js"
			},
			"dependencies": {
				"jexpress": "j-norwood-young/jexpress-2"
			},
			"author": app_author,
			"license": app_license
		};
		write("package.json", JSON.stringify(packageJson, null, "\t"));
		await mkdir(path.join(destination_path, "bin"));
		await mkdir(path.join(destination_path, "models"));
		await mkdir(path.join(destination_path, "config"));
		await mkdir(path.join(destination_path, "logs"));
		await cp_replace("../config_sample.json", path.join(destination_path, "config/default.json"), opts, "{", "}");
		await cp_replace("./server.js", path.join(destination_path, "bin/server.js"), { "../libs/jexpress": "jexpress" });
		for (let model of models) {
			await cp("../models/" + model + "_model.js", path.join(destination_path, "models/" + model + "_model.js"));
		}
		console.log();
		console.log("Installation complete");
		console.log("Next steps:");
		console.log("1. Install dependencies");
		console.log("     npm install");
		console.log("2. Run the server");
		console.log("     npm start");
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
function cp_replace(from, to, opts, startEnclosure, endEnclosure) {
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