const cors = require("cors");
const express = require("express");
const expressWs = require("express-ws");
const helmet = require("helmet");
const path = require("path");
const { performance } = require("perf_hooks");

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

function clamp(value, lower, upper) {
	return Math.max(lower, Math.min(upper, value));
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
		console.log("Creating Game");
		this._client1 = client1;
		this._client2 = client2;
		const p1 = (this._p1 = new Paddle(20, 180));
		const p2 = (this._p2 = new Paddle(370, 180));
		this._ball = new Missile(200, 200);

		console.log("here");
		client1.on("message", data => {
			const message = JSON.parse(data);

			console.log("client1 moved paddle");
			console.log(message.move);
			if (message.move === "up") {
				p1.moveUp();
			} else if (message.move === "down") {
				p1.moveDown();
			}
		});

		client2.on("message", data => {
			const message = JSON.parse(data);
			console.log("client2 moved paddle");
			if (message.move === "up") {
				p2.moveUp();
			} else if (message.move === "down") {
				p2.moveDown();
			}
		});
		console.log("here");

		client1.on("close", () => {
			addToLobby(client2);
			this.removeGame();
		});

		client2.on("close", () => {
			addToLobby(client1);
			this.removeGame();
		});
		console.log("here");

		this.startGame();
		//////////Game Loop/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
		console.log("game created");

		this._lastTime = performance.now();
		this._timer = setInterval(() => this.gameLoop(), 1000 / 10);
	}

	updateClients(p1, p2, ball) {
		const packet = JSON.stringify({
			client1Position: p1.y,
			client2Position: p2.y,
			ballPositionX: ball.x,
			ballPositionY: ball.y,
			ballVectorY: ball.moveY
		});
		this._client1.send(packet);
		this._client2.send(packet);
	}

	gameLoop() {
		const startTime = performance.now();

		// deltaTime is in ms
		const deltaTime = startTime - this._lastTime;

		// move ball

		this._ball.move(deltaTime);
		//		console.log(`before: [${this._p1.y}, ${this._p2.y}]`);
		this._p1.move(deltaTime);
		this._p2.move(deltaTime);
		//		console.log(`after: [${this._p1.y}, ${this._p2.y}]`);

		this.updateClients(this._p1, this._p2, this._ball);

		// handle bounces
		if (this._ball.moveDirection() == Missile.Left) {
			this.contact(this._ball, this._p1);
		} else {
			this.contact(this._ball, this._p2);
		}

		// handle hitting paddles

		// end match
		if (this._ball.x <= 5 || this._ball.x >= 395) {
			this.startGame();
		}
		this._lastTime = startTime;
	}

	startGame() {
		console.log("Starting game");
		this._client1.send(JSON.stringify({ player: 1 }));
		this._client2.send(JSON.stringify({ player: 2 }));

		this._p1.reset();
		this._p2.reset();
		let initialVector = startMoving();
		this._ball.reset(initialVector[0], initialVector[1]);
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
		clearInterval(this._timer);
	}

	contact(ball, paddle) {
		// Find the closest point to the ball within the paddle
		const closestX = clamp(ball.x, paddle.left, paddle.right);
		const closestY = clamp(ball.y, paddle.top, paddle.bottom);

		// Calculate the distance between the ball's center and this closest point
		const distanceX = ball.x - closestX;
		const distanceY = ball.y - closestY;

		// If the distance is less than the ball's radius, an intersection occurs
		const distanceSquared = distanceX * distanceX + distanceY * distanceY;
		if (distanceSquared < ball.radius * ball.radius) {
			ball.bounce(paddle);
		}
	}
}

