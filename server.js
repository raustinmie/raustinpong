const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const path = require("path");
const expressWs = require("express-ws");

const app = express();
expressWs(app);

app.use(cors());
app.use(helmet());
app.use("/", express.static(path.join(__dirname, ".")));

const clients = [];

function roll() {
	return Math.random() * 2 - 1;
}
function between(lower, upper, input) {
	return input <= upper && input >= lower;
}
function startMoving() {
	let moveX = 0;
	let moveY = 0;
	let speed = 13;
	do {
		moveX = roll();
	} while (between(-0.45, 0.45, moveX));

	moveY = roll();

	const length = Math.sqrt(moveX * moveX + moveY * moveY);

	moveX /= length;
	moveY /= length;

	moveX *= speed;
	moveY *= speed;

	return [moveX, moveY];
}

function startGame() {
	let initialVector = startMoving();
	clients[0].send(JSON.stringify({ gameStart: initialVector }));
	clients[1].send(JSON.stringify({ gameStart: initialVector }));
}

app.ws("/ws", function(ws, req) {
	clients.push(ws);
	const clientId = clients.length;
	ws.send(JSON.stringify({ player: clientId }));

	if (clients.length === 2) {
		startGame();
	}

	ws.on("message", function(msg) {
		console.log(`got message: ${msg}`);

		const message = JSON.parse(msg);

		if (message.gameOver) {
			console.log("got game over");
			startGame();
		} else if (clients.length >= 2) {
			const otherIDIndex = clientId === 1 ? 1 : 0;
			console.log(`from: ${clientId} to index: ${otherIDIndex}`);
			console.log(`broadcasting: ${msg}`);
			clients[otherIDIndex].send(JSON.stringify(message));
		}
	});
});

// // figure out who is playing

// //

// { player: <id> }

// {
// 	gameStart: [num, num];
// }
// {
// 	paddle1: num;
// }
// {
// 	paddle2: num;
// }

app.listen(process.env.PORT || 8080, () => {
	console.log("server running");
});
