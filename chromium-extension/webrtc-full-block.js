(() => {
  const peerConnectionPrototypes = [];
  for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection']) {
    const original = self[name];
    if (!original) continue;
    if (original.prototype) peerConnectionPrototypes.push(original.prototype);
    const blocked = function () {
      throw new Error('WebRTC is blocked by FILUM.');
    };
    try {
      Object.defineProperty(blocked, 'name', { value: original.name });
      Object.defineProperty(blocked, 'length', { value: original.length });
      Object.setPrototypeOf(blocked, Object.getPrototypeOf(original));
      blocked.prototype = original.prototype;
    } catch (_) { /* Keep the blocking wrapper if metadata cannot be copied. */ }
    try {
      Object.defineProperty(self, name, {
        configurable: false,
        writable: false,
        value: blocked
      });
    } catch (_) {
      try { self[name] = blocked; } catch (_) { /* Page may lock the property. */ }
    }
  }

  try {
    const mediaDevices = navigator.mediaDevices;
    if (typeof mediaDevices?.getUserMedia === 'function') {
      Object.defineProperty(mediaDevices, 'getUserMedia', {
        value: () => Promise.reject(new Error('WebRTC getUserMedia blocked by FILUM.'))
      });
    }
  } catch (_) { /* Some restricted pages expose immutable navigator properties. */ }

  try {
    if (typeof navigator.getUserMedia === 'function') {
      navigator.getUserMedia = function () {
        throw new Error('WebRTC getUserMedia blocked by FILUM.');
      };
    }
  } catch (_) { /* Legacy API may not be writable. */ }

  for (const prototype of peerConnectionPrototypes) {
    for (const name of [
      'createDataChannel', 'addIceCandidate', 'setLocalDescription',
      'setRemoteDescription', 'createOffer', 'createAnswer'
    ]) {
      if (typeof prototype[name] !== 'function') continue;
      try {
        Object.defineProperty(prototype, name, {
          value: function () { throw new Error('WebRTC is blocked by FILUM.'); }
        });
      } catch (_) { /* Page may freeze the native prototype. */ }
    }
  }
})();
