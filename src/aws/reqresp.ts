import { APIGatewayEvent, Callback, CustomAuthorizerEvent, Context } from 'aws-lambda';
import { createHmac } from 'crypto';
import { Request, Response, KeyValMap, KeyValAnyMap, OptionalString, NullString, OnHandler, RequestEvent } from '../index';

// isCustomAuthorizerEvent returns true if the object is an CustomAuthorizerEvent interface
const isCustomAuthorizerEvent = (event: RequestEvent): boolean => 'authorizationToken' in event;

// etag will generate a consistent etag value for a request and response body
const etag = (body:string, arn:string, qs:string, customerID:string = ''): string => createHmac('sha256', 'etag').update(body).update(arn).update(qs).update(customerID).digest('hex');

/**
 * LambdaRequest is an implementation of Request for AWS Lambda
 */
export class LambdaRequest implements Request {
    public readonly event: RequestEvent;
    public readonly context : Context;
    constructor(event: RequestEvent, context: Context) {
        this.event = event;
        this.context = context;
    }
    get headers(): KeyValMap {
        const e = this.event as APIGatewayEvent;
        if (e.headers) {
            // make it case insensitive
            const h : KeyValMap = {};
            Object.keys(e.headers).forEach((k:string):void => {
                h[k] = e.headers[k];
                h[k.toLowerCase()] = e.headers[k];
            });
            return h;
        }
        return {};
    }
    get userID():OptionalString {
        const e = this.event as APIGatewayEvent;
        if (e.requestContext && e.requestContext.authorizer) {
            return e.requestContext.authorizer.principalId;
        }
        return undefined;
    }
    get customerID():OptionalString {
        const e = this.event as APIGatewayEvent;
        if (e.requestContext && e.requestContext.authorizer) {
            return e.requestContext.authorizer.CustomerID;
        }
        return undefined;
    }
    get accountID():OptionalString {
        const e = this.event as APIGatewayEvent;
        if (e.requestContext) {
            return e.requestContext.accountId;
        }
        return undefined;
    }
    get apiID():OptionalString {
        const e = this.event as APIGatewayEvent;
        if (e.requestContext) {
            return e.requestContext.apiId;
        }
        return undefined;
    }
    get resourceID():OptionalString {
        const e = this.event as APIGatewayEvent;
        if (e.requestContext) {
            return e.requestContext.resourceId;
        }
        return undefined;
    }
    get requestID():OptionalString {
        const e = this.event as APIGatewayEvent;
        if (e.requestContext) {
            return e.requestContext.requestId;
        }
        return undefined;
    }
    get stage():OptionalString {
        const e = this.event as APIGatewayEvent;
        if (e.requestContext) {
            return e.requestContext.stage;
        }
        return undefined;
    }
    get methodArn():OptionalString {
        if (isCustomAuthorizerEvent(this.event)) {
            const e = this.event as CustomAuthorizerEvent;
            return e.methodArn || undefined;
        } else {
            return this.context.invokedFunctionArn;
        }
    }
    get authToken():OptionalString {
        if (isCustomAuthorizerEvent(this.event)) {
            const e = this.event as CustomAuthorizerEvent;
            return e.authorizationToken || undefined;
        }
        return undefined;
    }
    get params():KeyValAnyMap {
        return this.event.pathParameters || {};
    }
    set params(m : KeyValAnyMap) {
        this.event.pathParameters = m;
    }
    get query():KeyValMap {
        return this.event.queryStringParameters || {};
    }
    get path(): OptionalString {
        return this.params['proxy'];
    }
    get method(): OptionalString {
        const { httpMethod } = this.event as APIGatewayEvent;
        return httpMethod; 
    }
    get body():NullString {
        const e = this.event as APIGatewayEvent;
        if (e.isBase64Encoded) {
            return new Buffer(e.body as string, 'base64').toString('utf-8');
        } else {
            return e.body;
        }
    }
}

type HandlersMap = {[key:string]:Array<OnHandler>};

/**
 * LambdaResponse is an implementation of Response for AWS Lambda
 */
export class LambdaResponse implements Response {
    private readonly req: LambdaRequest;
    private readonly cb: Callback;
    private headers: KeyValMap = {};
    private handlers: HandlersMap = {};
    cacheable: boolean = true;
    constructor(req: LambdaRequest, event: APIGatewayEvent,  cb: Callback) {
        this.req = req;
        this.cb = cb;
    }
    cache(maxAge:number, revalidate = false):void {
        let cc = `public, max-age=${maxAge}`;
        if (revalidate) {
            cc += ', must-revalidate';
        }
        this.headers['cache-control'] = cc;
    }
    sendRaw(err:any|null, body?: any):void {
        this.hook('send');
        this.cb(err, body);
        this.hook('end');
    }
    send(body: string, headers?: KeyValMap, statusCode = 200) {
        if (this.cacheable && statusCode === 200) {
            // etag needs to take into account same:
            // - body
            // - method arn
            // - query string
            // - customer id
            // to determine a unique etag
            const et = etag(body, String(this.req.methodArn), JSON.stringify(this.req.query), this.req.customerID);
            this.headers.etag = et;
            const cet = this.req.headers['if-none-match'];
            if (et === cet) {
                // check and make sure that the client didn't tell us to send a fresh copy
                const cc = this.req.headers['cache-control'];
                if (!cc || cc.indexOf('no-cache') < 0) {
                    this.cb(null, { statusCode: 304, headers: Object.assign(this.headers, headers) });
                    return;
                }
            }
            // default caching is one minute if not specified by default and cacheable
            if (!this.headers['cache-control']) {
                this.cache(60);
            }
        }
        if (!this.cacheable || statusCode !== 200) {
            // if not cacheable or an error, also send the right no cache headers
            this.headers['cache-control'] = 'no-cache, no-store, must-revalidate';
        }
        headers = this.headers = Object.assign(this.headers, headers);
        this.hook('send');
        this.cb(null, {
            statusCode,
            headers,
            body
        });
        this.hook('end');
    }
    text(buf:string|Buffer):void {
        return this.send(buf.toString(), {'content-type': 'text/plain'});
    }
    html(buf:string|Buffer):void {
        return this.send(buf.toString(), {'content-type': 'text/html'});
    }
    javascript(buf:string|Buffer):void {
        return this.send(buf.toString(), {'content-type': 'application/javascript'});
    }
    async json(data: Object | Promise<Object>):Promise<void> {
        // if a promise, let's wait for it
        if (data instanceof Promise) {
            try {
                data = await data;
            } catch (ex) {
                this.error(ex);
                return;
            }
        }
        this.send(JSON.stringify({success: true,  data}, null, 2), {'content-type': 'application/json'});
    }
    error({message}:Error, statusCode = 500) {
        this.send(JSON.stringify({success: false, message}, null, 2), {'content-type': 'application/json'}, statusCode);
    }
    set(key:string, value:string):void {
        this.headers[key] = value;
    }
    redirect(url:string, statusCode = 302):void {
        this.set('Location', url);
        this.cb(null, {
            statusCode,
            headers: this.headers
        });
    }
    on(event:string, cb:OnHandler):void {
        let handlers = this.handlers[event];
        if (!handlers) {
            handlers = [cb];
        } else {
            handlers.push(cb);
        }
        this.handlers[event] = handlers;
    }
    private hook(event:string):void {
        const handlers = this.handlers[event];
        if (handlers && handlers.length) {
            handlers.forEach((h:OnHandler):void => h(event, this));
        }
    }
}
