import type { Subscription } from "rxjs";
import AnimatedTiles from "phaser-animated-tiles";
import { Queue } from "queue-typescript";
import { get, Unsubscriber } from "svelte/store";

import { userMessageManager } from "../../Administration/UserMessageManager";
import { connectionManager } from "../../Connexion/ConnectionManager";
import { coWebsiteManager } from "../../WebRtc/CoWebsiteManager";
import { urlManager } from "../../Url/UrlManager";
import { mediaManager } from "../../WebRtc/MediaManager";
import { UserInputManager } from "../UserInput/UserInputManager";
import { gameManager } from "./GameManager";
import { touchScreenManager } from "../../Touch/TouchScreenManager";
import { PinchManager } from "../UserInput/PinchManager";
import { waScaleManager } from "../Services/WaScaleManager";
import { EmoteManager } from "./EmoteManager";
import { soundManager } from "./SoundManager";
import { SharedVariablesManager } from "./SharedVariablesManager";
import { EmbeddedWebsiteManager } from "./EmbeddedWebsiteManager";
import { DynamicAreaManager } from "./DynamicAreaManager";

import { lazyLoadPlayerCharacterTextures } from "../Entity/PlayerTexturesLoadingManager";
import { lazyLoadCompanionResource } from "../Companion/CompanionTexturesLoadingManager";
import { iframeListener } from "../../Api/IframeListener";
import { DEBUG_MODE, ENABLE_FEATURE_MAP_EDITOR, MAX_PER_GROUP, POSITION_DELAY } from "../../Enum/EnvironmentVariable";
import { ProtobufClientUtils } from "../../Network/ProtobufClientUtils";
import { Room } from "../../Connexion/Room";
import { jitsiFactory } from "../../WebRtc/JitsiFactory";
import { TextureError } from "../../Exception/TextureError";
import { localUserStore } from "../../Connexion/LocalUserStore";
import { HtmlUtils } from "../../WebRtc/HtmlUtils";
import { SimplePeer } from "../../WebRtc/SimplePeer";
import { Loader } from "../Components/Loader";
import { RemotePlayer, RemotePlayerEvent } from "../Entity/RemotePlayer";
import { SelectCharacterScene, SelectCharacterSceneName } from "../Login/SelectCharacterScene";
import { PlayerAnimationDirections } from "../Player/Animation";
import { hasMovedEventName, Player, requestEmoteEventName } from "../Player/Player";
import { ErrorSceneName } from "../Reconnecting/ErrorScene";
import { ReconnectingSceneName } from "../Reconnecting/ReconnectingScene";
import { AreaType, GameMap } from "./GameMap";
import { PlayerMovement } from "./PlayerMovement";
import { PlayersPositionInterpolator } from "./PlayersPositionInterpolator";
import { DirtyScene } from "./DirtyScene";
import { TextUtils } from "../Components/TextUtils";
import { joystickBaseImg, joystickBaseKey, joystickThumbImg, joystickThumbKey } from "../Components/MobileJoystick";
import { StartPositionCalculator } from "./StartPositionCalculator";
import { PropertyUtils } from "../Map/PropertyUtils";
import { GameMapPropertiesListener } from "./GameMapPropertiesListener";
import { analyticsClient } from "../../Administration/AnalyticsClient";
import { GameMapProperties } from "./GameMapProperties";
import { PathfindingManager } from "../../Utils/PathfindingManager";
import { ActivatablesManager } from "./ActivatablesManager";
import type {
    GroupCreatedUpdatedMessageInterface,
    MessageUserMovedInterface,
    MessageUserPositionInterface,
    OnConnectInterface,
    PointInterface,
    PositionInterface,
    RoomJoinedMessageInterface,
} from "../../Connexion/ConnexionModels";
import type { RoomConnection } from "../../Connexion/RoomConnection";
import type { ActionableItem } from "../Items/ActionableItem";
import type { ItemFactoryInterface } from "../Items/ItemFactoryInterface";
import type { AddPlayerInterface } from "./AddPlayerInterface";
import { CameraManager, CameraManagerEvent, CameraManagerEventCameraUpdateData } from "./CameraManager";
import type { HasPlayerMovedEvent } from "../../Api/Events/HasPlayerMovedEvent";

import { peerStore } from "../../Stores/PeerStore";
import { biggestAvailableAreaStore } from "../../Stores/BiggestAvailableAreaStore";
import { layoutManagerActionStore } from "../../Stores/LayoutManagerStore";
import { playersStore } from "../../Stores/PlayersStore";
import { emoteStore, emoteMenuStore } from "../../Stores/EmoteStore";
import { jitsiParticipantsCountStore, userIsAdminStore, userIsJitsiDominantSpeakerStore } from "../../Stores/GameStore";
import { contactPageStore } from "../../Stores/MenuStore";
import type { WasCameraUpdatedEvent } from "../../Api/Events/WasCameraUpdatedEvent";
import { audioManagerFileStore } from "../../Stores/AudioManagerStore";
import { currentPlayerGroupLockStateStore } from "../../Stores/CurrentPlayerGroupStore";
import { errorScreenStore } from "../../Stores/ErrorScreenStore";

import EVENT_TYPE = Phaser.Scenes.Events;
import Texture = Phaser.Textures.Texture;
import Sprite = Phaser.GameObjects.Sprite;
import CanvasTexture = Phaser.Textures.CanvasTexture;
import GameObject = Phaser.GameObjects.GameObject;
import DOMElement = Phaser.GameObjects.DOMElement;
import Tileset = Phaser.Tilemaps.Tileset;
import SpriteSheetFile = Phaser.Loader.FileTypes.SpriteSheetFile;
import FILE_LOAD_ERROR = Phaser.Loader.Events.FILE_LOAD_ERROR;
import { MapStore } from "../../Stores/Utils/MapStore";
import { followUsersColorStore, followUsersStore } from "../../Stores/FollowStore";
import { GameSceneUserInputHandler } from "../UserInput/GameSceneUserInputHandler";
import LL, { locale } from "../../i18n/i18n-svelte";
import { availabilityStatusStore, denyProximityMeetingStore, localVolumeStore } from "../../Stores/MediaStore";
import { XmppClient } from "../../Xmpp/XmppClient";
import { hideConnectionIssueMessage, showConnectionIssueMessage } from "../../Connexion/AxiosUtils";
import { StringUtils } from "../../Utils/StringUtils";
import { startLayerNamesStore } from "../../Stores/StartLayerNamesStore";
import { JitsiCoWebsite } from "../../WebRtc/CoWebsite/JitsiCoWebsite";
import { SimpleCoWebsite } from "../../WebRtc/CoWebsite/SimpleCoWebsite";
import type { CoWebsite } from "../../WebRtc/CoWebsite/CoWesbite";
import CancelablePromise from "cancelable-promise";
import { Deferred } from "ts-deferred";
import { SuperLoaderPlugin } from "../Services/SuperLoaderPlugin";
import { DEPTH_BUBBLE_CHAT_SPRITE } from "./DepthIndexes";
import {
    AvailabilityStatus,
    ErrorScreenMessage,
    PlayerDetailsUpdatedMessage,
} from "../../Messages/ts-proto-generated/protos/messages";
import { uiWebsiteManager } from "./UI/UIWebsiteManager";
import { embedScreenLayoutStore, highlightedEmbedScreen } from "../../Stores/EmbedScreensStore";
import { MapEditorModeManager } from "./MapEditor/MapEditorModeManager";
import { chatVisibilityStore } from "../../Stores/ChatStore";
import structuredClone from "@ungap/structured-clone";
import {
    ITiledMap,
    ITiledMapLayer,
    ITiledMapObject,
    ITiledMapProperty,
    ITiledMapTileset,
} from "@workadventure/tiled-map-type-guard";
export interface GameSceneInitInterface {
    reconnecting: boolean;
    initPosition?: PointInterface;
}

interface InitUserPositionEventInterface {
    type: "InitUserPositionEvent";
    event: MessageUserPositionInterface[];
}

interface AddPlayerEventInterface {
    type: "AddPlayerEvent";
    event: AddPlayerInterface;
}

interface RemovePlayerEventInterface {
    type: "RemovePlayerEvent";
    userId: number;
}

interface UserMovedEventInterface {
    type: "UserMovedEvent";
    event: MessageUserMovedInterface;
}

interface GroupCreatedUpdatedEventInterface {
    type: "GroupCreatedUpdatedEvent";
    event: GroupCreatedUpdatedMessageInterface;
}

interface DeleteGroupEventInterface {
    type: "DeleteGroupEvent";
    groupId: number;
}

interface PlayerDetailsUpdatedInterface {
    type: "PlayerDetailsUpdated";
    details: PlayerDetailsUpdatedMessage;
}

export class GameScene extends DirtyScene {
    Terrains: Array<Phaser.Tilemaps.Tileset>;
    CurrentPlayer!: Player;
    MapPlayers!: Phaser.Physics.Arcade.Group;
    MapPlayersByKey: MapStore<number, RemotePlayer> = new MapStore<number, RemotePlayer>();
    Map!: Phaser.Tilemaps.Tilemap;
    Objects!: Array<Phaser.Physics.Arcade.Sprite>;
    mapFile!: ITiledMap;
    animatedTiles!: AnimatedTiles;
    groups: Map<number, Sprite>;
    circleTexture!: CanvasTexture;
    circleRedTexture!: CanvasTexture;
    pendingEvents = new Queue<
        | InitUserPositionEventInterface
        | AddPlayerEventInterface
        | RemovePlayerEventInterface
        | UserMovedEventInterface
        | GroupCreatedUpdatedEventInterface
        | DeleteGroupEventInterface
        | PlayerDetailsUpdatedInterface
    >();
    private initPosition?: PositionInterface;
    private playersPositionInterpolator = new PlayersPositionInterpolator();
    public connection: RoomConnection | undefined;
    private simplePeer!: SimplePeer;
    private connectionAnswerPromiseDeferred: Deferred<RoomJoinedMessageInterface>;
    // A promise that will resolve when the "create" method is called (signaling loading is ended)
    private createPromiseDeferred: Deferred<void>;
    private iframeSubscriptionList!: Array<Subscription>;
    private peerStoreUnsubscriber!: Unsubscriber;
    private emoteUnsubscriber!: Unsubscriber;
    private emoteMenuUnsubscriber!: Unsubscriber;

    private localVolumeStoreUnsubscriber: Unsubscriber | undefined;
    private followUsersColorStoreUnsubscriber!: Unsubscriber;
    private userIsJitsiDominantSpeakerStoreUnsubscriber!: Unsubscriber;
    private jitsiParticipantsCountStoreUnsubscriber!: Unsubscriber;
    private highlightedEmbedScreenUnsubscriber!: Unsubscriber;
    private embedScreenLayoutStoreUnsubscriber!: Unsubscriber;
    private availabilityStatusStoreUnsubscriber!: Unsubscriber;

    MapUrlFile: string;
    roomUrl: string;

    currentTick!: number;
    lastSentTick!: number; // The last tick at which a position was sent.
    lastMoveEventSent: HasPlayerMovedEvent = {
        direction: "down",
        moving: false,
        x: -1000,
        y: -1000,
        oldX: -1000,
        oldY: -1000,
    };

