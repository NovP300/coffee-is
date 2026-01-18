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

    /* ===================== STYLES ===================== */
    const styles = {
        app: {
            minHeight: "100vh",
            background: "#f3f4f6",
            fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            color: "#111827",
            width: "100vw", 
        },
        container: {
            maxWidth: 1000,
            margin: "0 auto",
            padding: "24px 16px 32px",
        },
        header: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 20,
        },
        title: {
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 0.3,
        },
        subtitle: {
            fontSize: 14,
            color: "#6b7280",
        },
        card: {
            background: "#ffffff",
            borderRadius: 16,
            padding: 20,
            boxShadow:
                "0 10px 25px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.1)",
            border: "1px solid #e5e7eb",
        },
        tabs: {
            display: "inline-flex",
            background: "#e5e7eb",
            borderRadius: 999,
            padding: 4,
            marginBottom: 20,
            gap: 4,
        },
        tabButton: (active) => ({
            border: "none",
            outline: "none",
            padding: "8px 18px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            background: active ? "#111827" : "transparent",
            color: active ? "#f9fafb" : "#4b5563",
            transition: "all 0.15s ease-in-out",
            boxShadow: active ? "0 6px 14px rgba(15,23,42,0.25)" : "none",
        }),
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
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            transition: "transform 0.1s ease, box-shadow 0.1s ease, filter 0.1s",
        },
        primaryButtonSmall: {
            borderRadius: 999,
            border: "none",
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            background: "#111827",
            color: "#f9fafb",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "background-color 0.1s ease, transform 0.1s ease",
        },
        primaryButtonGhost: {
            borderRadius: 999,
            border: "1px solid #d1d5db",
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            background: "white",
            color: "#374151",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition:
                "background-color 0.1s ease, color 0.1s ease, transform 0.1s ease",
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
        queueList: {
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
        },
        orderCard: (status) => ({
            borderRadius: 14,
            padding: 14,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            position: "relative",
            ...(status === "IN_PROGRESS" && {
                borderColor: "#a855f7",
                boxShadow: "0 0 0 1px rgba(168,85,247,0.2)",
            }),
        }),
        orderHeaderRow: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
        },
        orderId: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
            fontSize: 13,
            color: "#4b5563",
        },
        orderMeta: {
            fontSize: 12,
            color: "#9ca3af",
        },
        itemsRow: {
            fontSize: 13,
            color: "#374151",
            lineHeight: 1.4,
        },
        itemsLabel: {
            fontWeight: 500,
            marginRight: 4,
        },
        itemsPill: {
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 8px",
            borderRadius: 999,
            background: "#e5e7eb",
            fontSize: 12,
            marginRight: 6,
            marginTop: 4,
        },
        orderActions: {
            marginTop: 8,
            display: "flex",
            gap: 8,
        },
        toolbar: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
            marginTop: 4,
            flexWrap: "wrap",
        },
        autoRefreshLabel: {
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#4b5563",
        },
        checkbox: {
            width: 14,
            height: 14,
            accentColor: "#4f46e5",
        },
        errorText: {
            color: "#b91c1c",
            fontSize: 13,
            marginTop: 8,
        },
        select: {
            marginTop: 4,
            padding: "7px 10px",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            fontSize: 14,
            outline: "none",
            background: "#f9fafb",
        },
        recipeList: {
            marginTop: 12,
            paddingLeft: 18,
            fontSize: 14,
            color: "#374151",
        },
        recipeItem: {
            marginBottom: 4,
        },
    };

    /* ===================== UI ===================== */
    return (
        <div style={styles.app}>
            <div style={styles.container}>
                <div style={styles.header}>
                    <div>
                        <div style={styles.title}>Дисплей бариста</div>
                        <div style={styles.subtitle}>Управление очередью и рецептами</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        {/* здесь можно вывести имя залогиненного пользователя позже */}
                        Рабочее место бариста
                    </div>
                </div>

                <div style={styles.card}>
                    {/* Tabs */}
                    <div style={styles.tabs}>
                        <button
                            style={styles.tabButton(tab === "queue")}
                            onClick={() => setTab("queue")}
                        >
                            Очередь заказов
                        </button>
                        <button
                            style={styles.tabButton(tab === "recipes")}
                            onClick={() => setTab("recipes")}
                        >
                            Рецепты
                        </button>
                    </div>

                    {tab === "queue" && (
                        <>
                            <div style={styles.toolbar}>
                                <button
                                    style={{
                                        ...styles.primaryButton,
                                        opacity: loadingQueue ? 0.7 : 1,
                                        cursor: loadingQueue ? "default" : "pointer",
                                    }}
                                    onClick={loadQueue}
                                    disabled={loadingQueue}
                                    onMouseDown={(e) => {
                                        e.currentTarget.style.transform = "scale(0.97)";
                                        e.currentTarget.style.boxShadow =
                                            "0 4px 10px rgba(79,70,229,0.35)";
                                    }}
                                    onMouseUp={(e) => {
                                        e.currentTarget.style.transform = "scale(1)";
                                        e.currentTarget.style.boxShadow =
                                            "0 8px 18px rgba(79,70,229,0.45)";
                                    }}
                                >
                                    <span>Обновить очередь</span>
                                </button>

                                <label style={styles.autoRefreshLabel}>
                                    <input
                                        type="checkbox"
                                        style={styles.checkbox}
                                        checked={autoRefresh}
                                        onChange={(e) => setAutoRefresh(e.target.checked)}
                                    />
                                    автообновление каждые 7 секунд
                                </label>
                            </div>

                            {queueError && (
                                <div style={styles.errorText}>{queueError}</div>
                            )}

                            <div style={styles.queueList}>
                                {queueSorted.map((o) => (
                                    <div
                                        key={o.order_id}
                                        style={styles.orderCard(o.status)}
                                    >
                                        <div style={styles.orderHeaderRow}>
                                            <div>
                                                <div style={styles.orderId}>
                                                    #{o.order_id.slice(0, 8)}…
                                                </div>
                                                <div style={styles.orderMeta}>
                                                    {/* Если есть created_at, его можно красиво форматнуть */}
                                                    Статус заказа
                                                </div>
                                            </div>
                                            <div>
                                                {o.status === "NEW" && (
                                                    <span style={styles.badge("yellow")}>Новый</span>
                                                )}
                                                {o.status === "IN_PROGRESS" && (
                                                    <span style={styles.badge("green")}>
                                                        В работе
                                                    </span>
                                                )}
                                                {o.status !== "NEW" &&
                                                    o.status !== "IN_PROGRESS" && (
                                                        <span style={styles.badge("gray")}>
                                                            {o.status}
                                                        </span>
                                                    )}
                                            </div>
                                        </div>

                                        <div style={styles.itemsRow}>
                                            <span style={styles.itemsLabel}>Позиции:</span>
                                            <div>
                                                {o.items.items.map((i, idx) => (
                                                    <span key={idx} style={styles.itemsPill}>
                                                        {menuMap[i.menu_item_id] ?? i.menu_item_id} ×{" "}
                                                        {i.quantity}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={styles.orderActions}>
                                            <button
                                                style={{
                                                    ...styles.primaryButtonSmall,
                                                    background:
                                                        o.status === "NEW" ? "#111827" : "#9ca3af",
                                                    cursor:
                                                        o.status === "NEW" ? "pointer" : "default",
                                                }}
                                                onClick={() => startOrder(o.order_id)}
                                                disabled={o.status !== "NEW"}
                                            >
                                                Взять в работу
                                            </button>
                                            <button
                                                style={{
                                                    ...styles.primaryButtonGhost,
                                                    opacity: o.status === "IN_PROGRESS" ? 1 : 0.5,
                                                    cursor:
                                                        o.status === "IN_PROGRESS"
                                                            ? "pointer"
                                                            : "default",
                                                }}
                                                onClick={() => completeOrder(o.order_id)}
                                                disabled={o.status !== "IN_PROGRESS"}
                                            >
                                                Готово
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {queueSorted.length === 0 && !queueError && (
                                    <div
                                        style={{
                                            gridColumn: "1 / -1",
                                            textAlign: "center",
                                            padding: "24px 0 10px",
                                            fontSize: 14,
                                            color: "#6b7280",
                                        }}
                                    >
                                        Очередь пуста ☕
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {tab === "recipes" && (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 12,
                                    flexWrap: "wrap",
                                    marginBottom: 8,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 500,
                                            color: "#374151",
                                            marginBottom: 4,
                                        }}
                                    >
                                        Рецепт напитка
                                    </div>
                                    <select
                                        value={selectedMenuId}
                                        onChange={(e) => setSelectedMenuId(e.target.value)}
                                        style={styles.select}
                                    >
                                        {menuItems.map((m) => (
                                            <option
                                                key={m.menu_item_id}
                                                value={m.menu_item_id}
                                            >
                                                {m.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {recipeError && (
                                <div style={styles.errorText}>{recipeError}</div>
                            )}

                            <ul style={styles.recipeList}>
                                {recipe.map((r, idx) => (
                                    <li key={idx} style={styles.recipeItem}>
                                        <strong>
                                            {ingredientMap[r.ingredient_id]?.name ??
                                                r.ingredient_id.slice(0, 8)}
                                        </strong>
                                        {": "}
                                        {r.quantity}{" "}
                                        {ingredientMap[r.ingredient_id]?.unit ?? ""}
                                    </li>
                                ))}
                                {recipe.length === 0 && !recipeError && (
                                    <li style={{ fontSize: 13, color: "#6b7280" }}>
                                        Для этого напитка ещё не добавлен рецепт.
                                    </li>
                                )}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
