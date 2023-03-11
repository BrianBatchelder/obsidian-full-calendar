import { EventInput, EventSourceInput } from "@fullcalendar/core";
import { TAbstractFile, TFile, TFolder, Vault } from "obsidian";
import { FCError, LocalIcalSource } from "src/types";
import { EventSource } from "./EventSource";
import { getColors } from "./util";
import { expandICalEvents, makeICalExpander } from "vendor/fullcalendar-ical/icalendar";
import { IcalExpander } from "vendor/fullcalendar-ical/ical-expander/IcalExpander";

export class LocalIcsSource extends EventSource {
	info: LocalIcalSource;
	vault: Vault;
    // recursive: Boolean;

	constructor(vault: Vault, info: LocalIcalSource) {
		super();
		this.vault = vault;
		this.info = info;
        this.recursive = false;
	}

    // REVISIT: Return an EventSourceFunc instead. FullCalendar will call this function whenever it needs new event data. 
    //   This is triggered when the user clicks prev/next or switches views. 
    //   I'm betting it also works with calendar.refetchEvents() or eventSource.refetch().
	async toApi(recursive = false): Promise<EventSourceInput | FCError> {
		console.log("LocalIcsSource.toApi(",this.info.directory,")")
		// const events = await this.getEventInputsFromPath(recursive);
		// if (events instanceof FCError) {
        //     console.log("LocalIcsSource.toApi(",this.info.directory,") - FCError")
		// 	return events;
		// }
        console.log("LocalIcsSource.toApi(",this.info.directory,") - Events:", events)
		// this.recursive = recursive
		const recurseDirectories = recursive
		const getExpander = async(): Promise<IcalExpander | FCError> => {
			console.log(this.info)
		}
		return {
			//events: events,
			// events: function(info, successCallback, failureCallback) { },
			events: async function ({ start, end }) {
				console.log("LocalIcsSource.toApi(): Getting events between", start, "and end:", end)
				const ical = await getExpander();
                console.log("LocalIcsSource.toApi() - Events:", events)
                if (ical instanceof FCError) {
                    console.log("LocalIcsSource.toApi() - FCError:", ical)
                }
				const events = expandICalEvents(ical, {
					start,
					end,
				});
				return events;
			},
            editable: false,
			...getColors(this.info.color),
		};
	}

    async getEventInputsFromPath(
		recursive?: boolean,
		path?: string
	): Promise<EventInput[] | FCError> {
		const eventFolder = this.vault.getAbstractFileByPath(
			path || this.info.directory
		);
		if (!(eventFolder instanceof TFolder)) {
			return new FCError("Directory");
		}
        let events: EventInput[] = [];
		for (let file of eventFolder.children) {
            const childEvents = await this.getEvents(file, recursive);
            if (childEvents instanceof FCError) {
                return childEvents;
            }
            events.push(...childEvents);
			// if (file instanceof TFile) {				
			// 	if (file.extension !== "ics") {
            //         console.log("LocalIcsSource.getEventInputsFromPath(): File:", file.name, "is not an ics file.")
            //         continue
            //     }
            //     let fileContents = await this.vault.cachedRead(file)

            //     let expander = makeICalExpander(fileContents);
            //     let iCalEvents = expandICalEventsAll(expander);
            //     for (let event of iCalEvents) {
            //         console.log("LocalIcsSource.getEventInputsFromPath(): event: ", event, "event title:", event.title, "event idForCalendar:", event.identifier, "type of event:", typeof event)
            //         events.push(event)
            //     }
			// } else if (recursive) {
			// 	const childEvents = await this.getEventInputsFromPath(
			// 		recursive,
			// 		file.path
			// 	);
			// 	if (childEvents instanceof FCError) {
			// 		return childEvents;
			// 	}
			// 	events.push(...childEvents);
			// }
		}
		return events;
	}

    async getEvents(file: TAbstractFile, recursive?: boolean): Promise<EventInput[] | FCError> {
        let events: EventInput[] = [];
		//for (let file of abstractFile.children) {
			if (file instanceof TFile) {				
				if (file.extension !== "ics") {
                    console.log("LocalIcsSource.getEventInputsFromPath(): File:", file.name, "is not an ics file.")
                    return events
                }
                let fileContents = await this.vault.cachedRead(file)

                let expander = makeICalExpander(fileContents);
                let iCalEvents = expandICalEventsAll(expander);
                for (let event of iCalEvents) {
                    console.log("LocalIcsSource.getEventInputsFromPath(): event: ", event, "event title:", event.title, "event idForCalendar:", event.identifier, "type of event:", typeof event)
                    events.push(event)
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
		//}
        
        return events
    }
}