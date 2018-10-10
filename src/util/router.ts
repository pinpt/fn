import { Request, Response, LambdaHandler, LambdaMethod } from '..'
import { LambdaRequest, LambdaResponse } from '../aws/reqresp'
import debug from 'debug';

// Must use require because jest doesn't work with default imports using es6 style
const methods = require('methods');
const pathToRegexp = require('path-to-regexp');

export type Route = (req: Request, resp: Response, next: Func) => any;
export type RouteMaker = (path: string, fn: LambdaHandler, opts?: any[] | undefined) => Route;

export interface RouterType {
  [name: string]: RouteMaker;
};

let router : RouterType = {};

methods.forEach(function(method : string){
  router[method] = create(method);
});

interface Func {
  (...args: any[]): any;
}

router.del = router.delete;

function create(method : string) {
  if (method) method = method.toUpperCase();

  return function(
    path : string, 
    fn: LambdaHandler, 
    opts?: (any[]) | undefined){
    const re = pathToRegexp(path, opts);

    const createRoute = function(routeFunc : LambdaHandler){
      return function (req: Request, resp: Response, next: Func){
        // method
        if (!matches(req, method)) return next();
        // if path is undefined
        if (!req.path) return next();

        const m = re.exec(req.path);
        debug('router')('testing path', req.path, m);
        if (m) {
          debug('router')('matched path');
          const args = m.slice(1).map(decode);

          if (req instanceof LambdaRequest) {
            debug('router')('found args', args);
            req.args = args;
          }

          return routeFunc(req, resp);
        }

        // miss
        return next();
      }
    };

    return createRoute(fn);
  }
}

/**
 * Decode value.
 */

function decode(val : string) {
  if (val) return decodeURIComponent(val);
}

/**
 * Check request method.
 */

function matches(req: Request, method : string) {
  debug('router')('testing method', method, req.method)
  if (!method) return true;
  if (req.method === method) return true;
  if (method === 'GET' && req.method === 'HEAD') return true;
  debug('router')('failed to match method')
  return false;
}

export function makeRoute(method: string, path: string, fn: LambdaHandler, opts?: any[] | undefined) : Route { 
  return router[method.toLowerCase()](path, fn, opts);
};

export function executeRoutes(
  { req, resp, routes }: {req: Request, resp: Response, routes: Route[] }, 
) : any {
  if(routes.length === 0) {
    throw new Error('route not found');
  }
  const [route, ...rest] = routes;
  return route(req, resp, () => executeRoutes({req, resp, routes: rest}))
}
