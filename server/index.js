const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const needle = require('needle');
const config = require('dotenv').config();

// port
const PORT = process.env.PORT || 3000;

// set bearer token
const TOKEN = process.env.TWITTER_BREARER_TOKEN;

const app = express();

const server = http.createServer(app);

const io = socketIo(server);

app.get('/', (req, res) => {
  return res.sendFile(path.resolve(__dirname, '../', 'client', 'index.html'));
});

const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL =
  'https://api.twitter.com/2/tweets/search/stream?tweet.fields=public_metrics&expansions=author_id';

const rules = [{ value: 'coding' }];

// get stream rules
async function getRules() {
  const response = await needle('get', rulesURL, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.body;
}

// set stream rules
async function setRules() {
  const data = {
    add: rules,
  };

  const response = await needle('post', rulesURL, data, {
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.body;
}
// delete stream rules
async function deleteRules(rules) {
  if (!Array.isArray(rules.data)) {
    return null;
  }

  const ids = rules.data.map((rule) => rule.id);

  const data = {
    delete: {
      ids,
    },
  };

  const response = await needle('post', rulesURL, data, {
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.body;
}

function streamTweets(socket) {
  const stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  stream.on('data', (data) => {
    try {
      const json = JSON.parse(data);
      socket.emit('tweet', json);
    } catch (error) {
      console.log(data);
      console.log(error);
    }
  });
}

io.on('connection', async () => {
  console.log('Client connected....');

  (async () => {
    let currentRules;

    try {
      //   get all stream rules
      currentRules = await getRules();

      // delete all stream rules
      await deleteRules(currentRules);

      // set rules based on rules array
      await setRules();
    } catch (error) {
      console.log(error);
      process.exit(1);
    }

    streamTweets(io);
  })();
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
