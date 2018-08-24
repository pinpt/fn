import cookie, { CookieSerializeOptions } from 'cookie';
import binaryCase from 'binary-case';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, KeyValMap, NullString } from '../';

const internalCookieSecret = process.env.FN_COOKIE_SECRET || '';
if (!internalCookieSecret) {
    console.error('missing required FN_COOKIE_SECRET setting in environment');
    process.exit(1);
}

/**
 * set a cookie for the response
 * @param resp response object
 * @param name cookie name
 * @param value cookie value
 * @param options cookie options
 */
export function SetCookie(resp:Response, name:string, value:string, options:CookieSerializeOptions = { secure: true, path: '/', httpOnly: true, sameSite: 'strict' }):void {
    // NOTE; this is super bizzare code ... but it's because of API Gateway / Lambda limitations with
    // only being able to have one unique key per hash.  this will use binary casing to create a unique
    // key (case sensitive) for header name for multiple cookies but then when they are sent back to the
    // client they are case insensitive and merged together
    const o = resp as any;
    const h = o as KeyValMap;
    const cookies = (h.__cookies || {}) as KeyValMap;
    const count = Object.keys(cookies).length;
    const headerName = binaryCase('set-cookie', count + 1);
    const cookieStr = cookie.serialize(name, value, options);
    cookies[headerName] = cookieStr;
    o.__cookies = cookies;
    Object.keys(cookies).forEach(k => resp.set(k, cookies[k]));
    // if offline (running local), we only can support one cookie since multiple set don't work
    if (!/\.sig$/.test(name) && !process.env.IS_OFFLINE) {
        // we always used signed cookies ... so create a signed cookie which is HMAC256 of value of cookie
        SetCookie(resp, `${name}.sig`, createHmac('sha256', internalCookieSecret).update(value).digest('hex'), options);
    }
}

/**
 * Delete a cookie by setting the value to empty string and setting expiration to the past
 * @param resp response object
 * @param name cookie name
 */
export function DeleteCookie(resp:Response, name:string):void {
    const now = Date.now() - 864000;
    SetCookie(resp, name, '', {
        secure: true,
        path: '/',
        httpOnly: true,
        sameSite: true,
        expires: new Date(now)
    });
}

/**
 * get a cookie value from the request. will only return valid signed cookies
 * @param req request
 * @param name name of the cookie
 */
export function GetCookie(req:Request, name:string) : NullString {
    if (req.headers.Cookie) {
        const kv = cookie.parse(req.headers.Cookie);
        if (kv) {
            const value = kv[name];
            if (value) {
                // if offline (running local), we only can support one cookie since multiple set don't work
                if (!process.env.IS_OFFLINE) {
                    const sig = kv[`${name}.sig`];
                    if (sig) {
                        const a = Buffer.from(sig);
                        const b = Buffer.from(createHmac('sha256', internalCookieSecret).update(value).digest('hex'));
                        if (a.length === b.length) {
                            if (timingSafeEqual(a, b)) {
                                return value;
                            }
                        }
                    }
                } else {
                    return value;
                }
            }
        }    
    }
    return null;
}