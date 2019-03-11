const config = require("config");

if (!config.memcached) {
    class Cache {
        read(req, res, next) {
            next();
        }
        write(req, res, next) {
            next();
        }
        clear(req, res, next) {
            next();
        }
    }
    module.exports = Cache;
} else {
    console.log("Enabling Cache", config.memcached);
    const crypto = require('crypto');
    const Memcached = require("memcached");
    const memcached = new Memcached(config.memcached.server);

    class Cache {
        constructor() {
        }

        async read(req, res, next) {
            const key = this.generateKey(req);
            try {
                const data = await this.mget(key);
                if (data)
                    return res.send(data);

                const oldSend = res.send;
                res.send = function() {
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
}
