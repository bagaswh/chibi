import { RabbitMQClient } from './../../event-store/client/rabbitmq';
import { RabbitMQEventPublishAction } from './rabbitmq';
import { ActionEventStorePublishParams, ActionConfig } from './../../config';
import eventStoreManager from '../../event-store/manager';
import { ChibiError } from '../../error';

export class EventPublishActionFactory {
  public static create(
    cfg: ActionConfig<ActionEventStorePublishParams>,
    vars: any
  ) {
    const client = eventStoreManager.getClient(cfg.params.to);
    if (!client) {
      throw new ChibiError(`Event store client ${cfg.params.to} not found`);
    }
    switch (client.cfg.type) {
      case 'rabbitmq':
        return new RabbitMQEventPublishAction(
          cfg,
          client.client as RabbitMQClient,
          vars
        );
    }
  }
}
