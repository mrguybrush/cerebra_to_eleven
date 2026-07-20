import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable} from "rxjs";
import {RosService} from "./ros-service/ros.service";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {MovementSettingsMessage} from "../ros-types/msg/movement-settings-message";

export const DEFAULT_SPEED_PERCENT = 100;
export const MIN_SPEED_PERCENT = 10;
// Absolute Obergrenze, bis zu der die Maximalgeschwindigkeit in den System-
// Einstellungen hochgesetzt werden darf - muss mit MAX_SPEED_PERCENT in
// movement_settings_service.py uebereinstimmen (das Backend setzt die
// eigentliche Grenze durch, das hier ist nur fuer den Slider-Anschlag).
export const ABSOLUTE_MAX_SPEED_PERCENT = 150;

interface MovementSettingsDto {
    speedPercent: number;
    maxSpeedPercent: number;
}

/**
 * Globales Bewegungstempo (10-100%): skaliert die pro Motor konfigurierten
 * velocity/acceleration/deceleration-Werte fuer JEDE Bewegung (manuelle
 * Gelenksteuerung, Posen, Programme) - siehe pib_motors.motor.Motor.
 * movement_speed_percent auf dem Backend.
 *
 * - speedPercent: aktuelles Tempo (angewendet ueber den ROS-Service, damit
 *   es sofort auf die Hardware wirkt und persistiert).
 * - maxSpeedPercent: Sicherheits-Obergrenze (in System-Einstellungen
 *   gesetzt); rein ueber die pib-api gespeichert (kein Hardware-Effekt),
 *   begrenzt aber den Tempo-Regler und wird backend-seitig durchgesetzt.
 */
@Injectable({
    providedIn: "root",
})
export class MovementSettingsService {
    private speedPercentSubject = new BehaviorSubject<number>(
        DEFAULT_SPEED_PERCENT,
    );
    speedPercent$: Observable<number> = this.speedPercentSubject;

    private maxSpeedPercentSubject = new BehaviorSubject<number>(
        DEFAULT_SPEED_PERCENT,
    );
    maxSpeedPercent$: Observable<number> = this.maxSpeedPercentSubject;

    constructor(
        private rosService: RosService,
        private apiService: ApiService,
    ) {
        this.apiService
            .get(UrlConstants.MOVEMENT_SETTINGS)
            .subscribe((dto: MovementSettingsDto) => {
                this.speedPercentSubject.next(dto.speedPercent);
                this.maxSpeedPercentSubject.next(dto.maxSpeedPercent);
            });

        this.rosService.movementSettingsReceiver$.subscribe(
            (message: MovementSettingsMessage) => {
                this.speedPercentSubject.next(message.speed_percent);
            },
        );
    }

    /** Wendet das Tempo an: ueber den ROS-Service, damit es sofort auf die
     * Motoren wirkt UND in die DB persistiert (siehe motor_control.py
     * apply_movement_settings). Wird bewusst nur auf expliziten
     * "Speichern"-Klick aufgerufen, nicht bei jedem Slider-Pixel. */
    setSpeedPercent(speedPercent: number): void {
        this.speedPercentSubject.next(speedPercent);
        this.rosService
            .applyMovementSettings({speed_percent: speedPercent})
            .subscribe();
    }

    /** Setzt die Sicherheits-Obergrenze. Reine pib-api-Aenderung (kein
     * Hardware-Effekt); das Backend zieht ein zu hohes aktuelles Tempo
     * automatisch mit nach unten - der zurueckgelieferte (evtl. gekappte)
     * speedPercent wird lokal uebernommen. */
    setMaxSpeedPercent(maxSpeedPercent: number): void {
        this.maxSpeedPercentSubject.next(maxSpeedPercent);
        this.apiService
            .put(UrlConstants.MOVEMENT_SETTINGS, {maxSpeedPercent})
            .subscribe((dto: MovementSettingsDto) => {
                this.maxSpeedPercentSubject.next(dto.maxSpeedPercent);
                // Wurde das aktuelle Tempo vom Backend gekappt, auch auf der
                // Hardware nachziehen (sonst wuerde erst die naechste
                // Tempo-Aenderung das Limit durchsetzen).
                if (dto.speedPercent !== this.speedPercentSubject.value) {
                    this.setSpeedPercent(dto.speedPercent);
                }
            });
    }
}
