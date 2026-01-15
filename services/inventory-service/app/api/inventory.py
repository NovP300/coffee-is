from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.ingredient import Ingredient
from app.models.stock_item import StockItem
from app.schemas.inventory import (
    IngredientCreate,
    IngredientOut,
    StockItemOut,
    StockAddRequest,
    StockSetRequest,
)

router = APIRouter(tags=["inventory"])


@router.post("/ingredients", response_model=IngredientOut, status_code=201)
def create_ingredient(payload: IngredientCreate, db: Session = Depends(get_db)):
    # Проверяем уникальность имени (чтобы красиво отдать 409, а не 500)
    exists = db.scalar(select(Ingredient).where(Ingredient.name == payload.name))
    if exists:
        raise HTTPException(status_code=409, detail="Ingredient with this name already exists")

    ing = Ingredient(name=payload.name, unit=payload.unit)
    db.add(ing)
    db.flush()

    # Автоматически создаем stock строку
    stock = StockItem(ingredient_id=ing.ingredient_id, quantity=0, reorder_threshold=0)
    db.add(stock)

    db.commit()
    db.refresh(ing)
    return ing


@router.get("/ingredients", response_model=list[IngredientOut])
def list_ingredients(db: Session = Depends(get_db)):
    items = db.scalars(select(Ingredient).order_by(Ingredient.name.asc())).all()
    return items


@router.get("/stock", response_model=list[StockItemOut])
def list_stock(db: Session = Depends(get_db)):
    rows = db.scalars(select(StockItem).order_by(StockItem.updated_at.desc())).all()
    return rows


@router.post("/stock/{ingredient_id}/add", response_model=StockItemOut)
def add_stock(ingredient_id: UUID, payload: StockAddRequest, db: Session = Depends(get_db)):
    row = db.scalar(select(StockItem).where(StockItem.ingredient_id == ingredient_id))
    if not row:
        raise HTTPException(status_code=404, detail="Ingredient not found in stock")

    row.quantity += payload.amount
    db.commit()
    db.refresh(row)
    return row


@router.post("/stock/{ingredient_id}/set", response_model=StockItemOut)
def set_stock(ingredient_id: UUID, payload: StockSetRequest, db: Session = Depends(get_db)):
    row = db.scalar(select(StockItem).where(StockItem.ingredient_id == ingredient_id))
    if not row:
        raise HTTPException(status_code=404, detail="Ingredient not found in stock")

    row.quantity = payload.quantity
    row.reorder_threshold = payload.reorder_threshold
    db.commit()
    db.refresh(row)
    return row
