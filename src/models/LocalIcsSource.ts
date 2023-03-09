import { EventInput, EventSourceInput } from "@fullcalendar/core";
import { TFile, TFolder, Vault } from "obsidian";
import { FCError, LocalIcalSource } from "src/types";
import { EventSource } from "./EventSource";
import { getColors } from "./util";
import { expandICalEventsAll, makeICalExpander } from "vendor/fullcalendar-ical/icalendar";

export class LocalIcsSource extends EventSource {
	info: LocalIcalSource;
	vault: Vault;

	constructor(vault: Vault, info: LocalIcalSource) {
		super();
		this.vault = vault;
		this.info = info;
	}

	async toApi(recursive = false): Promise<EventSourceInput | FCError> {
		console.log("LocalIcsSource.toApi(",this.info.directory,")")
		const events = await this.getEventInputsFromPath(recursive);
		if (events instanceof FCError) {
            console.log("LocalIcsSource.toApi(",this.info.directory,") - FCError")
			return events;
		}
        console.log("LocalIcsSource.toApi(",this.info.directory,") - Events:", events)
		return {
			events: events,
            editable: false,
			...getColors(this.info.color),
		};
	}

    // private async getIcalExpander() {
    //     let expander: IcalExpander | null = null;
	// 	const getExpander = async (): Promise<IcalExpander | FCError> => {
	// 		if (expander !== null) {
	// 			return expander;
	// 		}
	// 		try {
	// 			let text = await request({
	// 				url: url,
	// 				method: "GET",
	// 			});
	// 			expander = makeICalExpander(text);
	// 			return expander;
	// 		} catch (e) {
	// 			console.error(`Error loading calendar from ${url}`);
	// 			console.error(e);
	// 			return new FCError(
	// 				`There was an error loading a calendar. Check the console for full details.`
	// 			);
	// 		}
    //     }
    // }

    private async getEventInputsFromPath(
		recursive?: boolean,
		path?: string
	): Promise<EventInput[] | FCError> {
		const eventFolder = this.vault.getAbstractFileByPath(
			path || this.info.directory
		);
		if (!(eventFolder instanceof TFolder)) {
			return new FCError("Directory");
		}
        let events: EventInput = [];
		for (let file of eventFolder.children) {
			if (file instanceof TFile) {				
				if (file.extension !== "ics") {
                    console.log("LocalIcsSource.getEventInputsFromPath(): File:", file.name, "is not an ics file.")
                    continue
                }
                // console.log("LocalIcsSource.getEventInputsFromPath(): Reading ics file @ path:", eventFolder.path, ", name: ", file.name, ", extension: ", file.extension)
                let fileContents = await this.vault.cachedRead(file)
                // console.log("LocalIcsSource.getEventInputsFromPath(): ics file contents: ", fileContents)

                // console.log("LocalIcsSource.getEventInputsFromPath(): expanding ics file contents")
                let expander = makeICalExpander(fileContents);
                let iCalEvents = expandICalEventsAll(expander);
                // console.log("LocalIcsSource.getEventInputsFromPath(): expanded ics events:", iCalEvents)

//                events.push(iCalEvents)
                for (let event of iCalEvents) {
                    events.push(event)
// //                    if (event) {
//                     console.log("LocalIcsSource.getEventInputsFromPath(): ics event:", event)

//                         let calEvent = event.toCalendarEvent();
//                         if (calEvent) {
//                             events.push(calEvent);
//                         } else {
//                             console.error(
//                                 "FC: Event malformed, will not add to calendar.",
//                                 event
//                             );
//                         }
//                     // }
                }
			} else if (recursive) {
				const childEvents = await this.getEventInputsFromPath(
					recursive,
					file.path
				);
				if (childEvents instanceof FCError) {
					return childEvents;
				}
				events.push(...childEvents);
			}
		}
		return events;
	}
}