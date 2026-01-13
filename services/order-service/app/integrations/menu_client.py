from uuid import UUID
import httpx

from app.core.settings import settings


class MenuClient:
    def __init__(self):
        self.base_url = settings.menu_service_url.rstrip("/")

    async def get_item(self, menu_item_id: UUID) -> dict:
        
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{self.base_url}/items", params={"active_only": True})
            r.raise_for_status()
            items = r.json()
        for it in items:
            if it["menu_item_id"] == str(menu_item_id):
                return it
        raise ValueError("Menu item not found")
