# Project Setup

In order to open the project, open a terminal in Visual Studio Code and enter the following git command.

```sh
git clone https://github.com/wellendorfmatthew/medication-reminder.git
```

Use `cd medication-reminder` to change the directory where the server code is located in.

Run `npm install` to install all the project dependencies.

In package.json you should see the following dependencies. If one of them is missing make sure to npm install the package.
```sh
{
  "dependencies": {
    "@deepgram/sdk": "^3.11.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "elevenlabs": "^1.54.0",
    "express": "^4.21.2",
    "twilio": "^5.5.1",
    "ws": "^8.18.1"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

You will need environment variables in order to store Twilio and Deepgram API keys as well as other sensitive information needed to make the app function. Create a .env folder then copy and paste these variables. Paste values in when needed.

```sh
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=xxx
TWILIO_API_KEY=xxx
TWILIO_API_SECRET=xxx
TWILIO_TWIML_APP_SID=xxx
DEEPGRAM_API_KEY=xxx
NGROK_URL=xxx
```

Ngrok Setup
In order to expose our local server to a publically accessible URL we will be using ngrok. Ngrok can be downloaded on the below link and instructions and configuration for each operating system is present.
`https://ngrok.com/downloads/windows`

After installing ngrok and configuring the auth token, open up another terminal, enter `cd medication-reminder`, and then to run ngrok and obtain a url run 
`ngrok http PORTNUMBER`

After entering the command you should get the following screen. Copy and paste the highlighted url and paste it to your `NGROK_URL` in your .env file.

![Capture d’écran (1809)](https://github.com/user-attachments/assets/a48beddc-6950-45b5-b0ce-861e246fa3d8)

Twilio Setup

In order for the medication reminder system to receive and send calls, a Twilio account must be made with a phone number attached to it.

After making your account on Twilio you should be directed to the twilio console. In order to buy a phone number(this is free of charge as twilio gives you some money with a trial account) click on the Phone Numbers tab on the left side panel, Manage, and then Buy a number.
![Capture d’écran (1806)](https://github.com/user-attachments/assets/32877c87-706b-4061-8cfc-a69b9e159dbf)

Ensure at the top where it says "Capabilities" that the voice and sms options are selected then buy a phone number to use. Afterwards copy and paste the phone number and insert it into `TWILIO_PHONE_NUMBER` in your .env file.

Next click on the side panel option that says Active Numbers and click on your twilio phone number.
![Capture d’écran (1807)](https://github.com/user-attachments/assets/4f4b944e-5384-4ad8-8891-2dc181eed4ff)

Where is says "Configure with" make sure you have the following drop down option and "A call comes in" and "Primary handler fails" should both be webhooks. Copy and paste your ngrok url from your.env file and inside the "A call comes in section" the url should be set to `https://NGROK_URL/voice` and inside the "Call status changes" section the url should be `https://NGROK_URL/status`. When a phone number receives an incoming call, the first url is triggered and the medication reminder system will say a prompt to the user. Each time the status of a call changes('queued', 'ringing', 'in-progress', 'completed', etc) the second url is triggered and information about the call is logged to the console.
![Capture d’écran (1808)](https://github.com/user-attachments/assets/fdc0c6f9-20ee-4a50-9a30-d1e6d594aef4)

Go back to your twilio console and on the top right click on "Admin" and then "Account management". 
![Capture d’écran (1810)](https://github.com/user-attachments/assets/533cec3c-eec8-459c-901b-47291f31d687)

On the Account management page look at the lect side panel and under "Keys & Credentials" click on "API keys &  token"
![Capture d’écran (1811)](https://github.com/user-attachments/assets/e0ffc90c-5091-4703-8a8a-15778752f67e)

Click on the "Create API Key" button on the top right then on the following screen enter a name for your twilio api key.
![Capture d’écran (1813)](https://github.com/user-attachments/assets/1912b7d7-8f3b-40a2-a45b-148313a7902f)

On the following screen copy and paste the "SID" and insert it into the `TWILIO_API_KEY` in your .env file and then copy + paste + insert the "Secret" into the `TWILIO_API_SECRET` in the .env file

Go back to your twilio console page and copy + paste + insert the "Account Sid" into the `TWILIO_ACCOUNT_SID` variable in your .env file and then copy + paste + insert the "Auth Token" into the `TWILIO_AUTH_TOKEN` variable in your .env file.

Deepgram Setup

In order to perform text to speech and speech to text we need to create a Deepgram account.

After creating an account and signing in, click on "API Keys" on the left panel and then click on the button that says "Create a New API Key"
![Capture d’écran (1814)](https://github.com/user-attachments/assets/c304fb6b-ab12-4a1e-8586-32fe19204994)

Enter the name of your API key and then copy + paste + insert it into the `DEEPGRAM_API_KEY` inside of you .env file
![Capture d’écran (1815)](https://github.com/user-attachments/assets/df2af2a1-a180-45c1-bc89-efbb65374d2e)

Starting the App

Now that our environment variables and Twilio/Deepgram accounts are set up, we can start the app.

If you intend on having the system make an outbound call simply run `npm start`. Then after answering the call from your phone follow the instructions and after the bot speaks respond with your answer.

If you intend on having the system receive an incoming call from your phone number comment out the outboundMedicationReminder() function at the bottom, save, run `npm start` and then make a call to the Twilio Phone Number you setup, follow the instructions, and respond after the bot speaks.
```sh
server.listen(3000, () => {
  console.log(`Listening on port ${3000}`);
  console.log("Server started!");
  //outboundMedicationReminder();
});
```

#Pull Requests

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

# Implement TTS Structure 4/01/2025

- [X] Feature Change

# Change Summary
-Added second websocket server
-Set up structure for listening for media streams containing text and converting to speech via Deepgram
-Adjusted environment variables
-If a caller isn't able to answer their phone an SMS message gets sent to their phone

# Testing Instructions

- Use ngrok http [portNumber] to connect to ngrok
- Use npm start to start the server
- Make an outbound call
- Don't pick up the phone and wait for the call to end, you should see in the console the message that's supposed to be sent

# Testing Evidence
