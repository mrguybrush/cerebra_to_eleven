import {
    AfterViewInit,
    Component,
    ElementRef,
    OnInit,
    ViewChild,
} from "@angular/core";
import {ApiService} from "src/app/shared/services/api.service";
import {UrlConstants} from "src/app/shared/services/url.constants";
import {RosService} from "src/app/shared/services/ros-service/ros.service";
import * as QRCode from "qrcode";

// Fullscreen QR is drawn at this pixel resolution and then CSS-scaled to
// fill the viewport (image-rendering: pixelated keeps the modules crisp) -
// high enough that even on a large screen it stays sharp when blown up.
const FULLSCREEN_QR_RESOLUTION = 1000;

@Component({
    selector: "app-ip-retriever",
    templateUrl: "./ip-retriever.component.html",
    styleUrls: ["./ip-retriever.component.scss"],
})
export class IpRetrieverComponent implements OnInit, AfterViewInit {
    @ViewChild("qrCanvas") qrCanvas?: ElementRef<HTMLCanvasElement>;
    @ViewChild("qrCanvasFullscreen") qrCanvasFullscreen?: ElementRef<HTMLCanvasElement>;

    hostIp: string = "";
    fullscreen = false;

    constructor(
        private apiService: ApiService,
        private rosService: RosService,
    ) {}

    ngOnInit() {
        this.apiService.get(UrlConstants.HOST_IP).subscribe({
            next: (response) => {
                this.hostIp = response.host_ip;
                this.renderInlineQrCode();
            },
            error: (err) => {
                console.log(err.error.error);
            },
        });
    }

    ngAfterViewInit(): void {
        this.renderInlineQrCode();
    }

    /** Klick auf den kleinen QR-Code: bildschirmfuellendes Overlay oeffnen
     * UND gleichzeitig denselben QR-Code auf pibs Display zeigen, damit man
     * ihn direkt am Roboter scannen kann. Nochmaliger Klick (auf das
     * Overlay) schliesst es wieder. */
    toggleFullscreen(): void {
        this.fullscreen = !this.fullscreen;
        if (this.fullscreen) {
            this.rosService.showIpOverlayOnDisplay();
            // Das Overlay-Canvas existiert erst nach dieser Aenderung im DOM
            // (*ngIf) - Angulars Change Detection muss es erst einfuegen,
            // bevor @ViewChild darauf zeigt.
            setTimeout(() => this.renderFullscreenQrCode());
        }
    }

    private renderInlineQrCode(): void {
        if (!this.hostIp || !this.qrCanvas) {
            return;
        }
        QRCode.toCanvas(this.qrCanvas.nativeElement, `http://${this.hostIp}/`, {
            width: 96,
        });
    }

    private renderFullscreenQrCode(): void {
        if (!this.hostIp || !this.qrCanvasFullscreen) {
            return;
        }
        QRCode.toCanvas(
            this.qrCanvasFullscreen.nativeElement,
            `http://${this.hostIp}/`,
            {width: FULLSCREEN_QR_RESOLUTION, margin: 2},
        );
    }
}
