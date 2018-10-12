<div align="center">
	<img width="500" src=".github/logo.svg" alt="pinpt-logo">
</div>

<p align="center">
	<strong>A tiny micro framework for the Serverless framework for building fast λ functions</strong>
</p>

<div align="center">

[![forthebadge](https://forthebadge.com/images/badges/you-didnt-ask-for-this.svg)](https://forthebadge.com)

</div>

## Setup

More coming soon....

## Examples

### Single Lambda


``` typescript
import { Logger, Request, Response, λ } from '@pinpt/fn';

export const handler = λ( async (req: Request, resp: Response) => {
  resp.json({data: 'foo'});
});
```


### Paths with simple router

``` typescript
import { LambdaMethod, Logger, Request, Response, λs } from '@pinpt/fn';

export const handler = λs([
  {
		handler: async (req: Request, resp: Response) => {
			resp.json({data: 'foo'});
		},
		method: LambdaMethod.Get,
		path: '/',
	},
	{
		handler: async (req: Request, resp: Response) => {
			resp.json({data: req.params.bar});
		},
		method: LambdaMethod.Post,
		path: '/use/:bar',
	}
]);
```

## License

All of this code is Copyright &copy; 2018 by PinPT, Inc. and licensed under the MIT License. Pull requests welcome.

