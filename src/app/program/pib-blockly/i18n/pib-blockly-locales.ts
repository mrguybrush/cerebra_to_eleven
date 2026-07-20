/**
 * Translations for the Blockly programming surface: toolbox category names,
 * pib's custom block labels/tooltips, and motor/option names.
 *
 * All keys are prefixed PIB_ and go into the global Blockly.Msg table (see
 * BlocklyLanguageService). Custom JSON blocks reference them as
 * "%{BKY_PIB_...}" in message0/tooltip/dropdown text - Blockly resolves
 * those per block instance from Blockly.Msg, so switching language just
 * means repopulating Blockly.Msg and re-rendering. Built-in blocks
 * (Logic/Loops/Math/...) are translated separately via Blockly.setLocale
 * with the matching blockly/msg/* pack.
 *
 * Adding a language = add one entry to PIB_BLOCKLY_LOCALES with its
 * blockly/msg pack and a full message map. Nothing else needs to change.
 */
import * as BlocklyEn from "blockly/msg/en";
import * as BlocklyDe from "blockly/msg/de";

export interface PibBlocklyLocale {
    code: string;
    /** Human-readable name shown in the language selector. */
    label: string;
    /** The blockly/msg/* pack for the built-in blocks. */
    blocklyPack: {[key: string]: string};
    /** pib-specific PIB_* messages. */
    messages: {[key: string]: string};
}

