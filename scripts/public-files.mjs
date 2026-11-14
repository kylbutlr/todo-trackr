/** Files belonging to the public product. Local owner integrations are opt-in. */
export function isPublicSource(file) {
  return ![
    /^personal\//u, /^apps\/macos\/Personal\//u,
    /^apps\/browser-extension\/radar[^/]*(?:\/|$)/u,
    /^apps\/browser-extension\/(?:manifest\.json|background\.js|popup\.html|README\.md)$/u,
    /^docs\/radar/u, /^(?:hosting|integrations)\//u,
    /^scripts\/(?:radar(?:\/|-)|register-radar-|check-radar-|test-radar-|preview-work-providers)/u,
    /^tests\/(?:radar|test_radar|work-provider-safety)/u,
    /^vitest\.radar/u,
  ].some(pattern => pattern.test(file));
}
