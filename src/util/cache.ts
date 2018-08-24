export type OnExpired = (key:string, item:any) => void;
type CacheVal = {[key:string]:Entry};

class Entry {
    private readonly key : string;
    private readonly val : any;
    private readonly expires : number;
    private readonly callback : OnExpired | undefined;
    constructor(key:string, val:any, ttl?:number, cb?:OnExpired) {
        this.key = key;
        this.val = val;
        this.expires = Date.now() + (ttl || 60000);
        this.callback = cb;
    }
    expired():boolean {
        return Date.now() >= this.expires;
    }
    value():any {
        return this.val;
    }
    expire():void {
        if (this.callback) {
            this.callback(this.key, this.val);
        }
    }
}

// globalCache is a global for storing details in the cache
const globalCache : CacheVal = {};

/**
 * Cache is a convenience wrapper around an in-memory cache with ttl
 */
export default class Cache {
    /**
     * get a value from the cache, returning null if not found or expired
     */
    get(key:string):any {
        const entry = globalCache[key];
        if (entry) {
            if (entry.expired()) {
                delete globalCache[key];
                entry.expire();
                return null;
            }
            return entry.value();
        }
        return null;
    }
    /**
     * 
     * @param key cache key
     * @param value cache value
     * @param ttl how long to keep in the cache in milliseconds
     * @param expired optional callback to call after the item is removed from the cache
     */
    set(key:string, value:any, ttl?:number, expired?:OnExpired):void {
        globalCache[key] = new Entry(key, value, ttl, expired);
    }
}

// every minute, clear the cache if we find expired items
setInterval(() => {
    // find all the expired keys first
    const expiredKeys = Object.keys(globalCache).map(key => globalCache[key].expired() ? key : null).filter(k => k);
    if (expiredKeys.length) {
        // for each key, expire it
        expiredKeys.forEach((key:string|null):void => {
            if (key) {
                const entry = globalCache[key];
                if (entry) {
                    delete globalCache[key];
                    entry.expire();
                }
            }
        });
    }
}, 60000).unref();