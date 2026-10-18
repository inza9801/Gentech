from pydantic import BaseModel, Field


class Category(BaseModel):
    id: str
    name: str
    slug: str
    collection: str
    
class CategoryWithBrands(Category):
    brands: list[str] = Field(default_factory=list)
    
