// Pure-JS SHA-1 (ported from app/js/sha1.js); works without crypto.subtle.
// @ts-nocheck -- numeric bit twiddling, verified by tests.
export function sha1Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const N = bytes.length;

  const padLen = ((N + 9 + 63) >>> 6) << 6;
  const m = new Uint8Array(padLen);
  m.set(bytes);
  m[N] = 0x80;
  const bitLen = N * 8;
  m[padLen - 4] = (bitLen >>> 24) & 0xff;
  m[padLen - 3] = (bitLen >>> 16) & 0xff;
  m[padLen - 2] = (bitLen >>> 8) & 0xff;
  m[padLen - 1] = bitLen & 0xff;

  const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const W: number[] = new Array<number>(80).fill(0);

  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      const idx = i + t * 4;
      W[t] = (m[idx] << 24) | (m[idx + 1] << 16) | (m[idx + 2] << 8) | m[idx + 3];
    }
    for (let t = 16; t < 80; t++) {
      const x = W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16];
      W[t] = (x << 1) | (x >>> 31);
    }

    let a = H[0] | 0;
    let b = H[1] | 0;
    let c = H[2] | 0;
    let d = H[3] | 0;
    let e = H[4] | 0;

    for (let t = 0; t < 80; t++) {
      let f, k;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999 | 0;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1 | 0;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc | 0;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6 | 0;
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + W[t]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
  }

  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
