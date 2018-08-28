import { λ, Request, Response } from '@pinpt/fn';
import ping from '../../src/ping';

export const handler = λ(async(req: Request, resp: Response) => {
    resp.cacheable = false;
    resp.text(ping());
});
