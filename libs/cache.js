const config = require("config");
const crypto = require('crypto');

console.log("Cache", config.memcached);

if (!config.memcached) {
    module.exports = {
        read: (req, res, next) => {
            next();
        },
        write: (req, res, next) => {
            next();
        },
        clear: (req, res, next) => {
            next();
        }
    }
    return;
}

const Memcached = require("memcached");
const memcached = new Memcached(config.memcached.server);


class Cache {
    constructor() {
    }

    async read(req, res, next) {
        const key = this.generateKey(req);
        try {
            const data = await this.mget(key);
            console.log({ data });
            if (data)
                return res.send(data);

            const oldSend = res.send;
            res.send = function(data) {
                console.log("Override", arguments);

                oldSend.apply(this, arguments);
            }

            return next();
        } catch(err) {
            console.error(err);
            res.send(500, err);
        }
    }

    async flush(req, res, next) {
        memcached.flush(err => {
            if (err)
                console.error(err);
            next();
        });
    }

    generateKey(req) {
        var params = [];
        for (let i in params) {
            params.push(i + "=" + params[i]);
        }
        params.sort();
        const str = `${ req.url }?${ params.join("&") }`;
        return crypto.createHash('md5').update(str).digest("hex");
    }

    mget(key) {
        console.log("mget", key);
        return new Promise((resolve, reject) => {
            memcached.get(key, (err, data) => {
                if (err)
                    return reject(err);
                if (data)
                    return resolve(data);
                return resolve(null);
            })
        });
    }

    msave(key, data) {
        console.log("msave", key);
        return new Promise((resolve, reject) => {
            memcached.set(key, data, config.memcached.lifetime, (err) => {
                if (err)
                    return reject(err);
                if (data)
                    return resolve(data);
                return resolve(null);
            })
        });
    }
}

module.exports = Cache;
