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

app.ws("/ws", function(ws, req) {
	ws.on("message", function(msg) {
		console.log(`got msg ${msg}`);
		ws.send("msg recv");
	});
});

app.listen(process.env.PORT || 8080, () => {
	console.log("server running");
});
