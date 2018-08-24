const AWS = require('aws-sdk'); // https://github.com/aws/aws-sdk-js/issues/1769
import { Handler, Context, Callback, APIGatewayEvent } from 'aws-lambda';
import { LambdaHandler } from '../index';
import { LambdaRequest, LambdaResponse } from './reqresp';

if (process.env.AWS_PROFILE) {
    const credentials = new AWS.SharedIniFileCredentials({profile: process.env.AWS_PROFILE});
    AWS.config.credentials = credentials;
}

/**
 * invoke the incoming mapped lambda handler
 * @param handler api handler
 */
export default function Lambda(handler: LambdaHandler): Handler {
    return (event: APIGatewayEvent, context: Context, cb: Callback) => {
        const req = new LambdaRequest(event, context);
        const resp = new LambdaResponse(req, event, cb);
        try {
            handler(req, resp);
        } catch (ex) {
            return resp.error(ex);
        }
    };
}
