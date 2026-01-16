from fastapi import FastAPI
from app.core.settings import settings
from app.db.session import engine, ping_db

from app.db.base import Base
import asyncio
from app.messaging.consumer import RabbitConsumer

from app.models import inventory_movement as _inventory_movement  # noqa: F401
from app.models import ingredient as _ingredient  # noqa: F401
from app.models import stock_item as _stock_item  # noqa: F401
from app.api.inventory import router as inventory_router



import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.stock_item import StockItem
from app.models.inventory_movement import InventoryMovement





app = FastAPI(title=settings.service_name)


app.include_router(inventory_router)

consumer = RabbitConsumer(
    amqp_url=settings.rabbitmq_url,
    queue_name="inventory.order.created",
    routing_key="order.created",
)


logger = logging.getLogger("coffee")
logging.basicConfig(level=logging.INFO)


async def handle(payload: dict):
    order_id = payload.get("order_id")
    ingredients = payload.get("ingredients", [])

    if not order_id:
        logger.warning("INVENTORY event without order_id: %s", payload)
        return

    if not ingredients:
        logger.info("INVENTORY no ingredients to deduct for order_id=%s", order_id)
        return

    db: Session = SessionLocal()
    try:
        movements_created = 0
        warnings = 0

        for ing in ingredients:
            ing_id = UUID(str(ing["ingredient_id"]))
            need_qty = int(ing["quantity"])

            stock = db.scalar(select(StockItem).where(StockItem.ingredient_id == ing_id))
            if not stock:
                warnings += 1
                logger.warning("INVENTORY unknown ingredient_id=%s (order_id=%s)", ing_id, order_id)
                continue

            if stock.quantity < need_qty:
                warnings += 1
                logger.warning(
                    "INVENTORY insufficient stock ingredient_id=%s have=%s need=%s (order_id=%s)",
                    ing_id, stock.quantity, need_qty, order_id
                )
                # MVP-решение: не списываем, чтобы не уходить в минус
                continue

            # списание
            stock.quantity -= need_qty

            # движение
            db.add(
                InventoryMovement(
                    ingredient_id=ing_id,
                    quantity=need_qty,
                    movement_type="OUT",
                    order_id=UUID(str(order_id)),
                )
            )
            movements_created += 1

        db.commit()
        logger.info(
            "INVENTORY processed order_id=%s movements=%s warnings=%s",
            order_id, movements_created, warnings
        )

    except Exception:
        db.rollback()
        logger.exception("INVENTORY failed to process order")
        raise
    finally:
        db.close()


@app.on_event("startup")
async def on_startup():
    # Проверяем, что БД доступна (упадёт сразу, если DATABASE_URL неверный)
    ping_db()
    Base.metadata.create_all(bind=engine)

    print("INVENTORY consumer starting...")
    asyncio.create_task(consumer.connect_and_consume(handle))


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.service_name}



import time
from fastapi import Response, Request
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["service", "method", "path", "status"],
)

REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency (seconds)",
    ["service", "path"],
)

@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start

    path = request.url.path  # можно позже нормализовать
    REQUEST_COUNT.labels(
        service=settings.service_name,
        method=request.method,
        path=path,
        status=str(response.status_code),
    ).inc()

    REQUEST_LATENCY.labels(
        service=settings.service_name,
        path=path,
    ).observe(duration)

    return response

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
