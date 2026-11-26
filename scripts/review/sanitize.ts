function escapeOutsideCode(segment: string): string {
  return segment
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/@(?=[A-Za-z0-9_-])/gu, "@\u200b");
}

function sanitizeLine(line: string): string {
  let output = "";
  let index = 0;

  while (index < line.length) {
    const tick = line.indexOf("`", index);
    if (tick === -1) {
      output += escapeOutsideCode(line.slice(index));
      break;
    }

    let backslashes = 0;
    let cursor = tick - 1;
    while (cursor >= 0 && line[cursor] === "\\") {
      backslashes += 1;
      cursor -= 1;
    }
    if (backslashes % 2 === 1) {
      output += escapeOutsideCode(line.slice(index, tick + 1));
      index = tick + 1;
      continue;
    }

    output += escapeOutsideCode(line.slice(index, tick));

    let runLength = 0;
    while (line[tick + runLength] === "`") {
      runLength += 1;
    }
    const delimiter = "`".repeat(runLength);
    const closing = line.indexOf(delimiter, tick + runLength);
    const closingEnd = closing === -1 ? -1 : closing + runLength;
    const hasValidClosing =
      closing !== -1 && (closingEnd === line.length || line[closingEnd] !== "`");

    if (hasValidClosing) {
      output += line.slice(tick, closingEnd);
      index = closingEnd;
    } else {
      output += delimiter;
      index = tick + runLength;
    }
  }

  return output;
}

export function sanitizeComment(body: string): string {
  const lines = body.split("\n");
  let fence: string | null = null;

  return lines
    .map((line, lineIndex) => {
      if (fence) {
        const closing = /^ {0,3}(`{3,}|~{3,})\s*$/u.exec(line)?.[1];
        if (closing?.startsWith(fence)) {
          fence = null;
        }
        return line;
      }

      const opening = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
      if (opening) {
        const hasClosingFence = lines.slice(lineIndex + 1).some((later) => {
          const closing = /^ {0,3}(`{3,}|~{3,})\s*$/u.exec(later)?.[1];
          return closing?.startsWith(opening) === true;
        });
        if (hasClosingFence) {
          fence = opening;
          return line;
        }
        return escapeOutsideCode(line.replaceAll("`", "&#96;").replaceAll("~", "&#126;"));
      }

      return sanitizeLine(line);
    })
    .join("\n");
}
