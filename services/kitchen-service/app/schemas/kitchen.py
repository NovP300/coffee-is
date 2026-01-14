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
