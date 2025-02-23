import { flattenGroupLayersMap } from "../Map/LayersFlattener";
import TilemapLayer = Phaser.Tilemaps.TilemapLayer;
import { DEPTH_OVERLAY_INDEX } from "./DepthIndexes";
import { GameMapProperties } from "./GameMapProperties";
import { MathUtils } from "../../Utils/MathUtils";
import {
    ITiledMap,
    ITiledMapLayer,
    ITiledMapObject,
    ITiledMapProperty,
    ITiledMapTileLayer,
    upgradeMapToNewest,
} from "@workadventure/tiled-map-type-guard";
import { PathTileType } from "../../Utils/PathfindingManager";

export type PropertyChangeCallback = (
    newValue: string | number | boolean | undefined,
    oldValue: string | number | boolean | undefined,
    allProps: Map<string, string | boolean | number>
) => void;

export type layerChangeCallback = (
    layersChangedByAction: Array<ITiledMapLayer>,
    allLayersOnNewPosition: Array<ITiledMapLayer>
) => void;

export type areaChangeCallback = (
    areasChangedByAction: Array<ITiledMapObject>,
    allAreasOnNewPosition: Array<ITiledMapObject>
) => void;

export enum AreaType {
    Static = "Static",
    Dynamic = "Dynamic",
}
export type ITiledMapRectangleObject = ITiledMapObject & { width: number; height: number };

/**
 * A wrapper around a ITiledMap interface to provide additional capabilities.
 * It is used to handle layer properties.
 */
export class GameMap {
    /**
     * oldKey is the index of the previous tile.
     */
    private oldKey: number | undefined;
    /**
     * key is the index of the current tile.
     */
    private key: number | undefined;
    /**
     * oldPosition is the previous position of the player.
     */
    private oldPosition: { x: number; y: number } | undefined;
    /**
     * position is the current position of the player.
     */
    private position: { x: number; y: number } | undefined;

    private lastProperties = new Map<string, string | boolean | number>();
    private propertiesChangeCallbacks = new Map<string, Array<PropertyChangeCallback>>();

    private enterLayerCallbacks = Array<layerChangeCallback>();
    private leaveLayerCallbacks = Array<layerChangeCallback>();
    private enterAreaCallbacks = Array<areaChangeCallback>();
    private leaveAreaCallbacks = Array<areaChangeCallback>();

    private readonly map: ITiledMap;
    private tileNameMap = new Map<string, number>();

    private tileSetPropertyMap: { [tile_index: number]: Array<ITiledMapProperty> } = {};
    public readonly flatLayers: ITiledMapLayer[];
    public readonly tiledObjects: ITiledMapObject[];
    public readonly phaserLayers: TilemapLayer[] = [];

    /**
     * Areas that we can do CRUD operations on via scripting API
     */
    private readonly dynamicAreas: ITiledMapRectangleObject[] = [];
    /**
     * Areas loaded from Tiled map file
     */
    private readonly staticAreas: ITiledMapRectangleObject[] = [];

    private readonly areasPositionOffsetY: number = 16;
    private readonly staticAreaNamePrefix = "STATIC_AREA_";
    private unnamedStaticAreasCounter = 0;
    private readonly defaultTileSize = 32;

    private perLayerCollisionGridCache: Map<number, (0 | 2 | 1)[][]> = new Map<number, (0 | 2 | 1)[][]>();

    public exitUrls: Array<string> = [];

    public hasStartTile = false;

