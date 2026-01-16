from fastapi import FastAPI

from app.core.settings import settings
from app.db.session import ping_db, engine
from app.db.base import Base
from app.models import order as _order  # noqa: F401
from app.models import order_item as _order_item  # noqa: F401
from app.messaging.rabbit import RabbitPublisher





from app.api.orders import router as orders_router

app = FastAPI(title=settings.service_name)

app.include_router(orders_router)





@app.on_event("startup")
async def on_startup():
    ping_db()
    Base.metadata.create_all(bind=engine)

    app.state.publisher = RabbitPublisher(settings.rabbitmq_url)
    await app.state.publisher.connect()


@app.on_event("shutdown")
async def on_shutdown():
    await app.state.publisher.close()


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
