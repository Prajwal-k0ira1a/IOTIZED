# IOTIZED CNC Plotter - System Architecture

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        IOTIZED SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  HARDWARE LAYER  │         │  HARDWARE LAYER  │              │
│  │   (Arduino)      │         │    (ESP32)       │              │
│  ├──────────────────┤         ├──────────────────┤              │
│  │ Stepper Motors   │         │ Stepper Motors   │              │
│  │ Servo Motor      │         │ Servo Motor      │              │
│  │ Limit Switches   │         │ Limit Switches   │              │
│  └────────┬─────────┘         └────────┬─────────┘              │
│           │ USB Serial                 │ WiFi                   │
│           │                            │                        │
│  ┌────────▼─────────┐         ┌────────▼─────────┐              │
│  │  FIRMWARE LAYER  │         │  FIRMWARE LAYER  │              │
│  │ (Arduino Sketch) │         │ (MicroPython)    │              │
│  └────────┬─────────┘         └────────┬─────────┘              │
│           │                            │                        │
│  ┌────────▼─────────────────────────────────────────────────┐   │
│  │          SERVER/BRIDGE LAYER (Node.js)                  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  arduino-bridge.js (Serial)  │  index.js (WiFi/ESP32)  │   │
│  │  ┌─────────────────────┐     │  ┌─────────────────────┐│   │
│  │  │ Serial Port Handler │     │  │ HTTP Server (8080)  ││   │
│  │  │ Command Queue       │     │  │ WebSocket Handler   ││   │
│  │  │ JSON Parser         │     │  │ Status Broadcaster  ││   │
│  │  └─────────────────────┘     │  └─────────────────────┘│   │
│  │  REST API (Port 5000/5001)   │  REST API (Port 5000)    │   │
│  │  WebSocket Handler            │  WebSocket Handler       │   │
│  └────────┬─────────────────────────────────────────────────┘   │
│           │ HTTP/WebSocket                                      │
│           │                                                     │
│  ┌────────▼─────────────────────────────────────────────────┐   │
│  │           UI/CLIENT LAYER (React/Vite)                  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────────┐  ┌──────────────────┐            │   │
│  │  │  Terminal View   │  │  Controls View   │            │   │
│  │  ├──────────────────┤  ├──────────────────┤            │   │
│  │  │ Command Input    │  │ Jog Buttons      │            │   │
│  │  │ Status Display   │  │ Movement Control │            │   │
│  │  │ History Log      │  │ Pen Control      │            │   │
│  │  │ Real-time Output │  │ Status Display   │            │   │
│  │  └──────────────────┘  └──────────────────┘            │   │
│  │  http://localhost:5173                                 │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow Diagram

### From Terminal UI to Hardware (Command Flow)

```
USER INPUT
    │
    ▼
┌─────────────────────────────────┐
│  IOTIZED Terminal UI (React)    │
│  ┌─────────────────────────────┐│
│  │ Input: "move 10 20"         ││
│  └────────────┬────────────────┘│
└───────────────┼─────────────────┘
                │ HTTP POST / WebSocket
                ▼
┌─────────────────────────────────┐
│  Backend Bridge Server          │
│  ┌─────────────────────────────┐│
│  │ Parse Command               ││
│  │ Convert to Hardware Format   ││
│  │ Queue Command               ││
│  │ Send via Serial/WiFi        ││
│  └────────────┬────────────────┘│
└───────────────┼─────────────────┘
                │ Serial (115200 baud)
                ▼
┌─────────────────────────────────┐
│  Arduino / ESP32 Firmware       │
│  ┌─────────────────────────────┐│
│  │ Receive "GOTO:10,20"        ││
│  │ Parse Command               ││
│  │ Calculate Steps Needed       ││
│  │ Control Motors              ││
│  └────────────┬────────────────┘│
└───────────────┼─────────────────┘
                │ GPIO Control
                ▼
┌─────────────────────────────────┐
│  CNC Shield / Stepper Drivers   │
│  ┌─────────────────────────────┐│
│  │ A4988 Driver #1 (X-axis)    ││
│  │ A4988 Driver #2 (Y-axis)    ││
│  └────────────┬────────────────┘│
└───────────────┼─────────────────┘
                │ Motor Control
                ▼
┌─────────────────────────────────┐
│  Physical Hardware              │
│  ┌─────────────────────────────┐│
│  │ NEMA Stepper Motor X         ││
│  │ NEMA Stepper Motor Y         ││
│  │ Servo Motor (Pen Control)    ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
        ↓ MOVEMENT HAPPENS ↓
```

