import serial
import pyautogui

# Change 'COM3' to the actual port your Arduino is connected to
ser = serial.Serial("COM3", 9600)

while True:
    if ser.in_waiting:
        line = ser.readline().decode().strip()
        print("Received:", line)
        if line == "click":
            pyautogui.press("a")  # Simulate typing 'a'
