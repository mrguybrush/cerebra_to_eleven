import {
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    ViewChild,
} from "@angular/core";
import {Subscription} from "rxjs";
import {MotorService} from "src/app/shared/services/motor.service";

const TURN_HEAD_MOTOR = "turn_head_motor"; // Drehung links/rechts
const TILT_FORWARD_MOTOR = "tilt_forward_motor"; // Neigung hoch/runter

// Motor-Kommandos hoechstens alle 100ms senden (10Hz, wie an anderen
// Stellen im Projekt ueblich) - beim Ziehen feuert pointermove viel
// haeufiger, als der ROS-Service sinnvoll verarbeiten muesste.
const SEND_INTERVAL_MS = 100;

/**
 * Kleiner Joystick zum Steuern von Kopfdrehung + -neigung, ohne dafuer in
 * Joint Control wechseln zu muessen - genutzt auf den Seiten Motion Capture
 * und Kamera, wo man beim Zusehen/Aufnehmen oft kurz "umschauen" will.
 *
 * Ablenkung des Knopfes wird direkt proportional auf die Motorposition
 * abgebildet (kein Halten-fuer-Dauerbewegung): volle Ablenkung = Rand des
 * jeweiligen Motor-Rotationsbereichs. Beim Loslassen springt nur der Knopf
 * optisch zur Mitte zurueck - der Kopf bleibt stehen, wo er hingedreht
 * wurde (man will nach dem Umschauen ja genau dorthin weiterschauen).
 */
@Component({
    selector: "app-head-joystick",
    templateUrl: "./head-joystick.component.html",
    styleUrls: ["./head-joystick.component.scss"],
})
export class HeadJoystickComponent implements OnInit, OnDestroy {
    @ViewChild("base") baseRef!: ElementRef<HTMLDivElement>;

    // Knopf-Position in Pixel relativ zur Basis-Mitte, fuer die Anzeige.
    knobX = 0;
    knobY = 0;
    dragging = false;

    private turnRangeMin = -9000;
    private turnRangeMax = 9000;
    private tiltRangeMin = -4500;
    private tiltRangeMax = 4500;
    private radiusPx = 32;
    private lastSendTime = 0;
    private pointerId: number | null = null;
    private subscriptions = new Subscription();

    constructor(private motorService: MotorService) {}

    ngOnInit(): void {
        this.subscriptions.add(
            this.motorService
                .getSettingsObservable(TURN_HEAD_MOTOR)
                .subscribe((settings) => {
                    this.turnRangeMin = settings.rotationRangeMin;
                    this.turnRangeMax = settings.rotationRangeMax;
                }),
        );
        this.subscriptions.add(
            this.motorService
                .getSettingsObservable(TILT_FORWARD_MOTOR)
                .subscribe((settings) => {
                    this.tiltRangeMin = settings.rotationRangeMin;
                    this.tiltRangeMax = settings.rotationRangeMax;
                }),
        );
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    onPointerDown(event: PointerEvent): void {
        this.dragging = true;
        this.pointerId = event.pointerId;
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        this.radiusPx = this.baseRef.nativeElement.clientWidth / 2;
        this.updateFromPointer(event);
        event.preventDefault();
    }

    onPointerMove(event: PointerEvent): void {
        if (!this.dragging || event.pointerId !== this.pointerId) {
            return;
        }
        this.updateFromPointer(event);
    }

    onPointerUp(event: PointerEvent): void {
        if (event.pointerId !== this.pointerId) {
            return;
        }
        this.dragging = false;
        this.pointerId = null;
        // Nur der Knopf springt zurueck - der Kopf bleibt in Position.
        this.knobX = 0;
        this.knobY = 0;
    }

    private updateFromPointer(event: PointerEvent): void {
        const rect = this.baseRef.nativeElement.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = event.clientX - cx;
        let dy = event.clientY - cy;

        const distance = Math.hypot(dx, dy);
        if (distance > this.radiusPx) {
            const scale = this.radiusPx / distance;
            dx *= scale;
            dy *= scale;
        }
        this.knobX = dx;
        this.knobY = dy;

        const normX = dx / this.radiusPx; // -1..1, rechts positiv
        const normY = dy / this.radiusPx; // -1..1, unten positiv (Bildschirm-Konvention)

        const now = Date.now();
        if (now - this.lastSendTime < SEND_INTERVAL_MS) {
            return;
        }
        this.lastSendTime = now;
        this.sendHeadPosition(normX, normY);
    }

    private sendHeadPosition(normX: number, normY: number): void {
        const turnPosition = this.scaleToRange(
            normX,
            this.turnRangeMin,
            this.turnRangeMax,
        );
        // Joystick nach oben (Bildschirm: negatives y) soll den Kopf nach
        // oben neigen - deshalb -normY.
        const tiltPosition = this.scaleToRange(
            -normY,
            this.tiltRangeMin,
            this.tiltRangeMax,
        );
        this.motorService.setPosition(TURN_HEAD_MOTOR, turnPosition).subscribe();
        this.motorService.setPosition(TILT_FORWARD_MOTOR, tiltPosition).subscribe();
    }

    private scaleToRange(norm: number, min: number, max: number): number {
        const half = norm >= 0 ? max : -min;
        return Math.round(norm * half);
    }
}
