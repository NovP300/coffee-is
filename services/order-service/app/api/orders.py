from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal

from app.db.session import get_db
from app.models.order import Order
from app.models.order_item import OrderItem
from app.schemas.orders import OrderCreate, OrderOut
from app.integrations.menu_client import MenuClient

router = APIRouter(tags=["orders"])
menu_client = MenuClient()


@router.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    total = Decimal("0.00")
    items_to_save: list[OrderItem] = []

    for it in payload.items:
        try:
            menu_item = await menu_client.get_item(it.menu_item_id)
        except ValueError:
            raise HTTPException(status_code=404, detail=f"Menu item not found: {it.menu_item_id}")
        except Exception:
            raise HTTPException(status_code=502, detail="Menu service unavailable")

        unit_price = Decimal(str(menu_item["price"]))
        total += unit_price * it.quantity

        items_to_save.append(
            OrderItem(menu_item_id=it.menu_item_id, quantity=it.quantity, unit_price=unit_price)
        )

    order = Order(customer_id=payload.customer_id, status="PAID", total_price=total)
    db.add(order)
    db.flush()  # получаем order_id

    for oi in items_to_save:
        oi.order_id = order.order_id
        db.add(oi)

    db.commit()
    db.refresh(order)
    return order
