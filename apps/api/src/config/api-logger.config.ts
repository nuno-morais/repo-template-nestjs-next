export function apiPinoHttpOptions(production: boolean) {
  return {
    level: production ? 'info' : 'debug',
    transport: production
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
    autoLogging: true,
    base: { service: '{{ service_log_name }}' },
    redact: {
      censor: '[Redacted]',
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
      ],
    },
  };
}
