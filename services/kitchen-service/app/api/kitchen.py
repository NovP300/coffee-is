from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.kitchen_order import KitchenOrder
from app.schemas.kitchen import KitchenQueueItemOut
from app.schemas.kitchen import KitchenOrderOut

router = APIRouter(tags=["kitchen"])


@router.get("/orders/{order_id}", response_model=KitchenOrderOut)
def get_kitchen_order(order_id: UUID, db: Session = Depends(get_db)):
    row = db.scalar(select(KitchenOrder).where(KitchenOrder.order_id == order_id))
    if not row:
        raise HTTPException(status_code=404, detail="Kitchen order not found")
    return row


@router.post("/orders/{order_id}/start", response_model=KitchenOrderOut)
def start_order(order_id: UUID, db: Session = Depends(get_db)):
    row = db.scalar(select(KitchenOrder).where(KitchenOrder.order_id == order_id))
    if not row:
        raise HTTPException(status_code=404, detail="Kitchen order not found")

    if row.status == "DONE":
        raise HTTPException(status_code=409, detail="Order already completed")

    if row.started_at is None:
        row.started_at = datetime.now(timezone.utc).replace(tzinfo=None)  # TIMESTAMP без TZ
    row.status = "IN_PROGRESS"

    db.commit()
    db.refresh(row)
    return row


@router.post("/orders/{order_id}/complete", response_model=KitchenOrderOut)
def complete_order(order_id: UUID, db: Session = Depends(get_db)):
    row = db.scalar(select(KitchenOrder).where(KitchenOrder.order_id == order_id))
    if not row:
        raise HTTPException(status_code=404, detail="Kitchen order not found")

    if row.status == "DONE":
        raise HTTPException(status_code=409, detail="Order already completed")

    if row.started_at is None:
        # если бариста нажал "готово" сразу — стартуем автоматически
        row.started_at = datetime.now(timezone.utc).replace(tzinfo=None)
        row.status = "IN_PROGRESS"

    row.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    row.status = "DONE"

    db.commit()
    db.refresh(row)
    return row


@router.get("/orders", response_model=list[KitchenQueueItemOut])
def list_queue(
    status: list[str] = Query(default=["NEW", "IN_PROGRESS"]),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(KitchenOrder)
        .where(KitchenOrder.status.in_(status))
        .order_by(KitchenOrder.created_at.asc())
    ).all()
    return rows
