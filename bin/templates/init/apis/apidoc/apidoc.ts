import { λ, Request, Response } from '@pinpt/fn';
import { html } from './index';

export const handler = λ(async(req: Request, resp: Response) => {
    resp.html(html);
});
