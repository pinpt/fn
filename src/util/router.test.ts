import { makeRoute, executeRoutes } from '../util/router';
import { Request, Response, LambdaMethod } from '..';
import { LambdaResponse, LambdaRequest } from '../aws/reqresp';
import { getLambdaRequestMock, getLambdaResponseMock } from '../aws/regresp.mock';
import { Context, Callback, APIGatewayEvent } from 'aws-lambda';



const MockResponse = jest.fn<LambdaResponse>(() => ({
}));


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