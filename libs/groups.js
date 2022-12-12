const errors = require("restify-errors");

let Groups = null;

const init = config => {
	const path = require("path");
	Groups = require(path.join(config.model_dir, 'usergroups_model'));
};

const actionPut = async (req, res) => {
	const user_id = req.params.user_id;
	const group = req.body.group;
	if (!group) {
		console.error("Group required");
		return new errors.BadRequestError("Group required");
	}
	if (!user_id) {
		console.error("user_id required");
		return new errors.BadRequestError("user_id is required");
	}
	try {
		let userGroup = await Groups.findOne({ user_id: user_id });
		if (!userGroup) {
			userGroup = new Groups();
			userGroup.user_id = user_id;
			userGroup.groups = [];
		}
		if (Array.isArray(group)) {
			group.forEach(function(g) {
				if (userGroup.groups.indexOf(g) == -1) {
					userGroup.groups.push(g);
				}
			});
		} else {
			if (userGroup.groups.indexOf(group) == -1) {
				userGroup.groups.push(group);
			}
		}
		res.send(await userGroup.save());
	} catch(err) {
			console.error(err);
			return new errors.InternalServerError(err.toString());
	}
};

const actionPost = async (req, res) => {
	const user_id = req.params.user_id;
	const group = req.body.group;
	if (!group) {
		console.error("Group required");
		return new errors.BadRequestError("Group required");
	}
	if (!user_id) {
		console.error("user_id required");
		return new errors.BadRequestError("user_id required");
	}
	try {
		let userGroup = await Groups.findOne({ user_id: user_id });
		if (!userGroup) {
			userGroup = new Groups();
			userGroup.user_id = user_id;
		}
		userGroup.groups = [];
		if (Array.isArray(group)) {
			group.forEach(function (g) {
				if (userGroup.groups.indexOf(g) == -1) {
					userGroup.groups.push(g);
				}
			});
		} else {
			if (userGroup.groups.indexOf(group) == -1) {
				userGroup.groups.push(group);
			}
		}
		res.send(await userGroup.save());
	} catch (err) {
		console.error(err);
		return new errors.InternalServerError(err.toString());
	}
};

const actionGet = async (req, res) => {
	var user_id = req.params.user_id;
	if (!user_id) {
		console.error("user_id required");
		return new errors.BadRequestError("user_id required");
	}
	try {
		let userGroup = await Groups.findOne({ user_id });
		if (!userGroup) {
			res.send({ groups: [] });
			return;
		}
		res.send(userGroup);
	} catch (err) {
		console.error(err);
		return new errors.InternalServerError(err.toString());
	}
};

const actionDelete = async (req, res) => {
	const user_id = req.params.user_id;
	const group = req.query.group;
	if (!group) {
		return new errors.BadRequestError("Group required");
	}
	if (!user_id) {
		console.error("user_id required");
		return new errors.BadRequestError("user_id required");
	}
	try {
		let userGroup = await Groups.findOne({ user_id });
		if (!userGroup) {
			return new errors.BadRequestError("User not found");
		}
		let i = userGroup.groups.indexOf(group);
		if (i > -1) {
			userGroup.groups.splice(i, 1);
		}
		res.send(await userGroup.save());
	} catch (err) {
		console.error(err);
		return new errors.InternalServerError(err.toString());
	}
};

module.exports = {
	init,
	actionPut,
	actionPost,
	actionGet,
	actionDelete
};
