import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, map, tap} from "rxjs";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {RosService} from "./ros-service/ros.service";
import {FacialExpression} from "../types/facial-expression";

/**
 * Verwaltet benutzerdefinierte Gesichtsausdruecke (Name + hochgeladene
 * GIF-Datei) - siehe die Verwaltungsseite "Gesichtsausdruecke". Anders als
 * die fest einprogrammierten Emotionen (siehe pose.component.ts) werden
 * diese nicht ueber eine feste ImageId angezeigt, sondern indem die
 * rohen GIF-Bytes direkt per ROS-Topic geschickt werden (ImageId.CUSTOM,
 * siehe ros.service.ts setCustomDisplayImage).
 */
@Injectable({
    providedIn: "root",
})
export class FacialExpressionService {
    expressionsSubject: BehaviorSubject<FacialExpression[]> = new BehaviorSubject<
        FacialExpression[]
    >([]);

    constructor(
        private apiService: ApiService,
        private rosService: RosService,
    ) {
        this.loadExpressions();
    }

    loadExpressions() {
        this.apiService
            .get(UrlConstants.FACIAL_EXPRESSIONS)
            .pipe(
                map(
                    (dto) =>
                        (dto["facialExpressions"] ?? []) as FacialExpression[],
                ),
            )
            .subscribe((expressions) => this.expressionsSubject.next(expressions));
    }

    create(name: string, gifFile: File | Blob): Observable<FacialExpression> {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("file", gifFile);
        return this.apiService
            .postFile(UrlConstants.FACIAL_EXPRESSIONS, formData)
            .pipe(tap(() => this.loadExpressions()));
    }

    rename(expressionId: string, name: string): Observable<FacialExpression> {
        return this.apiService
            .patch(`${UrlConstants.FACIAL_EXPRESSIONS}/${expressionId}`, {name})
            .pipe(tap(() => this.loadExpressions()));
    }

    replaceGif(expressionId: string, gifFile: File | Blob): Observable<void> {
        const formData = new FormData();
        formData.append("file", gifFile);
        return this.apiService.putFile(
            `${UrlConstants.FACIAL_EXPRESSIONS}/${expressionId}/gif`,
            formData,
        );
    }

    delete(expressionId: string): Observable<void> {
        return this.apiService
            .delete(`${UrlConstants.FACIAL_EXPRESSIONS}/${expressionId}`)
            .pipe(tap(() => this.loadExpressions()));
    }

    /** Persistiert die Drag&Drop-Reihenfolge in der Verwaltungsseite. */
    reorder(previousIndex: number, currentIndex: number) {
        const expressions = this.expressionsSubject.value.slice();
        const [moved] = expressions.splice(previousIndex, 1);
        expressions.splice(currentIndex, 0, moved);
        this.expressionsSubject.next(expressions);
        this.apiService
            .put(`${UrlConstants.FACIAL_EXPRESSIONS}/order`, {
                expressionIds: expressions.map((e) => e.expressionId),
            })
            .subscribe();
    }

    /** Vorschau-URL fuer die Kachelansicht (<img src="...">). */
    previewUrl(expressionId: string): string {
        return `${this.apiService.baseUrl}${UrlConstants.FACIAL_EXPRESSIONS}/${expressionId}/gif`;
    }

    /** Laedt die GIF-Bytes und zeigt sie sofort auf pibs Display an -
     * genutzt vom "Gesichtsausdruck"-Button auf der Posen-Seite. */
    play(expressionId: string): void {
        this.apiService
            .getBinary(`${UrlConstants.FACIAL_EXPRESSIONS}/${expressionId}/gif`)
            .subscribe((buffer) =>
                this.rosService.setCustomDisplayImage(new Uint8Array(buffer)),
            );
    }
}
