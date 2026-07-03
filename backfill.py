#!/usr/bin/env python3
"""
Historical backfill script for ComEd 5-minute pricing data.

Usage via GitHub Actions with START_DATE and END_DATE environment variables.
"""

import os
import time
import requests
from datetime import datetime, timedelta
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
START_DATE = os.getenv("START_DATE")      # Format: YYYYMMDD
END_DATE = os.getenv("END_DATE")          # Format: YYYYMMDD

if not all([SUPABASE_URL, SUPABASE_KEY, START_DATE, END_DATE]):
    print("Missing required environment variables")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_day(date_str):
    """Fetch one day of 5-minute data from ComEd."""
    url = (
        f"https://hourlypricing.comed.com/api?type=5minutefeed"
        f"&datestart={date_str}0000&dateend={date_str}2359"
    )
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Error fetching {date_str}: {e}")
        return []


def insert_batch(records):
    """Insert records into Supabase in batches."""
    if not records:
        return
    try:
        data = [
            {
                "price": float(r["price"]),
                "recorded_at": datetime.fromtimestamp(
                    int(r["millisUTC"]) / 1000
                ).isoformat()
            }
            for r in records
        ]
        supabase.table("comed_prices").insert(data).execute()
        print(f"Inserted {len(data)} records")
    except Exception as e:
        print(f"Insert error: {e}")


def main():
    start = datetime.strptime(START_DATE, "%Y%m%d")
    end = datetime.strptime(END_DATE, "%Y%m%d")
    
    current = start
    total_inserted = 0

    print(f"Backfilling from {START_DATE} to {END_DATE}...")

    while current <= end:
        date_str = current.strftime("%Y%m%d")
        print(f"Processing {date_str}...")

        day_data = fetch_day(date_str)
        if day_data:
            insert_batch(day_data)
            total_inserted += len(day_data)

        current += timedelta(days=1)
        time.sleep(1)  # Be nice to the API

    print(f"\nBackfill complete! Total records inserted: {total_inserted}")


if __name__ == "__main__":
    main()
