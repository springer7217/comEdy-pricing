#!/usr/bin/env python3
"""
ComEd Hourly Price Alert Tool (comEdy-pricing)
===============================================

Alerts for:
1. Negative prices (ComEd paying you) - enter and exit
2. High price milestones every 10¢ (both upward and downward crossings)
   - Upward: Crosses 10¢, 20¢, 30¢...
   - Downward: Drops below 80¢, 70¢, 60¢... (handles big drops too)

"""

import requests
import json
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# ==================== CONFIGURATION ====================
NEGATIVE_THRESHOLD = -0.01
EXIT_NEGATIVE_THRESHOLD = 0.01
MILESTONE_STEP = 10.0

NTFY_TOPIC = os.getenv("NTFY_TOPIC") or ""
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN") or ""
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID") or ""

STATE_FILE = "comed_alert_state.json"
LOG_FILE = "comed_price_log.txt"
# =======================================================

def get_current_price():
    url = "https://hourlypricing.comed.com/api?type=5minutefeed&format=json"
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None, None
        latest = data[0]
        price = float(latest["price"])
        millis = int(latest["millisUTC"])
        dt_utc = datetime.fromtimestamp(millis / 1000, tz=timezone.utc)
        dt_local = dt_utc.astimezone(ZoneInfo("America/Chicago"))
        return price, dt_local
    except Exception as e:
        print(f"⚠️  Error fetching price: {e}")
        return None, None


def get_milestone(price):
    if price < MILESTONE_STEP:
        return 0
    return int(price // MILESTONE_STEP) * MILESTONE_STEP


def send_notification(title, message, emoji="⚡"):
    full_msg = f"{emoji} {title}\n\n{message}"
    sent = False

    if NTFY_TOPIC:
        try:
            r = requests.post(f"https://ntfy.sh/{NTFY_TOPIC}", data=full_msg, timeout=10)
            if r.status_code == 200:
                print("✅ Sent via ntfy")
                sent = True
        except Exception as e:
            print(f"⚠️  ntfy error: {e}")

    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        try:
            tg_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            r = requests.post(tg_url, json={"chat_id": TELEGRAM_CHAT_ID, "text": full_msg}, timeout=10)
            if r.status_code == 200:
                print("✅ Sent via Telegram")
                sent = True
        except Exception as e:
            print(f"⚠️  Telegram error: {e}")

    if not sent:
        print("\n" + "="*60)
        print(full_msg)
        print("="*60 + "\n")


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                return json.load(f)
        except:
            pass
    return {"last_price": 0.0, "last_milestone": 0}


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def log_price(dt_local, price):
    try:
        with open(LOG_FILE, "a") as f:
            f.write(f"{dt_local.isoformat()},{price:.2f}\n")
    except:
        pass


def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking ComEd price...")

    price, dt_local = get_current_price()
    if price is None:
        return

    state = load_state()
    last_price = state.get("last_price", price)
    last_milestone = state.get("last_milestone", 0)

    log_price(dt_local, price)

    print(f"  Current: {price:.2f}¢/kWh  |  Previous: {last_price:.2f}¢/kWh")

    # === NEGATIVE PRICING ALERTS ===
    current_is_negative = price <= NEGATIVE_THRESHOLD
    last_was_negative = last_price <= NEGATIVE_THRESHOLD

    if current_is_negative and not last_was_negative:
        send_notification(
            "ComEd is now PAYING you!",
            f"Price dropped to {price:.2f}¢/kWh\nThey're paying you to use electricity right now!\nTime: {dt_local.strftime('%I:%M %p')}",
            "💰"
        )
    elif not current_is_negative and last_was_negative:
        send_notification(
            "Negative pricing ended",
            f"Price rose to {price:.2f}¢/kWh\nNo longer getting paid to use power.\nTime: {dt_local.strftime('%I:%M %p')}",
            "✅"
        )

    # === 10¢ MILESTONE ALERTS (improved for big moves) ===
    current_milestone = get_milestone(price)
    last_milestone = get_milestone(last_price)

    if current_milestone > last_milestone:
        for m in range(last_milestone + 10, current_milestone + 1, 10):
            send_notification(
                f"Price crossed {m}¢ upward",
                f"Price is now {price:.1f}¢/kWh\nCrossed the {m}¢ milestone.\nTime: {dt_local.strftime('%I:%M %p')}",
                "🔥"
            )
    elif current_milestone < last_milestone and last_milestone > 0:
        for m in range(last_milestone, current_milestone, -10):
            send_notification(
                f"Price dropped below {m}¢",
                f"Price is now {price:.1f}¢/kWh\nDropped below the {m}¢ level.\nTime: {dt_local.strftime('%I:%M %p')}",
                "📉"
            )

    # Save state
    state["last_price"] = price
    state["last_milestone"] = current_milestone
    save_state(state)

    if current_milestone == last_milestone:
        print("  No milestone transition — no alert sent.")

if __name__ == "__main__":
    main()
