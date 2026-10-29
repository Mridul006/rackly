#this file contains all the data models used in the application

from .database import Base
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, CheckConstraint
from sqlalchemy.sql.sqltypes import TIMESTAMP
from sqlalchemy.sql.expression import text

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

class GPU(Base):
    __tablename__ = "gpus"

    id = Column(Integer, primary_key=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    model = Column(String, nullable=False)
    vram_gb = Column(Integer, nullable=False)
    gpu_count = Column(Integer, nullable=False)
    price_per_hour = Column(Numeric(10, 2), nullable=False)
    location = Column(String, nullable=False)
    rack_no = Column(Integer, nullable=True)
    slot_no = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, server_default=text('true'))
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    
class AvailabilityWindow(Base):
    __tablename__ = "availability_windows"

    id = Column(Integer, primary_key=True, nullable=False)
    gpu_id = Column(Integer, ForeignKey("gpus.id", ondelete="CASCADE"), nullable=False, index=True)
    start_at = Column(TIMESTAMP(timezone=True), nullable=False)
    end_at = Column(TIMESTAMP(timezone=True), nullable=False)
    
class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, nullable=False)
    gpu_id = Column(Integer, ForeignKey("gpus.id", ondelete="RESTRICT"), nullable=False, index=True)
    renter_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    start_at = Column(TIMESTAMP(timezone=True), nullable=False)
    end_at = Column(TIMESTAMP(timezone=True), nullable=False)
    price_per_hour = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)
    status = Column(String, nullable=False, server_default='confirmed')
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    cancelled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    
class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"
    __table_args__ = (
        CheckConstraint(
            "type IN ('deposit', 'booking_charge', 'refund', 'provider_payout')",
            name="ck_wallet_transactions_type",
        ),
    )

    id = Column(Integer, primary_key=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="RESTRICT"), nullable=True, index=True)
    type = Column(String, nullable=False)  # deposit, booking_charge, refund, provider_payout
    amount = Column(Numeric(12, 2), nullable=False)  # signed: money in is positive, money out is negative
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    
class ProblemReport(Base):
    __tablename__ = "problem_reports"
    
    id = Column(Integer, primary_key=True, nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="RESTRICT"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    description = Column(String, nullable=False)
    status = Column(String, nullable=False, server_default='open')
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    resolved_at = Column(TIMESTAMP(timezone=True), nullable=True)


    
