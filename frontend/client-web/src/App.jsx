import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:8080/api";

async function apiJson(path, options = {}, token = null) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : null;
}

function statusRu(kitchenStatus) {
    // Приводим кухонные статусы к тем, что тебе нужны в UI
    // NEW -> "Создан (ожидает принятия)"
    // IN_PROGRESS -> "Готовится"
    // COMPLETED -> "Готов к выдаче"
    if (!kitchenStatus) return "—";
    const s = String(kitchenStatus).toUpperCase();
    if (s === "NEW") return "Создан (ожидает принятия)";
    if (s === "IN_PROGRESS") return "Готовится";
    if (s === "COMPLETED" || s === "DONE" || s === "READY") return "Готов к выдаче";
    return kitchenStatus; // fallback
}

export default function App() {
    /* ===================== AUTH ===================== */
    const [token, setToken] = useState(localStorage.getItem("token") || "");
    const [me, setMe] = useState(localStorage.getItem("username") || "");
    const [authMode, setAuthMode] = useState("login"); // login | register

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    /* ===================== UI ===================== */
    const [tab, setTab] = useState(token ? "menu" : "auth");
    const [error, setError] = useState("");

    /* ===================== MENU ===================== */
    const [menu, setMenu] = useState([]);
    const [loadingMenu, setLoadingMenu] = useState(false);
    const [menuMap, setMenuMap] = useState({}); // menu_item_id -> name

    /* ===================== CART ===================== */
    const [cart, setCart] = useState({}); // menu_item_id -> quantity

    /* ===================== ORDERS ===================== */
    const [myOrders, setMyOrders] = useState([]); // enriched (order + kitchen)
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [autoRefreshOrders, setAutoRefreshOrders] = useState(true);

    /* ===================== ORDERS API PATH (fixed) ===================== */
    const ORDERS_BASE = "/orders/orders";

    /* ===================== CART HELPERS ===================== */
    const cartItems = useMemo(() => {
        const map = new Map(menu.map((m) => [m.menu_item_id, m]));
        return Object.entries(cart)
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => ({ item: map.get(id), menu_item_id: id, quantity: qty }))
            .filter((x) => x.item);
    }, [cart, menu]);

    const totalPrice = useMemo(() => {
        return cartItems.reduce((sum, x) => sum + Number(x.item.price) * x.quantity, 0);
    }, [cartItems]);

    function addToCart(menuItemId) {
        setCart((prev) => ({ ...prev, [menuItemId]: (prev[menuItemId] || 0) + 1 }));
    }
    function removeFromCart(menuItemId) {
        setCart((prev) => {
            const cur = prev[menuItemId] || 0;
            const next = Math.max(0, cur - 1);
            return { ...prev, [menuItemId]: next };
        });
    }
    function clearCart() {
        setCart({});
    }

    /* ===================== AUTH API ===================== */
    async function register() {
        setError("");
        try {
            await apiJson(
                "/auth/register",
                {
                    method: "POST",
                    body: JSON.stringify({
                        username,
                        password,
                        role: "CUSTOMER",
                    }),
                },
                null
            );
            // после регистрации — переключаем на логин
            setAuthMode("login");
        } catch (e) {
            setError(e.message);
        }
    }

    async function login() {
        setError("");
        try {
            const data = await apiJson(
                "/auth/login",
                {
                    method: "POST",
                    body: JSON.stringify({ username, password }),
                },
                null
            );

            const t = data?.access_token || data?.token;
            if (!t) throw new Error("Не удалось получить токен из ответа");

            setToken(t);
            localStorage.setItem("token", t);

            setMe(username);
            localStorage.setItem("username", username);

            setTab("menu");
        } catch (e) {
            setError(e.message);
        }
    }

    function logout() {
        setToken("");
        setMe("");
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        setTab("auth");
        setCart({});
        setMyOrders([]);
    }

    /* ===================== MENU API ===================== */
    async function loadMenu() {
        setLoadingMenu(true);
        setError("");
        try {
            const data = await apiJson("/menu/items", {}, token);
            setMenu(data);

            const map = {};
            data.forEach((m) => {
                map[m.menu_item_id] = m.name;
            });
            setMenuMap(map);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoadingMenu(false);
        }
    }

    /* ===================== ORDERS (guest-style storage) ===================== */

    

    async function createOrder() {
        setError("");
        if (cartItems.length === 0) return setError("Корзина пустая");

        const payload = {
           
            channel: "WEB",
            items: cartItems.map((x) => ({
                menu_item_id: x.menu_item_id,
                quantity: x.quantity,
            })),
        };

        try {
            const data = await apiJson(
                `${ORDERS_BASE}`,
                {
                    method: "POST",
                    body: JSON.stringify(payload),
                },
                token
            );

            

            clearCart();
            setTab("orders");
            await loadMyOrders();
        } catch (e) {
            setError(e.message);
        }
    }

    async function fetchOrder(orderId) {
        return apiJson(`${ORDERS_BASE}/${orderId}`, {}, token);
    }

    async function fetchKitchenStatus(orderId) {
        // Здесь тянем статус именно из kitchen-service
        // Если эндпоинт отличается — скажи, поправим в одном месте.
        return apiJson(`/kitchen/orders/${orderId}`, {}, token);
    }

    async function loadMyOrders() {
        setLoadingOrders(true);
        setError("");
        try {
            // 1) Берём список заказов текущего пользователя из order-service
            // ВАЖНО: путь должен соответствовать твоему nginx:
            // /api/orders/ -> order-service
            // поэтому тут именно "/orders/orders/my"
            const orders = await apiJson("/orders/orders/me", {}, token);

            const results = [];

            // 2) Для каждого заказа подтягиваем кухонный статус
            for (const order of (orders || []).slice(0, 20)) {
                const id = order.order_id;

                let kitchen = null;
                try {
                    kitchen = await fetchKitchenStatus(id);
                } catch (_) {
                    kitchen = null;
                }

                results.push({
                    order_id: id,
                    paid_status: order.status, // PAID — как статус оплаты
                    total_price: order.total_price,
                    channel: order.channel,
                    items: order.items || [],
                    kitchen_status: kitchen?.status || null,
                    started_at: kitchen?.started_at || null,
                    completed_at: kitchen?.completed_at || null,
                });
            }

            setMyOrders(results);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoadingOrders(false);
        }
    }


    /* ===================== EFFECTS ===================== */
    useEffect(() => {
        if (token) loadMenu();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        if (tab === "orders" && token) loadMyOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, token]);

    useEffect(() => {
        if (tab !== "orders" || !autoRefreshOrders || !token) return;
        const id = setInterval(loadMyOrders, 7000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, autoRefreshOrders, token]);



   



    /* ===================== STYLES ===================== */

    const styles = {
        app: {
            minHeight: "100vh",
            background: "#f3f4f6",
            fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            color: "#111827",
            width: "100vw", 


            display: "flex",
            justifyContent: "center",
            alignItems: "center",
        },
        container: {
            width: "100%",
            maxWidth: 980,
            margin: "0 auto",
            padding: "16px",
            
        },
        header: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
            gap: 12,
        },
        title: {
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 0.3,
        },
        subtitle: {
            fontSize: 13,
            color: "#6b7280",
        },
        userBlock: {
            marginLeft: "auto",
            fontSize: 13,
            color: "#6b7280",
        },
        card: {
            background: "#ffffff",
            borderRadius: 16,
            padding: 18,
            boxShadow:
                "0 10px 25px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.1)",
            border: "1px solid #e5e7eb",
        },
        tabsRow: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
            flexWrap: "wrap",
        },
        tabs: {
            display: "inline-flex",
            background: "#e5e7eb",
            borderRadius: 999,
            padding: 4,
            gap: 4,
        },
        tabButton: (active) => ({
            border: "none",
            outline: "none",
            padding: "7px 16px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            background: active ? "#111827" : "transparent",
            color: active ? "#f9fafb" : "#4b5563",
            transition: "all 0.15s ease-in-out",
            boxShadow: active ? "0 6px 14px rgba(15,23,42,0.25)" : "none",
        }),
        linkButton: {
            borderRadius: 999,
            border: "none",
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            background: "#111827",
            color: "#f9fafb",
        },
        ghostButton: {
            borderRadius: 999,
            border: "1px solid #d1d5db",
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            background: "white",
            color: "#374151",
        },
        primaryButton: {
            borderRadius: 999,
            border: "none",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            background:
                "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)",
            color: "#f9fafb",
            boxShadow: "0 8px 18px rgba(79, 70, 229, 0.45)",
        },
        alertError: {
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 13,
            whiteSpace: "pre-wrap",
        },
        authCard: {
            marginTop: 12,
            maxWidth: 420,
        },
        authTabs: {
            display: "inline-flex",
            background: "#e5e7eb",
            borderRadius: 999,
            padding: 4,
            gap: 4,
            marginBottom: 12,
        },
        label: {
            display: "block",
            fontSize: 13,
            color: "#374151",
            marginBottom: 4,
        },
        input: {
            width: "100%",
            padding: "7px 10px",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            outline: "none",
            fontSize: 14,
            background: "#f9fafb",
        },
        gridMenu: {
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 14,
            marginTop: 12,
        },
        menuToolbar: {
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 10,
        },
        menuCard: {
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            background: "#f9fafb",
        },
        menuHeaderRow: {
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "center",
        },
        menuPrice: {
            fontWeight: 600,
            fontSize: 14,
            color: "#4b5563",
        },
        thumbImage: {
            width: "100%",
            maxWidth: 260,
            borderRadius: 10,
            marginTop: 8,
            objectFit: "cover",
        },
        quantityText: {
            marginLeft: "auto",
            fontSize: 13,
            color: "#4b5563",
        },
        cartCard: {
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            background: "#ffffff",
            height: "fit-content",
        },
        cartItemRow: {
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
        },
        ordersToolbar: {
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 10,
            flexWrap: "wrap",
        },
        checkboxLabel: {
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontSize: 13,
            color: "#4b5563",
        },
        checkbox: {
            width: 14,
            height: 14,
            accentColor: "#4f46e5",
        },
        ordersList: {
            display: "grid",
            gap: 10,
        },
        orderCard: {
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            background: "#f9fafb",
        },
        orderHeaderRow: {
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
        },
        badge: (color) => ({
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.04,
            ...(color === "green" && {
                background: "rgba(16, 185, 129, 0.12)",
                color: "#047857",
            }),
            ...(color === "yellow" && {
                background: "rgba(234, 179, 8, 0.18)",
                color: "#92400e",
            }),
            ...(color === "gray" && {
                background: "rgba(156, 163, 175, 0.18)",
                color: "#374151",
            }),
        }),
    };

    /* ===================== UI ===================== */
    return (
        <div style={styles.app}>
            <div style={styles.container}>
                <div style={styles.header}>
                    <div>
                        <div style={styles.title}>Клиентское приложение</div>
                        <div style={styles.subtitle}>
                            Заказ напитков, корзина и отслеживание статуса
                        </div>
                    </div>
                    {token && (
                        <div style={styles.userBlock}>
                            Добро пожаловать, <strong>{me || "пользователь"}</strong>
                        </div>
                    )}
                </div>

                <div style={styles.card}>
                    <div style={styles.tabsRow}>
                        {token ? (
                            <>
                                <div style={styles.tabs}>
                                    <button
                                        style={styles.tabButton(tab === "menu")}
                                        onClick={() => setTab("menu")}
                                    >
                                        Меню
                                    </button>
                                    <button
                                        style={styles.tabButton(tab === "orders")}
                                        onClick={() => setTab("orders")}
                                    >
                                        Мои заказы
                                    </button>
                                </div>
                                <button
                                    style={{ ...styles.ghostButton, marginLeft: "auto" }}
                                    onClick={logout}
                                >
                                    Выйти
                                </button>
                            </>
                        ) : (
                            <div style={styles.tabs}>
                                <button style={styles.tabButton(true)} disabled>
                                    Вход
                                </button>
                            </div>
                        )}
                    </div>

                    {error && <div style={styles.alertError}>{error}</div>}

                    {/* AUTH */}
                    {tab === "auth" && !token && (
                        <div style={{ ...styles.card, ...styles.authCard, boxShadow: "none" }}>
                            <div style={styles.authTabs}>
                                <button
                                    style={styles.tabButton(authMode === "login")}
                                    onClick={() => setAuthMode("login")}
                                >
                                    Вход
                                </button>
                                <button
                                    style={styles.tabButton(authMode === "register")}
                                    onClick={() => setAuthMode("register")}
                                >
                                    Регистрация
                                </button>
                            </div>

                            <div style={{ display: "grid", gap: 10 }}>
                                <label>
                                    <span style={styles.label}>Логин</span>
                                    <input
                                        style={styles.input}
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </label>
                                <label>
                                    <span style={styles.label}>Пароль</span>
                                    <input
                                        type="password"
                                        style={styles.input}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </label>

                                {authMode === "login" ? (
                                    <button style={styles.primaryButton} onClick={login}>
                                        Войти
                                    </button>
                                ) : (
                                    <button style={styles.primaryButton} onClick={register}>
                                        Зарегистрироваться
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MENU */}
                    {tab === "menu" && token && (
                        <div style={styles.gridMenu}>
                            <div>
                                <div style={styles.menuToolbar}>
                                    <button
                                        style={styles.ghostButton}
                                        onClick={loadMenu}
                                        disabled={loadingMenu}
                                    >
                                        {loadingMenu ? "Загрузка..." : "Обновить меню"}
                                    </button>
                                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                                        Позиции: {menu.length}
                                    </div>
                                </div>

                                <div style={{ display: "grid", gap: 10 }}>
                                    {menu.map((m) => (
                                        <div key={m.menu_item_id} style={styles.menuCard}>
                                            <div style={styles.menuHeaderRow}>
                                                <b>{m.name}</b>
                                                <span style={styles.menuPrice}>
                                                    {Number(m.price).toFixed(2)} ₽
                                                </span>
                                            </div>

                                            {m.image_url && (
                                                <img
                                                    src={m.image_url}
                                                    alt={m.name}
                                                    style={styles.thumbImage}
                                                />
                                            )}

                                            <div
                                                style={{
                                                    marginTop: 8,
                                                    display: "flex",
                                                    gap: 8,
                                                    alignItems: "center",
                                                }}
                                            >
                                                <button
                                                    style={styles.linkButton}
                                                    onClick={() => addToCart(m.menu_item_id)}
                                                >
                                                    Добавить
                                                </button>
                                                <button
                                                    style={styles.ghostButton}
                                                    onClick={() => removeFromCart(m.menu_item_id)}
                                                    disabled={!cart[m.menu_item_id]}
                                                >
                                                    Убрать
                                                </button>
                                                <span style={styles.quantityText}>
                                                    Кол-во: {cart[m.menu_item_id] || 0}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={styles.cartCard}>
                                <h3 style={{ marginTop: 0, marginBottom: 8 }}>Корзина</h3>

                                {cartItems.length === 0 ? (
                                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                                        Корзина пустая
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gap: 8 }}>
                                        {cartItems.map((x) => (
                                            <div
                                                key={x.menu_item_id}
                                                style={styles.cartItemRow}
                                            >
                                                <span>
                                                    {x.item.name} × {x.quantity}
                                                </span>
                                                <span>
                                                    {(Number(x.item.price) * x.quantity).toFixed(2)} ₽
                                                </span>
                                            </div>
                                        ))}
                                        <hr />
                                        <div style={styles.cartItemRow}>
                                            <b>Итого</b>
                                            <b>{totalPrice.toFixed(2)} ₽</b>
                                        </div>
                                        <button style={styles.primaryButton} onClick={createOrder}>
                                            Оформить заказ
                                        </button>
                                        <button style={styles.ghostButton} onClick={clearCart}>
                                            Очистить
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ORDERS */}
                    {tab === "orders" && token && (
                        <div style={{ marginTop: 12 }}>
                            <div style={styles.ordersToolbar}>
                                <button
                                    style={styles.ghostButton}
                                    onClick={loadMyOrders}
                                    disabled={loadingOrders}
                                >
                                    {loadingOrders ? "Загрузка..." : "Обновить"}
                                </button>
                                <label style={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        style={styles.checkbox}
                                        checked={autoRefreshOrders}
                                        onChange={(e) => setAutoRefreshOrders(e.target.checked)}
                                    />
                                    Автообновление (7 сек)
                                </label>
                            </div>

                            {myOrders.length === 0 ? (
                                <div style={{ fontSize: 13, color: "#6b7280" }}>
                                    Пока нет заказов. Создайте заказ в меню.
                                </div>
                            ) : (
                                <div style={styles.ordersList}>
                                    {myOrders.map((o) => (
                                        <div key={o.order_id} style={styles.orderCard}>
                                            <div style={styles.orderHeaderRow}>
                                                <b>Заказ {String(o.order_id).slice(0, 8)}…</b>
                                                <span>
                                                    <b>Статус: </b>
                                                    <span>
                                                        {statusRu(o.kitchen_status)}
                                                    </span>
                                                </span>
                                            </div>

                                            <div
                                                style={{
                                                    marginTop: 6,
                                                    fontSize: 13,
                                                    color: "#4b5563",
                                                }}
                                            >
                                                <b>Оплата:</b> {o.paid_status} |{" "}
                                                <b>Сумма:</b>{" "}
                                                {Number(o.total_price).toFixed(2)} ₽ |{" "}
                                                <b>Канал:</b> {o.channel}
                                            </div>

                                            {Array.isArray(o.items) && o.items.length > 0 && (
                                                <div
                                                    style={{
                                                        marginTop: 8,
                                                        fontSize: 13,
                                                        color: "#374151",
                                                    }}
                                                >
                                                    <b>Состав:</b>{" "}
                                                    {o.items.map((it, idx) => (
                                                        <span key={idx}>
                                                            {menuMap[it.menu_item_id] ?? it.menu_item_id} ×{" "}
                                                            {it.quantity}
                                                            {idx < o.items.length - 1 ? ", " : ""}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
