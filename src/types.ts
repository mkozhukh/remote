export type RemoteFunction<T> = () => Promise<T>;
export type InitCallback = () => void;
export type ResolveCall = (x: any) => void;
export type EventId = { id: string; name: string };
export type EventHandler = { id: string; handler: Function };
export type StringHash = { [id: string]: any };
export type EventsHash = { [id: string]: EventHandler[] };
export type MethodHash = { [id: string]: MethodHash | RemoteFunction<any> };

export interface WrappedCall {
	data: Call;
	status: number;
	resolve: ResolveCall;
	reject: ResolveCall;
}

export interface Response {
	id: string;
	error: any;
	data: any;
}

export interface Call {
	id: string;
	name: string;
	args: any[];
}

export interface ClientConfig {
	url?: string;
	token?: string;
}

export interface APIInfo {
	websocket?: boolean;
	key?: string;
	data: StringHash;
	api: StringHash;
}

export interface RemoteAPI {
	data: StringHash;
	api: MethodHash;
}
