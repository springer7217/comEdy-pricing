#!/usr/bin/env python3
"""
ComEd Price Logger + Notifier

- Sends simple price update to ntfy every 10 minutes
- Logs price + timestamp into Supabase
"""

import requests
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from supabase import create_client, Client


def get_emoji(price: float) -> str:
    if price <= 8.0:
        return "🟢"
    elif price <= 10.0:
        return "🟡"
    else:
        return "🔴"


def main():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    ntfy_topic = os.getenv("NTFY_TOPIC")

    if not supabase_url or not supabase_key:
        print("Missing Supabase credentials")
        return

    supabase: Client = create_client(supabase_url, supabase_key)

    url = "https://hourlypricing.comed.com/api?type=5minutefeed&format=json"

    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        if not data:
            print("No data from ComEd API")
            return

        latest = data[0]
        price = float(latest["price"])
        millis = int(latest["millisUTC"])

        dt_utc = datetime.fromtimestamp(millis / 1000, tz=timezone.utc)
        dt_local = dt_utc.astimezone(ZoneInfo("America/Chicago"))
        time_str = dt_local.strftime("%I:%M %p")

        emoji = get_emoji(price)
        if price <= 0:
            decision = "Negative — plug in. ComEd is paying you to charge."
        elif price <= 4:
            decision = "Charge now. Excellent rate."
        elif price <= 8:
            decision = "Charge now. Cheap window."
        elif price <= 12:
            decision = "Okay to charge if you need it."
        else:
            decision = "Wait if you can. Shift until overnight."
        message = f"{emoji} ComEd {price:.1f}¢/kWh at {time_str}. {decision}"

        if ntfy_topic:
            try:
                requests.post(f"https://ntfy.sh/{ntfy_topic}", data=message, timeout=10)
                print(f"ntfy sent: {message}")
            except Exception as e:
                print(f"ntfy error: {e}")

        try:
            supabase.table("comed_prices").insert({
                "price": price,
                "recorded_at": dt_utc.isoformat()
            }).execute()
            print(f"Supabase insert successful: {price}¢ at {dt_utc}")
        except Exception as e:
            print(f"Supabase insert error: {e}")

    except Exception as e:
        print(f"Error fetching price: {e}")


if __name__ == "__main__":
    main()
