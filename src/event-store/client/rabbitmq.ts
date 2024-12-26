import {
  RabbitMQClientConfig,
  ActionRabbitMQEventStorePublishParams,
  ActionRabbitMQQueueConfig,
  ActionRabbitMQExchangeConfig,
} from './../../config';
import { ClientInitError } from './error';
import { createLogger } from '../../logger';
import amqp from 'amqplib';
import {
  EventStoreClient,
  EventStoreClientSubscribeCallback,
  QueryResult,
} from './client';
import { Logger } from 'winston';
import app from '../../app';

export class RabbitMQClientError extends ClientInitError {}
export class RabbitMQClientInitError extends RabbitMQClientError {}

export type RabbitMQClientOptions = ActionRabbitMQEventStorePublishParams;

export class RabbitMQClient
  implements EventStoreClient<RabbitMQClientOptions, RabbitMQClientOptions>
{
  private conn: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private logger: Logger;

  constructor(private readonly cfg: RabbitMQClientConfig) {
    this.logger = createLogger(
      `rabbitmq-event-store:${cfg.hostname}:${cfg.vhost || '/'}`,
      app.getLogLevel()
    );
  }

  async init() {
    if (!this.channel) {
      try {
        this.logger.info(
          `Connecting to RabbitMQ at ${this.cfg.hostname}:${this.cfg.port} `
        );
        this.conn = await amqp.connect(this.cfg);
        this.logger.info(`Creating channel`);
        this.channel = await this.conn.createChannel();

        this.channel.on('error', (reason) => {
          this.logger.error(`Channel error: ${reason}`);
        });
        this.channel.connection.on('error', (reason) => {
          this.logger.error(`Connection error: ${reason}`);
        });
      } catch (err: any) {
        throw new RabbitMQClientInitError(
          `Failed connecting to RabbitMQ host: ${err.message}`,
          err
        );
      }
    } else {
      this.logger.info('Channel is already established');
    }
  }

  async destroy(): Promise<void> {
    if (this.channel) {
      return this.channel.connection.close();
    }
    return Promise.resolve();
  }

  private async setupExchangeOrQueue(opts: RabbitMQClientOptions) {
    if (!this.channel) {
      throw new Error(
        'Channel has not been initialized or failed to initialize during init call'
      );
    }

    let exchangeName;
    if (opts.exchange && opts.exchange.name && opts.exchange.assert) {
      const exchange = opts.exchange.name;
      this.logger.info(
        `Asserting exchange ${exchange}. This will create the exchange if not exists.`
      );
      exchangeName = (
        await this.channel.assertExchange(exchange, opts.exchange.type)
      ).exchange;
    }

    const queueName =
      opts.queue?.exclusive || !opts.queue?.name ? '' : opts.queue?.name;
    this.logger.info(`Checking queue existence ${queueName}`);
    if (opts.queue?.assert || opts.queue?.exclusive) {
      this.logger.info(
        `Asserting queue ${queueName}${
          opts.queue.exclusive ? " since it's an exclusive queue" : ''
        }. This will create the queue if not exists.`
      );
      await this.channel.assertQueue(queueName, {
        exclusive: opts.queue.exclusive,
      });
      let exchange;
      if ((exchange = opts.queue.bind_to_exchange)) {
        this.logger.info(`Binding queue ${queueName} to exchange ${exchange}.`);
        await this.channel.bindQueue(queueName, exchange, '');
      }
    }

    return { queue: queueName, exchange: exchangeName };
  }

  async publish(opts: RabbitMQClientOptions): Promise<boolean> {
    if (!opts.exchange && !opts.queue) {
      throw new TypeError('Provide either exchange or queue');
    }

    try {
      await this.setupExchangeOrQueue(opts);
    } catch (err: any) {
      throw new RabbitMQClientError(
        `Failed setting up exchange or queue: ${err.message}`,
        err
      );
    }

    const target = (opts.exchange?.name || opts.queue?.name) as string;
    const routingKey = (opts.routing_key || '') as string;
    let queueOrExchange = opts.exchange?.name ? 'exchange' : 'queue';

    let encodedPayload = Buffer.from('');
    switch (typeof opts.payload) {
      case 'object':
        encodedPayload = Buffer.from(JSON.stringify(opts.payload));
        break;
      case 'string':
      case 'number':
        encodedPayload = Buffer.from(opts.payload.toString());
        break;
      default:
        throw new TypeError(
          'Payload should be string or any type that can be encoded to string (object, number, bigint)'
        );
    }

    const channel = this.channel as amqp.Channel;

    this.logger.debug(`Payload: ${opts.payload}`);

    if (queueOrExchange == 'exchange') {
      this.logger.info(`Sending to exchange ${target}`);
      channel.publish(target, routingKey, encodedPayload);
    } else if (queueOrExchange == 'queue') {
      this.logger.info(`Sending to queue ${target}`);
      channel.sendToQueue(target, encodedPayload);
    }
    return true;
  }

  async subscribe(
    opts: RabbitMQClientOptions,
    callback: EventStoreClientSubscribeCallback
  ) {
    try {
      await this.setupExchangeOrQueue(opts);
    } catch (err: any) {
      throw new RabbitMQClientError(
        `Failed setting up exchange or queue: ${err.message}`,
        err
      );
    }

    const channel = this.channel as amqp.Channel;
    const queue = opts.queue as ActionRabbitMQQueueConfig;

    let qName = queue.name;
    if (queue.exclusive && !qName) {
      qName = '';
    }

    if (qName === undefined) {
      throw new RabbitMQClientError(`Queue name cannot be undefined`);
    }

    channel.consume(qName, (msg) => {
      channel.ackAll();
      callback({ payload: msg });
    });
  }
}
