const POST = 1;
const WAIT = 2;
const SOCKET = 3;

const TNEW = 1;
const TWAIT = 2;

import {
	EventId,
	InitCallback,
	RemoteAPI,
	APIInfo,
	RemoteFunction,
	Call,
	Response,
	WrappedCall,
	StringHash,
	MethodHash,
	EventsHash,
	ClientConfig,
} from "./types";

export class Client {
	private _url: string;
	private _token: string;

	private _mode: number;
	private _seed: number;
	private _queue: WrappedCall[];

	public data: StringHash;
	public api: MethodHash;

	private _events: EventsHash;
	private _socket: WebSocket;

	constructor(config: ClientConfig) {
		const { url, token } = config;
		this._url = url;
		this._token = token;

		this._mode = POST;
		this._seed = 1;
		this._queue = [];

		this.data = {};
		this.api = {};
		this._events = {};
	}

	headers(): { [id: string]: string } {
		return {
			Accept: "application/json",
			"Content-Type": "application/json",
			"Remote-Token": this._token,
		};
	}

	fetch<T>(url: string, body?: BodyInit): Promise<T> {
		const req: RequestInit = {
			credentials: "include",
			headers: this.headers(),
		};
		if (body) {
			req.method = "POST";
			req.body = body;
		}

		return fetch(url, req).then(res => res.json());
	}

	load(url?: string): Promise<RemoteAPI> {
		if (url) this._url = url;

		return this.fetch<APIInfo>(this._url).then(obj => this.parse(obj));
	}

	parse(obj: APIInfo): RemoteAPI {
		const { key, websocket } = obj;

		if (key) this._token = obj.key;

		for (const key in obj.data) this.data[key] = obj.data[key];

		for (const key in obj.api) {
			const sub: MethodHash = (this.api[key] = {});
			const cfg = obj.api[key];
			for (const method in cfg) sub[method] = this._wrapper(key + "." + method);
		}

		if (websocket) this.connect();

		return this;
	}

	connect(): void {
		const s = this._socket;
		if (s) {
			this._socket = null;
			s.onclose = function() {};
			s.close();
		}

		this._mode = WAIT;
		this._socket = handleSocket(this, this._url, this._token, () => {
			this._mode = SOCKET;

			this._send();
			this._resubscribe();
			return this;
		});
	}

	_wrapper(name: string): RemoteFunction<any> {
		return function() {
			const args = [].slice.call(arguments);
			let pack: WrappedCall = null;

			const result = new Promise((resolve, reject) => {
				pack = {
					data: {
						id: this._uid(),
						name,
						args,
					},
					status: TNEW,
					resolve,
					reject,
				};
				this._queue.push(pack);
			});

			this.onCall(pack, result);

			if (this._mode === SOCKET) this._send(pack);
			else setTimeout(() => this._send(), 1);

			return result;
		}.bind(this);
	}

	_uid(): string {
		return (this._seed++).toString();
	}

	_send(pack?: WrappedCall): void {
		if (this._mode == WAIT) {
			setTimeout(() => this._send(), 100);
			return;
		}

		const packArray = pack
			? [pack]
			: this._queue.filter(obj => obj.status === TNEW);
		if (!packArray.length) return;

		const dataArray: Call[] = packArray.map(obj => {
			obj.status = TWAIT;
			return obj.data;
		});

		if (this._mode === SOCKET) {
			this._socket.send(JSON.stringify({ action: "call", body: dataArray }));
			return;
		}

		this.fetch<Response[]>(this._url, JSON.stringify(dataArray))
			.catch(err => {
				return this.onError(err);
			})
			.then(res => this.result(res, dataArray));
	}

	result(data: Response[], pack: Call[]): void {
		// normalize and convert to map
		const all: { [id: string]: Response } = {};
		if (!data) {
			for (let i = 0; i < pack.length; i++)
				all[pack[i].id] = {
					id: pack[i].id,
					error: "Network Error",
					data: null,
				};
		} else {
			for (let i = 0; i < data.length; i++) all[data[i].id] = data[i];
		}

		for (let i = this._queue.length - 1; i >= 0; i--) {
			const rcall = this._queue[i];
			const response = all[rcall.data.id];
			if (response) {
				this.onResponse(rcall, response);

				if (response.error) {
					rcall.reject(response.error);
				} else {
					rcall.resolve(response.data);
				}

				this._queue.splice(i, 1);
			}
		}
	}

	on(name: string, handler: Function): EventId {
		const id = this._uid();
		let events = this._events[name];
		const hasEvent = !!events;

		if (!hasEvent) events = this._events[name] = [];

		events.push({ id: id, handler: handler });

		if (!hasEvent && this._mode == SOCKET)
			this._socket.send(JSON.stringify({ action: "subscribe", name }));

		return { name, id };
	}

	_resubscribe(): void {
		if (this._mode == SOCKET) {
			for (const name in this._events) {
				this._socket.send(JSON.stringify({ action: "subscribe", name }));
			}
		}
	}

	detach(event?: EventId): void {
		if (!event) {
			if (this._mode == SOCKET)
				for (const key in this._events) {
					this._socket.send(JSON.stringify({ action: "unsubscribe", key }));
				}
			this._events = {};
			return;
		}

		const { id, name } = event;
		const events = this._events[name];
		if (events) {
			const next = events.filter(a => a.id != id);
			if (next.length) {
				this._events[name] = next;
			} else {
				delete this._events[name];
				if (this._mode == SOCKET)
					this._socket.send(JSON.stringify({ action: "unsubscribe", name }));
			}
		}
	}

	fire(name: string, value: any): void {
		const all = this._events[name];
		if (all) {
			for (let i = 0; i < all.length; i++) all[i].handler(value);
		}
	}

	onError(info: any): Response[] {
		// do nothing
		return null;
	}
	onCall(call: WrappedCall, result: Promise<any>): void {
		// do nothing
	}
	onResponse(call: WrappedCall, result: any): void {
		// do nothing
	}
}

function handleSocket(
	r: Client,
	url: string,
	token: string,
	ready: InitCallback
): WebSocket {
	// build websocket url
	let surl = url;
	if (surl[0] === "/")
		surl = document.location.protocol + "//" + document.location.host + url;
	surl = surl.replace(/^http(s|):/, "ws$1:");
	// include optional token in the url
	const and = surl.indexOf("?") != -1 ? "&" : "?";
	surl = `${surl}${and}token=${token}&ws=1`;

	const socket = new WebSocket(surl);
	socket.onclose = () => setTimeout(() => r.connect(), 2000);
	socket.onmessage = ev => {
		const pack = JSON.parse(ev.data);
		switch (pack.action) {
			case "result":
				r.result(pack.body, []);
				break;

			case "event":
				r.fire(pack.body.name, pack.body.value);
				break;

			case "start":
				ready();
				break;

			default:
				r.onError(pack.data);
		}
	};

	return socket;
}
