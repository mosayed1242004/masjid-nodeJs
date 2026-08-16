const NodeCache = require("node-cache");

const cache = new NodeCache({
    stdTTL: 120, // البيانات تعيش 60 ثانية
    checkperiod: 120
});

module.exports = cache;