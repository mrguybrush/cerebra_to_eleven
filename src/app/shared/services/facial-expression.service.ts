import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, map, tap} from "rxjs";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {RosService} from "./ros-service/ros.service";
import {FacialExpression} from "../types/facial-expression";

/**
 * Verwaltet benutzerdefinierte Gesichtsausdruecke (Name + hochgeladene
 * GIF-/PNG-/JPG-Datei) - siehe die Verwaltungsseite "Gesichtsausdruecke".
 * Anders als die fest einprogrammierten Emotionen (siehe pose.component.ts)
 * werden diese nicht ueber eine feste ImageId angezeigt, sondern indem die
 * rohen Bild-Bytes direkt per ROS-Topic geschickt werden (ImageId.CUSTOM,
 * siehe ros.service.ts setCustomDisplayImage) - animierte GIFs UND
 * statische PNG/JPEG werden beide unterstuetzt (Format wird anhand der
 * Magic-Bytes erkannt, siehe detectImageFormatValue unten).
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

    /** Laedt die Bild-Bytes und zeigt sie sofort auf pibs Display an -
     * genutzt vom "Gesichtsausdruck"-Button auf der Posen-Seite. */
    play(expressionId: string): void {
        this.apiService
            .getBinary(`${UrlConstants.FACIAL_EXPRESSIONS}/${expressionId}/gif`)
            .subscribe((buffer) => {
                const bytes = new Uint8Array(buffer);
                this.rosService.setCustomDisplayImage(
                    bytes,
                    detectImageFormatValue(bytes),
                );
            });
    }
}

/** ImageFormat.msg: ANIMATED_GIF=0, PNG=1, JPEG=2 - erkannt anhand der
 * Magic-Bytes am Dateianfang (dieselbe Logik wie
 * facial_expression_controller.py's _detect_mimetype). */
function detectImageFormatValue(bytes: Uint8Array): number {
    const startsWith = (magic: number[]) =>
        magic.every((byte, i) => bytes[i] === byte);
    if (startsWith([0x47, 0x49, 0x46, 0x38])) {
        // "GIF8" (87a oder 89a)
        return 0;
    }
    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return 1;
    }
    if (startsWith([0xff, 0xd8, 0xff])) {
        return 2;
    }
    return 0;
}
