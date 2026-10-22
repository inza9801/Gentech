from datetime import datetime
from pydantic import ConfigDict
from pydantic import BaseModel, Field


class CategoryRef(BaseModel):
    name: str
    slug: str


class ProductCard(BaseModel):
    id: str
    sku: str | None = None
    name: str
    brand: str | None = None

    category: CategoryRef

    color: str | None = None
    price: int
    discount: int = 0
    finalPrice: int
    hasDiscount: bool
    warranty: str | None = None

    rating: float = 0
    ratingCount: int = 0
    reviewCount: int = 0
    soldCount: int = 0
    availability: int = 0
    inStock: bool
    lowStock: bool

    features: list[str] = Field(default_factory=list)
    images: list[str] = Field(default_factory=list)
    image: str | None = None
    highlights: list[str] = Field(default_factory=list)
    createdAt: datetime | None = None

class ProductDetail(ProductCard):
    model_config = ConfigDict(extra="allow")