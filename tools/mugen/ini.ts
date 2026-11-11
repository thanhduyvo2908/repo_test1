// Minimal parser for MUGEN's INI-like text files (.def, .air, .cmd, .cns, .st).

export interface IniLine {
  /** Lower-cased key, or "" when the line has no "=". */
  key: string;
  value: string;
  raw: string;
}

export interface IniSection {
  name: string;
  lines: IniLine[];
}

/** Removes a ";" comment, ignoring semicolons inside double quotes. */
export function stripComment(line: string): string {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ';' && !inQuote) return line.slice(0, i);
  }
  return line;
}

export function parseIni(text: string): IniSection[] {
  const sections: IniSection[] = [];
  let current: IniSection | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    const header = /^\[(.*)\]/.exec(line);
    if (header) {
      current = { name: (header[1] ?? '').trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const eq = line.indexOf('=');
    if (eq > 0) {
      current.lines.push({ key: line.slice(0, eq).trim().toLowerCase(), value: line.slice(eq + 1).trim(), raw: line });
    } else {
      current.lines.push({ key: '', value: line, raw: line });
    }
  }
  return sections;
}

export function getValue(section: IniSection, key: string): string | undefined {
  const k = key.toLowerCase();
  return section.lines.find((l) => l.key === k)?.value;
}

export function unquote(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const v = value.trim();
  return v.startsWith('"') && v.endsWith('"') && v.length >= 2 ? v.slice(1, -1) : v;
}

export function findSection(sections: IniSection[], name: string): IniSection | undefined {
  const n = name.toLowerCase();
  return sections.find((s) => s.name.toLowerCase() === n);
}
