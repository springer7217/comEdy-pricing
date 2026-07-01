# comedy-pricing ⚡

**Alerts you when ComEd Hourly Pricing does something interesting.**

Specifically:
- **ComEd starts paying you** (price ≤ -0.01¢/kWh)
- **Paid-to-use period ends** (price rises back above +0.01¢/kWh)
- **High rates begin** (price > +10.0¢/kWh)
- **High rates end** (price drops back below +10.0¢/kWh)

This gives you clean, actionable notifications instead of spam while prices stay in one zone.

Perfect for:
- Running EV chargers, pre-cooling the house, or doing laundry when ComEd is literally paying you
- Knowing when expensive periods start and end so you can avoid them

## How it works

The script checks the public ComEd 5-minute pricing API and tracks **zone transitions**:

| Zone       | Condition              | What happens |
|------------|------------------------|--------------|
| `negative` | ≤ -0.01¢/kWh           | "ComEd is now PAYING you!" |
| `high`     | > +10.0¢/kWh           | "High electricity rates started" |
| `normal`   | Everything else        | Quiet (unless transitioning) |

It only sends alerts when you **enter or exit** these zones.

## Project Structure

```
comedy-pricing/
├── comed_hourly_price_alert.py   # The brain
├── README.md
├── requirements.txt
├── .gitignore
├── comed_alert_state.json        # Auto-created (remembers last zone)
└── comed_price_log.txt           # Auto-created (full price history)
```

## Quick Setup

### 1. Clone or download
```bash
git clone https://github.com/YOUR_USERNAME/comedy-pricing.git
cd comedy-pricing
```

### 2. Install dependency
```bash
pip install -r requirements.txt
```

### 3. Configure notifications (choose one)

**Easiest: ntfy.sh (free phone push)**
- Pick a secret topic, e.g. `lee-comedy-alert-xyz123`
- Install the free **ntfy** app on your phone and subscribe
- Edit `comed_hourly_price_alert.py` and set:
  ```python
  NTFY_TOPIC = "lee-comedy-alert-xyz123"
  ```

**Alternative: Telegram**
- Message `@BotFather` → `/newbot`
- Copy the token and your chat ID
- Fill in the two Telegram variables in the script

### 4. Test it
```bash
python3 comed_hourly_price_alert.py
```

### 5. Run automatically (every 5 minutes)

**GitHub Actions (recommended - free, no computer needed)**
- Already set up in `.github/workflows/`
- It runs automatically on a schedule

**Or locally with cron (Linux/Mac/Pi):**
```bash
crontab -e
```
Add:
```cron
*/5 * * * * cd /path/to/comedy-pricing && python3 comed_hourly_price_alert.py
```

## Why "comedy-pricing"?

Because negative electricity prices are objectively funny. ComEd is paying you to use power. We lean into the humor.

## Future ideas (we can build these together)
- A simple web dashboard showing current price + last 24h chart (hostable on Netlify)
- Better historical graphs
- Integration with Home Assistant or smart plugs
- Daily/weekly summary emails

---

Built with ❤️ and a healthy sense of humor about Illinois electricity prices.
