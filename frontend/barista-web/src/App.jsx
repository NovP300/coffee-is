import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:8080/api";

async function apiJson(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json();
}

export default function App() {
    const [tab, setTab] = useState("queue");

    /* ===================== QUEUE ===================== */
    const [queue, setQueue] = useState([]);
    const [queueError, setQueueError] = useState("");
    const [loadingQueue, setLoadingQueue] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    async function loadQueue() {
        setLoadingQueue(true);
        setQueueError("");
        try {
            const data = await apiJson(
                "/kitchen/orders?status=NEW&status=IN_PROGRESS"
            );
            setQueue(data);
        } catch (e) {
            setQueueError(e.message);
        } finally {
            setLoadingQueue(false);
        }
    }

    async function startOrder(orderId) {
        await apiJson(`/kitchen/orders/${orderId}/start`, { method: "POST" });
        loadQueue();
    }

    async function completeOrder(orderId) {
        await apiJson(`/kitchen/orders/${orderId}/complete`, { method: "POST" });
        loadQueue();
    }

    /* ===================== RECIPES ===================== */
    const [menuItems, setMenuItems] = useState([]);
    const [selectedMenuId, setSelectedMenuId] = useState("");
    const [recipe, setRecipe] = useState([]);
    const [recipeError, setRecipeError] = useState("");

    /* ===================== INGREDIENT DICTIONARY ===================== */
    const [ingredientMap, setIngredientMap] = useState({});

    async function loadMenu() {
        const data = await apiJson("/menu/items");
        setMenuItems(data);
        if (data.length && !selectedMenuId) {
            setSelectedMenuId(data[0].menu_item_id);
        }
    }

    const [menuMap, setMenuMap] = useState({});

    async function loadMenu() {
        const data = await apiJson("/menu/items");
        setMenuItems(data);

        const map = {};
        data.forEach((m) => {
            map[m.menu_item_id] = m.name;
        });
        setMenuMap(map);

        if (data.length && !selectedMenuId) {
            setSelectedMenuId(data[0].menu_item_id);
        }
    }



    async function loadRecipe(menuItemId) {
        if (!menuItemId) return;
        setRecipeError("");
        try {
            const data = await apiJson(`/menu/items/${menuItemId}/recipe`);
            console.log("RECIPE:", data);
            setRecipe(data);
        } catch (e) {
            setRecipeError(e.message);
            setRecipe([]);
        }
    }

    async function loadIngredients() {
        const data = await apiJson("/inventory/ingredients");
        console.log("INGREDIENTS RAW:", data);
        const map = {};
        data.forEach((ing) => {
            map[ing.ingredient_id] = {
                name: ing.name,
                unit: ing.unit,
            };
        });
        setIngredientMap(map);
    }

    /* ===================== EFFECTS ===================== */
    useEffect(() => {
        loadQueue();
        loadMenu();
        loadIngredients();
    }, []);

    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(loadQueue, 7000);
        return () => clearInterval(id);
    }, [autoRefresh]);

    useEffect(() => {
        loadRecipe(selectedMenuId);
    }, [selectedMenuId]);

    /* ===================== SORTED QUEUE ===================== */
    const queueSorted = useMemo(() => {
        return [...queue].sort((a, b) => {
            if (a.status === b.status) {
                return new Date(a.created_at) - new Date(b.created_at);
            }
            return a.status === "NEW" ? -1 : 1;
        });
    }, [queue]);

    /* ===================== UI ===================== */
    return (
        <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
            <h2>Дисплей бариста</h2>

            <div style={{ marginBottom: 12 }}>
                <button onClick={() => setTab("queue")}>Очередь заказов</button>{" "}
                <button onClick={() => setTab("recipes")}>Рецепты</button>
            </div>

            {tab === "queue" && (
                <>
                    <button onClick={loadQueue} disabled={loadingQueue}>
                        Обновить очередь
                    </button>{" "}
                    <label>
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        авто-обновление
                    </label>

                    {queueError && <p style={{ color: "red" }}>{queueError}</p>}

                    {queueSorted.map((o) => (
                        <div
                            key={o.order_id}
                            style={{
                                border: "1px solid #ccc",
                                borderRadius: 8,
                                padding: 10,
                                marginTop: 10,
                            }}
                        >
                            <b>Заказ:</b> {o.order_id.slice(0, 8)}… <br />
                            <b>Статус:</b> {o.status}
                            <br />
                            <b>Позиции:</b>{" "}
                            {o.items.items.map((i, idx) => (
                                <span key={idx}>
                                    {menuMap[i.menu_item_id] ?? i.menu_item_id} × {i.quantity}{" "}
                                </span>
                            ))}

                            <br />
                            <button
                                onClick={() => startOrder(o.order_id)}
                                disabled={o.status !== "NEW"}
                            >
                                Взять
                            </button>{" "}
                            <button
                                onClick={() => completeOrder(o.order_id)}
                                disabled={o.status !== "IN_PROGRESS"}
                            >
                                Готово
                            </button>
                        </div>
                    ))}
                </>
            )}

            {tab === "recipes" && (
                <>
                    <select
                        value={selectedMenuId}
                        onChange={(e) => setSelectedMenuId(e.target.value)}
                    >
                        {menuItems.map((m) => (
                            <option key={m.menu_item_id} value={m.menu_item_id}>
                                {m.name}
                            </option>
                        ))}
                    </select>

                    {recipeError && <p style={{ color: "red" }}>{recipeError}</p>}

                    <ul>
                        {recipe.map((r, idx) => (
                            <li key={idx}>
                                {ingredientMap[r.ingredient_id]?.name ??
                                    r.ingredient_id.slice(0, 8)}
                                : {r.quantity}{" "}
                                {ingredientMap[r.ingredient_id]?.unit ?? ""}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
