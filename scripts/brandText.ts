export type Replacement = [string, string];

const URL_PATTERN = /[a-z][a-z0-9+.-]*:\/\/\S+/gi;

export const mapOutsideUrls = (
  value: string,
  transform: (segment: string) => string
): string => {
  let result = "";
  let last = 0;

  for (const match of value.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    result += transform(value.slice(last, index)) + match[0];
    last = index + match[0].length;
  }

  return result + transform(value.slice(last));
};

export const substituteEverywhere = (
  value: string,
  replacements: Replacement[]
): string =>
  replacements.reduce((text, [from, to]) => text.split(from).join(to), value);

export const applyEverywhere = (
  value: unknown,
  replacements: Replacement[]
): unknown => {
  if (typeof value === "string") {
    return substituteEverywhere(value, replacements);
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyEverywhere(item, replacements));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        applyEverywhere(item, replacements)
      ])
    );
  }

  return value;
};

export const substitute = (
  value: string,
  replacements: Replacement[]
): string =>
  mapOutsideUrls(value, (segment) =>
    replacements.reduce(
      (text, [from, to]) => text.split(from).join(to),
      segment
    )
  );

export const applyReplacements = (
  value: unknown,
  replacements: Replacement[]
): unknown => {
  if (typeof value === "string") {
    return substitute(value, replacements);
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyReplacements(item, replacements));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        applyReplacements(item, replacements)
      ])
    );
  }

  return value;
};

export const findBrandLeaks = (
  value: unknown,
  terms: string[],
  hits: string[] = []
): string[] => {
  if (typeof value === "string") {
    mapOutsideUrls(value, (segment) => {
      for (const term of terms) {
        if (segment.toLowerCase().includes(term.toLowerCase())) {
          hits.push(`"${term}" in "${value.slice(0, 60)}"`);
        }
      }
      return segment;
    });
  } else if (Array.isArray(value)) {
    for (const item of value) {
      findBrandLeaks(item, terms, hits);
    }
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) {
      findBrandLeaks(item, terms, hits);
    }
  }

  return hits;
};

export type Glossary = Record<string, string>;

const IDENTIFIER_KEYS = new Set([
  "command",
  "name",
  "toolReferenceName",
  "id",
  "when",
  "group",
  "template",
  "tags",
  "default",
  "enum"
]);

const isPathLike = (value: string): boolean =>
  value.includes("/") && !/\s/.test(value.trim());

const termPattern = (glossary: Glossary): RegExp => {
  const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(${terms.join("|")})(s?)\\b`, "gi");
};

export const substituteTerms = (value: string, glossary: Glossary): string => {
  if (Object.keys(glossary).length === 0 || isPathLike(value)) {
    return value;
  }

  return mapOutsideUrls(value, (segment) =>
    segment.replace(
      termPattern(glossary),
      (match, term: string, plural: string) => {
        const replacement = glossary[term.toLowerCase()];
        return replacement ? `${replacement}${plural ? "s" : ""}` : match;
      }
    )
  );
};

export const applyGlossary = (value: unknown, glossary: Glossary): unknown => {
  if (typeof value === "string") {
    return substituteTerms(value, glossary);
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyGlossary(item, glossary));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        IDENTIFIER_KEYS.has(key) ? item : applyGlossary(item, glossary)
      ])
    );
  }

  return value;
};

export const findTermLeaks = (
  value: unknown,
  glossary: Glossary,
  hits: string[] = []
): string[] => {
  if (Object.keys(glossary).length === 0) {
    return hits;
  }

  if (typeof value === "string") {
    if (!isPathLike(value)) {
      mapOutsideUrls(value, (segment) => {
        const match = termPattern(glossary).exec(segment);
        if (match) {
          hits.push(`"${match[0]}" in "${value.slice(0, 60)}"`);
        }
        return segment;
      });
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      findTermLeaks(item, glossary, hits);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (!IDENTIFIER_KEYS.has(key)) {
        findTermLeaks(item, glossary, hits);
      }
    }
  }

  return hits;
};
