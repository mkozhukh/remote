import {
	IService,
	GuardFunction,
	MethodFunction,
	IHash,
	DataValue,
	IProvider,
} from "./types";

export default class Service implements IService {
	private _name: string;
	private _guard: GuardFunction;
	private _method: Map<string, MethodFunction>;
	private _rcvr: Record<string, unknown>;

	constructor(rcvr: Record<string, unknown>, guard: GuardFunction) {
		this._method = suitableMethods(rcvr);
		this._rcvr = rcvr;
		this._guard = guard;
	}
	GetName(): string {
		return this._name;
	}
	async call(
		name: string,
		args: DataValue[],
		deps: IProvider
	): Promise<DataValue> {
		const check = await this._checkGuard(deps);
		if (!check) throw new Error("Access Denied");

		const mtype = this._method.get(name);
		if (!mtype) {
			const msg = "invalid method name: " + name;
			throw msg;
		}

		const argv = [deps, ...args];

		// Invoke the method
		return await mtype.apply(this._rcvr, argv);
	}

	async _checkGuard(ctx: IProvider): Promise<boolean> {
		if (!this._guard) return true;
		return await this._guard(ctx);
	}

	getAPI(): IHash<number> {
		const out: IHash<number> = {};
		this._method.forEach((_, k) => (out[k] = 1));
		return out;
	}
}

function suitableMethods(typ: Record<string, unknown>): Map<string, undefined> {
	const methods = new Map();
	for (const key in typ) {
		if (key[0] !== "_") methods.set(key, typ[key]);
	}
	if (typ.constructor && typ.constructor.prototype) {
		const keys = Object.getOwnPropertyNames(typ.constructor.prototype);
		keys.forEach(key => {
			if (key !== "constructor" && key[0] !== "_") methods.set(key, typ[key]);
		});
	}
	return methods;
}
