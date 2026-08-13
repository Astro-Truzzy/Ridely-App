import { ensureWebCryptoForPkce } from './cryptoPolyfill';

describe('ensureWebCryptoForPkce', () => {
  it('produces the SHA-256 digest for "abc"', async () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      configurable: true,
    });

    ensureWebCryptoForPkce();
    const hash = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('abc')
    );
    const hex = [...new Uint8Array(hash)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

    Object.defineProperty(globalThis, 'crypto', {
      value: original,
      configurable: true,
    });
  });
});
