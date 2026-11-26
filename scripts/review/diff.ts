const IGNORED_PATHS = [
  /^bun\.lock$/u,
  /^package-lock\.json$/u,
  /^yarn\.lock$/u,
  /^pnpm-lock\.yaml$/u,
  /(^|\/)dist\//u,
  /(^|\/)coverage\//u,
  /(^|\/)\.expo\//u,
  /(^|\/)ios\//u,
  /(^|\/)android\//u,
  /(^|\/)assets\//u,
  /(^|\/)worker-configuration\.d\.ts$/u,
  /(^|\/)migrations\/meta\//u,
  /\.(png|jpe?g|webp|gif|svg|pdf|zip|mp4|mov)$/iu,
];

export type FilteredDiff = {
  diff: string;
  removedFiles: number;
};

export function filterDiff(diff: string): FilteredDiff {
  const sections = diff.split(/(?=^diff --git )/mu);
  let removedFiles = 0;
  const kept: string[] = [];

  for (const section of sections) {
    const path = section.match(/^diff --git a\/(.+?) b\/(.+)$/mu)?.[2];
    if (path && IGNORED_PATHS.some((pattern) => pattern.test(path))) {
      removedFiles += 1;
      continue;
    }
    kept.push(section);
  }

  return { diff: kept.join(""), removedFiles };
}
