from uuid import UUID
from pydantic import BaseModel, Field


class OrderItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: int = Field(ge=1, le=50)


class OrderCreate(BaseModel):
    customer_id: UUID | None = None
    items: list[OrderItemCreate]


class OrderItemOut(BaseModel):
    menu_item_id: UUID
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    order_id: UUID
    customer_id: UUID | None = None
    status: str
    total_price: float
    items: list[OrderItemOut]

    class Config:
        from_attributes = True
