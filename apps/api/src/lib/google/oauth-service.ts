import type { PrismaClient } from '@prisma/client';
import type { OAuth2Client } from 'google-auth-library';
import { encryptSecret, decryptSecret } from '../crypto.js';
import { getOAuthClient } from './oauth.js';
import { refreshAccessToken } from './token-refresh.js';

type TokenEnvelope = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type StoredTokenEnvelope = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function buildOAuthClient(config: GoogleOAuthConfig): OAuth2Client {
  return getOAuthClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
}

export async function exchangeAuthCodeForTokens(options: {
  code: string;
  oauthClient: OAuth2Client;
}): Promise<TokenEnvelope> {
  const { tokens } = await options.oauthClient.getToken(options.code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Google OAuth did not return required tokens');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date,
  };
}

export function encryptTokenEnvelope(tokens: TokenEnvelope, encryptionKey: string): StoredTokenEnvelope {
  return {
    accessToken: encryptSecret(tokens.accessToken, encryptionKey),
    refreshToken: encryptSecret(tokens.refreshToken, encryptionKey),
    expiresAt: tokens.expiresAt,
  };
}

export function decryptTokenEnvelope(tokens: StoredTokenEnvelope, encryptionKey: string): TokenEnvelope {
  return {
    accessToken: decryptSecret(tokens.accessToken, encryptionKey),
    refreshToken: decryptSecret(tokens.refreshToken, encryptionKey),
    expiresAt: tokens.expiresAt,
  };
}

export async function upsertCalendarAccountTokens(options: {
  prisma: PrismaClient;
  userId: string;
  provider: string;
  googleCalendarId: string;
  tokens: TokenEnvelope;
  encryptionKey: string;
}): Promise<void> {
  const encryptedTokens = encryptTokenEnvelope(options.tokens, options.encryptionKey);

  await options.prisma.calendarAccount.upsert({
    where: {
      userId_provider: {
        userId: options.userId,
        provider: options.provider,
      },
    },
    create: {
      userId: options.userId,
      provider: options.provider,
      googleCalendarId: options.googleCalendarId,
      tokens: encryptedTokens,
      syncState: {},
    },
    update: {
      googleCalendarId: options.googleCalendarId,
      tokens: encryptedTokens,
    },
  });
}

export async function getStoredTokens(options: {
  prisma: PrismaClient;
  userId: string;
  provider: string;
  encryptionKey: string;
}): Promise<TokenEnvelope | null> {
  const account = await options.prisma.calendarAccount.findFirst({
    where: {
      userId: options.userId,
      provider: options.provider,
      deletedAt: null,
    },
  });

  if (!account) {
    return null;
  }

  return decryptTokenEnvelope(account.tokens as StoredTokenEnvelope, options.encryptionKey);
}

export async function getValidAccessToken(options: {
  prisma: PrismaClient;
  userId: string;
  provider: string;
  oauthClient: OAuth2Client;
  encryptionKey: string;
}): Promise<TokenEnvelope> {
  const existing = await getStoredTokens({
    prisma: options.prisma,
    userId: options.userId,
    provider: options.provider,
    encryptionKey: options.encryptionKey,
  });

  if (!existing) {
    throw new Error('No stored tokens for user');
  }

  const bufferMs = 60_000;
  if (existing.expiresAt > Date.now() + bufferMs) {
    return existing;
  }

  const refreshed = await refreshAccessToken({
    oauthClient: options.oauthClient,
    refreshToken: existing.refreshToken,
  });

  const merged: TokenEnvelope = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? existing.refreshToken,
    expiresAt: refreshed.expiresAt,
  };

  await upsertCalendarAccountTokens({
    prisma: options.prisma,
    userId: options.userId,
    provider: options.provider,
    googleCalendarId: 'primary',
    tokens: merged,
    encryptionKey: options.encryptionKey,
  });

  return merged;
}
