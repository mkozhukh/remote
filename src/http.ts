import Client from "./socket";
import { HttpRequestWrapper, HttpResponseWrapper } from "./types";
import type Server from "./Server";
import { errorLog } from "./debug";

export async function httpHandler(
	s: Server,
	req: HttpRequestWrapper,
	res: HttpResponseWrapper
): Promise<void> {
	try {
		const deps = s.dependencies.clone({});
		s.connect(deps, req.getRaw());
		deps.freeze();

		const method = req.getMethod();
		const query = req.getUrlQuery();
		const isSocketStart = method === "GET" && query.ws;

		if (method === "GET" && !isSocketStart) {
			res.json(await s.getAPI(deps));
			return;
		}

		if (!isSocketStart && method !== "POST") {
			res.error("only post and get request types are supported");
			return;
		}

		if (isSocketStart) {
			const wss = s.getSocketServer();
			if (wss === null) {
				res.error("websocket connection disabled");
				return;
			}
			req.skipResponse();
			wss.handleUpgrade(
				req.getRequest(),
				req.getSocket(),
				Buffer.alloc(0),
				(ws: any) => {
					s.events.addClient(ws, s, deps);
				}
			);

			return;
		}

		const result = await s.process(req.getBody(), deps);
		res.json(result);
	} catch (err) {
		errorLog("api", err);
		res.error(err);
		return;
	}
}
