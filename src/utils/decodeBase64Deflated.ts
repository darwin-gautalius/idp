import * as zlib from 'zlib';

// Helper function to decode SAML request
export function decodeBase64Deflated(input: string): string {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(input, 'base64');

    // Try to inflate (decompress) the buffer
    try {
      const inflated = zlib.inflateRawSync(buffer);
      return inflated.toString('utf8');
    } catch (e) {
      // If inflation fails, it might not be compressed
      return buffer.toString('utf8');
    }
  } catch (error) {
    console.error('Error decoding SAML request:', error);
    return '';
  }
}
