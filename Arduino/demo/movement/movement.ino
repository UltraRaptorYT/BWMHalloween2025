void setup() {
  Serial.begin(9600);
}

void loop() {
  int x = analogRead(A0);  // horizontal axis (0–1023)
  Serial.print("X:");
  Serial.println(x);
  delay(50);  // send data ~20 times/sec
}
