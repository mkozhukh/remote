export interface IHash<T> {
	[key: string]: T;
}

export type AnyObject = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ServerConfig = {
	websocket?: boolean;
	withoutKey?: boolean;
};
export type DataValue = number | string | AnyObject | Date;

export interface IService {
	getAPI(): IHash<number>;
	call(name: string, args: DataValue[], deps: IProvider): Promise<DataValue>;
}

export interface IProvider {
	addProvider(name: string, provider: DependFunction): void;
	setValue(name: string, value: DataValue): void;
	value(name: string): DataValue;
	clone(ctx: ContextHash): IProvider;
	freeze(): void;
}

export interface IEventHub {
	addGuard(name: string, filter: GuardFunction): void;
	subscribe(channel: string, c: IClient): void;
	unsubscribe(channel: string, c: IClient): void;
	publish(name: string, data: AnyObject, clients: number[]): void;
	userIn(id: userID, conn: connectionID): void;
	userOut(id: userID, conn: connectionID): void;
	addClient(ws: IWebsocket, srv: IServer, ctx: IProvider): IClient;
}

export type ContextHash = IHash<DataValue>;

export type ExternalCall = {
	id: string;
	name: string;
	args: DataValue[];
};

export type Response = {
	id: string;
	error?: string;
	data: DataValue;
};

export type ConnectFunction = (ctx: IProvider, req: undefined) => void;
export type DependFunction = (ctx: IProvider) => DataValue | Promise<DataValue>;
export type GuardFunction = (ctx: IProvider) => boolean | Promise<boolean>;
export type HubGuardFunction = (
	ctx: IProvider,
	data: AnyObject,
	name: string
) => boolean | Promise<boolean>;
export type MethodFunction = (ctx: IProvider) => DataValue | void;

export type ServiceAPI = IHash<number>;
export type API = {
	api: IHash<ServiceAPI>;
	data: IHash<DataValue>;
	websocket: boolean;
};

export interface HttpRequestWrapper {
	getBody(): ExternalCall[];
	getMethod(): string;
	getUrlQuery(): IHash<string>;
	getSocket(): undefined;
	getRequest(): undefined;
	getRaw(): undefined;
	skipResponse(): void;
}
export interface HttpResponseWrapper {
	error(text: string): void;
	json(obj: AnyObject): void;
}

export interface ChannelConfig {
	clients: Map<connectionID, IClient>;
}

export type userID = number | string;
export type connectionID = number | string;

export interface IClient {
	heartbeat(): void;
	getContext(): IProvider;
	getUserId(): userID;
	getConnectionId(): connectionID;
	sendMessage(action: string, body: DataValue | AnyObject): void;
}

export interface IWebsocket {
	terminate(): void;
	ping(message: string): void;
	on(name: string, handler: (text?: string) => void): void;
	send(message: string): void;
}

export interface IServer {
	events: IEventHub;
	process(config: ExternalCall[], deps: IProvider): Promise<Response[]>;
}