    private gameMap!: GameMap;
    private actionableItems: Map<number, ActionableItem> = new Map<number, ActionableItem>();
    public userInputManager!: UserInputManager;
    private isReconnecting: boolean | undefined = undefined;
    private playerName!: string;
    private characterLayers!: string[];
    private companion!: string | null;
    private messageSubscription: Subscription | null = null;
    private popUpElements: Map<number, DOMElement> = new Map<number, Phaser.GameObjects.DOMElement>();
    private originalMapUrl: string | undefined;
    private pinchManager: PinchManager | undefined;
    private mapTransitioning = false; //used to prevent transitions happening at the same time.
    private emoteManager!: EmoteManager;
    private cameraManager!: CameraManager;
    private mapEditorModeManager!: MapEditorModeManager;
    private pathfindingManager!: PathfindingManager;
    private activatablesManager!: ActivatablesManager;
    private preloading = true;
    private startPositionCalculator!: StartPositionCalculator;
    private sharedVariablesManager!: SharedVariablesManager;
    private objectsByType = new Map<string, ITiledMapObject[]>();
    private embeddedWebsiteManager!: EmbeddedWebsiteManager;
    private areaManager!: DynamicAreaManager;
    private loader: Loader;
    private lastCameraEvent: WasCameraUpdatedEvent | undefined;
    private firstCameraUpdateSent = false;
    private currentPlayerGroupId?: number;
    private showVoiceIndicatorChangeMessageSent = false;
    private jitsiDominantSpeaker = false;
    private jitsiParticipantsCount = 0;
    private cleanupDone = false;
    public readonly superLoad: SuperLoaderPlugin;
    private xmppClient!: XmppClient;

    constructor(private room: Room, MapUrlFile: string, customKey?: string | undefined) {
        super({
            key: customKey ?? room.key,
        });
        this.Terrains = [];
        this.groups = new Map<number, Sprite>();

        this.MapUrlFile = MapUrlFile;
        this.roomUrl = room.key;

        this.createPromiseDeferred = new Deferred<void>();
        this.connectionAnswerPromiseDeferred = new Deferred<RoomJoinedMessageInterface>();
        this.loader = new Loader(this);
        this.superLoad = new SuperLoaderPlugin(this);
    }

    //hook preload scene
    preload(): void {
        //initialize frame event of scripting API
        this.listenToIframeEvents();

        this.load.image("iconTalk", "/resources/icons/icon_talking.png");
        this.load.image("iconStatusIndicatorInside", "/resources/icons/icon_status_indicator_inside.png");
        this.load.image("iconStatusIndicatorOutline", "/resources/icons/icon_status_indicator_outline.png");

        if (touchScreenManager.supportTouchScreen) {
            this.load.image(joystickBaseKey, joystickBaseImg);
            this.load.image(joystickThumbKey, joystickThumbImg);
        }
        this.load.audio("audio-webrtc-in", "/resources/objects/webrtc-in.mp3");
        this.load.audio("audio-webrtc-out", "/resources/objects/webrtc-out.mp3");
        this.load.audio("audio-report-message", "/resources/objects/report-message.mp3");
        this.sound.pauseOnBlur = false;

        this.load.on(FILE_LOAD_ERROR, (file: { src: string }) => {
            // If we happen to be in HTTP and we are trying to load a URL in HTTPS only... (this happens only in dev environments)
            if (
                window.location.protocol === "http:" &&
                file.src === this.MapUrlFile &&
                file.src.startsWith("http:") &&
                this.originalMapUrl === undefined
            ) {
                this.originalMapUrl = this.MapUrlFile;
                this.MapUrlFile = this.MapUrlFile.replace("http://", "https://");
                this.load.tilemapTiledJSON(this.MapUrlFile, this.MapUrlFile);
                this.load.on(
                    "filecomplete-tilemapJSON-" + this.MapUrlFile,
                    (key: string, type: string, data: unknown) => {
                        this.onMapLoad(data).catch((e) => console.error(e));
                    }
                );
                return;
            }
            // 127.0.0.1, localhost and *.localhost are considered secure, even on HTTP.
            // So if we are in https, we can still try to load a HTTP local resource (can be useful for testing purposes)
            // See https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts#when_is_a_context_considered_secure
            const base = new URL(window.location.href);
            base.pathname = "";
            const url = new URL(file.src, base.toString());
            const host = url.host.split(":")[0];
            if (
                window.location.protocol === "https:" &&
                file.src === this.MapUrlFile &&
                (host === "127.0.0.1" || host === "localhost" || host.endsWith(".localhost")) &&
                this.originalMapUrl === undefined
            ) {
                this.originalMapUrl = this.MapUrlFile;
                this.MapUrlFile = this.MapUrlFile.replace("https://", "http://");
                this.load.tilemapTiledJSON(this.MapUrlFile, this.MapUrlFile);
                this.load.on(
                    "filecomplete-tilemapJSON-" + this.MapUrlFile,
                    (key: string, type: string, data: unknown) => {
                        this.onMapLoad(data).catch((e) => console.error(e));
                    }
                );
                // If the map has already been loaded as part of another GameScene, the "on load" event will not be triggered.
                // In this case, we check in the cache to see if the map is here and trigger the event manually.
                if (this.cache.tilemap.exists(this.MapUrlFile)) {
                    const data = this.cache.tilemap.get(this.MapUrlFile);
                    this.onMapLoad(data).catch((e) => console.error(e));
                }
                return;
            }

            //once preloading is over, we don't want loading errors to crash the game, so we need to disable this behavior after preloading.
            //if SpriteSheetFile (WOKA file) don't display error and give an access for user
            if (this.preloading && !(file instanceof SpriteSheetFile)) {
                //remove loader in progress
                this.loader.removeLoader();

                //display an error scene
                this.scene.start(ErrorSceneName, {
                    title: "Network error",
                    subTitle: "An error occurred while loading resource:",
                    message: this.originalMapUrl ?? file.src,
                });
            }
        });
        this.load.scenePlugin("AnimatedTiles", AnimatedTiles, "animatedTiles", "animatedTiles");
        this.load.on("filecomplete-tilemapJSON-" + this.MapUrlFile, (key: string, type: string, data: unknown) => {
            this.onMapLoad(data).catch((e) => console.error(e));
        });
        //TODO strategy to add access token
        this.load.tilemapTiledJSON(this.MapUrlFile, this.MapUrlFile);
        // If the map has already been loaded as part of another GameScene, the "on load" event will not be triggered.
        // In this case, we check in the cache to see if the map is here and trigger the event manually.
        if (this.cache.tilemap.exists(this.MapUrlFile)) {
            const data = this.cache.tilemap.get(this.MapUrlFile);
            this.onMapLoad(data).catch((e) => console.error(e));
        }

        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.load as any).rexWebFont({
            custom: {
                families: ["Press Start 2P"],
                testString: "abcdefg",
            },
        });

