# keeps the schemas of the user input and response given by the app

from pydantic import BaseModel, EmailStr, ConfigDict, Field, AwareDatetime, model_validator
from datetime import datetime
from typing import Literal
from decimal import Decimal



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
    
    
    
class Token(BaseModel):
    access_token: str
    token_type: str
    



class GPUCreate(BaseModel):
    model: str = Field(min_length=1, max_length=100)
    vram_gb: int = Field(gt=0)
    gpu_count: int = Field(gt=0)
    price_per_hour: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    location: str = Field(min_length=1, max_length=100)
    rack_no: int | None = Field(default=None, ge=1)
    slot_no: int | None = Field(default=None, ge=1)


class GPUUpdate(BaseModel):
    model: str | None = Field(default=None, min_length=1, max_length=100)
    vram_gb: int | None = Field(default=None, gt=0)
    gpu_count: int | None = Field(default=None, gt=0)
    price_per_hour: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    location: str | None = Field(default=None, min_length=1, max_length=100)
    rack_no: int | None = Field(default=None, ge=1)
    slot_no: int | None = Field(default=None, ge=1)
    is_active: bool | None = None


class GPUOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    model: str
    vram_gb: int
    gpu_count: int
    price_per_hour: Decimal
    location: str
    rack_no: int | None
    slot_no: int | None
    is_active: bool
    created_at: datetime
    
    
    
class AvailabilityCreate(BaseModel):
    start_at: AwareDatetime
    end_at: AwareDatetime
    
    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        return self
    
class AvailabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gpu_id:int
    start_at: datetime
    end_at: datetime
    