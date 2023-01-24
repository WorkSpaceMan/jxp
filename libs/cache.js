const NodeCache = require('node-cache');
const config = require('config');
const cache = new NodeCache({ stdTTL: config.cache?.ttl || 5 * 60 });

const generateKey = (req, res) => {
    if (res.jxp_cache_key) return res.jxp_cache_key;
    let key = `${req.modelname}/`;
    if (req.params.item_id) {
        key += `${req.params.item_id}`
    }
    if (req.query) {
        key += `?${JSON.stringify(req.query)}`
    }
    res.jxp_cache_key = key;
    return key;
}

const set = async (req, res) => {
    if (!config.cache?.enabled) return;
    const key = generateKey(req, res)
    cache.set(key, res.result)
    if (config.cache?.debug) {
        console.log('cache set', key)
    }
}

const get = (req, res, next) => {
    if (!config.cache?.enabled) return;
    const key = generateKey(req, res)
    res.header('jxp-cache-key', key);
    const cached = cache.get(key)
    if (cached) {
        if (config.cache?.debug) {
            console.log('cache hit', key)
        }
        res.header('jxp-cache', 'hit')
        res.result = cached
        return res.send(res.result)
    }
    if (config.cache?.debug) {
        console.log('cache miss', key)
    }
    res.header('jxp-cache', 'miss')
    next()
}

const clear = async (req, res) => {
    if (!config.cache?.enabled) return;
    const keys = cache.keys()
    keys.forEach(key => {
        if (key.startsWith(`${req.modelname}/`)) {
            if (config.cache?.debug) {
                console.log('cache del', key)
            }
            cache.del(key)
        }
    })
}

const clearAll = async () => {
    if (!config.cache?.enabled) return;
    if (config.cache?.debug) {
        console.log('cache flushAll')
    }
    cache.flushAll()
}

const stats = async (req, res) => {
    if (!config.cache?.enabled) {
        res.result = { cache_enabled: false }
        return;
    }
    res.result = cache.getStats()
}

module.exports = {
    set,
    get,
    clear,
    clearAll,
    stats,
}