// ============================================================
//  IOTIZED CNC Pen Plotter - Arduino Firmware
//  Enhanced with JSON status reporting and web integration
//
//  Hardware:
//  - X/Y: Stepper motors via A4988/DRV8825 drivers
//  - Z:   Servo motor (Pen Up / Pen Down)
//  - Limit Switches: Optional for homing
//  - Serial USB communication with Node.js bridge
// ============================================================

#include <AccelStepper.h>
#include <ArduinoJson.h>
#include <Servo.h>

// ── Pin Definitions ─────────────────────────────────────────
#define X_STEP_PIN 2
#define X_DIR_PIN 5
#define Y_STEP_PIN 3
#define Y_DIR_PIN 6
#define ENABLE_PIN 8
#define SERVO_PIN 9

// Limit switches (optional)
#define X_MIN_PIN 10 // Limit switch X min
#define X_MAX_PIN 11 // Limit switch X max
#define Y_MIN_PIN 12 // Limit switch Y min
#define Y_MAX_PIN 13 // Limit switch Y max

// ── Machine Parameters ───────────────────────────────────────
#define STEPS_PER_MM 80   // Adjust based on your lead screw
#define MAX_SPEED 3000    // steps/sec
#define ACCELERATION 1500 // steps/sec²
#define JOG_DIST_MM 10.0  // default jog distance in mm
#define HOMING_SPEED 500  // slower speed for homing

// ── Servo Angles ─────────────────────────────────────────────
#define SERVO_PEN_UP 60    // degrees - pen lifted
#define SERVO_PEN_DOWN 120 // degrees - pen on paper
#define SERVO_DELAY 200    // ms to let servo settle

// ── Limits ───────────────────────────────────────────────────
#define MAX_X_MM 200.0
#define MAX_Y_MM 200.0
#define MIN_X_MM 0.0
#define MIN_Y_MM 0.0

// ── Objects ──────────────────────────────────────────────────
AccelStepper stepperX(AccelStepper::DRIVER, X_STEP_PIN, X_DIR_PIN);
AccelStepper stepperY(AccelStepper::DRIVER, Y_STEP_PIN, Y_DIR_PIN);
Servo penServo;

// ── State ────────────────────────────────────────────────────
struct PlotterState {
  float x;
  float y;
  bool penDown;
  bool isMoving;
  bool isHomed;
  bool emergencyStop;
  unsigned long lastUpdate;
  int errorCode;
  String errorMsg;
} state;

float jogDist = JOG_DIST_MM;
bool limitSwitchesEnabled = true;
unsigned long lastStatusPrint = 0;
const unsigned long STATUS_INTERVAL = 500; // ms

// ============================================================
void setup() {
  Serial.begin(115200);

  delay(1000); // Wait for serial connection

  // Initialize pins
  pinMode(ENABLE_PIN, OUTPUT);
  pinMode(X_MIN_PIN, INPUT_PULLUP);
  pinMode(X_MAX_PIN, INPUT_PULLUP);
  pinMode(Y_MIN_PIN, INPUT_PULLUP);
  pinMode(Y_MAX_PIN, INPUT_PULLUP);

  // Enable stepper drivers (active LOW)
  digitalWrite(ENABLE_PIN, LOW);

  // Configure steppers
  stepperX.setMaxSpeed(MAX_SPEED);
  stepperX.setAcceleration(ACCELERATION);
  stepperY.setMaxSpeed(MAX_SPEED);
  stepperY.setAcceleration(ACCELERATION);

  // Initialize servo
  penServo.attach(SERVO_PIN);
  penUp();

  // Initialize state
  state.x = 0;
  state.y = 0;
  state.penDown = false;
  state.isMoving = false;
  state.isHomed = false;
  state.emergencyStop = false;
  state.lastUpdate = millis();
  state.errorCode = 0;
  state.errorMsg = "";

  Serial.println();
  Serial.println(F("╔════════════════════════════════════════════╗"));
  Serial.println(F("║  IOTIZED CNC Pen Plotter - Arduino Ready   ║"));
  Serial.println(F("╚════════════════════════════════════════════╝"));
  Serial.println();

  sendStatusJSON();
  printHelp();
}

