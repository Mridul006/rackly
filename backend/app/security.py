# basically holds all the utility functions in your backend application which can be used in different parts of the application

from pwdlib import PasswordHash
password_hasher = PasswordHash.recommended()

def hash_password(password: str):
    return password_hasher.hash(password)

def verify_password(plain_password, hashed_password):
    return password_hasher.verify(plain_password, hashed_password)
