require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const fs = require("node:fs");
const { pipeline } = require("stream/promises");
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const VoiceResponse = require("twilio").twiml.VoiceResponse;
const WebSocket = require("ws");
const app = express();
const server = require("http").createServer(app);

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgramClient = createClient(deepgramApiKey);
const wss = new WebSocket.Server({ server });
let keepAlive;
let transcriptChunks = [];
let transcripts = [];
const finalTranscript = [];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

console.log("deepgram api", deepgramApiKey);

const setupDeepgram = (ws) => {
  const deepgram = deepgramClient.listen.live({
    language: "en",
    encoding: "mulaw",
    interim_results: true,
    model: "nova-3",
    punctuate: true,
    sample_rate: 8000,
    utterance_end_ms: 1000,
    vad_events: true,
    smart_format: true,
    endpointing: 1000,
  });

  if (keepAlive) clearInterval(keepAlive);
  keepAlive = setInterval(() => {
    // console.log("deepgram: keepalive");
    deepgram.keepAlive();
  }, 10 * 1000);

  deepgram.on(LiveTranscriptionEvents.Open, async () => {
    // console.log("deepgram: connected");

    deepgram.on(LiveTranscriptionEvents.Transcript, (data) => {
      // console.log("deepgram: transcript received");
      // console.log("deepgram: transcript received");
      if (!data.channel.alternatives[0].words.length) {
        return;
      }

      if (!transcriptChunks.length) {
        console.log("Transcript started");
      }

      transcriptChunks.push(data);
      console.log("Transcript: ", data.channel.alternatives[0].transcript);
      finalTranscript.push(data.channel.alternatives[0].transcript);
      ws.send(JSON.stringify(data.channel.alternatives[0].transcript));
    });

    deepgram.on(LiveTranscriptionEvents.UtteranceEnd, (event) => {
      let text = "";
      for (const transcript of [...transcriptChunks]) {
        if (transcript.start > event.last_word_end) {
          break;
        }

        if (transcript.is_final) {
          text += transcript.channel.alternatives[0].transcript + "";
        }

        transcriptChunks.shift();
      }

      transcripts.push(text);
      if (text) {
        console.log("Final Transcript: ", text, " :: ", transcripts);
      }

      ws.send(JSON.stringify(text));
    });

    deepgram.on(LiveTranscriptionEvents.Close, async () => {
      // console.log("deepgram: disconnected");
      clearInterval(keepAlive);
      deepgram.finish();
    });

    deepgram.on(LiveTranscriptionEvents.Error, async (error) => {
      // console.log("deepgram: error received");
      console.error(error);
    });

    deepgram.on(LiveTranscriptionEvents.Warning, async (warning) => {
      // console.log("deepgram: warning received");
      console.log(warning);
    });

    deepgram.on(LiveTranscriptionEvents.Metadata, (data) => {
      // console.log("deepgram: metadata received");
      // console.log("ws: metadata sent to client");
      ws.send(JSON.stringify({ metadata: data }));
    });
  });

  return deepgram;
};

wss.on("connection", (ws) => {
  // console.log("ws: client connected");
  let deepgram = setupDeepgram(ws);

  ws.on("message", (message) => {
    // console.log("ws: client data received");
    // console.log(message);
    // console.log(JSON.parse(message));
    let msg = JSON.parse(message.toString());

    switch (msg.event) {
      case "connected":
        // console.log("Websocket is connected");
        break;
      case "start":
        // console.log(`Starting media stream ${msg.streamSid}`);
        break;
      case "media":
        // console.log("Receiving Audio");
        if (deepgram && deepgram.getReadyState() === 1) {
          let payload = msg.media.payload;
          deepgram.send(Buffer.from(payload, "base64"));
        }
        break;
      case "stop":
        // console.log("Call has ended");
        deepgram.finish();
        deepgram.removeAllListeners();
        deepgram = setupDeepgram(ws);
        break;
      default:
        // console.log("Unhandled media stream");
        break;
    }

    // console.log("Deepgram ready state: ", deepgram.getReadyState());
  });

  ws.on("close", () => {
    // console.log("ws: client disconnected");
    console.log("Final Transcript: ", finalTranscript.join(" "));
    deepgram.finish();
    deepgram.removeAllListeners();
    deepgram = null;
  });
});

/**
 * Initiates an outbound call to a patient reminding them to confirm their medications
 */
async function outboundMedicationReminder() {
  const call = await client.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: "+19098278614",
    url: "https://c3ca-2603-6081-6f00-e44-4800-c52e-40ec-d16f.ngrok-free.app/voice",
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
 * Initiates an outbound call when a patient doesn't respond asking them to call back
 */
async function outboundUnansweredCall() {
  const call = await client.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: "+19098278614",
    twiml:
      "<Response><Say>We called to check on your medication but couldn't reach you. Please call us back or take your medications if you haven't done so.</Say></Response>",
  });

  console.log(call.sid);
  console.log(call.status);
  console.log(call.answeredBy);
  console.log(call.dateCreated);
  console.log(call.direction);
  console.log(call.duration);
  console.log(call.startTime);
  console.log(call.endTime);
  console.log(call.uri);
  console.log(call.transcriptions());
}

/**
 * Creates an audio message that will be sent to the patient
 */
async function generateTTS() {
  const outputFile = "audio.mp3";
  const text = `Hello, this is a reminder from your healthcare provider to confirm your medications for the day. 
                Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.`;

  const response = await deepgramClient.speak.request(
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

/**
 * Sends an sms reminder to the patient to call back
 */
async function outboundSMS() {
  const message = await client.messages.create({
    body: "We called to check on your medication but couldn't reach you. Please call us back or take your medications if you haven't done so.",
    from: `${process.env.TWILIO_PHONE_NUMBER}`,
    to: "+19098278614",
  });

  console.log(message.body);
}

/**
 * Responds to incoming messages from a patient
 */
app.post("/voice", (request, response) => {
  process.stdout.write("Route entered");

  response.set("Content-Type", "text/xml");
  response.send(`
    <Response>
      <Start>
        <Stream url="wss://${request.headers.host}/"/>
      </Start>
      <Say>Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.</Say>
      <Pause length="60" />
    </Response>
  `);
  // const twiml = new VoiceResponse();
  // twiml.say(
  //   "Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today."
  // );

  // response.type("text/xml");
  // response.send(twiml.toString());
});

server.listen(3000, () => {
  console.log(`Listening on port ${3000}`);
  console.log("Server started!");
});