    public constructor(map: ITiledMap, phaserMap: Phaser.Tilemaps.Tilemap, terrains: Array<Phaser.Tilemaps.Tileset>) {
        this.map = upgradeMapToNewest(map);
        this.flatLayers = flattenGroupLayersMap(this.map);
        this.tiledObjects = GameMap.getObjectsFromLayers(this.flatLayers);
        // NOTE: We leave "zone" for legacy reasons
        this.tiledObjects
            .filter((object) => ["zone", "area"].includes(object.class ?? ""))
            .forEach((area) => {
                let name = area.name;
                if (!name) {
                    name = `${this.staticAreaNamePrefix}${this.unnamedStaticAreasCounter}`;
                    area.name = name;
                    this.unnamedStaticAreasCounter++;
                }
                if (area.width === undefined || area.height === undefined) {
                    console.warn(`Area name "${name}" must be a rectangle`);
                    return;
                }
                this.staticAreas.push(area as ITiledMapRectangleObject);
            });

        let depth = -2;
        for (const layer of this.flatLayers) {
            if (layer.type === "tilelayer") {
                this.phaserLayers.push(
                    phaserMap
                        .createLayer(layer.name, terrains, (layer.x || 0) * 32, (layer.y || 0) * 32)
                        .setDepth(depth)
                        .setScrollFactor(layer.parallaxx ?? 1, layer.parallaxy ?? 1)
                        .setAlpha(layer.opacity)
                        .setVisible(layer.visible)
                        .setSize(layer.width, layer.height)
                );
            }
            if (layer.type === "objectgroup" && layer.name === "floorLayer") {
                depth = DEPTH_OVERLAY_INDEX;
            }
        }
        for (const tileset of this.map.tilesets) {
            tileset?.tiles?.forEach((tile) => {
                if (tile.properties && tileset.firstgid !== undefined) {
                    this.tileSetPropertyMap[tileset.firstgid + tile.id] = tile.properties;
                    tile.properties.forEach((prop) => {
                        if (
                            prop.name == GameMapProperties.NAME &&
                            typeof prop.value == "string" &&
                            tileset.firstgid !== undefined
                        ) {
                            this.tileNameMap.set(prop.value, tileset.firstgid + tile.id);
                        }
                        if (prop.name == GameMapProperties.EXIT_URL && typeof prop.value == "string") {
                            this.exitUrls.push(prop.value);
                        } else if (prop.name == GameMapProperties.START) {
                            this.hasStartTile = true;
                        }
                    });
                }
            });
        }
    }

    public getPropertiesForIndex(index: number): Array<ITiledMapProperty> {
        if (this.tileSetPropertyMap[index]) {
            return this.tileSetPropertyMap[index];
        }
        return [];
    }

    public getCollisionGrid(modifiedLayer?: TilemapLayer, useCache = true): number[][] {
        // initialize collision grid to write on
        if (this.map.height === undefined || this.map.width === undefined) {
            return [];
        }
        const grid: number[][] = Array.from(Array(this.map.height), (_) =>
            Array(this.map.width).fill(PathTileType.Walkable)
        );
        if (modifiedLayer) {
            // recalculate cache for certain layer if needed
            this.perLayerCollisionGridCache.set(modifiedLayer.layerIndex, this.getLayerCollisionGrid(modifiedLayer));
        }
        // go through all tilemap layers on map. Maintain order
        for (const layer of this.phaserLayers) {
            if (!layer.visible) {
                continue;
            }
            if (!useCache) {
                this.perLayerCollisionGridCache.set(layer.layerIndex, this.getLayerCollisionGrid(layer));
            }
            const cachedLayer = this.perLayerCollisionGridCache.get(layer.layerIndex);
            if (!cachedLayer) {
                // no cache, calculate collision grid for this layer
                this.perLayerCollisionGridCache.set(layer.layerIndex, this.getLayerCollisionGrid(layer));
            } else {
                for (let y = 0; y < this.map.height; y += 1) {
                    for (let x = 0; x < this.map.width; x += 1) {
                        // currently no case where we can make tile non-collidable with collidable object beneath, skip position
                        if (grid[y][x] === PathTileType.Exit && cachedLayer[y][x] === PathTileType.Collider) {
                            grid[y][x] = cachedLayer[y][x];
                            continue;
                        }
                        if (grid[y][x] !== PathTileType.Walkable) {
                            continue;
                        }
                        grid[y][x] = cachedLayer[y][x];
                    }
                }
            }
        }
        return grid;
    }

