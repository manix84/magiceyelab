import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(".");
const lintExtensions = /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i;
const typecheckExtensions = /\.(cts|mts|ts|tsx)$/i;
const appTypecheckPaths = /^src\//;
const nodeTypecheckPaths =
  /^(scripts\/.*\.(cts|mts|ts)|vite\.config\.ts|vitest\.config\.ts|\.storybook\/.*\.(ts|tsx))$/;
const ambientTypecheckFiles = ["src/vite-env.d.ts", "src/test/setupTests.ts"];
const testTriggerPaths =
  /^(src|scripts|test|tests|vitest\.config|vite\.config|tsconfig|eslint\.config|package\.json|package-lock\.json)/;
const binSuffix = process.platform === "win32" ? ".cmd" : "";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(detail || `${command} ${args.join(" ")} failed.`);
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function git(args, options = {}) {
  return run("git", args, options);
}

function stagedFiles() {
  const output = git([
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
  ]);

  return output ? output.split("\n").filter(Boolean) : [];
}

function stagedExistingFiles(files) {
  return files.filter((file) => {
    const result = spawnSync("git", ["cat-file", "-e", `:${file}`], {
      cwd: repoRoot,
    });

    return result.status === 0;
  });
}

function createStagedSnapshot() {
  const tempDir = mkdtempSync(join(tmpdir(), "magiceyelab-pre-commit-"));

  git(["checkout-index", "-a", "-f", `--prefix=${tempDir}/`]);

  const nodeModulesPath = resolve(repoRoot, "node_modules");
  if (existsSync(nodeModulesPath)) {
    symlinkSync(nodeModulesPath, join(tempDir, "node_modules"), "junction");
  }

  return tempDir;
}

function runLint(files, snapshotDir) {
  const lintFiles = files.filter((file) => lintExtensions.test(file));

  if (!lintFiles.length) {
    console.log("Pre-commit lint skipped: no staged lintable files.");
    return;
  }

  console.log(`Pre-commit lint: ${lintFiles.length} staged file(s).`);
  run(resolve(repoRoot, "node_modules", ".bin", `eslint${binSuffix}`), lintFiles, {
    cwd: snapshotDir,
    stdio: "inherit",
  });
}

function runTypecheck(files, snapshotDir) {
  const stagedTypeScriptFiles = files.filter((file) =>
    typecheckExtensions.test(file)
  );
  const appTypecheckFiles = stagedTypeScriptFiles.filter((file) =>
    appTypecheckPaths.test(file)
  );
  const nodeTypecheckFiles = stagedTypeScriptFiles.filter((file) =>
    nodeTypecheckPaths.test(file)
  );
  const skippedTypecheckFiles = stagedTypeScriptFiles.filter(
    (file) => !appTypecheckPaths.test(file) && !nodeTypecheckPaths.test(file)
  );

  if (!appTypecheckFiles.length && !nodeTypecheckFiles.length) {
    console.log("Pre-commit typecheck skipped: no staged TypeScript files.");
    return;
  }

  if (skippedTypecheckFiles.length) {
    console.log(
      `Pre-commit typecheck skipped ${skippedTypecheckFiles.length} config/tool file(s): ${skippedTypecheckFiles.join(", ")}`
    );
  }

  if (appTypecheckFiles.length) {
    runTypecheckProject({
      files: [
        ...new Set([
          ...appTypecheckFiles,
          ...ambientTypecheckFiles.filter((file) => existsSync(join(snapshotDir, file))),
        ]),
      ],
      label: "app",
      snapshotDir,
      tempConfigName: "tsconfig.staged.app.json",
      tsconfigPath: "./tsconfig.app.json",
    });
  }

  if (nodeTypecheckFiles.length) {
    runTypecheckProject({
      files: nodeTypecheckFiles,
      label: "node",
      snapshotDir,
      tempConfigName: "tsconfig.staged.node.json",
      tsconfigPath: "./tsconfig.node.json",
    });
  }
}

function runTypecheckProject({
  files,
  label,
  snapshotDir,
  tempConfigName,
  tsconfigPath,
}) {
  const projectTypecheckFiles = [
    ...new Set([
      ...files,
    ]),
  ];
  const tempConfigPath = join(snapshotDir, tempConfigName);

  writeFileSync(
    tempConfigPath,
    `${JSON.stringify(
      {
        extends: tsconfigPath,
        files: projectTypecheckFiles,
        include: [],
        compilerOptions: {
          noEmit: true,
          noImplicitAny: true,
        },
      },
      null,
      2
    )}\n`
  );

  console.log(`Pre-commit typecheck (${label}): ${files.length} staged file(s).`);
  run(
    resolve(repoRoot, "node_modules", ".bin", `tsc${binSuffix}`),
    ["--project", tempConfigPath],
    {
      cwd: snapshotDir,
      stdio: "inherit",
    }
  );
}

function runTests(files, snapshotDir) {
  const shouldRunTests = files.some((file) => testTriggerPaths.test(file));

  if (!shouldRunTests) {
    console.log("Pre-commit tests skipped: no staged app, test, or config files.");
    return;
  }

  console.log("Pre-commit tests: staged snapshot.");
  run(resolve(repoRoot, "node_modules", ".bin", `vitest${binSuffix}`), [
    "run",
    "--project",
    "unit",
  ], {
    cwd: snapshotDir,
    stdio: "inherit",
  });
}

const files = stagedExistingFiles(stagedFiles());

if (!files.length) {
  console.log("Pre-commit checks skipped: no staged files.");
  process.exit(0);
}

const snapshotDir = createStagedSnapshot();

try {
  runTypecheck(files, snapshotDir);
  runLint(files, snapshotDir);
  runTests(files, snapshotDir);
} finally {
  rmSync(snapshotDir, { force: true, recursive: true });
}
