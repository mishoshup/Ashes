const processes = [
  Bun.spawn(["bun", "--cwd=apps/api", "run", "dev"], {
    stdout: "inherit",
    stderr: "inherit",
  }),
  Bun.spawn(["bun", "--cwd=apps/mobile", "run", "start"], {
    stdout: "inherit",
    stderr: "inherit",
  }),
];

function shutdown(): void {
  for (const process of processes) {
    process.kill();
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const exitCode = await Promise.race(processes.map((process) => process.exited));
shutdown();
process.exit(exitCode);