const EN_MESSAGES: {[key: string]: string} = {
    // Toolbox categories
    PIB_CAT_LOGIC: "Logic",
    PIB_CAT_LOOPS: "Loops",
    PIB_CAT_MATH: "Math",
    PIB_CAT_TEXT: "Text",
    PIB_CAT_LISTS: "Lists",
    PIB_CAT_COLOUR: "Colour",
    PIB_CAT_TIME: "Time",
    PIB_CAT_VARIABLES: "Variables",
    PIB_CAT_FUNCTIONS: "Functions",
    PIB_CAT_SYSTEM: "System",
    PIB_CAT_MOTORIC: "Motoric skills",
    PIB_CAT_LANGUAGE: "Language skills",
    PIB_CAT_VISUAL: "Visual skills",
    PIB_CAT_BUTTONS: "Buttons",

    // Pose / gesture / movement sequence
    PIB_SET_POSE: "set Pose",

    // Motor block
    PIB_MOVE_MOTOR: "move motor(s)  %1 %2 to %3 position from input %4",
    PIB_MODE_ABSOLUTE: "absolute",
    PIB_MODE_RELATIVE: "relative",

    // Movement speed block
    PIB_SET_MOVEMENT_SPEED: "set movement speed to  %1 %",
    PIB_SET_MOVEMENT_SPEED_TOOLTIP:
        "Sets the global movement speed (10-100%) that scales every motor's configured velocity/acceleration/deceleration for all following movements - place before a 'move to pose'/'move motor(s)' block to slow it down.",

    // Parallel strands
    PIB_WHEN_PROGRAM_STARTS: "when program starts",
    PIB_WHEN_PROGRAM_STARTS_TOOLTIP:
        "Starts its contents as a parallel strand when the program starts. Can be used multiple times - all strands run at the same time.",

    // Time blocks
    PIB_SLEEP_FOR: "Sleep for  %1 seconds",
    PIB_SLEEP_TOOLTIP:
        "Sleeps for specified time. Accepts numbers with a maximum of three decimal places",
    PIB_GET_SYSTEM_TIME: "get system time",
    PIB_GET_SYSTEM_TIME_TOOLTIP:
        "Get the system time in milliseconds from 01. 01. 1970",

    // Solid-state relay
    PIB_SET_RELAY: "set Solid-State Relay:  %1",
    PIB_SET_RELAY_TOOLTIP: "Turns the Solid-State Relay on or off.",
    PIB_GET_RELAY: "Solid-State Relay is on",
    PIB_GET_RELAY_TOOLTIP:
        "Returns whether the Solid-State Relay is currently turned on.",
    PIB_ON: "ON",
    PIB_OFF: "OFF",

    // Play audio from speech
    PIB_AS_SAY: "as  %1 say %2",

    // Face detector
    PIB_FACE_DETECTOR: "Face Detector:  %1",
    PIB_FACE_DETECTOR_TOOLTIP:
        "Starts or stops the face detector, must be placed before and after 'face detector running'",
    PIB_FACE_DETECTOR_RUN:
        "Run the face detector and get the face coordinates %1 Horiz-Center: %2  Vert-Center: %3",
    PIB_FACE_DETECTOR_RUN_TOOLTIP:
        "Runs the face detector and stores the position of the bounding boxes in the variables",
    PIB_START: "start",
    PIB_STOP: "stop",

    // Run script (SSH)
    PIB_RUN_SCRIPT: "Run script %1",
    PIB_RUN_SCRIPT_TOOLTIP:
        "Connects via SSH to a host and runs the given script. Use the gear to edit host/user/password/port.",
    PIB_RUN_SCRIPT_HOST: "host",
    PIB_RUN_SCRIPT_USER: "user",
    PIB_RUN_SCRIPT_PASSWORD: "password",
    PIB_RUN_SCRIPT_PORT: "port",
    PIB_RUN_SCRIPT_CONN_SETTINGS: "connection settings %1 %2",
    PIB_RUN_SCRIPT_CONN_TOOLTIP:
        "Drag the item below in to use custom connection settings.",
    PIB_RUN_SCRIPT_USE_CUSTOM: "use custom connection",
    PIB_RUN_SCRIPT_USE_CUSTOM_TOOLTIP:
        "When present, host/user/password/port fields are shown on the block.",

    // Button blocks
    PIB_ON_BUTTON_PRESSED: "when button  %1 is pressed",
    PIB_ON_BUTTON_PRESSED_TOOLTIP:
        "Runs the contained blocks once each time the selected button is pressed.",
    PIB_BUTTON_IS_PRESSED: "button  %1 is pressed",
    PIB_BUTTON_IS_PRESSED_TOOLTIP:
        "Returns whether the selected button is currently pressed.",
    PIB_SET_BUTTON_COLOR: "set button  %1 colour to %2",
    PIB_SET_BUTTON_COLOR_TOOLTIP: "Sets the LED colour of the selected button.",

    // Motor names
    PIB_MOTOR_THUMB_LEFT_OPPOSITION: "thumb left opposition",
    PIB_MOTOR_THUMB_LEFT_STRETCH: "thumb left stretch",
    PIB_MOTOR_INDEX_LEFT_STRETCH: "index finger left stretch",
    PIB_MOTOR_MIDDLE_LEFT_STRETCH: "middle finger left stretch",
    PIB_MOTOR_RING_LEFT_STRETCH: "ring finger left stretch",
    PIB_MOTOR_PINKY_LEFT_STRETCH: "pinky finger left stretch",
    PIB_MOTOR_ALL_FINGERS_LEFT_STRETCH: "all fingers left",
    PIB_MOTOR_THUMB_RIGHT_OPPOSITION: "thumb right opposition",
    PIB_MOTOR_THUMB_RIGHT_STRETCH: "thumb right stretch",
    PIB_MOTOR_INDEX_RIGHT_STRETCH: "index finger right stretch",
    PIB_MOTOR_MIDDLE_RIGHT_STRETCH: "middle finger right stretch",
    PIB_MOTOR_RING_RIGHT_STRETCH: "ring finger right stretch",
    PIB_MOTOR_PINKY_RIGHT_STRETCH: "pinky finger right stretch",
    PIB_MOTOR_ALL_FINGERS_RIGHT_STRETCH: "all fingers right",
    PIB_MOTOR_UPPER_ARM_LEFT_ROTATION: "upper left arm rotation",
    PIB_MOTOR_ELBOW_LEFT: "elbow left",
    PIB_MOTOR_LOWER_ARM_LEFT_ROTATION: "lower left arm rotation",
    PIB_MOTOR_WRIST_LEFT: "wrist left",
    PIB_MOTOR_SHOULDER_VERTICAL_LEFT: "left shoulder vertical",
    PIB_MOTOR_SHOULDER_HORIZONTAL_LEFT: "left shoulder horizontal",
    PIB_MOTOR_UPPER_ARM_RIGHT_ROTATION: "upper right arm rotation",
    PIB_MOTOR_ELBOW_RIGHT: "elbow right",
    PIB_MOTOR_LOWER_ARM_RIGHT_ROTATION: "lower right arm rotation",
    PIB_MOTOR_WRIST_RIGHT: "wrist right",
    PIB_MOTOR_SHOULDER_VERTICAL_RIGHT: "right shoulder vertical",
    PIB_MOTOR_SHOULDER_HORIZONTAL_RIGHT: "right shoulder horizontal",
    PIB_MOTOR_TILT_FORWARD_HEAD: "tilt head forward",
    PIB_MOTOR_TURN_HEAD: "turn head",

    // Eyes / display
    PIB_SET_EYES: "set eyes to  %1",
    PIB_SET_EYES_TOOLTIP:
        "Shows the selected eye-emotion on pib's display (animated eyes).",
    PIB_EYES_NEUTRAL: "neutral",
    PIB_EYES_HAPPY: "happy",
    PIB_EYES_SAD: "sad",
    PIB_EYES_ANGRY: "angry",
    PIB_EYES_SURPRISED: "surprised",
    PIB_EYES_SLEEPY: "sleepy",
    PIB_EYES_HEART: "in love",
    PIB_EYES_STAR: "starstruck",
    PIB_EYES_COOL: "cool",
    PIB_EYES_WINK: "wink",

    // Play wav
    PIB_PLAY_WAV: "play wav file",
    PIB_PLAY_WAV_TOOLTIP: "plays back a recorded/uploaded wav file",

    // Motor current
    PIB_MOTOR_CURRENT: "motor current of  %1",
    PIB_MOTOR_CURRENT_TOOLTIP:
        "reads the motor's current draw in mA - useful to detect e.g. a blocked joint",

    // Dropdown placeholders shown when no items exist yet
    PIB_NO_POSE_AVAILABLE: "no pose available",
    PIB_CREATE_LIST_VARIABLE: "Create list variable...",

    // Overrides of Blockly-core/plugin context-menu keys (NOT pib's own
    // %{BKY_PIB_...} messages, so no PIB_ prefix - these exact key names
    // are looked up directly by Blockly core / the multiselect plugin).
    // CROSS_TAB_COPY/PASTE: the workspace-multiselect plugin's right-click
    // "Copy"/"Paste" (clipboard, incl. across browser tabs) fall back to a
    // hardcoded English string when these keys are undefined - which they
    // are by default, so they never translated at all before this.
    CROSS_TAB_COPY: "Copy",
    CROSS_TAB_COPY_X_BLOCKS: "Copy %1 Blocks",
    CROSS_TAB_PASTE: "Paste",
    CROSS_TAB_PASTE_X_BLOCKS: "Paste %1 Blocks",
};

