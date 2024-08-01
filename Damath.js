

const MESSAGE_TYPES = {
    CLIENT_SEND_MATCH_REQUEST: 100,
    SERVER_FINDS_MATCH: 101,
    SERVER_SENT_PARSING_MOVE: 102,
    CLIENT_SEND_MOVE_REQUEST: 103,
    CLIENT_WANT_A_REMATCH: 104,
    CLIENT_RESPOND_TO_REMATCH: 105,
    CLIENT_SURRENDER: 106,
    CLIENT_LEAVE: 107
};

const RESPOND_TYPES = {
    ACCEPTED: 100,
    DECLINED: 101,
    DECLINED_PLAYING: 102,
    DECLINED_OFFLINE: 103,
};

let MATCH_REQUESTS = [];

let MATCH_PLAYING = [];

let REMATCH_REQUESTS = [];

export function ParseClientSentData(socket, data) {
    const message = new MessageRequest(data);

    RemoveDisconectedSockets();

    switch(message.message_type) {
        case MESSAGE_TYPES.CLIENT_SEND_MATCH_REQUEST:
            TryMatch(new MatchRequest(socket, JSON.parse(message.message)));
        break;
        case MESSAGE_TYPES.SERVER_SENT_PARSING_MOVE:
            TryMove(new MoveRequest(socket, JSON.parse(message.message)));
        break;
        case MESSAGE_TYPES.CLIENT_WANT_A_REMATCH:
            console.log("HEY A REMATCH!");
            SendRematchRequest(new RematchRequest(socket, JSON.parse(message.message)));
        break;
        case MESSAGE_TYPES.CLIENT_RESPOND_TO_REMATCH:
            console.log("ACCEPTED A REMATCH!");
            SendRematchRespond(new RematchRespond(socket, JSON.parse(message.message)));
        break;
        case MESSAGE_TYPES.CLIENT_SURRENDER: 
            SendSurrenderRequest(new SurrenderRequest(socket, JSON.parse(message.message)));
        break;
    }
}

export function RemoveDisconectedSockets() {
    MATCH_REQUESTS = MATCH_REQUESTS.filter(match => match.socket && match.socket.connected);

    for (const match of MATCH_PLAYING) {
        if (!match.players.player1.socket || !match.players.player2.socket) {
            if (!match.players.player1.socket) {
                PlayerLeave(match, match.players.player1, match.players.player2);
            } else {
                PlayerLeave(match, match.players.player2, match.players.player1);
            }
        }

        if (!match.players.player1.socket.connected) {
            PlayerLeave(match, match.players.player1, match.players.player2);
        } 
        
        if (!match.players.player1.socket.connected){
            PlayerLeave(match, match.players.player2, match.players.player1);
        }
    }

    MATCH_PLAYING = MATCH_PLAYING.filter(m => m.players.player1.socket && m.players.player2.socket).filter(match => match.players.player1.socket.connected && match.players.player2.socket.connected);
}

function PlayerLeave(match, playerLeave, playerWin) {
    const msg = new MessageRequest({
        message_type: MESSAGE_TYPES.CLIENT_LEAVE,
        message: {
            uuid: uuidv4(),
            match_uuid: match.uuid,
            player_uuid: playerLeave.uuid
        }
    });

    msg.send(playerWin.socket);   
}

function uuidv4() {
return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
);
}

function shuffle(array) {
    let currentIndex = array.length;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  }


class MessageRequest {
    constructor({uuid, message_type, message}) {
        this.uuid = uuid ?? uuidv4();
        this.message_type = message_type;
        this.message = message;
    }

    send(socket) {
        socket.emit("send_message", JSON.stringify({
            uuid: this.uuid,
            message_type: this.message_type,
            message: JSON.stringify(this.message)
        }))
    }
}

class MoveRequest {
    constructor(socket, {uuid, match_uuid, player_uuid, player, move}) {
        this.socket = socket;
        this.uuid = uuid ?? uuidv4();
        this.match_uuid = match_uuid;
        this.player_uuid = player_uuid;
        this.player = player;
        this.move = move;
    }

    get() {
        return {
            uuid: this.uuid, 
            match_uuid: this.match_uuid, 
            player_uuid: this.player_uuid, 
            player: this.player, 
            move: this.move
        }
    }
}

class MatchRequest {
    constructor(socket, {uuid, board_type, player_uuid, player}) {
        this.socket = socket;
        this.uuid = uuid ?? uuidv4();
        this.board_type = board_type;
        this.player_uuid = player_uuid;
        this.player = player;
    }
}

class RematchRequest {
    constructor(socket, {uuid, fromPlayer, toPlayer, recent_match_uuid, request}) {
        this.socket = socket;
        this.uuid = uuid ?? uuidv4();
        this.fromPlayer = fromPlayer;
        this.toPlayer = toPlayer;
        this.recent_match_uuid = recent_match_uuid;
        this.request = request;
    }
    
    get() {
        return {
            uuid: this.uuid, 
            fromPlayer: this.fromPlayer, 
            toPlayer: this.toPlayer, 
            recent_match_uuid: this.recent_match_uuid,
            request: this.request,
        }
    }
}

class RematchRespond {
    constructor(socket, {uuid, rematch, respond, request}) {
        this.socket = socket;
        this.uuid = uuid;
        this.rematch = rematch;
        this.respond = respond;
        this.request = request;
    }

