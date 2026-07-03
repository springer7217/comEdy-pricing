#!/usr/bin/env python3
"""
Simple price reporter - runs every 10 minutes.

Emoji logic:
- 🟢 = 8.0¢ and under
- 🟡 = 8.1¢ to 10.0¢
- 🔴 = above 10.0¢

Message includes the actual check time.
"""

import requests
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def get_emoji(price):
    if price <= 8.0:
        return "🟢"   # Green
    elif price <= 10.0:
        return "🟡"   # Yellow
    else:
        return "🔴"   # Red


def main():
    url = "https://hourlypricing.comed.com/api?type=5minutefeed&format=json"
    
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        
        if not data:
            print("No data returned from API")
            return
            
        latest = data[0]
        price = float(latest["price"])
        millis = int(latest["millisUTC"])
        
        dt_utc = datetime.fromtimestamp(millis / 1000, tz=timezone.utc)
        dt_local = dt_utc.astimezone(ZoneInfo("America/Chicago"))
        
        time_str = dt_local.strftime("%I:%M %p")
        emoji = get_emoji(price)
        
        message = f"{emoji} ComEd price: {price:.1f}¢/kWh as of {time_str}"
        
        # Send to ntfy
        ntfy_topic = os.getenv("NTFY_TOPIC")
        if ntfy_topic:
            requests.post(f"https://ntfy.sh/{ntfy_topic}", data=message, timeout=10)
            print(f"Sent: {message}")
        else:
            print("NTFY_TOPIC not set")
            print(message)
            
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
