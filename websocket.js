'use strict';

var config = require("./config");
var WebSocketServer = require("ws").Server;

var wss = new WebSocketServer({ port: config.websocket.port });
wss.broadcast = function broadcast(data) {
	wss.clients.forEach(function each(client) {
		client.send(data);
	});
};

// Loggging
var bunyan = require("bunyan");
var log = bunyan.createLogger({name: "websocket"});

log.info("Listening for connections", { port: config.websocket.port });

wss.on("connection", function (ws) {

	var sendMessage = function(data, client) {
		client = client || ws;
		client.send(JSON.stringify(data));
	};

	var sendError = function(err, client) {
		client = client || ws;
		client.send(JSON.stringify({ error: err }));
	}

	log.info("Websocket connection", ws.upgradeReq.headers);
	ws.rooms = [];
	ws.on("message", function (msg) {
		log.info({ evt: "Message received", msg: msg });
		try {
			msg = JSON.parse(msg);
		} catch (e) {
			log.error({ cause: "JSON.parse(msg)", msg: msg, error: e });
			return;
		}
		log.info(msg);
		if (msg.type == "subscribe") {
			if (!msg.room) {
				sendError("Missing parameters");
			}
			if (Array.isArray(msg.room)) {
				msg.room.forEach(function(room) {
					ws.rooms.push(room);	
				});
			} else {
				ws.rooms.push(msg.room);
			}
			sendMessage({ evt: "Subscribed", room: ws.rooms });
		}
		if (msg.type == "broadcast") {
			wss.clients.forEach(function(client) {
				if (!msg.room) {
					sendError("Missing parameters");
				}
				if (client.rooms.indexOf(msg.room) != -1) {
					sendMessage(msg, client);
				}
			})
		}
	});
	ws.on("close", function () {
		
	});
});

