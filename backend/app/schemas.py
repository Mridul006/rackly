# keeps the schemas of the user input and response given by the app

from pydantic import BaseModel, EmailStr, ConfigDict, Field
from datetime import datetime
from typing import Literal

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["renter", "provider"]
    

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: str
    created_at: datetime