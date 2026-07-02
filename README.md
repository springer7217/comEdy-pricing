# comedy-pricing ⚡

**Smart alerts for ComEd Hourly Pricing spikes and negative prices.**

### What it alerts on now:

**1. Negative prices (ComEd paying you)**
- When price drops to -0.01¢ or below
- When price rises back above +0.01¢

**2. High price milestones (every 10¢)**
- Upward: Alerts when price crosses 10¢, 20¢, 30¢, 40¢...
- Downward: Alerts when price drops below 80¢, 70¢, 60¢, 50¢...

This is especially useful during extreme spikes (like the 87¢ we saw today).

## Current Thresholds
- Negative alerts: ≤ -0.01¢ and exit above +0.01¢
- High price milestones: Every 10¢ bracket

## How to Run
The tool runs automatically every 5 minutes via GitHub Actions.

You can also trigger it manually from the Actions tab.

## Notifications
Currently using ntfy.sh (`comedy-alert-7x9k2p`).

## Files
- `comed_hourly_price_alert.py` — Main logic
- State is saved in `comed_alert_state.json`
- Price history in `comed_price_log.txt`

Built for Lee in Chicago area during crazy summer price spikes.
