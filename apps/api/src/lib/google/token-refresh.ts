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
  const response = await options.oauthClient.getAccessToken();

  if (!response.token) {
    throw new Error('Failed to refresh access token');
  }

  const credentials = options.oauthClient.credentials;

  return {
    accessToken: response.token,
    refreshToken: credentials.refresh_token ?? undefined,
    expiresAt: credentials.expiry_date ?? Date.now() + 3600 * 1000,
  };
}
