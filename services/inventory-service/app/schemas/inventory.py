from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


ALLOWED_UNITS = {"ML", "G", "PCS"}


class IngredientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    unit: str = Field(min_length=1, max_length=10)

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str):
        v_norm = v.strip().upper()
        if v_norm not in ALLOWED_UNITS:
            raise ValueError(f"Invalid unit. Allowed: {sorted(ALLOWED_UNITS)}")
        return v_norm


class IngredientOut(BaseModel):
    ingredient_id: UUID
    name: str
    unit: str

    class Config:
        from_attributes = True


class StockItemOut(BaseModel):
    ingredient_id: UUID
    quantity: int
    reorder_threshold: int
    updated_at: datetime

    class Config:
        from_attributes = True


class StockAddRequest(BaseModel):
    amount: int = Field(ge=1, le=1_000_000)


class StockSetRequest(BaseModel):
    quantity: int = Field(ge=0, le=1_000_000)
    reorder_threshold: int = Field(ge=0, le=1_000_000)
