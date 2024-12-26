import { RabbitMQClient } from './../../event-store/client/rabbitmq';
import {
  ActionConfig,
  ActionEventStorePublishParams,
  ActionRabbitMQEventStorePublishParams,
} from './../../config';
import { Action } from '../action';

export class RabbitMQEventPublishAction implements Action {
  constructor(
    private readonly cfg: ActionConfig<ActionEventStorePublishParams>,
    private readonly client: RabbitMQClient,
    private readonly vars: any
  ) {}

  async execute() {
    const cfg = this.cfg;
    const params = cfg.params.params;
    await this.client.init();
    return this.client.publish(params);
  }
}
