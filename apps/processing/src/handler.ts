import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { config } from './config.js';
import { run } from './index.js';

const secrets = new SecretsManagerClient({
  region: config.awsRegion,
  endpoint: config.awsEndpoint,
});

async function loadStravaSecret() {
  if (!config.stravaSecretArn) return;

  const response = await secrets.send(new GetSecretValueCommand({ SecretId: config.stravaSecretArn }));
  if (!response.SecretString) throw new Error('Strava secret has no SecretString value.');

  const value = JSON.parse(response.SecretString) as {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
  };

  config.strava.clientId = value.clientId ?? '';
  config.strava.clientSecret = value.clientSecret ?? '';
  config.strava.refreshToken = value.refreshToken ?? '';
}

export async function handler() {
  await loadStravaSecret();
  await run();
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}
