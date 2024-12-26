import { RabbitMQClient } from './rabbitmq';
import { EventStoreConfig } from '../../config';
import { EventStoreClient, NoopEventStoreClient } from './client';

export class EventStoreClientFactory<T> {
  public static create(cfg: EventStoreConfig): EventStoreClient {
    if (cfg.type == 'rabbitmq') {
      const rabbitmqCfg = cfg.rabbitmq;
      return new RabbitMQClient(rabbitmqCfg);
    }

    return new NoopEventStoreClient();
  }
}
