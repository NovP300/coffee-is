from uuid import UUID
from pydantic import BaseModel, Field


class RecipeItemIn(BaseModel):
    ingredient_id: UUID
    quantity: int = Field(ge=1, le=1_000_000)


class RecipeItemOut(BaseModel):
    ingredient_id: UUID
    quantity: int

    class Config:
        from_attributes = True
