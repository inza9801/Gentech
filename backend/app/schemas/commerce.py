from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class CustomerRegister(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=7, max_length=20)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class CustomerLogin(BaseModel):
    email: EmailStr
    password: str


class CustomerProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, min_length=7, max_length=20)


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
    paymentPhone: str | None = Field(default=None, min_length=7, max_length=20)
    couponCode: str | None = None
    items: list[CartItemInput] = Field(default_factory=list, max_length=100)

    @field_validator("name", "phone", "district", "area")
    @classmethod
    def required_values_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("notes")
    @classmethod
    def trim_notes(cls, value: str) -> str:
        return value.strip()

    @field_validator("paymentPhone")
    @classmethod
    def trim_payment_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def require_mobile_payment_phone(self):
        if self.paymentType == "mobile" and not self.paymentPhone:
            raise ValueError("A bKash demo payment number is required")
        return self


class ProductReviewInput(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    text: str | None = Field(default=None, max_length=2000)

    @field_validator("text")
    @classmethod
    def trim_review_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def require_rating_or_text(self):
        if self.rating is None and self.text is None:
            raise ValueError("Provide a star rating, written review, or both")
        return self