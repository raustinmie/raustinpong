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
		ball.bounce();
	}
}

function onLoad(event) {
	const boardCanvas = document.getElementById("table");
	const ctx = boardCanvas.getContext("2d");
	console.log("Document finished loading");

	let p1 = new Paddle(20, 180);
	let p2 = new Paddle(370, 180);
	let ball = new Missile(200, 200);

	document.addEventListener("keydown", event => {
		if (event.keyCode === 40) {
			p2.moveUp();
		} else if (event.keyCode === 38) {
			p2.moveDown();
		}
		if (event.keyCode === 83) {
			p1.moveUp();
		} else if (event.keyCode === 87) {
			p1.moveDown();
		}
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
		if (ball.x <= 5) {
			alert("P2 Wins!");
			ball.reset();
			p1.reset();
			p2.reset();
			ball.startMoving();
		} else if (ball.x >= 395) {
			alert("P1 Wins!");
			ball.reset();
			p1.reset();
			p2.reset();
			ball.startMoving();
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
		this._speed = 15;
		this._moveY = 0;
	}

	reset() {
		this._y = this._initialY;
	}

	get bottom() {
		return this._y + 40;
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
		this._moveY += this._speed;
	}
	moveDown() {
		this._moveY -= this._speed;
	}

	move(deltaTime) {
		this._y += (this._moveY * deltaTime) / 100;
		this._moveY = 0;
	}

	draw(ctx) {
		ctx.fillStyle = "Black";
		ctx.fillRect(this._x, this._y, 10, 40);

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
		this._speed = 13;
		this.startMoving();
	}

	reset() {
		this._x = this._initialX;
		this._y = this._initialY;
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

	bounce() {
		this._moveX *= -1;
	}

	startMoving() {
		this._moveX = roll();
		if (between(-0.45, 0.45, this._moveX)) {
			this.startMoving();
		}

		this._moveY = roll();

		const length = Math.sqrt(
			this._moveX * this._moveX + this._moveY * this._moveY
		);

		this._moveX /= length;
		this._moveY /= length;

		this._moveX *= this._speed;
		this._moveY *= this._speed;
	}

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
