from fastapi import FastAPI
from app.core.settings import settings
from app.db.session import create_db_engine, ping_db

import asyncio
from app.messaging.consumer import RabbitConsumer

engine = create_db_engine(settings.database_url)

app = FastAPI(title=settings.service_name)

consumer = RabbitConsumer(
    amqp_url=settings.rabbitmq_url,
    queue_name="inventory.order.created",
    routing_key="order.created",
)

async def handle(payload: dict):
    print("INVENTORY received:", payload["order_id"])


@app.on_event("startup")
async def on_startup():
    # Проверяем, что БД доступна (упадёт сразу, если DATABASE_URL неверный)
    ping_db(engine)

    print("INVENTORY consumer starting...")
    asyncio.create_task(consumer.connect_and_consume(handle))


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.service_name}