### From Hardware to Terminal UI (Status Flow)

```
HARDWARE
    │
    ▼
┌─────────────────────────────────┐
│  Arduino / ESP32 Firmware       │
│  ┌─────────────────────────────┐│
│  │ Read Current Position        ││
│  │ Read Sensor Data             ││
│  │ Generate JSON Status         ││
│  │ Send via Serial/WiFi         ││
│  └────────────┬────────────────┘│
└───────────────┼─────────────────┘
                │ Serial / HTTP POST
                ▼
┌─────────────────────────────────┐
│  Backend Bridge Server          │
│  ┌─────────────────────────────┐│
│  │ Receive JSON Status          ││
│  │ Parse Status Data            ││
│  │ Update Machine State         ││
│  │ Broadcast to UI              ││
│  └────────────┬────────────────┘│
└───────────────┼─────────────────┘
                │ WebSocket Update
                ▼
┌─────────────────────────────────┐
│  IOTIZED Terminal UI (React)    │
│  ┌─────────────────────────────┐│
│  │ Receive Status Update        ││
│  │ Update Display:              ││
│  │  Position: X=10.0 Y=20.0     ││
│  │  Pen: UP                     ││
│  │  Homed: YES                  ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

## 🔗 Connection Architecture

### Arduino Path

```
┌──────────────────────────────────────────────────────────────┐
│                    ARDUINO SETUP                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  HARDWARE CONNECTIONS:                                       │
│  ┌─────────────────────┐                                     │
│  │ Arduino UNO         │                                     │
│  │ ┌─────────────────┐ │                                     │
│  │ │ USB Cable       │ │ → Computer                          │
│  │ │ Pin 2: X_STEP   │ │ → CNC Shield                        │
│  │ │ Pin 5: X_DIR    │ │ → CNC Shield                        │
│  │ │ Pin 3: Y_STEP   │ │ → CNC Shield                        │
│  │ │ Pin 6: Y_DIR    │ │ → CNC Shield                        │
│  │ │ Pin 8: ENABLE   │ │ → CNC Shield                        │
│  │ │ Pin 9: Servo    │ │ → Servo Motor                       │
│  │ │ Pin 10-13: Limits│ │ → Limit Switches                  │
│  │ └─────────────────┘ │                                     │
│  └─────────────────────┘                                     │
│                                                              │
│  FIRMWARE:                                                   │
│  - arduino_plotter.ino (115200 baud)                         │
│  - Supports JSON status reporting                            │
│  - Command format: GOTO:x,y, HOME, Z+/Z-, etc.              │
│                                                              │
│  BRIDGE:                                                     │
│  - arduino-bridge.js                                         │
│  - Serial port handler (default: /dev/ttyUSB0)              │
│  - REST API on port 5000                                    │
│  - WebSocket for real-time updates                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### ESP32 Path

