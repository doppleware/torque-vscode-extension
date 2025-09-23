import esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  // Build extension
  const extensionCtx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "out/extension.js",
    external: ["vscode"],
    logLevel: "warning",
    plugins: [esbuildProblemMatcherPlugin]
  });

  // Build tests
  const testCtx = await esbuild.context({
    entryPoints: ["src/test/**/*.ts"],
    bundle: true,
    format: "cjs",
    minify: false,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outdir: "out/test",
    external: ["vscode", "mocha", "assert", "path", "glob"],
    logLevel: "warning"
  });

  if (watch) {
    await Promise.all([extensionCtx.watch(), testCtx.watch()]);
  } else {
    await Promise.all([extensionCtx.rebuild(), testCtx.rebuild()]);
    await Promise.all([extensionCtx.dispose(), testCtx.dispose()]);
  }
}

const esbuildProblemMatcherPlugin: esbuild.Plugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      // eslint-disable-next-line no-console
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        // eslint-disable-next-line no-console
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) {
          return;
        }
        // eslint-disable-next-line no-console
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      // eslint-disable-next-line no-console
      console.log("[watch] build finished");
    });
  }
};

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
