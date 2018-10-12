import { makeRoute, executeRoutes } from '../util/router';
import { Request, Response, LambdaMethod } from '..';
import { LambdaResponse, LambdaRequest } from '../aws/reqresp';
import { getLambdaRequestMock, getLambdaResponseMock } from '../aws/regresp.mock';
import { Context, Callback, APIGatewayEvent } from 'aws-lambda';

test('router tries one route at a time', async () => {
  const routes = [
    makeRoute(LambdaMethod.Get, '/', (req, resp) => {
      return "hi";
    }),
    makeRoute(LambdaMethod.Post, '/', (req, resp) => {
      return "hi2";
    })
  ];

  const req = getLambdaRequestMock(
    { httpMethod: 'POST', pathParameters: { proxy: '/' }}
    ,{},
    { httpMethod: 'POST'})
  const resp = getLambdaResponseMock(req, req.event as APIGatewayEvent, () => null);
  executeRoutes({req, resp, routes})
});

test('router detects arguments', async () => {
  expect.assertions(4);
  const innerFunctionOfWrongPath = jest.fn();
  const rightFunction = jest.fn();

  const routes = [
    makeRoute(LambdaMethod.Get, '/awesome/:bar', async (req, resp) => {
      expect(Object.keys(req.params)).toContain('bar');
      expect(req.params.bar).toEqual('foo');
      rightFunction();
    }),
    makeRoute(LambdaMethod.Post, '/:foo', async (req, resp) => {
      innerFunctionOfWrongPath();
    })
  ];

  const req = getLambdaRequestMock(
    { httpMethod: 'GET', pathParameters: { proxy: '/awesome/foo' }}
    ,{},
    { httpMethod: 'GET'})
  const resp = getLambdaResponseMock(req, req.event as APIGatewayEvent, () => null);
  await executeRoutes({req, resp, routes})
  expect(rightFunction).toBeCalled();
  expect(innerFunctionOfWrongPath).not.toBeCalled();
});