from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from collections import defaultdict

from app.db.session import get_db
from app.models.order import Order
from app.models.order_item import OrderItem
from app.schemas.orders import OrderCreate, OrderOut
from app.integrations.menu_client import MenuClient

from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import selectinload

router = APIRouter(tags=["orders"])
menu_client = MenuClient()

from fastapi import Request

@router.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(payload: OrderCreate, request: Request, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    total = Decimal("0.00")
    items_to_save: list[OrderItem] = []
    ingredients_totals: dict[str, int] = defaultdict(int)


    for it in payload.items:
        try:
            menu_item = await menu_client.get_item(it.menu_item_id)
            
        except ValueError:
            raise HTTPException(status_code=404, detail=f"Menu item not found: {it.menu_item_id}")
        except Exception:
            raise HTTPException(status_code=502, detail="Menu service unavailable")
        
        try:
            recipe = await menu_client.get_recipe(it.menu_item_id)
        except ValueError:
            recipe = []  # нет рецепта — списаний не будет
        except Exception:
            raise HTTPException(status_code=502, detail="Menu service unavailable")
        
        for r in recipe:
            ing_id = str(r["ingredient_id"])
            per_one_qty = int(r["quantity"])
            ingredients_totals[ing_id] += per_one_qty * it.quantity

        unit_price = Decimal(str(menu_item["price"]))
        total += unit_price * it.quantity

        items_to_save.append(
            OrderItem(menu_item_id=it.menu_item_id, quantity=it.quantity, unit_price=unit_price)
        )

    order = Order(
    customer_id=payload.customer_id,
    channel=payload.channel,
    status="PAID",
    total_price=total,
    )
    db.add(order)
    db.flush()  # получаем order_id

    for oi in items_to_save:
        oi.order_id = order.order_id
        db.add(oi)

    db.commit()
    db.refresh(order)

    event = {
    "event_type": "OrderCreated",
    "order_id": str(order.order_id),
    "customer_id": str(order.customer_id) if order.customer_id else None,
    "channel": order.channel,
    "status": order.status,
    "total_price": float(order.total_price),
    "items": [
        {
            "menu_item_id": str(i.menu_item_id),
            "quantity": i.quantity,
            "unit_price": float(i.unit_price),
        }
        for i in order.items
    ],
    "ingredients" : [ 
        {
        "ingredient_id": ing_id, 
        "quantity": qty
        }
        for ing_id, qty in ingredients_totals.items()
    ]

    }

    print("ORDER publish order.created:", event["order_id"]) #проверка до
    await request.app.state.publisher.publish("order.created", event)
    print("ORDER published OK:", event["order_id"]) # проверка после

    return order


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: UUID, db: Session = Depends(get_db)):
    stmt = (
        select(Order)
        .where(Order.order_id == order_id)
        .options(selectinload(Order.items))
    )
    order = db.scalar(stmt)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/orders", response_model=list[OrderOut])
def list_orders(
    db: Session = Depends(get_db),
    customer_id: UUID | None = None,
    include_guest: bool = True,
    limit: int = 50,
):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")

    stmt = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())

    if customer_id is not None:
        stmt = stmt.where(Order.customer_id == customer_id)
    else:
        # если customer_id не задан, можно решать: показывать ли guest-заказы
        if not include_guest:
            stmt = stmt.where(Order.customer_id.is_not(None))

    orders = db.scalars(stmt.limit(limit)).all()
    return orders
