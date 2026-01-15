from uuid import UUID
from pydantic import BaseModel, Field, field_validator

ALLOWED_CHANNELS = {"IN_STORE", "WEB", "MOBILE", "POS"}

class OrderItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: int = Field(ge=1, le=50)


class OrderCreate(BaseModel):

    channel: str = Field(default="IN_STORE")
    items: list[OrderItemCreate]

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str):
        v_norm = v.strip().upper()
        if v_norm not in ALLOWED_CHANNELS:
            raise ValueError(f"Invalid channel. Allowed: {sorted(ALLOWED_CHANNELS)}")
        return v_norm


class OrderItemOut(BaseModel):
    menu_item_id: UUID
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    order_id: UUID
    customer_id: UUID | None = None
    channel: str
    status: str
    total_price: float
    items: list[OrderItemOut]

    class Config:
        from_attributes = True
