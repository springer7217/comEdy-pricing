#!/usr/bin/env python3
"""
ComEd Hourly Price Alert Tool
=============================
Alerts you on meaningful price movements with ComEd's 5-minute Hourly Pricing.

What it watches:
- When prices drop to -0.01¢/kWh or below  → "ComEd is now paying you to use electricity!"
- When prices rise back above +0.01¢/kWh after being negative
- When prices spike above +10.0¢/kWh       → "High rates started!"
- When prices drop back below +10.0¢/kWh after being high

This gives you clean, useful notifications instead of constant spam while prices stay in one zone.

Designed to run on GitHub Actions (every 5 minutes) or locally with cron.

See README.md for full setup.
"""

import requests
import json
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# ==================== CONFIGURATION ====================
NEGATIVE_THRESHOLD = -0.01      # Enter "paid to use" territory
EXIT_NEGATIVE_THRESHOLD = 0.01  # Must rise above this to exit negative mode

HIGH_THRESHOLD = 10.0           # Enter "high price" territory (updated to 10¢)
EXIT_HIGH_THRESHOLD = 10.0      # Must fall below this to exit high mode

# These will automatically use GitHub Secrets when running in Actions.
NTFY_TOPIC = os.getenv("NTFY_TOPIC") or ""
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN") or ""
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID") or ""

STATE_FILE = "comed_alert_state.json"
LOG_FILE = "comed_price_log.txt"
# =======================================================

def get_current_price():
    """Fetch latest 5-min price from ComEd."""
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


def determine_zone(price):
    """Return current zone: 'negative', 'high', or 'normal'."""
    if price <= NEGATIVE_THRESHOLD:
        return "negative"
    elif price > HIGH_THRESHOLD:
        return "high"
    else:
        return "normal"


def send_notification(title, message, emoji="⚡"):
    """Send alert via ntfy or Telegram (or print if none configured)."""
    full_msg = f"{emoji} {title}\n\n{message}"

    sent = False

    if NTFY_TOPIC:
        try:
            r = requests.post(f"https://ntfy.sh/{NTFY_TOPIC}", data=full_msg, timeout=10)
            if r.status_code == 200:
                print("✅ Sent via ntfy.sh")
                sent = True
        except Exception as e:
            print(f"⚠️  ntfy error: {e}")

    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        try:
            tg_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {"chat_id": TELEGRAM_CHAT_ID, "text": full_msg}
            r = requests.post(tg_url, json=payload, timeout=10)
            if r.status_code == 200:
                print("✅ Sent via Telegram")
                sent = True
        except Exception as e:
            print(f"⚠️  Telegram error: {e}")

    if not sent:
        print("\n" + "=" * 60)
        print(full_msg)
        print("=" * 60 + "\n")


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"last_zone": "normal", "last_price": 0.0}


def save_state(state):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"⚠️  Could not save state: {e}")

def log_price(dt_local, price, zone):
    try:
        with open(LOG_FILE, "a") as f:
            f.write(f"{dt_local.isoformat()},{price:.2f},{zone}\n")
    except Exception as e:
        print(f"⚠️  Log error: {e}")


def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking ComEd price...")

    price, dt_local = get_current_price()
    if price is None:
        return

    current_zone = determine_zone(price)
    state = load_state()
    previous_zone = state.get("last_zone", "normal")

    log_price(dt_local, price, current_zone)

    print(f"  Price: {price:.2f}¢/kWh → Zone: {current_zone} (was {previous_zone})")

    # === TRANSITION LOGIC ===
    alert_sent = False

    # 1. Entered NEGATIVE zone (ComEd paying you)
    if previous_zone != "negative" and current_zone == "negative":
        title = "ComEd is now PAYING you!"
        msg = (f"Price dropped to {price:.2f}¢/kWh\n"
               f"This is ≤ {NEGATIVE_THRESHOLD}¢ — they're paying you to use electricity right now.\n"
               f"Time: {dt_local.strftime('%I:%M %p')}")
        send_notification(title, msg, "💰")
        alert_sent = True

    # 2. Exited NEGATIVE zone (back above +0.01)
    elif previous_zone == "negative" and current_zone != "negative":
        title = "Negative pricing ended"
        msg = (f"Price rose to {price:.2f}¢/kWh\n"
               f"No longer in the 'paid to use' zone (now above {EXIT_NEGATIVE_THRESHOLD}¢).\n"
               f"Time: {dt_local.strftime('%I:%M %p')}")
        send_notification(title, msg, "✅")
        alert_sent = True

    # 3. Entered HIGH zone (> 10.0¢)
    elif previous_zone != "high" and current_zone == "high":
        title = "High electricity rates started"
        msg = (f"Price jumped to {price:.2f}¢/kWh\n"
               f"Now above {HIGH_THRESHOLD}¢/kWh — expensive period.\n"
               f"Time: {dt_local.strftime('%I:%M %p')}")
        send_notification(title, msg, "🔥")
        alert_sent = True

    # 4. Exited HIGH zone (dropped back below 10.0¢)
    elif previous_zone == "high" and current_zone != "high":
        title = "High rates ended"
        msg = (f"Price dropped to {price:.2f}¢/kWh\n"
               f"No longer above {EXIT_HIGH_THRESHOLD}¢.\n"
               f"Time: {dt_local.strftime('%I:%M %p')}")
        send_notification(title, msg, "📉")
        alert_sent = True

    # Update state
    state["last_zone"] = current_zone
    state["last_price"] = price
    save_state(state)

    if not alert_sent:
        print("  No zone transition — no alert needed.")


if __name__ == "__main__":
    main()
