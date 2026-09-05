(function (Scratch) {
    "use strict";

    /*
     * ============================================================
     * MULTIPLAYER EXTENSION
     * ============================================================
     *
     * Designed specifically for the provided Cloudflare Worker:
     *
     * POST /rooms
     * POST /rooms/join
     * POST /rooms/leave
     * GET  /rooms/{roomId}
     * POST /rooms/message
     * GET  /rooms/messages?roomId=...&after=...
     * POST /rooms/heartbeat
     *
     * Authentication:
     * Authorization: Bearer <Sign-In-Up session token>
     *
     * IMPORTANT:
     * The multiplayer token is the session token returned by
     * /login or /signup on the supplied backend.
     * ============================================================
     */

    class MultiplayerExtension {
        constructor() {
            // ====================================================
            // CONFIGURATION
            // ====================================================

            this.apiUrl = "https://example.com/api";

            // Authentication/session token
            this.token = "";

            // Local user information
            this.userId = "";
            this.username = "";

            // Current room
            this.roomId = "";
            this.roomCode = "";
            this.creatorId = "";

            // ====================================================
            // ROOM DATA
            // ====================================================

            this.players = [];

            // ====================================================
            // CHAT DATA
            // ====================================================

            this.messages = [];
            this.lastMessageId = 0;

            // ====================================================
            // STATUS / ERRORS
            // ====================================================

            this.lastError = "";
            this.lastStatus = "";

            // ====================================================
            // TIMERS
            // ====================================================

            this.heartbeatTimer = null;
            this.messageTimer = null;

            this.autoHeartbeatEnabled = false;
            this.autoChatEnabled = false;

            // Prevent overlapping refresh requests
            this.refreshingPlayers = false;
            this.refreshingMessages = false;
        }

        // ========================================================
        // BLOCK DEFINITIONS
        // ========================================================

        getInfo() {
            return {
                id: "multiplayer",
                name: "Multiplayer",
                color1: "#5865F2",
                color2: "#4752C4",
                color3: "#313338",

                blocks: [

                    // ==================================================
                    // API / AUTH
                    // ==================================================

                    {
                        opcode: "setApiUrl",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set multiplayer API URL to [URL]",
                        arguments: {
                            URL: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: "https://example.com"
                            }
                        }
                    },

                    {
                        opcode: "getApiUrl",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "multiplayer API URL"
                    },

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
                        opcode: "getToken",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "multiplayer token"
                    },

                    {
                        opcode: "setUsername",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set my username to [USERNAME]",
                        arguments: {
                            USERNAME: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: ""
                            }
                        }
                    },

                    {
                        opcode: "getUsername",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "my username"
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
                        opcode: "getUserId",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "my user ID"
                    },

                    // ==================================================
                    // ROOM CREATION
                    // ==================================================

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

                    // ==================================================
                    // JOIN / LEAVE
                    // ==================================================

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
                        text: "in multiplayer room?"
                    },

                    // ==================================================
                    // ROOM INFORMATION
                    // ==================================================

                    {
                        opcode: "getRoomId",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "room ID"
                    },

                    {
                        opcode: "getRoomCode",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "room code"
                    },

                    {
                        opcode: "getCreatorId",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "room creator ID"
                    },

                    // ==================================================
                    // PLAYERS
                    // ==================================================

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
                        text: "player [NUMBER] username",
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
                        text: "player [NUMBER] ID",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "playerJoinTime",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "player [NUMBER] join time",
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
                        text: "player [NUMBER] last seen",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    // ==================================================
                    // CHAT
                    // ==================================================

                    {
                        opcode: "sendMessage",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "send multiplayer message [MESSAGE]",
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
                        text: "refresh multiplayer chat"
                    },

                    {
                        opcode: "refreshMessagesAndWait",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "refresh multiplayer chat and wait"
                    },

                    {
                        opcode: "messageCount",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "chat message count"
                    },

                    {
                        opcode: "messageText",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "chat message [NUMBER] text",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageSender",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "chat message [NUMBER] sender",
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
                        text: "chat message [NUMBER] user ID",
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
                        text: "chat message [NUMBER] ID",
                        arguments: {
                            NUMBER: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },

                    {
                        opcode: "messageTime",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "chat message [NUMBER] time",
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
                        opcode: "clearMessages",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "clear multiplayer chat"
                    },

                    // ==================================================
                    // HEARTBEAT
                    // ==================================================

                    {
                        opcode: "heartbeat",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "send multiplayer heartbeat"
                    },

                    {
                        opcode: "setAutoHeartbeat",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set auto multiplayer heartbeat [ENABLED]",
                        arguments: {
                            ENABLED: {
                                type: Scratch.ArgumentType.BOOLEAN,
                                defaultValue: true
                            }
                        }
                    },

                    // ==================================================
                    // AUTO CHAT
                    // ==================================================

                    {
                        opcode: "setAutoChat",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set auto chat updates [ENABLED]",
                        arguments: {
                            ENABLED: {
                                type: Scratch.ArgumentType.BOOLEAN,
                                defaultValue: true
                            }
                        }
                    },

                    // ==================================================
                    // STATUS / ERRORS
                    // ==================================================

                    {
                        opcode: "getError",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "multiplayer error"
                    },

                    {
                        opcode: "getStatus",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "multiplayer status"
                    },

                    {
                        opcode: "clearError",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "clear multiplayer error"
                    }
                ]
            };
        }

        // ========================================================
        // BASIC HELPERS
        // ========================================================

        setStatus(message) {
            this.lastStatus = String(message ?? "");
        }

        setError(message) {
            this.lastError = String(message ?? "");
            this.lastStatus = "Error: " + this.lastError;

            console.error(
                "[Multiplayer]",
                this.lastError
            );
        }

        clearError() {
            this.lastError = "";
            this.setStatus("Ready");
        }

        normalizeApiUrl(url) {
            let value = String(url ?? "").trim();

            if (!value) {
                return "";
            }

            return value.replace(/\/+$/, "");
        }

        // ========================================================
        // HTTP REQUEST
        // ========================================================

        async request(path, options = {}) {
            const baseUrl = this.normalizeApiUrl(
                this.apiUrl
            );

            if (!baseUrl) {
                throw new Error(
                    "Multiplayer API URL is empty."
                );
            }

            if (
                baseUrl === "https://example.com" ||
                baseUrl === "https://example.com/api"
            ) {
                throw new Error(
                    "Set the multiplayer API URL to your deployed Worker first."
                );
            }

            const method =
                String(options.method ?? "GET").toUpperCase();

            const headers = new Headers();

            headers.set(
                "Accept",
                "application/json"
            );

            if (method !== "GET" && method !== "HEAD") {
                headers.set(
                    "Content-Type",
                    "application/json"
                );
            }

            if (this.token) {
                headers.set(
                    "Authorization",
                    "Bearer " + this.token
                );
            }

            const requestUrl =
                baseUrl +
                "/" +
                String(path).replace(/^\/+/, "");

            this.setStatus(
                "Requesting " + method + " " + path
            );

            let response;

            try {
                response = await fetch(
                    requestUrl,
                    {
                        method,
                        headers,
                        body: options.body,
                        cache: "no-store"
                    }
                );
            } catch (error) {
                throw new Error(
                    "Network request failed: " +
                    (
                        error instanceof Error
                            ? error.message
                            : String(error)
                    )
                );
            }

            const text =
                await response.text();

            let data = {};

            if (text.trim()) {
                try {
                    data = JSON.parse(text);
                } catch {
                    throw new Error(
                        "Server returned invalid JSON (HTTP " +
                        response.status +
                        ")."
                    );
                }
            }

            if (!response.ok) {
                const message =
                    data?.error ||
                    data?.message ||
                    (
                        "HTTP " +
                        response.status +
                        " " +
                        response.statusText
                    );

                throw new Error(
                    String(message)
                );
            }

            if (
                data &&
                data.success === false
            ) {
                throw new Error(
                    String(
                        data.error ||
                        "The server reported an error."
                    )
                );
            }

            return data;
        }

        // ========================================================
        // AUTH
        // ========================================================

        requireToken() {
            if (!this.token) {
                throw new Error(
                    "No multiplayer token is set. " +
                    "Use 'set multiplayer token to' with the " +
                    "session token returned by /login or /signup."
                );
            }
        }

        requireRoom() {
            if (!this.roomId) {
                throw new Error(
                    "You are not currently in a multiplayer room."
                );
            }
        }

        // ========================================================
        // CREATE ROOM
        // ========================================================

        async createRoom() {
            this.clearError();

            this.setStatus(
                "Create Room started."
            );

            try {
                this.requireToken();

                this.setStatus(
                    "Creating multiplayer room..."
                );

                /*
                 * The supplied Worker expects:
                 *
                 * POST /rooms
                 *
                 * No JSON body is required.
                 */

                const data =
                    await this.request(
                        "/rooms",
                        {
                            method: "POST"
                        }
                    );

                if (!data || !data.room) {
                    throw new Error(
                        "Server did not return a room object."
                    );
                }

                const room = data.room;

                this.roomId =
                    String(room.id ?? "");

                this.roomCode =
                    String(room.code ?? "");

                this.creatorId =
                    String(room.creatorId ?? "");

                if (!this.roomId) {
                    throw new Error(
                        "Server returned an empty room ID."
                    );
                }

                if (!this.roomCode) {
                    throw new Error(
                        "Server returned an empty room code."
                    );
                }

                this.players = [];
                this.messages = [];
                this.lastMessageId = 0;

                this.setStatus(
                    "Room created: " +
                    this.roomCode
                );

                // The creator is already inserted into
                // room_members by the Worker.
                await this.refreshPlayers();

                await this.refreshMessages();

                this.startAutomaticSystems();

            } catch (error) {
                this.setError(
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            }
        }

        async createRoomAndWait() {
            await this.createRoom();
        }

        // ========================================================
        // JOIN ROOM
        // ========================================================

        async joinRoom(args) {
            this.clearError();

            const code =
                String(args?.CODE ?? "")
                    .trim()
                    .toUpperCase();

            if (!code) {
                this.setError(
                    "Room code cannot be empty."
                );
                return;
            }

            try {
                this.requireToken();

                this.setStatus(
                    "Joining room " +
                    code +
                    "..."
                );

                /*
                 * The supplied Worker expects:
                 *
                 * POST /rooms/join
                 * {"code":"ABC123"}
                 */

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

                if (!data || !data.room) {
                    throw new Error(
                        "Server did not return a room object."
                    );
                }

                const room = data.room;

                this.roomId =
                    String(room.id ?? "");

                this.roomCode =
                    String(room.code ?? "");

                this.creatorId =
                    String(room.creatorId ?? "");

                if (!this.roomId) {
                    throw new Error(
                        "Server returned an empty room ID."
                    );
                }

                this.players = [];
                this.messages = [];
                this.lastMessageId = 0;

                this.setStatus(
                    "Joined room: " +
                    this.roomCode
                );

                await this.refreshPlayers();

                await this.refreshMessages();

                this.startAutomaticSystems();

            } catch (error) {
                this.setError(
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            }
        }

        async joinRoomAndWait(args) {
            await this.joinRoom(args);
        }

        // ========================================================
        // LEAVE ROOM
        // ========================================================

        async leaveRoom() {
            this.clearError();

            if (!this.roomId) {
                this.setStatus(
                    "Not in a room."
                );
                return;
            }

            try {
                this.requireToken();

                const oldRoomId =
                    this.roomId;

                this.setStatus(
                    "Leaving room..."
                );

                await this.request(
                    "/rooms/leave",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            roomId: oldRoomId
                        })
                    }
                );

                this.stopAutomaticSystems();

                this.roomId = "";
                this.roomCode = "";
                this.creatorId = "";

                this.players = [];
                this.messages = [];
                this.lastMessageId = 0;

                this.setStatus(
                    "Left multiplayer room."
                );

            } catch (error) {
                this.setError(
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            }
        }

        // ========================================================
        // ROOM INFORMATION
        // ========================================================

        inRoom() {
            return Boolean(
                this.roomId &&
                this.roomCode
            );
        }

        getRoomId() {
            return this.roomId;
        }

        getRoomCode() {
            return this.roomCode;
        }

        getCreatorId() {
            return this.creatorId;
        }

        // ========================================================
        // REFRESH PLAYERS
        // ========================================================

        async refreshPlayers() {
            if (!this.roomId) {
                this.players = [];
                return;
            }

            if (this.refreshingPlayers) {
                return;
            }

            this.refreshingPlayers = true;

            try {
                this.requireToken();

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

                if (
                    !data ||
                    !Array.isArray(data.players)
                ) {
                    throw new Error(
                        "Server returned an invalid players list."
                    );
                }

                this.players =
                    data.players.map(
                        player => ({
                            id: String(
                                player.id ??
                                player.userId ??
                                ""
                            ),

                            username: String(
                                player.username ??
                                ""
                            ),

                            joinedAt: Number(
                                player.joinedAt ??
                                player.joined_at ??
                                0
                            ),

                            lastSeen: Number(
                                player.lastSeen ??
                                player.last_seen ??
                                0
                            )
                        })
                    );

                // Keep room information synchronized.
                if (data.room) {
                    this.roomId =
                        String(
                            data.room.id ??
                            this.roomId
                        );

                    this.roomCode =
                        String(
                            data.room.code ??
                            this.roomCode
                        );

                    this.creatorId =
                        String(
                            data.room.creatorId ??
                            data.room.creator_id ??
                            this.creatorId
                        );
                }

                this.setStatus(
                    "Players refreshed: " +
                    this.players.length
                );

            } catch (error) {
                this.setError(
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            } finally {
                this.refreshingPlayers = false;
            }
        }

        async refreshPlayersAndWait() {
            await this.refreshPlayers();
        }

        playerCount() {
            return this.players.length;
        }

        getPlayer(args) {
            const number =
                Math.floor(
                    Number(args?.NUMBER ?? 1)
                );

            if (
                !Number.isFinite(number) ||
                number < 1
            ) {
                return null;
            }

            return this.players[number - 1] || null;
        }

        playerUsername(args) {
            const player =
                this.getPlayer(args);

            return player
                ? player.username
                : "";
        }

        playerId(args) {
            const player =
                this.getPlayer(args);

            return player
                ? player.id
                : "";
        }

        playerJoinTime(args) {
            const player =
                this.getPlayer(args);

            return player
                ? player.joinedAt
                : 0;
        }

        playerLastSeen(args) {
            const player =
                this.getPlayer(args);

            return player
                ? player.lastSeen
                : 0;
        }

        // ========================================================
        // SEND CHAT MESSAGE
        // ========================================================

        async sendMessage(args) {
            this.clearError();

            const message =
                String(args?.MESSAGE ?? "").trim();

            if (!message) {
                this.setError(
                    "Message cannot be empty."
                );
                return;
            }

            if (message.length > 500) {
                this.setError(
                    "Message is too long. Maximum is 500 characters."
                );
                return;
            }

            try {
                this.requireToken();
                this.requireRoom();

                this.setStatus(
                    "Sending message..."
                );

                const data =
                    await this.request(
                        "/rooms/message",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                roomId: this.roomId,
                                message
                            })
                        }
                    );

                if (data?.message) {
                    const messageObject =
                        this.normalizeMessage(
                            data.message
                        );

                    this.addMessage(
                        messageObject
                    );
                }

                this.setStatus(
                    "Message sent."
                );

            } catch (error) {
                this.setError(
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            }
        }

        // ========================================================
        // REFRESH CHAT
        // ========================================================

        async refreshMessages() {
            if (!this.roomId) {
                this.messages = [];
                this.lastMessageId = 0;
                return;
            }

            if (this.refreshingMessages) {
                return;
            }

            this.refreshingMessages = true;

            try {
                this.requireToken();

                /*
                 * The Worker expects:
                 *
                 * GET /rooms/messages
                 * ?roomId=...
                 * &after=...
                 */

                const query =
                    "?roomId=" +
                    encodeURIComponent(
                        this.roomId
                    ) +
                    "&after=" +
                    encodeURIComponent(
                        String(
                            Number.isFinite(
                                this.lastMessageId
                            )
                                ? this.lastMessageId
                                : 0
                        )
                    );

                const data =
                    await this.request(
                        "/rooms/messages" +
                        query,
                        {
                            method: "GET"
                        }
                    );

                if (
                    !data ||
                    !Array.isArray(
                        data.messages
                    )
                ) {
                    throw new Error(
                        "Server returned an invalid messages list."
                    );
                }

                for (
                    const message of data.messages
                ) {
                    const normalized =
                        this.normalizeMessage(
                            message
                        );

                    this.addMessage(
                        normalized
                    );
                }

                if (
                    data.messages.length === 0
                ) {
                    this.setStatus(
                        "Chat is up to date."
                    );
                } else {
                    this.setStatus(
                        "Received " +
                        data.messages.length +
                        " new message(s)."
                    );
                }

            } catch (error) {
                this.setError(
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            } finally {
                this.refreshingMessages = false;
            }
        }

        async refreshMessagesAndWait() {
            await this.refreshMessages();
        }

        normalizeMessage(message) {
            return {
                id: Number(
                    message?.id ??
                    0
                ),

                roomId: String(
                    message?.roomId ??
                    message?.room_id ??
                    this.roomId
                ),

                userId: String(
                    message?.userId ??
                    message?.user_id ??
                    ""
                ),

                username: String(
                    message?.username ??
                    ""
                ),

                message: String(
                    message?.message ??
                    ""
                ),

                createdAt: Number(
                    message?.createdAt ??
                    message?.created_at ??
                    0
                )
            };
        }

        addMessage(message) {
            if (!message) {
                return;
            }

            const id =
                Number(message.id);

            /*
             * Ignore invalid IDs.
             */
            if (!Number.isFinite(id)) {
                return;
            }

            /*
             * Prevent duplicate messages.
             */
            if (
                this.messages.some(
                    existing =>
                        Number(existing.id) === id
                )
            ) {
                return;
            }

            this.messages.push(
                message
            );

            /*
             * Keep messages ordered by
             * database AUTO_INCREMENT ID.
             */
            this.messages.sort(
                (a, b) =>
                    Number(a.id) -
                    Number(b.id)
            );

            /*
             * Keep the latest message ID.
             */
            if (
                id > this.lastMessageId
            ) {
                this.lastMessageId = id;
            }

            /*
             * Prevent unlimited local memory growth.
             */
            if (
                this.messages.length > 100
            ) {
                this.messages =
                    this.messages.slice(-100);
            }
        }

        messageCount() {
            return this.messages.length;
        }

        getMessage(args) {
            const number =
                Math.floor(
                    Number(args?.NUMBER ?? 1)
                );

            if (
                !Number.isFinite(number) ||
                number < 1
            ) {
                return null;
            }

            return (
                this.messages[number - 1] ||
                null
            );
        }

        messageText(args) {
            const message =
                this.getMessage(args);

            return message
                ? message.message
                : "";
        }

        messageSender(args) {
            const message =
                this.getMessage(args);

            return message
                ? message.username
                : "";
        }

        messageUserId(args) {
            const message =
                this.getMessage(args);

            return message
                ? message.userId
                : "";
        }

        messageId(args) {
            const message =
                this.getMessage(args);

            return message
                ? message.id
                : 0;
        }

        messageTime(args) {
            const message =
                this.getMessage(args);

            return message
                ? message.createdAt
                : 0;
        }

        latestMessage() {
            if (
                this.messages.length === 0
            ) {
                return "";
            }

            return this.messages[
                this.messages.length - 1
            ].message;
        }

        clearMessages() {
            this.messages = [];
            this.lastMessageId = 0;

            this.setStatus(
                "Local chat history cleared."
            );
        }

        // ========================================================
        // HEARTBEAT
        // ========================================================

        async heartbeat() {
            if (!this.roomId) {
                return;
            }

            try {
                this.requireToken();

                await this.request(
                    "/rooms/heartbeat",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            roomId: this.roomId
                        })
                    }
                );

                this.setStatus(
                    "Heartbeat sent."
                );

            } catch (error) {
                this.setError(
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            }
        }

        // ========================================================
        // AUTOMATIC SYSTEMS
        // ========================================================

        startAutomaticSystems() {
            this.stopAutomaticSystems();

            if (
                this.autoHeartbeatEnabled
            ) {
                this.startHeartbeatTimer();
            }

            if (
                this.autoChatEnabled
            ) {
                this.startChatTimer();
            }
        }

        stopAutomaticSystems() {
            if (
                this.heartbeatTimer !== null
            ) {
                clearInterval(
                    this.heartbeatTimer
                );

                this.heartbeatTimer = null;
            }

            if (
                this.messageTimer !== null
            ) {
                clearInterval(
                    this.messageTimer
                );

                this.messageTimer = null;
            }
        }

        startHeartbeatTimer() {
            if (
                this.heartbeatTimer !== null
            ) {
                clearInterval(
                    this.heartbeatTimer
                );
            }

            /*
             * The Worker considers someone inactive
             * after 30 seconds.
             *
             * Send heartbeat every 10 seconds.
             */

            this.heartbeatTimer =
                setInterval(
                    () => {
                        if (this.roomId) {
                            this.heartbeat();
                        }
                    },
                    10000
                );
        }

        startChatTimer() {
            if (
                this.messageTimer !== null
            ) {
                clearInterval(
                    this.messageTimer
                );
            }

            /*
             * Poll the database every 2 seconds.
             */
            this.messageTimer =
                setInterval(
                    () => {
                        if (this.roomId) {
                            this.refreshMessages();
                        }
                    },
                    2000
                );
        }

        setAutoHeartbeat(args) {
            const enabled =
                this.toBoolean(
                    args?.ENABLED
                );

            this.autoHeartbeatEnabled =
                enabled;

            if (enabled) {
                this.startHeartbeatTimer();
            } else {
                if (
                    this.heartbeatTimer !== null
                ) {
                    clearInterval(
                        this.heartbeatTimer
                    );

                    this.heartbeatTimer =
                        null;
                }
            }

            this.setStatus(
                "Auto heartbeat " +
                (
                    enabled
                        ? "enabled."
                        : "disabled."
                )
            );
        }

        setAutoChat(args) {
            const enabled =
                this.toBoolean(
                    args?.ENABLED
                );

            this.autoChatEnabled =
                enabled;

            if (enabled) {
                this.startChatTimer();
            } else {
                if (
                    this.messageTimer !== null
                ) {
                    clearInterval(
                        this.messageTimer
                    );

                    this.messageTimer =
                        null;
                }
            }

            this.setStatus(
                "Auto chat updates " +
                (
                    enabled
                        ? "enabled."
                        : "disabled."
                )
            );
        }

        toBoolean(value) {
            if (
                typeof value === "boolean"
            ) {
                return value;
            }

            const text =
                String(value)
                    .trim()
                    .toLowerCase();

            return (
                text === "true" ||
                text === "1" ||
                text === "yes"
            );
        }

        // ========================================================
        // API / USER SETTERS
        // ========================================================

        setApiUrl(args) {
            const url =
                this.normalizeApiUrl(
                    args?.URL
                );

            this.apiUrl = url;

            this.clearError();

            if (!url) {
                this.setStatus(
                    "Multiplayer API URL cleared."
                );
            } else {
                this.setStatus(
                    "Multiplayer API URL set to " +
                    url
                );
            }
        }

        getApiUrl() {
            return this.apiUrl;
        }

        setToken(args) {
            this.token =
                String(
                    args?.TOKEN ?? ""
                ).trim();

            this.clearError();

            if (this.token) {
                this.setStatus(
                    "Multiplayer session token set."
                );
            } else {
                this.setStatus(
                    "Multiplayer session token cleared."
                );
            }
        }

        getToken() {
            return this.token;
        }

        setUsername(args) {
            this.username =
                String(
                    args?.USERNAME ?? ""
                );

            this.setStatus(
                "Username set."
            );
        }

        getUsername() {
            return this.username;
        }

        setUserId(args) {
            this.userId =
                String(
                    args?.ID ?? ""
                );

            this.setStatus(
                "User ID set."
            );
        }

        getUserId() {
            return this.userId;
        }

        // ========================================================
        // STATUS / ERROR
        // ========================================================

        getError() {
            return this.lastError;
        }

        getStatus() {
            return this.lastStatus;
        }

        // ========================================================
        // CLEANUP
        // ========================================================

        _shutdown() {
            this.stopAutomaticSystems();
        }
    }

    Scratch.extensions.register(
        new MultiplayerExtension()
    );

})(Scratch);
