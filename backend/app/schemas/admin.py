from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    slug: str = Field(
        min_length=2,
        max_length=80,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )
    collection: str


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)


class CouponCreate(BaseModel):
    code: str = Field(min_length=3, max_length=40)
    discountType: Literal["percentage", "fixed"]
    discountValue: float = Field(gt=0)
    minOrderAmount: float = Field(default=0, ge=0)
    maxDiscount: float | None = Field(default=None, gt=0)
    usageLimit: int | None = Field(default=None, gt=0)
    expiresAt: datetime | None = None
    active: bool = True


class CouponUpdate(BaseModel):
    discountType: Literal["percentage", "fixed"] | None = None
    discountValue: float | None = Field(default=None, gt=0)
    minOrderAmount: float | None = Field(default=None, ge=0)
    maxDiscount: float | None = Field(default=None, gt=0)
    usageLimit: int | None = Field(default=None, gt=0)
    expiresAt: datetime | None = None
    active: bool | None = None


class OrderStatusUpdate(BaseModel):
    status: Literal["accepted", "cancelled", "delivered"]
    reason: str | None = Field(default=None, max_length=500)


class ProductCreate(BaseModel):
    # Flexible because your different product categories have different fields.
    model_config = ConfigDict(extra="allow")

    name: str = Field(min_length=2, max_length=200)
    brand: str | None = None
    price: float = Field(ge=0)
    discount: float = Field(default=0, ge=0, le=100)
    availability: int = Field(default=0, ge=0)
    sku: str | None = None


class ProductUpdate(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str | None = Field(default=None, min_length=2, max_length=200)
    brand: str | None = None
    price: float | None = Field(default=None, ge=0)
    discount: float | None = Field(default=None, ge=0, le=100)
    availability: int | None = Field(default=None, ge=0)
    sku: str | None = None