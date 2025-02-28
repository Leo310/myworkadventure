import { IframeApiContribution, sendToWorkadventure } from "./IframeApiContribution";
import { Subject } from "rxjs";
import type { WasCameraUpdatedEvent } from "../Events/WasCameraUpdatedEvent";
import { apiCallback } from "./registeredCallbacks";

const moveStream = new Subject<WasCameraUpdatedEvent>();

export class WorkAdventureCameraCommands extends IframeApiContribution<WorkAdventureCameraCommands> {
    callbacks = [
        apiCallback({
            type: "wasCameraUpdated",
            callback: (payloadData) => {
                moveStream.next(payloadData);
            },
        }),
    ];

    public set(x: number, y: number, width?: number, height?: number, lock = false, smooth = false): void {
        sendToWorkadventure({
            type: "cameraSet",
            data: { x, y, width, height, lock, smooth },
        });
    }

    public followPlayer(smooth = false): void {
        sendToWorkadventure({
            type: "cameraFollowPlayer",
            data: { smooth },
        });
    }

    onCameraUpdate(): Subject<WasCameraUpdatedEvent> {
        sendToWorkadventure({
            type: "onCameraUpdate",
            data: undefined,
        });
        return moveStream;
    }
}

export default new WorkAdventureCameraCommands();