        //this function must stay at the end of preload function
        this.loader.addLoader();
    }

    // FIXME: we need to put a "unknown" instead of a "any" and validate the structure of the JSON we are receiving.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async onMapLoad(data: any): Promise<void> {
        // Triggered when the map is loaded
        // Load tiles attached to the map recursively

        // The map file can be modified by the scripting API and we don't want to tamper the Phaser cache (in case we come back on the map after visiting other maps)
        // So we are doing a deep copy
        this.mapFile = structuredClone(data.data);

        // Safe parse can take up to 600ms on a 17MB map.
        // TODO: move safeParse to a "map" page and display details of what is going wrong there.
        /*const parseResult = ITiledMap.safeParse(this.mapFile);
        if (!parseResult.success) {
            console.warn("Your map file seems to be invalid. Errors: ", parseResult.error);
        }*/

        const url = this.MapUrlFile.substr(0, this.MapUrlFile.lastIndexOf("/"));
        this.mapFile.tilesets.forEach((tileset) => {
            if (typeof tileset.name === "undefined" || typeof tileset.image === "undefined") {
                console.warn("Don't know how to handle tileset ", tileset);
                return;
            }
            //TODO strategy to add access token
            this.load.image(`${url}/${tileset.image}`, `${url}/${tileset.image}`);
        });

        // Scan the object layers for objects to load and load them.
        this.objectsByType = new Map<string, ITiledMapObject[]>();

        for (const layer of this.mapFile.layers) {
            if (layer.type === "objectgroup") {
                for (const object of layer.objects) {
                    let objectsOfType: ITiledMapObject[] | undefined;
                    if (object.class) {
                        if (!this.objectsByType.has(object.class)) {
                            objectsOfType = new Array<ITiledMapObject>();
                        } else {
                            objectsOfType = this.objectsByType.get(object.class);
                            if (objectsOfType === undefined) {
                                throw new Error("Unexpected object type not found");
                            }
                        }
                        objectsOfType.push(object);
                        this.objectsByType.set(object.class, objectsOfType);
                    }
                }
            }
        }

        for (const [itemType, objectsOfType] of this.objectsByType) {
            // FIXME: we would ideally need for the loader to WAIT for the import to be performed, which means writing our own loader plugin.

            let itemFactory: ItemFactoryInterface;

            switch (itemType) {
                case "computer": {
                    const module = await import("../Items/Computer/computer");
                    itemFactory = module.default;
                    break;
                }
                default:
                    continue;
                //throw new Error('Unsupported object type: "'+ itemType +'"');
            }

            itemFactory.preload(this.load);
            this.load.start(); // Let's manually start the loader because the import might be over AFTER the loading ends.

            this.load.on("complete", () => {
                // FIXME: the factory might fail because the resources might not be loaded yet...
                // We would need to add a loader ended event in addition to the createPromise
                this.createPromiseDeferred.promise
                    .then(async () => {
                        itemFactory.create(this);

                        const roomJoinedAnswer = await this.connectionAnswerPromiseDeferred.promise;

                        for (const object of objectsOfType) {
                            // TODO: we should pass here a factory to create sprites (maybe?)

                            // Do we have a state for this object?
                            const state = roomJoinedAnswer.items[object.id];

                            const actionableItem = itemFactory.factory(this, object, state);
                            this.actionableItems.set(actionableItem.getId(), actionableItem);
                        }
                    })
                    .catch((e) => console.error(e));
            });
        }
    }

    //hook initialisation
    init(initData: GameSceneInitInterface) {
        if (initData.initPosition !== undefined) {
            this.initPosition = initData.initPosition; //todo: still used?
        }
        if (initData.initPosition !== undefined) {
            this.isReconnecting = initData.reconnecting;
        }
    }

    //hook create scene
    create(): void {
        this.preloading = false;
        this.cleanupDone = false;

        this.bindSceneEventHandlers();

        this.trackDirtyAnims();

        gameManager.gameSceneIsCreated(this);
        urlManager.pushRoomIdToUrl(this.room);
        analyticsClient.enteredRoom(this.room.id, this.room.group);
        contactPageStore.set(this.room.contactPage);

        if (touchScreenManager.supportTouchScreen) {
            this.pinchManager = new PinchManager(this);
        }

        const playerName = gameManager.getPlayerName();
        if (!playerName) {
            throw new Error("playerName is not set");
        }
        this.playerName = playerName;
        this.characterLayers = gameManager.getCharacterLayers();
        this.companion = gameManager.getCompanion();

        this.Map = this.add.tilemap(this.MapUrlFile);
        const mapDirUrl = this.MapUrlFile.substr(0, this.MapUrlFile.lastIndexOf("/"));
        this.mapFile.tilesets.forEach((tileset: ITiledMapTileset) => {
            this.Terrains.push(
                this.Map.addTilesetImage(
                    tileset.name,
                    `${mapDirUrl}/${tileset.image}`,
                    tileset.tilewidth,
                    tileset.tileheight,
                    tileset.margin,
                    tileset.spacing /*, tileset.firstgid*/
                )
            );
        });

        //permit to set bound collision
        this.physics.world.setBounds(0, 0, this.Map.widthInPixels, this.Map.heightInPixels);

        this.embeddedWebsiteManager = new EmbeddedWebsiteManager(this);

        //add layer on map
        this.gameMap = new GameMap(this.mapFile, this.Map, this.Terrains);
        for (const layer of this.gameMap.flatLayers) {
            if (layer.type === "tilelayer") {
                const exitSceneUrl = this.getExitSceneUrl(layer);
                if (exitSceneUrl !== undefined) {
                    this.loadNextGame(
                        Room.getRoomPathFromExitSceneUrl(exitSceneUrl, window.location.toString(), this.MapUrlFile)
                    ).catch((e) => console.error(e));
                }
                const exitUrl = this.getExitUrl(layer);
                if (exitUrl !== undefined) {
                    this.loadNextGameFromExitUrl(exitUrl).catch((e) => console.error(e));
                }
            }
            if (layer.type === "objectgroup") {
                for (const object of layer.objects) {
                    if (object.text) {
                        TextUtils.createTextFromITiledMapObject(this, object);
                    }
                    if (object.class === "website") {
                        // Let's load iframes in the map
                        const url = PropertyUtils.mustFindStringProperty(
                            GameMapProperties.URL,
                            object.properties,
                            'in the "' + object.name + '" object of type "website"'
                        );
                        const allowApi = PropertyUtils.findBooleanProperty(
                            GameMapProperties.ALLOW_API,
                            object.properties
                        );
                        const policy = PropertyUtils.findStringProperty(GameMapProperties.POLICY, object.properties);

                        this.embeddedWebsiteManager.createEmbeddedWebsite(
                            object.name,
                            url,
                            object.x,
                            object.y,
                            object.width ?? 0,
                            object.height ?? 0,
                            object.visible,
                            allowApi ?? false,
                            policy ?? "",
                            "map",
                            1
                        );
                    }
                }
            }
        }

        this.gameMap.exitUrls.forEach((exitUrl) => {
            this.loadNextGameFromExitUrl(exitUrl).catch((e) => console.error(e));
        });

        this.areaManager = new DynamicAreaManager(this.gameMap);

        this.startPositionCalculator = new StartPositionCalculator(
            this.gameMap,
            this.mapFile,
            this.initPosition,
            urlManager.getStartPositionNameFromUrl()
        );

        startLayerNamesStore.set(this.startPositionCalculator.getStartPositionNames());

        //add entities
        this.Objects = new Array<Phaser.Physics.Arcade.Sprite>();

        //initialise list of other player
        this.MapPlayers = this.physics.add.group({ immovable: true });

        //create input to move
        this.userInputManager = new UserInputManager(this, new GameSceneUserInputHandler(this));
        mediaManager.setUserInputManager(this.userInputManager);

        if (localUserStore.getFullscreen()) {
            document
                .querySelector("body")
                ?.requestFullscreen()
                .catch((e) => console.error(e));
        }

        this.pathfindingManager = new PathfindingManager(
            this,
            this.gameMap.getCollisionGrid(undefined, false),
            this.gameMap.getTileDimensions()
        );

        //notify game manager can to create currentUser in map
        this.createCurrentPlayer();
        this.removeAllRemotePlayers(); //cleanup the list  of remote players in case the scene was rebooted

        this.tryMovePlayerWithMoveToParameter();

        this.cameraManager = new CameraManager(
            this,
            { x: this.Map.widthInPixels, y: this.Map.heightInPixels },
            waScaleManager
        );

        this.activatablesManager = new ActivatablesManager(this.CurrentPlayer);

        biggestAvailableAreaStore.recompute();
        this.cameraManager.startFollowPlayer(this.CurrentPlayer);
        if (ENABLE_FEATURE_MAP_EDITOR) {
            this.mapEditorModeManager = new MapEditorModeManager(this);
        }

        this.animatedTiles.init(this.Map);
        this.events.on("tileanimationupdate", () => (this.dirty = true));

        this.initCirclesCanvas();

        // Let's pause the scene if the connection is not established yet
        if (!this.room.isDisconnected()) {
            if (this.isReconnecting) {
                setTimeout(() => {
                    if (this.connection === undefined) {
                        this.scene.sleep();
                        if (get(errorScreenStore)) {
                            // If an error message is already displayed, don't display the "connection lost" message.
                            return;
                        }
                        errorScreenStore.setError(
                            ErrorScreenMessage.fromPartial({
                                type: "reconnecting",
                                code: "CONNECTION_LOST",
                                title: get(LL).warning.connectionLostTitle(),
                                details: get(LL).warning.connectionLostSubtitle(),
                            })
                        );
                        //this.scene.launch(ReconnectingSceneName);
                    }
                }, 0);
            } else if (this.connection === undefined) {
                // Let's wait 1 second before printing the "connecting" screen to avoid blinking
                setTimeout(() => {
                    if (this.connection === undefined) {
                        this.scene.sleep();
                        if (get(errorScreenStore)) {
                            // If an error message is already displayed, don't display the "connection lost" message.
                            return;
                        }
                        errorScreenStore.setError(
                            ErrorScreenMessage.fromPartial({
                                type: "reconnecting",
                                code: "CONNECTION_PENDING",
                                title: get(LL).warning.waitingConnectionTitle(),
                                details: get(LL).warning.waitingConnectionSubtitle(),
                            })
                        );
                        //this.scene.launch(ReconnectingSceneName);
                    }
                }, 1000);
            }
        }

        this.createPromiseDeferred.resolve();
        // Now, let's load the script, if any
        const scripts = this.getScriptUrls(this.mapFile);
        const disableModuleMode = this.getProperty(this.mapFile, GameMapProperties.SCRIPT_DISABLE_MODULE_SUPPORT) as
            | boolean
            | undefined;
        const scriptPromises = [];
        for (const script of scripts) {
            scriptPromises.push(iframeListener.registerScript(script, !disableModuleMode));
        }

        this.reposition();

        new GameMapPropertiesListener(this, this.gameMap).register();

        if (!this.room.isDisconnected()) {
            this.scene.sleep();
            this.connect();
        }

        Promise.all([
            this.connectionAnswerPromiseDeferred.promise as Promise<unknown>,
            ...scriptPromises,
            this.CurrentPlayer.getTextureLoadedPromise() as Promise<unknown>,
        ])
            .then(() => {
                this.scene.wake();
            })
            .catch((e) =>
                console.error(
                    "Some scripts failed to load ot the connection failed to establish to WorkAdventure server",
                    e
                )
            );
    }

    /**
     * Initializes the connection to Pusher.
     */
    private connect(): void {
        const camera = this.cameraManager.getCamera();

        connectionManager
            .connectToRoomSocket(
                this.roomUrl,
                this.playerName,
                this.characterLayers,
                {
                    ...this.startPositionCalculator.startPosition,
                },
                {
                    left: camera.scrollX,
                    top: camera.scrollY,
                    right: camera.scrollX + camera.width,
                    bottom: camera.scrollY + camera.height,
                },
                this.companion,
                get(availabilityStatusStore)
            )
            .then((onConnect: OnConnectInterface) => {
                this.connection = onConnect.connection;

                this.subscribeToStores();

                lazyLoadPlayerCharacterTextures(this.superLoad, onConnect.room.characterLayers)
                    .then((layers) => {
                        this.currentPlayerTexturesResolve(layers);
                    })
                    .catch((e) => {
                        this.currentPlayerTexturesReject(e);
                    });

                playersStore.connectToRoomConnection(this.connection);
                userIsAdminStore.set(this.connection.hasTag("admin"));

                this.mapEditorModeManager?.subscribeToStreams(this.connection);

                this.connection.userJoinedMessageStream.subscribe((message) => {
                    const userMessage: AddPlayerInterface = {
                        userId: message.userId,
                        characterLayers: message.characterLayers,
                        name: message.name,
                        position: message.position,
                        availabilityStatus: message.availabilityStatus,
                        visitCardUrl: message.visitCardUrl,
                        companion: message.companion,
                        userUuid: message.userUuid,
                        outlineColor: message.outlineColor,
                    };
                    this.addPlayer(userMessage);
                });

                this.connection.userMovedMessageStream.subscribe((message) => {
                    const position = message.position;
                    if (position === undefined) {
                        throw new Error("Position missing from UserMovedMessage");
                    }

                    const messageUserMoved: MessageUserMovedInterface = {
                        userId: message.userId,
                        position: ProtobufClientUtils.toPointInterface(position),
                    };

                    this.updatePlayerPosition(messageUserMoved);
                });

                this.connection.userLeftMessageStream.subscribe((message) => {
                    this.removePlayer(message.userId);
                });

                this.connection.groupUpdateMessageStream.subscribe(
                    (groupPositionMessage: GroupCreatedUpdatedMessageInterface) => {
                        this.shareGroupPosition(groupPositionMessage);
                    }
                );

                this.connection.groupDeleteMessageStream.subscribe((message) => {
                    try {
                        this.deleteGroup(message.groupId);
                    } catch (e) {
                        console.error(e);
                    }
                });

                this.connection.onServerDisconnected(() => {
                    showConnectionIssueMessage();
                    console.log("Player disconnected from server. Reloading scene.");
                    this.cleanupClosingScene();
                    this.createSuccessorGameScene(true, true);
                });
                hideConnectionIssueMessage();

                this.connection.itemEventMessageStream.subscribe((message) => {
                    const item = this.actionableItems.get(message.itemId);
                    if (item === undefined) {
                        console.warn(
                            'Received an event about object "' +
                                message.itemId +
                                '" but cannot find this item on the map.'
                        );
                        return;
                    }
                    item.fire(message.event, message.state, message.parameters);
                });

                this.connection.playerDetailsUpdatedMessageStream.subscribe((message) => {
                    if (message.details === undefined) {
                        throw new Error("Malformed message. Missing details in PlayerDetailsUpdatedMessage");
                    }
                    this.pendingEvents.enqueue({
                        type: "PlayerDetailsUpdated",
                        details: message,
                    });
                });

                this.connection.groupUsersUpdateMessageStream.subscribe((message) => {
                    this.currentPlayerGroupId = message.groupId;
                });

                this.connection.groupUsersUpdateMessageStream.subscribe((message) => {
                    this.currentPlayerGroupId = message.groupId;
                });

                this.messageSubscription = this.connection.worldFullMessageStream.subscribe((message) => {
                    this.showWorldFullError(message);
                });

                // When connection is performed, let's connect SimplePeer
                //eslint-disable-next-line @typescript-eslint/no-this-alias
                const me = this;
                this.events.once("render", () => {
                    if (me.connection) {
                        this.simplePeer = new SimplePeer(me.connection);
                    } else {
                        console.warn("Connection to peers not started!");
                    }
                });

                userMessageManager.setReceiveBanListener(this.bannedUser.bind(this));

                this.CurrentPlayer.on(hasMovedEventName, (event: HasPlayerMovedEvent) => {
                    this.handleCurrentPlayerHasMovedEvent(event);
                });

                // Set up variables manager
                this.sharedVariablesManager = new SharedVariablesManager(
                    this.connection,
                    this.gameMap,
                    onConnect.room.variables
                );

                //this.initUsersPosition(roomJoinedMessage.users);
                this.connectionAnswerPromiseDeferred.resolve(onConnect.room);
                // Analyze tags to find if we are admin. If yes, show console.

                const error = get(errorScreenStore);
                if (error && error?.type === "reconnecting") errorScreenStore.delete();
                //this.scene.stop(ReconnectingSceneName);

                //init user position and play trigger to check layers properties
                this.gameMap.setPosition(this.CurrentPlayer.x, this.CurrentPlayer.y);

                // Init layer change listener
                this.gameMap.onEnterLayer((layers) => {
                    layers.forEach((layer) => {
                        iframeListener.sendEnterLayerEvent(layer.name);
                    });
                });

                this.gameMap.onLeaveLayer((layers) => {
                    layers.forEach((layer) => {
                        iframeListener.sendLeaveLayerEvent(layer.name);
                    });
                });

                this.gameMap.onEnterArea((areas) => {
                    areas.forEach((area) => {
                        iframeListener.sendEnterAreaEvent(area.name);
                    });
                });

                this.gameMap.onLeaveArea((areas) => {
                    areas.forEach((area) => {
                        iframeListener.sendLeaveAreaEvent(area.name);
                    });
                });

                this.emoteManager = new EmoteManager(this, this.connection);

                // this.gameMap.onLeaveLayer((layers) => {
                //     layers.forEach((layer) => {
                //         iframeListener.sendLeaveLayerEvent(layer.name);
                //     });
                // });

                // Connect to XMPP
                this.xmppClient = new XmppClient(this.connection);

                // Get position from UUID only after the connection to the pusher is established
                this.tryMovePlayerWithMoveToUserParameter();
            })
            .catch((e) => console.error(e));
    }

    private subscribeToStores(): void {
        if (
            this.userIsJitsiDominantSpeakerStoreUnsubscriber != undefined ||
            this.jitsiParticipantsCountStoreUnsubscriber != undefined ||
            this.availabilityStatusStoreUnsubscriber != undefined ||
            this.emoteUnsubscriber != undefined ||
            this.emoteMenuUnsubscriber != undefined ||
            this.followUsersColorStoreUnsubscriber != undefined ||
            this.peerStoreUnsubscriber != undefined
        ) {
            console.error(
                "subscribeToStores => Check all subscriber undefined ",
                this.userIsJitsiDominantSpeakerStoreUnsubscriber,
                this.jitsiParticipantsCountStoreUnsubscriber,
                this.availabilityStatusStoreUnsubscriber,
                this.emoteUnsubscriber,
                this.emoteMenuUnsubscriber,
                this.followUsersColorStoreUnsubscriber,
                this.peerStoreUnsubscriber
            );

            throw new Error("One store is already subscribed.");
        }

        this.userIsJitsiDominantSpeakerStoreUnsubscriber = userIsJitsiDominantSpeakerStore.subscribe(
            (dominantSpeaker) => {
                this.jitsiDominantSpeaker = dominantSpeaker;
                this.tryChangeShowVoiceIndicatorState(this.jitsiDominantSpeaker && this.jitsiParticipantsCount > 1);
            }
        );

        this.jitsiParticipantsCountStoreUnsubscriber = jitsiParticipantsCountStore.subscribe((participantsCount) => {
            this.jitsiParticipantsCount = participantsCount;
            this.tryChangeShowVoiceIndicatorState(this.jitsiDominantSpeaker && this.jitsiParticipantsCount > 1);
        });

        this.availabilityStatusStoreUnsubscriber = availabilityStatusStore.subscribe((availabilityStatus) => {
            this.connection?.emitPlayerStatusChange(availabilityStatus);
            this.CurrentPlayer.setAvailabilityStatus(availabilityStatus);
            if (availabilityStatus === AvailabilityStatus.SILENT) {
                this.CurrentPlayer.showTalkIcon(false, true);
            }
        });

        this.emoteUnsubscriber = emoteStore.subscribe((emote) => {
            if (emote) {
                this.CurrentPlayer?.playEmote(emote.url);
                this.connection?.emitEmoteEvent(emote.url);
                emoteStore.set(null);
            }
        });

        this.emoteMenuUnsubscriber = emoteMenuStore.subscribe((emoteMenu) => {
            if (emoteMenu) {
                this.userInputManager.disableControls();
            } else {
                this.userInputManager.restoreControls();
            }
        });

        this.followUsersColorStoreUnsubscriber = followUsersColorStore.subscribe((color) => {
            if (color !== undefined) {
                this.CurrentPlayer.setFollowOutlineColor(color);
                this.connection?.emitPlayerOutlineColor(color);
            } else {
                this.CurrentPlayer.removeFollowOutlineColor();
                this.connection?.emitPlayerOutlineColor(null);
            }
        });

        this.highlightedEmbedScreenUnsubscriber = highlightedEmbedScreen.subscribe((value) => {
            this.reposition();
        });

        this.embedScreenLayoutStoreUnsubscriber = embedScreenLayoutStore.subscribe((layout) => {
            this.reposition();
        });

        const talkIconVolumeTreshold = 10;
        let oldPeersNumber = 0;
        this.peerStoreUnsubscriber = peerStore.subscribe((peers) => {
            const newPeerNumber = peers.size;
            if (newPeerNumber > oldPeersNumber) {
                this.playSound("audio-webrtc-in");
            } else if (newPeerNumber < oldPeersNumber) {
                this.playSound("audio-webrtc-out");
            }
            if (newPeerNumber > 0) {
                if (!this.localVolumeStoreUnsubscriber) {
                    this.localVolumeStoreUnsubscriber = localVolumeStore.subscribe((volume) => {
                        if (volume === undefined) {
                            this.CurrentPlayer.showTalkIcon(false, true);
                            return;
                        }
                        this.tryChangeShowVoiceIndicatorState(volume > talkIconVolumeTreshold);
                    });
                }
                this.reposition();
            } else {
                this.CurrentPlayer.showTalkIcon(false, true);
                this.connection?.emitPlayerShowVoiceIndicator(false);
                this.showVoiceIndicatorChangeMessageSent = false;
                this.MapPlayersByKey.forEach((remotePlayer) => remotePlayer.showTalkIcon(false, true));
                if (this.localVolumeStoreUnsubscriber) {
                    this.localVolumeStoreUnsubscriber();
                    this.localVolumeStoreUnsubscriber = undefined;
                }
                this.reposition();
            }
            oldPeersNumber = peers.size;
        });
    }

    //todo: into dedicated classes
    private initCirclesCanvas(): void {
        // Let's generate the circle for the group delimiter
        let circleElement = Object.values(this.textures.list).find(
            (object: Texture) => object.key === "circleSprite-white"
        );
        if (circleElement) {
            this.textures.remove("circleSprite-white");
        }

        circleElement = Object.values(this.textures.list).find((object: Texture) => object.key === "circleSprite-red");
        if (circleElement) {
            this.textures.remove("circleSprite-red");
        }

        //create white circle canvas use to create sprite
        this.circleTexture = this.textures.createCanvas("circleSprite-white", 96, 96);
        const context = this.circleTexture.context;
        context.beginPath();
        context.arc(48, 48, 48, 0, 2 * Math.PI, false);
        // context.lineWidth = 5;
        context.strokeStyle = "#ffffff";
        context.fillStyle = "#ffffff44";
        context.stroke();
        context.fill();
        this.circleTexture.refresh();

        //create red circle canvas use to create sprite
        this.circleRedTexture = this.textures.createCanvas("circleSprite-red", 96, 96);
        const contextRed = this.circleRedTexture.context;
        contextRed.beginPath();
        contextRed.arc(48, 48, 48, 0, 2 * Math.PI, false);
        //context.lineWidth = 5;
        contextRed.strokeStyle = "#ff0000";
        contextRed.fillStyle = "#ff000044";
        contextRed.stroke();
        contextRed.fill();
        this.circleRedTexture.refresh();
    }

    private safeParseJSONstring(jsonString: string | undefined, propertyName: string) {
        try {
            return jsonString ? JSON.parse(jsonString) : {};
        } catch (e) {
            console.warn('Invalid JSON found in property "' + propertyName + '" of the map:' + jsonString, e);
            return {};
        }
    }

    private listenToIframeEvents(): void {
        this.iframeSubscriptionList = [];
        this.iframeSubscriptionList.push(
            iframeListener.openPopupStream.subscribe((openPopupEvent) => {
                let objectLayerSquare: ITiledMapObject;
                const targetObjectData = this.getObjectLayerData(openPopupEvent.targetObject);
                if (targetObjectData !== undefined) {
                    objectLayerSquare = targetObjectData;
                } else {
                    console.error(
                        "Error while opening a popup. Cannot find an object on the map with name '" +
                            openPopupEvent.targetObject +
                            "'. The first parameter of WA.openPopup() must be the name of a rectangle object in your map."
                    );
                    return;
                }
                const escapedMessage = HtmlUtils.escapeHtml(openPopupEvent.message);
                let html = '<div id="container" hidden>';
                if (escapedMessage) {
                    html += `<div class="nes-container with-title is-centered">
${escapedMessage}
 </div> `;
                }

                const buttonContainer = '<div class="buttonContainer"</div>';
                html += buttonContainer;
                let id = 0;
                for (const button of openPopupEvent.buttons) {
                    html += `<button type="button" class="nes-btn is-${HtmlUtils.escapeHtml(
                        button.className ?? ""
                    )}" id="popup-${openPopupEvent.popupId}-${id}">${HtmlUtils.escapeHtml(button.label)}</button>`;
                    id++;
                }
                html += "</div>";
                const domElement = this.add.dom(objectLayerSquare.x, objectLayerSquare.y).createFromHTML(html);

                const container: HTMLDivElement = domElement.getChildByID("container") as HTMLDivElement;
                container.style.width = objectLayerSquare.width + "px";
                domElement.scale = 0;
                domElement.setClassName("popUpElement");

                setTimeout(() => {
                    container.hidden = false;
                }, 100);

                id = 0;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for (const button of openPopupEvent.buttons) {
                    const button = HtmlUtils.getElementByIdOrFail<HTMLButtonElement>(
                        `popup-${openPopupEvent.popupId}-${id}`
                    );
                    const btnId = id;
                    button.onclick = () => {
                        iframeListener.sendButtonClickedEvent(openPopupEvent.popupId, btnId);
                        // Disable for a short amount of time to let time to the script to remove the popup
                        button.disabled = true;
                        setTimeout(() => {
                            button.disabled = false;
                        }, 100);
                    };
                    id++;
                }
                this.tweens.add({
                    targets: domElement,
                    scale: 1,
                    ease: "EaseOut",
                    duration: 400,
                });

                this.popUpElements.set(openPopupEvent.popupId, domElement);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.closePopupStream.subscribe((closePopupEvent) => {
                const popUpElement = this.popUpElements.get(closePopupEvent.popupId);
                if (popUpElement === undefined) {
                    console.error(
                        "Could not close popup with ID ",
                        closePopupEvent.popupId,
                        ". Maybe it has already been closed?"
                    );
                }

                this.tweens.add({
                    targets: popUpElement,
                    scale: 0,
                    ease: "EaseOut",
                    duration: 400,
                    onComplete: () => {
                        popUpElement?.destroy();
                        this.popUpElements.delete(closePopupEvent.popupId);
                    },
                });
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.openChatStream.subscribe(() => {
                chatVisibilityStore.set(true);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.closeChatStream.subscribe(() => {
                chatVisibilityStore.set(false);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.disablePlayerControlStream.subscribe(() => {
                this.userInputManager.disableControls();
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.enablePlayerControlStream.subscribe(() => {
                this.userInputManager.restoreControls();
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.disablePlayerProximityMeetingStream.subscribe(() => {
                denyProximityMeetingStore.set(true);
                this.disableMediaBehaviors();
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.enablePlayerProximityMeetingStream.subscribe(() => {
                denyProximityMeetingStore.set(false);
                this.enableMediaBehaviors();
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.cameraSetStream.subscribe((cameraSetEvent) => {
                const duration = cameraSetEvent.smooth ? 1000 : 0;
                cameraSetEvent.lock
                    ? this.cameraManager.enterFocusMode({ ...cameraSetEvent }, undefined, duration)
                    : this.cameraManager.setPosition({ ...cameraSetEvent }, duration);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.cameraFollowPlayerStream.subscribe((cameraFollowPlayerEvent) => {
                this.cameraManager.leaveFocusMode(this.CurrentPlayer, cameraFollowPlayerEvent.smooth ? 1000 : 0);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.playSoundStream.subscribe((playSoundEvent) => {
                const url = new URL(playSoundEvent.url, this.MapUrlFile);
                soundManager
                    .playSound(this.load, this.sound, url.toString(), playSoundEvent.config)
                    .catch((e) => console.error(e));
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.stopSoundStream.subscribe((stopSoundEvent) => {
                const url = new URL(stopSoundEvent.url, this.MapUrlFile);
                soundManager.stopSound(this.sound, url.toString());
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.addActionsMenuKeyToRemotePlayerStream.subscribe((data) => {
                this.MapPlayersByKey.get(data.id)?.registerActionsMenuAction({
                    actionName: data.actionKey,
                    callback: () => {
                        iframeListener.sendActionsMenuActionClickedEvent({ actionName: data.actionKey, id: data.id });
                    },
                });
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.removeActionsMenuKeyFromRemotePlayerEvent.subscribe((data) => {
                this.MapPlayersByKey.get(data.id)?.unregisterActionsMenuAction(data.actionKey);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.trackCameraUpdateStream.subscribe(() => {
                if (!this.firstCameraUpdateSent) {
                    this.cameraManager.on(
                        CameraManagerEvent.CameraUpdate,
                        (data: CameraManagerEventCameraUpdateData) => {
                            const cameraEvent: WasCameraUpdatedEvent = {
                                x: data.x,
                                y: data.y,
                                width: data.width,
                                height: data.height,
                                zoom: data.zoom,
                            };
                            if (
                                this.lastCameraEvent?.x == cameraEvent.x &&
                                this.lastCameraEvent?.y == cameraEvent.y &&
                                this.lastCameraEvent?.width == cameraEvent.width &&
                                this.lastCameraEvent?.height == cameraEvent.height &&
                                this.lastCameraEvent?.zoom == cameraEvent.zoom
                            ) {
                                return;
                            }

                            this.lastCameraEvent = cameraEvent;
                            iframeListener.sendCameraUpdated(cameraEvent);
                            this.firstCameraUpdateSent = true;
                        }
                    );
                }
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.loadSoundStream.subscribe((loadSoundEvent) => {
                const url = new URL(loadSoundEvent.url, this.MapUrlFile);
                soundManager.loadSound(this.load, this.sound, url.toString()).catch((e) => console.error(e));
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.loadPageStream.subscribe((url: string) => {
                this.loadNextGameFromExitUrl(url)
                    .then(() => {
                        this.events.once(EVENT_TYPE.POST_UPDATE, () => {
                            this.onMapExit(Room.getRoomPathFromExitUrl(url, window.location.toString())).catch((e) =>
                                console.error(e)
                            );
                        });
                    })
                    .catch((e) => console.error(e));
            })
        );
        let scriptedBubbleSprite: Sprite;
        this.iframeSubscriptionList.push(
            iframeListener.displayBubbleStream.subscribe(() => {
                scriptedBubbleSprite = new Sprite(
                    this,
                    this.CurrentPlayer.x + 25,
                    this.CurrentPlayer.y,
                    "circleSprite-white"
                );
                scriptedBubbleSprite.setDisplayOrigin(48, 48).setDepth(DEPTH_BUBBLE_CHAT_SPRITE);
                this.add.existing(scriptedBubbleSprite);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.removeBubbleStream.subscribe(() => {
                scriptedBubbleSprite.destroy();
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.showLayerStream.subscribe((layerEvent) => {
                this.setLayerVisibility(layerEvent.name, true);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.hideLayerStream.subscribe((layerEvent) => {
                this.setLayerVisibility(layerEvent.name, false);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.setPropertyStream.subscribe((setProperty) => {
                this.setPropertyLayer(setProperty.layerName, setProperty.propertyName, setProperty.propertyValue);
            })
        );

        this.iframeSubscriptionList.push(
            iframeListener.setAreaPropertyStream.subscribe((setProperty) => {
                this.setAreaProperty(
                    setProperty.areaName,
                    AreaType.Dynamic,
                    setProperty.propertyName,
                    setProperty.propertyValue
                );
            })
        );

        iframeListener.registerAnswerer("openCoWebsite", async (openCoWebsite, source) => {
            if (!source) {
                throw new Error("Unknown query source");
            }

            const coWebsite: SimpleCoWebsite = new SimpleCoWebsite(
                new URL(openCoWebsite.url, iframeListener.getBaseUrlFromSource(source)),
                openCoWebsite.allowApi,
                openCoWebsite.allowPolicy,
                openCoWebsite.widthPercent,
                openCoWebsite.closable ?? true
            );

            coWebsiteManager.addCoWebsiteToStore(coWebsite, openCoWebsite.position);

            if (openCoWebsite.lazy === undefined || !openCoWebsite.lazy) {
                await coWebsiteManager.loadCoWebsite(coWebsite);
            }

            return {
                id: coWebsite.getId(),
            };
        });

        iframeListener.registerAnswerer("getCoWebsites", () => {
            const coWebsites = coWebsiteManager.getCoWebsites();

            return coWebsites.map((coWebsite: CoWebsite) => {
                return {
                    id: coWebsite.getId(),
                };
            });
        });

        iframeListener.registerAnswerer("closeCoWebsite", (coWebsiteId) => {
            const coWebsite = coWebsiteManager.getCoWebsiteById(coWebsiteId);

            if (!coWebsite) {
                throw new Error("Unknown co-website");
            }

            return coWebsiteManager.closeCoWebsite(coWebsite);
        });

        iframeListener.registerAnswerer("closeCoWebsites", () => {
            return coWebsiteManager.closeCoWebsites();
        });

        iframeListener.registerAnswerer("openUIWebsite", (websiteConfig) => {
            return uiWebsiteManager.open(websiteConfig);
        });

        iframeListener.registerAnswerer("getUIWebsites", () => {
            return uiWebsiteManager.getAll();
        });

        iframeListener.registerAnswerer("closeUIWebsite", (websiteId) => {
            return uiWebsiteManager.close(websiteId);
        });

        iframeListener.registerAnswerer("getMapData", () => {
            return {
                data: this.gameMap.getMap(),
            };
        });

        iframeListener.registerAnswerer("getState", async () => {
            // The sharedVariablesManager is not instantiated before the connection is established. So we need to wait
            // for the connection to send back the answer.
            await this.connectionAnswerPromiseDeferred.promise;
            return {
                mapUrl: this.MapUrlFile,
                startLayerName: this.startPositionCalculator.getStartPositionName() ?? undefined,
                uuid: localUserStore.getLocalUser()?.uuid,
                nickname: this.playerName,
                language: get(locale),
                roomId: this.roomUrl,
                tags: this.connection ? this.connection.getAllTags() : [],
                variables: this.sharedVariablesManager.variables,
                playerVariables: localUserStore.getAllUserProperties(),
                userRoomToken: this.connection ? this.connection.userRoomToken : "",
            };
        });
        this.iframeSubscriptionList.push(
            iframeListener.setTilesStream.subscribe((eventTiles) => {
                for (const eventTile of eventTiles) {
                    this.gameMap.putTile(eventTile.tile, eventTile.x, eventTile.y, eventTile.layer);
                }
                this.markDirty();
            })
        );
        iframeListener.registerAnswerer("loadTileset", (eventTileset) => {
            return this.connectionAnswerPromiseDeferred.promise.then(() => {
                const jsonTilesetDir = eventTileset.url.substr(0, eventTileset.url.lastIndexOf("/"));
                //Initialise the firstgid to 1 because if there is no tileset in the tilemap, the firstgid will be 1
                let newFirstgid = 1;
                const lastTileset = this.mapFile.tilesets[this.mapFile.tilesets.length - 1];
                if (lastTileset && lastTileset.firstgid !== undefined && lastTileset.tilecount !== undefined) {
                    //If there is at least one tileset in the tilemap then calculate the firstgid of the new tileset
                    newFirstgid = lastTileset.firstgid + lastTileset.tilecount;
                }
                return new Promise((resolve, reject) => {
                    this.load.on("filecomplete-json-" + eventTileset.url, () => {
                        let jsonTileset = this.cache.json.get(eventTileset.url);
                        const imageUrl = jsonTilesetDir + "/" + jsonTileset.image;
                        this.load.image(imageUrl, imageUrl);
                        this.load.on("filecomplete-image-" + imageUrl, () => {
                            //Add the firstgid of the tileset to the json file
                            jsonTileset = { ...jsonTileset, firstgid: newFirstgid };
                            this.mapFile.tilesets.push(jsonTileset);
                            this.Map.tilesets.push(
                                new Tileset(
                                    jsonTileset.name,
                                    jsonTileset.firstgid,
                                    jsonTileset.tileWidth,
                                    jsonTileset.tileHeight,
                                    jsonTileset.margin,
                                    jsonTileset.spacing,
                                    jsonTileset.tiles
                                )
                            );
                            this.Terrains.push(
                                this.Map.addTilesetImage(
                                    jsonTileset.name,
                                    imageUrl,
                                    jsonTileset.tilewidth,
                                    jsonTileset.tileheight,
                                    jsonTileset.margin,
                                    jsonTileset.spacing
                                )
                            );
                            //destroy the tilemapayer because they are unique and we need to reuse their key and layerdData
                            for (const layer of this.Map.layers) {
                                layer.tilemapLayer.destroy(false);
                            }
                            //Create a new GameMap with the changed file
                            this.gameMap = new GameMap(this.mapFile, this.Map, this.Terrains);
                            //Destroy the colliders of the old tilemapLayer
                            this.physics.add.world.colliders.destroy();
                            //Create new colliders with the new GameMap
                            this.createCollisionWithPlayer();
                            //Create new trigger with the new GameMap
                            new GameMapPropertiesListener(this, this.gameMap).register();
                            resolve(newFirstgid);
                        });
                    });
                    this.load.on("loaderror", () => {
                        console.error("Error while loading " + eventTileset.url + ".");
                        reject(-1);
                    });

                    this.load.json(eventTileset.url, eventTileset.url);
                    this.load.start();
                });
            });
        });

        iframeListener.registerAnswerer("triggerActionMessage", (message) =>
            layoutManagerActionStore.addAction({
                uuid: message.uuid,
                type: "message",
                message: message.message,
                callback: () => {
                    layoutManagerActionStore.removeAction(message.uuid);
                    iframeListener.sendActionMessageTriggered(message.uuid);
                },
                userInputManager: this.userInputManager,
            })
        );

        iframeListener.registerAnswerer("setVariable", (event, source) => {
            switch (event.target) {
                case "global": {
                    this.sharedVariablesManager.setVariable(event, source);
                    break;
                }
                case "player": {
                    localUserStore.setUserProperty(event.key, event.value);
                    break;
                }
                default: {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const _exhaustiveCheck: never = event.target;
                }
            }
        });

        iframeListener.registerAnswerer("removeActionMessage", (message) => {
            layoutManagerActionStore.removeAction(message.uuid);
        });

        iframeListener.registerAnswerer("setPlayerOutline", (message) => {
            const normalizeColor = (color: number) => Math.min(Math.max(0, Math.round(color)), 255);
            const red = normalizeColor(message.red);
            const green = normalizeColor(message.green);
            const blue = normalizeColor(message.blue);
            const color = (red << 16) | (green << 8) | blue;
            this.CurrentPlayer.setApiOutlineColor(color);
            this.connection?.emitPlayerOutlineColor(color);
        });

        iframeListener.registerAnswerer("removePlayerOutline", () => {
            this.CurrentPlayer.removeApiOutlineColor();
            this.connection?.emitPlayerOutlineColor(null);
        });

        iframeListener.registerAnswerer("getPlayerPosition", () => {
            return {
                x: this.CurrentPlayer.x,
                y: this.CurrentPlayer.y,
            };
        });

        iframeListener.registerAnswerer("movePlayerTo", async (message) => {
            const startTileIndex = this.getGameMap().getTileIndexAt(this.CurrentPlayer.x, this.CurrentPlayer.y);
            const destinationTileIndex = this.getGameMap().getTileIndexAt(message.x, message.y);
            const path = await this.getPathfindingManager().findPath(startTileIndex, destinationTileIndex, true, true);
            path.shift();
            if (path.length === 0) {
                throw new Error("no path available");
            }
            return this.CurrentPlayer.setPathToFollow(path, message.speed);
        });
    }

    private setPropertyLayer(
        layerName: string,
        propertyName: string,
        propertyValue: string | number | boolean | undefined
    ): void {
        if (propertyName === GameMapProperties.EXIT_URL && typeof propertyValue === "string") {
            this.loadNextGameFromExitUrl(propertyValue).catch((e) => console.error(e));
        }
        this.gameMap.setLayerProperty(layerName, propertyName, propertyValue);
    }

    private setAreaProperty(
        areaName: string,
        areaType: AreaType,
        propertyName: string,
        propertyValue: string | number | boolean | undefined
    ): void {
        this.gameMap.setAreaProperty(areaName, areaType, propertyName, propertyValue);
    }

    private setLayerVisibility(layerName: string, visible: boolean): void {
        const phaserLayer = this.gameMap.findPhaserLayer(layerName);
        let collisionGrid: number[][] = [];
        if (phaserLayer != undefined) {
            phaserLayer.setVisible(visible);
            phaserLayer.setCollisionByProperty({ collides: true }, visible);
            collisionGrid = this.gameMap.getCollisionGrid(phaserLayer);
        } else {
            const phaserLayers = this.gameMap.findPhaserLayers(layerName + "/");
            if (phaserLayers.length === 0) {
                console.warn(
                    'Could not find layer with name that contains "' +
                        layerName +
                        '" when calling WA.hideLayer / WA.showLayer'
                );
                return;
            }
            for (let i = 0; i < phaserLayers.length; i++) {
                phaserLayers[i].setVisible(visible);
                phaserLayers[i].setCollisionByProperty({ collides: true }, visible);
            }
            collisionGrid = this.gameMap.getCollisionGrid(undefined, false);
        }
        this.pathfindingManager.setCollisionGrid(collisionGrid);
        this.markDirty();
    }

    public getMapDirUrl(): string {
        return this.MapUrlFile.substring(0, this.MapUrlFile.lastIndexOf("/"));
    }

    public async onMapExit(roomUrl: URL) {
        if (this.mapTransitioning) return;
        this.mapTransitioning = true;

        this.gameMap.triggerExitCallbacks();

        let targetRoom: Room;
        try {
            targetRoom = await Room.createRoom(roomUrl);
        } catch (e /*: unknown*/) {
            console.error('Error while fetching new room "' + roomUrl.toString() + '"', e);

            //show information room access denied
            layoutManagerActionStore.addAction({
                uuid: "roomAccessDenied",
                type: "warning",
                message: get(LL).warning.accessDenied.room(),
                callback: () => {
                    layoutManagerActionStore.removeAction("roomAccessDenied");
                },
                userInputManager: this.userInputManager,
            });

            this.mapTransitioning = false;
            return;
        }

        if (roomUrl.hash) {
            urlManager.pushStartLayerNameToUrl(roomUrl.hash);
        }

        if (!targetRoom.isEqual(this.room)) {
            if (this.scene.get(targetRoom.key) === null) {
                console.error("next room not loaded", targetRoom.key);
                // Try to load next dame room from exit URL
                // The policy of room can to be updated during a session and not load before
                await this.loadNextGameFromExitUrl(targetRoom.key);
            }
            this.cleanupClosingScene();
            this.scene.stop();
            this.scene.start(targetRoom.key);
            this.scene.remove(this.scene.key);
        } else {
            //if the exit points to the current map, we simply teleport the user back to the startLayer
            this.startPositionCalculator.initStartXAndStartY(roomUrl.hash);
            this.CurrentPlayer.x = this.startPositionCalculator.startPosition.x;
            this.CurrentPlayer.y = this.startPositionCalculator.startPosition.y;
            this.CurrentPlayer.finishFollowingPath(true);
            // clear properties in case we are moved on the same layer / area in order to trigger them
            this.gameMap.clearCurrentProperties();
            this.gameMap.setPosition(this.CurrentPlayer.x, this.CurrentPlayer.y);
            setTimeout(() => (this.mapTransitioning = false), 500);
        }
    }

    public playSound(sound: string) {
        this.sound.play(sound, {
            volume: 0.2,
        });
    }

    public getSimplePeer() {
        return this.simplePeer;
    }

    public cleanupClosingScene(): void {
        // make sure we restart CameraControls
        this.disableMediaBehaviors();
        // stop playing audio, close any open website, stop any open Jitsi, unsubscribe
        coWebsiteManager.cleanup();
        // Stop the script, if any
        const scripts = this.getScriptUrls(this.mapFile);
        for (const script of scripts) {
            iframeListener.unregisterScript(script);
        }

        followUsersStore.stopFollowing();

        audioManagerFileStore.unloadAudio();
        // We are completely destroying the current scene to avoid using a half-backed instance when coming back to the same map.
        this.xmppClient?.close();
        this.connection?.closeConnection();
        this.simplePeer?.closeAllConnections();
        this.simplePeer?.unregister();
        this.messageSubscription?.unsubscribe();
        this.userInputManager?.destroy();
        this.pinchManager?.destroy();
        this.emoteManager?.destroy();
        this.cameraManager?.destroy();
        this.mapEditorModeManager?.destroy();
        this.peerStoreUnsubscriber?.();
        this.emoteUnsubscriber?.();
        this.emoteMenuUnsubscriber?.();
        this.followUsersColorStoreUnsubscriber?.();
        this.highlightedEmbedScreenUnsubscriber?.();
        this.embedScreenLayoutStoreUnsubscriber?.();
        this.userIsJitsiDominantSpeakerStoreUnsubscriber?.();
        this.jitsiParticipantsCountStoreUnsubscriber?.();
        this.availabilityStatusStoreUnsubscriber?.();
        iframeListener.unregisterAnswerer("getState");
        iframeListener.unregisterAnswerer("loadTileset");
        iframeListener.unregisterAnswerer("getMapData");
        iframeListener.unregisterAnswerer("triggerActionMessage");
        iframeListener.unregisterAnswerer("removeActionMessage");
        iframeListener.unregisterAnswerer("openCoWebsite");
        iframeListener.unregisterAnswerer("getCoWebsites");
        iframeListener.unregisterAnswerer("setPlayerOutline");
        iframeListener.unregisterAnswerer("setVariable");
        iframeListener.unregisterAnswerer("openUIWebsite");
        iframeListener.unregisterAnswerer("getUIWebsites");
        iframeListener.unregisterAnswerer("closeUIWebsite");
        this.sharedVariablesManager?.close();
        this.embeddedWebsiteManager?.close();
        this.areaManager?.close();

        //When we leave game, the camera is stop to be reopen after.
        // I think that we could keep camera status and the scene can manage camera setup
        //TODO find wy chrome don't manage correctly a multiple ask mediaDevices
        //mediaManager.hideMyCamera();

        for (const iframeEvents of this.iframeSubscriptionList) {
            iframeEvents.unsubscribe();
        }
        this.cleanupDone = true;
    }

    private removeAllRemotePlayers(): void {
        this.MapPlayersByKey.forEach((player: RemotePlayer) => {
            player.destroy();

            if (player.companion) {
                player.companion.destroy();
            }

            this.MapPlayers.remove(player);
        });
        this.MapPlayersByKey.clear();
    }

    private tryMovePlayerWithMoveToParameter(): void {
        const moveToParam = urlManager.getHashParameter("moveTo");
        if (moveToParam) {
            try {
                let endPos;
                const posFromParam = StringUtils.parsePointFromParam(moveToParam);
                if (posFromParam) {
                    endPos = this.gameMap.getTileIndexAt(posFromParam.x, posFromParam.y);
                } else {
                    const destinationObject = this.gameMap.getObjectWithName(moveToParam);
                    if (destinationObject) {
                        endPos = this.gameMap.getTileIndexAt(destinationObject.x, destinationObject.y);
                    } else {
                        endPos = this.gameMap.getRandomPositionFromLayer(moveToParam);
                    }
                }

                this.moveTo(endPos);

                urlManager.clearHashParameter();
            } catch (err) {
                console.warn(`Cannot proceed with moveTo command:\n\t-> ${err}`);
            }
        }
    }

    private tryMovePlayerWithMoveToUserParameter(): void {
        const uuidParam = urlManager.getHashParameter("moveToUser");
        if (uuidParam) {
            this.connection?.emitAskPosition(uuidParam, this.roomUrl);
            urlManager.clearHashParameter();
        }
    }

    public moveTo(position: { x: number; y: number }) {
        this.pathfindingManager
            .findPath(this.gameMap.getTileIndexAt(this.CurrentPlayer.x, this.CurrentPlayer.y), position)
            .then((path) => {
                if (path && path.length > 0) {
                    this.CurrentPlayer.setPathToFollow(path).catch((reason) => console.warn(reason));
                }
            })
            .catch((reason) => console.warn(reason));
    }

    private getExitUrl(layer: ITiledMapLayer): string | undefined {
        return this.getProperty(layer, GameMapProperties.EXIT_URL) as string | undefined;
    }

    /**
     * @deprecated the map property exitSceneUrl is deprecated
     */
    private getExitSceneUrl(layer: ITiledMapLayer): string | undefined {
        return this.getProperty(layer, GameMapProperties.EXIT_SCENE_URL) as string | undefined;
    }

    private getScriptUrls(map: ITiledMap): string[] {
        return (this.getProperties(map, GameMapProperties.SCRIPT) as string[]).map((script) =>
            new URL(script, this.MapUrlFile).toString()
        );
    }

    private getProperty(layer: ITiledMapLayer | ITiledMap, name: string): string | boolean | number | undefined {
        const properties: ITiledMapProperty[] | undefined = layer.properties;
        if (!properties) {
            return undefined;
        }
        const obj = properties.find(
            (property: ITiledMapProperty) => property.name.toLowerCase() === name.toLowerCase()
        );
        if (obj === undefined) {
            return undefined;
        }
        return obj.value as string | number | boolean | undefined;
    }

    private getProperties(layer: ITiledMapLayer | ITiledMap, name: string): (string | number | boolean | undefined)[] {
        const properties: ITiledMapProperty[] | undefined = layer.properties;
        if (!properties) {
            return [];
        }
        return properties
            .filter((property: ITiledMapProperty) => property.name.toLowerCase() === name.toLowerCase())
            .map((property) => property.value) as (string | number | boolean | undefined)[];
    }

    private loadNextGameFromExitUrl(exitUrl: string): Promise<void> {
        return this.loadNextGame(Room.getRoomPathFromExitUrl(exitUrl, window.location.toString()));
    }

    //todo: push that into the gameManager
    private async loadNextGame(exitRoomPath: URL): Promise<void> {
        try {
            const room = await Room.createRoom(exitRoomPath);
            return gameManager.loadMap(room);
        } catch (e /*: unknown*/) {
            console.warn('Error while pre-loading exit room "' + exitRoomPath.toString() + '"', e);
        }
    }

    private handleCurrentPlayerHasMovedEvent(event: HasPlayerMovedEvent): void {
        //listen event to share position of user
        this.pushPlayerPosition(event);
        this.gameMap.setPosition(event.x, event.y);
        this.activatablesManager.updateActivatableObjectsDistances([
            ...Array.from(this.MapPlayersByKey.values()),
            ...this.actionableItems.values(),
        ]);
        this.activatablesManager.deduceSelectedActivatableObjectByDistance();
    }

    private createCollisionWithPlayer() {
        //add collision layer
        for (const phaserLayer of this.gameMap.phaserLayers) {
            this.physics.add.collider(this.CurrentPlayer, phaserLayer, (object1: GameObject, object2: GameObject) => {
                //this.CurrentPlayer.say("Collision with layer : "+ (object2 as Tile).layer.name)
            });
            phaserLayer.setCollisionByProperty({ collides: true });
            if (DEBUG_MODE) {
                //debug code to see the collision hitbox of the object in the top layer
                phaserLayer.renderDebug(this.add.graphics(), {
                    tileColor: null, //non-colliding tiles
                    collidingTileColor: new Phaser.Display.Color(243, 134, 48, 200), // Colliding tiles,
                    faceColor: new Phaser.Display.Color(40, 39, 37, 255), // Colliding face edges
                });
            }
            //});
        }
    }

    // The promise that will resolve to the current player texture. This will be available only after connection is established.
    private currentPlayerTexturesResolve!: (value: string[]) => void;
    private currentPlayerTexturesReject!: (reason: unknown) => void;
    private currentPlayerTexturesPromise: CancelablePromise<string[]> = new CancelablePromise((resolve, reject) => {
        this.currentPlayerTexturesResolve = resolve;
        this.currentPlayerTexturesReject = reject;
    });

    private createCurrentPlayer() {
        //TODO create animation moving between exit and start
        try {
            this.CurrentPlayer = new Player(
                this,
                this.startPositionCalculator.startPosition.x,
                this.startPositionCalculator.startPosition.y,
                this.playerName,
                this.currentPlayerTexturesPromise,
                PlayerAnimationDirections.Down,
                false,
                this.companion,
                this.companion !== null ? lazyLoadCompanionResource(this.load, this.companion) : undefined
            );
            this.CurrentPlayer.on(Phaser.Input.Events.POINTER_OVER, (pointer: Phaser.Input.Pointer) => {
                this.CurrentPlayer.pointerOverOutline(0x365dff);
            });
            this.CurrentPlayer.on(Phaser.Input.Events.POINTER_OUT, (pointer: Phaser.Input.Pointer) => {
                this.CurrentPlayer.pointerOutOutline();
            });
            this.CurrentPlayer.on(requestEmoteEventName, (emoteKey: string) => {
                this.connection?.emitEmoteEvent(emoteKey);
            });
        } catch (err) {
            if (err instanceof TextureError) {
                gameManager.leaveGame(SelectCharacterSceneName, new SelectCharacterScene());
            }
            throw err;
        }

        //create collision
        this.createCollisionWithPlayer();
    }

    private pushPlayerPosition(event: HasPlayerMovedEvent) {
        if (this.lastMoveEventSent === event) {
            return;
        }

        // If the player is not moving, let's send the info right now.
        if (event.moving === false) {
            this.doPushPlayerPosition(event);
            return;
        }

        // If the player is moving, and if it changed direction, let's send an event
        if (event.direction !== this.lastMoveEventSent.direction) {
            this.doPushPlayerPosition(event);
            return;
        }

        // If more than 200ms happened since last event sent
        if (this.currentTick - this.lastSentTick >= POSITION_DELAY) {
            this.doPushPlayerPosition(event);
            return;
        }

        // Otherwise, do nothing.
    }

    private doPushPlayerPosition(event: HasPlayerMovedEvent): void {
        this.lastMoveEventSent = event;
        this.lastSentTick = this.currentTick;
        const camera = this.cameras.main;
        this.connection?.sharePosition(event.x, event.y, event.direction, event.moving, {
            left: camera.scrollX,
            top: camera.scrollY,
            right: camera.scrollX + camera.width,
            bottom: camera.scrollY + camera.height,
        });
        iframeListener.hasPlayerMoved(event);
    }

    /**
     * @param time
     * @param delta The delta time in ms since the last frame. This is a smoothed and capped value based on the FPS rate.
     */
    public update(time: number, delta: number): void {
        this.dirty = false;
        this.currentTick = time;
        if (!this.mapEditorModeManager?.isActive()) {
            this.CurrentPlayer.moveUser(delta, this.userInputManager.getEventListForGameTick());
        } else {
            this.cameraManager.move(this.userInputManager.getEventListForGameTick());
        }

        // Let's handle all events
        while (this.pendingEvents.length !== 0) {
            this.dirty = true;
            const event = this.pendingEvents.dequeue();
            switch (event.type) {
                case "InitUserPositionEvent":
                    this.doInitUsersPosition(event.event);
                    break;
                case "AddPlayerEvent":
                    this.doAddPlayer(event.event);
                    break;
                case "RemovePlayerEvent":
                    this.doRemovePlayer(event.userId);
                    break;
                case "UserMovedEvent": {
                    this.doUpdatePlayerPosition(event.event);
                    const remotePlayer = this.MapPlayersByKey.get(event.event.userId);
                    if (remotePlayer) {
                        this.activatablesManager.updateDistanceForSingleActivatableObject(remotePlayer);
                        this.activatablesManager.deduceSelectedActivatableObjectByDistance();
                    }
                    break;
                }
                case "GroupCreatedUpdatedEvent":
                    this.doShareGroupPosition(event.event);
                    break;
                case "PlayerDetailsUpdated":
                    this.doUpdatePlayerDetails(event.details);
                    break;
                case "DeleteGroupEvent": {
                    this.doDeleteGroup(event.groupId);
                    if (this.currentPlayerGroupId === event.groupId) {
                        currentPlayerGroupLockStateStore.set(undefined);
                    }
                    break;
                }
                default: {
                    const _exhaustiveCheck: never = event;
                }
            }
        }
        // Let's move all users
        const updatedPlayersPositions = this.playersPositionInterpolator.getUpdatedPositions(time);
        updatedPlayersPositions.forEach((moveEvent: HasPlayerMovedEvent, userId: number) => {
            this.dirty = true;
            const player: RemotePlayer | undefined = this.MapPlayersByKey.get(userId);
            if (player === undefined) {
                throw new Error('Cannot find player with ID "' + userId + '"');
            }
            player.updatePosition(moveEvent);
        });
    }

    /**
     * Called by the connexion when the full list of user position is received.
     */
    private initUsersPosition(usersPosition: MessageUserPositionInterface[]): void {
        this.pendingEvents.enqueue({
            type: "InitUserPositionEvent",
            event: usersPosition,
        });
    }

    /**
     * Put all the players on the map on map load.
     */
    private doInitUsersPosition(usersPosition: MessageUserPositionInterface[]): void {
        const currentPlayerId = this.connection?.getUserId();
        this.removeAllRemotePlayers();
        // load map
        usersPosition.forEach((userPosition: MessageUserPositionInterface) => {
            if (userPosition.userId === currentPlayerId) {
                return;
            }
            this.addPlayer(userPosition);
        });
    }

    /**
     * Called by the connexion when a new player arrives on a map
     */
    public addPlayer(addPlayerData: AddPlayerInterface): void {
        this.pendingEvents.enqueue({
            type: "AddPlayerEvent",
            event: addPlayerData,
        });
    }

    private doAddPlayer(addPlayerData: AddPlayerInterface): void {
        //check if exist player, if exist, move position
        if (this.MapPlayersByKey.has(addPlayerData.userId)) {
            this.updatePlayerPosition({
                userId: addPlayerData.userId,
                position: addPlayerData.position,
            });
            return;
        }

        const texturesPromise = lazyLoadPlayerCharacterTextures(this.superLoad, addPlayerData.characterLayers);
        const player = new RemotePlayer(
            addPlayerData.userId,
            addPlayerData.userUuid,
            this,
            addPlayerData.position.x,
            addPlayerData.position.y,
            addPlayerData.name,
            texturesPromise,
            addPlayerData.position.direction as PlayerAnimationDirections,
            addPlayerData.position.moving,
            addPlayerData.visitCardUrl,
            addPlayerData.companion,
            addPlayerData.companion !== null ? lazyLoadCompanionResource(this.load, addPlayerData.companion) : undefined
        );
        if (addPlayerData.outlineColor !== undefined) {
            player.setApiOutlineColor(addPlayerData.outlineColor);
        }
        if (addPlayerData.availabilityStatus !== undefined) {
            player.setAvailabilityStatus(addPlayerData.availabilityStatus, true);
        }
        this.MapPlayers.add(player);
        this.MapPlayersByKey.set(player.userId, player);
        player.updatePosition(addPlayerData.position);

        player.on(Phaser.Input.Events.POINTER_OVER, () => {
            this.activatablesManager.handlePointerOverActivatableObject(player);
            this.markDirty();
        });

        player.on(Phaser.Input.Events.POINTER_OUT, () => {
            this.activatablesManager.handlePointerOutActivatableObject();
            this.markDirty();
        });

        player.on(RemotePlayerEvent.Clicked, () => {
            iframeListener.sendRemotePlayerClickedEvent({
                id: player.userId,
                uuid: player.userUuid,
                name: player.name,
            });
        });
    }

    /**
     * Called by the connexion when a player is removed from the map
     */
    public removePlayer(userId: number) {
        this.pendingEvents.enqueue({
            type: "RemovePlayerEvent",
            userId,
        });
    }

    private tryChangeShowVoiceIndicatorState(show: boolean): void {
        this.CurrentPlayer.showTalkIcon(show);
        if (this.showVoiceIndicatorChangeMessageSent && !show) {
            this.connection?.emitPlayerShowVoiceIndicator(false);
            this.showVoiceIndicatorChangeMessageSent = false;
        } else if (!this.showVoiceIndicatorChangeMessageSent && show) {
            this.connection?.emitPlayerShowVoiceIndicator(true);
            this.showVoiceIndicatorChangeMessageSent = true;
        }
    }

    private doRemovePlayer(userId: number) {
        const player = this.MapPlayersByKey.get(userId);
        if (player === undefined) {
            console.error("Cannot find user with id ", userId);
        } else {
            player.destroy();

            if (player.companion) {
                player.companion.destroy();
            }

            this.MapPlayers.remove(player);
        }
        this.MapPlayersByKey.delete(userId);
        this.playersPositionInterpolator.removePlayer(userId);
    }

    private updatePlayerPosition(message: MessageUserMovedInterface): void {
        this.pendingEvents.enqueue({
            type: "UserMovedEvent",
            event: message,
        });
    }

    private doUpdatePlayerPosition(message: MessageUserMovedInterface): void {
        const player: RemotePlayer | undefined = this.MapPlayersByKey.get(message.userId);
        if (player === undefined) {
            //throw new Error('Cannot find player with ID "' + message.userId +'"');
            console.error('Cannot update position of player with ID "' + message.userId + '": player not found');
            return;
        }

        // We do not update the player position directly (because it is sent only every 200ms).
        // Instead we use the PlayersPositionInterpolator that will do a smooth animation over the next 200ms.
        const playerMovement = new PlayerMovement(
            { x: player.x, y: player.y },
            this.currentTick,
            {
                ...message.position,
            },
            this.currentTick + POSITION_DELAY
        );
        this.playersPositionInterpolator.updatePlayerPosition(player.userId, playerMovement);
    }

    private shareGroupPosition(groupPositionMessage: GroupCreatedUpdatedMessageInterface) {
        this.pendingEvents.enqueue({
            type: "GroupCreatedUpdatedEvent",
            event: groupPositionMessage,
        });
    }

    private doShareGroupPosition(groupPositionMessage: GroupCreatedUpdatedMessageInterface) {
        //delete previous group
        this.doDeleteGroup(groupPositionMessage.groupId);

        // TODO: circle radius should not be hard stored
        //create new group
        const sprite = new Sprite(
            this,
            Math.round(groupPositionMessage.position.x),
            Math.round(groupPositionMessage.position.y),
            groupPositionMessage.groupSize === MAX_PER_GROUP || groupPositionMessage.locked
                ? "circleSprite-red"
                : "circleSprite-white"
        );
        sprite.setDisplayOrigin(48, 48).setDepth(DEPTH_BUBBLE_CHAT_SPRITE);
        this.add.existing(sprite);
        this.groups.set(groupPositionMessage.groupId, sprite);
        if (this.currentPlayerGroupId === groupPositionMessage.groupId) {
            currentPlayerGroupLockStateStore.set(groupPositionMessage.locked);
        }
        return sprite;
    }

    deleteGroup(groupId: number): void {
        this.pendingEvents.enqueue({
            type: "DeleteGroupEvent",
            groupId,
        });
    }

    doDeleteGroup(groupId: number): void {
        const group = this.groups.get(groupId);
        if (!group) {
            return;
        }
        group.destroy();
        this.groups.delete(groupId);
    }

    doUpdatePlayerDetails(message: PlayerDetailsUpdatedMessage): void {
        const character = this.MapPlayersByKey.get(message.userId);
        if (character === undefined) {
            console.log(
                "Could not set new details to character with ID ",
                message.userId,
                ". Did he/she left before te message was received?"
            );
            return;
        }
        if (message.details?.removeOutlineColor) {
            character.removeApiOutlineColor();
        } else if (message.details?.outlineColor !== undefined) {
            character.setApiOutlineColor(message.details?.outlineColor);
        }
        if (message.details?.showVoiceIndicator !== undefined) {
            character.showTalkIcon(message.details?.showVoiceIndicator, !message.details?.showVoiceIndicator);
        }
        if (message.details?.availabilityStatus !== undefined) {
            character.setAvailabilityStatus(message.details?.availabilityStatus);
        }
    }

    /**
     * Sends to the server an event emitted by one of the ActionableItems.
     */
    emitActionableEvent(itemId: number, eventName: string, state: unknown, parameters: unknown) {
        this.connection?.emitActionableEvent(itemId, eventName, state, parameters);
    }

    public onResize(): void {
        super.onResize();
        this.reposition(true);

        this.sendViewportToServer();
    }

    public sendViewportToServer(): void {
        const camera = this.cameras.main;
        this.connection?.setViewport({
            left: camera.scrollX,
            top: camera.scrollY,
            right: camera.scrollX + camera.width,
            bottom: camera.scrollY + camera.height,
        });
    }

    private getObjectLayerData(objectName: string): ITiledMapObject | undefined {
        for (const layer of this.mapFile.layers) {
            if (layer.type === "objectgroup" && layer.name === "floorLayer") {
                for (const object of layer.objects) {
                    if (object.name === objectName) {
                        return object;
                    }
                }
            }
        }
        return undefined;
    }

    private reposition(instant = false): void {
        // Recompute camera offset if needed
        this.time.delayedCall(0, () => {
            biggestAvailableAreaStore.recompute();
            this.cameraManager.updateCameraOffset(get(biggestAvailableAreaStore), instant);
        });
    }

    public enableMediaBehaviors() {
        if (!get(denyProximityMeetingStore)) {
            mediaManager.showMyCamera();
        }
    }

    public disableMediaBehaviors() {
        mediaManager.hideMyCamera();
    }

    public initialiseJitsi(coWebsite: JitsiCoWebsite, roomName: string, jwt?: string): void {
        const allProps = this.gameMap.getCurrentProperties();
        const jitsiConfig = this.safeParseJSONstring(
            allProps.get(GameMapProperties.JITSI_CONFIG) as string | undefined,
            GameMapProperties.JITSI_CONFIG
        );
        const jitsiInterfaceConfig = this.safeParseJSONstring(
            allProps.get(GameMapProperties.JITSI_INTERFACE_CONFIG) as string | undefined,
            GameMapProperties.JITSI_INTERFACE_CONFIG
        );
        const jitsiUrl = allProps.get(GameMapProperties.JITSI_URL) as string | undefined;

        coWebsite.setJitsiLoadPromise(() => {
            return jitsiFactory.start(roomName, this.playerName, jwt, jitsiConfig, jitsiInterfaceConfig, jitsiUrl);
        });

        coWebsiteManager.loadCoWebsite(coWebsite).catch((err) => {
            console.error(err);
        });

        analyticsClient.enteredJitsi(roomName, this.room.id);
    }

    //todo: put this into an 'orchestrator' scene (EntryScene?)
    private bannedUser() {
        this.cleanupClosingScene();
        this.userInputManager.disableControls();
        this.scene.start(ErrorSceneName, {
            title: "Banned",
            subTitle: "You were banned from WorkAdventure",
            message: "If you want more information, you may contact us at: hello@workadventu.re",
        });
    }

    //todo: put this into an 'orchestrator' scene (EntryScene?)
    private showWorldFullError(message: string | null): void {
        this.cleanupClosingScene();
        this.scene.stop(ReconnectingSceneName);
        this.scene.remove(ReconnectingSceneName);
        this.userInputManager.disableControls();
        //FIX ME to use status code
        if (message == undefined) {
            this.scene.start(ErrorSceneName, {
                title: "Connection rejected",
                subTitle: "The world you are trying to join is full. Try again later.",
                message: "If you want more information, you may contact us at: hello@workadventu.re",
            });
        } else {
            this.scene.start(ErrorSceneName, {
                title: "Connection rejected",
                subTitle: "You cannot join the World. Try again later. \n\r \n\r Error: " + message + ".",
                message:
                    "If you want more information, you may contact administrator or contact us at: hello@workadventu.re",
            });
        }
    }

    private bindSceneEventHandlers(): void {
        this.events.once("shutdown", () => {
            if (!this.cleanupDone) {
                throw new Error("Scene destroyed without cleanup!");
            }
        });
    }

    zoomByFactor(zoomFactor: number) {
        if (this.cameraManager.isCameraLocked()) {
            return;
        }
        waScaleManager.handleZoomByFactor(zoomFactor);
        // biggestAvailableAreaStore.recompute();
    }

    public createSuccessorGameScene(autostart: boolean, reconnecting: boolean) {
        const gameSceneKey = "somekey" + Math.round(Math.random() * 10000);
        const game = new GameScene(this.room, this.MapUrlFile, gameSceneKey);
        this.scene.add(gameSceneKey, game, autostart, {
            initPosition: {
                x: this.CurrentPlayer.x,
                y: this.CurrentPlayer.y,
            },
            reconnecting: reconnecting,
        });

        //If new gameScene doesn't start automatically then we change the gameScene in gameManager so that it can start the new gameScene
        if (!autostart) {
            gameManager.gameSceneIsCreated(game);
        }

        this.scene.stop(this.scene.key);
        this.scene.remove(this.scene.key);
    }

    public getGameMap(): GameMap {
        return this.gameMap;
    }

    public getCameraManager(): CameraManager {
        return this.cameraManager;
    }

    public getMapEditorModeManager(): MapEditorModeManager {
        return this.mapEditorModeManager;
    }

    public getPathfindingManager(): PathfindingManager {
        return this.pathfindingManager;
    }

    public getActivatablesManager(): ActivatablesManager {
        return this.activatablesManager;
    }

    public isMapEditorEnabled() {
        return ENABLE_FEATURE_MAP_EDITOR;
    }
}
