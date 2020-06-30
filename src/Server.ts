const WebSocket = require("ws");

import Service from "./Service";
import DependencyStore from "./Dependency";
import EventHub from "./hub";
import {
	ExternalCall,
	Response,
	API,
	IService,
	GuardFunction,
	ConnectFunction,
	IEventHub,
	DependFunction,
	ServerConfig,
	DataValue,
	IProvider,
} from "./types";

import { debug, debugLog, errorLog } from "./debug";

interface WebSocketServer {
	fixMe(): void;
	handleUpgrade(
		req: unknown,
		socket: unknown,
		buf: Buffer,
		cb: (ws: WebSocket) => void
	): void;
}

export default class Server {
	public connect: ConnectFunction;
	public events: IEventHub;
	public dependencies: IProvider;

	private _services: Map<string, IService>;
	private _data: Map<string, DependFunction>;
	private _config: ServerConfig;
	private _ws: WebSocketServer;

	constructor(config?: ServerConfig) {
		this._services = new Map();
		this._data = new Map();
		this._config = config || {};

		this.events = new EventHub();

		if (this._config.websocket) {
			this._ws = new WebSocket.Server({ noServer: true });
		}

		this.dependencies = new DependencyStore();
		this.connect = function () {
			/* do nothin */
		};
		//func(r *http.Request) (context.Context, error) { return r.Context(), null }
	}

	getSocketServer(): WebSocketServer {
		return this._ws;
	}

	addService(name: string, rcvr: Record<string, undefined>): void {
		return this._register(name, rcvr, null);
	}

	addServiceWithGuard(
		name: string,
		rcvr: Record<string, undefined>,
		guard: GuardFunction
	): void {
		return this._register(name, rcvr, guard);
	}

	addVariable(name: string, rcvr: DependFunction): void {
		return this._registerData(name, rcvr);
	}

	addConstant(name: string, rcvr: DataValue): void {
		return this._registerData(name, () => rcvr);
	}

	async process(config: ExternalCall[], deps: IProvider): Promise<Response[]> {
		const results = await Promise.all(
			config.map((a: ExternalCall) =>
				this.call(a.name, a.args, deps)
					.then(data => ({ id: a.id, data }))
					.catch(error => {
						errorLog("call", error);
						return { id: a.id, data: null, error: error.toString() };
					})
			)
		);

		return results;
	}

	async call(
		name: string,
		args: DataValue[],
		deps: IProvider
	): Promise<DataValue> {
		const parts = name.split(".");
		const service = this._services.get(parts[0]);
		if (!service) throw new Error("unknown service: " + parts[0]);

		let t1;
		if (debug) {
			debugLog("call", `${name}(${JSON.stringify(args)})`);
			t1 = new Date();
		}
		const result = await service.call(parts[1], args, deps);
		if (debug) {
			debugLog(
				"result",
				`${name} = ${JSON.stringify(result)} [${
					new Date().valueOf() - t1.valueOf()
				}ms]`
			);
		}
		return result;
	}

	private _registerData(name: string, rcvr: DependFunction) {
		if (this._data.has(name)) {
			throw "service name already used";
		}

		this._data.set(name, rcvr);
	}

	private _register(
		name: string,
		rcvr: Record<string, unknown>,
		guard: GuardFunction
	) {
		const service = new Service(rcvr, guard);
		if (name === "") {
			name = service.GetName();
		}
		// store the service
		this._services.set(name, service);
	}

	async getAPI(deps: IProvider): Promise<API> {
		const out: API = {
			api: {},
			data: {},
			websocket: false,
		};

		this._services.forEach((v, k) => {
			out.api[k] = v.getAPI();
		});

		const vars = Array.from(this._data.keys());
		await Promise.all(
			vars.map(async k => {
				out.data[k] = await this._data.get(k)(deps);
			})
		);

		if (this._config.websocket) {
			out.websocket = true;
		}

		return out;
	}
}
