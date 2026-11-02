# basically holds all the utility functions in your backend application which can be used in different parts of the application
# the functions here are related to security like hashing the password, verifying the password, creating access token etc.

import jwt
from datetime import datetime, timedelta
from .config import settings
from pwdlib import PasswordHash



password_hasher = PasswordHash.recommended()

def hash_password(password: str) -> str:
    return password_hasher.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hasher.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    
    expire=datetime.utcnow()+ timedelta(minutes=settings.access_token_expire_minutes)
    to_encode["exp"]=expire
    
    encode_jwt=jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encode_jwt