// ============================================================
void loop() {
  // Run steppers
  stepperX.run();
  stepperY.run();

  // Update moving state
  state.isMoving =
      (stepperX.distanceToGo() != 0 || stepperY.distanceToGo() != 0);

  // Sync position from stepper position
  state.x = stepperX.currentPosition() / (float)STEPS_PER_MM;
  state.y = stepperY.currentPosition() / (float)STEPS_PER_MM;

  // Periodic status output (optional)
  if (millis() - lastStatusPrint > STATUS_INTERVAL) {
    // Uncomment to send periodic status updates
    // sendStatusJSON();
    lastStatusPrint = millis();
  }

  // Handle serial commands
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.length() > 0) {
      handleCommand(cmd);
    }
  }
}

// ============================================================
// Command Handler
// ============================================================
void handleCommand(String cmd) {
  cmd.toUpperCase();

  // Clear previous error
  state.errorCode = 0;
  state.errorMsg = "";

  if (cmd == "X+")
    jogMove(jogDist, 0);
  else if (cmd == "X-")
    jogMove(-jogDist, 0);
  else if (cmd == "Y+")
    jogMove(0, jogDist);
  else if (cmd == "Y-")
    jogMove(0, -jogDist);
  else if (cmd == "Z+")
    penDown();
  else if (cmd == "Z-")
    penUp();
  else if (cmd == "HOME")
    homeAll();
  else if (cmd == "ZERO")
    setZero();
  else if (cmd == "STOP")
    emergencyStop();
  else if (cmd == "STATUS")
    sendStatusJSON();
  else if (cmd == "HELP")
    printHelp();

  else if (cmd.startsWith("DIST:")) {
    float d = getValue(cmd, ':');
    if (d > 0 && d <= 50) {
      jogDist = d;
      state.errorCode = 0;
      sendSimpleResponse("OK",
                         "Jog distance set to " + String(jogDist, 1) + " mm");
    } else {
      setError(1, "Invalid distance (0-50mm)");
    }
  }

  else if (cmd.startsWith("GOTO:")) {
    // GOTO:x,y
    String args = cmd.substring(5);
    int comma = args.indexOf(',');
    if (comma > 0) {
      float tx = args.substring(0, comma).toFloat();
      float ty = args.substring(comma + 1).toFloat();
      if (isWithinLimits(tx, ty)) {
        moveTo(tx, ty);
      } else {
        setError(2, "Target out of bounds");
      }
    } else {
      setError(3, "Format: GOTO:x,y");
    }
  }

  else if (cmd.startsWith("SPEED:")) {
    float spd = getValue(cmd, ':');
    if (spd > 0 && spd <= 5000) {
      stepperX.setMaxSpeed(spd);
      stepperY.setMaxSpeed(spd);
      sendSimpleResponse("OK", "Speed set to " + String(spd) + " steps/sec");
    } else {
      setError(4, "Invalid speed (1-5000)");
    }
  }

  else if (cmd.startsWith("ACCEL:")) {
    float acc = getValue(cmd, ':');
    if (acc > 0 && acc <= 5000) {
      stepperX.setAcceleration(acc);
      stepperY.setAcceleration(acc);
      sendSimpleResponse("OK",
                         "Acceleration set to " + String(acc) + " steps/sec²");
    } else {
      setError(5, "Invalid acceleration (1-5000)");
    }
  }

  else if (cmd == "LIMITS:ON") {
    limitSwitchesEnabled = true;
    sendSimpleResponse("OK", "Limit switches enabled");
  }

  else if (cmd == "LIMITS:OFF") {
    limitSwitchesEnabled = false;
    sendSimpleResponse("OK", "Limit switches disabled");
  }

  else if (cmd == "LIMITS:CHECK") {
    checkLimits();
  }

  else {
    setError(99, "Unknown command: " + cmd);
  }

  // Always send status after command
  sendStatusJSON();
}

