// 무전 음성 합성 (기기에 영어 음성이 없을 때만 불러옴)
const m = require('mespeak');
m.loadConfig(require('mespeak/src/mespeak_config.json'));
m.loadVoice(require('mespeak/voices/en/en-us.json'));
self.onmessage = e => {
  const { id, text, opt } = e.data;
  try { const a = m.speak(text, Object.assign({ rawdata: 'array', speed: 160, pitch: 38, variant: 'm3', amplitude: 120 }, opt || {})); const u = new Uint8Array(a); self.postMessage({ id, buf: u.buffer }, [u.buffer]); }
  catch (err) { self.postMessage({ id, err: String(err) }); }
};
