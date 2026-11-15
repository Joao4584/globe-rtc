import * as Phaser from "phaser";
import { MapManager } from "@/modules/shared/config/phaser-js/map/MapManager";
import { Player } from "@/modules/shared/config/phaser-js/sprites/Player";
import type { Room } from "colyseus.js";
import type { PlaygroundState } from "../@types/player";
import { RemoteManager } from "./helpers/remote-manager";
import { TemplateWalkable, buildTemplateMapInScene, emptyTemplateMap, type Seat, type TemplateMapData } from "../lib/template-map";
import { MovementPublisher } from "./helpers/movement-publisher";
import { LocalPlayerPresence } from "./helpers/local-player-presence";
import { getSoundManager } from "@/modules/shared/audio/sound-manager";
import { FALLBACK_SKIN } from "../lib/skin-assets";
import type { AnimatedObject } from "./helpers/animated-object";
import { TILE } from "@/modules/editor/assets/map-assets";

// How far (px) a chair may be from the player's feet to sit on it by clicking.
const SEAT_REACH = 160;

// Cena principal do jogo: monta mapa/jogador local e sincroniza estado em tempo real com a sala.
export class MainScene extends Phaser.Scene {
  private player!: Player;
  private room?: Room<PlaygroundState>;
  private selfInitialized = false;
  private remotes?: RemoteManager;
  private walkableResolver?: { coerce(x: number | undefined, y: number | undefined, fallback?: Phaser.Math.Vector2): Phaser.Math.Vector2 };
  private movementPublisher?: MovementPublisher;
  private localPresence?: LocalPlayerPresence;
  private cleanupZoomControls?: () => void;
  private sounds = getSoundManager();
  private animatedObjects: AnimatedObject[] = [];
  private seats: Seat[] = [];
  /** The chair the local player is sitting on. */
  private sitting?: { seat: Seat; feetX: number; feetY: number };

  constructor() {
    super({ key: "game" });
  }

  // Recebe a room no ciclo de init para uso durante create/update.
  init(data: { room?: Room<PlaygroundState> }) {
    this.room = data.room;
  }

