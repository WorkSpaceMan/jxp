// We need the server running so a bit hard to do integration tests. Run the server and then run this test.

// process.env.NODE_ENV = 'test';
const WebSocket = require("ws");
const config = require("config");
let client = null;

describe("Websocket Connect", () => {
    it("should connect to a websocket", async () => {
        client = new WebSocket(`ws://localhost:${config.port}/websocket`);
        client.on('message', msg => console.log(msg));
        // Wait for the client to connect using async/await
        await new Promise(resolve => client.once('open', resolve));
        client.send('Ping');
        return true;
    })
    it("second client should connect to a websocket", async () => {
        let client1 = new WebSocket(`ws://localhost:${config.port}/websocket`);
        client1.on('message', msg => console.log(msg));
        // Wait for the client to connect using async/await
        await new Promise(resolve => client1.once('open', resolve));
        client1.send('Pong');
        return true;
    })
    it("should maintain its connection", async () => {
        client.send('Pang');
        return true;
    })
});

