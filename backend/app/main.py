from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.database import connect, close
from app.routers import categories, products, commerce, admin, policy_qa
from app.services.chat_mcp import chat_mcp_app, mcp_server


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    try:
        async with mcp_server.session_manager.run():
            yield
    finally:
        await close()


app = FastAPI(
    title="GenTech API",
    version="1.0.0",
    lifespan=lifespan
)


app.include_router(categories.router)
app.include_router(products.router)
app.include_router(commerce.router)
app.include_router(admin.router)
app.include_router(policy_qa.router)
app.mount("/mcp", chat_mcp_app, name="chat-mcp")
app.mount(
    "/images",
    StaticFiles(
        directory=Path(__file__).resolve().parents[1] / "data" / "images",
        check_dir=False,
    ),
    name="product-images",
)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
