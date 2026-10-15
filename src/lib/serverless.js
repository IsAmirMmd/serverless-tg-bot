// Promise wrapper around Telegram.WebApp.Serverless.call (from telegram-web-app.js).
//   const profile = await callEndpoint('getProfile', { lang: 'en' });
// Rejects with an Error that has .type ('ENDPOINT_ERROR' for an EndpointError,
// 'UNAUTHORIZED', …), .code (parameters.code) and .parameters.

export class EndpointCallError extends Error {
  constructor(err) {
    super(err?.message || 'Request failed');
    this.name = 'EndpointCallError';
    this.type = err?.type;
    this.parameters = err?.parameters ?? {};
    this.code = this.parameters.code;
  }
}

export function callEndpoint(name, input = {}) {
  const serverless = window.Telegram?.WebApp?.Serverless;
  if (!serverless) {
    return Promise.reject(new EndpointCallError({
      type: 'NOT_IN_TELEGRAM',
      message: 'Telegram.WebApp.Serverless is unavailable — open the app inside Telegram.',
    }));
  }
  return new Promise((resolve, reject) => {
    serverless.call(name, input, (err, result) => (err ? reject(new EndpointCallError(err)) : resolve(result)));
  });
}
