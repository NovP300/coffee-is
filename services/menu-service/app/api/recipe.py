from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.menu_item import MenuItem
from app.models.recipe_item import RecipeItem
from app.schemas.recipe import RecipeItemIn, RecipeItemOut

router = APIRouter(tags=["recipe"])


@router.get("/items/{menu_item_id}/recipe", response_model=list[RecipeItemOut])
def get_recipe(menu_item_id: UUID, db: Session = Depends(get_db)):
    # проверим, что item существует
    item = db.scalar(select(MenuItem).where(MenuItem.menu_item_id == menu_item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    rows = db.scalars(select(RecipeItem).where(RecipeItem.menu_item_id == menu_item_id)).all()
    return rows


@router.put("/items/{menu_item_id}/recipe", response_model=list[RecipeItemOut])
def set_recipe(menu_item_id: UUID, payload: list[RecipeItemIn], db: Session = Depends(get_db)):
    item = db.scalar(select(MenuItem).where(MenuItem.menu_item_id == menu_item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    # перезаписываем рецепт целиком
    db.execute(delete(RecipeItem).where(RecipeItem.menu_item_id == menu_item_id))
    for r in payload:
        db.add(
            RecipeItem(
                menu_item_id=menu_item_id,
                ingredient_id=r.ingredient_id,
                quantity=r.quantity,
            )
        )

    db.commit()

    rows = db.scalars(select(RecipeItem).where(RecipeItem.menu_item_id == menu_item_id)).all()
    return rows
