const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {

    if (req.url === "/" || req.url === "/index.html") {

        fs.readFile("index.html", (err, data) => {

            if (err) {
                res.writeHead(500);
                res.end("Erreur serveur");
                return;
            }

            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8"
            });

            res.end(data);
        });

        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();

function generateRoomCode() {

    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {

        code = "";

        for (let i = 0; i < 6; i++) {

            code += characters[
                Math.floor(Math.random() * characters.length)
            ];

        }

    } while (rooms.has(code));

    return code;
}

function send(socket, data) {

    if (socket.readyState === WebSocket.OPEN) {

        socket.send(JSON.stringify(data));

    }

}

wss.on("connection", socket => {

    console.log("Un joueur vient de se connecter.");

    socket.room = null;
    socket.playerId = null;

    // =========================
    // CREER UNE PARTIE
    // =========================

    socket.on("message", message => {

        let data;

        try {

            data = JSON.parse(message.toString());

        } catch {

            return;

        }

        if (data.type === "createRoom") {

            const code = generateRoomCode();

            const room = {
    code: code,
    players: [],
    score1: 0,
    score2: 0
};


            rooms.set(code, room);

            room.players.push(socket);

            socket.room = room;
            socket.playerId = 1;

            send(socket, {

                type: "roomCreated",

                code: code,

                playerId: 1

            });

            console.log("Partie créée :", code);

            return;
        }

        // =========================
        // REJOINDRE UNE PARTIE
        // =========================

        if (data.type === "joinRoom") {

            const code = String(data.code)
                .trim()
                .toUpperCase();

            const room = rooms.get(code);

            if (!room) {

                send(socket, {

                    type: "error",

                    message: "Partie introuvable."

                });

                return;
            }

            if (room.players.length >= 2) {

                send(socket, {

                    type: "error",

                    message: "Cette partie est déjà complète."

                });

                return;
            }

            room.players.push(socket);

            socket.room = room;
            socket.playerId = 2;

            send(socket, {

                type: "joinedRoom",

                code: code,

                playerId: 2

            });

            // Les deux joueurs commencent
            room.players.forEach(player => {

                send(player, {

                    type: "gameStart"

                });

            });

            console.log("Joueur 2 rejoint :", code);

            return;
        }
        // =========================
        // TIR D'UN JOUEUR
        // =========================

        if (data.type === "shoot") {

            const room = socket.room;

            if (!room) {
                return;
            }

            room.players.forEach(player => {

                send(player, {

                    type: "bulletCreated",

                    bullet: data.bullet

                });

            });

            return;
        }
        // =========================
        // POSITION D'UN JOUEUR
        // =========================

        if (data.type === "playerState") {

            const room = socket.room;

            if (!room) {
                return;
            }

            room.players.forEach(player => {

                if (player !== socket) {

                    send(player, {

                        type: "opponentState",

                        playerId: socket.playerId,

                        state: data.state

                    });

                }

            });

            return;
        }
if (data.type === "hit") {

    const room = socket.room;

    if (!room) {
        return;
    }

    if (socket.playerId === 1) {
        room.score1++;
    }

    if (socket.playerId === 2) {
        room.score2++;
    }

    room.players.forEach(player => {

        send(player, {

            type: "scoreUpdate",

            score1: room.score1,

            score2: room.score2

        });

    });

    if (
        room.score1 >= 5 ||
        room.score2 >= 5
    ) {

        room.players.forEach(player => {

            send(player, {

                type: "gameOver",

                score1: room.score1,

                score2: room.score2

            });

        });

    }

    return;
}

    });

    // =========================
    // DECONNEXION
    // =========================

    socket.on("close", () => {

        const room = socket.room;

        if (!room) {
            return;
        }

        room.players.forEach(player => {

            if (player !== socket) {

                send(player, {

                    type: "opponentDisconnected"

                });

            }

        });

        rooms.delete(room.code);

        console.log("Partie supprimée :", room.code);

    });

});

server.listen(PORT, () => {

    console.log("");
    console.log("==============================");
    console.log("     DUEL ONLINE SERVEUR");
    console.log("==============================");
    console.log("");
    console.log(`http://localhost:${PORT}`);
    console.log("");

});