    get() {
        return {
            uuid: this.uuid, 
            rematch: this.rematch, 
            respond: this.respond, 
            request: this.request,
        }
    }
}

class DaMatch {
    constructor({uuid, player1, player2, board_type}, players) {
        this.uuid = uuid ?? uuidv4();
        this.player1 = player1;
        this.player2 = player2;
        this.board_type = board_type;
        this.players = players;
    }
}

class Player {
    constructor(socket, {uuid, playerName, color}) {
        this.uuid = uuid ?? uuidv4();
        this.playerName = playerName;
        this.color = color;
        this.socket = socket;
    }
}

class SurrenderRequest {
    constructor(socket, re) {
        let {uuid, match_uuid, player_uuid, player} = re;

        this.request = re;
        this.socket = socket;
        this.uuid = uuid;
        this.match_uuid = match_uuid;
        this.player_uuid = player_uuid;
        this.player = player;
    }
}

function SendSurrenderRequest(request) {
    const match = GetMatch(request.match_uuid);

    if (match != null) {
        const fromPlayer = request.player_uuid;
        const targetPlayer = match.players.player1.uuid == fromPlayer ? match.players.player2 : match.players.player1;

        const msg = new MessageRequest({
            message_type: MESSAGE_TYPES.CLIENT_SURRENDER,
            message: request.request
        });

        msg.send(targetPlayer.socket);
    }
}

function GetRematchRequest(uuid) {
    for (const rematch of REMATCH_REQUESTS) {
        if (rematch.uuid == uuid) {
            return rematch;
        }
    }

    return null;
}

function SendRematchRespond(request) {
    const rr = JSON.parse(request.rematch);
    const rematch = GetRematchRequest(rr.uuid);

    if (rematch != null) {
        const match = GetMatch(rematch.recent_match_uuid);
        const fromPlayer = JSON.parse(rematch.fromPlayer);
        const targetPlayer = match.players.player1.uuid == fromPlayer.uuid ? match.players.player2 : match.players.player1;
        const senderPlayer = match.players.player1.uuid != fromPlayer.uuid ? match.players.player2 : match.players.player1;

        const msg = new MessageRequest({
            message_type: MESSAGE_TYPES.CLIENT_RESPOND_TO_REMATCH,
            message: request.get()
        });

        msg.send(targetPlayer.socket);

        if (request.respond == 100) {
            const p1 = new MatchRequest(senderPlayer.socket, JSON.parse(rematch.request));
            const p2 = new MatchRequest(targetPlayer.socket, JSON.parse(request.request));
        
            GoMatch(p1, p2);
        }
    }   
}

function SendRematchRequest(request) {
    const match = GetMatch(request.recent_match_uuid);

    if (match != null) {
        const fromPlayer = JSON.parse(request.fromPlayer);
        const targetPlayer = match.players.player1.uuid == fromPlayer.uuid ? match.players.player2 : match.players.player1;

        if (targetPlayer) {
            const msg = new MessageRequest({
                message_type: MESSAGE_TYPES.CLIENT_WANT_A_REMATCH,
                message:request.get()
            });

            msg.send(targetPlayer.socket);

            REMATCH_REQUESTS.push(request);
        }
    }
}

function GetMatch(uuid) {
    for (const match of MATCH_PLAYING) {
        if (match.uuid == uuid) {
            return match;
        }
    }

    return null;
}

function TryMove(request) {
    const match = GetMatch(request.match_uuid);

    if (match != null) {
        const msg = new MessageRequest({
            message_type: MESSAGE_TYPES.SERVER_SENT_PARSING_MOVE,
            message: request.get()
        })

        msg.send(match.players.player1.socket);
        msg.send(match.players.player2.socket);
    }
}

function TryMatch(request) {
    for (const mr of MATCH_REQUESTS) {
        if (mr.board_type == request.board_type && request.player_uuid != mr.player_uuid) {

            console.log("FIND A MATCH");

            GoMatch(mr, request);

            MATCH_REQUESTS = MATCH_REQUESTS.filter(m => m.uuid != mr.uuid);

            return;
        }
    }

    MATCH_REQUESTS.push(request);

    const msg = new MessageRequest({ message_type: 10, message: "QUQUE ADDED"});

    msg.send(request.socket);

    console.log(MATCH_REQUESTS.length + " QUQUE");
    console.log(MATCH_PLAYING.length + " Playing");

}

function GoMatch(request1, request2) {
    let players = [request1, request2];

    shuffle(players);

    const white = players[0];
    const black = players[1];

    const match = {
        uuid: uuidv4(),
        player1: white.player,
        player2: black.player,
        board_type: white.board_type
    };

    const messageRequest = { 
        uuid: uuidv4(),
        message_type: MESSAGE_TYPES.SERVER_FINDS_MATCH,
        message: JSON.stringify(match)
    };

    MATCH_PLAYING.push(new DaMatch(match, {
        player1: new Player(white.socket, JSON.parse(white.player)),
        player2: new Player(black.socket, JSON.parse(black.player))
    }));

    // console.log(match);
    white.socket.emit("send_message", JSON.stringify(messageRequest));
    black.socket.emit("send_message", JSON.stringify(messageRequest));
}