import { λ, Request, Response } from '@pinpt/fn';
import <%=name%> from '../../src/<%=name%>';

export const handler = λ(async(req: Request, resp: Response) => {
    const data = <%=name%>();
    resp.json({ data });
});
