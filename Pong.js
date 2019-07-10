function roll() {
	return Math.random() * 2 - 1;
}

function clamp(value, lower, upper) {
	return Math.max(lower, Math.min(upper, value));
}

function between(lower, upper, input) {
	return input <= upper && input >= lower;
}
function contact(ball, paddle) {
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

function onLoad(event) {
	let playerNum = -1;
	const boardCanvas = document.getElementById("table");
	const ctx = boardCanvas.getContext("2d");
	console.log("Document finished loading");

	let p1 = new Paddle(20, 180);
	let p2 = new Paddle(370, 180);
	let ball = new Missile(200, 200);

	const baseUri = document.baseURI;
	const wsUri = baseUri.replace(/http/, "ws");

	console.log(`Websocket URI: ${wsUri}`);
	let socket = new WebSocket(wsUri);

	document.addEventListener("keydown", event => {
		let p = null;
		if (playerNum === 1) {
			p = p1;
		} else if (playerNum === 2) {
			p = p2;
		}

		if (event.keyCode === 38 || event.keyCode === 87) {
			p.moveUp();
			socket.send(JSON.stringify({ move: p.y }));
		} else if (event.keyCode === 40 || event.keyCode === 83) {
			p.moveDown();
			socket.send(JSON.stringify({ move: p.y }));
		}
	});

	socket.addEventListener("open", function(event) {
		console.log("socket opened");
	});

	// Listen for messages
	socket.addEventListener("message", function(event) {
		const message = JSON.parse(event.data);

		if (message.player) {
			console.log(`We are now player ${message.player}`);
			playerNum = message.player;
		} else if (message.gameStart) {
			console.log("starting game");
			ball.reset(message.gameStart[0], message.gameStart[1]);
		} else if (message.move) {
			let p = null;

			console.log(`player move: ${message.move}`);
			console.log(`current player: ${playerNum}`);

			if (playerNum === 1) {
				p = p2;
			} else {
				p = p1;
			}

			console.log(`p ${p}`);
			// 	if (message.move === 1) {
			// 		console.log("moving down");
			// 		p.moveDown();
			// 	} else if (message.move === -1) {
			// 		console.log("moving up");
			// 		p.moveUp();
			// 	}
			// }
			p.y = message.move;
		}
	});

	socket.addEventListener("close", function(event) {
		console.log("Got disconnected");
		// somehow stop the game
		socket = new WebSocket("ws://localhost:8080/ws");
	});

	let lastTime = performance.now();

	const gameLoop = event => {
		const startTime = performance.now();

		// deltaTime is in ms
		const deltaTime = startTime - lastTime;

		// move ball
		ball.move(deltaTime);
		p1.move(deltaTime);
		p2.move(deltaTime);

		// handle bounces
		if (ball.moveDirection() == Missile.Left) {
			contact(ball, p1);
		} else {
			contact(ball, p2);
		}

		// handle hitting paddles

		// end match
		if (ball.x <= 5 || ball.x >= 395) {
			p1.reset();
			p2.reset();
			socket.send(JSON.stringify({ gameOver: true }));
		}

		// draw
		ctx.clearRect(0, 0, 400, 400);
		p1.draw(ctx);
		p2.draw(ctx);
		ball.draw(ctx);

		lastTime = startTime;
		window.requestAnimationFrame(gameLoop);
	};
	window.requestAnimationFrame(gameLoop);
}

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
		this._moveY -= this._speed;
	}
	moveDown() {
		this._moveY += this._speed;
	}

	move(deltaTime) {
		if (
			(this.bottom <= 400 && this._moveY > 0) ||
			(this.top >= 0 && this._moveY < 0)
		) {
			this._y += (this._moveY * deltaTime) / 100;
			this._moveY = 0;
		}
	}

	draw(ctx) {
		ctx.fillStyle = "Black";
		ctx.fillRect(this._x, this._y, this._paddleWidth, this._paddleHeight);
		ctx.strokeRect(0, 0, 400, 400);
		ctx.strokeStyle = "Black";
		ctx.strokeRect(
			this.left,
			this.top,
			this.right - this.left,
			this.bottom - this.top
		);
	}
}

class Missile {
	constructor(x, y) {
		this._initialX = this._x = x;
		this._initialY = this._y = y;
		this._radius = 5;
		this._speed = 5;
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

		this._moveX;
		this._moveY;

		let angleChange = (this._y - paddle.center) / (paddle._paddleHeight / 2);

		const speed = Math.sqrt(
			Math.pow(this._moveX, 2) + Math.pow(this._moveY, 2)
		);

		//TODO: CHANGE ANGLE OF BOUNCE
		this._moveY += angleChange;
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

	get x() {
		return this._x;
	}

	get y() {
		return this._y;
	}

	draw(ctx) {
		ctx.fillStyle = "Black";
		ctx.beginPath();
		ctx.arc(this._x, this._y, 5, 0, 2 * Math.PI);
		ctx.fill();
	}
}
