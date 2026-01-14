import json
from typing import Any

import aio_pika
from aio_pika import ExchangeType

EXCHANGE_NAME = "coffee.events"


class RabbitPublisher:
    def __init__(self, amqp_url: str):
        self.amqp_url = amqp_url
        self.connection: aio_pika.RobustConnection | None = None
        self.channel: aio_pika.RobustChannel | None = None
        self.exchange: aio_pika.Exchange | None = None

    async def connect(self) -> None:
        self.connection = await aio_pika.connect_robust(self.amqp_url)
        self.channel = await self.connection.channel()
        self.exchange = await self.channel.declare_exchange(
            EXCHANGE_NAME, ExchangeType.TOPIC, durable=True
        )

    async def close(self) -> None:
        if self.connection:
            await self.connection.close()

    async def publish(self, routing_key: str, payload: dict[str, Any]) -> None:
        if not self.exchange:
            raise RuntimeError("RabbitPublisher not connected")

        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        msg = aio_pika.Message(
            body=body,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await self.exchange.publish(msg, routing_key=routing_key)
