import { Amplify } from 'aws-amplify';

const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN?.replace(/^https?:\/\//, '');
const redirect = `${window.location.origin}/medical-scribe`;

Amplify.configure({
  Auth: {
    Cognito: {
      region: import.meta.env.VITE_COGNITO_REGION,
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: cognitoDomain,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [redirect],
          redirectSignOut: [redirect],
          responseType: 'code',
        },
      },
    },
  },
});