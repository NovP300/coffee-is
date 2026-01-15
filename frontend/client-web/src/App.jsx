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

    /* ===================== UI ===================== */
    return (
        <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 980, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <h2 style={{ margin: 0 }}>Клиентское приложение</h2>
                
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                {token ? (
                    <>
                        <button onClick={() => setTab("menu")} disabled={tab === "menu"}>Меню</button>
                        <button onClick={() => setTab("orders")} disabled={tab === "orders"}>Мои заказы</button>

                        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ opacity: 0.8 }}>
                                Добро пожаловать, <b>{me || "пользователь"}</b>
                            </span>
                            <button onClick={logout}>Выйти</button>
                        </div>
                    </>
                ) : (
                    <>
                        <button onClick={() => setTab("auth")} disabled>Вход</button>
                    </>
                )}
            </div>

            {error && (
                <div style={{ color: "crimson", whiteSpace: "pre-wrap", marginTop: 10 }}>
                    {error}
                </div>
            )}

            {/* ============ AUTH ============ */}
            {tab === "auth" && !token && (
                <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, maxWidth: 420, marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <button onClick={() => setAuthMode("login")} disabled={authMode === "login"}>Вход</button>
                        <button onClick={() => setAuthMode("register")} disabled={authMode === "register"}>Регистрация</button>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                        <label>
                            Логин
                            <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%" }} />
                        </label>
                        <label>
                            Пароль
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </label>

                        {authMode === "login" ? (
                            <button onClick={login}>Войти</button>
                        ) : (
                            <button onClick={register}>Зарегистрироваться</button>
                        )}
                    </div>

                    
                </div>
            )}

            {/* ============ MENU ============ */}
            {tab === "menu" && token && (
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, marginTop: 12 }}>
                    <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                            <button onClick={loadMenu} disabled={loadingMenu}>
                                {loadingMenu ? "Загрузка..." : "Обновить меню"}
                            </button>
                            <div style={{ opacity: 0.7 }}>{menu.length} позиций</div>
                        </div>

                        <div style={{ display: "grid", gap: 10 }}>
                            {menu.map((m) => (
                                <div key={m.menu_item_id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <b>{m.name}</b>
                                        <span>{Number(m.price).toFixed(2)} ₽</span>
                                    </div>

                                    {m.image_url && (
                                        <div style={{ marginTop: 8 }}>
                                            <img src={m.image_url} alt={m.name} style={{ width: "100%", maxWidth: 260, borderRadius: 10 }} />
                                        </div>
                                    )}

                                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                        <button onClick={() => addToCart(m.menu_item_id)}>Добавить</button>
                                        <button onClick={() => removeFromCart(m.menu_item_id)} disabled={!cart[m.menu_item_id]}>
                                            Убрать
                                        </button>
                                        <span style={{ marginLeft: "auto", opacity: 0.8 }}>
                                            Кол-во: {cart[m.menu_item_id] || 0}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, height: "fit-content" }}>
                        <h3 style={{ marginTop: 0 }}>Корзина</h3>

                        {cartItems.length === 0 ? (
                            <div style={{ opacity: 0.7 }}>Корзина пустая</div>
                        ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                                {cartItems.map((x) => (
                                    <div key={x.menu_item_id} style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span>{x.item.name} × {x.quantity}</span>
                                        <span>{(Number(x.item.price) * x.quantity).toFixed(2)} ₽</span>
                                    </div>
                                ))}
                                <hr />
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <b>Итого</b>
                                    <b>{totalPrice.toFixed(2)} ₽</b>
                                </div>
                                <button onClick={createOrder}>Оформить заказ</button>
                                <button onClick={clearCart}>Очистить</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============ ORDERS ============ */}
            {tab === "orders" && token && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                        <button onClick={loadMyOrders} disabled={loadingOrders}>
                            {loadingOrders ? "Загрузка..." : "Обновить"}
                        </button>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                                type="checkbox"
                                checked={autoRefreshOrders}
                                onChange={(e) => setAutoRefreshOrders(e.target.checked)}
                            />
                            Автообновление (7 сек)
                        </label>
                    </div>

                    {myOrders.length === 0 ? (
                        <div style={{ opacity: 0.7 }}>Пока нет заказов. Создайте заказ в меню.</div>
                    ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                            {myOrders.map((o) => (
                                <div key={o.order_id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <b>Заказ {String(o.order_id).slice(0, 8)}…</b>
                                        <span>
                                            <b>Статус:</b> {statusRu(o.kitchen_status)}
                                        </span>
                                    </div>

                                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                                        <b>Оплата:</b> {o.paid_status}{" "}
                                        | <b>Сумма:</b> {Number(o.total_price).toFixed(2)} ₽{" "}
                                        | <b>Канал:</b> {o.channel}
                                    </div>

                                    {/* состав заказа */}
                                    {Array.isArray(o.items) && o.items.length > 0 && (
                                        <div style={{ marginTop: 8, opacity: 0.9 }}>
                                            <b>Состав:</b>{" "}
                                            {o.items.map((it, idx) => (
                                                <span key={idx}>
                                                    {menuMap[it.menu_item_id] ?? it.menu_item_id} × {it.quantity}
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
    );
}
