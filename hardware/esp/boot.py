# boot.py - ESP32 Initialization Script
# Runs automatically on startup before main.py
# Handles proper WiFi module initialization

import gc

import machine
import network
import utime

# Enable garbage collection to prevent memory issues
gc.enable()

# Disable verbose WiFi debug output
import esp

esp.osdebug(None)

# Clear any existing WiFi state
try:
    wlan = network.WLAN(network.STA_IF)
    wlan.active(False)
    utime.sleep_ms(500)
except Exception as e:
    print(f"[BOOT] WiFi cleanup: {e}")

# Clear AP mode if active
try:
    ap = network.WLAN(network.AP_IF)
    ap.active(False)
    utime.sleep_ms(500)
except Exception as e:
    print(f"[BOOT] AP cleanup: {e}")

# Print boot message
print("\n" + "=" * 50)
print("[BOOT] ESP32 Booting...")
print(f"[BOOT] Free memory: {gc.mem_free()} bytes")
print("[BOOT] Boot complete, starting main.py...")
print("=" * 50 + "\n")

utime.sleep_ms(500)

# main.py will run automatically after boot.py completes
