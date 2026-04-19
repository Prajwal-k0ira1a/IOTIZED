# ESP32 CNC Plotter Configuration
# ================================
# Configuration for handwriting/CNC plotter with stepper motors, servo, and limit switches

# ==================== WiFi Configuration ====================
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

# ==================== Timeout Configuration ====================
WIFI_CONNECT_TIMEOUT = 10000  # milliseconds
HTTP_REQUEST_TIMEOUT = 5  # seconds

# ==================== Web Server Configuration ====================
WEB_SERVER_HOST = "0.0.0.0"  # ESP32 will run its own server
WEB_SERVER_PORT = 8080
DEBUG = True

# ==================== Device Identification ====================
DEVICE_ID = "ESP32_PLOTTER_01"
DEVICE_NAME = "CNC Handwriting Plotter"

# ==================== Movement Configuration ====================
MOVEMENT = {
    "homing_speed": 500,  # Steps/sec for homing
    "feed_speed": 1000,  # Normal movement speed
    "rapid_speed": 2000,  # Fast movement speed
    "acceleration": 500,  # Acceleration rate
    "jog_step": 1,  # 1mm per jog step
    "default_z_feed": 50,  # Speed for pen up/down
}

# ==================== Stepper Motor Configuration ====================
# Stepper 1 - X Axis (Left/Right movement)
STEPPER_X = {
    "step_pin": 12,  # GPIO12 - Step signal
    "dir_pin": 14,  # GPIO14 - Direction signal
    "enable_pin": 13,  # GPIO13 - Enable/Disable
    "max_speed": 2000,  # Steps per second
    "acceleration": 500,  # Acceleration
    "steps_per_mm": 80,  # Adjust based on your motor/lead screw
    "home_position": 0,
    "max_position": 200,  # Max travel in mm
}

# Stepper 2 - Y Axis (Forward/Backward movement)
STEPPER_Y = {
    "step_pin": 27,  # GPIO27 - Step signal
    "dir_pin": 26,  # GPIO26 - Direction signal
    "enable_pin": 25,  # GPIO25 - Enable/Disable (or use for servo)
    "max_speed": 2000,  # Steps per second
    "acceleration": 500,
    "steps_per_mm": 80,  # Adjust based on your motor/lead screw
    "home_position": 0,
    "max_position": 200,  # Max travel in mm
}

# ==================== Servo Motor Configuration ====================
# Servo for pen up/down control
SERVO = {
    "pin": 25,  # GPIO25 - PWM pin for servo
    "frequency": 50,  # 50Hz for standard servo
    "min_duty": 25,  # Min duty cycle (0-100) - Pen DOWN
    "max_duty": 75,  # Max duty cycle (0-100) - Pen UP
    "pen_up_angle": 90,  # Degrees for pen UP
    "pen_down_angle": 0,  # Degrees for pen DOWN
}

# ==================== Limit Switch Configuration ====================
# Limit switches for homing and end-stops
LIMIT_SWITCHES = {
    "x_min": 35,  # GPIO35 - X axis minimum (home)
    "x_max": 36,  # GPIO36 - X axis maximum
    "y_min": 39,  # GPIO39 - Y axis minimum (home)
    "y_max": 34,  # GPIO34 - Y axis maximum
}

# ==================== Level Shifter Configuration ====================
# If using 5V components with ESP32, configure level shifter control
LEVEL_SHIFTER = {
    "enabled": True,
    "oe_pin": None,  # Output Enable pin (if needed)
}

# ==================== Movement Configuration ====================
MOVEMENT = {
    "homing_speed": 500,  # Steps/sec for homing
    "feed_speed": 1000,  # Normal movement speed
    "rapid_speed": 2000,  # Fast movement speed
    "acceleration": 500,  # Acceleration rate
    "jog_step": 1,  # 1mm per jog step
    "default_z_feed": 50,  # Speed for pen up/down
}

# ==================== Machine Limits ====================
MACHINE_LIMITS = {
    "x_min": 0,
    "x_max": 200,  # Max travel in X (mm)
    "y_min": 0,
    "y_max": 200,  # Max travel in Y (mm)
    "z_min": 0,  # Servo min
    "z_max": 100,  # Servo max (not actual distance)
}

# ==================== Sensor Read Intervals ====================
SENSOR_READ_INTERVAL = 100  # Read limit switches every 100ms
DATA_SEND_INTERVAL = 500  # Send status update every 500ms

# ==================== Communication ====================
BAUD_RATE = 115200
COMMAND_TIMEOUT = 5000  # milliseconds

# ==================== Motor Configuration ====================
MICROSTEPS = 1  # 1 = Full step, 2 = Half step, 4 = Quarter step, etc.
MOTOR_CURRENT_MA = 800  # Motor current in mA (if adjustable)

# ==================== Safety Configuration ====================
SAFETY = {
    "emergency_stop_enabled": True,
    "auto_home_on_startup": False,
    "check_limits": True,
    "soft_limits_enabled": True,
    "watchdog_timeout": 30000,  # milliseconds
    "enable_web_interface": True,
    "auto_home_on_startup": False,
}

# ==================== Pen Configuration ====================
PEN = {
    "pen_lift_height": 10,  # mm to lift pen
    "pen_down_speed": 50,  # mm/s for writing
    "dwell_time": 100,  # ms to wait before moving after pen down
}

# ==================== System Settings ====================
SYSTEM = {
    "debug": DEBUG,
    "log_to_file": False,
    "log_file": "/logs/plotter.log",
    "max_retries": 3,
    "retry_delay": 1000,
    "enable_web_interface": True,
    "web_port": WEB_SERVER_PORT,
}
