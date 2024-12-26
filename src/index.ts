import app from './app';
import { HookManager } from './hook/manager';
import { SubscriberManager } from './subscriber/manager';

import { install } from 'source-map-support';
install();

async function main() {
  // Initialize subcribers first before hook
  // Why?
  //
  const subscriberManager = SubscriberManager.getInstance(
    app.config().subscribers
  );
  await subscriberManager.init();

  // Hooks
  const hookManager = HookManager.getInstance(app.config().hooks);
  await hookManager.startup();
}

main();