  // Cria o mapa, posiciona jogador local e registra listeners de rede.
  create() {
    const onSceneReady = this.game.registry.get("on-scene-ready") as (() => void) | undefined;
    onSceneReady?.();

    // Every room renders a map made in the editor; a room without one gets an empty walkable box.
    const templateMap = (this.game.registry.get("template-map") as TemplateMapData | undefined) ?? emptyTemplateMap();
    const walkable = new TemplateWalkable(templateMap);
    this.animatedObjects = [];
    this.seats = templateMap.seats;
    this.sitting = undefined;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onSeatClick);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onSeatClick));
    const collideWith = buildTemplateMapInScene(this, templateMap, this.animatedObjects);
    const bounds = new Phaser.Geom.Rectangle(templateMap.bounds.x, templateMap.bounds.y, templateMap.bounds.width, templateMap.bounds.height);
    const spawnFromMap = walkable.randomSpawn();
    this.walkableResolver = walkable;

    const roomSpawn = this.getSpawnFromRoom();
    const localSpawn = this.walkableResolver.coerce(roomSpawn?.x, roomSpawn?.y, spawnFromMap);

    const localSkin = this.room?.state.players.get(this.room?.sessionId ?? "")?.skin?.toString() ?? FALLBACK_SKIN;
    const localName = this.room?.state.players.get(this.room?.sessionId ?? "")?.name?.toString() ?? "Player";

    this.player = new Player(this, localSpawn.x, localSpawn.y, localSkin);
    this.player.setDepth(localSpawn.y);

    this.physics.world.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.physics.add.collider(this.player, collideWith);

    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cameras.main.roundPixels = true;
    this.cameras.main.setRoundPixels(true);
    const background = (this.game.registry.get("room-background") as string | undefined) ?? "#0b1220";
    this.cameras.main.setBackgroundColor(background);
    this.cleanupZoomControls = MapManager.setupWheelZoom(this, this.cameras.main, {
      initialZoom: 1,
      minZoom: 1,
      maxZoom: 2.5,
      wheelStep: 0.25,
      zoomSnapStep: 0.25,
    });

    this.remotes = new RemoteManager(this, (x, y) => this.walkableResolver?.coerce(x, y, spawnFromMap) ?? spawnFromMap, spawnFromMap);
    this.remotes.setSeats(this.seats);
    this.movementPublisher = new MovementPublisher(() => this.room, this.player);
    this.movementPublisher.syncInitialPosition(localSpawn);
    this.localPresence = new LocalPlayerPresence(
      this,
      this.player,
      () => this.room,
      () => this.remotes,
    );
    this.localPresence.create(localName, localSpawn);

    this.registerNetworkListeners();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleShutdown());
  }

  // Atualiza movimentacao local, profundidade e publicacao periodica de posicao.
  update() {
    this.player.update();
    const now = this.time.now;
    const cam = this.cameras.main;
    cam.setScroll(Math.round(cam.scrollX), Math.round(cam.scrollY));
    this.player.setDepth(this.player.y);
    this.updateSeat();

    // The player sprite is 64px tall and stands on its bottom edge.
    for (const object of this.animatedObjects) object.update(now, this.player.x, this.player.y + 32, 32);

    this.localPresence?.update(now);
    this.movementPublisher?.publish(now);

    const selfState = this.room?.state.players.get(this.room?.sessionId ?? "");
    const stateSkin = selfState?.skin?.toString();
    if (stateSkin) {
      this.player.setSkin(stateSkin);
    }

    if (this.player.isMoving()) {
      void this.sounds.play("footstep", {
        throttleMs: this.player.isSprinting() ? 95 : 150,
      });
    }
  }

  // Chairs: clicking an object flagged `sittable` (close enough) sits the local player on it; a move key gets up, towards
  // the side of that key (W up, A left, S down, D right).
  private readonly onSeatClick = (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[] = []) => {
    if (this.sitting || over.some((object) => object === this.player || object.getData?.("isPlayerSprite"))) return;
    const seat = this.seats.find((s) => pointer.worldX >= s.art.x && pointer.worldX <= s.art.x + s.art.width && pointer.worldY >= s.art.y && pointer.worldY <= s.art.y + s.art.height);
    if (!seat) return;
    const seatX = Phaser.Math.Clamp(this.player.x, seat.x + TILE / 2, seat.x + seat.width - TILE / 2);
    const seatY = seat.y + TILE / 2;
    // Only chairs within reach: the click does not teleport the player across the room.
    if (Math.hypot(seatX - this.player.x, seatY - (this.player.y + 32)) > SEAT_REACH) return;
    this.sitting = { seat, feetX: seatX, feetY: seatY };
    this.player.sit(seatX, seatY - 32, seat.facing);
    this.room?.send("sit", { facing: seat.facing });
  };

  private updateSeat() {
    if (!this.sitting) return;
    const { seat, feetX, feetY } = this.sitting;
    const direction = this.player.inputDirection();
    if (direction) {
      const step = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[direction];
      this.player.standUp(feetX + step[0] * TILE, feetY + step[1] * TILE - 32, direction);
      this.room?.send("sit", {});
      this.sitting = undefined;
      return;
    }
    // Sorted with the chair: in front of it, except a chair that looks away (its back covers the person).
    if (seat.depth !== undefined) this.player.setDepth(seat.depth + (seat.facing === "up" ? -0.5 : 0.5));
  }

  // Extrai o spawn inicial do jogador local a partir do estado da room.
  private getSpawnFromRoom() {
    if (!this.room) return undefined;
    const player = this.room.state.players.get(this.room.sessionId);
    if (!player) return undefined;
    return new Phaser.Math.Vector2(player.x ?? 0, player.y ?? 0);
  }

  // Conecta callbacks do estado Colyseus para criar/atualizar/remover jogadores remotos.
  private registerNetworkListeners() {
    const room = this.room;
    if (!room) return;

    const selfId = room.sessionId;

    room.state.players.onAdd = (player, sessionId) => {
      if (sessionId === selfId) {
        if (!this.selfInitialized) {
          this.player.setPosition(player.x ?? this.player.x, player.y ?? this.player.y);
          const tint = Phaser.Display.Color.HexStringToColor(player.color ?? "#ffffff");
          this.player.setTint(tint.color);
          this.localPresence?.setName(player.name ?? "Player");
          this.movementPublisher?.syncWithCurrentPosition();
          this.selfInitialized = true;
        }
        return;
      }

      this.remotes?.addOrUpdate(player, sessionId, selfId);
    };

    const materializeAll = () => this.remotes?.materializeAll(room, selfId);
    const prune = () => this.remotes?.prune(room, selfId);

    materializeAll();

    room.state.players.onChange = (player, sessionId) => {
      if (sessionId === selfId) return;
      this.remotes?.updateRemoteSprite(sessionId, player);
    };

    room.onStateChange(() => {
      materializeAll();
      prune();
    });

    room.state.players.onRemove = (_, sessionId) => {
      this.remotes?.remove(sessionId);
      if (sessionId === selfId) {
        this.room?.leave();
      }
    };
  }

  // Libera recursos da cena e encerra a conexao da room ao desmontar.
  private handleShutdown() {
    if (this.cleanupZoomControls) {
      this.cleanupZoomControls();
      this.cleanupZoomControls = undefined;
    }

    this.remotes?.destroy();
    this.remotes = undefined;

    this.localPresence?.destroy();
    this.localPresence = undefined;

    const room = this.room;
    this.room = undefined;
    room?.leave();
  }
}
