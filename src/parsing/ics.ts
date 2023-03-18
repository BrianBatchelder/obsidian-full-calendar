import ical from "ical.js";
import { OFCEvent, validateEvent } from "../types";
import { DateTime } from "luxon";
import { rrulestr } from "rrule";

function getDate(t: ical.Time): string {
    return DateTime.fromSeconds(t.toUnixTime(), { zone: "UTC" }).toISODate();
}

function getTime(t: ical.Time): string {
    if (t.isDate) {
        return "00:00";
    }
    return DateTime.fromSeconds(t.toUnixTime(), { zone: "UTC" }).toISOTime({
        includeOffset: false,
        includePrefix: false,
        suppressMilliseconds: true,
        suppressSeconds: true,
    });
}

function extractEventUrl(iCalEvent: ical.Event): string {
    let urlProp = iCalEvent.component.getFirstProperty("url");
    return urlProp ? urlProp.getFirstValue() : "";
}

function specifiesEnd(iCalEvent: ical.Event) {
    return (
        Boolean(iCalEvent.component.getFirstProperty("dtend")) ||
        Boolean(iCalEvent.component.getFirstProperty("duration"))
    );
}

function icsToOFC(input: ical.Event, tz: ical.Timezone): OFCEvent {
    if (input.isRecurring()) {
        const rrule = rrulestr(
            input.component.getFirstProperty("rrule").getFirstValue().toString()
        );
        const allDay = input.startDate.isDate;
        const exdates = input.component
            .getAllProperties("exdate")
            .map((exdateProp) => {
                const exdate = exdateProp.getFirstValue();
                // NOTE: We only store the date from an exdate and recreate the full datetime exdate later,
                // so recurring events with exclusions that happen more than once per day are not supported.
                return getDate(exdate);
            });
        return {
            type: "rrule",
            title: input.summary,
            id: `ics::${input.uid}::${DateTime.fromJSDate(
                rrule.options.dtstart
            ).toISODate()}::recurring`,
            rrule: rrule.toString(),
            skipDates: exdates,
            startDate: getDate(
                input.startDate.convertToZone(tz)
            ),
            ...(allDay
                ? { allDay: true }
                : {
                      allDay: false,
                      startTime: getTime(
                          input.startDate.convertToZone(tz)
                          ),
                      endTime: getTime(
                          input.endDate.convertToZone(tz)
                      ),
                  }),
        };
    } else {
        const date = getDate(input.startDate.convertToZone(tz));
        console.log("BDB: ics.icsToOFC(",input.summary,"): start date = ", date, "tz =", tz);
        const endDate =
            specifiesEnd(input) && input.endDate
                ? getDate(input.endDate.convertToZone(tz))
                : undefined;
        console.log("BDB: ics.icsToOFC(",input.summary,"): end date = ", endDate);
        const allDay = input.startDate.convertToZone(tz).isDate;
        console.log("BDB: ics.icsToOFC(",input.summary,"): start time = ", input.startDate.convertToZone(tz));
        console.log("BDB: ics.icsToOFC(",input.summary,"): end time = ", input.endDate.convertToZone(tz));
        console.log("BDB: ics.icsToOFC(",input.summary,"): start time = ", getTime(input.startDate.convertToZone(tz)));
        console.log("BDB: ics.icsToOFC(",input.summary,"): end time = ", getTime(input.endDate.convertToZone(tz)));
        return {
            type: "single",
            id: `ics::${input.uid}::${date}::single`,
            title: input.summary,
            date,
            endDate: date !== endDate ? endDate : undefined,
            ...(allDay
                ? { allDay: true }
                : {
                      allDay: false,
                      startTime: getTime(input.startDate.convertToZone(tz)),
                      endTime: getTime(input.startDate.convertToZone(tz)),
                  }),
        };
    }
}

export function getEventsFromICS(text: string): OFCEvent[] {
    const jCalData = ical.parse(text);
    const component = new ical.Component(jCalData);
    console.log("BDB: getEventsFromICS(): component:", component)

    // TODO: Timezone support
    const tzc = component.getAllSubcomponents("vtimezone");
    let tz = ical.Timezone.localTimezone;
    if (tzc.length > 0) {
        tz = new ical.Timezone(tzc[0]);
    }
    console.log("tz =", tz)

    const events: ical.Event[] = component
        .getAllSubcomponents("vevent")
        .map((vevent) => new ical.Event(vevent))
        .filter((evt) => {
            //console.log("BDB: getEventsFromICS(): summary =", evt.summary, ", startDate =", evt.startDate)
            evt.iterator;
            try {
                console.log("BDB: getEventsFromICS(): summary =", evt.summary, ", startDate =", evt.startDate)
                evt.startDate.toJSDate();
                evt.endDate.toJSDate();
                return true;
            } catch (err) {
                // skipping events with invalid time
                return false;
            }
        });

    // Events with RECURRENCE-ID will have duplicated UIDs.
    // We need to modify the base event to exclude those recurrence exceptions.
    const baseEvents = Object.fromEntries(
        events
            .filter((e) => e.recurrenceId === null)
            .map((e) => [e.uid, icsToOFC(e, tz)])
    );

    const recurrenceExceptions = events
        .filter((e) => e.recurrenceId !== null)
        .map((e): [string, OFCEvent] => [e.uid, icsToOFC(e, tz)]);

    for (const [uid, event] of recurrenceExceptions) {
        const baseEvent = baseEvents[uid];
        if (!baseEvent) {
            continue;
        }

        if (baseEvent.type !== "rrule" || event.type !== "single") {
            console.warn(
                "Recurrence exception was recurring or base event was not recurring",
                { baseEvent, recurrenceException: event }
            );
            continue;
        }
        baseEvent.skipDates.push(event.date);
    }

    const allEvents = Object.values(baseEvents).concat(
        recurrenceExceptions.map((e) => e[1])
    );

    return allEvents.map(validateEvent).flatMap((e) => (e ? [e] : []));
}
