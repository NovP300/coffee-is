from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class KitchenOrderOut(BaseModel):
    order_id: UUID
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None

    class Config:
        from_attributes = True


class KitchenQueueItemOut(BaseModel):
    order_id: UUID
    status: str
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    items: dict  # мы храним JSON, ок

    class Config:
        from_attributes = True