import { DependFunction, IProvider, DataValue, ContextHash } from "./types";

export default class DependencyStore implements IProvider {
	private _data: Map<string, DependFunction>;
	private _ctx: ContextHash;
	private _freeze = false;

	constructor(data?: Map<string, DependFunction>, ctx?: ContextHash) {
		this._data = data || new Map();
		this._ctx = ctx || {};
	}

	addProvider(name: string, provider: DependFunction): void {
		if (this._freeze) return;
		this._data.set(name, provider);
	}

	value(name: string): DataValue {
		const prv = this._data.get(name);
		if (prv) return prv(this);

		return this._ctx[name];
	}

	setValue(name: string, value: DataValue): void {
		if (this._freeze) return;
		this._ctx[name] = value;
	}

	clone(ctx: ContextHash): IProvider {
		if (this._freeze) return;
		return new DependencyStore(this._data, ctx);
	}

	freeze(): void {
		this._freeze = true;
	}
}