// ============================================================
// Movement Functions
// ============================================================
void jogMove(float dx, float dy) {
  float newX = state.x + dx;
  float newY = state.y + dy;
  moveTo(newX, newY);
}

void moveTo(float x, float y) {
  if (!isWithinLimits(x, y)) {
    setError(2, "Target out of bounds");
    return;
  }

  long sx = (long)(x * STEPS_PER_MM);
  long sy = (long)(y * STEPS_PER_MM);

  stepperX.moveTo(sx);
  stepperY.moveTo(sy);

  // Block until done
  while (stepperX.distanceToGo() != 0 || stepperY.distanceToGo() != 0) {
    stepperX.run();
    stepperY.run();

    // Check for emergency stop
    if (Serial.available()) {
      String cmd = Serial.readStringUntil('\n');
      if (cmd == "STOP") {
        emergencyStop();
        return;
      }
    }
  }
}

void homeAll() {
  Serial.println(F("Homing..."));
  penUp();

  // Home X
  stepperX.setMaxSpeed(HOMING_SPEED);
  while (digitalRead(X_MIN_PIN) == HIGH) {
    stepperX.move(-1);
    stepperX.runSpeed();
    delay(5);
  }
  stepperX.setCurrentPosition(0);
  stepperX.setMaxSpeed(MAX_SPEED);

  // Home Y
  stepperY.setMaxSpeed(HOMING_SPEED);
  while (digitalRead(Y_MIN_PIN) == HIGH) {
    stepperY.move(-1);
    stepperY.runSpeed();
    delay(5);
  }
  stepperY.setCurrentPosition(0);
  stepperY.setMaxSpeed(MAX_SPEED);

  state.x = 0;
  state.y = 0;
  state.isHomed = true;

  sendSimpleResponse("OK", "Homing complete");
}

void setZero() {
  stepperX.setCurrentPosition(0);
  stepperY.setCurrentPosition(0);
  state.x = 0;
  state.y = 0;
  sendSimpleResponse("OK", "Position zeroed");
}

void penUp() {
  penServo.write(SERVO_PEN_UP);
  state.penDown = false;
  delay(SERVO_DELAY);
}

void penDown() {
  penServo.write(SERVO_PEN_DOWN);
  state.penDown = true;
  delay(SERVO_DELAY);
}

void emergencyStop() {
  stepperX.stop();
  stepperY.stop();
  penUp();
  state.emergencyStop = true;

  // Sync positions
  state.x = stepperX.currentPosition() / (float)STEPS_PER_MM;
  state.y = stepperY.currentPosition() / (float)STEPS_PER_MM;

  sendSimpleResponse("EMERGENCY_STOP", "Motors stopped, pen lifted");
}

// ============================================================
// Limit Checking
// ============================================================
bool isWithinLimits(float x, float y) {
  return (x >= MIN_X_MM && x <= MAX_X_MM && y >= MIN_Y_MM && y <= MAX_Y_MM);
}

