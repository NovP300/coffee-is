from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.menu_item import MenuItem
from app.schemas.menu import MenuItemOut, MenuItemCreate

router = APIRouter(tags=["menu"])


@router.get("/items", response_model=list[MenuItemOut])
def list_menu_items(db: Session = Depends(get_db), active_only: bool = True):
    stmt = select(MenuItem)
    if active_only:
        stmt = stmt.where(MenuItem.is_active == True)  # noqa: E712
    stmt = stmt.order_by(MenuItem.category.asc().nulls_last(), MenuItem.name.asc())
    rows = db.scalars(stmt).all()
    return rows


# маленький эндпоинт наполнения меню
@router.post("/items", response_model=MenuItemOut, status_code=201)
def create_menu_item(payload: MenuItemCreate, db: Session = Depends(get_db)):
    item = MenuItem(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        price=payload.price,
        image_url=payload.image_url,
        is_active=payload.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
