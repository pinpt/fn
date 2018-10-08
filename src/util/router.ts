import pathToRegexp from 'path-to-regexp';
import methods from 'methods';
import { Request, Response, LambdaHandler, LambdaMethod } from '..'
import { LambdaRequest, LambdaResponse } from '../aws/reqresp'

export type Route = (req: LambdaRequest, resp: LambdaResponse, next: Func) => any;
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
      return function (req: LambdaRequest, resp: LambdaResponse, next: Func){
        // method
        if (!matches(req, method)) return next();

        // path
        const m = re.exec(req.path);
        if (m) {
          const args = m.slice(1).map(decode);
          req.args = args;
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

function matches(req: LambdaRequest, method : string) {
  if (!method) return true;
  if (req.method === method) return true;
  if (method === 'GET' && req.method === 'HEAD') return true;
  return false;
}

export function makeRoute(method: string, path: string, fn: LambdaHandler, opts?: any[] | undefined) : Route { 
  return router[method](path, fn, opts);
};

export function makeFinalRoute(routes: Route[]) : LambdaHandler {
  let finalRoute : LambdaHandler = (a: Request, b: Response) => { 
    throw new Error('route not found');
  };

  for (const route of routes.reverse()) {
    finalRoute = (a, b) => route(a, b, () => finalRoute(a, b))
  }
  
  return finalRoute;
};
