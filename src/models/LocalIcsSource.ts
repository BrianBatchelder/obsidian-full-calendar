import { EventInput, EventSourceInput } from "@fullcalendar/core";
import { TFile, TFolder, Vault } from "obsidian";
import { FCError, LocalIcalSource } from "src/types";
import { EventSource } from "./EventSource";
import { getColors } from "./util";
import { expandICalEvents, makeICalExpander } from "vendor/fullcalendar-ical/icalendar";
import { IcalExpander } from "vendor/fullcalendar-ical/ical-expander/IcalExpander";

// TODO: Refresh calendar on change to file or folder
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
		// const iCalendarObjects = await this.getICalendarObjectsFromFiles(recursive);
                // console.log("LocalIcsSource.getICalendarObjectsFromFiles(): expanding ics file contents")
                // let expander = makeICalExpander(iCalendarObjects);
                // let iCalEvents = expandICalEventsAll(expander);
                // console.log("LocalIcsSource.getICalendarObjectsFromFiles(): expanded ics events:", iCalEvents)
		// if (events instanceof FCError) {
        //     console.log("LocalIcsSource.toApi(",this.info.directory,") - FCError")
		// 	return events;
		// }
        // console.log("LocalIcsSource.toApi(",this.info.directory,") - Events:", events)
		const getExpander = async (): Promise<IcalExpander | FCError> => {
			// if (expander !== null) {
			// 	return expander;
			// }
			// try {
				let iCalendarObjects = await this.getICalendarObjectsFromFiles(recursive);
				// console.log("LocalIcsSouce.getExpander(): iCalendarObjects=",iCalendarObjects)
				// REVISIT: I hate having to manually extract the VEVENTs and build a VCALENDAR. The spec apparently
				//   allows for multiple VCALENDARs in a single text, but the expander doesn't seem to support it.
				let iCalendar = "BEGIN:VCALENDAR\n" + iCalendarObjects + "\nEND:VCALENDAR"
				// console.log("LocalIcsSouce.getExpander(): iCalendar=",iCalendar)
				let expander = makeICalExpander(iCalendar);
				return expander;
			// } catch (e) {
			// 	console.error(`Error loading calendar from ${url}`);
			// 	console.error(e);
			// 	return new FCError(
			// 		`There was an error loading a calendar. Check the console for full details.`
			// 	);
			// }
		};
		return {
			events: async function ({ start, end }) {
				console.log("LocalIcsSource: get events from",start,"to",end)
				const ical = await getExpander();
				// console.log("LocalIcsSource.toApi(): got expander:", ical)
				if (ical instanceof FCError) {
					throw new Error("Could not get calendar: " + ical.message);
				}
				// const events = expandICalEventsAll(ical);
				const events = expandICalEvents(ical, {
					start,
					end,
				});
				console.log("LocalIcsSouce.toApi(): events=",events)
				return events;
			},
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

    private async getICalendarObjectsFromFiles(
		recursive?: boolean,
		path?: string
	): Promise<string> {
		const eventFolder = this.vault.getAbstractFileByPath(
			path || this.info.directory
		);
		if (!(eventFolder instanceof TFolder)) {
			return "";
		}
        // let events: EventInput = [];
		var iCalendarObjects = ""
		for (let file of eventFolder.children) {
			if (file instanceof TFile) {				
				if (file.extension !== "ics") {
                    console.log("LocalIcsSource.getEventInputsFromPath(): File:", file.name, "is not an ics file.")
                    continue
                }
                // console.log("LocalIcsSource.getEventInputsFromPath(): Reading ics file @ path:", eventFolder.path, ", name: ", file.name, ", extension: ", file.extension)
                let iCalendarObject = await this.vault.cachedRead(file)
                //console.log("LocalIcsSource.getEventInputsFromPath(): ics file contents: ", iCalendarObject)
				// strip VEVENT out of VCALENDAR
				let vEventOnly = iCalendarObject.replace(/[\s\S]*BEGIN\:VEVENT/, "BEGIN:VEVENT").replace(/END\:VEVENT[\s\S]*/, "END:VEVENT\n")
				//let vEventOnly = iCalendarObject.replace(/.*BEGIN:VCALENDAR/, "BEGIN:VEVENT")
				//console.log("LocalIcsSource.getEventInputsFromPath(): vEvent", vEventOnly)
				iCalendarObjects = iCalendarObjects.concat(vEventOnly)
                // console.log("LocalIcsSource.getEventInputsFromPath(): ics objects so far: ", iCalendarObjects)


//                events.push(iCalEvents)
                // for (let event of iCalEvents) {
                //     events.push(event)
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
                
			} else if (recursive) {
				// process child folders
				const childICalendarObjects = await this.getICalendarObjectsFromFiles(
					recursive,
					file.path
				);
				iCalendarObjects = iCalendarObjects.concat(childICalendarObjects)
				// if (childEvents instanceof FCError) {
				// 	return childEvents;
				// }
				// events.push(...childEvents);
			}
		}
		return iCalendarObjects;
	}
}