import crypto from 'node:crypto';

type OAuthStatePayload = {
  userId: string;
  nonce: string;
  createdAt: number;
};

function base64UrlEncode(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + padding, 'base64');
}

export function createOAuthState(userId: string, secret: string): string {
  const payload: OAuthStatePayload = {
    userId,
    nonce: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest();

  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export function verifyOAuthState(state: string, secret: string): OAuthStatePayload | null {
  const [encodedPayload, encodedSignature] = state.split('.');
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest();

  const actualSignature = base64UrlDecode(encodedSignature);

  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as OAuthStatePayload;
    return payload;
  } catch {
    return null;
  }
}
