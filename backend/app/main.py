from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.database import connect, close
from app.routers import categories, products, commerce


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()

    yield

    await close()


app = FastAPI(
    title="GenTech API",
    version="1.0.0",
    lifespan=lifespan
)


app.include_router(categories.router)
app.include_router(products.router)
app.include_router(commerce.router)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
