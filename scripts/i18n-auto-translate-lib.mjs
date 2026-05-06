/**
 * Pure helpers for i18n-auto-translate.mjs (unit-tested).
 */

/**
 * Keys to machine-translate for one locale: present in English but absent locally,
 * optionally restricted to keys newly added in English vs git HEAD.
 *
 * @param {string[]} enKeys
 * @param {Record<string, unknown>} existingFlat
 * @param {Set<string> | null} addedEnglishKeysSet — keys in working-tree EN not in HEAD EN; null if unknown
 * @param {{ translateAllGaps: boolean; hasGitBaseline: boolean }} opts
 * @returns {string[]}
 */
export function filterMissingKeysToTranslate(enKeys, existingFlat, addedEnglishKeysSet, opts) {
  const { translateAllGaps, hasGitBaseline } = opts;
  return enKeys.filter((k) => {
    if (k in existingFlat) return false;
    if (translateAllGaps) return true;
    if (!hasGitBaseline || addedEnglishKeysSet === null) {
      // No git diff to HEAD.en — cannot restrict to “new” keys; fill all gaps (legacy behavior).
      return true;
    }
    return addedEnglishKeysSet.has(k);
  });
}
