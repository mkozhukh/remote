/* global require, module */
const typescript = require("@rollup/plugin-typescript");
const terser = require("rollup-plugin-terser").terser;
const watch = !!process.env.ROLLUP_WATCH;

const config = cfg => {
	let out = {
		input: "src/remote.ts",
		output: {
			dir: "dist",
			name: "remote",
			format: "cjs",
			sourcemap: true,
		},
		plugins: [
			typescript({
				declaration: true,
				declarationDir: "dist/types",
				rootDir: "src",
			}),
		],
	};

	let outES5 = {
		input: "src/remote.ts",
		output: {
			file: "dist/remote.es5.js",
			name: "remote",
			format: "iife",
			sourcemap: true,
		},
		plugins: [
			typescript({
				target: "es5",
			}),
			// terser()
		],
	};

	let outES6 = {
		input: "src/remote.ts",
		output: {
			file: "dist/remote.es6.js",
			format: "esm",
			sourcemap: true,
		},
		plugins: [
			typescript({
				target: "es6",
			}),
			// terser()
		],
	};

	if (watch) {
		out = outES5;
	} else if (typeof cfg["config-dist"] !== "undefined") {
		out.plugins.push(terser());
		outES5.plugins.push(terser());
		outES6.plugins.push(terser());

		out = [out, outES6, outES5];
	}

	return out;
};

module.exports = config;
