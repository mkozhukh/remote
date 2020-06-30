import Server from "./Server";
import { httpHandler } from "./http";
import {
	IHash,
	ExternalCall,
	HttpRequestWrapper,
	HttpResponseWrapper,
} from "./types";

/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint @typescript-eslint/explicit-module-boundary-types: 0 */

export class ExpressRequest implements HttpRequestWrapper {
	private ctx: any;
	constructor(c: any) {
		this.ctx = c;
	}

	getBody(): ExternalCall[] {
		const t = this.ctx.body;
		if (typeof t === "object") return t;

		return JSON.parse(t);
	}

	getMethod(): string {
		return this.ctx.method;
	}

	getUrlQuery(): IHash<string> {
		return this.ctx.query;
	}

	getRaw(): undefined {
		return this.ctx;
	}

	getRequest(): undefined {
		return this.ctx;
	}

	getSocket(): undefined {
		return this.ctx.socket;
	}

	skipResponse(): void {
		/* do nothing, default behavior */
	}
}

export class ExpressResponse implements HttpResponseWrapper {
	private ctx: any;
	constructor(c: any) {
		this.ctx = c;
	}

	error(text: string): void {
		this.ctx.status(500);
		this.ctx.header("text/plain", "charset=utf-8");
		this.ctx.send(text);
	}

	json(obj: Record<string, undefined>): void {
		this.ctx.send(obj);
	}
}

export function expressHandler(s: Server): (req: any, res: any) => void {
	return function (req: any, res: any): void {
		req = new ExpressRequest(req);
		res = new ExpressResponse(res);
		httpHandler(s, req, res);
	};
}
