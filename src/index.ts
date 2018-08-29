import { Handler } from 'aws-lambda';
import AWSInvoker from './aws';
export { SSMConfig, SecretManager } from './aws';
export { default as MySQLDB } from './mysql';
export * from './util';

/**
 * generic hash of key / values as strings
 */
export type KeyValMap = {[key:string]:string};
/**
 * generic hash of key /value where value is an any
 */
export type KeyValAnyMap = {[key:string]:any};
/**
 * either a string or undefined
 */
export type OptionalString = string | undefined;
/**
 * either a string or null
 */
export type NullString = string | null;
/**
 * an array of any value
 */
export type ArrayAny = any[];

/**
 * Request is the interface for an incoming HTTP request
 */
export interface Request {
    /**
     * incoming HTTP headers which are case insensitive
     */
    readonly headers: KeyValMap;
    /**
     * incoming raw body
     */
    readonly body?: string | null;
    /**
     * incoming HTTP query string
     */
    readonly query: KeyValMap;
    /**
     * path parameters if the route was parameterized
     */
    readonly params: KeyValMap;
    /**
     * auth token if provided
     */
    readonly authToken?: string;
    /**
     * method arn of the method invoked
     */
    readonly methodArn?: string;
    /**
     * account ID if an authorized invocation
     */
    readonly accountID?: string;
    /**
     * unique request ID for the request
     */
    readonly requestID?: string;
    /**
     * customerID if an authorized or routed invocation
     */
    readonly customerID?: string;
    /**
     * userID if an authorized invocation
     */
    readonly userID?: string;
    /**
     * resource ID for the lambda function
     */
    readonly resourceID?: string;
    /**
     * API ID for the lambda function
     */
    readonly apiID?: string;
    /**
     * stage for the lambda function
     */
    readonly stage?: string;
}

// OnHandler is the callback handler for on events
export type OnHandler = (event:string, resp:Response) => void;


/**
 * Response is the interface for an outgoing HTTP response
 */
export interface Response {
    /**
     * cacheable (default = true) can control if we attempt to cache the response with etag and if-none-match
     */
    cacheable: boolean;

    /**
     * set the cache-control header for the resource
     * @param maxAge max age in seconds for cache-control setting
     * @param revalidate if true, will send must-revalidate with cache-control header
     */
    cache(maxAge:number, revalidate?:boolean):void;

    /**
     * send raw string data
     * @param body body of the response
     * @param headers headers to send
     * @param statusCode status code to send, defaults to 200
     */
    send(body: string, headers?: KeyValMap, statusCode?: number):void;

    /**
     * send raw should only be called when you need to control the entire details of the callback response
     * @param err error response
     * @param body body of the response callback
     */
    sendRaw(err:any|null, body?:any):void;

    /**
     * send JSON response data
     * @param obj data value
     */
    json(data: Object | Promise<Object>):Promise<void>;

    /**
     * send a text response of text/plain
     * @param buf buffer value
     */
    text(buf:string|Buffer):void;

    /**
     * send an HTML response of text/html
     * @param buf buffer value
     */
    html(buf:string|Buffer):void;

    /**
     * send JS response of application/javascript
     * @param buf buffer value
     */
    javascript(buf:string|Buffer):void;

    /**
     * send Error JSON response
     * @param err Error object
     * @param statusCode optional status code, defaults to 500 Internal Server Error
     */
    error(err: Error, statusCode?: number):void

    /**
     * set a response HTTP header
     * @param key header name
     * @param value header value
     */
    set(key:string, value:string):void

    /**
     * redirect the request
     * @param url url to redirect to
     * @param status status code
     */
    redirect(url:string, status?:number):void;

    /**
     * listen for response emitted events
     * @param event event name to hook into
     * @param cb callback
     */
    on(event:string, cb:OnHandler):void;
}

/**
 * Config is an interface which implements a config store
 */
export interface Config {
    /**
     * return a path value
     * @param path path such as /a/b/c
     * @param exact if true, returns the exact value at the path instead of all children
     */
    get(path: string, exact?: boolean): Promise<any>;
    /**
     * set a config value
     * @param path path such as /a/b/c
     * @param value value to set
     * @param description description to set
     */
    set(path: string, value: any, description?: string | null): Promise<void>;
    /**
     * delete a value at the path specified
     * @param path path such as /a/b/c
     */
	delete(path: string): Promise<void>;
}

/**
 * Secrets is an interface which implements a secret store
 */
export interface Secrets {
    /**
     * return one or more secrets
     * @param key optional key, if not provided, will return all values
     */
    get(key?:string):Promise<any>;
}

/**
 * SQLDatabase is an interface which implements a SQL database
 */
export interface SQLDatabase {
    /**
     * run a read-only query against replica and return results
     * @param sql SQL statement
     * @param values optional values to parameterize the SQL
     */
    query(sql: string, values?: any): Promise<ArrayAny>;
    /**
     * run a write (insert, update, delete) statement against master and return rows impacted
     * @param sql SQL statement to execute
     * @param values optional values to parameterize the SQL
     */
    execute(sql: string, values?: any): Promise<number>;
}

/**
 * LambdaHandler is the callback that Fn lambda functions must implement
 */
export type LambdaHandler = (req: Request, resp: Response) => void;

/**
 * λ is the wrapper function for exposing the function to Serverless Framework
 * @param handler
 */
export function λ(handler: LambdaHandler): Handler {
    // we add this here instead of injection in webpack nonsense to ensure we have good source maps
    require('source-map-support').install();
    return AWSInvoker(handler);
}
