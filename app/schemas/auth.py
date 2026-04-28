from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=80)

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
