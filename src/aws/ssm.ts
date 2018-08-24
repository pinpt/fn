import { SSM, AWSError } from 'aws-sdk';
import { Config } from '../index';

const ssm = new SSM();

const isNotFound = (err : AWSError):boolean => err.code === 'ParameterNotFound' || /^Parameter .* not found\.$/.test(err.message);
const isRateLimitExceeded = (err : AWSError):boolean => err.message === 'Rate exceeded';

const flattenKV = (kv: {[key:string]:any}, k:string, v:any):void => {
	const a = k.split('/');
	let o = kv;
	for (let i = 0; i < a.length - 1; i += 1) {
		const n = a[i];
		if (n in o) {
			o = o[n];
		} else {
			o[n] = {};
			o = o[n];
		}
	}
	o[a[a.length - 1]] = v;
}

const get = (path: string, exact: boolean, callback: (err?: AWSError | null, data?: any) => void, count:number):void => {
	if (exact) {
		ssm.getParameter({ Name: path, WithDecryption: true }, (err?: AWSError | null, data? : SSM.GetParameterResult): void => {
			if (err) {
				if (isNotFound(err)) {
					callback(null, null);
				} else if (isRateLimitExceeded(err)) {
					if (count <= 5) {
						setTimeout(() => get(path, exact, callback, count+1), count * 100);
					} else {
						callback(err);
					}
				} else {
					callback(err);
				}
				return;
			}
			if (exact) {
				callback(null, data && data.Parameter && data.Parameter.Value);
			} else {
				callback(null, data);
			}
		});
	} else {
		ssm.getParametersByPath({ Path: path, Recursive: true, WithDecryption: true }, (err? : AWSError | null, data? : SSM.GetParametersByPathResult): void => {
            if (err) {
				if (isNotFound(err)) {
					callback(null, {});
				} else if (isRateLimitExceeded(err)) {
					if (count <= 5) {
						setTimeout(() => get(path, exact, callback, count+1), count * 100);
					} else {
						callback(err);
					}
				} else {
					callback(err);
				}
				return;
			}

			const kv : {[key:string]:any} = {};

			if (data && data.Parameters) {
				data.Parameters.forEach((e:SSM.Parameter):void => {
					if (e.Name) {
						let k = e.Name.replace(path, '');
						if (k[0] === '/') {
							k = k.substring(1);
						}
						flattenKV(kv, k, e.Value);
					}
				});
			}

			callback(null, kv);
		});
	}
}

const set = (path: string, value: string, description: string, callback: (err?: AWSError | null) => void, count:number):void => {
	const params = {
		Name: path,
		Value: value,
		Type: 'SecureString',
		Description: description,
		Overwrite: true,
    };
    ssm.putParameter(params, (err?: AWSError | null, data?: any):void => {
        if (err) {
            if (isRateLimitExceeded(err)) {
                if (count <= 5) {
                    setTimeout(
                        () => set(path, value, description, callback, count + 1),
                        count * 100
                    );
                    return;
                }        
            }
            callback(err);
            return;
        }
        callback();
    });        
}

const del = (path: string, callback: (err?: AWSError | null) => void, count:number):void => {
    ssm.deleteParameter({ Name:path }, (err?: AWSError | null, data?: any):void => {
        if (err) {
            if (isRateLimitExceeded(err)) {
				if (count <= 5) {
					setTimeout(
						() => del(path, callback, count + 1),
						count * 100
                    );
                    return;
				}
            }
			if (isNotFound(err)) {
                callback();
                return;
			}
            callback(err);
            return;
        }
        callback();
    });
}

/**
 * SSMConfig is an implementation of Config which uses AWS SSM for config storage
 */
export class SSMConfig implements Config {
	private cache: { [key: string]: any } = {};
	get(path: string, exact = false): Promise<any> {
		const found = this.cache[path];
		if (found) {
			return Promise.resolve(found);
		}
        return new Promise((resolve, reject) => {
			try {
				get(path, exact, (err?: AWSError | null, data?: any): void => {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				}, 1);	
			} catch (ex) {
				reject(ex);
			}
		});
	}
	set(path: string, value: any, description?: string| null): Promise<void> {
		delete this.cache[path];
        return new Promise((resolve, reject) => {
			try {
				set(path, value, description || '', (err?: AWSError | null, data?: any): void => {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				}, 1);	
			} catch (ex) {
				reject(ex);
			}
		});
	}
	delete(path: string): Promise<void> {
		delete this.cache[path];
        return new Promise((resolve, reject) => {
			try {
				del(path, (err?: AWSError | null, data?: any): void => {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				}, 1);	
			} catch (ex) {
				reject(ex);
			}
		});
	}
}
