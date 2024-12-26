const amqp = require('amqplib');

async function consumeFromQueue() {
  try {
    // Establish a connection to the RabbitMQ server
    const connection = await amqp.connect('amqp://localhost');

    // Create a channel
    const channel = await connection.createChannel();

    // Declare the fanout exchange
    const exchangeName = 'vmss-application-prod-southeastasia.new-vm-start';
    await channel.assertExchange(exchangeName, 'fanout');

    // Declare an exclusive queue
    const queue = await channel.assertQueue('', { exclusive: true });

    // Bind the queue to the exchange
    await channel.bindQueue(queue.queue, exchangeName, '');

    console.log('Waiting for messages...');

    // Consume messages from the queue
    channel.consume(queue.queue, (msg) => {
      const message = msg.content.toString();
      console.log('Received message:', message);

      // Acknowledge the message
      channel.ack(msg);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

consumeFromQueue();
