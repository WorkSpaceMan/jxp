#! /usr/bin/env node
var mkdirp = require("mkdirp");
var program = require("commander");
var path = require("path");
var readline = require('readline-sync');
var fs = require("fs");
var Q = require("q");
var crypto = require("crypto");

var pkg = require('../package.json');

var version = pkg.version;

program
.version(version)
.usage('[options] [dir]')
.option('-v, --version', 'JExpress version')
.parse(process.argv);

function main() {
	var models = ["apikey", "test", "token", "user", "usergroups"];
	// Path
	var destinationPath = program.args.shift() || '.';
	// App name
	var appName = path.basename(path.resolve(destinationPath));
	appName = readline.question("App name (" + appName + "): ", { defaultInput: appName });
	var appDescription = readline.question("App description (A JExpress installation): ", { defaultInput: "A JExpress installation" });
	var appLicense = readline.question("Licence (MIT): ", { defaultInput: "MIT" });
	var appAuthor = readline.question("Author (Jason Norwood-Young <jason@10layer.com>): ", { defaultInput: "Jason Norwood-Young <jason@10layer.com>" });
	var appVersion = readline.question("Version (0.0.1): ", { defaultInput: "0.0.1" });
	var opts = {};
	// opts.email = readline.question("Admin email address: ");
	// opts.password = readline.question("Admin password: ", { hideEchoBack: true });
	opts.port = readline.question("Port (2001): ", { defaultInput: "2001" });
	opts.url = readline.question("URL (http://localhost:" + opts.port + "): ", { defaultInput: "http://localhost:" + opts.port });
	opts.mongo_server = readline.question("Mongo server (localhost): ", { defaultInput: "localhost" });
	opts.mongo_db = readline.question("Mongo database (" + appName + "): ", { defaultInput: appName });
	opts.shared_secret = crypto.randomBytes(20).toString('hex');
	var packageJson = {
		"name": appName,
		"version": appVersion,
		"description": appDescription,
		"main": "bin/server.js",
		"scripts": {
			"test": "echo \"Error: no test specified\" && exit 1",
			"start": "node bin/server.js"
		},
		"dependencies": {
			"jexpress": "j-norwood-young/jexpress-2"
		},
		"author": appAuthor,
		"license": appLicense
	};
	write("package.json", JSON.stringify(packageJson, null, "\t"));
	mkdir(path.join(destinationPath, "bin"))
	.then(function() {
		return mkdir(path.join(destinationPath, "models"));
	})
	.then(function() {
		cp_replace("../config_sample.json", path.join(destinationPath, "config/default.json"), opts, "{", "}");
		cp_replace("./server.js", path.join(destinationPath, "bin/server.js"), { "../libs/jexpress": "jexpress" });
		models.forEach(function(model) {
			cp("../models/" + model + "_model.js", path.join(destinationPath, "models/" + model + "_model.js"));
		});
	})
	.then(function() {
		console.log();
		console.log("Installation complete");
		console.log("Next steps:");
		console.log("1. Install dependencies");
		console.log("     npm install");
		console.log("2. Run the server");
		console.log("     npm start");
	})
	.then(null, function(err) {
		console.log(err);
	});
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
	fs.writeFileSync(path, str, { mode: mode || 0666 });
	console.log('   \x1b[36mcreate\x1b[0m : ' + path);
}

/**
 * Mkdir -p.
 *
 * @param {String} path
 * @return {Promise}
 */

function mkdir(path) {
	var deferred = Q.defer();
	mkdirp(path, 0755, function(err) {
		if (err) return deferred.reject(err);
		deferred.resolve(path);
	});
	return deferred.promise;
}

main();