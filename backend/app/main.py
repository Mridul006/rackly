from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db
from .routers import auth, users, gpus, bookings, wallet, providers, datacenter, live 

from fastapi.middleware.cors import CORSMiddleware
from .config import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(gpus.router)
app.include_router(bookings.router)
app.include_router(wallet.router)
app.include_router(providers.router)
app.include_router(datacenter.router)
app.include_router(live.router)

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "ok"}