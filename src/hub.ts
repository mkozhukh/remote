import {
	IClient,
	IEventHub,
	ChannelConfig,
	userID,
	connectionID,
	HubGuardFunction,
	DataValue,
	IProvider,
	IWebsocket,
	IServer,
} from "./types";

import { debug, debugLog } from "./debug";
import { AllClients } from "./socket";

type chanStatus = DataValue[];
export default class EventHub implements IEventHub {
	public userHandler: (id: userID, status: boolean) => void;
	public connHandler: (id: connectionID, status: boolean) => void;

	private _users: Map<userID, number>;
	private _channels: Map<string, ChannelConfig>;
	private _filters: Map<string, HubGuardFunction>;
	private _clients: AllClients;

	constructor() {
		this.userHandler = this.connHandler = () => {
			/* do nothing */
		};
		this._users = new Map();
		this._channels = new Map();
		this._filters = new Map();
		this._clients = new AllClients();
	}

	statusChannel(
		name: string,
		params?: string[]
	): chanStatus | Record<string, chanStatus> {
		if (name) return this._chanStatus(name, params);

		const out: Record<string, any> = {};
		this._channels.forEach((_, key) => {
			out[key] = this._chanStatus(key, params);
		});
		return out;
	}
	statusUser(): Record<userID, number> {
		const out: Record<userID, number> = {};
		const keys = Array.from(this._users.keys());
		for (const k of keys) out[k] = this._users.get(k);
		return out;
	}

	_chanStatus(name: string, params: string[]): chanStatus {
		params = params || [];
		return Array.from(this._channels.get(name).clients.values()).map(obj => {
			const ctx = obj.getContext();
			return params.map(a => ctx.value(a));
		});
	}

	addClient(ws: IWebsocket, srv: IServer, ctx: IProvider): IClient {
		return this._clients.Add(ws, srv, ctx);
	}

	addGuard(name: string, filter: HubGuardFunction) {
		this._filters.set(name, filter);
	}

	subscribe(channel: string, c: IClient) {
		this._onSubscribe(c, channel, true);
	}

	unsubscribe(channel: string, c: IClient) {
		this._onSubscribe(c, channel, false);
	}

	private _onSubscribe(c: IClient, name: string, mode: boolean) {
		if (debug) {
			debugLog(mode ? "subscr" : "unsubscr", { id: c.getConnectionId(), name });
		}
		if (!mode) {
			if (!name) {
				//unsubscribe from all
				this._channels.forEach((_, name) => {
					this._onUnSubscribe(name, c.getConnectionId());
				});
			} else {
				this._onUnSubscribe(name, c.getConnectionId());
			}

			return;
		}

		let ch = this._channels.get(name);
		if (!ch) {
			ch = { clients: new Map() };
			this._channels.set(name, ch);
		}
		ch.clients.set(c.getConnectionId(), c);
	}

	private _onUnSubscribe(name: string, client: connectionID) {
		const ch = this._channels.get(name);
		if (!ch) {
			return;
		}

		ch.clients.delete(client);
		if (ch.clients.size == 0) {
			this._channels.delete(name);
		}
	}

	publish(name: string, content: any, clients: number[]) {
		this._onPublish(name, content, clients);
	}

	userIn(id: userID, conn: connectionID) {
		if (debug) debugLog("user-in", { id, conn });
		this._onRegister(id, conn, true);
	}

	userOut(id: userID, conn: connectionID) {
		if (debug) debugLog("user-out", { id, conn });
		this._onRegister(id, conn, false);
	}

	private _onRegister(id: userID, conn: connectionID, status: boolean) {
		this.connHandler(conn, status);
		let c = this._users.get(id) || 0;
		if (status) {
			if (!c) {
				this.userHandler(id, status);
			}

			c += 1;
		} else {
			if (c <= 1) {
				this.userHandler(id, status);
				this._users.delete(id);
				return;
			} else {
				c -= 1;
			}
		}

		this._users.set(id, c);
	}

	private _onPublish(name: string, value: any, clients?: userID[]) {
		if (debug) debugLog("publish", { name, value, clients });

		const ch = this._channels.get(name);
		const filter = this._filters.get(name);

		if (ch) {
			ch.clients.forEach(async c => {
				if (filter) {
					const check = await filter(c.getContext(), value, name);
					if (!check) return;
				}

				if (clients && clients.length != 0) {
					clients.forEach(x => {
						if (x == c.getUserId()) {
							c.sendMessage("event", { name, value });
						}
					});
				} else {
					c.sendMessage("event", { name, value });
				}
			});
		}
	}
}
