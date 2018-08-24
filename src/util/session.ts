import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { Request, Response, KeyValAnyMap } from '../';
import { SetCookie, GetCookie, DeleteCookie } from './cookie';

const encKey = 'nokqsklclrwixdfacwetgctzsuelurji';

const encrypt = (text: string): string => {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', new Buffer(encKey), iv);
    let encrypted = cipher.update(Buffer.from(text));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

const decrypt = (text: string): string => {
    const textParts = text.split(':');
    const iv = new Buffer(String(textParts.shift()), 'hex');
    const encryptedText = new Buffer(textParts.join(':'), 'hex');
    const decipher = createDecipheriv('aes-256-cbc', new Buffer(encKey), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// name of the session cookie
const cookieName = 'session';

/**
 * Session is a helper class for saving and restoring session data client side in
 * and encrypted cookie
 */
export default class Session {
    private readonly resp: Response;
    private kv: KeyValAnyMap = {};
    constructor(req: Request, resp: Response) {
        this.resp = resp;
        this.resp.on('send', this.serialize.bind(this));
        const value = GetCookie(req, cookieName);
        if (value) {
            try {
                const text = decrypt(value);
                this.kv = JSON.parse(text);
            } catch (ex) {
                console.error('error decrypting session cookie', ex);
            }
        }
    }
    set(key: string, val: any):void {
        this.kv[key] = val;
    }
    get(key: string):any {
        return this.kv[key];
    }
    delete(key: string):void {
        delete this.kv[key];
    }
    reset():void {
        this.kv = {};
        DeleteCookie(this.resp, cookieName);
    }
    private serialize() {
        if (Object.keys(this.kv).length) {
            const value = encrypt(JSON.stringify(this.kv));
            SetCookie(this.resp, cookieName, value);
        }
    }
}
