/*
$auth
$subscribe
$fetch
*/

const WS = require("ws");
const wss = new WS.Server({ noServer: true });
const url = require('url');
const crypto = require("crypto");
const security = require("./security");
let client_count = 0;

const md5 = s => {
    return crypto.createHash('md5').update(String(s)).digest("hex");
}

wss.on('connection', function connection(ws, req) {
    // console.log(req);
    try {
        let client_id_string = `client-${client_count++}-${+new Date()}`;
        let client_id = md5(client_id_string);
        let msg_count = 0;
        ws.on('message', function message(msg) {
            try {
                let msg_id_string = `msg-${msg_count++}-${+new Date()}`;
                let msg_id = md5(msg_id_string);
                console.log(`Received message from ${client_id_string} (${msg_id_string})`);
                handleMessage(msg, client_id, msg_id);
            } catch(err) {
                console.error("message error", err);
            }
        });
    } catch(err) {
        console.error("connection error", err);
    }
});

const upgrade = async (req, socket, head) => {
    try {
        const pathname = url.parse(req.url).pathname;
        if (pathname !== "/websocket") throw("Only /websocket endpoint supported");
        wss.handleUpgrade(req, socket, head, function done(ws) {
            wss.emit('connection', ws, req);
        });
    } catch(err) {
        console.log("Websocket Auth failed");
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
    }
}

const handleMessage = (msg, client_id, msg_id)=> {
    // console.log(`Received message ${msg} from ${client_id} (${msg_id})`);
    try {
        if (typeof msg !== "object") throw "msg should be an object";
        
    } catch(err) {
        console.error(err);
    }
}

module.exports = {
    upgrade
};