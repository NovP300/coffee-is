from fastapi import FastAPI

from app.core.settings import settings
from app.db.session import ping_db, engine
from app.db.base import Base
from app.models import order as _order  # noqa: F401
from app.models import order_item as _order_item  # noqa: F401
from app.messaging.rabbit import RabbitPublisher


from app.api.orders import router as orders_router

app = FastAPI(title=settings.service_name)



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


app.include_router(orders_router)