    public getTileDimensions(): { width: number; height: number } {
        return {
            width: this.map.tilewidth ?? this.defaultTileSize,
            height: this.map.tileheight ?? this.defaultTileSize,
        };
    }

    public getTileIndexAt(x: number, y: number): { x: number; y: number } {
        return {
            x: Math.floor(x / (this.map.tilewidth ?? this.defaultTileSize)),
            y: Math.floor(y / (this.map.tileheight ?? this.defaultTileSize)),
        };
    }

    /**
     * Sets the position of the current player (in pixels)
     * This will trigger events if properties are changing.
     */
    public setPosition(x: number, y: number) {
        if (!this.map.width || !this.map.height) {
            return;
        }
        this.oldPosition = this.position;
        this.position = { x, y };
        const areasChanged = this.triggerAreasChange();
        if (areasChanged) {
            this.triggerAllProperties();
        }

        this.oldKey = this.key;

        const xMap = Math.floor(x / (this.map.tilewidth ?? this.defaultTileSize));
        const yMap = Math.floor(y / (this.map.tileheight ?? this.defaultTileSize));
        const key = xMap + yMap * this.map.width;

        if (key === this.key) {
            return;
        }

        this.key = key;

        this.triggerAllProperties();
        this.triggerLayersChange();
    }

    public getCurrentProperties(): Map<string, string | boolean | number> {
        return this.lastProperties;
    }

    public clearCurrentProperties(): void {
        return this.lastProperties.clear();
    }

    public getMap(): ITiledMap {
        return this.map;
    }

    /**
     * Registers a callback called when the user moves to a tile where the property propName is different from the last tile the user was on.
     */
    public onPropertyChange(propName: string, callback: PropertyChangeCallback) {
        let callbacksArray = this.propertiesChangeCallbacks.get(propName);
        if (callbacksArray === undefined) {
            callbacksArray = new Array<PropertyChangeCallback>();
            this.propertiesChangeCallbacks.set(propName, callbacksArray);
        }
        callbacksArray.push(callback);
    }

    /**
     * Registers a callback called when the user moves inside another layer.
     */
    public onEnterLayer(callback: layerChangeCallback) {
        this.enterLayerCallbacks.push(callback);
    }

    /**
     * Registers a callback called when the user moves outside another layer.
     */
    public onLeaveLayer(callback: layerChangeCallback) {
        this.leaveLayerCallbacks.push(callback);
    }

    /**
     * Registers a callback called when the user moves inside another area.
     */
    public onEnterArea(callback: areaChangeCallback) {
        this.enterAreaCallbacks.push(callback);
    }

    /**
     * Registers a callback called when the user moves outside another area.
     */
    public onLeaveArea(callback: areaChangeCallback) {
        this.leaveAreaCallbacks.push(callback);
    }

    public findLayer(layerName: string): ITiledMapLayer | undefined {
        return this.flatLayers.find((layer) => layer.name === layerName);
    }

    public findObject(objectName: string, objectClass?: string): ITiledMapObject | undefined {
        const object = this.getObjectWithName(objectName);
        return !objectClass ? object : objectClass === object?.class ? object : undefined;
    }

    public findPhaserLayer(layerName: string): TilemapLayer | undefined {
        return this.phaserLayers.find((layer) => layer.layer.name === layerName);
    }

    public findPhaserLayers(groupName: string): TilemapLayer[] {
        return this.phaserLayers.filter((l) => l.layer.name.includes(groupName));
    }

    public addTerrain(terrain: Phaser.Tilemaps.Tileset): void {
        for (const phaserLayer of this.phaserLayers) {
            phaserLayer.tileset.push(terrain);
        }
    }

