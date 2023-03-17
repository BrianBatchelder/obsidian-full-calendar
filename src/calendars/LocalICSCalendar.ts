import { TFile, TFolder } from "obsidian";
import { rrulestr } from "rrule";
import { EventPathLocation } from "../core/EventStore";
import { ObsidianInterface } from "../ObsidianAdapter";
import {
    modifyFrontmatterString,
    newFrontmatter,
} from "../serialization/frontmatter";
import { OFCEvent, EventLocation, validateEvent } from "../types";
import { EditableEventResponse } from "./EditableCalendar";
import { LocalCalendar } from "./LocalCalendar";
import { getEventsFromICS } from "../parsing/ics";
import { EventResponse } from "./Calendar";

const basenameFromEvent = (event: OFCEvent): string => {
    switch (event.type) {
        case undefined:
        case "single":
            return `${event.date} ${event.title}`;
        case "recurring":
            return `(Every ${event.daysOfWeek.join(",")}) ${event.title}`;
        case "rrule":
            return `(${rrulestr(event.rrule).toText()}) ${event.title}`;
    }
};

//const filenameForEvent = (event: OFCEvent) => `${basenameFromEvent(event)}.md`;

// REVISIT: Convert from FullNoteCalendar to LocalICSCalendar

export default class LocalICSCalendar extends LocalCalendar {
    app: ObsidianInterface;
    private _directory: string;
    private isRecursive: boolean;

    constructor(
        app: ObsidianInterface,
        color: string,
        directory: string,
        isRecursive: boolean
    ) {
        super(color);
        this.app = app;
        this._directory = directory;
        this.isRecursive = isRecursive;
    }
    get directory(): string {
        return this._directory;
    }

    get type(): "local" {
        return "local";
    }

    get identifier(): string {
        return this.directory;
    }

    get name(): string {
        return this.directory;
    }

    async getEventsInFile(file: TFile): Promise<EditableEventResponse[]> {
        let icsText = await this.app.read(file)
        let icsEvents = getEventsFromICS(icsText)

        if (!icsEvents) {
            return [];
        }

        var eventResponses:EditableEventResponse[] = [];
        // for (let i = 0; i < icsEvents.length; i++) {
        //     eventResponses.push([icsEvents[i], { file, lineNumber: undefined }]);
        // }
        eventResponses = icsEvents.map(event => ( [ event, { file, lineNumber: undefined } ] ));

        return eventResponses;
    }

    // private async getEventsFromFile(file: TFile): Promise<EditableEventResponse[]> {
    //     let icsText = await this.app.read(file)
    //     let icsEvents = getEventsFromICS(icsText)
    //     return icsEvents
    // }

    private async getEventsInFolderRecursive(
        folder: TFolder
    ): Promise<EventResponse[]> {
        const events = await Promise.all(
            folder.children.map(async (file) => {
                if (file instanceof TFile) {
                    return await this.getEventsInFile(file);
                } else if (file instanceof TFolder) {
                    return await this.getEventsInFolderRecursive(file);
                } else {
                    return [];
                }
            })
        );
        return events.flat();
    }

    async getEvents(): Promise<EventResponse[]> {
        console.log("BDB: LocalICSCalendar.getEvents(): directory =", this.directory)
        const eventFolder = this.app.getAbstractFileByPath(this.directory);
        if (!eventFolder) {
            throw new Error(`Cannot get folder ${this.directory}`);
        }
        if (!(eventFolder instanceof TFolder)) {
            throw new Error(`${eventFolder} is not a directory.`);
        }
        let events: EventResponse[] = [];
        for (const file of eventFolder.children) {
            if (file instanceof TFile) {
                if (file.extension !== "ics") {
                    console.log("BDB: LocalIcsSource.getEventInputsFromPath(): File:", file.name, "is not an ics file.")
                    continue
                }
                const results = await this.getEventsInFile(file);
                // let icsText = await this.app.read(file)
                // let icsEvents = getEventsFromICS(icsText).map((e) => [e, null])
                events.push(...results)
            } else if (file instanceof TFolder && this.isRecursive) {
                const results = await this.getEventsInFolderRecursive(file);
                events.push(...results);
            }
        }
        return events;
    }

