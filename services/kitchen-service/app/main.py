from fastapi import FastAPI
from app.core.settings import settings
from app.db.session import create_db_engine, ping_db

engine = create_db_engine(settings.database_url)

app = FastAPI(title=settings.service_name)


@app.on_event("startup")
def on_startup():
    # Проверяем, что БД доступна (упадёт сразу, если DATABASE_URL неверный)
    ping_db(engine)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.service_name}
