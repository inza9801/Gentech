from fastapi import APIRouter, Depends, Query

from app.core.database import get_db
from app.core.security import require_admin
from app.schemas.admin import (
    CategoryCreate,
    CategoryUpdate,
    CouponCreate,
    CouponUpdate,
    OrderStatusUpdate,
    ProductCreate,
    ProductUpdate,
)
from app.services import admin_service

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
)


@router.get("/categories")
async def admin_list_categories(db=Depends(get_db)):
    return await admin_service.list_categories(db)


@router.post("/categories", status_code=201)
async def admin_create_category(
    payload: CategoryCreate,
    db=Depends(get_db),
):
    return await admin_service.create_category(db, payload)


@router.patch("/categories/{slug}")
async def admin_update_category(
    slug: str,
    payload: CategoryUpdate,
    db=Depends(get_db),
):
    return await admin_service.update_category(db, slug, payload)


@router.delete("/categories/{slug}")
async def admin_delete_category(
    slug: str,
    db=Depends(get_db),
):
    return await admin_service.delete_category(db, slug)


@router.get("/categories/{slug}/products")
async def admin_list_products(
    slug: str,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db=Depends(get_db),
):
    return await admin_service.list_products(db, slug, skip, limit)


@router.post("/categories/{slug}/products", status_code=201)
async def admin_create_product(
    slug: str,
    payload: ProductCreate,
    db=Depends(get_db),
):
    return await admin_service.create_product(db, slug, payload)


@router.get("/categories/{slug}/products/{product_id}")
async def admin_get_product(
    slug: str,
    product_id: str,
    db=Depends(get_db),
):
    return await admin_service.get_product(db, slug, product_id)


@router.patch("/categories/{slug}/products/{product_id}")
async def admin_update_product(
    slug: str,
    product_id: str,
    payload: ProductUpdate,
    db=Depends(get_db),
):
    return await admin_service.update_product(
        db,
        slug,
        product_id,
        payload,
    )


@router.delete("/categories/{slug}/products/{product_id}")
async def admin_delete_product(
    slug: str,
    product_id: str,
    db=Depends(get_db),
):
    return await admin_service.delete_product(db, slug, product_id)


@router.get("/orders")
async def admin_list_orders(
    status: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db=Depends(get_db),
):
    return await admin_service.list_orders(db, status, skip, limit)


@router.get("/orders/{order_id}")
async def admin_get_order(
    order_id: str,
    db=Depends(get_db),
):
    return await admin_service.get_order(db, order_id)


@router.patch("/orders/{order_id}/status")
async def admin_update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    db=Depends(get_db),
    admin=Depends(require_admin),
):
    return await admin_service.update_order_status(
        db,
        order_id,
        payload,
        admin,
    )


@router.get("/coupons")
async def admin_list_coupons(db=Depends(get_db)):
    return await admin_service.list_coupons(db)


@router.post("/coupons", status_code=201)
async def admin_create_coupon(
    payload: CouponCreate,
    db=Depends(get_db),
):
    return await admin_service.create_coupon(db, payload)


@router.patch("/coupons/{coupon_id}")
async def admin_update_coupon(
    coupon_id: str,
    payload: CouponUpdate,
    db=Depends(get_db),
):
    return await admin_service.update_coupon(db, coupon_id, payload)


@router.delete("/coupons/{coupon_id}")
async def admin_delete_coupon(
    coupon_id: str,
    db=Depends(get_db),
):
    return await admin_service.delete_coupon(db, coupon_id)