const DE_MESSAGES: {[key: string]: string} = {
    // Toolbox-Kategorien
    PIB_CAT_LOGIC: "Logik",
    PIB_CAT_LOOPS: "Schleifen",
    PIB_CAT_MATH: "Mathematik",
    PIB_CAT_TEXT: "Text",
    PIB_CAT_LISTS: "Listen",
    PIB_CAT_COLOUR: "Farbe",
    PIB_CAT_TIME: "Zeit",
    PIB_CAT_VARIABLES: "Variablen",
    PIB_CAT_FUNCTIONS: "Funktionen",
    PIB_CAT_SYSTEM: "System",
    PIB_CAT_MOTORIC: "Motorische Fähigkeiten",
    PIB_CAT_LANGUAGE: "Sprachfähigkeiten",
    PIB_CAT_VISUAL: "Visuelle Fähigkeiten",
    PIB_CAT_BUTTONS: "Buttons",

    // Pose / Geste / Bewegungssequenz
    PIB_SET_POSE: "Pose setzen",

    // Motor-Block
    PIB_MOVE_MOTOR: "bewege Motor(en)  %1 %2 auf %3 Position vom Eingang %4",
    PIB_MODE_ABSOLUTE: "absolut",
    PIB_MODE_RELATIVE: "relativ",

    // Bewegungstempo-Block
    PIB_SET_MOVEMENT_SPEED: "setze Bewegungstempo auf  %1 %",
    PIB_SET_MOVEMENT_SPEED_TOOLTIP:
        "Setzt das globale Bewegungstempo (10-100%), das die konfigurierte velocity/acceleration/deceleration jedes Motors fuer alle folgenden Bewegungen skaliert - vor einen 'Pose setzen'/'bewege Motor(en)'-Block platzieren, um diese Bewegung zu verlangsamen.",

    // Parallele Stränge
    PIB_WHEN_PROGRAM_STARTS: "wenn Programm startet",
    PIB_WHEN_PROGRAM_STARTS_TOOLTIP:
        "Startet seinen Inhalt als parallelen Handlungsstrang, sobald das Programm startet. Kann mehrfach verwendet werden - alle Stränge laufen gleichzeitig.",

    // Zeit-Blöcke
    PIB_SLEEP_FOR: "Warte  %1 Sekunden",
    PIB_SLEEP_TOOLTIP:
        "Wartet für die angegebene Zeit. Akzeptiert Zahlen mit maximal drei Nachkommastellen",
    PIB_GET_SYSTEM_TIME: "Systemzeit abrufen",
    PIB_GET_SYSTEM_TIME_TOOLTIP:
        "Systemzeit in Millisekunden seit dem 01.01.1970 abrufen",

    // Solid-State-Relais
    PIB_SET_RELAY: "Solid-State-Relais setzen:  %1",
    PIB_SET_RELAY_TOOLTIP: "Schaltet das Solid-State-Relais ein oder aus.",
    PIB_GET_RELAY: "Solid-State-Relais ist an",
    PIB_GET_RELAY_TOOLTIP:
        "Gibt zurück, ob das Solid-State-Relais aktuell eingeschaltet ist.",
    PIB_ON: "AN",
    PIB_OFF: "AUS",

    // Sprachausgabe
    PIB_AS_SAY: "als  %1 sage %2",

    // Gesichtserkennung
    PIB_FACE_DETECTOR: "Gesichtserkennung:  %1",
    PIB_FACE_DETECTOR_TOOLTIP:
        "Startet oder stoppt die Gesichtserkennung, muss vor und nach 'Gesichtserkennung ausführen' platziert werden",
    PIB_FACE_DETECTOR_RUN:
        "Gesichtserkennung ausführen und Koordinaten holen %1 Horiz-Mitte: %2  Vert-Mitte: %3",
    PIB_FACE_DETECTOR_RUN_TOOLTIP:
        "Führt die Gesichtserkennung aus und speichert die Position der Begrenzungsrahmen in den Variablen",
    PIB_START: "starten",
    PIB_STOP: "stoppen",

    // Skript ausführen (SSH)
    PIB_RUN_SCRIPT: "Skript ausführen %1",
    PIB_RUN_SCRIPT_TOOLTIP:
        "Verbindet sich per SSH mit einem Host und führt das Skript aus. Über das Zahnrad Host/Benutzer/Passwort/Port bearbeiten.",
    PIB_RUN_SCRIPT_HOST: "Host",
    PIB_RUN_SCRIPT_USER: "Benutzer",
    PIB_RUN_SCRIPT_PASSWORD: "Passwort",
    PIB_RUN_SCRIPT_PORT: "Port",
    PIB_RUN_SCRIPT_CONN_SETTINGS: "Verbindungseinstellungen %1 %2",
    PIB_RUN_SCRIPT_CONN_TOOLTIP:
        "Ziehe das Element hinein, um eigene Verbindungseinstellungen zu nutzen.",
    PIB_RUN_SCRIPT_USE_CUSTOM: "eigene Verbindung verwenden",
    PIB_RUN_SCRIPT_USE_CUSTOM_TOOLTIP:
        "Wenn vorhanden, werden Host/Benutzer/Passwort/Port am Block angezeigt.",

    // Button-Blöcke
    PIB_ON_BUTTON_PRESSED: "wenn Button  %1 gedrückt wird",
    PIB_ON_BUTTON_PRESSED_TOOLTIP:
        "Führt die enthaltenen Blöcke einmal aus, sobald der gewählte Button gedrückt wird.",
    PIB_BUTTON_IS_PRESSED: "Button  %1 ist gedrückt",
    PIB_BUTTON_IS_PRESSED_TOOLTIP:
        "Gibt zurück, ob der gewählte Button aktuell gedrückt ist.",
    PIB_SET_BUTTON_COLOR: "setze Button  %1 Farbe auf %2",
    PIB_SET_BUTTON_COLOR_TOOLTIP: "Setzt die LED-Farbe des gewählten Buttons.",

    // Motornamen
    PIB_MOTOR_THUMB_LEFT_OPPOSITION: "Daumen links Opposition",
    PIB_MOTOR_THUMB_LEFT_STRETCH: "Daumen links strecken",
    PIB_MOTOR_INDEX_LEFT_STRETCH: "Zeigefinger links strecken",
    PIB_MOTOR_MIDDLE_LEFT_STRETCH: "Mittelfinger links strecken",
    PIB_MOTOR_RING_LEFT_STRETCH: "Ringfinger links strecken",
    PIB_MOTOR_PINKY_LEFT_STRETCH: "kleiner Finger links strecken",
    PIB_MOTOR_ALL_FINGERS_LEFT_STRETCH: "alle Finger links",
    PIB_MOTOR_THUMB_RIGHT_OPPOSITION: "Daumen rechts Opposition",
    PIB_MOTOR_THUMB_RIGHT_STRETCH: "Daumen rechts strecken",
    PIB_MOTOR_INDEX_RIGHT_STRETCH: "Zeigefinger rechts strecken",
    PIB_MOTOR_MIDDLE_RIGHT_STRETCH: "Mittelfinger rechts strecken",
    PIB_MOTOR_RING_RIGHT_STRETCH: "Ringfinger rechts strecken",
    PIB_MOTOR_PINKY_RIGHT_STRETCH: "kleiner Finger rechts strecken",
    PIB_MOTOR_ALL_FINGERS_RIGHT_STRETCH: "alle Finger rechts",
    PIB_MOTOR_UPPER_ARM_LEFT_ROTATION: "Oberarm links Rotation",
    PIB_MOTOR_ELBOW_LEFT: "Ellbogen links",
    PIB_MOTOR_LOWER_ARM_LEFT_ROTATION: "Unterarm links Rotation",
    PIB_MOTOR_WRIST_LEFT: "Handgelenk links",
    PIB_MOTOR_SHOULDER_VERTICAL_LEFT: "Schulter links vertikal",
    PIB_MOTOR_SHOULDER_HORIZONTAL_LEFT: "Schulter links horizontal",
    PIB_MOTOR_UPPER_ARM_RIGHT_ROTATION: "Oberarm rechts Rotation",
    PIB_MOTOR_ELBOW_RIGHT: "Ellbogen rechts",
    PIB_MOTOR_LOWER_ARM_RIGHT_ROTATION: "Unterarm rechts Rotation",
    PIB_MOTOR_WRIST_RIGHT: "Handgelenk rechts",
    PIB_MOTOR_SHOULDER_VERTICAL_RIGHT: "Schulter rechts vertikal",
    PIB_MOTOR_SHOULDER_HORIZONTAL_RIGHT: "Schulter rechts horizontal",
    PIB_MOTOR_TILT_FORWARD_HEAD: "Kopf nach vorne neigen",
    PIB_MOTOR_TURN_HEAD: "Kopf drehen",

    // Augen / Display
    PIB_SET_EYES: "setze Augen auf  %1",
    PIB_SET_EYES_TOOLTIP:
        "Zeigt die gewählte Augen-Emotion auf pibs Display (animierte Augen).",
    PIB_EYES_NEUTRAL: "neutral",
    PIB_EYES_HAPPY: "fröhlich",
    PIB_EYES_SAD: "traurig",
    PIB_EYES_ANGRY: "wütend",
    PIB_EYES_SURPRISED: "überrascht",
    PIB_EYES_SLEEPY: "müde",
    PIB_EYES_HEART: "verliebt",
    PIB_EYES_STAR: "begeistert",
    PIB_EYES_COOL: "cool",
    PIB_EYES_WINK: "zwinkernd",

    // WAV abspielen
    PIB_PLAY_WAV: "spiele WAV-Datei",
    PIB_PLAY_WAV_TOOLTIP: "Spielt eine aufgenommene/hochgeladene WAV-Datei ab",

    // Motorstrom
    PIB_MOTOR_CURRENT: "Motorstrom von  %1",
    PIB_MOTOR_CURRENT_TOOLTIP:
        "Liest die Stromaufnahme des Motors in mA - nützlich um z.B. ein blockiertes Gelenk zu erkennen",

    // Dropdown-Platzhalter, wenn noch keine Eintraege existieren
    PIB_NO_POSE_AVAILABLE: "keine Pose vorhanden",
    PIB_CREATE_LIST_VARIABLE: "Listenvariable erstellen...",

    // Overrides von Blockly-Core-/Plugin-Kontextmenue-Keys (keine eigenen
    // pib-Messages, daher kein PIB_-Praefix - diese exakten Key-Namen
    // werden direkt von Blockly-Core bzw. dem Multiselect-Plugin
    // nachgeschlagen).
    // Blocklys offizielles deutsches Sprachpaket uebersetzt den normalen
    // Rechtsklick-Punkt "Duplicate" (einzelnen Block klonen) mit "Kopieren"
    // statt "Duplizieren" - das wirkt neben dem echten Kopieren/Einfuegen
    // (siehe CROSS_TAB_* unten) verwirrend gleich, obwohl es zwei
    // unterschiedliche Aktionen sind.
    DUPLICATE_BLOCK: "Duplizieren",
    DUPLICATE_X_BLOCKS: "%1 Bausteine duplizieren",
    // CROSS_TAB_COPY/PASTE: der Rechtsklick "Copy"/"Paste" des Multiselect-
    // Plugins (echtes Kopieren/Einfuegen ueber die Zwischenablage, auch
    // tab-uebergreifend) - eine ANDERE Aktion als "Duplizieren" oben, muss
    // also auch anders heissen ("Kopieren"), sonst stehen zwei Punkte
    // gleichnamig im Menue. Faellt ohne diese Keys auf hartkodiertes
    // Englisch zurueck (waren bisher nirgends definiert).
    CROSS_TAB_COPY: "Kopieren",
    CROSS_TAB_COPY_X_BLOCKS: "%1 Bausteine kopieren",
    CROSS_TAB_PASTE: "Einfügen",
    CROSS_TAB_PASTE_X_BLOCKS: "%1 Bausteine einfügen",
};

export const PIB_BLOCKLY_LOCALES: PibBlocklyLocale[] = [
    {
        code: "de",
        label: "Deutsch",
        blocklyPack: BlocklyDe as unknown as {[key: string]: string},
        messages: DE_MESSAGES,
    },
    {
        code: "en",
        label: "English",
        blocklyPack: BlocklyEn as unknown as {[key: string]: string},
        messages: EN_MESSAGES,
    },
];

export const DEFAULT_LOCALE_CODE = "de";