    // async createEvent(event: OFCEvent): Promise<EventLocation> {
    //     const path = `${this.directory}/${filenameForEvent(event)}`;
    //     if (this.app.getAbstractFileByPath(path)) {
    //         throw new Error(`Event at ${path} already exists.`);
    //     }
    //     const file = await this.app.create(path, newFrontmatter(event));
    //     return { file, lineNumber: undefined };
    // }

    // getNewLocation(
    //     location: EventPathLocation,
    //     event: OFCEvent
    // ): EventLocation {
    //     const { path, lineNumber } = location;
    //     if (lineNumber !== undefined) {
    //         throw new Error("Note calendar cannot handle inline events.");
    //     }
    //     const file = this.app.getFileByPath(path);
    //     if (!file) {
    //         throw new Error(
    //             `File ${path} either doesn't exist or is a folder.`
    //         );
    //     }

    //     const updatedPath = `${file.parent.path}/${filenameForEvent(event)}`;
    //     return { file: { path: updatedPath }, lineNumber: undefined };
    // }

    // async modifyEvent(
    //     location: EventPathLocation,
    //     event: OFCEvent,
    //     updateCacheWithLocation: (loc: EventLocation) => void
    // ): Promise<void> {
    //     const { path } = location;
    //     const file = this.app.getFileByPath(path);
    //     if (!file) {
    //         throw new Error(
    //             `File ${path} either doesn't exist or is a folder.`
    //         );
    //     }
    //     const newLocation = this.getNewLocation(location, event);

    //     updateCacheWithLocation(newLocation);

    //     await this.app.rewrite(file, (page) =>
    //         modifyFrontmatterString(page, event)
    //     );
    //     if (file.path !== newLocation.file.path) {
    //         await this.app.rename(file, newLocation.file.path);
    //     }

    //     return;
    // }

    // async move(
    //     fromLocation: EventPathLocation,
    //     toCalendar: EditableCalendar
    // ): Promise<EventLocation> {
    //     const { path, lineNumber } = fromLocation;
    //     if (lineNumber !== undefined) {
    //         throw new Error("Note calendar cannot handle inline events.");
    //     }
    //     if (!(toCalendar instanceof FullNoteCalendar)) {
    //         throw new Error(
    //             `Event cannot be moved to a note calendar from a calendar of type ${toCalendar.type}.`
    //         );
    //     }
    //     const file = this.app.getFileByPath(path);
    //     if (!file) {
    //         throw new Error(`File ${path} not found.`);
    //     }
    //     const destDir = toCalendar.directory;
    //     const newPath = `${destDir}/${file.name}`;
    //     await this.app.rename(file, newPath);
    //     // TODO: Test to see if a file reference is still valid after a rename.
    //     const newFile = this.app.getAbstractFileByPath(newPath);
    //     if (!newFile || !(newFile instanceof TFile)) {
    //         throw new Error("File cannot be found after rename.");
    //     }
    //     return { file: newFile, lineNumber: undefined };
    // }

    // deleteEvent({ path, lineNumber }: EventPathLocation): Promise<void> {
    //     if (lineNumber !== undefined) {
    //         throw new Error("Note calendar cannot handle inline events.");
    //     }
    //     const file = this.app.getFileByPath(path);
    //     if (!file) {
    //         throw new Error(`File ${path} not found.`);
    //     }
    //     return this.app.delete(file);
    // }

    // async upgradeNote(file: TFile, event: OFCEvent) {
    //     await this.app.rewrite(file, (page) =>
    //         modifyFrontmatterString(page, event)
    //     );
    //     const newPath = `${this.directory}/${file.name}`;
    //     await this.app.rename(file, newPath);
    // }
}
