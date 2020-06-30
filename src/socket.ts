import {
	IClient,
	connectionID,
	userID,
	IProvider,
	AnyObject,
	DataValue,
	IWebsocket,
	IServer,
} from "./types";

import { debug, debugLog } from "./debug";

// const pongWait = 60;
// const pingPeriod = (pongWait * 9) / 10
// const maxSocketMessageSize = 4000;
// const writeWait = 10;

// const newline = "\n";
// const space = " ";

export class AllClients {
	private _clients: Map<IWebsocket, IClient>;
	constructor() {
		this._clients = new Map();

		setInterval(() => {
			this._clients.forEach((c: IClient) => c.heartbeat());
		}, 5000);
	}
	Add(ws: IWebsocket, srv: IServer, ctx: IProvider): IClient {
		const c = new Client(ws, srv, ctx);
		ws.on("close", () => {
			srv.events.unsubscribe("", c);
			this._clients.delete(ws);
		});

		this._clients.set(ws, c);
		return c;
	}
}

export default class Client implements IClient {
	private _uid: userID;
	private _cid: connectionID;
	private _ctx: IProvider;
	private _ws: IWebsocket;
	private _alive: boolean;

	constructor(ws: IWebsocket, srv: IServer, ctx: IProvider) {
		this._alive = true;
		this._ws = ws;
		this._ctx = ctx;

		this._uid = ctx.value("user_id") as number | string;
		this._cid = ctx.value("connection_id") as number | string;

		if (!this._cid) {
			this._cid = nextId();
			ctx.setValue("connection_id", this._cid);
		}

		ws.on("pong", () => (this._alive = true));
		ws.on("message", (message: string) => {
			try {
				const data = JSON.parse(message);
				if (data.action === "subscribe")
					return srv.events.subscribe(data.name, this);
				if (data.action === "unsubscribe")
					return srv.events.unsubscribe(data.name, this);
				if (data.action !== "call") return;

				srv
					.process(data.body, ctx)
					.then(result => this.sendMessage("result", result));
			} catch (e) {
				this.sendMessage("error", null);
			}
		});

		srv.events.userIn(this._uid, this._cid);
		ws.on("close", () => {
			srv.events.userOut(this._uid, this._cid);
		});

		// [FIXME]
		this.sendMessage("start", this._cid);
	}

	getContext(): IProvider {
		return this._ctx;
	}

	getUserId(): userID {
		return this._uid;
	}

	getConnectionId(): connectionID {
		return this._cid;
	}

	sendMessage(action: string, body: DataValue | AnyObject): void {
		const pack = { action, body };
		if (debug) debugLog("send", pack);
		this._ws.send(JSON.stringify(pack));
	}

	heartbeat(): void {
		if (this._alive === false) {
			this._ws.terminate();
			return;
		}

		this._alive = false;
		this._ws.ping("");
	}
}

let idCounter = 0;
function nextId(): number {
	idCounter += 1;
	return idCounter;
}
