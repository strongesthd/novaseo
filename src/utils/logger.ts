import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: LOG_LEVEL,
  redact: {
    paths: ['*.token', '*.password', '*.secret', '*.appPassword', '*.oauthToken'],
    remove: true
  },
  serializers: {
    err: pino.stdSerializers.err
  }
});
