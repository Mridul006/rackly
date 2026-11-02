# basically holds all the utility functions in your backend application which can be used in different parts of the application
# the functions here are related to security like hashing the password, verifying the password, creating access token etc.

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User




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


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def verify_access_token(token: str, credentials_exception: HTTPException) -> int:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        return int(sub)
    except (jwt.InvalidTokenError, ValueError):
        raise credentials_exception


def get_current_user(token: str = Depends(oauth2_scheme),db: Session = Depends(get_db),) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id = verify_access_token(token, credentials_exception)
    user = db.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user


# checks if the current user is a provider for creating gpus, if not raises an HTTPException with status code 403
def require_provider(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "provider":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only providers can perform this action",
        )
    return current_user