```
┌──────────────────────────────────────────────────────────────┐
│                    ESP32 SETUP                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  HARDWARE CONNECTIONS:                                       │
│  ┌─────────────────────┐                                     │
│  │ ESP32 Board         │                                     │
│  │ ┌─────────────────┐ │                                     │
│  │ │ GPIO12: X_STEP  │ │ → CNC Shield                        │
│  │ │ GPIO14: X_DIR   │ │ → CNC Shield                        │
│  │ │ GPIO27: Y_STEP  │ │ → CNC Shield                        │
│  │ │ GPIO26: Y_DIR   │ │ → CNC Shield                        │
│  │ │ GPIO25: ENABLE  │ │ → CNC Shield                        │
│  │ │ GPIO25: Servo   │ │ → Servo Motor (PWM)                │
│  │ │ GPIO34-39: Limits│ │ → Limit Switches                  │
│  │ │ WiFi            │ │ → Local Network                     │
│  │ └─────────────────┘ │                                     │
│  └─────────────────────┘                                     │
│                                                              │
│  FIRMWARE:                                                   │
│  - MicroPython (config.py + main.py)                         │
│  - Built-in HTTP server on port 8080                         │
│  - Endpoints: /move, /home, /pen, /jog, /status              │
│                                                              │
│  BRIDGE:                                                     │
│  - index.js (server/index.js)                                │
│  - HTTP client to ESP32                                      │
│  - REST API on port 5000                                    │
│  - WebSocket for real-time updates                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 📡 API Endpoints

### Arduino Bridge (Port 5000)

```
╔═══════════════════════════════════════════════════════════╗
║  Arduino Serial Bridge - REST API                        ║
╚═══════════════════════════════════════════════════════════╝

GET /health
  └─ Check connection status to Arduino

GET /api/status
  └─ Get current machine state

POST /api/command
  └─ Send raw command (format: {"command": "HOME"})
  
GET /api/move/:x/:y
  └─ Move to coordinates

GET /api/jog/:axis/:direction
  └─ Jog axis (axis=x|y, direction=1|-1)

GET /api/home
  └─ Home all axes

GET /api/pen/:state
  └─ Control pen (state=up|down|toggle)
```

### ESP32 Direct (Port 8080)

```
╔═══════════════════════════════════════════════════════════╗
║  ESP32 Built-in HTTP Server                              ║
╚═══════════════════════════════════════════════════════════╝

GET /status
  └─ Get machine status

GET /home
  └─ Home all axes

GET /move/:x/:y
  └─ Move to coordinates

GET /jog/:axis/:direction/:distance
  └─ Jog axis

GET /pen/up
GET /pen/down
GET /pen/toggle
  └─ Control pen
```

## 🔄 Command Processing Flow

### Arduino Path (Step-by-step)

```
1. USER SENDS COMMAND
   ↓
   Terminal: "move 10 20"

2. IOTIZED UI PROCESSES
   ↓
   HTTP POST /api/command
   Body: {"action": "move", "x": 10, "y": 20}

3. BACKEND BRIDGE PROCESSES
   ↓
   - Parse command
   - Convert to Arduino format: "GOTO:10,20"
   - Add to command queue
   - Send via serial: "GOTO:10,20\n"

4. ARDUINO FIRMWARE PROCESSES
   ↓
   - Receive: "GOTO:10,20"
   - Parse X=10, Y=20
   - Convert to steps: x_steps = 10 * 80, y_steps = 20 * 80
   - Configure A4988 drivers (direction, speed)
   - Control GPIO pins to generate step pulses
   - Move steppers to target position

5. STEPPER DRIVERS CONTROL
   ↓
   - A4988 receives step pulses from Arduino GPIO
   - Amplifies signals to stepper motor coils
   - Motors receive 12V power and rotate

6. STATUS RESPONSE
   ↓
   - Arduino generates JSON:
     {"type":"status","position":{"x":10.0,"y":20.0},...}
   - Sends via serial to bridge
   - Bridge receives and parses JSON
   - Bridge broadcasts via WebSocket to UI
   - UI updates display: "Position: X=10.0 Y=20.0"
```

### ESP32 Path (Faster - Wireless)

```
1. USER SENDS COMMAND
   ↓
   Terminal: "move 10 20"

