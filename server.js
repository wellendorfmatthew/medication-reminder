require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const fs = require("node:fs");
const { pipeline } = require("stream/promises");
const {
  createClient,
  LiveTranscriptionEvents,
  LiveTTSEvents,
} = require("@deepgram/sdk");
const VoiceResponse = require("twilio").twiml.VoiceResponse;
const WebSocket = require("ws");
const app = express();
const server = require("http").createServer(app);
const path = require("path");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgramClient = createClient(deepgramApiKey);
const wss = new WebSocket.Server({ server });
const deepgramURL =
  "wss://api.deepgram.com/v1/speak?encoding=mulaw&sample_rate=8000&container=none";
const options = {
  headers: {
    Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
  },
};

let deepgramWSS = new WebSocket(deepgramURL, options);
let keepAlive;
let transcriptChunks = [];
let transcripts = [];
const finalTranscript = [];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//console.log("deepgram api", deepgramApiKey);

/**
 * Sets up deepgram connection for speech to text
 */
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
  const streamUrl = `wss://${process.env.NGROK_URL}/`;
  const statusURL = `https://${process.env.NGROK_URL}/status`;
  const call = await client.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: process.env.USER_PHONE_NUMBER,
    twiml: `<Response>
      <Start>
        <Stream url="${streamUrl}"/>
      </Start>
      <Say>Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.</Say>
      <Pause length="60" />
    </Response>`,
    statusCallback: statusURL,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    statusCallbackMethod: "POST",
    machineDetection: "Enable",
  });
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
    to: `${process.env.USER_PHONE_NUMBER}`,
  });

  console.log(message.body);
}

/**
 * Sets up deepgram connection for text to speech
 */
// deepgramWSS.on("connection", (ws) => {
//   console.log("Second WSS Connected");

//   let deepgramSocket;

//   ws.on("message", async (message) => {
//     console.log("Second WSS Received message: ", `${message}`);

//     try {
//       const data = JSON.parse(message);
//       const text = data.text;
//       const model = data.model || "aura-asteria-en";

//       if (!text) {
//         console.log("No text provided");
//         return;
//       }

//       deepgramSocket = deepgram.speak.live({
//         model: model,
//         encoding: "mulaw",
//         sample_rate: 48000,
//       });

//       deepgramSocket.on(LiveTTSEvents.Open, () => {
//         console.log("Deepgram TTS open");

//         ws.send(JSON.stringify({ type: "Open" }));

//         deepgramSocket.sendText(text);
//         deepgramSocket.flush();
//       });

//       deepgramSocket.on(LiveTTSEvents.Audio, (data) => {
//         console.log("Received audio data from Deepgram");
//         ws.send(data);
//       });

//       deepgramSocket.on(LiveTTSEvents.Flushed, () => {
//         console.log("Deepgram TTS Flushed");

//         ws.send(JSON.stringify({ type: "Flushed" }));
//       });

//       deepgramSocket.on(LiveTTSEvents.Close, () => {
//         console.log("Deepgram TTS Closed");

//         ws.send(JSON.stringify({ type: "Close" }));
//         deepgramSocket = null;
//       });

//       deepgramSocket.on(LiveTTSEvents.Error, (error) => {
//         console.error("Deepgram TTS Websocket error: ", error);

//         ws.send(JSON.stringify({ type: "Error", error: error.message }));
//       });
//     } catch (err) {
//       console.log("Error: ", err);
//       ws.send(JSON.stringify({ type: "Error", error: err.message }));
//     }
//   });
//   ws.on("close", () => {
//     console.log("Second Web Socket Disconnected");
//     if (deepgramSocket) {
//       deepgramSocket.requestClose();
//       deepgramSocket = null;
//     }
//   });
// });

// function writeFile() {
//   if (audioBuffer.length > 0) {
//     fs.writeFile("output.mp3", audioBuffer, (err) => {
//       if (err) {
//         console.error("Error writing audio file: ", err);
//       } else {
//         console.log("Audio file saved as output.mp3");
//       }
//     });

//     audioBuffer = Buffer.alloc(0);
//   }
// }

// app.post("/deepgramTTS", async (request, response) => {
//   process.stdout.write("Deepgram Route Entered");

//   const ttsRequest = await fetch(deepgramURL, {
//     headers: {
//       Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
//     },
//   });

//   response.send({
//     type: "Speak",
//     text: "Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.",
//   });
// });

/**
 * Responds to incoming calls from a patient
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
});

/**
 * After a call depending on the status either the call data is logged or a voicemail/sms message gets sent to a patient
 */
app.post("/status", async (request, response) => {
  const { CallSid, From, To, CallStatus, Direction, CallDuration, AnsweredBy } =
    request.body;

  console.log("Call Sid: ", CallSid);
  console.log("From: ", From);
  console.log("To: ", To);
  console.log("Call Status: ", CallStatus);
  console.log("Direction: ", Direction);
  console.log("Call Duration: ", CallDuration, " seconds");
  console.log("Answered By: ", AnsweredBy);

  if (
    AnsweredBy === "machine_start" &&
    CallStatus === "completed" &&
    Direction === "outbound-api"
  ) {
    const message = await client.messages.create({
      body: "We called to check on your medication but couldn't reach you. Please call us back or take your medications if you haven't done so.",
      from: `${process.env.TWILIO_PHONE_NUMBER}`,
      to: `${process.env.USER_PHONE_NUMBER}`,
    });

    console.log(message.body);
    console.log("SMS Sent: ", "True");
  }
});

server.listen(3000, () => {
  console.log(`Listening on port ${3000}`);
  console.log("Server started!");
  outboundMedicationReminder();
});
