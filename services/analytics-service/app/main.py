from fastapi import FastAPI
from app.core.settings import settings
from app.db.session import engine, ping_db

import asyncio
import logging
from sqlalchemy.orm import sessionmaker, Session
from app.messaging.consumer import RabbitConsumer

from app.models import event as _event  # noqa: F401
from app.db.base import Base
from app.models.event import AnalyticsEvent 


logger = logging.getLogger("coffee")
logging.basicConfig(level=logging.INFO)


consumer = RabbitConsumer(
    amqp_url=settings.rabbitmq_url,
    queue_name="analytics.order.created",
    routing_key="order.created",
)


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

app = FastAPI(title=settings.service_name)

async def handle(payload: dict):
    
    order_id = payload.get("order_id")
    event_type = payload.get("event_type", "OrderCreated")

    db: Session = SessionLocal()
    try:
        ev = AnalyticsEvent(
            event_type=event_type,
            entity_id=str(order_id),
            source="rabbitmq",
            payload=payload,
        )
        db.add(ev)
        db.commit()
        logger.info("ANALYTICS stored event=%s order_id=%s", event_type, order_id)
    except Exception:
        db.rollback()
        logger.exception("ANALYTICS failed to store event")
        raise
    finally:
        db.close()


@app.on_event("startup")
async def on_startup():
    Base.metadata.create_all(bind=engine)

    # Проверяем, что БД доступна (упадёт сразу, если DATABASE_URL неверный)
    ping_db()

    logger.info("ANALYTICS consumer starting...")
    asyncio.create_task(consumer.connect_and_consume(handle))


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.service_name}