2. IOTIZED UI PROCESSES
   ↓
   WebSocket message: {"action": "move", "x": 10, "y": 20}

3. BACKEND BRIDGE PROCESSES
   ↓
   - Convert to ESP32 format: /move/10/20
   - HTTP GET to ESP32 (192.168.1.50:8080)

4. ESP32 FIRMWARE PROCESSES (Same as Arduino)
   ↓
   - Receive HTTP request
   - Parse parameters
   - Calculate steps and control GPIO

5. ESP32 STATUS BROADCAST
   ↓
   - ESP32 sends status via POST to bridge
   - OR bridge polls /status endpoint
   - Bridge broadcasts to UI via WebSocket
   - UI updates in real-time
```

## 📊 Real-time Status Updates

```
╔════════════════════════════════════════════════════════╗
║  WebSocket Real-time Flow                             ║
╚════════════════════════════════════════════════════════╝

HARDWARE (Arduino/ESP32)
    │
    ├─ Every 500ms or after command completion
    │
    ├─ Generate Status JSON
    │  {
    │    "position": {"x": 50.2, "y": 30.5},
    │    "pen": {"is_down": false},
    │    "is_homed": true,
    │    "limits": {...}
    │  }
    │
    ▼
BRIDGE SERVER (Node.js)
    │
    ├─ Receive status
    ├─ Parse JSON
    ├─ Update machineState object
    │
    ├─ Broadcast to ALL connected WebSocket clients:
    │  {
    │    "type": "state_update",
    │    "data": {...}
    │  }
    │
    ▼
UI CLIENTS (React)
    │
    ├─ Receive WebSocket message
    ├─ Update React state
    │
    └─ Re-render components:
       - TerminalView: Show position
       - ControlsView: Update display
       - StatusBar: Show latest data
```

## 🔐 Data Formats

### Command Format (Terminal Input)

```
TERMINAL INPUT          INTERNAL FORMAT         HARDWARE FORMAT
═════════════════════════════════════════════════════════════════

home                 → action: "home"      → GOTO:0,0

move 10 20           → action: "move"      → GOTO:10,20
                       x: 10, y: 20

pen up               → action: "pen_up"    → Z-

pen down             → action: "pen_down"  → Z+

jog x +5             → action: "jog_x"     → X+
                       direction: 1
                       distance: 5

status               → action: "status"    → STATUS
```

### Status JSON Format

```json
{
  "type": "status",
  "device_id": "ARDUINO_PLOTTER_01",
  "device_name": "CNC Handwriting Plotter",
  "timestamp": 1234567890,
  "position": {
    "x": 50.25,
    "y": 30.75
  },
  "pen": {
    "is_down": false
  },
  "is_homed": true,
  "is_moving": false,
  "emergency_stop": false,
  "limits": {
    "x_min": false,
    "x_max": false,
    "y_min": false,
    "y_max": false
  },
  "bounds": {
    "x_max": 200,
    "y_max": 200
  },
  "error": null
}
```

## 🚀 Startup Sequence

```
1. START HARDWARE
   └─ Connect Arduino/ESP32 via USB/WiFi
   └─ Power on stepper drivers and servo

2. UPLOAD FIRMWARE
   └─ Arduino: Upload arduino_plotter.ino
   └─ ESP32: Copy config.py and main.py

3. START BRIDGE SERVER
   Terminal 1:
   $ cd IOTIZED/server
   $ npm install
   $ node arduino-bridge.js
   
   Output: "Serial Bridge Ready!"

4. START UI SERVER
   Terminal 2:
   $ cd IOTIZED
   $ npm run dev
   
   Output: "Local: http://localhost:5173"

5. OPEN WEB UI
   Browser:
   $ Open http://localhost:5173
   $ Click "Terminal" tab

6. SEND FIRST COMMAND
   Terminal UI:
   > home
   
   Expected:
   "Moving to home..."
   "Position: X=0.0 Y=0.0"
