const NodeCache = require('node-cache');
let cache;

const init = (config) => {
    if (!config.cache || !config.cache.enabled) return;
    cache = new NodeCache({ stdTTL: config.cache.ttl || 5 * 60 });
    if (config.cache.debug) {
        cache.on('expired', (key) => {
            console.log('cache expired', key)
        })
        cache.on('flush', () => {
            console.log('cache flush')
        })
    }
}

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
    if (!cache) return;
    const key = generateKey(req, res)
    cache.set(key, res.result)
    if (!req.config.cache.debug) {
        console.log('cache set', key)
    }
}

const get = (req, res, next) => {
    if (!cache) return next();
    const key = generateKey(req, res)
    res.header('jxp-cache-key', key);
    const cached = cache.get(key)
    if (cached) {
        if (!req.config.cache.debug) {
            console.log('cache hit', key)
        }
        res.header('jxp-cache', 'hit')
        res.result = cached
        res.send(res.result);
        return;
    }
    if (!req.config.cache.debug) {
        console.log('cache miss', key)
    }
    res.header('jxp-cache', 'miss')
    next()
}

const clear = async (req) => {
    if (!cache) return;
    const keys = cache.keys()
    keys.forEach(key => {
        if (key.startsWith(`${req.modelname}/`)) {
            if (!req.config.cache.debug) {
                console.log('cache del', key)
            }
            cache.del(key)
        }
    })
}

const clearAll = async () => {
    cache.flushAll()
}

const stats = async (req, res) => {
    if (!cache) {
        res.result = { cache_enabled: false }
        return;
    }
    res.result = cache.getStats()
}

module.exports = {
    init,
    set,
    get,
    clear,
    clearAll,
    stats,
}