    public putTile(tile: string | number | null, x: number, y: number, layer: string): void {
        const phaserLayer = this.findPhaserLayer(layer);
        if (phaserLayer) {
            if (tile === null) {
                phaserLayer.putTileAt(-1, x, y);
                return;
            }
            const tileIndex = this.getIndexForTileType(tile);
            if (tileIndex !== undefined) {
                this.putTileInFlatLayer(tileIndex, x, y, layer);
                const phaserTile = phaserLayer.putTileAt(tileIndex, x, y);
                for (const property of this.getTileProperty(tileIndex)) {
                    if (property.name === GameMapProperties.COLLIDES && property.value) {
                        phaserTile.setCollision(true);
                    }
                }
            } else {
                console.error("The tile '" + tile + "' that you want to place doesn't exist.");
            }
        } else {
            console.error("The layer '" + layer + "' does not exist (or is not a tilelaye).");
        }
    }

    public setLayerProperty(
        layerName: string,
        propertyName: string,
        propertyValue: string | number | undefined | boolean
    ) {
        const layer = this.findLayer(layerName);
        if (layer === undefined) {
            console.warn('Could not find layer "' + layerName + '" when calling setProperty');
            return;
        }
        this.setProperty(layer, propertyName, propertyValue);
        this.triggerAllProperties();
        this.triggerLayersChange();
    }

    public setAreaProperty(
        areaName: string,
        areaType: AreaType,
        propertyName: string,
        propertyValue: string | number | undefined | boolean
    ) {
        const area = this.getAreaByName(areaName, areaType);
        if (area === undefined) {
            console.warn('Could not find area "' + areaName + '" when calling setProperty');
            return;
        }
        this.setProperty(area, propertyName, propertyValue);
        this.triggerAllProperties();
        this.triggerAreasChange();
    }

    public getAreas(areaType: AreaType): ITiledMapRectangleObject[] {
        return areaType === AreaType.Dynamic ? this.dynamicAreas : this.staticAreas;
    }

    private setProperty(
        holder: { properties?: ITiledMapProperty[] },
        propertyName: string,
        propertyValue: string | number | undefined | boolean
    ): void {
        if (holder.properties === undefined) {
            holder.properties = [];
        }
        const property = holder.properties.find((property) => property.name === propertyName);
        if (property === undefined) {
            if (propertyValue === undefined) {
                return;
            }
            if (typeof propertyValue === "string") {
                holder.properties.push({ name: propertyName, type: "string", value: propertyValue });
            } else if (typeof propertyValue === "number") {
                holder.properties.push({ name: propertyName, type: "float", value: propertyValue });
            } else {
                holder.properties.push({ name: propertyName, type: "bool", value: propertyValue });
            }
            return;
        }
        if (propertyValue === undefined) {
            const index = holder.properties.indexOf(property);
            holder.properties.splice(index, 1);
        }
        property.value = propertyValue;
    }

    /**
     * Trigger all the callbacks (used when exiting a map)
     */
    public triggerExitCallbacks(): void {
        const emptyProps = new Map<string, string | boolean | number>();
        for (const [oldPropName, oldPropValue] of this.lastProperties.entries()) {
            // We found a property that disappeared
            this.trigger(oldPropName, oldPropValue, undefined, emptyProps);
        }
    }

    public getRandomPositionFromLayer(layerName: string): { x: number; y: number } {
        const layer = this.findLayer(layerName) as ITiledMapTileLayer;
        if (!layer) {
            throw new Error(`No layer "${layerName}" was found`);
        }
        const tiles = layer.data;
        if (!tiles) {
            throw new Error(`No tiles in "${layerName}" were found`);
        }
        if (typeof tiles === "string") {
            throw new Error("The content of a JSON map must be filled as a JSON array, not as a string");
        }
        const possiblePositions: { x: number; y: number }[] = [];
        tiles.forEach((objectKey: number, key: number) => {
            if (objectKey === 0) {
                return;
            }
            possiblePositions.push({ x: key % layer.width, y: Math.floor(key / layer.width) });
        });
        if (possiblePositions.length > 0) {
            return MathUtils.randomFromArray(possiblePositions);
        }
        throw new Error("No possible position found");
    }

