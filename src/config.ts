import amqp from 'amqplib';
import { readFileSync } from 'fs';
import { ChibiError } from './error';
import yaml, { YAMLException } from 'js-yaml';
import * as Z from 'zod';
import { isObject } from './utils/object';

// conditions
const ConditionSchema = Z.string();
export type Condition = Z.infer<typeof ConditionSchema>;

// actions
const ActionShellParamsSchema = Z.object({
  script: Z.string(),
});
export type ActionShellParams = Z.infer<typeof ActionShellParamsSchema>;

const ActionRabbitMQQueueConfigSchema = Z.object({
  name: Z.string(),
  assert: Z.boolean().default(false),
  exclusive: Z.boolean().default(false),
  bind_to_exchange: Z.optional(Z.string()),
});
export type ActionRabbitMQQueueConfig = Z.infer<
  typeof ActionRabbitMQQueueConfigSchema
>;

const ActionRabbitMQExchangeConfigSchema = Z.object({
  name: Z.string(),
  assert: Z.boolean().default(false),
  type: Z.string(),
});
export type ActionRabbitMQExchangeConfig = Z.infer<
  typeof ActionRabbitMQExchangeConfigSchema
>;
const ActionRabbitMQEventStorePublishParamsSchema = Z.object({
  queue: Z.optional(ActionRabbitMQQueueConfigSchema),
  exchange: Z.optional(ActionRabbitMQExchangeConfigSchema),
  routing_key: Z.optional(Z.string()),
  payload: Z.any(),
}).refine((input) => {
  if (input.queue?.exclusive) return !!input.queue?.bind_to_exchange;
  return true;
});
export type ActionRabbitMQEventStorePublishParams = Z.infer<
  typeof ActionRabbitMQEventStorePublishParamsSchema
>;

const ActionEventStorePublishParamsSchema = Z.object({
  to: Z.string(),
  params: Z.any(),
});
export type ActionEventStorePublishParams = Z.infer<
  typeof ActionEventStorePublishParamsSchema
>;

const ActionTypeSchema = Z.enum(['event_store_publish', 'shell']);
export type ActionType = Z.infer<typeof ActionTypeSchema>;

const ActionConfigSchema = Z.lazy(() =>
  Z.object({
    type: ActionTypeSchema,
    params: Z.lazy(() =>
      Z.union([ActionEventStorePublishParamsSchema, ActionShellParamsSchema])
    ),
    condition: Z.optional(ConditionSchema),
  })
);
export type ActionConfig<T = any> = Z.infer<typeof ActionConfigSchema> & {
  params: T;
};

// Client-specific configs

export type RabbitMQClientConfig = amqp.Options.Connect;

// Event store
const EventStoreConfigSchema = Z.object({
  name: Z.string(),
  type: Z.enum(['rabbitmq']),
  rabbitmq: Z.any(),
}).refine(
  (input) => {
    if (input.type == 'rabbitmq' && typeof input.rabbitmq != 'object') {
      return false;
    }
    return true;
  },
  {
    message:
      'RabbitMQ client config should be provided in the `rabbitmq` key when using RabbitMQ client type',
  }
);
export type EventStoreConfig = Z.infer<typeof EventStoreConfigSchema>;

// hook
const HookConfigSchema = Z.object({
  actions: Z.array(ActionConfigSchema),
});
export type HookConfig = Z.infer<typeof HookConfigSchema>;

const HookListConfigSchema = Z.object({
  startup: Z.optional(HookConfigSchema),
  shutdown: Z.optional(HookConfigSchema),
});
export type HookListConfig = Z.infer<typeof HookListConfigSchema>;

// subscriber
const SubscriberConfigSchema = Z.object({
  from: Z.string(),
  debounce: Z.optional(Z.string()),
  actions: Z.array(ActionConfigSchema),
  params: Z.any(),
  payload: Z.object({
    parse_as: Z.enum(['json']),
  }),
});
export type SubscriberConfig = Z.infer<typeof SubscriberConfigSchema>;

// root config
const LogLevelsSchema = Z.enum(['debug', 'warning', 'error', 'info']);
const LoggingSchema = Z.object({
  level: LogLevelsSchema,
  out: Z.enum(['stdout', 'stderr']),
});

export type LogLevels = Z.infer<typeof LogLevelsSchema>;
const ConfigSchema = Z.object({
  event_stores: Z.array(EventStoreConfigSchema),
  hooks: HookListConfigSchema,
  subscribers: Z.array(SubscriberConfigSchema),
  log_level: LogLevelsSchema,
  vars: Z.record(Z.string(), Z.string()),
});
export type Config = Z.infer<typeof ConfigSchema>;

export class ConfigError extends ChibiError {}
export class ConfigValidationError extends ConfigError {}
export class ConfigIOError extends ConfigError {}
export class ConfigParseError extends ConfigError {}

function parseCfgStringValue(val: string | number | boolean) {
  let match: RegExpMatchArray | null = null;
  if (
    typeof val == 'string' &&
    (match = (val as string).match(/\$\{ENV:(.+?)\}/))
  ) {
    return val.replace(`\${ENV:${match[1]}}`, process.env[match[1]] || '');
  }
  return val;
}

function walk(
  obj: any,
  root?: any,
  key?: any,
  cb?: (root: any, key: any, val: any) => void
): void {
  if (Array.isArray(obj)) {
    obj.forEach(function (element, index) {
      walk(element, obj, index, cb);
    });
  } else if (isObject(obj)) {
    for (var property in obj) {
      if (obj.hasOwnProperty(property)) {
        walk(obj[property], obj, property, cb);
      }
    }
  } else {
    if (typeof cb == 'function') {
      cb(root, key, obj);
    }
  }
}

export function readConfigFile(cfgPath: string): Config | undefined {
  try {
    const file = readFileSync(cfgPath, 'utf-8');
    const cfg = yaml.load(file) as object;
    const parsedCfg = ConfigSchema.parse(cfg);
    walk(parsedCfg, undefined, undefined, (obj: any, key: any, val: any) => {
      obj[key] = parseCfgStringValue(val);
    });
    return parsedCfg;
  } catch (err: any) {
    if (err instanceof YAMLException) {
      throw new ConfigParseError(
        `Cannot parse config file: ${err.message}`,
        err
      );
    }
    if (err instanceof Z.ZodError) {
      throw new ConfigValidationError(
        `Config file is not valid according to schema: ${err.message}`,
        err
      );
    }
    throw new ConfigIOError(`Cannot read config file: ${err.message}`, err);
  }
}
