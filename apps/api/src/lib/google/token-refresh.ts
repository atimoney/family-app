import type { OAuth2Client } from 'google-auth-library';

export type RefreshedTokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

export async function refreshAccessToken(options: {
  oauthClient: OAuth2Client;
  refreshToken: string;
}): Promise<RefreshedTokenResult> {
  options.oauthClient.setCredentials({ refresh_token: options.refreshToken });
  const response = await options.oauthClient.refreshToken(options.refreshToken);
  const tokens = response.tokens;

  if (!tokens.access_token || !tokens.expiry_date) {
    throw new Error('Failed to refresh access token');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date,
  };
}
