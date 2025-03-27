require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

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

app.listen(3000, () => {
  console.log(`Listening on port ${3000}`);
  console.log("Server started!");
  createCall();
});