    public getObjectProperty(
        object: { properties?: ITiledMapProperty[] },
        propertyName: string
    ): string | boolean | number | undefined {
        const properties: ITiledMapProperty[] | undefined = object.properties;
        if (!properties) {
            return undefined;
        }
        const obj = properties.find(
            (property: ITiledMapProperty) => property.name.toLowerCase() === propertyName.toLowerCase()
        );
        if (obj === undefined) {
            return undefined;
        }
        return obj.value as string | boolean | number | undefined;
    }

    public getObjectWithName(name: string): ITiledMapObject | undefined {
        return this.tiledObjects.find((object) => object.name === name);
    }

    public addArea(area: ITiledMapRectangleObject, type: AreaType): void {
        this.getAreas(type).push(area);

        if (this.isPlayerInsideAreaByName(area.name, type)) {
            this.triggerSpecificAreaOnEnter(area);
        }
    }

    public triggerSpecificAreaOnEnter(area: ITiledMapRectangleObject): void {
        for (const callback of this.enterAreaCallbacks) {
            callback([area], []);
        }
    }

    public triggerSpecificAreaOnLeave(area: ITiledMapRectangleObject): void {
        for (const callback of this.leaveAreaCallbacks) {
            callback([area], []);
        }
    }

    public getAreaByName(name: string, type: AreaType): ITiledMapRectangleObject | undefined {
        return this.getAreas(type).find((area) => area.name === name);
    }

    public getArea(id: number, type: AreaType): ITiledMapRectangleObject | undefined {
        return this.getAreas(type).find((area) => area.id === id);
    }

    public updateAreaByName(name: string, type: AreaType, config: Partial<ITiledMapObject>): void {
        const area = this.getAreaByName(name, type);
        if (!area) {
            return;
        }
        this.updateArea(area, config);

        if (this.isPlayerInsideAreaByName(name, type)) {
            this.triggerSpecificAreaOnEnter(area);
        }
    }

    public updateAreaById(id: number, type: AreaType, config: Partial<ITiledMapRectangleObject>): void {
        const area = this.getArea(id, type);
        if (!area) {
            return;
        }
        this.updateArea(area, config);

        if (this.isPlayerInsideArea(id, type)) {
            this.triggerSpecificAreaOnEnter(area);
        }
    }

    private updateArea(area: ITiledMapRectangleObject, config: Partial<ITiledMapObject>): void {
        if (config.x !== undefined) {
            area.x = config.x;
        }
        if (config.y !== undefined) {
            area.y = config.y;
        }
        if (config.width !== undefined) {
            area.width = config.width;
        }
        if (config.height !== undefined) {
            area.height = config.height;
        }
    }

    public deleteAreaByName(name: string, type: AreaType): void {
        const area = this.getAreasOnPosition(this.position, this.areasPositionOffsetY, type).find(
            (area) => area.name === name
        );
        if (area) {
            this.triggerSpecificAreaOnLeave(area);
        }
        const areas = this.getAreas(type);
        const index = areas.findIndex((area) => area.name === name);
        if (index !== -1) {
            areas.splice(index, 1);
        }
    }

    public deleteAreaById(id: number, type: AreaType): void {
        const area = this.getAreasOnPosition(this.position, this.areasPositionOffsetY, type).find(
            (area) => area.id === id
        );
        if (area) {
            this.triggerSpecificAreaOnLeave(area);
        }
        const areas = this.getAreas(type);
        const index = areas.findIndex((area) => area.id === id);
        if (index !== -1) {
            areas.splice(index, 1);
        }
    }

    public isPlayerInsideArea(id: number, type: AreaType): boolean {
        return (
            this.getAreasOnPosition(this.position, this.areasPositionOffsetY, type).findIndex(
                (area) => area.id === id
            ) !== -1
        );
    }

