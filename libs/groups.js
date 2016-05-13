var Groups = require("../models/usergroups_model.js");

var actionPut = function(req, res, next) {
	var user_id = req.params.user_id;
	var group = req.params.group;
	if (!group) {
		console.error("Group required");
		res.send(400, "Group required");
		return;
	}
	Groups.findOne({ user_id: user_id }, function(err, userGroup) {
		if (err) {
			console.error(err);
			res.send(500, err);
			return;
		}
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
		userGroup.save(function(err, result) {
			if (err) {
				console.error(err);
				res.send(500, err);
				return;
			}
			res.send(result);
		});
	});
};

var actionPost = function(req, res, next) {
	var user_id = req.params.user_id;
	var group = req.params.group;
	if (!group) {
		group = [];
	}
	Groups.findOne({ user_id: user_id }, function(err, userGroup) {
		if (err) {
			res.send(500, err);
			return;
		}
		if (!userGroup) {
			userGroup = new Groups();
			userGroup.user_id = user_id;
		}
		userGroup.groups = [];
		if (Array.isArray(group)) {
			userGroup.groups = group;
		} else {
			userGroup.groups.push(group);
		}
		userGroup.save(function(err, result) {
			if (err) {
				res.send(500, err);
				return;
			}
			res.send(result);
		});
	});
};

var actionGet = function(req, res, next) {
	var user_id = req.params.user_id;
	Groups.findOne({ user_id: user_id }, function(err, userGroup) {
		if (err) {
			res.send(500, err);
			return;
		}
		if (!userGroup) {
			res.send({ groups: [] });
			return;
		}
		res.send(userGroup);
	});
};

var actionDelete = function(req, res, next) {
	var user_id = req.params.user_id;
	var group = req.params.group;
	if (!group) {
		res.send(400, "Group required");
		return;
	}
	Groups.findOne({ user_id: user_id }, function(err, userGroup) {
		if (err) {
			res.send(500, err);
			return;
		}
		if (!userGroup) {
			res.send(400, "User not found");
			return;
		}
		var i = userGroup.groups.indexOf(group);
		if (i > -1) {
			userGroup.groups.splice(i, 1);
		}
		userGroup.save(function(err, result) {
			if (err) {
				res.send(500, err);
				return;
			}
			res.send(result);
		});
	});
};

module.exports = {
	actionPut: actionPut,
	actionPost: actionPost,
	actionGet: actionGet,
	actionDelete: actionDelete
};