require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const fs = require("node:fs");
const { pipeline } = require("stream/promises");
const { createClient } = require("@deepgram/sdk");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(deepgramApiKey);

const app = express();

app.use(express.json());

/**
 * Initiates an outbound call to a patient
 */
async function createCall() {
  const call = await client.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: "+19098278614",
    url: "http://demo.twilio.com/docs/voice.xml",
  });

  console.log(call.sid);
  console.log(call.status);
  console.log(call.answeredBy);
  console.log(call.dateCreated);
  console.log(call.direction);
  console.log(call.duration);
  console.log(call.startTime);
  console.log(call.endTime);
}

/**
 * Creates an audio message that will be sent to the patient
 */
async function createMessage() {
  const outputFile = "audio.mp3";
  const text = `Hello, this is a reminder from your healthcare provider to confirm your medications for the day. 
                Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.`;

  const response = await deepgram.speak.request(
    { text },
    {
      model: "aura-asteria-en",
    }
  );

  const stream = await response.getStream();
  if (stream) {
    const file = fs.createWriteStream(outputFile);
    try {
      await pipeline(stream, file);
      console.log(`Audio file written to ${outputFile}`);
    } catch (e) {
      console.error("Error writing audio to file:", e);
    }
  } else {
    console.error("Error generating audio:", stream);
  }
}

app.listen(3000, () => {
  console.log(`Listening on port ${3000}`);
  console.log("Server started!");
  createMessage();
});
