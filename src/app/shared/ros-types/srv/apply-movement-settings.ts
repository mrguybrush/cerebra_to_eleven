import {MovementSettingsMessage} from "../msg/movement-settings-message";

export interface ApplyMovementSettingsRequest {
    movement_settings: MovementSettingsMessage;
}

export interface ApplyMovementSettingsResponse {
    settings_applied: boolean;
    settings_persisted: boolean;
}
