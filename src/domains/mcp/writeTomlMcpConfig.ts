const escapeTomlString = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const SECTION_PATTERN = /^\s*\[([^\]]+)\]\s*$/;

interface TomlSection {
  path: string;
  lines: string[];
}

const splitSections = (content: string): TomlSection[] => {
  const sections: TomlSection[] = [{ path: "", lines: [] }];

  for (const line of content.split("\n")) {
    const match = SECTION_PATTERN.exec(line);

    if (match) {
      sections.push({ path: match[1].trim(), lines: [line] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  return sections;
};

const getServerName = (sectionPath: string, rootKey: string): string => {
  const prefix = `${rootKey}.`;

  if (!sectionPath.startsWith(prefix)) {
    return "";
  }

  return sectionPath.slice(prefix.length).split(".")[0];
};

const findUrl = (lines: string[]): string | undefined =>
  lines
    .map((line) => /^\s*url\s*=\s*"([^"]*)"\s*$/.exec(line))
    .find((match) => match !== null)?.[1];

export const buildTomlMcpConfig = (
  content: string,
  rootKey: string,
  defaultServerName: string,
  url: string,
  token: string
): string => {
  const sections = splitSections(content);

  const existingName = sections
    .filter((section) => getServerName(section.path, rootKey) !== "")
    .find((section) => findUrl(section.lines) === url);

  const serverName = existingName
    ? getServerName(existingName.path, rootKey)
    : defaultServerName;

  const kept = sections.filter(
    (section) => getServerName(section.path, rootKey) !== serverName
  );

  const preserved = kept
    .map((section) => section.lines.join("\n"))
    .join("\n")
    .replace(/\n+$/, "");

  const block = [
    `[${rootKey}.${serverName}]`,
    `url = "${escapeTomlString(url)}"`,
    "",
    `[${rootKey}.${serverName}.http_headers]`,
    `Authorization = "Bearer ${escapeTomlString(token)}"`
  ].join("\n");

  return preserved.length > 0 ? `${preserved}\n\n${block}\n` : `${block}\n`;
};
