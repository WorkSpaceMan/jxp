var Groups = null;

var init = config => {
	var path = require("path");
	Groups = require(path.join(config.model_dir, 'usergroups_model'));
};

var actionPut = async (req, res) => {
	const user_id = req.params.user_id;
	const group = req.body.group;
	if (!group) {
		console.error("Group required");
		res.send(400, "Group required");
		return;
	}
	if (!user_id) {
		console.error("user_id required");
		res.send(400, "user_id required");
		return;
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
			res.send(500, err);
			return;
	}
};

var actionPost = async (req, res) => {
	const user_id = req.params.user_id;
	const group = req.body.group;
	if (!group) {
		console.error("Group required");
		res.send(400, "Group required");
		return;
	}
	if (!user_id) {
		console.error("user_id required");
		res.send(400, "user_id required");
		return;
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
		res.send(500, err);
		return;
	}
};

var actionGet = async (req, res) => {
	var user_id = req.params.user_id;
	if (!user_id) {
		console.error("user_id required");
		res.send(400, "user_id required");
		return;
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
		res.send(500, err);
		return;
	}
};

var actionDelete = async (req, res) => {
	const user_id = req.params.user_id;
	const group = req.query.group;
	if (!group) {
		res.send(400, "Group required");
		return;
	}
	if (!user_id) {
		console.error("user_id required");
		res.send(400, "user_id required");
		return;
	}
	try {
		let userGroup = await Groups.findOne({ user_id });
		if (!userGroup) {
			res.send(400, "User not found");
			return;
		}
		var i = userGroup.groups.indexOf(group);
		if (i > -1) {
			userGroup.groups.splice(i, 1);
		}
		res.send(await userGroup.save());
	} catch (err) {
		console.error(err);
		res.send(500, err);
		return;
	}
};

module.exports = {
	init: init,
	actionPut: actionPut,
	actionPost: actionPost,
	actionGet: actionGet,
	actionDelete: actionDelete
};
