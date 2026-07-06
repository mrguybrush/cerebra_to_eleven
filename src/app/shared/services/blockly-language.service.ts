import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import * as Blockly from "blockly";
import {
    DEFAULT_LOCALE_CODE,
    PIB_BLOCKLY_LOCALES,
    PibBlocklyLocale,
} from "../../program/pib-blockly/i18n/pib-blockly-locales";

const STORAGE_KEY = "pib.blocklyLanguage";

/**
 * Holds the currently selected Blockly language and applies it globally.
 * The choice is a UI display preference, so it lives in localStorage
 * (per browser) rather than in the robot DB - no backend involved.
 *
 * Applying a locale (a) sets the built-in Blockly messages via
 * Blockly.setLocale and (b) merges pib's own PIB_* messages into
 * Blockly.Msg, from where both the custom blocks (via %{BKY_PIB_...}
 * references) and the toolbox category names read them. Callers that host a
 * live workspace should subscribe to currentCode$ and re-render on change,
 * since already-rendered blocks don't re-read their labels automatically.
 */
@Injectable({
    providedIn: "root",
})
export class BlocklyLanguageService {
    readonly locales = PIB_BLOCKLY_LOCALES;
    currentCode$ = new BehaviorSubject<string>(this.readStored());

    constructor() {
        // Apply immediately so the very first workspace render is correct.
        this.apply(this.currentCode$.value);
    }

    getLocale(code: string): PibBlocklyLocale {
        return (
            this.locales.find((l) => l.code === code) ??
            this.locales.find((l) => l.code === DEFAULT_LOCALE_CODE) ??
            this.locales[0]
        );
    }

    setLanguage(code: string): void {
        if (code === this.currentCode$.value) {
            return;
        }
        localStorage.setItem(STORAGE_KEY, code);
        this.apply(code);
        this.currentCode$.next(code);
    }

    /** Reads a PIB_* message at the current locale (fallback: the key). */
    msg(key: string): string {
        return (Blockly.Msg as {[k: string]: string})[key] ?? key;
    }

    private apply(code: string): void {
        const locale = this.getLocale(code);
        // Built-in blocks (Logic/Loops/Math/...).
        (Blockly as any).setLocale(locale.blocklyPack);
        // pib's own labels/tooltips/categories.
        Object.assign(Blockly.Msg, locale.messages);
    }

    private readStored(): string {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && this.locales.some((l) => l.code === stored)) {
            return stored;
        }
        return DEFAULT_LOCALE_CODE;
    }
}
