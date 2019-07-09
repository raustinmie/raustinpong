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

let waitingClients = [];
let games = [];

function roll() {
	return Math.random() * 2 - 1;
}
function between(lower, upper, input) {
	return input <= upper && input >= lower;
}
function startMoving() {
	let moveX = 0;
	let moveY = 0;
	let speed = 9;
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

class Game {
	constructor(client1, client2) {
		this._client1 = client1;
		this._client2 = client2;

		this.setupMessageHandler(client1, client2);
		this.setupMessageHandler(client2, client1);

		client1.on("close", () => {
			// client2.close(;)
			// client1.removeAllListeners("close");
			// client1.removeAllListeners("message");
			addToLobby(client2);
			this.removeGame();
		});

		client2.on("close", () => {
			// client1.close();
			// client2.removeAllListeners("close");
			// client2.removeAllListeners("message");
			addToLobby(client1);
			this.removeGame();
		});

		this.startGame();
	}

	startGame() {
		console.log("Starting game");
		this._client1.send(JSON.stringify({ player: 1 }));
		this._client2.send(JSON.stringify({ player: 2 }));

		let initialVector = startMoving();
		this._client1.send(JSON.stringify({ gameStart: initialVector }));
		this._client2.send(JSON.stringify({ gameStart: initialVector }));
	}

	removeGame() {
		console.log("Game ended");
		for (let i = 0; i < games.length; ++i) {
			if (games[i] === this) {
				games.splice(i, 1);
				break;
			}
		}
	}

	setupMessageHandler(client, opponent) {
		client.on("message", msg => {
			console.log(`got message: ${msg}`);
			const message = JSON.parse(msg);

			if (message.gameOver) {
				console.log("got game over");
				this.startGame();
			} else {
				opponent.send(JSON.stringify(message));
			}
		});
	}
}

function assignPlayersToGame() {
	if (waitingClients.length >= 2) {
		console.log("Creating game");

		games.push(new Game(waitingClients[0], waitingClients[1]));
		waitingClients.splice(0, 2);
	}
}

function addToLobby(client) {
	client.removeAllListeners("close");
	client.removeAllListeners("message");
	setupDisconnectHandler(client);
	waitingClients.push(client);
	assignPlayersToGame();
}

function setupDisconnectHandler(client) {
	client.on("close", function() {
		console.log("Client disconnected");
		for (let i = 0; i < waitingClients.length; ++i) {
			if (waitingClients[i] === client) {
				waitingClients.splice(i, 1);
				break;
			}
		}
	});
}

app.ws("/", function(ws, req) {
	console.log("Client connected");
	setupDisconnectHandler(ws);
	addToLobby(ws);
});

app.listen(process.env.PORT || 8080, () => {
	console.log("server running");
});
