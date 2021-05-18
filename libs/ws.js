/*
$auth
$subscribe
$fetch
*/

const WS = require("ws");
const url = require('url');
const crypto = require("crypto");
const security = require("./security");
let client_count = 0;
const EventEmitter = require("events");

class Emitter extends EventEmitter { }
const emitter = new Emitter();
emitter.setMaxListeners(500);

let models = [];

const md5 = s => {
    return crypto.createHash('md5').update(String(s)).digest("hex");
}

const wss = new WS.Server({ noServer: true });

const init = (data) => {
    models = data.models;
}

class WSClient {
    constructor(ws) {
        this.ws = ws;
        this.id_string = `client-${client_count++}-${+new Date()}`;
        this.id = md5(this.id_string);
        this.msg_count = 0;
        this.is_authed = false;
        this.user = null;
        this.actions = {
            ping: this.ping,
            auth: this.auth,
            subscribe: this.subscribe,
            unsubscribe: this.unsubscribe
        }
        this.listeners = {};
    }

    close() {
        this.is_authed = false;
        this.user = null;
        this.listeners = [];
    }

    async receive(msg) {
        this.msg_count++;
        let parsed_msg = null;
        try {
            parsed_msg = JSON.parse(msg);
        } catch (err) {
            console.log("Unable to parse message", msg);
            return {
                status: "error",
                message: "Unable to parse message"
            }
        }
        try {
            if (typeof parsed_msg !== "object") throw "msg should be an object";
            if (!parsed_msg.action) throw "missing action";
            if (!this.actions[parsed_msg.action]) throw `action ${parsed_msg.action} not implemented`;
            if (!parsed_msg.msg_id) throw `missing msg_id`;
            parsed_msg.data = parsed_msg.data || {};
            const result = await this.actions[parsed_msg.action].call(this, parsed_msg.data);
            return {
                action: parsed_msg.action,
                status: "okay",
                client_id: this.id,
                msg_id: parsed_msg.msg_id,
                result
            }
        } catch (err) {
            console.error(err);
            return {
                status: "error",
                message: err,
                msg_id: parsed_msg.msg_id
            }
        }
    }

    async ping() {
        return "pong!";
    }

    async auth(data) {
        let user = null;
        if (data.email && data.password) {
            user = await security.basicAuth([data.email, data.password]);
        }
        if (data.apikey) {
            user = await security.apiKeyAuth(data.apikey);
        }
        if (data.token) {
            user = await security.bearerAuth(data.token);
        }
        if (!user || !user.email) throw "Unable to authenticate";
        this.user = user;
        this.is_authed = true;
        this.groups = await security.getGroups(this.user._id);
        console.log(`Logged in ${user.name} <${user.email}>`)
        return "Authed";
    }

    async subscribe(data) {
        try {
            if (!this.is_authed) throw ("User not authenticated");
            if (data.id) {
                if (this.listeners[`put-${this.id}-${data.model}-${data.id}`]) return `Already subscribed`;
                await security.check_perms(this.user, this.groups, models[data.model], "r", data.id);
                // Put
                this.listeners[`put-${this.id}-${data.model}-${data.id}`] = {};
                this.listeners[`put-${this.id}-${data.model}-${data.id}`].fn = this.sendPut.bind(this);
                if (data.filter) this.listeners[`put-${this.id}-${data.model}-${data.id}`].filter = data.filter;
                emitter.on(`put-${data.model}-${data.id}`, this.listeners[`put-${this.id}-${data.model}-${data.id}`].fn);
                // Delete
                this.listeners[`del-${this.id}-${data.model}-${data.id}`] = {};
                this.listeners[`del-${this.id}-${data.model}-${data.id}`].fn = this.sendPut.bind(this);
                if (data.filter) this.listeners[`del-${this.id}-${data.model}-${data.id}`].filter = data.filter;
                emitter.on(`del-${data.model}-${data.id}`, this.listeners[`del-${this.id}-${data.model}-${data.id}`].fn);
                return `Subscribed to put-${this.id}-${data.model}-${data.id}`;
            } else {
                if (this.listeners[`post-${this.id}-${data.model}`]) return `Already subscribed`;
                await security.check_perms(this.user, this.groups, models[data.model], "r");
                // Post
                this.listeners[`post-${this.id}-${data.model}`] = {};
                if (data.filter) this.listeners[`post-${this.id}-${data.model}`].filter = data.filter;
                this.listeners[`post-${this.id}-${data.model}`].fn = this.sendPost.bind(this);
                emitter.on(`post-${data.model}`, this.listeners[`post-${this.id}-${data.model}`].fn);
                // Put
                this.listeners[`put-${this.id}-${data.model}`] = {};
                this.listeners[`put-${this.id}-${data.model}`].fn = this.sendPut.bind(this);
                if (data.filter) this.listeners[`put-${this.id}-${data.model}`].filter = data.filter;
                emitter.on(`put-${data.model}`, this.listeners[`put-${this.id}-${data.model}`].fn);
                // Delete
                this.listeners[`del-${this.id}-${data.model}`] = {};
                this.listeners[`del-${this.id}-${data.model}`].fn = this.sendPut.bind(this);
                if (data.filter) this.listeners[`del-${this.id}-${data.model}`].filter = data.filter;
                emitter.on(`del-${data.model}`, this.listeners[`del-${this.id}-${data.model}`].fn);
                return `Subscribed to post-${this.id}-${data.model}`;
            }
        } catch (err) {
            console.error(err);
            return `Failed to subscribe to ${data.model} (${err})`;
        }
    }

