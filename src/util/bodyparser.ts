import { Request, KeyValAnyMap } from '../';
import { parse } from 'querystring';

/**
 * decode an incoming body into a key/value hash based on the content type
 * @param req request
 */
export function DecodeBody(req: Request) : KeyValAnyMap | null {
    const contentType = req.headers['content-type'];
    if (req.body) {
        switch (contentType) {
            case 'application/x-www-form-urlencoded': {
                return parse(req.body);
            }
            case 'application/json':
            case 'text/json': {
                return JSON.parse(req.body || '{}');
            }
        }
    }
    return null;
}