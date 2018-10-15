import { LambdaRequest, LambdaResponse } from "./reqresp";
import { Context, Callback, APIGatewayEvent, APIGatewayEventRequestContext } from 'aws-lambda';
import { isContext } from "vm";
import { APIGateway, CognitoIdentity } from "aws-sdk";
import { RequestEvent } from "..";
import { Lambda } from ".";

const getRequestEventDefaults = (p?: Partial<APIGatewayEventRequestContext>): RequestEvent => ({
  body: null,
  headers: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/',
  pathParameters: {},
  queryStringParameters: {},
  stageVariables: {},
  requestContext: {
      ...{ 
        accountId: 'accountID123',
        apiId: 'apiId',
        httpMethod: 'GET',
        identity: {
          accessKey: null,
          accountId: 'accountID345',
          apiKey: null,
          caller: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          sourceIp: '192.168.0.1',
          user: null,
          userAgent: null,
          userArn: null
        },
      ...p
    },
    stage: 'test',
    requestId: 'requestId',
    requestTimeEpoch: 123,
    resourceId: 'resourceId',
    resourcePath: 'resourcePath'
  },
  resource: ''
});

const getContextDefaults = (): Context => ({
  awsRequestId: 'awsRequestId',
  callbackWaitsForEmptyEventLoop: true,
  done: jest.fn(),
  fail: jest.fn(),
  functionName: 'functionName',
  functionVersion: 'latest',
  invokedFunctionArn: 'invokedFunctionArn',
  getRemainingTimeInMillis: jest.fn(),
  logGroupName: '',
  logStreamName: '',
  memoryLimitInMB: 128,
  succeed: jest.fn()
});

export const getLambdaRequestMock = (p?: Partial<RequestEvent>, c?: Partial<Context>, d?: Partial<APIGatewayEventRequestContext>): LambdaRequest =>{
  return new LambdaRequest(
    {
    ...getRequestEventDefaults(d),
    ...p
    },
    {
    ...getContextDefaults(),
    ...c
    }
  )
}

export const getLambdaResponseMock = (req: LambdaRequest, event: APIGatewayEvent,  cb: Callback): LambdaResponse => {
  const resp = new LambdaResponse(req, event, cb);
  
  resp.error = jest.fn();
  resp.cache = jest.fn();
  resp.error= jest.fn();
  resp.html = jest.fn();
  resp.javascript = jest.fn();
  resp.json = jest.fn();
  resp.on = jest.fn();
  resp.redirect = jest.fn();
  resp.send = jest.fn();

  return resp;
};