void checkLimits() {
  StaticJsonDocument<256> doc;

  doc["type"] = "limits";
  doc["x_min"] = digitalRead(X_MIN_PIN) == LOW;
  doc["x_max"] = digitalRead(X_MAX_PIN) == LOW;
  doc["y_min"] = digitalRead(Y_MIN_PIN) == LOW;
  doc["y_max"] = digitalRead(Y_MAX_PIN) == LOW;

  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

// ============================================================
// JSON Status Reporting
// ============================================================
void sendStatusJSON() {
  StaticJsonDocument<512> doc;

  doc["type"] = "status";
  doc["device_id"] = "ARDUINO_PLOTTER_01";
  doc["device_name"] = "CNC Handwriting Plotter";
  doc["timestamp"] = millis();

  // Position
  JsonObject pos = doc.createNestedObject("position");
  pos["x"] = round(state.x * 100) / 100.0;
  pos["y"] = round(state.y * 100) / 100.0;

  // Pen state
  JsonObject pen = doc.createNestedObject("pen");
  pen["is_down"] = state.penDown;

  // Machine state
  doc["is_homed"] = state.isHomed;
  doc["is_moving"] = state.isMoving;
  doc["emergency_stop"] = state.emergencyStop;

  // Limits
  JsonObject limits = doc.createNestedObject("limits");
  limits["x_min"] = digitalRead(X_MIN_PIN) == LOW;
  limits["x_max"] = digitalRead(X_MAX_PIN) == LOW;
  limits["y_min"] = digitalRead(Y_MIN_PIN) == LOW;
  limits["y_max"] = digitalRead(Y_MAX_PIN) == LOW;

  // Bounds
  JsonObject bounds = doc.createNestedObject("bounds");
  bounds["x_max"] = MAX_X_MM;
  bounds["y_max"] = MAX_Y_MM;

  // Error
  if (state.errorCode != 0) {
    JsonObject error = doc.createNestedObject("error");
    error["code"] = state.errorCode;
    error["message"] = state.errorMsg;
  }

  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

void sendSimpleResponse(const char *status, const String &message) {
  StaticJsonDocument<256> doc;
  doc["type"] = "response";
  doc["status"] = status;
  doc["message"] = message;
  doc["timestamp"] = millis();

  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

// ============================================================
// Error Handling
// ============================================================
void setError(int code, const String &msg) {
  state.errorCode = code;
  state.errorMsg = msg;

  StaticJsonDocument<256> doc;
  doc["type"] = "error";
  doc["code"] = code;
  doc["message"] = msg;
  doc["timestamp"] = millis();

  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

// ============================================================
// Utility Functions
// ============================================================
float getValue(String cmd, char delimiter) {
  int idx = cmd.indexOf(delimiter);
  if (idx > 0) {
    return cmd.substring(idx + 1).toFloat();
  }
  return 0;
}

void printHelp() {
  Serial.println();
  Serial.println(F("╔════════════════════════════════════════════╗"));
  Serial.println(F("║            Available Commands              ║"));
  Serial.println(F("╚════════════════════════════════════════════╝"));
  Serial.println();

  Serial.println(F("MOVEMENT:"));
  Serial.println(F("  X+                 Jog X axis forward"));
  Serial.println(F("  X-                 Jog X axis backward"));
  Serial.println(F("  Y+                 Jog Y axis forward"));
  Serial.println(F("  Y-                 Jog Y axis backward"));
  Serial.println(F("  GOTO:x,y           Move to absolute position (mm)"));
  Serial.println(F("  DIST:value         Set jog distance (mm)"));
  Serial.println();

  Serial.println(F("PEN CONTROL:"));
  Serial.println(F("  Z+                 Pen DOWN"));
  Serial.println(F("  Z-                 Pen UP"));
  Serial.println();

  Serial.println(F("HOMING & CALIBRATION:"));
  Serial.println(F("  HOME               Home all axes"));
  Serial.println(F("  ZERO               Set current position as 0,0"));
  Serial.println(F("  LIMITS:CHECK       Check limit switch status"));
  Serial.println();

  Serial.println(F("CONFIGURATION:"));
  Serial.println(F("  SPEED:value        Set max speed (steps/sec)"));
  Serial.println(F("  ACCEL:value        Set acceleration (steps/sec²)"));
  Serial.println(F("  LIMITS:ON          Enable limit switches"));
  Serial.println(F("  LIMITS:OFF         Disable limit switches"));
  Serial.println();

  Serial.println(F("SYSTEM:"));
  Serial.println(F("  STATUS             Print current status (JSON)"));
  Serial.println(F("  STOP               Emergency stop"));
  Serial.println(F("  HELP               Show this help"));
  Serial.println();
}
