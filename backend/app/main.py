from fastapi import FastAPI, Depends
from .database import get_db
from sqlalchemy.orm import Session
from sqlalchemy import text


app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    return {"database": "working"}

@app.get("/health/db")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "ok"}