(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FilumPolicyEngine = api;
})(globalThis, function () {
  'use strict';

  const LEVELS = Object.freeze(['normal', 'protected', 'strong', 'maximum']);
  const FEATURES = Object.freeze({
    javascript: Object.freeze(['full', 'blocked']),
    canvas: Object.freeze(['standard', 'protected']),
    webgl: Object.freeze(['normal', 'limited', 'blocked']),
    webrtc: Object.freeze(['allow', 'protect', 'blocked']),
    tracking: Object.freeze(['baseline', 'strict']),
    cookies: Object.freeze(['partitioned', 'third-party-blocked'])
  });
  const MODE_LEVELS = Object.freeze({
    NORMAL: 'normal', TURBO: 'normal', PRIVATE: 'strong', GHOST: 'maximum'
  });
  const PRESETS = Object.freeze({
    normal: Object.freeze({
      javascript: 'full', canvas: 'standard', webgl: 'normal', webrtc: 'protect',
      tracking: 'baseline', cookies: 'partitioned'
    }),
    protected: Object.freeze({
      javascript: 'full', canvas: 'protected', webgl: 'limited', webrtc: 'protect',
      tracking: 'strict', cookies: 'partitioned'
    }),
    strong: Object.freeze({
      javascript: 'full', canvas: 'protected', webgl: 'limited', webrtc: 'blocked',
      tracking: 'strict', cookies: 'partitioned'
    }),
    maximum: Object.freeze({
      javascript: 'blocked', canvas: 'protected', webgl: 'blocked', webrtc: 'blocked',
      tracking: 'strict', cookies: 'third-party-blocked'
    })
  });

  function normalizeState(input, mode = 'NORMAL') {
    const state = input && typeof input === 'object' ? input : {};
    const level = LEVELS.includes(state.level) ? state.level : null;
    const overrides = {};
    if (state.overrides && typeof state.overrides === 'object' && !Array.isArray(state.overrides)) {
      for (const [feature, value] of Object.entries(state.overrides)) {
        if (FEATURES[feature]?.includes(value)) overrides[feature] = value;
      }
    }
    return { level, overrides };
  }

  function normalizeOrigin(value) {
    try {
      const url = new URL(String(value));
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== 'null' ? url.origin : null;
    } catch (_) { return null; }
  }

  function normalizeSiteOverride(input) {
    if (!input || typeof input !== 'object') return null;
    const level = LEVELS.includes(input.level) ? input.level : null;
    const canvasException = input.canvasException === 'allow-extract' ? 'allow-extract' : null;
    return level || canvasException ? { level, canvasException } : null;
  }

  function resolve(input, mode = 'NORMAL', context = {}) {
    const state = normalizeState(input, mode);
    const level = state.level || MODE_LEVELS[mode] || 'normal';
    const preset = PRESETS[level];
    const effective = { ...preset, ...state.overrides };
    const features = {};
    for (const feature of Object.keys(FEATURES)) {
      let value = effective[feature];
      let enforcedBy = null;
      if (context.torEnabled && feature === 'webrtc') {
        value = 'blocked';
        enforcedBy = 'tor';
      }
      if (context.torEnabled && feature === 'canvas') {
        value = 'protected';
        enforcedBy = 'tor';
      }
      features[feature] = {
        requested: value,
        source: enforcedBy || (state.overrides[feature] ? 'global-override'
          : state.level ? 'global-preset' : 'mode-default'),
        preset: preset[feature],
        manual: state.overrides[feature] ?? null,
        site: null,
        effective: value,
        enforcedBy,
        siteOverride: 'UNSUPPORTED'
      };
    }
    return { level, mode, features };
  }

  function resolveSite(input, mode, siteInput, context = {}) {
    const global = resolve(input, mode, context);
    const site = normalizeSiteOverride(siteInput);
    const preset = site?.level ? PRESETS[site.level] : null;
    const actual = context.actual || {};
    const perms = context.sitePermissions || {};
    const features = {};
    let partial = false;
    for (const feature of Object.keys(FEATURES)) {
      const globalFeature = global.features[feature];
      const effectiveGlobal = actual[feature] ?? globalFeature.effective;
      const requested = !site ? globalFeature.requested
        : feature === 'canvas' && site.canvasException === 'allow-extract'
          ? 'standard' : preset?.[feature] ?? globalFeature.effective;
      let effective = effectiveGlobal;
      let source = globalFeature.source;
      let verified = !site ? globalFeature.verified || (actual[feature] === undefined ? 'NOT VERIFIED'
        : requested === effectiveGlobal ? 'PASS' : 'FAIL')
        : actual[feature] === undefined ? 'NOT VERIFIED'
          : requested === effectiveGlobal ? 'PASS' : 'UNSUPPORTED';
      let mechanism = 'global';
      if (feature === 'canvas' && perms.canvas === 'allow') {
        if (context.torEnabled) {
          source = 'TOR hard constraint conflict · Canvas allow permission present';
          verified = 'FAIL';
        } else {
          effective = 'standard';
          const owned = !!context.ownedSitePermissions?.canvas;
          source = owned ? 'site override · Canvas permission' : 'Gecko Canvas permission · outside FILUM policy';
          mechanism = owned ? 'origin-permission' : 'native-permission';
          verified = actual.canvas === undefined ? 'NOT VERIFIED'
            : effective === requested ? 'PASS' : owned ? 'PARTIAL' : 'EXTERNAL OVERRIDE';
        }
      } else if (feature === 'tracking' && perms.tracking === 'allow') {
        effective = 'baseline';
        const owned = !!context.ownedSitePermissions?.tracking;
        source = owned ? 'site override · tracking allow-list' : 'Gecko tracking permission · outside FILUM policy';
        mechanism = owned ? 'origin-permission' : 'native-permission';
        verified = actual.tracking === undefined ? 'NOT VERIFIED'
          : effective === requested ? 'PASS' : owned ? 'PARTIAL' : 'EXTERNAL OVERRIDE';
      } else if (site && requested !== effectiveGlobal) {
        partial = true;
        source = globalFeature.enforcedBy === 'tor'
          ? `TOR hard constraint · ${feature}`
          : `site level requested; ${globalFeature.source} remains effective`;
        verified = globalFeature.enforcedBy === 'tor' ? 'BLOCKED BY TOR' : 'UNSUPPORTED';
      } else if (site) {
        source = `${globalFeature.source} · site level agrees`;
        verified = actual[feature] === undefined ? 'NOT VERIFIED' : 'PASS';
      }
      if (site && verified !== 'PASS' && verified !== 'BLOCKED BY TOR') partial = true;
      features[feature] = { requested, source, effective, verified,
        globalEffective: effectiveGlobal, siteOverride: mechanism,
        enforcedBy: globalFeature.enforcedBy, preset: preset?.[feature] ?? globalFeature.preset,
        manual: site ? null : globalFeature.manual };
    }
    return { mode, globalLevel: global.level, requestedLevel: site?.level || global.level,
      effectiveLevel: !site ? global.level : partial ? 'partial' : site.level || 'partial',
      siteOverride: site, torEnabled: !!context.torEnabled, features };
  }

  function update(input, mode, change) {
    const state = normalizeState(input, mode);
    if (change?.type === 'set-level' && LEVELS.includes(change.level)) {
      return { ...state, level: change.level };
    }
    if (change?.type === 'set-feature' && FEATURES[change.feature] &&
        (change.value === 'preset' || FEATURES[change.feature].includes(change.value))) {
      const overrides = { ...state.overrides };
      if (change.value === 'preset') delete overrides[change.feature];
      else overrides[change.feature] = change.value;
      return { ...state, overrides };
    }
    throw new TypeError('Unsupported policy change');
  }

  return Object.freeze({ LEVELS, FEATURES, MODE_LEVELS, PRESETS, normalizeOrigin,
    normalizeState, normalizeSiteOverride, resolve, resolveSite, update });
});
