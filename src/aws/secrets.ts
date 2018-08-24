import { SecretsManager } from 'aws-sdk';
import { Request, Secrets, KeyValAnyMap } from '../index';

const client = new SecretsManager();

// global cache where the key is the customer id and the value is the customer specific cache
const cache : KeyValAnyMap = {};

export default class SecretManager implements Secrets {
    private readonly cache : KeyValAnyMap;
    private readonly id : string;
    constructor(req : Request) {
        if (!req.customerID) {
            throw new Error('no customer ID which is required for secrets');
        }
        this.id = req.customerID;
        let c = cache[req.customerID];
        if (!c) {
            c = {};
            cache[req.customerID] = c;
        }
        this.cache = c;
    }
    get(key?:string):Promise<any> {
        // if no key is provided, check to see if we have any keys in the cache
        // and if so, return the entire object
        if (key === undefined) {
            if (Object.keys(this.cache).length > 0) {
                return Promise.resolve(this.cache);
            }
        } else {
            const value = this.cache[key];
            if (value) {
                return Promise.resolve(value);
            }
        }
        return new Promise((resolve, reject) => {
            client.getSecretValue({SecretId:`customer/${this.id}`}, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    const value = data.SecretString;
                    if (value && value.charAt(0) === '{' && value.charAt(value.length - 1) === '}') {
                        try {
                            const obj = JSON.parse(value);
                            Object.keys(obj).forEach(k => this.cache[k] = obj[k]);
                            if (key) {
                                // return a specific key
                                resolve(obj[key]);
                            } else {
                                // return the entire object
                                resolve(obj);
                            }
                        } catch (ex) {
                            reject(ex);
                        }
                        return;
                    }
                    reject(new Error('secret did not return a json object'));
                }
            });
        });
    }
}