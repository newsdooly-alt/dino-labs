const SUFFIXES_TO_REMOVE = [
  /,?\s*Inc\.?$/i,
  /,?\s*Corp\.?$/i,
  /,?\s*Corporation$/i,
  /,?\s*Co\.?$/i,
  /,?\s*Ltd\.?$/i,
  /,?\s*L\.?P\.?$/i,
  /,?\s*LLC$/i,
  /,?\s*PLC$/i,
  /,?\s*S\.?A\.?$/i,
  /,?\s*N\.?V\.?$/i,
  /,?\s*AG$/i,
  /,?\s*SE$/i,
  /,?\s*Group$/i,
  /^\(주\)\s*/,
  /\s*\(주\)$/,
  /^\(유\)\s*/,
  /\s*\(유\)$/,
  /,?\s*Class [A-C]$/i,
];

export function cleanCompanyName(name: string): string {
  if (!name) return name;
  let cleaned = name.trim();
  for (const pattern of SUFFIXES_TO_REMOVE) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}
