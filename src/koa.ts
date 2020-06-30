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

export class KoaRequest implements HttpRequestWrapper {
	private ctx: any;
	constructor(c: any) {
		this.ctx = c;
	}

	getBody(): ExternalCall[] {
		return this.ctx.request.body;
	}

	getMethod(): string {
		return this.ctx.request.method;
	}

	getUrlQuery(): IHash<string> {
		return this.ctx.request.query;
	}

	getRaw(): undefined {
		return this.ctx;
	}

	getRequest(): undefined {
		return this.ctx.req;
	}

	getSocket(): undefined {
		return this.ctx.request.socket;
	}

	skipResponse(): void {
		this.ctx.respond = false;
	}
}

export class KoaResponse implements HttpResponseWrapper {
	private ctx: any;
	constructor(c: any) {
		this.ctx = c;
	}

	error(text: string): void {
		this.ctx.status = 500;
		this.ctx.type = "text/plain; charset=utf-8";
		this.ctx.body = text;
	}

	json(obj: Record<string, undefined>): void {
		this.ctx.body = obj;
	}
}

export function koaHandler(s: Server): (ctx: any) => Promise<void> {
	return async function (ctx: any): Promise<void> {
		const req = new KoaRequest(ctx);
		const res = new KoaResponse(ctx);
		await httpHandler(s, req, res);
	};
}
