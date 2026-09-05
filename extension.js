(function (Scratch) {
    "use strict";

    class MultiplayerRooms {
        constructor() {
            this.apiUrl = "https://example.com/api";

            // Separate multiplayer authentication.
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
            console.error("[Multiplayer Rooms]", this.lastError);
        }

        setStatus(message) {
            this.lastStatus = String(message || "");
            console.log("[Multiplayer Rooms]", this.lastStatus);
        }

        clearError() {
            this.lastError = "";
        }

        cleanString(value) {
            if (value === null || value === undefined) {
                return "";
            }

            return String(value).trim();
        }

        firstValue(object, keys, fallback = "") {
            if (!object || typeof object !== "object") {
                return fallback;
            }

            for (const key of keys) {
                if (
                    object[key] !== undefined &&
                    object[key] !== null &&
                    object[key] !== ""
                ) {
                    return object[key];
                }
            }

            return fallback;
        }

        normalizeRoom(raw) {
            if (!raw || typeof raw !== "object") {
                return {
                    id: "",
                    code: "",
                    creatorId: ""
                };
            }

            return {
                id: this.cleanString(
                    this.firstValue(
                        raw,
                        [
                            "id",
                            "roomId",
                            "room_id"
                        ]
                    )
                ),

                code: this.cleanString(
                    this.firstValue(
                        raw,
                        [
                            "code",
                            "roomCode",
                            "room_code"
                        ]
                    )
                ).toUpperCase(),

                creatorId: this.cleanString(
                    this.firstValue(
                        raw,
                        [
                            "creatorId",
                            "creator_id",
                            "creator",
                            "ownerId",
                            "owner_id"
                        ]
                    )
                )
            };
        }

        normalizePlayer(raw) {
            if (!raw || typeof raw !== "object") {
                return {
                    id: "",
                    username: "",
                    joined_at: "",
                    last_seen: ""
                };
            }

            return {
                id: this.cleanString(
                    this.firstValue(
                        raw,
                        [
                            "id",
                            "userId",
                            "user_id"
                        ]
                    )
                ),

                username: this.cleanString(
                    this.firstValue(
                        raw,
                        [
                            "username",
                            "name"
                        ]
                    )
                ),

                joined_at: this.firstValue(
                    raw,
                    [
                        "joined_at",
                        "joinedAt",
                        "joinTime",
                        "join_time"
                    ],
                    ""
                ),

                last_seen: this.firstValue(
                    raw,
                    [
                        "last_seen",
                        "lastSeen",
                        "lastSeenAt",
                        "last_seen_at"
                    ],
                    ""
                )
            };
        }

        normalizeMessage(raw) {
            if (!raw || typeof raw !== "object") {
                return {
                    id: 0,
                    roomId: "",
                    userId: "",
                    username: "",
                    message: "",
                    createdAt: 0
                };
            }

            return {
                id: Number(
                    this.firstValue(
                        raw,
                        [
                            "id",
                            "messageId",
                            "message_id"
                        ],
                        0
                    )
                ) || 0,

                roomId: this.cleanString(
                    this.firstValue(
                        raw,
                        [
                            "room_id",
                            "roomId"
                        ]
                    )
                ),

                userId: this.cleanString(
                    this.firstValue(
                        raw,
                        [
                            "user_id",
                            "userId",
                            "sender_id",
                            "senderId"
                        ]
                    )
                ),

                username: this.cleanString(
                    this.firstValue(
                        raw,
                        [
                            "username",
                            "sender",
                            "senderUsername",
                            "sender_username"
                        ]
                    )
                ),

                message: this.cleanString(
                    this.firstValue(
                        raw,
                        [
                            "message",
                            "text",
                            "content"
                        ]
                    )
                ),

                createdAt: this.firstValue(
                    raw,
                    [
                        "created_at",
                        "createdAt",
                        "timestamp"
                    ],
                    0
                )
            };
        }

        extractRoom(data) {
            if (!data || typeof data !== "object") {
                return null;
            }

            /*
             * Accept all of these common formats:
             *
             * { room: {...} }
             * { data: { room: {...} } }
             * { id, code, creatorId }
             * { room_id, room_code, creator_id }
             */

            if (data.room) {
                return this.normalizeRoom(data.room);
            }

            if (
                data.data &&
                typeof data.data === "object"
            ) {
                if (data.data.room) {
                    return this.normalizeRoom(
                        data.data.room
                    );
                }

                return this.normalizeRoom(
                    data.data
                );
            }

            return this.normalizeRoom(data);
        }

        applyRoom(room) {
            if (!room) {
                return false;
            }

            if (room.id) {
                this.roomId = room.id;
            }

            if (room.code) {
                this.roomCode =
                    room.code.toUpperCase();
            }

            if (room.creatorId) {
                this.creatorId =
                    room.creatorId;
            }

            return !!(
                this.roomId ||
                this.roomCode
            );
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

            return this.messages[number - 1];
        }

        /* =====================================================
           HTTP
           ===================================================== */

        async request(path, options = {}) {
            const base =
                this.apiUrl
                    .replace(/\/+$/, "");

            const cleanPath =
                String(path || "").startsWith("/")
                    ? path
                    : "/" + path;

            const headers = {
                "Accept": "application/json",
                "Content-Type":
                    "application/json"
            };

            if (this.token) {
                headers.Authorization =
                    "Bearer " + this.token;
            }

            let response;

            try {
                response = await fetch(
                    base + cleanPath,
                    {
                        ...options,
                        headers: {
                            ...headers,
                            ...(options.headers || {})
                        }
                    }
                );
            } catch (error) {
                const message =
                    "Could not connect to multiplayer server: " +
                    (
                        error &&
                        error.message
                            ? error.message
                            : "Network error"
                    );

                this.setError(message);
                throw new Error(message);
            }

            const text =
                await response.text();

            let data = null;

            if (text.trim()) {
                try {
                    data = JSON.parse(text);
                } catch {
                    data = null;
                }
            }

            if (!response.ok) {
                let message =
                    "Server returned HTTP " +
                    response.status;

                if (data && data.error) {
                    message =
                        String(data.error);
                } else if (text.trim()) {
                    message = text.trim();
                }

                this.setError(message);

                throw new Error(message);
            }

            if (
                data &&
                (
                    data.success === false ||
                    data.ok === false
                )
            ) {
                const message =
                    data.error ||
                    data.message ||
                    "Multiplayer request failed";

                this.setError(message);

                throw new Error(
                    String(message)
                );
            }

            this.clearError();

            return data || {};
        }

        requireLogin() {
            if (!this.token) {
                this.setError(
                    "Set a multiplayer token first"
                );

                return false;
            }

            return true;
        }

        requireRoom() {
            if (!this.roomId) {
                this.setError(
                    "You are not in a multiplayer room"
                );

                return false;
            }

            return true;
        }

        /* =====================================================
           BLOCKS
           ===================================================== */

        getInfo() {
            return {
                id: "multiplayerrooms",

                name: "Multiplayer Rooms",

                color1: "#4C97FF",
                color2: "#3373CC",
                color3: "#2E5DA8",

                blocks: [

                    {
                        opcode: "setApiUrl",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "set multiplayer API URL to [URL]",
                        arguments: {
                            URL: {
                                type:
                                    Scratch.ArgumentType.STRING,
                                defaultValue:
                                    "https://example.com/api"
                            }
                        }
                    },

                    {
                        opcode: "apiUrlReporter",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "multiplayer API URL"
                    },

                    {
                        opcode: "setToken",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "set multiplayer token to [TOKEN]",
                        arguments: {
                            TOKEN: {
                                type:
                                    Scratch.ArgumentType.STRING,
                                defaultValue:
                                    "ExampleToken123"
                            }
                        }
                    },

                    {
                        opcode: "setUsername",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "set my username to [USERNAME]",
                        arguments: {
                            USERNAME: {
                                type:
                                    Scratch.ArgumentType.STRING,
                                defaultValue:
                                    "ExamplePlayer"
                            }
                        }
                    },

                    {
                        opcode: "setUserId",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "set my user ID to [ID]",
                        arguments: {
                            ID: {
                                type:
                                    Scratch.ArgumentType.STRING,
                                defaultValue:
                                    "example-user-id"
                            }
                        }
                    },

                    {
                        opcode: "token",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "multiplayer token"
                    },

                    {
                        opcode: "username",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "my username"
                    },

                    {
                        opcode: "userId",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "my user ID"
                    },

                    {
                        opcode: "createRoom",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "create multiplayer room"
                    },

                    {
                        opcode: "createRoomAndWait",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "create multiplayer room and wait"
                    },

                    {
                        opcode: "joinRoom",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "join room [CODE]",
                        arguments: {
                            CODE: {
                                type:
                                    Scratch.ArgumentType.STRING,
                                defaultValue:
                                    "ABC123"
                            }
                        }
                    },

                    {
                        opcode: "joinRoomAndWait",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "join room [CODE] and wait",
                        arguments: {
                            CODE: {
                                type:
                                    Scratch.ArgumentType.STRING,
                                defaultValue:
                                    "ABC123"
                            }
                        }
                    },

                    {
                        opcode: "leaveRoom",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "leave multiplayer room"
                    },

                    {
                        opcode: "inRoom",
                        blockType:
                            Scratch.BlockType.BOOLEAN,
                        text:
                            "in a multiplayer room?"
                    },

                    {
                        opcode: "roomId",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "room ID"
                    },

                    {
                        opcode: "roomCode",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "room code"
                    },

                    {
                        opcode: "creatorId",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "room creator ID"
                    },

                    {
                        opcode: "refreshPlayers",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "refresh room players"
                    },

                    {
                        opcode: "refreshPlayersAndWait",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "refresh room players and wait"
                    },

                    {
                        opcode: "playerCount",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "player count"
                    },

                    {
                        opcode: "playerUsername",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "username of player [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type:
                                    Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "playerId",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "ID of player [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type:
                                    Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "playerJoinedAt",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "join time of player [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type:
                                    Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "playerLastSeen",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "last seen of player [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type:
                                    Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "sendMessage",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "send chat message [MESSAGE]",
                        arguments: {
                            MESSAGE: {
                                type:
                                    Scratch.ArgumentType.STRING,
                                defaultValue:
                                    "Hello, world!"
                            }
                        }
                    },

                    {
                        opcode: "sendMessageAndWait",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "send chat message [MESSAGE] and wait",
                        arguments: {
                            MESSAGE: {
                                type:
                                    Scratch.ArgumentType.STRING,
                                defaultValue:
                                    "Hello, world!"
                            }
                        }
                    },

                    {
                        opcode: "refreshMessages",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "get new chat messages"
                    },

                    {
                        opcode: "refreshMessagesAndWait",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "get new chat messages and wait"
                    },

                    {
                        opcode: "messageCount",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "chat message count"
                    },

                    {
                        opcode: "messageText",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "text of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type:
                                    Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageUsername",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "sender of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type:
                                    Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageUserId",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "sender ID of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type:
                                    Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageId",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "ID of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type:
                                    Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageCreatedAt",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "time of chat message [NUMBER]",
                        arguments: {
                            NUMBER: {
                                type:
                                    Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "latestMessage",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "latest chat message"
                    },

                    {
                        opcode: "latestMessageSender",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "latest chat sender"
                    },

                    {
                        opcode: "clearMessages",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "clear local chat messages"
                    },

                    {
                        opcode: "heartbeat",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "send room heartbeat"
                    },

                    {
                        opcode: "heartbeatAndWait",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "send room heartbeat and wait"
                    },

                    {
                        opcode: "startAutoHeartbeat",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "start automatic room heartbeat"
                    },

                    {
                        opcode: "stopAutoHeartbeat",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "stop automatic room heartbeat"
                    },

                    {
                        opcode: "startAutoMessages",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "start automatic chat updates"
                    },

                    {
                        opcode: "stopAutoMessages",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "stop automatic chat updates"
                    },

                    {
                        opcode: "lastError",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "multiplayer error"
                    },

                    {
                        opcode: "lastStatus",
                        blockType:
                            Scratch.BlockType.REPORTER,
                        text:
                            "multiplayer status"
                    },

                    {
                        opcode: "clearError",
                        blockType:
                            Scratch.BlockType.COMMAND,
                        text:
                            "clear multiplayer error"
                    }
                ]
            };
        }

        /* =====================================================
           API
           ===================================================== */

        setApiUrl(args) {
            this.apiUrl =
                this.cleanString(args.URL)
                    .replace(/\/+$/, "");

            this.setStatus(
                "Multiplayer API URL changed"
            );
        }

        apiUrlReporter() {
            return this.apiUrl;
        }

        /* =====================================================
           AUTH
           ===================================================== */

        setToken(args) {
            this.token =
                this.cleanString(args.TOKEN);

            this.setStatus(
                this.token
                    ? "Multiplayer token set"
                    : "Multiplayer token cleared"
            );
        }

        setUsername(args) {
            this.username =
                this.cleanString(args.USERNAME);

            this.setStatus(
                "Username set"
            );
        }

        setUserId(args) {
            this.userId =
                this.cleanString(args.ID);

            this.setStatus(
                "User ID set"
            );
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
            this.clearError();

            if (!this.requireLogin()) {
                return;
            }

            try {
                /*
                 * Clear the old room before creating another one.
                 */
                this.roomId = "";
                this.roomCode = "";
                this.creatorId = "";
                this.players = [];
                this.messages = [];
                this.lastMessageId = 0;

                this.setStatus(
                    "Creating multiplayer room..."
                );

                const data =
                    await this.request(
                        "/rooms",
                        {
                            method: "POST",
                            body: JSON.stringify({})
                        }
                    );

                const room =
                    this.extractRoom(data);

                if (!this.applyRoom(room)) {
                    this.setError(
                        "Server created a room but did not return a room ID or room code"
                    );

                    return;
                }

                this.players = [];
                this.messages = [];
                this.lastMessageId = 0;

                this.setStatus(
                    this.roomCode
                        ? "Created room " +
                          this.roomCode
                        : "Room created"
                );

                /*
                 * Get the initial player list.
                 */
                if (this.roomId) {
                    await this.refreshPlayers();
                }

                /*
                 * Start keeping the creator alive.
                 */
                this.startAutoHeartbeat();

            } catch (error) {
                if (!this.lastError) {
                    this.setError(
                        error.message ||
                        "Could not create room"
                    );
                }
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
            this.clearError();

            if (!this.requireLogin()) {
                return;
            }

            const code =
                this.cleanString(
                    args.CODE
                ).toUpperCase();

            if (!code) {
                this.setError(
                    "Room code cannot be empty"
                );

                return;
            }

            try {
                this.setStatus(
                    "Joining room " +
                    code +
                    "..."
                );

                const data =
                    await this.request(
                        "/rooms/join",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                code: code
                            })
                        }
                    );

                const room =
                    this.extractRoom(data);

                /*
                 * Some servers return only the room
                 * code on join. Preserve the entered
                 * code if necessary.
                 */
                if (!room.code) {
                    room.code = code;
                }

                if (!this.applyRoom(room)) {
                    this.setError(
                        "Join succeeded but the server did not return a room ID"
                    );

                    return;
                }

                this.players = [];
                this.messages = [];
                this.lastMessageId = 0;

                this.setStatus(
                    "Joined room " +
                    this.roomCode
                );

                await this.refreshPlayers();
                await this.refreshMessages();

                this.startAutoHeartbeat();

            } catch (error) {
                if (!this.lastError) {
                    this.setError(
                        error.message ||
                        "Could not join room"
                    );
                }
            }
        }

        async joinRoomAndWait(args) {
            await this.joinRoom(args);
        }

        /* =====================================================
           LEAVE
           ===================================================== */

        async leaveRoom() {
            this.clearError();

            if (!this.roomId) {
                this.setError(
                    "You are not in a room"
                );

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
                            roomId: oldRoomId,
                            room_id: oldRoomId
                        })
                    }
                );

            } catch (error) {
                /*
                 * Clear local state even if the server
                 * reports that the player is already gone.
                 */
                this.setError(
                    error.message ||
                    "Could not leave room"
                );
            }

            this.roomId = "";
            this.roomCode = "";
            this.creatorId = "";

            this.players = [];
            this.messages = [];
            this.lastMessageId = 0;

            this.stopAutoHeartbeat();
            this.stopAutoMessages();

            this.setStatus(
                "Left multiplayer room"
            );
        }

        inRoom() {
            return !!this.roomId;
        }

        /* =====================================================
           PLAYERS
           ===================================================== */

        async refreshPlayers() {
            if (!this.requireLogin()) {
                return;
            }

            if (!this.requireRoom()) {
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

                let rawPlayers = [];

                if (
                    Array.isArray(
                        data.players
                    )
                ) {
                    rawPlayers =
                        data.players;
                } else if (
                    data.room &&
                    Array.isArray(
                        data.room.players
                    )
                ) {
                    rawPlayers =
                        data.room.players;
                } else if (
                    data.data &&
                    Array.isArray(
                        data.data.players
                    )
                ) {
                    rawPlayers =
                        data.data.players;
                } else if (
                    data.data &&
                    data.data.room &&
                    Array.isArray(
                        data.data.room.players
                    )
                ) {
                    rawPlayers =
                        data.data.room.players;
                }

                this.players =
                    rawPlayers.map(
                        player =>
                            this.normalizePlayer(
                                player
                            )
                    );

                const room =
                    this.extractRoom(data);

                this.applyRoom(room);

                this.setStatus(
                    "Player list updated (" +
                    this.players.length +
                    " player(s))"
                );

            } catch (error) {
                if (!this.lastError) {
                    this.setError(
                        error.message ||
                        "Could not refresh players"
                    );
                }
            }
        }

        async refreshPlayersAndWait() {
            await this.refreshPlayers();
        }

        playerCount() {
            return this.players.length;
        }

        playerUsername(args) {
            const player =
                this.getPlayer(
                    args.NUMBER
                );

            return player
                ? player.username
                : "";
        }

        playerId(args) {
            const player =
                this.getPlayer(
                    args.NUMBER
                );

            return player
                ? player.id
                : "";
        }

        playerJoinedAt(args) {
            const player =
                this.getPlayer(
                    args.NUMBER
                );

            return player
                ? player.joined_at
                : "";
        }

        playerLastSeen(args) {
            const player =
                this.getPlayer(
                    args.NUMBER
                );

            return player
                ? player.last_seen
                : "";
        }

        /* =====================================================
           CHAT
           ===================================================== */

        async sendMessage(args) {
            this.clearError();

            if (!this.requireLogin()) {
                return;
            }

            if (!this.requireRoom()) {
                return;
            }

            const message =
                this.cleanString(
                    args.MESSAGE
                );

            if (!message) {
                this.setError(
                    "Message cannot be empty"
                );

                return;
            }

            if (message.length > 500) {
                this.setError(
                    "Message cannot exceed 500 characters"
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
                                room_id:
                                    this.roomId,
                                message:
                                    message
                            })
                        }
                    );

                const rawMessage =
                    data.message ||
                    (
                        data.data &&
                        data.data.message
                    );

                if (rawMessage) {
                    const msg =
                        this.normalizeMessage(
                            rawMessage
                        );

                    if (
                        !this.messages.some(
                            existing =>
                                existing.id ===
                                msg.id
                        )
                    ) {
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

                this.setStatus(
                    "Message sent"
                );

            } catch (error) {
                if (!this.lastError) {
                    this.setError(
                        error.message ||
                        "Could not send message"
                    );
                }
            }
        }

        async sendMessageAndWait(args) {
            await this.sendMessage(args);
        }

        /* =====================================================
           GET MESSAGES
           ===================================================== */

        async refreshMessages() {
            if (!this.requireLogin()) {
                return;
            }

            if (!this.requireRoom()) {
                return;
            }

            try {
                const path =
                    "/rooms/messages" +
                    "?roomId=" +
                    encodeURIComponent(
                        this.roomId
                    ) +
                    "&room_id=" +
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

                let incoming = [];

                if (
                    Array.isArray(
                        data.messages
                    )
                ) {
                    incoming =
                        data.messages;
                } else if (
                    data.data &&
                    Array.isArray(
                        data.data.messages
                    )
                ) {
                    incoming =
                        data.data.messages;
                }

                for (
                    const raw of incoming
                ) {
                    const msg =
                        this.normalizeMessage(
                            raw
                        );

                    if (
                        !this.messages.some(
                            existing =>
                                existing.id ===
                                msg.id
                        )
                    ) {
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

            } catch (error) {
                if (!this.lastError) {
                    this.setError(
                        error.message ||
                        "Could not get messages"
                    );
                }
            }
        }

        async refreshMessagesAndWait() {
            await this.refreshMessages();
        }

        messageCount() {
            return this.messages.length;
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

            this.setStatus(
                "Local chat messages cleared"
            );
        }

        /* =====================================================
           HEARTBEAT
           ===================================================== */

        async heartbeat() {
            if (!this.token) {
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
                                this.roomId,
                            room_id:
                                this.roomId
                        })
                    }
                );

                this.setStatus(
                    "Room heartbeat sent"
                );

            } catch (error) {
                if (!this.lastError) {
                    this.setError(
                        error.message ||
                        "Heartbeat failed"
                    );
                }
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

            this.heartbeatTimer =
                setInterval(
                    () => {
                        if (
                            this.autoHeartbeat &&
                            this.token &&
                            this.roomId
                        ) {
                            this.heartbeat();
                        }
                    },
                    10000
                );

            this.setStatus(
                "Automatic room heartbeat started"
            );

            this.heartbeat();
        }

        stopAutoHeartbeat() {
            this.autoHeartbeat = false;

            if (this.heartbeatTimer) {
                clearInterval(
                    this.heartbeatTimer
                );

                this.heartbeatTimer = null;
            }

            this.setStatus(
                "Automatic room heartbeat stopped"
            );
        }

        /* =====================================================
           AUTOMATIC MESSAGES
           ===================================================== */

        startAutoMessages() {
            this.stopAutoMessages();

            this.autoMessages = true;

            this.messageTimer =
                setInterval(
                    () => {
                        if (
                            this.autoMessages &&
                            this.token &&
                            this.roomId
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

            if (this.messageTimer) {
                clearInterval(
                    this.messageTimer
                );

                this.messageTimer = null;
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
    }

    Scratch.extensions.register(
        new MultiplayerRooms()
    );

})(Scratch);
