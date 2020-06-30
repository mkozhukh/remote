const cors = require("cors");
const express = require("express");
const bodyParser = require("body-parser");

const { Server, expressHandler } = require("../dist/remote");
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

api.addVariable("random", () => Math.random());
api.addConstant("user", { name: "alex", id: 1 });
api.addVariable("userCtx", ctx => ctx.value("userCtx"));

const app = express();

app.use(
	cors({
		origin: ["http://127.0.0.1:8080", "http://localhost:8080"],
		credentials: true,
	})
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.all("/api/v1", expressHandler(api));

const port = 8280;
app.listen(port, function () {
	console.log("Server is running on port " + port + "...");
	console.log(`Open http://localhost:${port} in browser`);
});

(req, res, next) => {
	const from = req.query.from;
	const to = req.query.to;

	if (from && to) {
		db.find({
			start_date: { $lt: req.query.to },
			$or: [
				{ end_date: { $gte: req.query.from } },
				{ series_end_date: { $gte: req.query.from } },
				{
					$and: [{ $not: { recurring: "" } }, { series_end_date: "" }],
				},
			],
		})
			.sort({ start_date: 1 })
			.exec((err, data) => {
				if (err) next(err);
				else {
					res.send(data.map(fixID));
				}
			});
	} else {
		db.find({})
			.sort({ start_date: 1 })
			.exec((err, data) => {
				if (err) next(err);
				else res.send(data.map(fixID));
			});
	}
};