    public isPlayerInsideAreaByName(name: string, type: AreaType): boolean {
        return (
            this.getAreasOnPosition(this.position, this.areasPositionOffsetY, type).findIndex(
                (area) => area.name === name
            ) !== -1
        );
    }

    private getLayersByKey(key: number): Array<ITiledMapLayer> {
        return this.flatLayers.filter((flatLayer) => flatLayer.type === "tilelayer" && flatLayer.data[key] !== 0);
    }

    private triggerAllProperties(): void {
        const newProps = this.getProperties(this.key ?? 0);
        const oldProps = this.lastProperties;
        this.lastProperties = newProps;

        // Let's compare the 2 maps:
        // First new properties vs oldProperties
        for (const [newPropName, newPropValue] of newProps.entries()) {
            const oldPropValue = oldProps.get(newPropName);
            if (oldPropValue !== newPropValue) {
                this.trigger(newPropName, oldPropValue, newPropValue, newProps);
            }
        }

        for (const [oldPropName, oldPropValue] of oldProps.entries()) {
            if (!newProps.has(oldPropName)) {
                // We found a property that disappeared
                this.trigger(oldPropName, oldPropValue, undefined, newProps);
            }
        }
    }

    private getLayerCollisionGrid(layer: TilemapLayer): (1 | 2 | 0)[][] {
        let isExitLayer = false;
        for (const property of layer.layer.properties as { [key: string]: string | number | boolean }[]) {
            if (property.name && property.name === "exitUrl") {
                isExitLayer = true;
                break;
            }
        }
        return layer.layer.data.map((row) =>
            row.map((tile) =>
                tile.properties?.[GameMapProperties.COLLIDES]
                    ? 1
                    : isExitLayer ||
                      tile.properties[GameMapProperties.EXIT_URL] ||
                      tile.properties[GameMapProperties.EXIT_SCENE_URL]
                    ? 2
                    : 0
            )
        );
    }

    private triggerLayersChange(): void {
        const layersByOldKey = this.oldKey ? this.getLayersByKey(this.oldKey) : [];
        const layersByNewKey = this.key ? this.getLayersByKey(this.key) : [];

        const enterLayers = new Set(layersByNewKey);
        const leaveLayers = new Set(layersByOldKey);

        enterLayers.forEach((layer) => {
            if (leaveLayers.has(layer)) {
                leaveLayers.delete(layer);
                enterLayers.delete(layer);
            }
        });

        if (enterLayers.size > 0) {
            const layerArray = Array.from(enterLayers);
            for (const callback of this.enterLayerCallbacks) {
                callback(layerArray, layersByNewKey);
            }
        }

        if (leaveLayers.size > 0) {
            const layerArray = Array.from(leaveLayers);
            for (const callback of this.leaveLayerCallbacks) {
                callback(layerArray, layersByNewKey);
            }
        }
    }

    /**
     * We use Tiled Objects with type "area" as areas with defined x, y, width and height for easier event triggering.
     * @returns If there were any areas changes
     */
    private triggerAreasChange(): boolean {
        const areasByOldPosition = this.getAreasOnPosition(this.oldPosition, this.areasPositionOffsetY);
        const areasByNewPosition = this.getAreasOnPosition(this.position, this.areasPositionOffsetY);

        const enterAreas = new Set(areasByNewPosition);
        const leaveAreas = new Set(areasByOldPosition);

        enterAreas.forEach((area) => {
            if (leaveAreas.has(area)) {
                leaveAreas.delete(area);
                enterAreas.delete(area);
            }
        });

        let areasChange = false;
        if (enterAreas.size > 0) {
            const areasArray = Array.from(enterAreas);

            for (const callback of this.enterAreaCallbacks) {
                callback(areasArray, areasByNewPosition);
            }
            areasChange = true;
        }

        if (leaveAreas.size > 0) {
            const areasArray = Array.from(leaveAreas);
            for (const callback of this.leaveAreaCallbacks) {
                callback(areasArray, areasByNewPosition);
            }
            areasChange = true;
        }
        return areasChange;
    }

