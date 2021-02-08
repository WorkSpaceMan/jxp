const glob = require("glob");
const path = require("path");

const findModelDir = (dir) => {
	if (dir === "/") throw("Model dir not found");
	let result = glob.sync(path.join(dir, "**/user_model.js"));
	if (result.length) {
		return path.dirname(result.pop());
	}
	const found = findModelDir(path.join(dir, "../"));
	return found;
}

module.exports = { findModelDir }