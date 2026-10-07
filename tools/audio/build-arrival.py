"""Build recorded arrival Foley with soundfile and numpy. No synthesis."""
from pathlib import Path
import json
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'tools/audio/raw'
OUT = ROOT / 'public/audio'
SR = 48000

def recording(id):
    meta = json.loads((RAW / f'{id}.json').read_text())
    assert 'publicdomain/zero' in meta['license'], 'Only verified CC0 sources'
    x, sr = sf.read(RAW / f'{id}.ogg', always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        x = np.interp(np.arange(round(len(x)*SR/sr))/SR, np.arange(len(x))/sr, x)
    return x, meta

def biquad(x, b, a):
    y = np.zeros(len(x))
    x1 = x2 = y1 = y2 = 0.
    for i, v in enumerate(x):
        z = b[0]*v + b[1]*x1 + b[2]*x2 - a[0]*y1 - a[1]*y2
        y[i] = z
        x2, x1, y2, y1 = x1, v, y1, z
    return y

def momentary(x):
    # BS.1770 K weighting at 48 kHz, matching tools/audio/lib.mjs.
    k = biquad(x, [1.5351248596, -2.6916961894, 1.1983928109], [-1.6906592932, .7324807742])
    k = biquad(k, [1., -2., 1.], [-1.9900474548, .9900722504])
    win, hop = 19200, 4800
    values = [-.691 + 10*np.log10(np.sum(k[s:s+win]**2)/win + 1e-12)
              for s in range(0, max(len(k)-win+1, 1), hop)]
    return round(float(max(values)), 1)

def sprite(name, excerpts):
    parts, slices, loudness, provenance = [], [], [], []
    cursor = 0.
    for id, start, duration in excerpts:
        x, meta = recording(id)
        x = x[int(start*SR):int((start+duration)*SR)].copy()
        x -= x.mean()
        n = min(int(.035*SR), len(x)//3)
        ramp = np.sin(np.linspace(0, np.pi/2, n))**2
        x[:n] *= ramp
        x[-n:] *= ramp[::-1]
        x *= 10**(-3/20) / max(np.max(np.abs(x)), 1e-6)
        slices.append([round(cursor, 4), round(len(x)/SR, 4)])
        loudness.append(momentary(x))
        parts += [x, np.zeros(int(.08*SR))]
        cursor += len(x)/SR + .08
        provenance.append({'id': id, 'start': start, 'duration': duration, 'source': meta['url'], 'licence': meta['license']})
    audio = np.concatenate(parts)
    sf.write(OUT / f'{name}.ogg', audio, SR, format='OGG', subtype='VORBIS')
    return {'bank': {'file': f'{name}.ogg', 'slices': slices, 'lufs': loudness}, 'excerpts': provenance,
            'duration': round(len(audio)/SR, 4), 'peakDbFS': round(20*np.log10(np.max(np.abs(audio))), 2)}

manifest = {
    'arrival_stroke': sprite('arrival_stroke', [(588307, t, 1.65) for t in [9.35, 20.55, 22.95, 32.65, 37.25, 43.75]]),
    'arrival_creak': sprite('arrival_creak', [(502505, 0., .97), (502511, 0., 1.16), (506662, 0., 1.57)]),
}
(ROOT / 'tools/audio/arrival-bank.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({k: v['bank'] for k, v in manifest.items()}, indent=2))
