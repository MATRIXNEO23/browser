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

  return Object.freeze({ LEVELS, FEATURES, MODE_LEVELS, PRESETS, normalizeState, resolve, update });
});
