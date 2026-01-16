from prometheus_client import Counter

ORDERS_CREATED = Counter(
    "orders_created_total",
    "Total created orders",
    ["channel"],
)
