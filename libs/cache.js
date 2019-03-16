const config = require("config");

if (!config.memcached) {
    class Cache {
        constructor() {
            this.cachHits = 0;
            this.cacheMisses = 0;
            this.cacheEnabled = false;
        }

        read(req, res, next) {
            next();
        }
        write(req, res, next) {
            next();
        }
        clear(req, res, next) {
            next();
        }
        flush(req, res, next) {
            next();
        }
        status() {
            return { cachHits: null, cacheMisses: null, ratio: null, cacheEnabled: this.cacheEnabled };
        }
    }
    module.exports = Cache;
} else {
    console.log("Enabling Cache", config.memcached);
    const crypto = require('crypto');
    const Memcached = require("memcached");
    const memcached = new Memcached(config.memcached.server);
    // Flush cache on startup/restart
    memcached.flush(err => {
        if (err)
            console.error(err);
    });
    class Cache {
        constructor() {
            this.cachHits = 0;
            this.cacheMisses = 0;
            this.cacheEnabled = true;
        }

        async read(req, res, next) {
            const key = this.generateKey(req);
            try {
                const data = await this.mget(key);
                if (data) {
                    this.cachHits++;
                    return res.send(data);
                }
                const oldSend = res.send;
                res.send = function() {
                    oldSend.apply(this, arguments);
                }
                this.cacheMisses++;
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

        status() {
            return { cachHits: this.cachHits, cacheMisses: this.cacheMisses, ratio: this.cacheHits / this.cacheMisses, cacheEnabled: this.cacheEnabled };
        }
    }

    module.exports = Cache;
}
