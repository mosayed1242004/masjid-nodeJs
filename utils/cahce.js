const NodeCache = require("node-cache");

const cache = new NodeCache({
    stdTTL: 60, // البيانات تعيش 60 ثانية
    checkperiod: 120
});

cache.delByPrefix = function (prefix) {
    const matchedKeys = this.keys().filter(key => key.startsWith(prefix));
    if (matchedKeys.length > 0) {
        this.del(matchedKeys);
    }
    return matchedKeys.length;
};

module.exports = cache;
