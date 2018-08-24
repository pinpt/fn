import { h64 } from 'xxhashjs';

/**
 * return a short hash based on one or more values using xxhash algorithm
 * @param args one or more values to hash
 */
export function hash (...args:Array<any>):string {
    const s = args.map(o => {
        switch(typeof(o)) {
            case 'string': 
            case 'number': 
            case 'boolean': {
                return o;
            }
        }
        return JSON.stringify(o);
    }).join('');

    let v = h64(s, 0).toString(16);
    if (v.length === 16) {
        return v;
    }
    for (let i = v.length; i < 16; i++) {
        v = '0' + v;
    }
    return v;
}