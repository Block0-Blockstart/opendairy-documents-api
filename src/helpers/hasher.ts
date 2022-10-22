import { blake2bHex } from 'blakejs';

/**
 *
 * Computes the hash of the input buffer, using Blake2 algorithm. The output is 12 bytes
 * converted to a 24-length hexstring (NOT prefixed with '0x').
 *
 * Note: The 24-length result is long enough to provide collision-proof result and
 * is short enough to be converted to a solidity-like bytes32.
 *
 */
export function bufferToHash(buffer: Buffer): string {
  return blake2bHex(buffer, null, 12);
}

/**
 *
 * Computes the hash of the input string, using Blake2 algorithm. The output is 12 bytes
 * converted to a 24-length hexstring (NOT prefixed with '0x').
 *
 * Note: The 24-length result is long enough to provide collision-proof result and
 * is short enough to be converted to a solidity-like bytes32.
 *
 */
export function stringToHash(input: string): string {
  return bufferToHash(Buffer.from(input));
}
