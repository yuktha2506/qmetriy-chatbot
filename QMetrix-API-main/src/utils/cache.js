class Cache {
    generateKey(prefix, params) {
        const normalized = Object.keys(params).sort().map(
            (k) => `${k}=${params[k] === null || params[k] === undefined ? '_' : params[k]}`
        ).join(':');
        return `${prefix}:${normalized}`;
    }
}

export default new Cache();
