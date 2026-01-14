import json
import aio_pika
from aio_pika import ExchangeType

EXCHANGE_NAME = "coffee.events"


class RabbitConsumer:
    def __init__(self, amqp_url: str, queue_name: str, routing_key: str):
        self.amqp_url = amqp_url
        self.queue_name = queue_name
        self.routing_key = routing_key

        self.connection: aio_pika.RobustConnection | None = None
        self.channel: aio_pika.RobustChannel | None = None

    async def connect_and_consume(self, handler):
        self.connection = await aio_pika.connect_robust(self.amqp_url)
        self.channel = await self.connection.channel()
        exchange = await self.channel.declare_exchange(
            EXCHANGE_NAME, ExchangeType.TOPIC, durable=True
        )

        queue = await self.channel.declare_queue(self.queue_name, durable=True)
        await queue.bind(exchange, routing_key=self.routing_key)

        async with queue.iterator() as qiter:
            async for message in qiter:
                async with message.process(requeue=True):
                    payload = json.loads(message.body.decode("utf-8"))
                    await handler(payload)

    async def close(self):
        if self.connection:
            await self.connection.close()
