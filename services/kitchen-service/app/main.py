from fastapi import FastAPI
from app.core.settings import settings
from app.db.session import engine, ping_db
import asyncio
from app.messaging.consumer import RabbitConsumer

from app.db.base import Base
from app.models import kitchen_order as _kitchen_order

from uuid import UUID
import logging
from sqlalchemy.orm import Session

from app.db.session import SessionLocal  # если у тебя так называется фабрика сессий
from app.models.kitchen_order import KitchenOrder
from app.api.kitchen import router as kitchen_router



app = FastAPI(title=settings.service_name)



app.include_router(kitchen_router)


consumer = RabbitConsumer(
    amqp_url=settings.rabbitmq_url,
    queue_name="kitchen.order.created",
    routing_key="order.created",
)

logger = logging.getLogger("coffee")
logging.basicConfig(level=logging.INFO)


async def handle(payload: dict):
    order_id = payload.get("order_id")
    items = payload.get("items", [])
    if not order_id:
        logger.warning("KITCHEN got event without order_id: %s", payload)
        return

    db: Session = SessionLocal()
    try:
        row = KitchenOrder(
            order_id=UUID(str(order_id)),
            status="NEW",
            items={"items": items, "channel": payload.get("channel")},
        )
        db.add(row)
        db.commit()
        logger.info("KITCHEN queued order_id=%s items=%s", order_id, len(items))
    except Exception:
        db.rollback()
        logger.exception("KITCHEN failed to store kitchen order")
        raise
    finally:
        db.close()

@app.on_event("startup")
async def on_startup():

    Base.metadata.create_all(bind=engine)
    # Проверяем, что БД доступна (упадёт сразу, если DATABASE_URL неверный)
    ping_db()

    print("KITCHEN consumer starting...")
    asyncio.create_task(consumer.connect_and_consume(handle))


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.service_name}


