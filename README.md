# Initialized Backend Server 3/27/2025

- [X] Feature Change

# Change Summary
-Created express server instance and added ability to start server
-Installed several npm packages relating ElevenLabs, Deepgram, Twilio, and Express

# Testing Instructions

- Use npm install
- Use npm start to start the server

# Testing Evidence

https://github.com/user-attachments/assets/6e3eb14d-48fe-49f3-9713-5a3832ef97c8

# Implemented Outbound Calling 3/27/2025

- [X] Feature Change

# Change Summary
-Added ngrok
-Implemented the ability to initiate an outbound call with a message stating the medication reminder prompt
-Used Deepgram to generate an mp3 file of the TTS reading the medication reminder prompt

# Testing Instructions

- Use ngrok [portNumber] to connect to ngrok url
- Use npm start to start the server

# Testing Evidence

# Implement WebSocket Connection 4/01/2025

- [X] Feature Change

# Change Summary
-Implemented WebSocket server
-Established connection between Twilio and Deepgram when a patient calls the Twilio phone number
-Added Deepgram listeners to take real time audio and convert speech to text
-When a patient calls the Twilio phone number the medication reminder system asks if the patient has taken their medicine before allowing them to respond
-Partial transcripts are outputted during a call as the user speaks and the final transcript is displayed at the end of a call

# Testing Instructions

- Use ngrok http [portNumber] to connect to ngrok
- Use npm start to start the server
- Call the provided Twilio phone number
- After the system reminds you to take your medication respond to the question

# Testing Evidence
