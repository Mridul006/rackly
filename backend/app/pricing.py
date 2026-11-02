#keeps the pricing logic of the app

from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal


def calculate_total(price_per_hour: Decimal, start_at: datetime, end_at: datetime) -> Decimal:
    hours = (end_at - start_at) // timedelta(hours=1)
    return (price_per_hour * hours).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)