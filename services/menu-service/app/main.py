from fastapi import FastAPI

from app.core.settings import settings
from app.db.session import ping_db, engine
from app.db.base import Base
from app.models import menu_item as _menu_item  # noqa: F401
from app.models import recipe_item as _recipe_item  # noqa: F401


from app.api.menu import router as menu_router
from app.api.recipe import router as recipe_router


app = FastAPI(title=settings.service_name)

app.include_router(recipe_router)
app.include_router(menu_router)




@app.on_event("startup")
def on_startup():
    ping_db()
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.service_name}