    async unsubscribe(data) {
        if (data.id) {
            emitter.off(`put-${this.id}-${data.model}-${data._id}`, this.listeners[`put-${this.id}-${data.model}-${data._id}`].fn);
            delete (this.listeners[`put-${this.id}-${data.model}-${data._id}`]);
            emitter.off(`del-${this.id}-${data.model}-${data._id}`, this.listeners[`del-${this.id}-${data.model}-${data._id}`].fn);
            delete (this.listeners[`del-${this.id}-${data.model}-${data._id}`]);
            return `Unsubscribed to ${data.model}-${data._id}`;
        } else {
            emitter.off(`post-${this.id}-${data.model}`, this.listeners[`post-${this.id}-${data.model}`].fn);
            delete (this.listeners[`post-${this.id}-${data.model}`]);
            emitter.off(`put-${this.id}-${data.model}`, this.listeners[`put-${this.id}-${data.model}`].fn);
            delete (this.listeners[`put-${this.id}-${data.model}`]);
            emitter.off(`del-${this.id}-${data.model}`, this.listeners[`del-${this.id}-${data.model}`].fn);
            delete (this.listeners[`del-${this.id}-${data.model}`]);
            return `Unsubscribed to ${data.model}`;
        }
    }

    async send(data) {
        this.ws.send(JSON.stringify({ client_id: this.id, data }));
    }

    async sendPost(data) {
        if (this.listeners[`post-${this.id}-${data.modelname}`] && this.listeners[`post-${this.id}-${data.modelname}`].filter) {
            let passed = false;
            if (!Object.keys(this.listeners[`post-${this.id}-${data.modelname}`].filter).length) passed = true;
            for (let filter in this.listeners[`post-${this.id}-${data.modelname}`].filter) {
                if (data.result[filter].toString() === this.listeners[`post-${this.id}-${data.modelname}`].filter[filter]) passed = true;
            }
            if (!passed) return;
        }
        this.send({
            event: "post",
            modelname: data.modelname,
            item: data.result,
            user_id: data.user._id,
            user_name: data.user.name,
            user_email: data.user.email,
        });
    }

    async sendPut(data) {
        if (this.listeners[`put-${this.id}-${data.modelname}`] && this.listeners[`put-${this.id}-${data.modelname}`].filter) {
            let passed = false;
            if (!Object.keys(this.listeners[`post-${this.id}-${data.modelname}`].filter).length) passed = true;
            for (let filter in this.listeners[`put-${this.id}-${data.modelname}`].filter) {
                if (data.result[filter].toString() === this.listeners[`put-${this.id}-${data.modelname}`].filter[filter]) passed = true;
            }
            if (!passed) return;
        }
        this.send({
            event: "put",
            modelname: data.modelname,
            item: data.result,
            user_id: data.user._id,
            user_name: data.user.name,
            user_email: data.user.email,
        });
    }

    async sendDel(data) {
        if (this.listeners[`del-${this.id}-${data.modelname}`] && this.listeners[`del-${this.id}-${data.modelname}`].filter) {
            let passed = false;
            if (!Object.keys(this.listeners[`post-${this.id}-${data.modelname}`].filter).length) passed = true;
            for (let filter in this.listeners[`del-${this.id}-${data.modelname}`].filter) {
                if (data.result[filter].toString() === this.listeners[`del-${this.id}-${data.modelname}`].filter[filter]) passed = true;
            }
            if (!passed) return;
        }
        this.send({
            event: "del",
            modelname: data.modelname,
            item: data.result,
            user_id: data.user._id,
            user_name: data.user.name,
            user_email: data.user.email,
        });
    }
}

wss.on('connection', function connection(ws) {
    try {
        const client = new WSClient(ws);
        // clients[client.id] = client;
        ws.on('message', async function message(msg) {
            try {
                console.log(`Received message from ${client.id}`);
                const result = await client.receive(msg);
                ws.send(JSON.stringify(result));
            } catch (err) {
                console.error("message error", err);
            }
        });
        ws.on('close', function close() {
            if (client.user) {
                console.log(`Close ${client.user.name} <${client.user.email}>`);
            } else {
                console.log(`Close anonymous connection`);
            }
            client.close();
        });
    } catch (err) {
        console.error("connection error", err);
    }
});

const upgrade = async (req, socket, head) => {
    try {
        const pathname = url.parse(req.url).pathname;
        if (pathname !== "/websocket") throw ("Only /websocket endpoint supported");
        wss.handleUpgrade(req, socket, head, function done(ws) {
            wss.emit('connection', ws, req);
        });
    } catch (err) {
        console.log("Websocket Auth failed");
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
    }
}

const postHook = async (modelname, result, user) => {
    emitter.emit(`post-${modelname}`, { modelname, result, user });
}

const putHook = async (modelname, result, user) => {
    emitter.emit(`put-${modelname}-${result._id}`, { modelname, result, user });
    emitter.emit(`put-${modelname}`, { modelname, result, user });
}

const delHook = async (modelname, result, user) => {
    emitter.emit(`del-${modelname}-${result._id}`, { modelname, result, user });
    emitter.emit(`del-${modelname}`, { modelname, result, user });
}

module.exports = {
    upgrade,
    postHook,
    putHook,
    delHook,
    init
};