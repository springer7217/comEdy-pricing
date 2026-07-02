#!/usr/bin/env python3
"""
Simple price reporter - runs every 30 minutes and sends current price as a sentence.
"""

import requests
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


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
        message = f"Current ComEd price is {price:.1f}¢/kWh as of {time_str}."
        
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
