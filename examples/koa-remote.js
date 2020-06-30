const Koa = require("koa");
const Router = require("koa-router");
const bodyParser = require("koa-bodyparser");
const cors = require("@koa/cors");

const { Server, koaHandler } = require("../dist/remote");
const api = new Server({
	websocket: true,
});

api.connect = (ctx, req) => {
	const userId = req.query.user;
	ctx.setValue("userCtx", userId);
};
api.events.userHandler = (id, status) => {
	api.events.publish("debug", { type: "user", id, status });
};
api.events.connHandler = (id, status) => {
	api.events.publish("debug", { type: "connection", id, status });
};
api.dependencies.addProvider("user", ctx => ctx.value("userCtx") || 1);
api.addService("ops", {
	add(ctx, a, b) {
		return a + b;
	},
	sub(ctx, a, b) {
		return a - b;
	},
	getUser(ctx) {
		return ctx.value("user");
	},
	getUserCtx(ctx) {
		return ctx.value("userCtx");
	},
});

class TestClass {
	add() {
		return 1;
	}
}
api.addService("cls", new TestClass());

api.addVariable("random", () => Math.random());
api.addConstant("user", { name: "alex", id: 1 });
api.addVariable("userCtx", ctx => ctx.value("userCtx"));

const router = new Router();
router.all("/api/v1", koaHandler(api));

console.log("starting dev server at http://localhost:8280");
const app = new Koa();
// app.use(logger());
app.use(
	cors({
		allowHeaders: ["Remote-Token", "content-type"],
		credentials: true,
	})
);
app.use(bodyParser());
app.use(router.routes());
app.listen("8280");