function assignPlayersToGame() {
	if (waitingClients.length >= 2) {
		console.log("Assigning players to game");
		const c1 = waitingClients[0];
		const c2 = waitingClients[1];
		console.log("here  hewereerwer ");
		const g = new Game(c1, c2);
		console.log("adsfasdfasdfasdfasf");
		games.push(g);

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
///////////////////////////////////////////////////////////////////PADDLE//////////////////////////////////////////////////////////////////
class Paddle {
	constructor(x, y) {
		this._x = x;
		this._y = y;
		this._initialY = y;
		this._speed = 25;
		this._moveY = 0;
		this._paddleHeight = 40;
		this._paddleWidth = 10;
	}

	get y() {
		return this._y;
	}

	set y(value) {
		this._y = value;
	}

	get paddleHeight() {
		return this._paddleHeight;
	}

	reset() {
		this._y = this._initialY;
	}

	get bottom() {
		return this._y + this._paddleHeight;
	}

	get center() {
		return this._y + this._paddleHeight / 2;
	}

	get right() {
		return this._x + 10;
	}

	get left() {
		return this._x;
	}

	get top() {
		return this._y;
	}

	moveUp() {
		console.log(`speed: ${this._speed}`);
		console.log(`y: ${this._moveY}`);
		this._moveY -= this._speed;
		console.log(`y: ${this._moveY}`);
	}
	moveDown() {
		this._moveY += this._speed;
	}
	move(deltaTime) {
		//		console.log(`dt: ${deltaTime} y: ${this._moveY}`);
		if (
			(this.bottom <= 400 && this._moveY > 0) ||
			(this.top >= 0 && this._moveY < 0)
		) {
			this._y = clamp(
				this._y + (this._moveY * deltaTime) / 100,
				0,
				400 - this._paddleHeight
			);
		}
		this._moveY = 0;
	}
}

////////////////////////////////////////////////////////////////////////////  MISSILE  ///////////////////////////////////////////////////////////////
class Missile {
	constructor(x, y) {
		this._initialX = this._x = x;
		this._initialY = this._y = y;
		this._radius = 5;
	}

	reset(moveX, moveY) {
		this._x = this._initialX;
		this._y = this._initialY;

		this._moveX = moveX;
		this._moveY = moveY;
	}

	get radius() {
		return this._radius;
	}

	static get Left() {
		return -1;
	}

	static get Right() {
		return 1;
	}

	moveDirection() {
		if (this._moveX < 0) {
			return Missile.Left;
		} else {
			return Missile.Right;
		}
	}

	bounce(paddle) {
		this._moveX *= -1;
		let angleChange = (this._y - paddle.center) / (paddle.paddleHeight / 10);

		console.log(`angleChange ${angleChange}`);

		// const speed = Math.sqrt(
		// 	Math.pow(this._moveX, 2) + Math.pow(this._moveY, 2)
		// );

		//TODO: CHANGE ANGLE OF BOUNCE
		console.log(`before: ${this._moveX}, ${this._moveY}`);
		this._moveY += angleChange;
		console.log(`after: ${this._moveX}, ${this._moveY}`);
		// const length = Math.sqrt(
		// 	this._moveX * this._moveX + this._moveY * this._moveY
		// );

		// this._moveX /= length;
		// this._moveY /= length;

		// this._moveX *= speed;
		// this._moveY *= speed;
	}

	// startMoving() {
	// 	this._moveX = roll();
	// 	if (between(-0.45, 0.45, this._moveX)) {
	// 		this.startMoving();
	// 	}

	// 	this._moveY = roll();

	// 	const length = Math.sqrt(
	// 		this._moveX * this._moveX + this._moveY * this._moveY
	// 	);

	// 	this._moveX /= length;
	// 	this._moveY /= length;

	// 	this._moveX *= this._speed;
	// 	this._moveY *= this._speed;
	// }

	move(deltaTime) {
		this._x += (this._moveX * deltaTime) / 100;
		this._y += (this._moveY * deltaTime) / 100;
		if (
			(this._moveY < 0 && this._y <= 5) ||
			(this._moveY > 0 && this._y >= 395)
		) {
			this._moveY *= -1;
		}
	}

	get moveY() {
		return this._moveY;
	}

	get x() {
		return this._x;
	}

	get y() {
		return this._y;
	}
}
