from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID

from app.schemas.enums import TransactionType

class CategoryBase(BaseModel):
    id: UUID
    user_id: UUID
    name: str = Field(max_length=60)
    icon: str = Field(max_length=10)
    color: str = Field(max_length=7)
    type: TransactionType
    
class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=60)
    description: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None

class CategoryResponse(CategoryBase):
    model_config = ConfigDict(from_attributes=True)