```

## 🔍 Debugging Workflow

```
ISSUE OCCURS
   │
   ├─ Check Hardware
   │  └─ Is power on?
   │  └─ Are connections correct?
   │  └─ Are motors responding to manual commands?
   │
   ├─ Check Arduino/ESP32
   │  └─ Open Serial Monitor (Arduino)
   │  └─ Send: HELP
   │  └─ Send: STATUS
   │  └─ Look for error messages
   │
   ├─ Check Bridge
   │  └─ Is it running?
   │  └─ Check console output
   │  └─ Error messages?
   │  └─ Serial connection established?
   │
   ├─ Check UI
   │  └─ Open browser console (F12)
   │  └─ Check WebSocket connection
   │  └─ Are commands being sent?
   │  └─ What responses received?
   │
   └─ Resolution
      └─ Fix the layer where issue is
      └─ Re-test
```

## 📁 File Organization

```
IOTIZED/
├── hardware/
│   ├── arduino/
│   │   ├── arduino_plotter.ino      ← UPLOAD TO ARDUINO
│   │   ├── QUICKSTART.md
│   │   └── README.md
│   ├── esp/
│   │   ├── config.py                ← EDIT & UPLOAD TO ESP32
│   │   ├── main.py                  ← UPLOAD TO ESP32
│   │   └── README.md
│   ├── SETUP_GUIDE.md
│   └── README.md
│
├── server/
│   ├── index.js                     ← ESP32 BRIDGE (RUN: npm start)
│   ├── arduino-bridge.js            ← ARDUINO BRIDGE (RUN: node arduino-bridge.js)
│   ├── package.json
│   └── README.md
│
├── src/
│   ├── components/
│   │   ├── TerminalView.jsx         ← WHERE YOU SEND COMMANDS
│   │   ├── ControlsView.jsx
│   │   └── ...
│   ├── App.jsx
│   └── main.jsx
│
├── package.json
├── vite.config.js
└── SYSTEM_ARCHITECTURE.md           ← YOU ARE HERE
```

## 🎯 Quick Reference

### To Control Your Plotter

1. **Start everything**
   ```bash
   # Terminal 1
   cd IOTIZED/server
   node arduino-bridge.js
   
   # Terminal 2
   cd IOTIZED
   npm run dev
   ```

2. **Open IOTIZED Terminal tab**
   http://localhost:5173

3. **Send commands**
   ```
   home                    # Home all axes
   move 50 50             # Move to position
   pen down               # Lower pen
   jog x +10              # Move X +10mm
   status                 # Get status
   ```

### To Debug Issues

1. **Check Arduino Serial Monitor**
   - Tools → Serial Monitor (115200 baud)
   - Type: HELP, STATUS

2. **Check Bridge Console**
   - Look for error messages
   - Check serial connection status

3. **Check UI Browser Console**
   - F12 → Console
   - Look for WebSocket messages

4. **Check Hardware**
   - Is power on?
   - Are connections correct?
   - Can you move motors manually?

## 🔄 System Integration Points

```
React UI
   │
   ├─ REST API Calls (HTTP)
   ├─ WebSocket Messages
   │
   ▼
Node.js Bridge Server
   │
   ├─ Serial Communication (Arduino) or
   ├─ HTTP Requests (ESP32)
   │
   ▼
Arduino/ESP32 Firmware
   │
   ├─ GPIO Control
   ├─ Motor Drivers (A4988/CNC Shield)
   ├─ Servo Control
   │
   ▼
Physical Hardware
   (Steppers, Servo, Limit Switches)
```

---

**For detailed setup instructions, see:**
- Arduino: `hardware/arduino/QUICKSTART.md`
- ESP32: `hardware/esp/README.md`
- General: `hardware/SETUP_GUIDE.md`

**For server documentation, see:**
- Server: `server/README.md`
