import {Component, Input, OnDestroy, OnInit} from "@angular/core";
import {ActivatedRoute, NavigationStart, Router} from "@angular/router";
import {Observable, Subscription} from "rxjs";
import {SidebarElement} from "src/app/shared/interfaces/sidebar-element.interface";
import {CerebraRegex} from "src/app/shared/types/cerebra-regex";

@Component({
    selector: "app-voice-assistant-nav",
    templateUrl: "./voice-assistant-nav.component.html",
    styleUrls: ["./voice-assistant-nav.component.scss"],
})
export class VoiceAssistantNavComponent implements OnInit, OnDestroy {
    sidebarElements?: SidebarElement[];
    @Input() subject?: Observable<SidebarElement[]>;
    @Input() button?: {enabled: boolean; func: () => void};
    @Input() defaultRoute?: string;

    // Without unsubscribing, these outlive the component: leaving
    // /voice-assistant for any other page does NOT stop them, so a later,
    // unrelated personalitiesSubject emission (e.g. triggered from another
    // page) still runs this callback and force-navigates back to
    // /voice-assistant out from under the user - see defaultRoute below.
    private subscriptions = new Subscription();

    constructor(
        private router: Router,
        private route: ActivatedRoute,
    ) {}

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    ngOnInit(): void {
        this.subscriptions.add(this.router.events.subscribe((event) => {
            if (event instanceof NavigationStart) {
                if (
                    RegExp("/voice-assistant/" + CerebraRegex.UUID).test(
                        this.router.url,
                    ) &&
                    event.url === "/voice-assistant"
                ) {
                    if (
                        this.sidebarElements &&
                        this.sidebarElements.length > 0
                    ) {
                        this.router.navigate(
                            [this.sidebarElements[0].getUUID(), "chat"],
                            {relativeTo: this.route},
                        );
                    }
                }
            }
        }));

        this.subscriptions.add(
            this.subject?.subscribe((elements) => {
                // Defense in depth on top of the unsubscribe above: this
                // component's whole job is redirecting within
                // /voice-assistant, so it must never navigate anywhere from
                // a route it doesn't own (e.g. a stray/late emission
                // arriving while the user is on a different page).
                if (!this.router.url.startsWith("/voice-assistant")) {
                    this.sidebarElements = elements;
                    return;
                }
                const diff = elements.length - (this.sidebarElements?.length ?? 0);
                const len = this.sidebarElements?.length ?? 0;
                this.sidebarElements = elements;
                if (len == 0 && elements.length > 0) {
                    this.router.navigate(
                        [this.sidebarElements[0].getUUID(), "chat"],
                        {
                            relativeTo: this.route,
                        },
                    );
                } else if (diff > 0 && len != 0) {
                    this.router.navigate(
                        [
                            this.sidebarElements[
                                this.sidebarElements.length - 1
                            ].getUUID(),
                            "chat",
                        ],
                        {relativeTo: this.route},
                    );
                } else if (this.getRedirectRoute()) {
                    this.router.navigate([this.getRedirectRoute()], {
                        relativeTo: this.route,
                    });
                } else {
                    this.router.navigate([this.defaultRoute]);
                }
            }),
        );
    }

    getRedirectRoute(): string | undefined {
        const routerUuid: string | undefined = this.router.url
            .split("/")
            .find((segment) => RegExp(CerebraRegex.UUID).test(segment));
        if (routerUuid && this.sidebarElements) {
            const elem = this.sidebarElements.find((sidebarElement) =>
                RegExp(routerUuid).test(sidebarElement.getUUID()),
            );
            if (!elem && this.sidebarElements.length > 0) {
                return this.sidebarElements[0].getUUID();
            } else if (elem) {
                return elem.getUUID();
            }
        }
        return undefined;
    }

    isRouteActive(currentId: string): boolean {
        const routerUrl = this.router.url;
        return routerUrl.includes(currentId);
    }
}
