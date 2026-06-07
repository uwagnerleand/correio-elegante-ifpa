const forbiddenTerms = [
  'palavrão',
  'idiota',
  'otário',
  'bosta',
  'ofensa',
  'ódio',
  'racista',
  'sexista',
  'bully',
];

export function containsForbiddenTerms(text: string) {
  const normalized = text.toLowerCase();
  return forbiddenTerms.some((term) => normalized.includes(term));
}
