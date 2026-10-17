from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.schemas.enums import TransactionType


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    icon: str = Field(default="🏷️", max_length=10)
    color: str = Field(default="#47EAED", max_length=7)
    type: TransactionType


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=60)
    icon: Optional[str] = Field(None, max_length=10)
    color: Optional[str] = Field(None, max_length=7)


class CategoryResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    type: TransactionType
    is_default: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)