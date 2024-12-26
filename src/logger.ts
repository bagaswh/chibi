import { pid } from 'process';
import winston, { createLogger as winstonCreateLogger, Logger } from 'winston';
import app from './app';

type ChildLoggerMetadata = {
  component?: string;
};

export function createLogger(
  context: string,
  logLevel: string = 'info',
  config: ChildLoggerMetadata = {}
) {
  let meta: Record<any, any> = { context, ...config };
  const opts: Record<any, any> = {
    level: logLevel,
    format: winston.format.json(),
    defaultMeta: meta,
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
    ],
  };
  return winstonCreateLogger(opts);
}
