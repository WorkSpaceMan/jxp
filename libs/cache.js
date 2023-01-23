const NodeCache = require('node-cache');
const config = require('config');
const cache = new NodeCache({ stdTTL: config.cache?.ttl || 5 * 60 });

const generateKey = (req) => {
    const url = req.url
    return url
}

const set = (req, res, next) => {
    if (!config.cache?.enabled) return next();
    const key = generateKey(req)
    cache.set(key, res.result)
    next()
}

const get = (req, res, next) => {
    if (!config.cache?.enabled) return next();
    const key = generateKey(req)
    const cached = cache.get(key)
    if (cached) {
        res.header('jxp-cache', 'hit')
        res.result = cached
        return res.send(res.result)
    }
    res.header('jxp-cache', 'miss')
    next()
}

const clear = (req, res, next) => {
    if (!config.cache?.enabled) return next();
    cache.flushAll()
    next()
}

const stats = (req, res, next) => {
    if (!config.cache?.enabled) return {};
    res.result = cache.getStats()
    next()
}

module.exports = {
    set,
    get,
    clear,
    stats
}