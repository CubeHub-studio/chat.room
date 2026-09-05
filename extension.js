(function (Scratch) {
    "use strict";

    class MultiplayerRooms {
        constructor() {
            this.apiUrl = "https://sign-in-up-api.inakuu69.workers.dev";

            this.token = "";

            this.userId = "";
            this.username = "";

            this.roomId = "";
            this.roomCode = "";
            this.creatorId = "";

            this.players = [];
            this.messages = [];

            this.lastMessageId = 0;

            this.lastError = "";
            this.lastStatus = "";

            this.heartbeatTimer = null;
            this.messageTimer = null;

            this.autoHeartbeat = false;
            this.autoMessages = false;
        }

        /* =====================================================
           HELPERS
           ===================================================== */

        setError(message) {
            this.lastError = String(message || "");
            console.error("[Multiplayer]", this.lastError);
        }

        setStatus(message) {
            this.lastStatus = String(message || "");
        }

        async request(path, options = {}) {
            const headers = {
                "Content-Type": "application/json"
            };

            if (this.token) {
                headers["Authorization"] =
                    "Bearer " + this.token;
            }

            const response = await fetch(
                this.apiUrl.replace(/\/+$/, "") + path,
                {
                    ...options,
                    headers: {
                        ...headers,
                        ...(options.headers || {})
                    }
                }
            );

            let data;

            try {
                data = await response.json();
            } catch {
                data = {
                    success: false,
                    error: "Server returned invalid JSON"
                };
            }

            if (!response.ok || data.success === false) {
                const error =
                    data.error ||
                    "Request failed";

                this.setError(error);

                throw new Error(error);
            }

            this.lastError = "";

            return data;
        }

        requireLogin() {
            if (!this.token) {
                this.setError(
                    "You must be logged in first"
                );

                return false;
            }

            return true;
        }

        /* =====================================================
           EXTENSION BLOCKS
           ===================================================== */

        getInfo() {
            return {
                id: "multiplayerrooms",

                name: "Multiplayer Rooms",

                color1: "#4C97FF",
                color2: "#3373CC",
                color3: "#2E5DA8",

                blocks: [

                    /* -----------------------------------------
                       API
                       ----------------------------------------- */

                    {
                        opcode: "setApiUrl",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set multiplayer API URL to [URL]",
                        arguments: {
                            URL: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue:
                                    "https://sign-in-up-api.inakuu69.workers.dev"
                            }
                        }
                    },

                    {
                        opcode: "apiUrlReporter",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "multiplayer API URL"
                    },

                    /* -----------------------------------------
                       AUTH
                       ----------------------------------------- */

                    {
                        opcode: "setToken",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set multiplayer token to [TOKEN]",
                        arguments: {
                            TOKEN: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: ""
                            }
                        }
                    },

                    {
                        opcode: "setUsername",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set my username to [USERNAME]",
                        arguments: {
                            USERNAME: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: "Player"
                            }
                        }
                    },

                    {
                        opcode: "setUserId",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set my user ID to [ID]",
                        arguments: {
                            ID: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: ""
                            }
                        }
                    },

                    {
                        opcode: "token",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "multiplayer token"
                    },

                    {
                        opcode: "username",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "my username"
                    },

                    {
                        opcode: "userId",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "my user ID"
                    },

                    /* -----------------------------------------
                       ROOM CREATION
                       ----------------------------------------- */

                    {
                        opcode: "createRoom",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "create multiplayer room"
                    },

                    {
                        opcode: "createRoomAndWait",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "create multiplayer room and wait"
                    },

                    {
                        opcode: "roomId",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "room ID"
                    },

                    {
                        opcode: "roomCode",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "room code"
                    },

                    {
                        opcode: "creatorId",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "room creator ID"
                    },

                    /* -----------------------------------------
                       JOINING
                       ----------------------------------------- */

                    {
                        opcode: "joinRoom",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "join room [CODE]",
                        arguments: {
                            CODE: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: "ABC123"
                            }
                        }
                    },

                    {
                        opcode: "joinRoomAndWait",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "join room [CODE] and wait",
                        arguments: {
                            CODE: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: "ABC123"
                            }
                        }
                    },

                    {
                        opcode: "leaveRoom",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "leave multiplayer room"
                    },

                    {
                        opcode: "inRoom",
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: "in a multiplayer room?"
                    },

                    /* -----------------------------------------
                       PLAYERS
                       ----------------------------------------- */

                    {
                        opcode: "refreshPlayers",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "refresh room players"
                    },

                    {
                        opcode: "refreshPlayersAndWait",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "refresh room players and wait"
                    },

                    {
                        opcode: "playerCount",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "player count"
                    },

                    {
                        opcode: "playerUsername",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "username of player [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "playerId",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "ID of player [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "playerJoinedAt",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "join time of player [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "playerLastSeen",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "last seen of player [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    /* -----------------------------------------
                       CHAT
                       ----------------------------------------- */

                    {
                        opcode: "sendMessage",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "send chat message [MESSAGE]",
                        arguments: {
                            MESSAGE: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: "Hello!"
                            }
                        }
                    },

                    {
                        opcode: "sendMessageAndWait",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "send chat message [MESSAGE] and wait",
                        arguments: {
                            MESSAGE: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: "Hello!"
                            }
                        }
                    },

                    {
                        opcode: "refreshMessages",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "get new chat messages"
                    },

                    {
                        opcode: "refreshMessagesAndWait",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "get new chat messages and wait"
                    },

                    {
                        opcode: "messageCount",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "chat message count"
                    },

                    {
                        opcode: "messageText",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "text of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageUsername",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "sender of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageUserId",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "sender ID of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageId",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "ID of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageCreatedAt",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "time of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "latestMessage",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "latest chat message"
                    },

                    {
                        opcode: "latestMessageSender",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "latest chat sender"
                    },

                    /* -----------------------------------------
                       HEARTBEAT
                       ----------------------------------------- */

                    {
                        opcode: "heartbeat",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "send room heartbeat"
                    },

                    {
                        opcode: "heartbeatAndWait",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "send room heartbeat and wait"
                    },

                    /* -----------------------------------------
                       AUTOMATIC UPDATES
                       ----------------------------------------- */

                    {
                        opcode: "startAutoHeartbeat",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "start automatic room heartbeat"
                    },

                    {
                        opcode: "stopAutoHeartbeat",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "stop automatic room heartbeat"
                    },

                    {
                        opcode: "startAutoMessages",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "start automatic chat updates"
                    },

                    {
                        opcode: "stopAutoMessages",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "stop automatic chat updates"
                    },

                    /* -----------------------------------------
                       STATUS
                       ----------------------------------------- */

                    {
                        opcode: "lastError",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "multiplayer error"
                    },

                    {
                        opcode: "lastStatus",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "multiplayer status"
                    },

                    {
                        opcode: "clearMessages",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "clear local chat messages"
                    },

                    {
                        opcode: "clearError",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "clear multiplayer error"
                    }
                ]
            };
        }

        /* =====================================================
           API
           ===================================================== */

        setApiUrl(args) {
            this.apiUrl =
                String(args.URL || "").trim()
                    .replace(/\/+$/, "");
        }

        apiUrlReporter() {
            return this.apiUrl;
        }

        /* =====================================================
           AUTH
           ===================================================== */

        setToken(args) {
            this.token =
                String(args.TOKEN || "").trim();

            this.setStatus(
                this.token
                    ? "Token set"
                    : "Token cleared"
            );
        }

        setUsername(args) {
            this.username =
                String(args.USERNAME || "");
        }

        setUserId(args) {
            this.userId =
                String(args.ID || "");
        }

        token() {
            return this.token;
        }

        username() {
            return this.username;
        }

        userId() {
            return this.userId;
        }

        /* =====================================================
           CREATE ROOM
           ===================================================== */

        async createRoom() {
            if (!this.requireLogin()) {
                return;
            }

            try {
                const data =
                    await this.request(
                        "/rooms",
                        {
                            method: "POST"
                        }
                    );

                const room =
                    data.room;

                this.roomId =
                    room.id || "";

                this.roomCode =
                    room.code || "";

                this.creatorId =
                    room.creatorId || "";

                this.players = [];
                this.messages = [];
                this.lastMessageId = 0;

                this.setStatus(
                    "Room created: " +
                    this.roomCode
                );

                await this.refreshPlayers();
            } catch {
                // Error already stored.
            }
        }

        async createRoomAndWait() {
            await this.createRoom();
        }

        roomId() {
            return this.roomId;
        }

        roomCode() {
            return this.roomCode;
        }

        creatorId() {
            return this.creatorId;
        }

        /* =====================================================
           JOIN ROOM
           ===================================================== */

        async joinRoom(args) {
            if (!this.requireLogin()) {
                return;
            }

            const code =
                String(args.CODE || "")
                    .trim()
                    .toUpperCase();

            if (!code) {
                this.setError(
                    "Room code cannot be empty"
                );

                return;
            }

            try {
                const data =
                    await this.request(
                        "/rooms/join",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                code
                            })
                        }
                    );

                const room =
                    data.room;

                this.roomId =
                    room.id || "";

                this.roomCode =
                    room.code || "";

                this.creatorId =
                    room.creatorId || "";

                this.players = [];
                this.messages = [];
                this.lastMessageId = 0;

                this.setStatus(
                    "Joined room: " +
                    this.roomCode
                );

                await this.refreshPlayers();
                await this.refreshMessages();
            } catch {
                // Error already stored.
            }
        }

        async joinRoomAndWait(args) {
            await this.joinRoom(args);
        }

        /* =====================================================
           LEAVE
           ===================================================== */

        async leaveRoom() {
            if (!this.roomId) {
                return;
            }

            if (!this.requireLogin()) {
                return;
            }

            const oldRoomId =
                this.roomId;

            try {
                await this.request(
                    "/rooms/leave",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            roomId: oldRoomId
                        })
                    }
                );

                this.roomId = "";
                this.roomCode = "";
                this.creatorId = "";

                this.players = [];
                this.messages = [];
                this.lastMessageId = 0;

                this.setStatus(
                    "Left room"
                );
            } catch {
                // Error already stored.
            }
        }

        inRoom() {
            return this.roomId !== "";
        }

        /* =====================================================
           PLAYERS
           ===================================================== */

        async refreshPlayers() {
            if (!this.requireLogin()) {
                return;
            }

            if (!this.roomId) {
                this.setError(
                    "You are not in a room"
                );

                return;
            }

            try {
                const data =
                    await this.request(
                        "/rooms/" +
                        encodeURIComponent(
                            this.roomId
                        ),
                        {
                            method: "GET"
                        }
                    );

                this.players =
                    data.players || [];

                if (data.room) {
                    this.roomId =
                        data.room.id ||
                        this.roomId;

                    this.roomCode =
                        data.room.code ||
                        this.roomCode;

                    this.creatorId =
                        data.room.creatorId ||
                        this.creatorId;
                }

                this.setStatus(
                    "Player list updated"
                );
            } catch {
                // Error already stored.
            }
        }

        async refreshPlayersAndWait() {
            await this.refreshPlayers();
        }

        playerCount() {
            return this.players.length;
        }

        getPlayer(index) {
            const number =
                Math.floor(
                    Number(index)
                );

            if (
                !Number.isFinite(number) ||
                number < 1 ||
                number > this.players.length
            ) {
                return null;
            }

            return this.players[number - 1];
        }

        playerUsername(args) {
            const player =
                this.getPlayer(args.NUMBER);

            return player
                ? player.username || ""
                : "";
        }

        playerId(args) {
            const player =
                this.getPlayer(args.NUMBER);

            return player
                ? player.id || ""
                : "";
        }

        playerJoinedAt(args) {
            const player =
                this.getPlayer(args.NUMBER);

            return player
                ? player.joined_at || ""
                : "";
        }

        playerLastSeen(args) {
            const player =
                this.getPlayer(args.NUMBER);

            return player
                ? player.last_seen || ""
                : "";
        }

        /* =====================================================
           CHAT
           ===================================================== */

        async sendMessage(args) {
            if (!this.requireLogin()) {
                return;
            }

            if (!this.roomId) {
                this.setError(
                    "You are not in a room"
                );

                return;
            }

            const message =
                String(args.MESSAGE || "")
                    .trim();

            if (!message) {
                this.setError(
                    "Message cannot be empty"
                );

                return;
            }

            try {
                const data =
                    await this.request(
                        "/rooms/message",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                roomId:
                                    this.roomId,
                                message
                            })
                        }
                    );

                if (data.message) {
                    const msg =
                        this.normalizeMessage(
                            data.message
                        );

                    this.messages.push(msg);

                    if (
                        msg.id >
                        this.lastMessageId
                    ) {
                        this.lastMessageId =
                            msg.id;
                    }
                }

                this.setStatus(
                    "Message sent"
                );
            } catch {
                // Error already stored.
            }
        }

        async sendMessageAndWait(args) {
            await this.sendMessage(args);
        }

        async refreshMessages() {
            if (!this.requireLogin()) {
                return;
            }

            if (!this.roomId) {
                this.setError(
                    "You are not in a room"
                );

                return;
            }

            try {
                const path =
                    "/rooms/messages?roomId=" +
                    encodeURIComponent(
                        this.roomId
                    ) +
                    "&after=" +
                    encodeURIComponent(
                        this.lastMessageId
                    );

                const data =
                    await this.request(
                        path,
                        {
                            method: "GET"
                        }
                    );

                const incoming =
                    data.messages || [];

                for (
                    const raw of incoming
                ) {
                    const msg =
                        this.normalizeMessage(
                            raw
                        );

                    const alreadyExists =
                        this.messages.some(
                            existing =>
                                existing.id ===
                                msg.id
                        );

                    if (!alreadyExists) {
                        this.messages.push(
                            msg
                        );
                    }

                    if (
                        msg.id >
                        this.lastMessageId
                    ) {
                        this.lastMessageId =
                            msg.id;
                    }
                }

                /*
                 * Keep the local list from growing forever.
                 */
                if (
                    this.messages.length >
                    500
                ) {
                    this.messages =
                        this.messages.slice(
                            -500
                        );
                }

                this.setStatus(
                    incoming.length +
                    " new message(s)"
                );
            } catch {
                // Error already stored.
            }
        }

        async refreshMessagesAndWait() {
            await this.refreshMessages();
        }

        normalizeMessage(raw) {
            return {
                id: Number(
                    raw.id || 0
                ),

                roomId:
                    raw.room_id ||
                    raw.roomId ||
                    "",

                userId:
                    raw.user_id ||
                    raw.userId ||
                    "",

                username:
                    raw.username ||
                    "",

                message:
                    raw.message ||
                    "",

                createdAt:
                    raw.created_at ||
                    raw.createdAt ||
                    0
            };
        }

        messageCount() {
            return this.messages.length;
        }

        getMessage(index) {
            const number =
                Math.floor(
                    Number(index)
                );

            if (
                !Number.isFinite(number) ||
                number < 1 ||
                number > this.messages.length
            ) {
                return null;
            }

            return this.messages[
                number - 1
            ];
        }

        messageText(args) {
            const message =
                this.getMessage(
                    args.NUMBER
                );

            return message
                ? message.message
                : "";
        }

        messageUsername(args) {
            const message =
                this.getMessage(
                    args.NUMBER
                );

            return message
                ? message.username
                : "";
        }

        messageUserId(args) {
            const message =
                this.getMessage(
                    args.NUMBER
                );

            return message
                ? message.userId
                : "";
        }

        messageId(args) {
            const message =
                this.getMessage(
                    args.NUMBER
                );

            return message
                ? message.id
                : "";
        }

        messageCreatedAt(args) {
            const message =
                this.getMessage(
                    args.NUMBER
                );

            return message
                ? message.createdAt
                : "";
        }

        latestMessage() {
            if (
                this.messages.length ===
                0
            ) {
                return "";
            }

            return this.messages[
                this.messages.length - 1
            ].message;
        }

        latestMessageSender() {
            if (
                this.messages.length ===
                0
            ) {
                return "";
            }

            return this.messages[
                this.messages.length - 1
            ].username;
        }

        clearMessages() {
            this.messages = [];
            this.lastMessageId = 0;
        }

        /* =====================================================
           HEARTBEAT
           ===================================================== */

        async heartbeat() {
            if (!this.requireLogin()) {
                return;
            }

            if (!this.roomId) {
                return;
            }

            try {
                await this.request(
                    "/rooms/heartbeat",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            roomId:
                                this.roomId
                        })
                    }
                );

                this.setStatus(
                    "Room heartbeat sent"
                );
            } catch {
                // Error already stored.
            }
        }

        async heartbeatAndWait() {
            await this.heartbeat();
        }

        /* =====================================================
           AUTOMATIC HEARTBEAT
           ===================================================== */

        startAutoHeartbeat() {
            this.stopAutoHeartbeat();

            this.autoHeartbeat = true;

            /*
             * Backend considers someone inactive
             * after 30 seconds.
             *
             * Sending every 10 seconds gives
             * plenty of safety margin.
             */

            this.heartbeatTimer =
                setInterval(
                    () => {
                        if (
                            this.autoHeartbeat &&
                            this.roomId &&
                            this.token
                        ) {
                            this.heartbeat();
                        }
                    },
                    10000
                );

            this.setStatus(
                "Automatic heartbeat started"
            );

            this.heartbeat();
        }

        stopAutoHeartbeat() {
            this.autoHeartbeat = false;

            if (
                this.heartbeatTimer
            ) {
                clearInterval(
                    this.heartbeatTimer
                );

                this.heartbeatTimer =
                    null;
            }

            this.setStatus(
                "Automatic heartbeat stopped"
            );
        }

        /* =====================================================
           AUTOMATIC CHAT UPDATES
           ===================================================== */

        startAutoMessages() {
            this.stopAutoMessages();

            this.autoMessages = true;

            /*
             * Poll every 1.5 seconds.
             */

            this.messageTimer =
                setInterval(
                    () => {
                        if (
                            this.autoMessages &&
                            this.roomId &&
                            this.token
                        ) {
                            this.refreshMessages();
                        }
                    },
                    1500
                );

            this.setStatus(
                "Automatic chat updates started"
            );

            this.refreshMessages();
        }

        stopAutoMessages() {
            this.autoMessages = false;

            if (
                this.messageTimer
            ) {
                clearInterval(
                    this.messageTimer
                );

                this.messageTimer =
                    null;
            }

            this.setStatus(
                "Automatic chat updates stopped"
            );
        }

        /* =====================================================
           STATUS
           ===================================================== */

        lastError() {
            return this.lastError;
        }

        lastStatus() {
            return this.lastStatus;
        }

        clearError() {
            this.lastError = "";
        }
    }

    Scratch.extensions.register(
        new MultiplayerRooms()
    );
})(Scratch);
