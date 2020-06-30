const chalk = require("chalk");

export let debug = true;

export function enableDebug(mode: boolean) {
	debug = mode;
}

export function debugLog(action: string, data: unknown) {
	if (action === "call") {
		console.log(chalk.black.bgYellow("> " + action + " "), data);
	} else if (action === "result") {
		console.log(chalk.black.bgCyan("< " + action + " "), data);
	} else {
		console.log(chalk.yellow(action), data);
	}
}

export function errorLog(action: string, err: unknown) {
	console.log(chalk.red(`${action} error`));
	console.log(chalk.red("%s"), err);
}
