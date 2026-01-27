import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptSecret(plainText: string, base64Key: string): string {
  const key = Buffer.from(base64Key, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decryptSecret(payload: string, base64Key: string): string {
  const key = Buffer.from(base64Key, 'base64');
  const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as {
    iv: string;
    tag: string;
    data: string;
  };

  const iv = Buffer.from(decoded.iv, 'base64');
  const tag = Buffer.from(decoded.tag, 'base64');
  const data = Buffer.from(decoded.data, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}
