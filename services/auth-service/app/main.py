from fastapi import FastAPI

from app.core.settings import settings
from app.db.session import ping_db, engine
from app.db.base import Base
from app.models import user as _user  # noqa: F401 (нужно для регистрации модели)

from app.api.auth import router as auth_router

app = FastAPI(title=settings.service_name)

app.include_router(auth_router)



@app.on_event("startup")
def on_startup():
    ping_db()
    # Для учебного проекта можно создать таблицы автоматически
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.service_name}