    private getProperties(key: number): Map<string, string | boolean | number> {
        const properties = new Map<string, string | boolean | number>();

        for (const area of this.getAreasOnPosition(this.position, this.areasPositionOffsetY)) {
            if (area.properties !== undefined) {
                for (const property of area.properties) {
                    if (property.value === undefined) {
                        continue;
                    }
                    properties.set(property.name, property.value as string | number | boolean);
                }
            }
        }

        for (const layer of this.flatLayers) {
            if (layer.type !== "tilelayer") {
                continue;
            }

            let tileIndex: number | undefined = undefined;
            if (layer.data) {
                const tiles = layer.data as number[];
                if (tiles[key] == 0) {
                    continue;
                }
                tileIndex = tiles[key];
            }

            // There is a tile in this layer, let's embed the properties
            if (layer.properties !== undefined) {
                for (const layerProperty of layer.properties) {
                    if (layerProperty.value === undefined) {
                        continue;
                    }
                    properties.set(layerProperty.name, layerProperty.value as string | number | boolean);
                }
            }

            if (tileIndex) {
                this.tileSetPropertyMap[tileIndex]?.forEach((property) => {
                    if (property.value) {
                        properties.set(property.name, property.value as string | number | boolean);
                    } else if (properties.has(property.name)) {
                        properties.delete(property.name);
                    }
                });
            }
        }

        return properties;
    }

    private getAreasOnPosition(
        position?: { x: number; y: number },
        offsetY = 0,
        areaType?: AreaType
    ): ITiledMapRectangleObject[] {
        if (!position) {
            return [];
        }
        const areasOfInterest = areaType
            ? this.getAreas(areaType).values()
            : [...this.staticAreas.values(), ...this.dynamicAreas.values()];

        const overlappedAreas: ITiledMapRectangleObject[] = [];
        for (const area of areasOfInterest) {
            if (MathUtils.isOverlappingWithRectangle({ x: position.x, y: position.y + offsetY }, area)) {
                overlappedAreas.push(area);
            }
        }
        return overlappedAreas;
    }

    private getTileProperty(index: number): Array<ITiledMapProperty> {
        if (this.tileSetPropertyMap[index]) {
            return this.tileSetPropertyMap[index];
        }
        return [];
    }

    private trigger(
        propName: string,
        oldValue: string | number | boolean | undefined,
        newValue: string | number | boolean | undefined,
        allProps: Map<string, string | boolean | number>
    ) {
        const callbacksArray = this.propertiesChangeCallbacks.get(propName);
        if (callbacksArray !== undefined) {
            for (const callback of callbacksArray) {
                callback(newValue, oldValue, allProps);
            }
        }
    }

    private putTileInFlatLayer(index: number, x: number, y: number, layer: string): void {
        const fLayer = this.findLayer(layer);
        if (fLayer == undefined) {
            console.error("The layer '" + layer + "' that you want to change doesn't exist.");
            return;
        }
        if (fLayer.type !== "tilelayer") {
            console.error(
                "The layer '" +
                    layer +
                    "' that you want to change is not a tilelayer. Tile can only be put in tilelayer."
            );
            return;
        }
        if (typeof fLayer.data === "string") {
            console.error("Data of the layer '" + layer + "' that you want to change is only readable.");
            return;
        }
        fLayer.data[x + y * fLayer.width] = index;
    }

    private getIndexForTileType(tile: string | number): number | undefined {
        if (typeof tile == "number") {
            return tile;
        }
        return this.tileNameMap.get(tile);
    }

    private static getObjectsFromLayers(layers: ITiledMapLayer[]): ITiledMapObject[] {
        const objects: ITiledMapObject[] = [];

        const objectLayers = layers.filter((layer) => layer.type === "objectgroup");
        for (const objectLayer of objectLayers) {
            if (objectLayer.type === "objectgroup") {
                objects.push(...objectLayer.objects);
            }
        }

        return objects;
    }
}
