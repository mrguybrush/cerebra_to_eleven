import {Component, OnDestroy, OnInit} from "@angular/core";
import {Subscription, interval, startWith, switchMap} from "rxjs";
import {SystemSettingsService} from "src/app/shared/services/system-settings.service";
import {SystemInfo} from "src/app/shared/types/system-info";

const POLL_INTERVAL_MS = 3000;

// Ab hier gilt die Temperatur als bedenklich/kritisch (Pi 5 drosselt sich
// selbst bei ca. 80-85 Grad) - rein fuers Einfaerben der Anzeige, keine
// Fachgrenzen.
const TEMP_WARN_C = 65;
const TEMP_CRITICAL_C = 75;

@Component({
    selector: "app-diagnose",
    templateUrl: "./diagnose.component.html",
    styleUrls: ["./diagnose.component.scss"],
})
export class DiagnoseComponent implements OnInit, OnDestroy {
    info: SystemInfo | null = null;
    loadFailed = false;

    private pollSubscription?: Subscription;

    constructor(private systemSettingsService: SystemSettingsService) {}

    ngOnInit(): void {
        this.pollSubscription = interval(POLL_INTERVAL_MS)
            .pipe(
                startWith(0),
                switchMap(() => this.systemSettingsService.getSystemInfo()),
            )
            .subscribe({
                next: (info) => {
                    this.info = info;
                    this.loadFailed = false;
                },
                error: () => {
                    this.loadFailed = true;
                },
            });
    }

    ngOnDestroy(): void {
        this.pollSubscription?.unsubscribe();
    }

    formatGigabytes(bytes: number): string {
        return (bytes / 1024 ** 3).toFixed(1);
    }

    temperatureClass(celsius: number | null): string {
        if (celsius === null) return "";
        if (celsius >= TEMP_CRITICAL_C) return "value-critical";
        if (celsius >= TEMP_WARN_C) return "value-warn";
        return "value-ok";
    }

    usagePercentClass(percent: number): string {
        if (percent >= 90) return "value-critical";
        if (percent >= 75) return "value-warn";
        return "value-ok";
    }
}
