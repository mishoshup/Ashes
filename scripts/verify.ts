const steps: Array<[string, string[]]> = [
  ["format", ["bun", "run", "format:check"]],
  ["lint", ["bunx", "oxlint", "--type-aware", "apps/api", "packages"]],
  ["typecheck", ["bun", "run", "typecheck"]],
  ["architecture", ["bun", "scripts/architecture.ts"]],
  ["unit", ["bun", "run", "test"]],
  ["worker", ["bun", "run", "test:worker"]],
  ["build", ["bun", "run", "build"]],
];

const startedAt = performance.now();

for (const [name, command] of steps) {
  console.log(`\n▶ ${name}`);
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    console.error(`\n✖ ${name} failed (${exitCode})`);
    process.exit(exitCode);
  }
}

const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
console.log(`\n✔ verify passed in ${seconds}s`);
