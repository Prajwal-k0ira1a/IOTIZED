import machine
import network
import ujson
import usocket as socket
import utime
from config import *
from machine import PWM, Pin, Timer


class StepperMotor:
    """Control a stepper motor with step and direction pins"""

    def __init__(self, name, step_pin, dir_pin, enable_pin, steps_per_mm):
        self.name = name
        self.step_pin = Pin(step_pin, Pin.OUT)
        self.dir_pin = Pin(dir_pin, Pin.OUT)
        self.enable_pin = Pin(enable_pin, Pin.OUT)
        self.steps_per_mm = steps_per_mm

        self.position = 0  # Current position in steps
        self.position_mm = 0  # Current position in mm
        self.direction = 0  # 0 = forward, 1 = backward
        self.is_enabled = False
        self.is_moving = False

        self.disable()
        self.log(f"Initialized: step={step_pin}, dir={dir_pin}, enable={enable_pin}")

    def log(self, msg):
        if DEBUG:
            print(f"[{self.name}] {msg}")

    def enable(self):
        """Enable the stepper motor"""
        self.enable_pin.value(0)  # Active low
        self.is_enabled = True
        self.log("Motor enabled")

    def disable(self):
        """Disable the stepper motor"""
        self.enable_pin.value(1)  # Inactive high
        self.is_enabled = False
        self.log("Motor disabled")

    def set_direction(self, forward=True):
        """Set motor direction: True=forward, False=backward"""
        self.direction = 0 if forward else 1
        self.dir_pin.value(self.direction)

    def step(self, steps=1, delay_us=800):
        """Move the motor by specified number of steps"""
        if not self.is_enabled:
            self.enable()

        for _ in range(steps):
            self.step_pin.value(1)
            machine.udelay(delay_us // 2)
            self.step_pin.value(0)
            machine.udelay(delay_us // 2)

        # Update position
        if self.direction == 0:
            self.position += steps
        else:
            self.position -= steps

        self.position_mm = self.position / self.steps_per_mm

    def move_to(self, target_mm, speed_mm_s=50):
        """Move motor to absolute position (in mm)"""
        target_steps = int(target_mm * self.steps_per_mm)
        current_steps = int(self.position_mm * self.steps_per_mm)
        steps_to_move = abs(target_steps - current_steps)

        if steps_to_move == 0:
            self.log(f"Already at position {target_mm}mm")
            return

        self.enable()
        self.set_direction(target_steps > current_steps)

        # Calculate delay based on speed
        delay_us = int(1000000 / (speed_mm_s * self.steps_per_mm))

        self.log(
            f"Moving to {target_mm}mm (from {self.position_mm}mm) at {speed_mm_s}mm/s"
        )
        self.step(steps_to_move, delay_us)
        self.log(f"Reached position {self.position_mm}mm")


class ServoMotor:
    """Control a servo motor for pen up/down"""

    def __init__(self, pin):
        self.pwm = PWM(Pin(pin), freq=SERVO["frequency"])
        self.is_up = True
        self.log("Servo initialized")

    def log(self, msg):
        if DEBUG:
            print(f"[SERVO] {msg}")

    def set_angle(self, angle):
        """Set servo angle (0-180 degrees)"""
        # Convert angle to duty cycle
        # For standard servo: 0° = 1ms (5% duty), 180° = 2ms (10% duty) at 50Hz
        duty = int(25 + (angle / 180) * 50)  # 25 to 125
        duty = max(25, min(125, duty))
        self.pwm.duty(duty)
        self.log(f"Set angle to {angle}° (duty={duty})")

    def pen_up(self):
        """Lift the pen"""
        angle = SERVO["pen_up_angle"]
        self.set_angle(angle)
        self.is_up = True
        self.log("Pen UP")

    def pen_down(self):
        """Put the pen down"""
        angle = SERVO["pen_down_angle"]
        self.set_angle(angle)
        self.is_up = False
        self.log("Pen DOWN")

    def toggle_pen(self):
        """Toggle pen up/down"""
        if self.is_up:
            self.pen_down()
        else:
            self.pen_up()


class LimitSwitch:
    """Handle limit switch input"""

    def __init__(self, name, pin, callback=None):
        self.name = name
        self.pin = Pin(pin, Pin.IN, Pin.PULL_UP)
        self.callback = callback
        self.is_pressed = False

    def read(self):
        """Read limit switch state (inverted for pull-up)"""
        self.is_pressed = self.pin.value() == 0
        return self.is_pressed

    def log(self, msg):
        if DEBUG:
            print(f"[{self.name}] {msg}")


class CNCPlotter:
    """Main CNC plotter controller"""

    def __init__(self):
        self.log("Initializing CNC Plotter...")

        # Initialize stepper motors
        self.stepper_x = StepperMotor(
            "X_AXIS",
            STEPPER_X["step_pin"],
            STEPPER_X["dir_pin"],
            STEPPER_X["enable_pin"],
            STEPPER_X["steps_per_mm"],
        )

        self.stepper_y = StepperMotor(
            "Y_AXIS",
            STEPPER_Y["step_pin"],
            STEPPER_Y["dir_pin"],
            STEPPER_Y["enable_pin"],
            STEPPER_Y["steps_per_mm"],
        )

        # Initialize servo
        self.servo = ServoMotor(SERVO["pin"])
        self.servo.pen_up()

        # Initialize limit switches
        self.limit_x_min = LimitSwitch("X_MIN", LIMIT_SWITCHES["x_min"])
        self.limit_x_max = LimitSwitch("X_MAX", LIMIT_SWITCHES["x_max"])
        self.limit_y_min = LimitSwitch("Y_MIN", LIMIT_SWITCHES["y_min"])
        self.limit_y_max = LimitSwitch("Y_MAX", LIMIT_SWITCHES["y_max"])

        # System state
        self.is_homed = False
        self.is_running = False
        self.emergency_stop = False
        self.wifi_connected = False

        # Web server
        self.server_socket = None
        self.clients = []

        self.log("Initialization complete")

    def log(self, msg):
        if DEBUG:
            timestamp = utime.localtime()
            time_str = f"{timestamp[3]:02d}:{timestamp[4]:02d}:{timestamp[5]:02d}"
            print(f"[{time_str}] [PLOTTER] {msg}")

    def connect_wifi(self):
        """Connect to WiFi with proper state management"""
        if not SAFETY["enable_web_interface"]:
            self.log("WiFi disabled in config")
            return False

        try:
            self.log(f"Connecting to WiFi: {WIFI_SSID}...")

            # Get WiFi interface
            wlan = network.WLAN(network.STA_IF)

            # Properly disconnect any existing connection
            if wlan.isconnected():
                self.log("Disconnecting existing WiFi...")
                wlan.disconnect()
                utime.sleep_ms(1000)

            # Deactivate and reactivate to clear state
            wlan.active(False)
            utime.sleep_ms(500)
            wlan.active(True)
            utime.sleep_ms(500)

            # Connect to WiFi
            wlan.connect(WIFI_SSID, WIFI_PASSWORD)

            # Wait for connection with timeout
            start_time = utime.ticks_ms()
            timeout_ms = WIFI_CONNECT_TIMEOUT

            while not wlan.isconnected():
                elapsed = utime.ticks_ms() - start_time
                if elapsed > timeout_ms:
                    self.log(f"WiFi connection timeout after {elapsed}ms")
                    return False

                # Show progress
                if elapsed % 2000 == 0:
                    self.log(f"Connecting... {elapsed}ms")

                utime.sleep_ms(500)

            # Connection successful
            ip = wlan.ifconfig()[0]
            self.log(f"WiFi connected! IP: {ip}")
            self.wifi_connected = True
            return True

        except Exception as e:
            self.log(f"WiFi error: {e}")
            return False

    def home_x(self):
        """Home X axis using limit switch"""
        self.log("Homing X axis...")
        self.stepper_x.enable()
        self.stepper_x.set_direction(False)  # Move towards home

        # Move until limit switch is pressed
        while not self.limit_x_min.read():
            self.stepper_x.step(1, 1000)
            utime.sleep_ms(1)

        self.stepper_x.position = 0
        self.stepper_x.position_mm = 0
        self.stepper_x.disable()
        self.log("X axis homed")

    def home_y(self):
        """Home Y axis using limit switch"""
        self.log("Homing Y axis...")
        self.stepper_y.enable()
        self.stepper_y.set_direction(False)

        # Move until limit switch is pressed
        while not self.limit_y_min.read():
            self.stepper_y.step(1, 1000)
            utime.sleep_ms(1)

        self.stepper_y.position = 0
        self.stepper_y.position_mm = 0
        self.stepper_y.disable()
        self.log("Y axis homed")

    def home_all(self):
        """Home all axes"""
        self.log("Starting full homing sequence...")
        self.servo.pen_up()
        self.home_x()
        self.home_y()
        self.is_homed = True
        self.log("Homing complete")

    def move_rapid(self, x, y):
        """Rapid movement to X, Y coordinates"""
        self.log(f"Rapid move to X={x}, Y={y}")
        self.stepper_x.move_to(x, MOVEMENT["rapid_speed"])
        self.stepper_y.move_to(y, MOVEMENT["rapid_speed"])

    def move_linear(self, x, y):
        """Linear movement to X, Y coordinates"""
        self.log(f"Linear move to X={x}, Y={y}")
        self.stepper_x.move_to(x, MOVEMENT["feed_speed"])
        self.stepper_y.move_to(y, MOVEMENT["feed_speed"])

    def jog_x(self, direction, distance=1):
        """Jog X axis"""
        new_pos = self.stepper_x.position_mm + (
            distance if direction == 1 else -distance
        )
        new_pos = max(MACHINE_LIMITS["x_min"], min(MACHINE_LIMITS["x_max"], new_pos))
        self.stepper_x.move_to(new_pos, MOVEMENT["feed_speed"])

    def jog_y(self, direction, distance=1):
        """Jog Y axis"""
        new_pos = self.stepper_y.position_mm + (
            distance if direction == 1 else -distance
        )
        new_pos = max(MACHINE_LIMITS["y_min"], min(MACHINE_LIMITS["y_max"], new_pos))
        self.stepper_y.move_to(new_pos, MOVEMENT["feed_speed"])

    def get_status(self):
        """Get current machine status"""
        return {
            "device_id": DEVICE_ID,
            "device_name": DEVICE_NAME,
            "is_homed": self.is_homed,
            "is_running": self.is_running,
            "emergency_stop": self.emergency_stop,
            "position": {
                "x": round(self.stepper_x.position_mm, 2),
                "y": round(self.stepper_y.position_mm, 2),
            },
            "pen": {"is_up": self.servo.is_up},
            "limits": {
                "x_min": self.limit_x_min.read(),
                "x_max": self.limit_x_max.read(),
                "y_min": self.limit_y_min.read(),
                "y_max": self.limit_y_max.read(),
            },
            "timestamp": utime.time(),
        }

    def start_web_server(self):
        """Start TCP web server for commands"""
        if not self.wifi_connected:
            self.log("WiFi not connected, cannot start web server")
            return

        self.log(f"Starting web server on port {SYSTEM['web_port']}...")
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind(("0.0.0.0", SYSTEM["web_port"]))
        self.server_socket.listen(1)
        self.server_socket.setblocking(False)
        self.log("Web server started")

    def handle_web_request(self):
        """Handle incoming web requests"""
        if self.server_socket is None:
            return

        try:
            client, addr = self.server_socket.accept()
            self.log(f"Client connected: {addr}")

            # Read request
            request = client.recv(1024).decode("utf-8", errors="ignore")
            if not request:
                client.close()
                return

            lines = request.split("\r\n")
            request_line = lines[0]

            self.log(f"Request: {request_line}")

            # Parse request
            parts = request_line.split()
            if len(parts) >= 2:
                method = parts[0]
                path = parts[1]

                # Route requests
                response = self.route_request(method, path, request)
            else:
                response = "HTTP/1.1 400 Bad Request\r\n\r\nBad Request"

            # Send response
            client.send(response.encode())
            client.close()

        except OSError:
            # No clients waiting
            pass

    def route_request(self, method, path, request):
        """Route web requests to appropriate handlers"""

        if path == "/status":
            status = self.get_status()
            response_body = ujson.dumps(status)
            return f"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{response_body}"

        elif path == "/home":
            self.home_all()
            response_body = ujson.dumps({"status": "homing"})
            return f"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{response_body}"

        elif path.startswith("/move/"):
            # Parse /move/x/y
            parts = path.split("/")
            if len(parts) >= 4:
                try:
                    x = float(parts[2])
                    y = float(parts[3])
                    self.move_linear(x, y)
                    response_body = ujson.dumps({"status": "moving", "x": x, "y": y})
                    return f"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{response_body}"
                except:
                    pass

        elif path == "/pen/up":
            self.servo.pen_up()
            return (
                f"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n"
                + '{"status": "pen_up"}'
            )

        elif path == "/pen/down":
            self.servo.pen_down()
            return (
                f"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n"
                + '{"status": "pen_down"}'
            )

        elif path == "/pen/toggle":
            self.servo.toggle_pen()
            return (
                f"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n"
                + '{"status": "pen_toggled"}'
            )

        elif path.startswith("/jog/"):
            # Parse /jog/axis/direction/distance
            parts = path.split("/")
            if len(parts) >= 4:
                try:
                    axis = parts[2]  # x or y
                    direction = int(parts[3])  # 1 or -1
                    distance = float(parts[4]) if len(parts) > 4 else 1

                    if axis == "x":
                        self.jog_x(direction, distance)
                    elif axis == "y":
                        self.jog_y(direction, distance)

                    response_body = ujson.dumps({"status": "jogging", "axis": axis})
                    return f"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{response_body}"
                except:
                    pass

        return "HTTP/1.1 404 Not Found\r\n\r\nNot Found"

    def run(self):
        """Main control loop"""
        self.log("=== CNC Plotter Starting ===")

        # Connect WiFi
        self.connect_wifi()

        # Start web server
        if self.wifi_connected:
            self.start_web_server()

        # Auto-home on startup if enabled
        if SAFETY["auto_home_on_startup"] and SAFETY["enable_web_interface"]:
            self.home_all()

        self.log("Ready for commands")

        # Main loop
        try:
            while True:
                # Handle web requests
                self.handle_web_request()

                # Check limit switches periodically
                self.limit_x_min.read()
                self.limit_x_max.read()
                self.limit_y_min.read()
                self.limit_y_max.read()

                utime.sleep_ms(100)

        except KeyboardInterrupt:
            self.log("Interrupted by user")
        except Exception as e:
            self.log(f"Error in main loop: {e}")
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        self.log("Cleaning up...")
        self.stepper_x.disable()
        self.stepper_y.disable()
        if self.server_socket:
            self.server_socket.close()
        self.log("Shutdown complete")


# Main entry point
if __name__ == "__main__":
    plotter = CNCPlotter()
    plotter.run()
