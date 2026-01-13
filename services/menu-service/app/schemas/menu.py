from pydantic import BaseModel, Field, field_validator
from uuid import UUID

ALLOWED_CATEGORIES = {"Coffee", "Tea", "Food", "Dessert", "Other"}


class MenuItemOut(BaseModel):
    menu_item_id: UUID
    name: str
    description: str | None = None
    category: str | None = None
    price: float
    image_url: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


class MenuItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=80)
    price: float = Field(ge=0)
    image_url: str | None = Field(default=None, max_length=500)
    is_active: bool = True

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str | None):
        if v is None or v == "":
            return None
        # Приведём к аккуратному виду
        v_norm = v.strip()
        if v_norm not in ALLOWED_CATEGORIES:
            raise ValueError(f"Invalid category. Allowed: {sorted(ALLOWED_CATEGORIES)}")
        return v_norm

