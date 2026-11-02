# Read My Mind

## Play locally

1. Install Node.js 18 or newer (npm is included with the Node.js installer).
2. Open a terminal in this folder.
3. Run `npm install` once, then `npm start`.
4. Open [http://localhost:3000](http://localhost:3000) in two browser tabs or on two devices on the same network.
5. Create a room in one tab and join using the room code or copied invite link in the other.

To stop the server, press Ctrl+C in the terminal.

## Current playtest changes

- A correct guess in One by one awards the guesser a 20 point catch bonus.
- Room creators can enable a 30, 60, or 90 second timer. It is off by default. If a player runs out of time, the game makes a random move for them.
- After three misses, the guesser gets a hot/cold hint comparing their misses. Only the guesser receives it.
- The room code is saved in the tab, so refreshing can rejoin the same seat. Invite links include the room code.
- The server accepts up to 500 rooms.

## Deploy on Render

The included `render.yaml` configures a free Render web service. In Render, create a Blueprint from the GitHub repository and deploy the `read-my-mind` service. The game uses in-memory room state, so a restart or sleep clears active rooms. A free service can sleep after 15 minutes without requests, and the first request after sleeping may take about a minute. Free usage has bandwidth and build limits; avoid adding a payment method if you want Render to suspend service rather than bill for usage beyond its included amounts.
