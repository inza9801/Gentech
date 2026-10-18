from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class CustomerRegister(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=7, max_length=20)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class CustomerLogin(BaseModel):
    email: EmailStr
    password: str


class CartItemInput(BaseModel):
    categorySlug: str
    productId: str
    quantity: int = Field(ge=1, le=20)


class CheckoutInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=7, max_length=20)
    district: str
    area: str
    notes: str = Field(default="", max_length=1000)
    paymentType: Literal["mobile", "cod"]
    couponCode: str | None = None