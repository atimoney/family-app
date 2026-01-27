import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export function getOAuthClient(config: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): OAuth2Client {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

export function buildAuthUrl(options: {
  oauthClient: OAuth2Client;
  scopes: string[];
  state: string;
}): string {
  return options.oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: options.scopes,
    state: options.state,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(options: {
  oauthClient: OAuth2Client;
  code: string;
}) {
  const { tokens } = await options.oauthClient.getToken(options.code);
  return tokens;
}

export function getAuthorizedClient(options: {
  oauthClient: OAuth2Client;
  refreshToken: string;
}): OAuth2Client {
  options.oauthClient.setCredentials({ refresh_token: options.refreshToken });
  return options.oauthClient;
}
