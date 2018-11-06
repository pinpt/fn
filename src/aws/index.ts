const AWS = require('aws-sdk'); // https://github.com/aws/aws-sdk-js/issues/1769
import { Handler, Context, Callback, APIGatewayEvent } from 'aws-lambda';
import { LambdaHandler, LambdaPath } from '../index';
import { LambdaRequest, LambdaResponse } from './reqresp';
import { makeRoute, executeRoutes } from '../util/router';
export { default as SSMConfig } from './ssm';
export { default as SecretManager } from './secrets';

if (process.env.AWS_PROFILE) {
    const credentials = new AWS.SharedIniFileCredentials({profile: process.env.AWS_PROFILE});
    AWS.config.credentials = credentials;
}

/**
 * invoke the incoming mapped lambda handler
 * @param handler api handler
 */
export function Lambda(handler: LambdaHandler): Handler {
    return (event: APIGatewayEvent, context: Context, cb: Callback) => {
        context.callbackWaitsForEmptyEventLoop = false;
        const req = new LambdaRequest(event, context);
        const resp = new LambdaResponse(req, event, cb);
        resp.cors();

        try {
            handler(req, resp);
        } catch (ex) {
            return resp.error(ex);
        }
    };
}

export function LambdaRoutes(handlers: LambdaPath[]): Handler {
    return (event: APIGatewayEvent, context: Context, cb: Callback) => {
        context.callbackWaitsForEmptyEventLoop = false;
        
        const req = new LambdaRequest(event, context);
        const resp = new LambdaResponse(req, event, cb);
        resp.cors();

        const routes = handlers.map(handle => {
            return makeRoute(handle.method, handle.path, handle.handler)
        });

        executeRoutes({req, resp, routes});
    }
}