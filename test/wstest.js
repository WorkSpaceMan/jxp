// We need the server running so a bit hard to do integration tests. Run the server and then run this test.

// process.env.NODE_ENV = 'test';
const WebSocket = require("ws");
const config = require("config");
let client, client1 = null;
const headers = {
    // perMessageDeflate: false,
    Authorization: `Basic afPooDLssnRNlPNP`
};

describe("Websocket Connect", () => {
    it("should connect to a websocket", async () => {
        client = new WebSocket(`ws://localhost:${config.port}/websocket`, headers);
        client.on('message', msg => console.log(msg));
        // Wait for the client to connect using async/await
        await new Promise(resolve => client.once('open', resolve));
        client.send(JSON.stringify({
            action: "ping",
            msg_id: +new Date()
        }));
        // console.log({ result });
        return true;
    })
    it("second client should connect to a websocket", async () => {
        client1 = new WebSocket(`ws://localhost:${config.port}/websocket`, headers);
        client1.on('message', msg => console.log(msg));
        // Wait for the client to connect using async/await
        await new Promise(resolve => client1.once('open', resolve));
        client1.send(JSON.stringify({
            action: "ping",
            msg_id: +new Date()
        }));
        // console.log({ result });
        return true;
    })
    it("client should authenticate", async () => {
        client.send(JSON.stringify({
            msg_id: +new Date(),
            action: "auth",
            data: {
                email: "test@freespeechpub.co.za",
                password: "test"
            }
        }));
        // console.log({ result });
        return true;
    })
    it("client1 should authenticate", async () => {
        client1.send(JSON.stringify({
            msg_id: +new Date(),
            action: "auth",
            data: {
                email: "test@freespeechpub.co.za",
                password: "test"
            }
        }));
        // console.log({ result });
        return true;
    })
    it('Should wait a bit', function (done) {
        setTimeout(function () {
            console.log('waiting over.');
            done();
        }, 500)
    })
    it("should subscribe to test", async () => {
        client.send(JSON.stringify({
            action: "subscribe",
            msg_id: +new Date(),
            data: {
                model: "test"
            }
        }));
        return true;
    })
    it("should subscribe to test", async () => {
        client1.send(JSON.stringify({
            action: "subscribe",
            msg_id: +new Date(),
            data: {
                model: "test",
                filter: {
                    foo: "Blah"
                }
            }
        }));
        return true;
    })
    it("should unsubscribe to test", async () => {
        client.send(JSON.stringify({
            action: "unsubscribe",
            msg_id: +new Date(),
            data: {
                model: "test"
            }
        }));
        return true;
    })
    it("should subscribe to a single test", async () => {
        client.send(JSON.stringify({
            action: "subscribe",
            msg_id: +new Date(),
            data: {
                model: "test",
                id: "5f0c6e89b1de06e6a91f54a3"
            }
        }));
        return true;
    })
    // it('Should wait a bit', function (done) {
    //     console.log('waiting 1.5 seconds');
    //     setTimeout(function () {
    //         console.log('waiting over.');
    //         done();
    //     }, 1500)
    // })
    // it("should close the connections", async () => {
    //     client.close();
    //     client1.close();
    //     return true;
    // })
});

